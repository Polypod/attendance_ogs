// src/controllers/StudentController.ts - Student business logic
import { Request, Response } from 'express';
import { StudentModel } from '../models/Student';
import { CreateStudentDto } from '../types/interfaces';

export class StudentController {
  // Get all students
  async getAllStudents(req: Request, res: Response): Promise<void> {
    try {
      const students = await StudentModel.find({});
      res.status(200).json({ success: true, data: students });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching students',
        error: error.message 
      });
    }
  }

  // Get students by category
  async getStudentsByCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const students = await StudentModel.find({ categories: category });
      res.status(200).json({ success: true, data: students });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching students by category',
        error: error.message 
      });
    }
  }

  // Create a new student
  async createStudent(req: Request, res: Response): Promise<void> {
    try {
      const studentData: CreateStudentDto = req.body;
      const newStudent = new StudentModel(studentData);
      await newStudent.save();
      
      res.status(201).json({ 
        success: true, 
        message: 'Student created successfully',
        data: newStudent 
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        res.status(400).json({ 
          success: false, 
          message: 'Validation error',
          error: error.message 
        });
      } else if (error.code === 11000) {
        res.status(400).json({ 
          success: false, 
          message: 'Email already exists',
          error: 'Duplicate key error' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Error creating student',
          error: error.message 
        });
      }
    }
  }

  // Update a student
  async updateStudent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Prepare update operations
      const updateOps: any = { $set: {} };
      const unsetOps: any = {};
      
      // Process each field - if null, unset it, otherwise set it
      for (const [key, value] of Object.entries(updateData)) {
        if (value === null) {
          unsetOps[key] = "";
        } else {
          updateOps.$set[key] = value;
        }
      }
      
      // Add $unset operation if there are fields to remove
      if (Object.keys(unsetOps).length > 0) {
        updateOps.$unset = unsetOps;
      }
      
      // If no fields to set, remove empty $set
      if (Object.keys(updateOps.$set).length === 0) {
        delete updateOps.$set;
      }
      
      const updatedStudent = await StudentModel.findByIdAndUpdate(
        id, 
        updateOps, 
        { new: true, runValidators: true }
      );

      if (!updatedStudent) {
        res.status(404).json({ 
          success: false, 
          message: 'Student not found' 
        });
        return;
      }

      res.status(200).json({ 
        success: true, 
        message: 'Student updated successfully',
        data: updatedStudent 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error updating student',
        error: error.message 
      });
    }
  }

  // Delete a student
  async deleteStudent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deletedStudent = await StudentModel.findByIdAndDelete(id);

      if (!deletedStudent) {
        res.status(404).json({ 
          success: false, 
          message: 'Student not found' 
        });
        return;
      }

      res.status(200).json({ 
        success: true, 
        message: 'Student deleted successfully',
        data: deletedStudent 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Error deleting student',
        error: error.message 
      });
    }
  }
}

export const studentController = new StudentController();
