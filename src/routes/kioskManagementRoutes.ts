import { Router } from 'express';
import Joi from 'joi';
import { kioskManagementController } from '../controllers/KioskManagementController';
import { validateParams, validateRequest } from '../middleware/validation';

const router = Router();
const kioskIdSchema = Joi.object({ id: Joi.string().hex().length(24).required() });
const createKioskSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
}).options({ stripUnknown: true });
const kioskStatusSchema = Joi.object({ active: Joi.boolean().required() }).options({ stripUnknown: true });
const updateNameSchema = Joi.object({ name: Joi.string().trim().min(2).max(100).required() }).options({ stripUnknown: true });

router.get('/', kioskManagementController.listKiosks);
router.post('/', validateRequest(createKioskSchema), kioskManagementController.createKiosk);
router.put('/:id/rotate', validateParams(kioskIdSchema), kioskManagementController.rotateAccessKey);
router.put('/:id/status', validateParams(kioskIdSchema), validateRequest(kioskStatusSchema), kioskManagementController.setKioskStatus);
router.put('/:id/name', validateParams(kioskIdSchema), validateRequest(updateNameSchema), kioskManagementController.updateKioskName);
router.delete('/:id', validateParams(kioskIdSchema), kioskManagementController.deleteKiosk);

export { router as kioskManagementRoutes };
