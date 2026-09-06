import { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import express from 'express';
import { logger } from '../utils/logger';
import { requestIdMiddleware } from './requestId';
import { httpTelemetryMiddleware } from './httpTelemetry';

/**
 * Applies common middleware to the Express application
 * @param app Express application instance
 */
export const applyMiddleware = (app: Express): void => {
  // Security headers
  app.use(helmet());

  // Correlation id (for request tracing across logs)
  app.use(requestIdMiddleware);

  // Basic HTTP observability (latency + status + requestId)
  app.use(httpTelemetryMiddleware);

  // Enable CORS with specific configuration
  const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:4001';
  logger.info('cors_origin', { origin: frontendOrigin });
  app.use(cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Attendance-Kiosk-Key']
  }));

  // Parse JSON bodies
  app.use(express.json());

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true }));
};