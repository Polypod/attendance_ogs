import { Router } from 'express';
import { authorize } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { UserRoleEnum } from '@/types/interfaces';
import { rawAttendanceReportQuerySchema } from '@/types/validation';
import { reportController } from '@/controllers/ReportController';

const router = Router();

router.post(
  '/attendance/raw',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(rawAttendanceReportQuerySchema),
  reportController.getRawAttendanceReport
);

export { router as reportRoutes };
