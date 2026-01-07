import { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import express from 'express';

/**
 * Applies common middleware to the Express application
 * @param app Express application instance
 */
export const applyMiddleware = (app: Express): void => {
  // Security headers
  app.use(helmet());

  // Enable CORS with specific configuration
  const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:4001';
  console.log('🔧 CORS origin set to', frontendOrigin);
  app.use(cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));
};