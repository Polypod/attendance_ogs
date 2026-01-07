// src/controllers/ScheduleController.ts - Class Schedule business logic
import { Request, Response } from 'express';
import { ClassScheduleModel } from '../models/ClassSchedule';
import { CreateClassScheduleDto, ClassStatusEnum } from '../types/interfaces';

export class ScheduleController {
  // Get all class schedules
  async getAllSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, classId, expandRecurring } = req.query;
      
      console.log('[ScheduleController] getAllSchedules:', { startDate, endDate, expandRecurring, classId });
      
      // If expandRecurring is true and date range provided, generate instances
      if (expandRecurring === 'true' && startDate && endDate) {
        const rangeStart = new Date(startDate as string);
        const rangeEnd = new Date(endDate as string);
        
        // For recurring schedules, we need to fetch all that might overlap with range
        const recurringQuery: any = { recurring: true };
        if (classId) recurringQuery.class_id = classId;
        
        // Fetch recurring schedules that started before or during range end
        recurringQuery.$or = [
          { recurrence_end_date: { $exists: false } },
          { recurrence_end_date: null },
          { recurrence_end_date: { $gte: rangeStart } }
        ];
        recurringQuery.date = { $lte: rangeEnd };
        
        const recurringSchedules = await ClassScheduleModel.find(recurringQuery)
          .populate('class_id', 'name instructor categories')
          .sort({ date: 1, start_time: 1 });
        
        console.log('[ScheduleController] Found', recurringSchedules.length, 'recurring schedules');
        
        // Fetch non-recurring schedules within range
        const nonRecurringQuery: any = {
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
            console.log('[ScheduleController] Expanding schedule:', {
              _id: schedule._id,
              date: schedule.date,
              days_of_week: schedule.days_of_week,
              recurring: schedule.recurring
            });
            
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
                  const existingSession = schedule.sessions?.find(
                    (s: any) => s.date.toISOString().split('T')[0] === dateStr
                  );
                  
                  // Create a new date object for this instance
                  const instanceDate = new Date(currentDate);
                  
                  console.log('[ScheduleController] Adding instance:', dateStr, 'dayOfWeek:', dayOfWeek);
                  
                  // Only use session status if session exists, otherwise keep as scheduled
                  const instanceStatus = existingSession ? existingSession.status : ClassStatusEnum.SCHEDULED;
                  
                  expandedSchedules.push({
                    ...schedule.toObject(),
                    date: instanceDate,
                    _isRecurringInstance: true,
                    _originalScheduleId: schedule._id,
                    status: instanceStatus,
                    instructor: existingSession?.instructor,
                    notes: existingSession?.notes,
                  });
                }
              }
              
              // Move to next day
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() + 1);
            }
            
            console.log('[ScheduleController] Added', expandedSchedules.length, 'instances so far');
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
        
        console.log('[ScheduleController] Returning', expandedSchedules.length, 'expanded schedules');
        
        res.status(200).json({ success: true, data: expandedSchedules });
      } else {
        // Simple query when not expanding
        const query: any = {};
        
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
      
      const updatedSchedule = await ClassScheduleModel.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      ).populate('class_id', 'name instructor categories');

      if (!updatedSchedule) {
        res.status(404).json({ 
          success: false, 
          message: 'Schedule not found' 
        });
        return;
      }

      res.status(200).json({ 
        success: true, 
        message: 'Schedule updated successfully',
        data: updatedSchedule 
      });
    } catch (error) {
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
      const deletedSchedule = await ClassScheduleModel.findByIdAndDelete(id);

      if (!deletedSchedule) {
        res.status(404).json({ 
          success: false, 
          message: 'Schedule not found' 
        });
        return;
      }

      // TODO: Also delete related attendance records
      
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
