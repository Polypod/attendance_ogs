// src/routes/authRoutes.ts - Authentication routes
import { Router } from 'express';
import { authController } from '@/controllers/AuthController';
import { authenticate } from '@/middleware/auth';
import { authLimiter, authLimiterStore, refreshTokenLimiter } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import { ipKeyGenerator } from 'express-rate-limit';
import {
  loginSchema,
  changePasswordSchema,
  refreshTokenSchema
} from '@/types/validation';

const router = Router();

// Public routes
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);

// Rate limit status check – does not increment counter
router.get('/rate-limit-status', async (req, res) => {
  // Match the same IP keying strategy as the auth limiter.
  // `req.ip` is derived from X-Forwarded-For according to Express `trust proxy`.
  const key = req.ip ? ipKeyGenerator(req.ip) : 'unknown';
  const info = await authLimiterStore.get(key);
  const max = 5;
  const limited = !!info && info.totalHits > max;
  const resetAt = info?.resetTime ? Math.ceil(info.resetTime.getTime() / 1000) : null;
  res.json({ rateLimited: limited, resetAt });
});
router.post('/refresh-token', refreshTokenLimiter, validateRequest(refreshTokenSchema), authController.refreshToken);

// Protected routes (require authentication)
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

export { router as authRoutes };
