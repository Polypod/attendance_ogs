// src/utils/validators.ts - Data validation utilities
import Joi from 'joi';
import { ConfigService } from '../services/ConfigService';

export const studentValidationSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  categories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      const configService = ConfigService.getInstance();
      if (!configService.isValidCategory(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
  ).min(1).required(),
  belt_level: Joi.string().required().custom((value, helpers) => {
    const configService = ConfigService.getInstance();
    if (!configService.isValidBeltLevel(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }),
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
    Joi.string().custom((value, helpers) => {
      const configService = ConfigService.getInstance();
      if (!configService.isValidCategory(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
  ).min(1).required(),
  instructor: Joi.string().min(2).max(50).required(),
  max_capacity: Joi.number().integer().min(1).max(100).required(),
  duration_minutes: Joi.number().integer().min(15).max(180).required()
});

export const attendanceValidationSchema = Joi.object({
  student_id: Joi.string().required(),
  class_schedule_id: Joi.string().required(),
  status: Joi.string().valid('present', 'absent', 'late').required(),
  category: Joi.string().required().custom((value, helpers) => {
    const configService = ConfigService.getInstance();
    if (!configService.isValidCategory(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }),
  notes: Joi.string().max(500).optional()
});