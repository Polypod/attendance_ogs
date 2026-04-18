// src/controllers/ScheduleController.ts - Class Schedule business logic
import { Request, Response } from 'express';
import { ClassScheduleModel } from '../models/ClassSchedule';
import { CreateClassScheduleDto, ClassStatusEnum, ClassScheduleSession } from '../types/interfaces';
import { logger } from '../utils/logger';
import { deletionService } from '../services/DeletionService';

export class ScheduleController {
  // Get all class schedules
  async getAllSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, classId, expandRecurring } = req.query;
      const debug = logger.isDebugEnabled();
      
      if (debug) {
        logger.debug('ScheduleController.getAllSchedules', { startDate, endDate, expandRecurring, classId });
      }
      
      // If expandRecurring is true and date range provided, generate instances
      if (expandRecurring === 'true' && startDate && endDate) {
        const rangeStart = new Date(startDate as string);
        const rangeEnd = new Date(endDate as string);
        
        // For recurring schedules, we need to fetch all that might overlap with range
        const recurringQuery: Record<string, unknown> = { recurring: true };
        if (classId) recurringQuery.class_id = classId;
        
        // Fetch recurring schedules that started before or during range end
        recurringQuery.$or = [
          { recurrence_end_date: { $exists: false } },
          { recurrence_end_date: null },
          { recurrence_end_date: { $gte: rangeStart } }
        ];
        recurringQuery.date = { $lte: rangeEnd };
        
        // Use lean() to bypass Mongoose document cache and get raw MongoDB data
        const recurringSchedulesRaw = await ClassScheduleModel.find(recurringQuery)
          .lean()
          .populate('class_id', 'name instructor categories')
          .sort({ date: 1, start_time: 1 });
        
        // Convert lean results back to Mongoose documents for compatibility
        const recurringSchedules = recurringSchedulesRaw.map((doc: any) => ({
          ...doc,
          toObject: () => doc,
          _id: doc._id
        }));
        
        if (debug) {
          logger.debug('ScheduleController.recurring_schedules_found', { count: recurringSchedules.length });
        }
        
        // Fetch non-recurring schedules within range
        const nonRecurringQuery: Record<string, unknown> = {
          recurring: { $ne: true },
          date: {
            $gte: rangeStart,
            $lte: rangeEnd
          }
        };
        if (classId) nonRecurringQuery.class_id = classId;
        
        const nonRecurringSchedules = await ClassScheduleModel.find(nonRecurringQuery)
          .populate('class_id', 'name instructor categories')
          .sort({ date: 1, start_time: 1 });
        
        const expandedSchedules: any[] = [];
        
        // Expand recurring schedules
        for (const schedule of recurringSchedules) {
          if (schedule.days_of_week && schedule.days_of_week.length > 0) {
            if (debug) {
              logger.debug('ScheduleController.expand_schedule', {
                scheduleId: schedule._id?.toString?.() ?? String(schedule._id),
                date: schedule.date,
                daysOfWeek: schedule.days_of_week,
                recurring: schedule.recurring,
              });
            }
            
            const recurrenceEnd = schedule.recurrence_end_date 
              ? new Date(schedule.recurrence_end_date) 
              : rangeEnd;
            
            const effectiveEnd = recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
            const scheduleDate = new Date(schedule.date);
            
            // Start from the later of: schedule start date or range start date
            let currentDate = new Date(scheduleDate > rangeStart ? scheduleDate : rangeStart);
            
            while (currentDate <= effectiveEnd) {
              const dayOfWeek = currentDate.getDay(); // 0=Sunday, 6=Saturday
              
              if (schedule.days_of_week.includes(dayOfWeek)) {
                // Only include if date is within the requested range
                if (currentDate >= rangeStart && currentDate <= rangeEnd) {
                  // Check if a session exists for this date
                  const dateStr = currentDate.toISOString().split('T')[0];
                  
                  // DEBUG: Log all sessions in this schedule
                  if (debug) {
                    logger.debug('ScheduleController.schedule_sessions', {
                      scheduleId: schedule._id?.toString?.() ?? String(schedule._id),
                      sessionCount: schedule.sessions?.length || 0,
                      sessions: schedule.sessions?.map((s: ClassScheduleSession) => ({
                        date: s.date.toISOString().split('T')[0],
                        instructor: s.instructor,
                        status: s.status,
                      })),
                    });
                  }
                  
                  const existingSession = schedule.sessions?.find(
                    (s: ClassScheduleSession) => s.date.toISOString().split('T')[0] === dateStr
                  );
                  
                  // Create a new date object for this instance
                  const instanceDate = new Date(currentDate);

                  if (debug) {
                    logger.debug('ScheduleController.add_instance', { date: dateStr, dayOfWeek });
                  }
                  
                  // If session exists for this date, use its data
                  if (existingSession) {
                    if (debug) {
                      logger.debug('ScheduleController.matching_session_found', {
                        sessionDate: existingSession.date.toISOString().split('T')[0],
                        sessionInstructor: (existingSession as any)['S-instructor'],
                        sessionStatus: existingSession.status,
                      });
                    }
                    
                    // Create expanded instance with session-specific data
                    // Keep sessions array for frontend to access S-instructor field
                    expandedSchedules.push({
                      ...schedule.toObject(),
                      date: instanceDate,
                      _isRecurringInstance: true,
                      _originalScheduleId: schedule._id,
                      status: existingSession.status,
                      notes: existingSession.notes,
                    });
                  } else {
                    if (debug) {
                      logger.debug('ScheduleController.no_session_for_date', { date: dateStr });
                    }
                    // No session yet, create instance without session-specific data
                    const { sessions: _sessions, ...scheduleWithoutSessions } = schedule.toObject();
                    expandedSchedules.push({
                      ...scheduleWithoutSessions,
                      date: instanceDate,
                      _isRecurringInstance: true,
                      _originalScheduleId: schedule._id,
                      status: ClassStatusEnum.SCHEDULED,
                    });
                  }
                }
              }
              
              // Move to next day
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            if (debug) {
              logger.debug('ScheduleController.instances_added', { count: expandedSchedules.length });
            }
          }
        }
        
        // Add non-recurring schedules
        nonRecurringSchedules.forEach(schedule => {
          expandedSchedules.push(schedule.toObject());
        });
        
        // Sort all schedules by date and time
        expandedSchedules.sort((a, b) => {
          const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (dateCompare !== 0) return dateCompare;
          return a.start_time.localeCompare(b.start_time);
        });
        
        if (debug) {
          logger.debug('ScheduleController.expanded_schedules_returning', { count: expandedSchedules.length });
        }
        // Log first schedule's instructor info for debugging
        if (expandedSchedules.length > 0 && debug) {
          logger.debug('ScheduleController.sample_expanded_schedule', {
            date: expandedSchedules[0].date,
            instructor: expandedSchedules[0].instructor,
            hasInstructorField: 'instructor' in expandedSchedules[0],
            status: expandedSchedules[0].status,
          });
        }
        
        res.status(200).json({ success: true, data: expandedSchedules });
      } else {
        // Simple query when not expanding
        const query: Record<string, unknown> = {};
        
        if (startDate && endDate) {
          query.date = {
            $gte: new Date(startDate as string),
            $lte: new Date(endDate as string)
          };
        }
        
        if (classId) {
          query.class_id = classId;
        }
        
        const schedules = await ClassScheduleModel.find(query)
          .populate('class_id', 'name instructor categories')
          .sort({ date: 1, start_time: 1 });
        
        res.status(200).json({ success: true, data: schedules });
      }
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
      
      // Update other fields (using type assertion for dynamic key access)
      Object.keys(updateData).forEach((key: string) => {
        if (key !== 'sessions' && key !== 'status') {
          (schedule as any)[key as keyof typeof schedule] = updateData[key];
        }
      });
      
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
      const result = await deletionService.deleteScheduleCascade(id);
      const deletedSchedule = result?.deletedSchedule;

      if (!deletedSchedule) {
        res.status(404).json({ 
          success: false, 
          message: 'Schedule not found' 
        });
        return;
      }
      
      res.status(200).json({ 
        success: true, 
        message: 'Schedule deleted successfully',
        data: deletedSchedule 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error deleting schedule',
        error: error.message 
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
