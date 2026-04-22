/** @jest-environment node */

jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
  useSession: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    isDebugEnabled: jest.fn(() => false),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { createApiClient, fetchWithAuth } = require('@/lib/api') as typeof import('@/lib/api');

describe('fetchWithAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_API_URL = '';

    const { getSession } = jest.requireMock('next-auth/react') as { getSession: jest.Mock };
    const { logger } = jest.requireMock('@/lib/logger') as { logger: { [k: string]: jest.Mock } };

    getSession.mockReset();
    Object.values(logger).forEach((fn) => fn.mockClear());

    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('adds X-Request-Id when missing and uses provided token', async () => {
    const responseHeaders = new Headers({ 'x-request-id': 'resp_rid_123' });
    const response = {
      ok: true,
      status: 200,
      headers: responseHeaders,
      json: async () => ({ ok: true }),
      text: async () => '',
    } as any;

    let capturedInit: any;
    (global.fetch as jest.Mock).mockImplementation(async (_url: string, init: any) => {
      capturedInit = init;
      return response;
    });

    await fetchWithAuth('/api/ping', { method: 'GET', token: 'tok_123' });

    const { getSession } = jest.requireMock('next-auth/react') as { getSession: jest.Mock };
    expect(getSession).not.toHaveBeenCalled();
    expect(capturedInit.headers.Authorization).toBe('Bearer tok_123');
    expect(typeof capturedInit.headers['X-Request-Id']).toBe('string');
    expect(capturedInit.headers['X-Request-Id'].length).toBeGreaterThan(0);
  });

  it('preserves existing X-Request-Id header (any case) and does not overwrite', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ ok: true }),
      text: async () => '',
    } as any;

    let capturedInit: any;
    (global.fetch as jest.Mock).mockImplementation(async (_url: string, init: any) => {
      capturedInit = init;
      return response;
    });

    await fetchWithAuth('/api/ping', {
      method: 'GET',
      token: 'tok_123',
      headers: { 'x-request-id': 'existing_rid' },
    });

    expect(capturedInit.headers['x-request-id']).toBe('existing_rid');
    expect(capturedInit.headers['X-Request-Id']).toBeUndefined();
  });

  it('redirects to /login on 401 (client) and throws Unauthorized', async () => {
    const response = {
      ok: false,
      status: 401,
      headers: new Headers({ 'x-request-id': 'rid_401' }),
      json: async () => ({}),
      text: async () => 'unauthorized',
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(response);

    const originalWindow = (global as any).window;
    (global as any).window = { location: { href: '' } };

    try {
      await expect(fetchWithAuth('/api/secure', { method: 'GET', token: 'tok_123' }))
        .rejects.toThrow('Unauthorized');

      expect((global as any).window.location.href).toBe('/login');
    } finally {
      (global as any).window = originalWindow;
    }
  });

  it('throws a detailed error on non-OK responses and includes requestId', async () => {
    const response = {
      ok: false,
      status: 500,
      headers: new Headers({ 'x-request-id': 'rid_500' }),
      json: async () => ({}),
      text: async () => 'boom',
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(response);

    await expect(fetchWithAuth('/api/fail', { method: 'GET', token: 'tok_123' }))
      .rejects.toThrow('HTTP 500 [requestId=rid_500]: boom');
  });
});

describe('createApiClient', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    process.env.NEXT_PUBLIC_API_URL = '';
  });

  it('client.get uses GET and parses JSON', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'x-request-id': 'rid_ok' }),
      json: async () => ({ hello: 'world' }),
      text: async () => '',
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(response);

    const client = createApiClient('tok_abc');
    const data = await client.get('/api/hello');

    expect(data).toEqual({ hello: 'world' });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [_url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok_abc');
  });
});
