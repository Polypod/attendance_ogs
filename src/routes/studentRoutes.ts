// src/routes/studentRoutes.ts - Student management routes
import { Router } from 'express';
import { studentController } from '@/controllers/StudentController';
import { validateRequest } from '@/middleware/validation';
import { createStudentSchema, studentImportSchema, updateStudentSchema } from '@/types/validation';
import { authorize } from '@/middleware/auth';
import { UserRoleEnum } from '@/types/interfaces';

const router = Router();

// Routes accessible to admins, editors, instructors, and staff
router.get(
  '/',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  studentController.getAllStudents
);

router.get(
  '/category/:category',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR, UserRoleEnum.INSTRUCTOR, UserRoleEnum.STAFF),
  studentController.getStudentsByCategory
);

router.get(
  '/export/csv',
  authorize(UserRoleEnum.ADMIN),
  studentController.exportStudentsCsv
);

router.post(
  '/import/preview',
  authorize(UserRoleEnum.ADMIN),
  validateRequest(studentImportSchema),
  studentController.previewStudentImport
);

router.post(
  '/import/apply',
  authorize(UserRoleEnum.ADMIN),
  validateRequest(studentImportSchema),
  studentController.applyStudentImport
);

// Admin and editor routes for creating, updating, and deleting students
router.post(
  '/',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR),
  validateRequest(createStudentSchema),
  studentController.createStudent
);

router.put(
  '/:id',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR),
  validateRequest(updateStudentSchema),
  studentController.updateStudent
);

router.delete(
  '/:id',
  authorize(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR),
  studentController.deleteStudent
);

export { router as studentRoutes };
