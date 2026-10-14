// src/services/SsoService.ts - OGS single sign-on for attendance
import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey } from 'jose';
import { UserModel } from '../models/User';
import { SsoTokenUseModel } from '../models/SsoTokenUse';
import { signToken, signRefreshToken } from '../utils/jwt';
import { UserRoleEnum, UserStatusEnum } from '../types/interfaces';
import { OgsStaffService, ogsStaffService, resolveAttendanceRole } from './OgsStaffService';

export type SsoErrorCode =
  | 'not_configured'
  | 'invalid_token'
  | 'token_replayed'
  | 'not_linked'
  | 'sso_disabled'
  | 'account_inactive'
  | 'ogs_role_missing'
  | 'ogs_unavailable';

export class SsoError extends Error {
  constructor(
    public readonly code: SsoErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SsoError';
  }
}

// ID tokens are exchanged right after the OIDC callback, so anything older
// than this is not a login in progress.
const MAX_ID_TOKEN_AGE = '5m';
const ALLOWED_ALGORITHMS = ['RS256', 'PS256', 'ES256', 'EdDSA'];

type UserDocument = InstanceType<typeof UserModel>;

export interface SsoLoginResult {
  token: string;
  refreshToken: string;
  user: {
    _id: string;
    email: string;
    name: string;
    role: UserRoleEnum;
    status: UserStatusEnum;
    last_login?: Date;
  };
}

export const getOgsIssuer = (): string | null => process.env.OGS_OIDC_ISSUER?.trim() || null;

/**
 * Resolves the issuer's signing keys from its discovery document, unless
 * OGS_OIDC_JWKS_URI names them directly. The key set is cached by jose.
 */
const createOgsKeyResolver = (): JWTVerifyGetKey => {
  let resolver: JWTVerifyGetKey | null = null;

  return async (header, token) => {
    if (!resolver) {
      const issuer = getOgsIssuer();
      if (!issuer) throw new Error('OGS_OIDC_ISSUER is not configured');

      let jwksUri = process.env.OGS_OIDC_JWKS_URI?.trim();
      if (!jwksUri) {
        const discoveryUrl = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
        const response = await fetch(discoveryUrl, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          throw new Error(`OIDC discovery failed with status ${response.status}`);
        }
        const discovery = (await response.json()) as { jwks_uri?: unknown };
        if (typeof discovery.jwks_uri !== 'string') {
          throw new Error('OIDC discovery document has no jwks_uri');
        }
        jwksUri = discovery.jwks_uri;
      }
      resolver = createRemoteJWKSet(new URL(jwksUri));
    }
    return resolver(header, token);
  };
};

export class SsoService {
  constructor(
    private readonly staff: OgsStaffService = ogsStaffService,
    private readonly getKey: JWTVerifyGetKey = createOgsKeyResolver()
  ) {}

  /**
   * Verify an ID token issued by OGS for the attendance client.
   */
  async verifyIdToken(idToken: string): Promise<JWTPayload & { sub: string }> {
    const issuer = getOgsIssuer();
    const audience = process.env.OGS_OIDC_CLIENT_ID?.trim();
    if (!issuer || !audience) {
      throw new SsoError('not_configured', 503, 'OGS single sign-on is not configured');
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, this.getKey, {
        issuer,
        audience,
        maxTokenAge: MAX_ID_TOKEN_AGE,
        algorithms: ALLOWED_ALGORITHMS,
        requiredClaims: ['sub', 'iat', 'exp'],
      }));
    } catch {
      throw new SsoError('invalid_token', 401, 'Invalid OGS ID token');
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new SsoError('invalid_token', 401, 'Invalid OGS ID token');
    }

    return payload as JWTPayload & { sub: string };
  }

  /**
   * Record the token as used. A second exchange of the same token fails.
   */
  async consumeIdToken(idToken: string, expiresAtSeconds: number): Promise<void> {
    const tokenHash = createHash('sha256').update(idToken).digest('hex');
    try {
      await SsoTokenUseModel.create({
        token_hash: tokenHash,
        expires_at: new Date(expiresAtSeconds * 1000),
      });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        throw new SsoError('token_replayed', 401, 'OGS ID token has already been used');
      }
      throw error;
    }
  }

  /**
   * Check that OGS still lets this account in (admin or editor, approved,
   * not inactive). Fails closed: when OGS cannot be asked, access is denied.
   */
  async assertOgsAccess(subject: string): Promise<void> {
    let account;
    try {
      account = await this.staff.findById(subject);
    } catch {
      throw new SsoError('ogs_unavailable', 503, 'Could not verify the account with OGS');
    }

    if (!resolveAttendanceRole(account)) {
      throw new SsoError('ogs_role_missing', 403, 'The OGS account has no access to attendance');
    }
  }

  /**
   * Check that a user may (still) hold an SSO session. Used both at login and
   * at every access token refresh. OGS only decides whether the user gets in;
   * the role is the one an admin set in attendance, so an OGS admin can be
   * limited to editor here.
   */
  async assertSsoAccess(user: UserDocument): Promise<UserRoleEnum> {
    const issuer = getOgsIssuer();
    const identity = user.external_identity;

    if (!issuer || !identity?.subject || identity.issuer !== issuer) {
      throw new SsoError('not_linked', 403, 'The account is not linked to OGS');
    }
    if (!user.sso_enabled) {
      throw new SsoError('sso_disabled', 403, 'Sign-in through OGS is not enabled for this account');
    }
    if (user.status !== UserStatusEnum.ACTIVE) {
      throw new SsoError('account_inactive', 403, `Account is ${user.status}`);
    }

    await this.assertOgsAccess(identity.subject);
    return user.role;
  }

  /**
   * Exchange a verified OGS ID token for an attendance session.
   */
  async loginWithIdToken(idToken: string): Promise<SsoLoginResult> {
    const claims = await this.verifyIdToken(idToken);
    await this.consumeIdToken(idToken, claims.exp as number);

    // Linking is done by an admin; the account is never matched on email.
    const user = await UserModel.findOne({
      'external_identity.issuer': claims.iss,
      'external_identity.subject': claims.sub,
    });
    if (!user) {
      throw new SsoError('not_linked', 403, 'The OGS account is not linked to an attendance user');
    }

    await this.assertSsoAccess(user);

    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    const userId = user._id.toString();
    return {
      token: signToken(userId, { sso: true }),
      refreshToken: signRefreshToken(userId, { sso: true }),
      user: {
        _id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        last_login: user.last_login,
      },
    };
  }
}

export const ssoService = new SsoService();
