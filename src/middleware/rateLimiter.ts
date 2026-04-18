// src/middleware/rateLimiter.ts - Rate limiting middleware for API security
import rateLimit, { MemoryStore } from 'express-rate-limit';

export const authLimiterStore = new MemoryStore();
export const refreshTokenLimiterStore = new MemoryStore();

const getClientRateLimitKey = (req: any): string => {
  // Use forwarded IP from Next.js proxy, fallback to direct IP
  const forwarded = req.headers['x-real-ip'] || req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0].trim();
  return ip || req.ip || 'unknown';
};

/**
 * Rate limiter for authentication endpoints (login, register)
 * Stricter limits to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  store: authLimiterStore,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests as well
  keyGenerator: getClientRateLimitKey
});

/**
 * Rate limiter for refresh token endpoint
 * More permissive than login, but still prevents abuse.
 */
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // allow periodic refresh without being too strict
  store: refreshTokenLimiterStore,
  message: {
    success: false,
    message: 'Too many refresh attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: getClientRateLimitKey
});

/**
 * General API rate limiter
 * Applied to all API routes to prevent abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: getClientRateLimitKey,
  skip: (req) => {
    // Keep health checks + rate-limit status lightweight.
    return req.originalUrl === '/api/health' || req.originalUrl === '/api/auth/rate-limit-status';
  }
});
