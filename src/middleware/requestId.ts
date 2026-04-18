import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Adds a stable correlation id for the request lifecycle.
 *
 * - Accepts upstream `X-Request-Id` if present
 * - Otherwise generates a UUID
 * - Exposes it on `req.requestId` and response header `X-Request-Id`
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.get('x-request-id')?.trim();
  const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
};
