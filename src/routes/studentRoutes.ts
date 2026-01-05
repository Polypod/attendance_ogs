// src/routes/studentRoutes.ts - Student management routes
import { Router } from 'express';
import { studentController } from '@/controllers/StudentController';
import { validateRequest } from '@/middleware/validation';
import { createStudentSchema, updateStudentSchema } from '@/types/validation';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';

const router = Router();

// Routes accessible to admins, instructors, and staff
router.get(
  '/',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  studentController.getAllStudents
);

router.get(
  '/category/:category',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  studentController.getStudentsByCategory
);

// Admin-only routes for creating, updating, and deleting students
router.post(
  '/',
  authorize(UserRoleEnum.ADMIN),
  validateRequest(createStudentSchema),
  studentController.createStudent
);

router.put(
  '/:id',
  authorize(UserRoleEnum.ADMIN),
  validateRequest(updateStudentSchema),
  studentController.updateStudent
);

router.delete(
  '/:id',
  authorize(UserRoleEnum.ADMIN),
  studentController.deleteStudent
);

export { router as studentRoutes };