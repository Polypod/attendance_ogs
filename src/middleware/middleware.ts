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
  
  // Enable CORS
  app.use(cors());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));
};