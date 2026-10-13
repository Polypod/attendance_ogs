import { UserController } from '../../controllers/UserController';
import { UserModel } from '../../models/User';

jest.mock('../../models/User', () => {
  const save = jest.fn();
  const UserModelMock: any = jest.fn().mockImplementation(() => ({
    save,
  }));

  UserModelMock.__save = save;
  UserModelMock.find = jest.fn();
  UserModelMock.findById = jest.fn();
  UserModelMock.findByIdAndUpdate = jest.fn();
  UserModelMock.findByIdAndDelete = jest.fn();

  return {
    UserModel: UserModelMock,
  };
});

describe('UserController', () => {
  const controller = new UserController();

  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAllUsers: returns users without password', async () => {
    (UserModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'u1' }]),
    });

    await controller.getAllUsers({} as any, res);

    expect(UserModel.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'u1' }] });
  });

  it('createUser: returns 401 when req.user is missing', async () => {
    await controller.createUser({ body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Authentication required' });
  });

  it('updateUser: strips password field before update', async () => {
    const select = jest.fn().mockResolvedValue({ _id: 'u1', name: 'X' });
    (UserModel.findByIdAndUpdate as jest.Mock).mockReturnValue({ select });

    const req: any = {
      params: { id: 'u1' },
      body: { name: 'X', password: 'should-not-pass' },
    };

    await controller.updateUser(req, res);

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'u1',
      { name: 'X' },
      { new: true, runValidators: true }
    );
    expect(select).toHaveBeenCalledWith('-password');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deleteUser: prevents deleting self', async () => {
    await controller.deleteUser(
      { params: { id: 'u1' }, user: { _id: 'u1' } } as any,
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'You cannot delete your own account' });
    expect(UserModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('updateUserStatus: returns 400 when status missing', async () => {
    await controller.updateUserStatus({ params: { id: 'u1' }, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Status is required' });
  });

  it('resetPassword: returns 400 when newPassword too short', async () => {
    await controller.resetPassword({ params: { id: 'u1' }, body: { newPassword: 'short' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Password must be at least 8 characters long',
    });
  });

  it('resetPassword: sets password and saves on success', async () => {
    const user: any = { password: 'old', save: jest.fn().mockResolvedValue(true) };
    (UserModel.findById as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    await controller.resetPassword(
      { params: { id: 'u1' }, body: { newPassword: 'ChangeMe123!' } } as any,
      res
    );

    expect(user.password).toBe('ChangeMe123!');
    expect(user.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Password reset successfully' });
  });

  describe('OGS linking', () => {
    const env = process.env;

    beforeEach(() => {
      process.env = { ...env, OGS_OIDC_ISSUER: 'https://ogs.test' };
    });
    afterAll(() => {
      process.env = env;
    });

    const mockLinkTarget = (user: any) => {
      (UserModel.findById as jest.Mock)
        .mockReset()
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(user) })
        .mockReturnValueOnce({ select: jest.fn().mockResolvedValue({ _id: 'u1' }) });
    };

    it('updateUser: links an OGS account with the configured issuer', async () => {
      const user: any = { set: jest.fn(), save: jest.fn() };
      mockLinkTarget(user);

      await controller.updateUser(
        { params: { id: 'u1' }, body: { name: 'X', ogs_user_id: ' ogs1 ', sso_enabled: true } } as any,
        res
      );

      expect(user.set).toHaveBeenCalledWith({ name: 'X' });
      expect(user.external_identity).toEqual({ issuer: 'https://ogs.test', subject: 'ogs1' });
      expect(user.sso_enabled).toBe(true);
      expect(user.save).toHaveBeenCalled();
      expect(UserModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('updateUser: unlinking also turns SSO off', async () => {
      const user: any = {
        set: jest.fn(),
        save: jest.fn(),
        external_identity: { issuer: 'https://ogs.test', subject: 'ogs1' },
        sso_enabled: true,
      };
      mockLinkTarget(user);

      await controller.updateUser({ params: { id: 'u1' }, body: { ogs_user_id: null } } as any, res);

      expect(user.external_identity).toBeUndefined();
      expect(user.sso_enabled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('updateUser: refuses to enable SSO without a linked account', async () => {
      const user: any = { set: jest.fn(), save: jest.fn() };
      mockLinkTarget(user);

      await controller.updateUser({ params: { id: 'u1' }, body: { sso_enabled: true } } as any, res);

      expect(user.save).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Link an OGS account before enabling sign-in through OGS',
      });
    });

    it('updateUser: reports an OGS account linked to someone else', async () => {
      const user: any = {
        set: jest.fn(),
        save: jest.fn().mockRejectedValue({ code: 11000, keyPattern: { 'external_identity.subject': 1 } }),
      };
      mockLinkTarget(user);

      await controller.updateUser({ params: { id: 'u1' }, body: { ogs_user_id: 'ogs1' } } as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'The OGS account is already linked to another user',
      });
    });

    it('updateUser: refuses to link when SSO is not configured', async () => {
      delete process.env.OGS_OIDC_ISSUER;
      const user: any = { set: jest.fn(), save: jest.fn() };
      mockLinkTarget(user);

      await controller.updateUser({ params: { id: 'u1' }, body: { ogs_user_id: 'ogs1' } } as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('createUser: creates a linked account', async () => {
      const save = (UserModel as any).__save as jest.Mock;
      save.mockResolvedValue(undefined);
      (UserModel.findById as jest.Mock).mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'new' }) });

      await controller.createUser(
        {
          user: { _id: 'admin' },
          body: { email: 'e@example.com', name: 'E', role: 'editor', ogs_user_id: 'ogs1', sso_enabled: true },
        } as any,
        res
      );

      const instance = (UserModel as unknown as jest.Mock).mock.results[0].value;
      expect((UserModel as unknown as jest.Mock).mock.calls[0][0]).toEqual({
        email: 'e@example.com',
        name: 'E',
        role: 'editor',
        created_by: 'admin',
      });
      expect(instance.external_identity).toEqual({ issuer: 'https://ogs.test', subject: 'ogs1' });
      expect(instance.sso_enabled).toBe(true);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
