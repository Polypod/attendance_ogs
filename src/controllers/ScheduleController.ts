// src/controllers/ScheduleController.ts - Class Schedule business logic
import { Request, Response } from 'express';
import { ClassScheduleModel } from '../models/ClassSchedule';
import { CreateClassScheduleDto } from '../types/interfaces';

export class ScheduleController {
  // Get all class schedules
  async getAllSchedules(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, classId } = req.query;
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
        .populate('class_id', 'name instructor')
        .sort({ date: 1, start_time: 1 });
      
      res.status(200).json({ success: true, data: schedules });
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
        .populate('class_id', 'name instructor');
      
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
      await newSchedule.populate('class_id', 'name instructor');
      
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
      ).populate('class_id', 'name instructor');

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
