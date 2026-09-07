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
});
