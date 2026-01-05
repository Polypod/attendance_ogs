// src/controllers/AttendanceController.ts - Attendance business logic
import { Request, Response } from 'express';
import { AttendanceService } from '../services/AttendanceService';
import { MarkAttendanceDto } from '../types/interfaces';

export class AttendanceController {
  private attendanceService = new AttendanceService();

  // Get today's scheduled classes
  getTodaysClasses = async (req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date();
      const classes = await this.attendanceService.getClassesForDate(today);
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Error fetching today's classes",
        error: (error as Error).message 
      });
    }
  };

  // Get the next upcoming class
  getNextClass = async (req: Request, res: Response): Promise<void> => {
    try {
      const nextClass = await this.attendanceService.getNextUpcomingClass();
      res.json({ success: true, data: nextClass });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching next class',
        error: (error as Error).message
      });
    }
  };

  // Mark attendance for a class
  markAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
      const attendanceData: MarkAttendanceDto[] = req.body.attendance;
      const recordedBy = req.body.recorded_by || 'system';
      
      const result = await this.attendanceService.markMultipleAttendance(attendanceData, recordedBy);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error marking attendance',
        error: (error as Error).message
      });
    }
  };

  // Get attendance for a specific class
  getClassAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { classScheduleId } = req.params;
      const { category } = req.query;
      
      const attendance = await this.attendanceService.getClassAttendance(
        classScheduleId,
        category as string | undefined
      );
      
      res.json({ success: true, data: attendance });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching class attendance',
        error: (error as Error).message
      });
    }
  };

  // Search past classes
  searchPastClasses = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, instructor, category } = req.query;
      
      const classes = await this.attendanceService.searchPastClasses({
        date: date ? new Date(date as string) : undefined,
        instructor: instructor as string | undefined,
        category: category as string | undefined
      });
      
      res.json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error searching past classes',
        error: (error as Error).message
      });
    }
  };

  // Get attendance reports
  getAttendanceReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const { dateRange } = req.params;
      const reports = await this.attendanceService.generateAttendanceReports(dateRange);
      
      res.json({ success: true, data: reports });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error generating attendance reports',
        error: (error as Error).message
      });
    }
  };
}

export const attendanceController = new AttendanceController();