// src/utils/validators.ts - Data validation utilities
import Joi from 'joi';

export const studentValidationSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  categories: Joi.array().items(
    Joi.string().valid('kids', 'youth', 'adult', 'advanced')
  ).min(1).required(),
  belt_level: Joi.string().required(),
  phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).required(),
  emergency_contact: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).required()
  }).required()
});

export const classValidationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).required(),
  categories: Joi.array().items(
    Joi.string().valid('kids', 'youth', 'adult', 'advanced')
  ).min(1).required(),
  instructor: Joi.string().min(2).max(50).required(),
  max_capacity: Joi.number().integer().min(1).max(100).required(),
  duration_minutes: Joi.number().integer().min(15).max(180).required()
});

export const attendanceValidationSchema = Joi.object({
  student_id: Joi.string().required(),
  class_schedule_id: Joi.string().required(),
  status: Joi.string().valid('present', 'absent', 'late').required(),
  category: Joi.string().valid('kids', 'youth', 'adult', 'advanced').required(),
  notes: Joi.string().max(500).optional()
});