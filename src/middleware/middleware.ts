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
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));
};