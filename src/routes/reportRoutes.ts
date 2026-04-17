import { Router } from 'express';
import { authorize } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import { UserRoleEnum } from '@/types/interfaces';
import {
  aggregatedAttendanceReportExportCsvSchema,
  aggregatedAttendanceReportQuerySchema,
  rawAttendanceReportExportCsvSchema,
  rawAttendanceReportQuerySchema
} from '@/types/validation';
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

router.post(
  '/attendance/raw/export/csv',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(rawAttendanceReportExportCsvSchema),
  reportController.getRawAttendanceReportExportCsv
);

router.post(
  '/attendance/aggregate/export/csv',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(aggregatedAttendanceReportExportCsvSchema),
  reportController.getAggregatedAttendanceReportExportCsv
);

export { router as reportRoutes };
