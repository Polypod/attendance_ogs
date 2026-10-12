import { Router } from 'express';
import Joi from 'joi';
import { kioskAccessRequestController } from '../controllers/KioskAccessRequestController';
import { authenticate, authorize } from '../middleware/auth';
import { kioskAccessRequestLimiter } from '../middleware/rateLimiter';
import { validateParams, validateRequest } from '../middleware/validation';
import { UserRoleEnum } from '../types/interfaces';

const router = Router();
const requestIdSchema = Joi.object({ id: Joi.string().hex().length(24).required() });
const requestSchema = Joi.object({ name: Joi.string().trim().min(2).max(100).required() }).options({ stripUnknown: true });

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.post('/', kioskAccessRequestLimiter, validateRequest(requestSchema), kioskAccessRequestController.requestAccess);
router.get('/:id/status', validateParams(requestIdSchema), kioskAccessRequestController.getStatus);
router.get('/', authenticate, authorize(UserRoleEnum.ADMIN), kioskAccessRequestController.listPending);
router.post('/:id/approve', authenticate, authorize(UserRoleEnum.ADMIN), validateParams(requestIdSchema), kioskAccessRequestController.approve);

export { router as kioskAccessRequestRoutes };
