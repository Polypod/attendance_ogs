

// src/index.ts - Main application entry point
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { studentRoutes } from './routes/studentRoutes';
import { classRoutes } from './routes/classRoutes';
import { scheduleRoutes } from './routes/scheduleRoutes';
import { attendanceRoutes } from './routes/attendanceRoutes';
import { authRoutes } from './routes/authRoutes';
import { userRoutes } from './routes/userRoutes';
import { configRoutes } from './routes/configRoutes';
import { errorHandler } from './middleware/errorHandler';
import { applyMiddleware } from './middleware/middleware';
import { authenticate, authorize } from './middleware/auth';
import { UserRoleEnum } from './types/interfaces';
import { ConfigService } from './services/ConfigService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Apply common middleware
applyMiddleware(app);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);

// Admin-only routes
app.use('/api/users', authenticate, authorize(UserRoleEnum.ADMIN), userRoutes);

// Protected routes (authentication required)
app.use('/api/students', authenticate, studentRoutes);
app.use('/api/classes', authenticate, classRoutes);
app.use('/api/schedules', authenticate, scheduleRoutes);
app.use('/api/attendance', authenticate, attendanceRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root redirects to health for convenience
app.get('/', (req: Request, res: Response) => {
  return res.redirect('/api/health');
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ 
    success: false, 
    message: 'Resource not found',
    path: req.path
  });
});

// Error handling middleware
app.use(errorHandler);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/karate-attendance';
const MONGODB_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
} as mongoose.ConnectOptions;

mongoose.connect(MONGODB_URI, MONGODB_OPTIONS)
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Initialize ConfigService after database connection
    try {
      await ConfigService.initialize();
    } catch (error: any) {
      console.error('❌ Failed to initialize configuration:', error.message);
      process.exit(1); // Critical: cannot run without config
    }

    // Start the server only after successful DB connection AND config load
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Handle graceful shutdown
    const gracefulShutdown = () => {
      console.log('🛑 Shutting down gracefully...');
      server.close(() => {
        console.log('💤 Server shut down');
        process.exit(0);
      });
    };

    // Handle termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  })
  .catch((error: Error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Consider logging to an external service in production
});
