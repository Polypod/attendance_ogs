// src/routes/authRoutes.ts - Authentication routes
import { Router } from 'express';
import { authController } from '@/controllers/AuthController';
import { authenticate } from '@/middleware/auth';
import { authLimiter, authLimiterStore } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
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
  const forwarded = req.headers['x-real-ip'] || req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded) ? forwarded[0] : (forwarded as string | undefined)?.split(',')[0].trim();
  const key = ip || req.ip || 'unknown';
  const info = await authLimiterStore.get(key);
  const max = 5;
  const limited = !!info && info.totalHits > max;
  const resetAt = info?.resetTime ? Math.ceil(info.resetTime.getTime() / 1000) : null;
  res.json({ rateLimited: limited, resetAt });
});
router.post('/refresh-token', validateRequest(refreshTokenSchema), authController.refreshToken);

// Protected routes (require authentication)
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

export { router as authRoutes };
