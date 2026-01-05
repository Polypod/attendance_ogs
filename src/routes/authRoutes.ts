// src/routes/authRoutes.ts - Authentication routes
import { Router } from 'express';
import { authController } from '@/controllers/AuthController';
import { authenticate } from '@/middleware/auth';
import { authLimiter } from '@/middleware/rateLimiter';
import { validateRequest } from '@/middleware/validation';
import {
  loginSchema,
  changePasswordSchema,
  refreshTokenSchema
} from '@/types/validation';

const router = Router();

// Public routes
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/refresh-token', validateRequest(refreshTokenSchema), authController.refreshToken);

// Protected routes (require authentication)
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

export { router as authRoutes };
