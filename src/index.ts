

// src/index.ts - Main application entry point
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { studentRoutes } from './routes/studentRoutes';
import { classRoutes } from './routes/classRoutes';
import { scheduleRoutes } from './routes/scheduleRoutes';
import { errorHandler } from './middleware/errorHandler';
import { applyMiddleware } from './middleware/middleware';

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

// API Routes
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/schedules', scheduleRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
} as mongoose.ConnectOptions;

mongoose.connect(MONGODB_URI, MONGODB_OPTIONS)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Start the server only after successful DB connection
    const server = app.listen(PORT, () => {
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
