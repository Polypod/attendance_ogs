// src/routes/userRoutes.ts - User management routes (Admin only)
import { Router } from 'express';
import { userController } from '@/controllers/UserController';
import { validateRequest } from '@/middleware/validation';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  resetPasswordSchema
} from '@/types/validation';

const router = Router();

// All routes in this file require authentication + admin role
// This is applied in the main app (index.ts)

// Get all users
router.get('/', userController.getAllUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Create new user
router.post('/', validateRequest(createUserSchema), userController.createUser);

// Update user
router.put('/:id', validateRequest(updateUserSchema), userController.updateUser);

// Delete user
router.delete('/:id', userController.deleteUser);

// Update user status
router.put('/:id/status', validateRequest(updateStatusSchema), userController.updateUserStatus);

// Reset user password (admin)
router.put('/:id/reset-password', validateRequest(resetPasswordSchema), userController.resetPassword);

export { router as userRoutes };
