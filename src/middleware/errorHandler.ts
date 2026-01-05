import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';

interface AppError extends Error {
  statusCode?: number;
  status?: string;
  code?: number;
  errors?: Record<string, { message: string }>;
  keyValue?: Record<string, any>;
}

/**
 * Global error handling middleware
 * Handles different types of errors and sends appropriate responses
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error response
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';

  // Log the error for debugging
  console.error(`❌ [${new Date().toISOString()}] ${error.statusCode} - ${error.message}`);
  console.error(err.stack);

  // Handle specific error types
  
  // 1. Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const castError = err as MongooseError.CastError;
    const message = `Resource not found with id of ${castError.value}`;
    error = new Error(message);
    error.statusCode = 404;
  }

  // 2. Mongoose duplicate key
  if ((err as mongo.MongoError).code === 11000) {
    const value = err.message.match(/(["'])(\\.|.)*?\1/)?.[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    error = new Error(message);
    error.statusCode = 400;
  }

  // 3. Mongoose validation error
  if (err.name === 'ValidationError') {
    const validationError = err as MongooseError.ValidationError;
    const errors = Object.values(validationError.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    error = new Error(message);
    error.statusCode = 400;
  }

  // 4. JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again!';
    error = new Error(message);
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired! Please log in again.';
    error = new Error(message);
    error.statusCode = 401;
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    status: error.status,
    error: error.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

/**
 * Catch 404 and forward to error handler
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  (error as AppError).statusCode = 404;
  next(error);
};

/**
 * Wrapper for async/await error handling
 */
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
