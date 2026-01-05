// src/routes/classRoutes.ts - Class management routes
import { Router } from 'express';
import { classController } from '@/controllers/ClassController';
import { validateRequest } from '@/middleware/validation';
import { createClassSchema, updateClassSchema } from '@/types/validation';

const router = Router();

// Get all classes
router.get('/', classController.getAllClasses);

// Get class by ID
router.get('/:id', classController.getClassById);

// Create a new class
router.post('/', validateRequest(createClassSchema), classController.createClass);

// Update a class
router.put('/:id', validateRequest(updateClassSchema), classController.updateClass);

// Delete a class
router.delete('/:id', classController.deleteClass);

export { router as classRoutes };