import { errorHandler, notFound, catchAsync } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('errorHandler', () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('maps CastError to 404', () => {
    const err: any = { name: 'CastError', value: 'bad-id', message: 'cast' };
    const req: any = { requestId: 'r1', method: 'GET', originalUrl: '/x' };

    errorHandler(err, req, res, jest.fn());

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        requestId: 'r1',
        status: 'fail',
        error: expect.stringContaining('Resource not found with id of bad-id'),
      })
    );
  });

  it('maps duplicate key error to 400', () => {
    const err: any = { code: 11000, message: 'E11000 duplicate key: "email"' };
    const req: any = { requestId: 'r2', method: 'POST', originalUrl: '/x' };

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Duplicate field value'),
      })
    );
  });

  it('maps ValidationError to 400', () => {
    const err: any = {
      name: 'ValidationError',
      message: 'validation',
      errors: {
        a: { message: 'A bad' },
        b: { message: 'B bad' },
      },
    };
    const req: any = { requestId: 'r3', method: 'POST', originalUrl: '/x' };

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid input data. A bad. B bad',
      })
    );
  });

  it('maps JsonWebTokenError to 401', () => {
    const err: any = { name: 'JsonWebTokenError', message: 'jwt' };
    const req: any = { requestId: 'r4', method: 'GET', originalUrl: '/x' };

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Invalid token. Please log in again!',
      })
    );
  });

  it('includes stack only in development', () => {
    process.env.NODE_ENV = 'development';
    const err: any = { message: 'boom', stack: 'stack-trace' };
    const req: any = { requestId: 'r5', method: 'GET', originalUrl: '/x' };

    errorHandler(err, req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: 'stack-trace',
      })
    );
  });
});

describe('notFound', () => {
  it('forwards a 404 error to next', () => {
    const next = jest.fn();
    const req: any = { originalUrl: '/missing' };

    notFound(req, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err: any = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe('fail');
    expect(err.message).toContain('/missing');
  });
});

describe('catchAsync', () => {
  it('calls next with rejection', async () => {
    const next = jest.fn();
    const err = new Error('nope');

    const wrapped = catchAsync(() => Promise.reject(err));
    wrapped({} as any, {} as any, next);

    // allow promise microtask to flush
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(err);
  });
});
