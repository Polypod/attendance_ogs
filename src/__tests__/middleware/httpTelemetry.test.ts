import { EventEmitter } from 'events';

jest.mock('../../utils/logger', () => ({
  logger: {
    isDebugEnabled: jest.fn(() => false),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/MetricsService', () => ({
  MetricsService: {
    observeHttpRequest: jest.fn(),
  },
}));

import { httpTelemetryMiddleware } from '../../middleware/httpTelemetry';
import { logger } from '../../utils/logger';
import { MetricsService } from '../../services/MetricsService';

type MockRes = EventEmitter & {
  statusCode: number;
  on: EventEmitter['on'];
};

describe('httpTelemetryMiddleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    next.mockReset();
    delete process.env.SLOW_REQUEST_THRESHOLD_MS;
  });

  function makeRes(statusCode: number): MockRes {
    const res = new EventEmitter() as MockRes;
    res.statusCode = statusCode;
    return res;
  }

  it('skips OPTIONS requests', () => {
    const res = makeRes(200);
    const onSpy = jest.spyOn(res, 'on');

    const req: any = {
      method: 'OPTIONS',
    };

    httpTelemetryMiddleware(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(onSpy).not.toHaveBeenCalled();
    expect(MetricsService.observeHttpRequest).not.toHaveBeenCalled();
  });

  it('observes metrics and does not warn on fast 200 responses', () => {
    const res = makeRes(200);
    const hrSpy = jest
      .spyOn(process.hrtime, 'bigint')
      .mockImplementationOnce(() => 0n)
      .mockImplementationOnce(() => 500_000_000n); // 500ms

    const req: any = {
      method: 'GET',
      originalUrl: '/api/ok',
      baseUrl: '',
      route: undefined,
      ip: '203.0.113.10',
      requestId: 'r1',
      user: undefined,
    };

    httpTelemetryMiddleware(req, res as any, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(MetricsService.observeHttpRequest).toHaveBeenCalledWith({
      method: 'GET',
      route: 'unmatched',
      statusCode: 200,
      durationMs: 500,
    });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    hrSpy.mockRestore();
  });

  it('logs warn for 4xx responses in non-debug mode', () => {
    const res = makeRes(404);
    const hrSpy = jest
      .spyOn(process.hrtime, 'bigint')
      .mockImplementationOnce(() => 0n)
      .mockImplementationOnce(() => 10_000_000n); // 10ms

    const req: any = {
      method: 'GET',
      originalUrl: '/api/missing',
      baseUrl: '',
      route: undefined,
      ip: '203.0.113.10',
      requestId: 'r2',
      user: undefined,
    };

    httpTelemetryMiddleware(req, res as any, next);
    res.emit('finish');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();

    hrSpy.mockRestore();
  });

  it('logs error for 5xx responses in non-debug mode', () => {
    const res = makeRes(500);
    const hrSpy = jest
      .spyOn(process.hrtime, 'bigint')
      .mockImplementationOnce(() => 0n)
      .mockImplementationOnce(() => 20_000_000n); // 20ms

    const req: any = {
      method: 'POST',
      originalUrl: '/api/crash',
      baseUrl: '',
      route: undefined,
      ip: '203.0.113.10',
      requestId: 'r3',
      user: { _id: 'u1', role: 'ADMIN' },
    };

    httpTelemetryMiddleware(req, res as any, next);
    res.emit('finish');

    expect(logger.error).toHaveBeenCalledTimes(1);

    hrSpy.mockRestore();
  });

  it('logs warn for slow requests even with 200 status', () => {
    process.env.SLOW_REQUEST_THRESHOLD_MS = '100';

    const res = makeRes(200);
    const hrSpy = jest
      .spyOn(process.hrtime, 'bigint')
      .mockImplementationOnce(() => 0n)
      .mockImplementationOnce(() => 200_000_000n); // 200ms

    const req: any = {
      method: 'GET',
      originalUrl: '/api/slow',
      baseUrl: '',
      route: undefined,
      ip: '203.0.113.10',
      requestId: 'r4',
      user: undefined,
    };

    httpTelemetryMiddleware(req, res as any, next);
    res.emit('finish');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();

    hrSpy.mockRestore();
  });
});
