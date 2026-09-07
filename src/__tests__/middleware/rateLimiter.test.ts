import crypto from 'crypto';

jest.mock('express-rate-limit', () => {
  const rateLimit = jest.fn((options: any) => ({ __rateLimitOptions: options }));

  class MemoryStore {}

  const ipKeyGenerator = jest.fn((ip: string) => `ip:${ip}`);

  return {
    __esModule: true,
    default: rateLimit,
    MemoryStore,
    ipKeyGenerator,
  };
});

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  apiLimiter,
  authLimiter,
  authLimiterStore,
  refreshTokenLimiter,
  refreshTokenLimiterStore,
} from '../../middleware/rateLimiter';

describe('rateLimiter middleware', () => {
  it('creates two distinct MemoryStore instances', () => {
    expect(authLimiterStore).toBeDefined();
    expect(refreshTokenLimiterStore).toBeDefined();
    expect(authLimiterStore).not.toBe(refreshTokenLimiterStore);
  });

  it('configures authLimiter and refreshTokenLimiter with expected limits', () => {
    expect((rateLimit as unknown as jest.Mock).mock.calls).toHaveLength(3);

    const authOptions = (authLimiter as any).__rateLimitOptions;
    const refreshOptions = (refreshTokenLimiter as any).__rateLimitOptions;

    expect(authOptions.windowMs).toBe(15 * 60 * 1000);
    expect(authOptions.max).toBe(5);
    expect(authOptions.standardHeaders).toBe(true);
    expect(authOptions.legacyHeaders).toBe(false);
    expect(authOptions.skipSuccessfulRequests).toBe(false);
    expect(authOptions.skipFailedRequests).toBe(false);
    expect(authOptions.message).toEqual({
      success: false,
      message: 'Too many login attempts. Please try again later after 15 minutes.',
    });

    expect(refreshOptions.windowMs).toBe(15 * 60 * 1000);
    expect(refreshOptions.max).toBe(30);
    expect(refreshOptions.standardHeaders).toBe(true);
    expect(refreshOptions.legacyHeaders).toBe(false);
    expect(refreshOptions.skipSuccessfulRequests).toBe(false);
    expect(refreshOptions.skipFailedRequests).toBe(false);
    expect(refreshOptions.message).toEqual({
      success: false,
      message: 'Too many refresh attempts. Please try again later.',
    });
  });

  it('keyGenerator uses bearer token hash when present', () => {
    const authOptions = (authLimiter as any).__rateLimitOptions;

    const token = 'my-token';
    const expectedHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);

    const key = authOptions.keyGenerator({
      headers: { authorization: `Bearer ${token}` },
      ip: '203.0.113.10',
    });

    expect(key).toBe(`bearer:${expectedHash}`);
    expect(ipKeyGenerator).not.toHaveBeenCalled();
  });

  it('keyGenerator falls back to ipKeyGenerator when no token exists', () => {
    const authOptions = (authLimiter as any).__rateLimitOptions;

    const key = authOptions.keyGenerator({
      headers: {},
      ip: '203.0.113.10',
    });

    expect(ipKeyGenerator).toHaveBeenCalledWith('203.0.113.10');
    expect(key).toBe('ip:203.0.113.10');
  });

  it('keyGenerator returns unknown when no token and no ip exist', () => {
    const authOptions = (authLimiter as any).__rateLimitOptions;

    const key = authOptions.keyGenerator({
      headers: {},
      ip: undefined,
    });

    expect(key).toBe('unknown');
  });

  it('apiLimiter.max returns higher limits for authenticated requests', () => {
    const apiOptions = (apiLimiter as any).__rateLimitOptions;

    expect(apiOptions.max({ headers: { authorization: 'Bearer abc' } })).toBe(1000);
    expect(apiOptions.max({ headers: { authorization: 'bearer abc' } })).toBe(100);
    expect(apiOptions.max({ headers: {} })).toBe(100);
  });

  it('apiLimiter.skip excludes health and auth endpoints from general limiting', () => {
    const apiOptions = (apiLimiter as any).__rateLimitOptions;

    const makeReq = (originalUrl: string) => ({ originalUrl, headers: {} });

    expect(apiOptions.skip(makeReq('/api/health'))).toBe(true);
    expect(apiOptions.skip(makeReq('/api/auth/rate-limit-status'))).toBe(true);
    expect(apiOptions.skip(makeReq('/api/auth/login'))).toBe(true);
    expect(apiOptions.skip(makeReq('/api/auth/refresh-token'))).toBe(true);

    expect(apiOptions.skip(makeReq('/api/classes'))).toBe(false);
  });
});
