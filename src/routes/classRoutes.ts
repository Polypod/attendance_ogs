// src/routes/classRoutes.ts - Class management routes
import { Router } from 'express';
import { classController } from '@/controllers/ClassController';
import { validateRequest } from '@/middleware/validation';
import { createClassSchema, updateClassSchema } from '@/types/validation';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';

const router = Router();

// Routes accessible to all authenticated users
router.get('/', classController.getAllClasses);
router.get('/:id', classController.getClassById);

// Admin-only routes for creating, updating, and deleting classes
router.post(
  '/',
  authorize(UserRoleEnum.ADMIN),
  validateRequest(createClassSchema),
  classController.createClass
);

router.put(
  '/:id',
  authorize(UserRoleEnum.ADMIN),
  validateRequest(updateClassSchema),
  classController.updateClass
);

router.delete(
  '/:id',
  authorize(UserRoleEnum.ADMIN),
  classController.deleteClass
);

export { router as classRoutes };