import Joi from 'joi';
import {
  CreateStudentDto,
  UpdateStudentDto,
  CreateClassDto,
  UpdateClassDto,
  CreateClassScheduleDto,
  UpdateClassScheduleDto,
  CreateUserDto,
  UpdateUserDto,
  LoginDto,
  ChangePasswordDto
} from './interfaces';
import { ConfigService } from '../services/ConfigService';
const classStatuses = ['scheduled', 'cancelled', 'completed'] as const;
const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const userRoles = ['admin', 'instructor', 'staff', 'student'] as const;
const userStatuses = ['active', 'inactive', 'suspended'] as const;

// Student validation schemas
export const createStudentSchema = Joi.object<CreateStudentDto>({
  name: Joi.string().required().min(2).max(100),
  email: Joi.string().email().required(),
  categories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      const configService = ConfigService.getInstance();
      if (!configService.isValidCategory(value)) {
        const validCategories = configService.getCategoryValues().join(', ');
        return helpers.error('any.invalid', { message: `Invalid category. Must be one of: ${validCategories}` });
      }
      return value;
    })
  ).min(1).required(),
  belt_level: Joi.string().required().custom((value, helpers) => {
    const configService = ConfigService.getInstance();
    if (!configService.isValidBeltLevel(value)) {
      const validBeltLevels = configService.getBeltLevelValues().join(', ');
      return helpers.error('any.invalid', { message: `Invalid belt level. Must be one of: ${validBeltLevels}` });
    }
    return value;
  }),
  phone: Joi.string().optional().allow(''),
  emergency_contact: Joi.object({
    name: Joi.string().optional().allow(''),
    phone: Joi.string().optional().allow('')
  }).optional()
});

export const updateStudentSchema = Joi.object<UpdateStudentDto>({
  name: Joi.string().min(2).max(100),
  categories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      const configService = ConfigService.getInstance();
      if (!configService.isValidCategory(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
  ).min(1),
  belt_level: Joi.string().custom((value, helpers) => {
    const configService = ConfigService.getInstance();
    if (!configService.isValidBeltLevel(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }),
  phone: Joi.string().optional().allow('', null),
  emergency_contact: Joi.object({
    name: Joi.string().optional().allow('', null),
    phone: Joi.string().optional().allow('', null)
  }).optional().allow(null)
}).min(1); // At least one field is required for update

// Class validation schemas
export const createClassSchema = Joi.object<CreateClassDto>({
  name: Joi.string().required().min(3).max(100),
  description: Joi.string().required(),
  categories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      const configService = ConfigService.getInstance();
      if (!configService.isValidCategory(value)) {
        const validCategories = configService.getCategoryValues().join(', ');
        return helpers.error('any.invalid', { message: `Invalid category. Must be one of: ${validCategories}` });
      }
      return value;
    })
  ).min(1).required(),
  instructor: Joi.string().required(),
  max_capacity: Joi.number().integer().min(1).max(100).required(),
  duration_minutes: Joi.number().integer().min(15).max(240).required()
});

export const updateClassSchema = Joi.object<UpdateClassDto>({
  name: Joi.string().min(3).max(100),
  description: Joi.string(),
  categories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      const configService = ConfigService.getInstance();
      if (!configService.isValidCategory(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
  ).min(1),
  instructor: Joi.string(),
  max_capacity: Joi.number().integer().min(1).max(100),
  duration_minutes: Joi.number().integer().min(15).max(240)
}).min(1);

// Class Schedule validation schemas
export const createClassScheduleSchema = Joi.object<CreateClassScheduleDto>({
  class_id: Joi.string().hex().length(24).required(),
  date: Joi.date().required(),
  start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  day_of_week: Joi.string().valid(...daysOfWeek).optional(), // Made optional - legacy field
  days_of_week: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).optional(), // Array of day numbers (0=Sunday, 6=Saturday)
  recurring: Joi.boolean().default(false),
  recurrence_end_date: Joi.date().optional().when('recurring', {
    is: true,
    then: Joi.date().required().greater(Joi.ref('date')),
    otherwise: Joi.optional()
  })
}).options({ stripUnknown: true });

export const updateClassScheduleSchema = Joi.object<UpdateClassScheduleDto>({
  date: Joi.date(),
  start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  day_of_week: Joi.string().valid(...daysOfWeek).optional(), // Legacy field
  days_of_week: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).optional(), // Array of day numbers
  recurring: Joi.boolean(),
  recurrence_end_date: Joi.date().optional().when('recurring', {
    is: true,
    then: Joi.date().greater(Joi.ref('date')),
    otherwise: Joi.optional()
  }),
  status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled').optional()
}).min(1).options({ stripUnknown: true });

// Authentication validation schemas
export const loginSchema = Joi.object<LoginDto>({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const createUserSchema = Joi.object<CreateUserDto>({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long'
  }),
  name: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid(...userRoles).required()
});

export const updateUserSchema = Joi.object<UpdateUserDto>({
  name: Joi.string().min(2).max(100),
  role: Joi.string().valid(...userRoles),
  status: Joi.string().valid(...userStatuses),
  password: Joi.string().min(8).messages({
    'string.min': 'Password must be at least 8 characters long'
  })
}).min(1); // At least one field is required

export const changePasswordSchema = Joi.object<ChangePasswordDto>({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long'
  })
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...userStatuses).required()
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long'
  })
});
