import { Router } from 'express';
import { authorize } from '@/middleware/auth';
import { validateParams, validateRequest } from '@/middleware/validation';
import { UserRoleEnum } from '@/types/interfaces';
import {
  createReportPresetSchema,
  reportPresetIdParamSchema,
  updateReportPresetSchema
} from '@/types/validation';
import { reportPresetController } from '@/controllers/ReportPresetController';

const router = Router();

router.get('/', authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR), reportPresetController.listPresets);

router.post(
  '/',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateRequest(createReportPresetSchema),
  reportPresetController.createPreset
);

router.put(
  '/:id',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateParams(reportPresetIdParamSchema),
  validateRequest(updateReportPresetSchema),
  reportPresetController.updatePreset
);

router.delete(
  '/:id',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  validateParams(reportPresetIdParamSchema),
  reportPresetController.deletePreset
);

export { router as reportPresetRoutes };
