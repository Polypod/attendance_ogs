// API Routes and Controllers for Karate Attendance System

// src/routes/attendanceRoutes.ts - Main attendance routes
import { Router } from 'express';
import { attendanceController } from '@/controllers/AttendanceController';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';
import Joi from 'joi';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Validation schema for marking attendance
const markAttendanceSchema = Joi.object({
  attendance: Joi.array().items(
    Joi.object({
      student_id: Joi.string().required(),
      class_schedule_id: Joi.string().required(),
      status: Joi.string().valid('present', 'absent', 'late', 'excused').required(),
      category: Joi.string().required()
      notes: Joi.string().optional()
    })
  ).required(),
  recorded_by: Joi.string().optional()
});

// Routes accessible to all authenticated users
router.get('/today', attendanceController.getTodaysClasses);
router.get('/next-class', attendanceController.getNextClass);
router.get('/class/:classScheduleId', attendanceController.getClassAttendance);
router.get('/search', attendanceController.searchPastClasses);

// Routes for staff who can mark attendance
router.post(
  '/mark',
  validateRequest(markAttendanceSchema),
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  attendanceController.markAttendance
);

// Bulk attendance route (alias for mark)
router.post(
  '/bulk',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  attendanceController.markAttendance
);

// Routes for admins and instructors who can view reports
router.get(
  '/reports/:dateRange',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR),
  attendanceController.getAttendanceReports
);

// Get attendance history for a specific student
router.get(
  '/student/:studentId',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  attendanceController.getStudentAttendance
);

export { router as attendanceRoutes };
