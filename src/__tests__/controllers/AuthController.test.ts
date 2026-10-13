import { AuthController } from '../../controllers/AuthController';
import { UserModel } from '../../models/User';
import { signRefreshToken, signToken, verifyRefreshToken } from '../../utils/jwt';
import { ssoService, SsoError } from '../../services/SsoService';

jest.mock('../../models/User', () => ({
  UserModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('../../utils/jwt', () => ({
  signToken: jest.fn(),
  signRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

jest.mock('../../services/SsoService', () => {
  class MockSsoError extends Error {
    constructor(public code: string, public status: number, message: string) {
      super(message);
    }
  }
  return {
    SsoError: MockSsoError,
    ssoService: {
      assertSsoAccess: jest.fn(),
      loginWithIdToken: jest.fn(),
    },
  };
});

describe('AuthController', () => {
  const controller = new AuthController();
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as any;
  const res: any = { status, json };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('returns 401 when user not found', async () => {
      (UserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const req: any = { body: { email: 'missing@example.com', password: 'pw' } };
      await controller.login(req, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'Invalid email or password' });
    });

    it('returns 401 when password is incorrect', async () => {
      const user: any = {
        comparePassword: jest.fn().mockResolvedValue(false),
      };
      (UserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const req: any = { body: { email: 'a@b.com', password: 'wrong' } };
      await controller.login(req, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'Invalid email or password' });
    });

    it('returns 403 when user is not active', async () => {
      const user: any = {
        status: 'inactive',
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      (UserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const req: any = { body: { email: 'a@b.com', password: 'pw' } };
      await controller.login(req, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
        success: false,
        message: 'Account is inactive. Please contact an administrator.',
      });
    });

    it('returns tokens and user info on success', async () => {
      (signToken as jest.Mock).mockReturnValue('access');
      (signRefreshToken as jest.Mock).mockReturnValue('refresh');

      const user: any = {
        _id: { toString: () => 'u1' },
        email: 'a@b.com',
        name: 'A',
        role: 'admin',
        status: 'active',
        last_login: undefined,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      (UserModel.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });

      const req: any = { body: { email: 'a@b.com', password: 'pw' } };
      await controller.login(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'access',
          refreshToken: 'refresh',
          user: expect.objectContaining({ _id: 'u1', email: 'a@b.com' }),
        })
      );
      expect(user.save).toHaveBeenCalledWith({ validateBeforeSave: false });
    });
  });

  describe('refreshToken', () => {
    it('returns 400 when refresh token is missing', async () => {
      const req: any = { body: {} };
      await controller.refreshToken(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'Refresh token is required' });
    });

    it('returns 401 when refresh token is invalid', async () => {
      (verifyRefreshToken as jest.Mock).mockImplementation(() => {
        throw new Error('bad');
      });

      const req: any = { body: { refreshToken: 'nope' } };
      await controller.refreshToken(req, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'bad' });
    });

    it('returns 401 when user no longer exists', async () => {
      (verifyRefreshToken as jest.Mock).mockReturnValue({ id: 'u1' });
      (UserModel.findById as jest.Mock).mockResolvedValue(null);

      const req: any = { body: { refreshToken: 'ok' } };
      await controller.refreshToken(req, res);

      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'User no longer exists' });
    });

    it('returns 403 when user is not active', async () => {
      (verifyRefreshToken as jest.Mock).mockReturnValue({ id: 'u1' });
      (UserModel.findById as jest.Mock).mockResolvedValue({ _id: { toString: () => 'u1' }, status: 'inactive' });

      const req: any = { body: { refreshToken: 'ok' } };
      await controller.refreshToken(req, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'Account is inactive' });
    });

    it('returns new access token on success', async () => {
      (verifyRefreshToken as jest.Mock).mockReturnValue({ id: 'u1' });
      (UserModel.findById as jest.Mock).mockResolvedValue({ _id: { toString: () => 'u1' }, status: 'active' });
      (signToken as jest.Mock).mockReturnValue('new-access');

      const req: any = { body: { refreshToken: 'ok' } };
      await controller.refreshToken(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        token: 'new-access',
        role: undefined,
      });
      expect(ssoService.assertSsoAccess).not.toHaveBeenCalled();
      expect(signToken).toHaveBeenCalledWith('u1', { sso: false });
    });

    it('re-checks OGS and issues a short-lived token for an SSO session', async () => {
      const user = { _id: { toString: () => 'u1' }, status: 'active', role: 'editor' };
      (verifyRefreshToken as jest.Mock).mockReturnValue({ id: 'u1', sso: true });
      (UserModel.findById as jest.Mock).mockResolvedValue(user);
      (ssoService.assertSsoAccess as jest.Mock).mockResolvedValue('editor');
      (signToken as jest.Mock).mockReturnValue('sso-access');

      await controller.refreshToken({ body: { refreshToken: 'ok' } } as any, res);

      expect(ssoService.assertSsoAccess).toHaveBeenCalledWith(user);
      expect(signToken).toHaveBeenCalledWith('u1', { sso: true });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ token: 'sso-access', role: 'editor' }));
    });

    it('refuses to refresh an SSO session that OGS no longer allows', async () => {
      (verifyRefreshToken as jest.Mock).mockReturnValue({ id: 'u1', sso: true });
      (UserModel.findById as jest.Mock).mockResolvedValue({ _id: { toString: () => 'u1' }, status: 'active' });
      (ssoService.assertSsoAccess as jest.Mock).mockRejectedValue(
        new SsoError('ogs_role_missing', 403, 'The OGS account has no access to attendance')
      );

      await controller.refreshToken({ body: { refreshToken: 'ok' } } as any, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
        success: false,
        code: 'ogs_role_missing',
        message: 'The OGS account has no access to attendance',
      });
      expect(signToken).not.toHaveBeenCalled();
    });
  });

  describe('ogsSsoLogin', () => {
    it('returns the session from a successful exchange', async () => {
      (ssoService.loginWithIdToken as jest.Mock).mockResolvedValue({
        token: 't',
        refreshToken: 'r',
        user: { _id: 'u1', role: 'admin' },
      });

      await controller.ogsSsoLogin({ body: { idToken: 'id' } } as any, res);

      expect(ssoService.loginWithIdToken).toHaveBeenCalledWith('id');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, token: 't', refreshToken: 'r' }));
    });

    it('maps SSO errors to their status and code', async () => {
      (ssoService.loginWithIdToken as jest.Mock).mockRejectedValue(
        new SsoError('not_linked', 403, 'not linked')
      );

      await controller.ogsSsoLogin({ body: { idToken: 'id' } } as any, res);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({ success: false, code: 'not_linked', message: 'not linked' });
    });

    it('returns 500 without details on unexpected errors', async () => {
      (ssoService.loginWithIdToken as jest.Mock).mockRejectedValue(new Error('db down'));

      await controller.ogsSsoLogin({ body: { idToken: 'id' } } as any, res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ success: false, message: 'SSO login error' });
    });
  });
});
