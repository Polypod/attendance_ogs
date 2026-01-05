
// API Routes and Controllers for Karate Attendance System

// src/routes/attendanceRoutes.ts - Main attendance routes
import { Router } from 'express';
import { attendanceController } from '@/controllers/AttendanceController';

const router = Router();

// Get today's classes (default view)
router.get('/today', attendanceController.getTodaysClasses);

// Get closest upcoming class
router.get('/next-class', attendanceController.getNextClass);

// Mark attendance for a class
router.post('/mark', attendanceController.markAttendance);

// Get attendance for specific class
router.get('/class/:classScheduleId', attendanceController.getClassAttendance);

// Search past classes
router.get('/search', attendanceController.searchPastClasses);

// Get attendance reports
router.get('/reports/:dateRange', attendanceController.getAttendanceReports);

export { router as attendanceRoutes };
