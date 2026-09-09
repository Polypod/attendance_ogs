// src/controllers/ScheduleController.ts - Class Schedule business logic
import { Request, Response } from 'express';
import { ClassScheduleModel } from '../models/ClassSchedule';
import { CreateClassScheduleDto, ClassScheduleSession } from '../types/interfaces';
import { logger } from '../utils/logger';
import { deletionService } from '../services/DeletionService';
import { scheduleService } from '../services/ScheduleService';

export class ScheduleController {
  // Get all class schedules
  async getAllSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, classId, expandRecurring } = req.query;

      const debug = logger.isDebugEnabled();
      if (debug) {
        logger.debug('ScheduleController.getAllSchedules', { startDate, endDate, expandRecurring, classId });
      }

      const schedules = await scheduleService.getAllSchedules({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        classId: classId as string | undefined,
        expandRecurring: expandRecurring === 'true',
      });

      res.status(200).json({ success: true, data: schedules });
    } catch (error) {
      logger.error('ScheduleController.getAllSchedules_failed', undefined, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching class schedules',
        error: error.message 
      });
    }
  }

  // Get schedule by ID
  async getScheduleById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const schedule = await ClassScheduleModel.findById(id)
        .populate('class_id', 'name instructor categories');
      
      if (!schedule) {
        res.status(404).json({ 
          success: false, 
          message: 'Schedule not found' 
        });
        return;
      }
      
      res.status(200).json({ success: true, data: schedule });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching schedule',
        error: error.message 
      });
    }
  }

  // Create a new class schedule
  async createSchedule(req: Request, res: Response): Promise<void> {
    try {
      const scheduleData: CreateClassScheduleDto = req.body;
      const newSchedule = new ClassScheduleModel(scheduleData);
      await newSchedule.save();
      
      // Populate the class information in the response
      await newSchedule.populate('class_id', 'name instructor categories');
      
      res.status(201).json({ 
        success: true, 
        message: 'Class schedule created successfully',
        data: newSchedule 
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        res.status(400).json({ 
          success: false, 
          message: 'Validation error',
          error: error.message 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Error creating class schedule',
          error: error.message 
        });
      }
    }
  }

  // Update a class schedule
  async updateSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const debug = logger.isDebugEnabled();
      
      if (debug) {
        logger.debug('ScheduleController.updateSchedule_called', {
          id,
          status: updateData?.status,
          sessions: updateData?.sessions?.map((s: ClassScheduleSession) => ({
            date: s.date,
            instructor: s.instructor,
            instructorType: typeof s.instructor,
            instructorLength: s.instructor?.length,
            status: s.status,
            notes: s.notes,
          })),
        });
      }
      
      // Find the schedule first
      const schedule = await ClassScheduleModel.findById(id);
      
      if (!schedule) {
        res.status(404).json({ 
          success: false, 
          message: 'Schedule not found' 
        });
        return;
      }
      
      if (debug) {
        logger.debug('ScheduleController.sessions_before_update', {
          sessions: schedule.sessions?.map((s: ClassScheduleSession) => ({
            date: s.date,
            instructor: s.instructor,
            status: s.status,
          })),
        });
      }
      
      // Update fields explicitly
      if (updateData.status !== undefined) {
        schedule.status = updateData.status;
      }
      
      if (updateData.sessions !== undefined) {
        if (debug) {
          logger.debug('ScheduleController.setting_sessions', { count: updateData.sessions.length });
        }
        schedule.sessions = updateData.sessions;
        schedule.markModified('sessions');
        if (debug) {
          logger.debug('ScheduleController.sessions_after_assignment', {
            sessions: schedule.sessions?.map((s: ClassScheduleSession) => ({
              date: s.date,
              instructor: s.instructor,
              status: s.status,
            })),
          });
        }
      }
      
      // Update other fields explicitly (avoid dynamic key assignment)
      if (updateData.date !== undefined) schedule.date = updateData.date;
      if (updateData.start_time !== undefined) schedule.start_time = updateData.start_time;
      if (updateData.end_time !== undefined) schedule.end_time = updateData.end_time;
      if (updateData.day_of_week !== undefined) schedule.day_of_week = updateData.day_of_week;
      if (updateData.days_of_week !== undefined) schedule.days_of_week = updateData.days_of_week;
      if (updateData.recurring !== undefined) schedule.recurring = updateData.recurring;
      if (updateData.recurrence_end_date !== undefined) {
        schedule.recurrence_end_date = updateData.recurrence_end_date;
      }
      
      // Save with validation and ensure write is acknowledged
      await schedule.save({ wtimeout: 5000, w: 'majority' });
      if (debug) {
        logger.debug('ScheduleController.schedule_saved');
      }
      
      // Read directly from MongoDB to verify - bypass ALL caches with .lean()
// Re-fetch to verify
      const verifySchedule = await ClassScheduleModel.findById(id)
        .lean()
        .populate('class_id', 'name instructor categories');
        
      if (debug) {
        logger.debug('ScheduleController.verified_sessions_after_save', {
          sessions: verifySchedule?.sessions?.map((s: ClassScheduleSession) => ({
            date: s.date,
            instructor: s.instructor,
            instructorType: typeof s.instructor,
            status: s.status,
          })),
        });
      }
      
      // Return the verified schedule (already populated from lean query above)
      const updatedSchedule = verifySchedule;

      if (debug) {
        logger.debug('ScheduleController.returning_updated_schedule', {
          sessions: updatedSchedule?.sessions?.map((s: ClassScheduleSession) => ({
            date: s.date,
            instructor: s.instructor,
            status: s.status,
          })),
        });
      }

      res.status(200).json({ 
        success: true, 
        message: 'Schedule updated successfully',
        data: updatedSchedule 
      });
    } catch (error) {
      logger.error('ScheduleController.updateSchedule_failed', undefined, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error updating schedule',
        error: error.message 
      });
    }
  }

  // Delete a class schedule
  async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?._id;
      const userRole = req.user?.role;
      
      logger.info('ScheduleController.deleteSchedule_called', {
        scheduleId: id,
        userId,
        userRole
      });
      
      const result = await deletionService.deleteScheduleCascade(id);
      const deletedSchedule = result?.deletedSchedule;

      if (!deletedSchedule) {
        logger.warn('ScheduleController.deleteSchedule_not_found', {
          scheduleId: id
        });
        res.status(404).json({ 
          success: false, 
          message: 'Schedule not found' 
        });
        return;
      }
      
      logger.info('ScheduleController.deleteSchedule_success', {
        scheduleId: id,
        userId
      });
      
      res.status(200).json({ 
        success: true, 
        message: 'Schedule deleted successfully',
        data: deletedSchedule 
      });
    } catch (error) {
      logger.error('ScheduleController.deleteSchedule_error', {
        scheduleId: req.params.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ 
        success: false, 
        message: 'Error deleting schedule',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Get schedules by date range
  async getSchedulesByDateRange(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        res.status(400).json({ 
          success: false, 
          message: 'Both startDate and endDate query parameters are required' 
        });
        return;
      }
      
      const schedules = await ClassScheduleModel.find({
        date: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        }
      })
      .populate('class_id', 'name instructor')
      .sort({ date: 1, start_time: 1 });
      
      res.status(200).json({ success: true, data: schedules });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching schedules by date range',
        error: error.message 
      });
    }
  }
}

export const scheduleController = new ScheduleController();
