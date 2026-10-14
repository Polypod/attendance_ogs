import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, KeyLike } from 'jose';
import { UserModel } from '../../models/User';
import { SsoService, SsoError } from '../../services/SsoService';
import { OgsStaffAccount, OgsStaffService } from '../../services/OgsStaffService';
import { verifyRefreshToken, verifyToken } from '../../utils/jwt';
import { UserRoleEnum } from '../../types/interfaces';

const ISSUER = 'https://ogs.test';
const CLIENT_ID = 'attendance';

describe('SsoService', () => {
  const env = process.env;
  let privateKey: KeyLike;
  let getKey: ReturnType<typeof createLocalJWKSet>;
  let staffAccount: OgsStaffAccount | null;
  let staffError: Error | null;
  let service: SsoService;

  const staff = new OgsStaffService(async () => {
    if (staffError) throw staffError;
    return staffAccount ? [staffAccount] : [];
  });

  const idToken = (overrides: { sub?: string; aud?: string; iss?: string; iat?: number } = {}) => {
    const jwt = new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject(overrides.sub ?? 'ogs1')
      .setIssuer(overrides.iss ?? ISSUER)
      .setAudience(overrides.aud ?? CLIENT_ID)
      .setExpirationTime('10m');
    if (overrides.iat !== undefined) jwt.setIssuedAt(overrides.iat);
    else jwt.setIssuedAt();
    return jwt.sign(privateKey);
  };

  const createUser = (overrides: Record<string, unknown> = {}) =>
    UserModel.create({
      email: 'editor@example.com',
      name: 'Editor',
      role: UserRoleEnum.EDITOR,
      created_by: 'test',
      external_identity: { issuer: ISSUER, subject: 'ogs1' },
      sso_enabled: true,
      ...overrides,
    });

  beforeAll(async () => {
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    const jwk = { ...(await exportJWK(keys.publicKey)), kid: 'k1', alg: 'RS256' };
    getKey = createLocalJWKSet({ keys: [jwk] });
  });

  beforeEach(() => {
    process.env = {
      ...env,
      OGS_OIDC_ISSUER: ISSUER,
      OGS_OIDC_CLIENT_ID: CLIENT_ID,
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    };
    staffAccount = {
      id: 'ogs1',
      email: 'editor@example.com',
      displayName: 'Editor',
      roles: ['editor'],
      status: 'approved',
      isActive: null,
    };
    staffError = null;
    service = new SsoService(staff, getKey);
  });

  afterAll(() => {
    process.env = env;
  });

  const expectSsoError = async (promise: Promise<unknown>, code: string, status: number) => {
    const error = await promise.then(
      () => null,
      (e) => e
    );
    expect(error).toBeInstanceOf(SsoError);
    expect(error).toMatchObject({ code, status });
  };

  it('starts a short-lived SSO session for a linked, enabled account', async () => {
    const user = await createUser();

    const result = await service.loginWithIdToken(await idToken());

    expect(result.user._id).toBe(user._id.toString());
    expect(result.user.role).toBe(UserRoleEnum.EDITOR);

    const access = verifyToken(result.token);
    expect(access.sso).toBe(true);
    expect(access.exp! - access.iat!).toBe(5 * 60);
    expect(verifyRefreshToken(result.refreshToken).sso).toBe(true);
  });

  it('keeps the attendance role when the user is admin in OGS', async () => {
    const user = await createUser({ role: UserRoleEnum.EDITOR });
    staffAccount!.roles = ['editor', 'admin'];

    const result = await service.loginWithIdToken(await idToken());

    expect(result.user.role).toBe(UserRoleEnum.EDITOR);
    const stored = await UserModel.findById(user._id);
    expect(stored?.role).toBe(UserRoleEnum.EDITOR);
    await expect(service.assertSsoAccess(stored!)).resolves.toBe(UserRoleEnum.EDITOR);
  });

  it('keeps an attendance admin who is editor in OGS', async () => {
    await createUser({ role: UserRoleEnum.ADMIN });
    staffAccount!.roles = ['editor'];

    const result = await service.loginWithIdToken(await idToken());

    expect(result.user.role).toBe(UserRoleEnum.ADMIN);
  });

  it('accepts an ID token only once', async () => {
    await createUser();
    const token = await idToken();

    await service.loginWithIdToken(token);
    await expectSsoError(service.loginWithIdToken(token), 'token_replayed', 401);
  });

  it('never links on email', async () => {
    await createUser({ external_identity: undefined, sso_enabled: false, password: 'password123' });

    await expectSsoError(service.loginWithIdToken(await idToken()), 'not_linked', 403);
  });

  it('denies a linked account without the SSO checkbox', async () => {
    await createUser({ sso_enabled: false });
    await expectSsoError(service.loginWithIdToken(await idToken()), 'sso_disabled', 403);
  });

  it('denies an inactive attendance account', async () => {
    await createUser({ status: 'inactive' });
    await expectSsoError(service.loginWithIdToken(await idToken()), 'account_inactive', 403);
  });

  it('denies an account whose OGS role does not allow attendance', async () => {
    await createUser();
    staffAccount!.roles = ['member'];
    await expectSsoError(service.loginWithIdToken(await idToken()), 'ogs_role_missing', 403);
  });

  it('fails closed when OGS cannot be reached', async () => {
    await createUser();
    staffError = new Error('timeout');
    await expectSsoError(service.loginWithIdToken(await idToken()), 'ogs_unavailable', 503);
  });

  it.each([
    ['another audience', { aud: 'other-client' }],
    ['another issuer', { iss: 'https://ogs.minamail.se' }],
    ['an old token', { iat: Math.floor(Date.now() / 1000) - 10 * 60 }],
  ])('rejects %s', async (_label, overrides) => {
    await createUser();
    await expectSsoError(service.loginWithIdToken(await idToken(overrides)), 'invalid_token', 401);
  });

  it('rejects a token signed with another key', async () => {
    await createUser();
    const other = await generateKeyPair('RS256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('ogs1')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(other.privateKey);

    await expectSsoError(service.loginWithIdToken(token), 'invalid_token', 401);
  });

  it('is unavailable when not configured', async () => {
    delete process.env.OGS_OIDC_CLIENT_ID;
    await expectSsoError(service.verifyIdToken('x'), 'not_configured', 503);
  });

  it('re-checks a session against the configured issuer', async () => {
    const user = await createUser({ external_identity: { issuer: 'https://ogs.minamail.se', subject: 'ogs1' } });
    await expectSsoError(service.assertSsoAccess(user), 'not_linked', 403);
  });
});

describe('User model', () => {
  it('requires a password unless the user is linked to OGS', async () => {
    await expect(
      UserModel.create({ email: 'x@example.com', name: 'No Pass', role: UserRoleEnum.EDITOR, created_by: 't' })
    ).rejects.toThrow('Password is required');

    const user = await UserModel.create({
      email: 'y@example.com',
      name: 'Linked',
      role: UserRoleEnum.EDITOR,
      created_by: 't',
      external_identity: { issuer: ISSUER, subject: 'ogs2' },
    });
    expect(await user.comparePassword('anything')).toBe(false);
  });

  it('links one OGS account to at most one user', async () => {
    await UserModel.init();
    const base = { name: 'Linked', role: UserRoleEnum.EDITOR, created_by: 't' };
    await UserModel.create({ ...base, email: 'a@example.com', external_identity: { issuer: ISSUER, subject: 'same' } });

    await expect(
      UserModel.create({ ...base, email: 'b@example.com', external_identity: { issuer: ISSUER, subject: 'same' } })
    ).rejects.toMatchObject({ code: 11000 });

    // Unlinked users do not collide with each other.
    await UserModel.create({ ...base, email: 'c@example.com', password: 'password123' });
    await UserModel.create({ ...base, email: 'd@example.com', password: 'password123' });
  });
});
