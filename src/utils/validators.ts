import { Types } from 'mongoose';
import {
  StudentCategoryEnum,
  AttendanceStatusEnum,
  StudentCategory,
  AttendanceStatus
} from '../types/interfaces';
import { ConfigService } from '../services/ConfigService';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export const validateObjectId = (id: string, fieldName: string = 'ID'): void => {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${fieldName} format: ${id}`);
  }
};

export const validateStudentCategory = (category: string): void => {
  const configService = ConfigService.getInstance();
  if (!configService.isValidCategory(category)) {
    const validCategories = configService.getCategoryValues();
    throw new ValidationError(
      `Invalid student category: ${category}. Must be one of: ${validCategories.join(', ')}`
    );
  }
};

export const validateAttendanceStatus = (status: string): void => {
  const validStatuses: string[] = Object.values(AttendanceStatusEnum);
  if (!validStatuses.includes(status)) {
    throw new ValidationError(
      `Invalid attendance status: ${status}. Must be one of: ${validStatuses.join(', ')}`
    );
  }
};

export const validateRequiredFields = (
  data: Record<string, any>,
  requiredFields: string[],
  context: string = 'data'
): void => {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required ${context} fields: ${missingFields.join(', ')}`
    );
  }
};

export const validateDateRange = (startDate: Date, endDate: Date, context: string = 'date range'): void => {
  if (startDate > endDate) {
    throw new ValidationError(
      `Invalid ${context}: start date (${startDate}) must be before end date (${endDate})`
    );
  }
};

export const validateTimeRange = (startTime: string, endTime: string, context: string = 'time range'): void => {
  if (startTime >= endTime) {
    throw new ValidationError(
      `Invalid ${context}: start time (${startTime}) must be before end time (${endTime})`
    );
  }
};
