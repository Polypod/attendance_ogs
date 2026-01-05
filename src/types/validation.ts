import Joi from 'joi';
import { 
  CreateStudentDto, 
  UpdateStudentDto, 
  CreateClassDto, 
  UpdateClassDto, 
  CreateClassScheduleDto, 
  UpdateClassScheduleDto
} from './interfaces';

const studentCategories = ['kids', 'youth', 'adult', 'advanced'] as const;
const classStatuses = ['scheduled', 'cancelled', 'completed'] as const;
const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

// Student validation schemas
export const createStudentSchema = Joi.object<CreateStudentDto>({
  name: Joi.string().required().min(2).max(100),
  email: Joi.string().email().required(),
  categories: Joi.array().items(
    Joi.string().valid(...studentCategories)
  ).min(1).required(),
  belt_level: Joi.string().required(),
  phone: Joi.string().required(),
  emergency_contact: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required()
  }).required()
});

export const updateStudentSchema = Joi.object<UpdateStudentDto>({
  name: Joi.string().min(2).max(100),
  categories: Joi.array().items(
    Joi.string().valid(...studentCategories)
  ).min(1),
  belt_level: Joi.string(),
  phone: Joi.string(),
  emergency_contact: Joi.object({
    name: Joi.string(),
    phone: Joi.string()
  })
}).min(1); // At least one field is required for update

// Class validation schemas
export const createClassSchema = Joi.object<CreateClassDto>({
  name: Joi.string().required().min(3).max(100),
  description: Joi.string().required(),
  categories: Joi.array().items(
    Joi.string().valid(...studentCategories)
  ).min(1).required(),
  instructor: Joi.string().required(),
  max_capacity: Joi.number().integer().min(1).max(100).required(),
  duration_minutes: Joi.number().integer().min(15).max(240).required()
});

export const updateClassSchema = Joi.object<UpdateClassDto>({
  name: Joi.string().min(3).max(100),
  description: Joi.string(),
  categories: Joi.array().items(
    Joi.string().valid(...studentCategories)
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
  day_of_week: Joi.string().valid(
    ...daysOfWeek
  ).required(),
  recurring: Joi.boolean().default(false)
});

export const updateClassScheduleSchema = Joi.object<UpdateClassScheduleDto>({
  date: Joi.date(),
  start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  day_of_week: Joi.string().valid(
    ...daysOfWeek
  ),
  recurring: Joi.boolean()
}).min(1);
