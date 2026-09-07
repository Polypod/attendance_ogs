import { Request, Response, NextFunction } from 'express';

function isLoopbackIp(ip: string | undefined): boolean {
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function extractToken(req: Request): string | undefined {
  const auth = req.headers.authorization?.trim();
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  const headerToken = req.get('x-metrics-token')?.trim();
  return headerToken && headerToken.length > 0 ? headerToken : undefined;
}

export const requireMetricsAccess = (req: Request, res: Response, next: NextFunction): void => {
  // Always allow scraping from loopback based on the real peer address.
  const remoteIp = req.socket?.remoteAddress;
  if (isLoopbackIp(remoteIp)) {
    next();
    return;
  }

  const expected = process.env.METRICS_TOKEN?.trim();
  if (!expected) {
    res.status(403).json({
      success: false,
      requestId: req.requestId,
      message: 'Metrics endpoint is restricted',
    });
    return;
  }

  const presented = extractToken(req);
  if (presented && presented === expected) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    requestId: req.requestId,
    message: 'Invalid metrics token',
  });
};
