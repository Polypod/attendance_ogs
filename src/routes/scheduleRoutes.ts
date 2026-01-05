// src/routes/scheduleRoutes.ts - Schedule management routes
import { Router } from 'express';
import { scheduleController } from '@/controllers/ScheduleController';
import { validateRequest } from '@/middleware/validation';
import { 
  createClassScheduleSchema, 
  updateClassScheduleSchema 
} from '@/types/validation';

const router = Router();

// Get all schedules with optional filtering by date range and class ID
router.get('/', scheduleController.getAllSchedules);

// Get schedule by ID
router.get('/:id', scheduleController.getScheduleById);

// Get schedule by date range (using query params)
// Example: /api/schedules?startDate=2025-01-01&endDate=2025-12-31
// Or with class ID: /api/schedules?classId=123

// Create a new schedule
router.post(
  '/', 
  validateRequest(createClassScheduleSchema), 
  scheduleController.createSchedule
);

// Update a schedule
router.put(
  '/:id', 
  validateRequest(updateClassScheduleSchema), 
  scheduleController.updateSchedule
);

// Delete a schedule
router.delete('/:id', scheduleController.deleteSchedule);

export { router as scheduleRoutes };
