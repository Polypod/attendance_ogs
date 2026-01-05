// src/routes/scheduleRoutes.ts - Schedule management routes
import { Router } from 'express';
import { scheduleController } from '@/controllers/ScheduleController';
import { validateRequest } from '@/middleware/validation';
import {
  createClassScheduleSchema,
  updateClassScheduleSchema
} from '@/types/validation';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';

const router = Router();

// Routes accessible to all authenticated users
router.get('/', scheduleController.getAllSchedules);
router.get('/:id', scheduleController.getScheduleById);

// Get schedule by date range (using query params)
// Example: /api/schedules?startDate=2025-01-01&endDate=2025-12-31
// Or with class ID: /api/schedules?classId=123

// Admin and instructor routes for creating and updating schedules
router.post(
  '/',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(createClassScheduleSchema),
  scheduleController.createSchedule
);

router.put(
  '/:id',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(updateClassScheduleSchema),
  scheduleController.updateSchedule
);

// Admin-only route for deleting schedules
router.delete(
  '/:id',
  authorize(UserRoleEnum.ADMIN),
  scheduleController.deleteSchedule
);

export { router as scheduleRoutes };
