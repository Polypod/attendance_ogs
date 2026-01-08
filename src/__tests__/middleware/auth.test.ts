import { authenticate, authorize } from '../../middleware/auth';
import { UserRoleEnum, UserStatusEnum } from '../../types/interfaces';
import { verifyToken } from '../../utils/jwt';
import { UserModel } from '../../models/User';

jest.mock('../../utils/jwt');

describe('auth middleware', () => {
  const next = jest.fn();
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    next.mockReset();
  });

  it('rejects missing token', async () => {
    const req: any = { headers: {} };
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('authenticates valid token and attaches user', async () => {
    (verifyToken as jest.Mock).mockReturnValue({ id: 'u1', iat: Math.floor(Date.now() / 1000) });
    const user: any = {
      _id: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: UserRoleEnum.ADMIN,
      status: UserStatusEnum.ACTIVE,
      created_by: 'seed',
      last_login: undefined,
      password_changed_at: undefined,
      created_at: new Date(),
      updated_at: new Date(),
      changedPasswordAfter: () => false,
      save: jest.fn().mockResolvedValue(true)
    };
    jest.spyOn(UserModel, 'findById').mockReturnValue({ select: jest.fn().mockResolvedValue(user) } as any);

    const req: any = { headers: { authorization: 'Bearer token' } };
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.email).toBe('a@b.com');
  });

  it('authorize blocks role mismatch', () => {
    const handler = authorize(UserRoleEnum.STAFF);
    const req: any = { user: { role: UserRoleEnum.STUDENT } };
    handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
