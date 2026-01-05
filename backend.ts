
// Express.js TypeScript Backend for Karate Attendance System

  
  import express from 'express';
  import mongoose from 'mongoose';
  import cors from 'cors';
  import { studentRoutes } from './src/routes/studentRoutes';
  import { classRoutes } from './src/routes/classRoutes';
  import { attendanceRoutes } from './src/routes/attendanceRoutes';
  import { scheduleRoutes } from './src/routes/scheduleRoutes';
  
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  // Routes
  app.use('/api/students', studentRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/schedules', scheduleRoutes);
  
  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });
  
  // MongoDB connection
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/karate-attendance')
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
  
  
  
  
  
  
  