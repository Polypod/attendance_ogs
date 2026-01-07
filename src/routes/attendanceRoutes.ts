
// API Routes and Controllers for Karate Attendance System

// src/routes/attendanceRoutes.ts - Main attendance routes
import { Router } from 'express';
import { attendanceController } from '@/controllers/AttendanceController';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';

const router = Router();

// Routes accessible to all authenticated users
router.get('/today', attendanceController.getTodaysClasses);
router.get('/next-class', attendanceController.getNextClass);
router.get('/class/:classScheduleId', attendanceController.getClassAttendance);
router.get('/search', attendanceController.searchPastClasses);

// Routes for staff who can mark attendance
router.post(
  '/mark',
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

export { router as attendanceRoutes };
