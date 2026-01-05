// src/controllers/ClassController.ts - Class business logic
import { Request, Response } from 'express';
import { ClassModel } from '../models/Class';
import { CreateClassDto } from '../types/interfaces';

export class ClassController {
  // Get all classes
  async getAllClasses(req: Request, res: Response): Promise<void> {
    try {
      const classes = await ClassModel.find({});
      res.status(200).json({ success: true, data: classes });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching classes',
        error: error.message 
      });
    }
  }

  // Get class by ID
  async getClassById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const classData = await ClassModel.findById(id);
      
      if (!classData) {
        res.status(404).json({ 
          success: false, 
          message: 'Class not found' 
        });
        return;
      }
      
      res.status(200).json({ success: true, data: classData });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching class',
        error: error.message 
      });
    }
  }

  // Create a new class
  async createClass(req: Request, res: Response): Promise<void> {
    try {
      const classData: CreateClassDto = req.body;
      const newClass = new ClassModel(classData);
      await newClass.save();
      
      res.status(201).json({ 
        success: true, 
        message: 'Class created successfully',
        data: newClass 
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
          message: 'Error creating class',
          error: error.message 
        });
      }
    }
  }

  // Update a class
  async updateClass(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const updatedClass = await ClassModel.findByIdAndUpdate(
        id, 
        updateData, 
        { new: true, runValidators: true }
      );

      if (!updatedClass) {
        res.status(404).json({ 
          success: false, 
          message: 'Class not found' 
        });
        return;
      }

      res.status(200).json({ 
        success: true, 
        message: 'Class updated successfully',
        data: updatedClass 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error updating class',
        error: error.message 
      });
    }
  }

  // Delete a class
  async deleteClass(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deletedClass = await ClassModel.findByIdAndDelete(id);

      if (!deletedClass) {
        res.status(404).json({ 
          success: false, 
          message: 'Class not found' 
        });
        return;
      }

      // TODO: Also delete related schedules
      
      res.status(200).json({ 
        success: true, 
        message: 'Class deleted successfully',
        data: deletedClass 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error deleting class',
        error: error.message 
      });
    }
  }
}

export const classController = new ClassController();
