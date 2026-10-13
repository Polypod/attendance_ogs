// src/middleware/internalAuth.ts - Shared-secret guard for server-to-server calls
import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

/**
 * Only the Next.js server knows SSO_INTERNAL_SECRET. This is defence in
 * depth: the SSO endpoint also requires an ID token signed by OGS.
 */
export const requireInternalSecret = (req: Request, res: Response, next: NextFunction): void => {
  const expected = process.env.SSO_INTERNAL_SECRET?.trim();
  if (!expected) {
    res.status(503).json({ success: false, message: 'OGS single sign-on is not configured' });
    return;
  }

  const provided = req.get(INTERNAL_SECRET_HEADER) ?? '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  next();
};
