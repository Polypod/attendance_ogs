import jwt from 'jsonwebtoken';
import { signToken, signRefreshToken, verifyToken, verifyRefreshToken } from '../../utils/jwt';

describe('jwt utils', () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '2h';
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it('signs and verifies access tokens', () => {
    const token = signToken('user-123');
    const payload = verifyToken(token);
    expect(payload.id).toBe('user-123');
  });

  it('signs and verifies refresh tokens', () => {
    const token = signRefreshToken('user-456');
    const payload = verifyRefreshToken(token);
    expect(payload.id).toBe('user-456');
  });

  it('throws on invalid access token', () => {
    expect(() => verifyToken('not-a-token')).toThrow('Invalid token');
  });

  it('throws on expired token', () => {
    const expired = jwt.sign({ id: 'u1', exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET as string);
    expect(() => verifyToken(expired)).toThrow('Token has expired');
  });
});
