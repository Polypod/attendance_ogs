import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { MetricsService } from '../services/MetricsService';

function isLoopbackIp(ip: string | undefined): boolean {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function resolveRouteLabel(req: Request): string {
  const routePath = req.route?.path;
  const baseUrl = req.baseUrl ?? '';

  if (routePath) {
    return `${baseUrl}${routePath}`;
  }

  // Avoid high cardinality: don't use raw paths with IDs.
  // For unmatched routes (404 etc), a single label keeps metrics stable.
  return 'unmatched';
}

function slowThresholdMs(): number {
  const raw = process.env.SLOW_REQUEST_THRESHOLD_MS?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

export const httpTelemetryMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const start = process.hrtime.bigint();
  const debug = logger.isDebugEnabled();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const route = resolveRouteLabel(req);

    MetricsService.observeHttpRequest({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    });

    const meta = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      route,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: debug ? req.ip : undefined,
      loopback: debug ? isLoopbackIp(req.ip) : undefined,
      userId: req.user?._id,
      userRole: req.user?.role,
    };

    const threshold = slowThresholdMs();
    const isSlow = durationMs >= threshold;

    if (debug) {
      logger.debug('http_response', meta);
      return;
    }

    if (res.statusCode >= 500) {
      logger.error('http_response', meta);
      return;
    }

    if (res.statusCode >= 400 || isSlow) {
      logger.warn('http_response', meta);
    }
  });

  next();
};
