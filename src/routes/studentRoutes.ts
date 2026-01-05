// src/routes/studentRoutes.ts - Student management routes
import { Router } from 'express';
import { studentController } from '@/controllers/StudentController';
import { validateRequest } from '@/middleware/validation';
import { createStudentSchema, updateStudentSchema } from '@/types/validation';

const router = Router();

// Get all students
router.get('/', studentController.getAllStudents);

// Get students by category
router.get('/category/:category', studentController.getStudentsByCategory);

// Create a new student
router.post('/', validateRequest(createStudentSchema), studentController.createStudent);

// Update a student
router.put('/:id', validateRequest(updateStudentSchema), studentController.updateStudent);

// Delete a student
router.delete('/:id', studentController.deleteStudent);

export { router as studentRoutes };