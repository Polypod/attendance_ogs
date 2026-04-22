import { applyMiddleware } from '../../middleware/middleware';
import helmet from 'helmet';
import cors from 'cors';
import express from 'express';
import { logger } from '../../utils/logger';
import { requestIdMiddleware } from '../../middleware/requestId';
import { httpTelemetryMiddleware } from '../../middleware/httpTelemetry';

jest.mock('helmet', () => ({
  __esModule: true,
  default: jest.fn(() => 'helmetMw'),
}));

jest.mock('cors', () => ({
  __esModule: true,
  default: jest.fn(() => 'corsMw'),
}));

jest.mock('express', () => {
  const json = jest.fn(() => 'jsonMw');
  const urlencoded = jest.fn(() => 'urlencodedMw');
  const exp: any = Object.assign(jest.fn(), { json, urlencoded });
  return { __esModule: true, default: exp };
});

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

jest.mock('../../middleware/requestId', () => ({
  requestIdMiddleware: 'requestIdMw',
}));

jest.mock('../../middleware/httpTelemetry', () => ({
  httpTelemetryMiddleware: 'httpTelemetryMw',
}));

describe('applyMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FRONTEND_URL;
  });

  it('registers middleware including cors + parsers', () => {
    const app: any = { use: jest.fn() };

    applyMiddleware(app);

    expect(helmet).toHaveBeenCalledTimes(1);

    // Order matters somewhat; but just ensure key middleware are registered.
    const used = app.use.mock.calls.map((c: any[]) => c[0]);

    expect(used).toContain('helmetMw');
    expect(used).toContain(requestIdMiddleware);
    expect(used).toContain(httpTelemetryMiddleware);
    expect(used).toContain('corsMw');

    expect((express as any).json).toHaveBeenCalledTimes(1);
    expect((express as any).urlencoded).toHaveBeenCalledWith({ extended: true });
  });

  it('uses FRONTEND_URL when provided', () => {
    process.env.FRONTEND_URL = 'http://example.test';
    const app: any = { use: jest.fn() };

    applyMiddleware(app);

    expect(logger.info).toHaveBeenCalledWith('cors_origin', { origin: 'http://example.test' });
    expect(cors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'http://example.test',
        credentials: true,
      })
    );
  });
});
