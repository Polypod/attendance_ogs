import { Router } from 'express';
import { authorize } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { UserRoleEnum } from '@/types/interfaces';
import { aggregatedAttendanceReportQuerySchema, rawAttendanceReportQuerySchema } from '@/types/validation';
import { reportController } from '@/controllers/ReportController';

const router = Router();

router.post(
  '/attendance/raw',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(rawAttendanceReportQuerySchema),
  reportController.getRawAttendanceReport
);

router.post(
  '/attendance/aggregate',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(aggregatedAttendanceReportQuerySchema),
  reportController.getAggregatedAttendanceReport
);

export { router as reportRoutes };
