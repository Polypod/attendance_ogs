import { requireMetricsAccess } from '../../middleware/metricsAuth';

describe('requireMetricsAccess', () => {
  const next = jest.fn();
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as any;
  const res: any = { status, json };

  beforeEach(() => {
    jest.clearAllMocks();
    next.mockReset();
    delete process.env.METRICS_TOKEN;
  });

  it('allows loopback without token', () => {
    const req: any = {
      ip: '127.0.0.1',
      headers: {},
      get: jest.fn(),
      requestId: 'r1',
    };

    requireMetricsAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('rejects non-loopback when METRICS_TOKEN is not configured', () => {
    const req: any = {
      ip: '203.0.113.10',
      headers: {},
      get: jest.fn(),
      requestId: 'r2',
    };

    requireMetricsAccess(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      success: false,
      requestId: 'r2',
      message: 'Metrics endpoint is restricted',
    });
  });

  it('allows non-loopback when bearer token matches', () => {
    process.env.METRICS_TOKEN = 'secret';

    const req: any = {
      ip: '203.0.113.10',
      headers: { authorization: 'Bearer secret' },
      get: jest.fn(),
      requestId: 'r3',
    };

    requireMetricsAccess(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('allows non-loopback when x-metrics-token matches', () => {
    process.env.METRICS_TOKEN = 'secret';

    const req: any = {
      ip: '203.0.113.10',
      headers: {},
      get: jest.fn().mockReturnValue('secret'),
      requestId: 'r4',
    };

    requireMetricsAccess(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('rejects when token mismatches', () => {
    process.env.METRICS_TOKEN = 'secret';

    const req: any = {
      ip: '203.0.113.10',
      headers: { authorization: 'Bearer wrong' },
      get: jest.fn(),
      requestId: 'r5',
    };

    requireMetricsAccess(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      success: false,
      requestId: 'r5',
      message: 'Invalid metrics token',
    });
  });
});
