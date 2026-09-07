// src/middleware/rateLimiter.ts - Rate limiting middleware for API security
import crypto from 'crypto';
import rateLimit, { MemoryStore, ipKeyGenerator } from 'express-rate-limit';

export const authLimiterStore = new MemoryStore();
export const refreshTokenLimiterStore = new MemoryStore();

const getClientRateLimitKey = (req: any): string => {
  // Check for Bearer token (JWT auth)
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
      return `bearer:${tokenHash}`;
    }
  }

  // Check for kiosk authentication
  const kioskKey = req.headers?.['x-attendance-kiosk-key'];
  if (typeof kioskKey === 'string' && kioskKey) {
    const kioskHash = crypto.createHash('sha256').update(kioskKey).digest('hex').slice(0, 16);
    return `kiosk:${kioskHash}`;
  }

  // IP-based fallback. When the app runs behind a trusted reverse proxy, Express
  // populates `req.ip` from X-Forwarded-For according to `trust proxy`.
  if (req.ip) return ipKeyGenerator(req.ip);
  return 'unknown';
};

const isAuthenticatedRequest = (req: any): boolean => {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return true;
  }
  
  // Also treat kiosk requests as authenticated
  const kioskKey = req.headers?.['x-attendance-kiosk-key'];
  return typeof kioskKey === 'string' && !!kioskKey;
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
  max: (req) => (isAuthenticatedRequest(req) ? 1000 : 100),
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
    return (
      req.originalUrl === '/api/health' ||
      req.originalUrl === '/api/auth/rate-limit-status' ||
      req.originalUrl === '/api/auth/login' ||
      req.originalUrl === '/api/auth/refresh-token'
    );
  }
});
