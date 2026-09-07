import { requestIdMiddleware } from '../../middleware/requestId';

describe('requestIdMiddleware', () => {
  it('generates and attaches a request id when missing', () => {
    const req = {
      get: jest.fn().mockReturnValue(undefined),
    } as any;

    const res = {
      setHeader: jest.fn(),
    } as any;

    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('uses upstream x-request-id if provided', () => {
    const req = {
      get: jest.fn().mockReturnValue('upstream-id'),
    } as any;

    const res = {
      setHeader: jest.fn(),
    } as any;

    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('upstream-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'upstream-id');
    expect(next).toHaveBeenCalled();
  });
});
