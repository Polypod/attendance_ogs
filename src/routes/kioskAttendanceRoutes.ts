import { Router } from 'express';
import Joi from 'joi';
import { kioskAttendanceController } from '../controllers/KioskAttendanceController';
import { authenticateKiosk } from '../middleware/kioskAuth';
import { validateParams, validateRequest } from '../middleware/validation';

const router = Router();

const scheduleIdSchema = Joi.object({
  scheduleId: Joi.string().hex().length(24).required(),
});

const finalizeAttendanceSchema = Joi.object({
  presentStudentIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .unique()
    .max(200)
    .required(),
  instructorName: Joi.string().trim().min(2).max(100).allow('').optional(),
}).options({ stripUnknown: true });

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.use(authenticateKiosk);
router.get('/today', kioskAttendanceController.getToday);
router.post(
  '/sessions/:scheduleId/finalize',
  validateParams(scheduleIdSchema),
  validateRequest(finalizeAttendanceSchema),
  kioskAttendanceController.finalizeSession
);

export { router as kioskAttendanceRoutes };
