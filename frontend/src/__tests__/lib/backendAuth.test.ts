/**
 * @jest-environment node
 */
import {
  exchangeOgsIdToken,
  getAccessTokenExpiry,
  refreshAccessToken,
} from '@/lib/backendAuth';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const jwtWithExp = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ id: 'u1', exp })).toString('base64url')}.s`;

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }) as any;

describe('backendAuth', () => {
  const env = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...env, BACKEND_URL: 'http://backend.test', SSO_INTERNAL_SECRET: 'secret' };
    global.fetch = jest.fn();
  });
  afterAll(() => {
    process.env = env;
    global.fetch = originalFetch;
  });

  describe('getAccessTokenExpiry', () => {
    it('reads exp in milliseconds', () => {
      expect(getAccessTokenExpiry(jwtWithExp(1000))).toBe(1000 * 1000);
    });

    it('returns undefined for a malformed token', () => {
      expect(getAccessTokenExpiry('nope')).toBeUndefined();
    });
  });

  describe('exchangeOgsIdToken', () => {
    it('sends the ID token with the internal secret', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        jsonResponse(200, {
          success: true,
          token: 'a',
          refreshToken: 'r',
          user: { _id: 'u1', email: 'e@x.se', name: 'E', role: 'editor' },
        })
      );

      const result = await exchangeOgsIdToken('id-token');

      expect(result).toEqual({
        session: { id: 'u1', email: 'e@x.se', name: 'E', role: 'editor', accessToken: 'a', refreshToken: 'r' },
      });
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('http://backend.test/api/auth/sso/ogs');
      expect(init.headers['X-Internal-Secret']).toBe('secret');
      expect(JSON.parse(init.body)).toEqual({ idToken: 'id-token' });
    });

    it('returns the backend error code on denial', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(403, { success: false, code: 'not_linked' }));
      await expect(exchangeOgsIdToken('id-token')).resolves.toEqual({ error: 'not_linked' });
    });

    it('does not call the backend without a secret', async () => {
      delete process.env.SSO_INTERNAL_SECRET;
      await expect(exchangeOgsIdToken('id-token')).resolves.toEqual({ error: 'not_configured' });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('reports a network failure as unavailable', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(exchangeOgsIdToken('id-token')).resolves.toEqual({ error: 'unavailable' });
    });
  });

  describe('refreshAccessToken', () => {
    const token = { id: 'u1', role: 'editor', accessToken: 'old', refreshToken: 'r' } as any;

    it('stores the new access token, its expiry and the synced role', async () => {
      const fresh = jwtWithExp(2000);
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { success: true, token: fresh, role: 'admin' }));

      const result = await refreshAccessToken(token);

      expect(result).toMatchObject({ accessToken: fresh, accessTokenExpires: 2000 * 1000, role: 'admin' });
      expect(result.error).toBeUndefined();
      expect(result.refreshToken).toBe('r');
    });

    it('ends the session when the backend refuses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(403, { success: false, code: 'ogs_role_missing' }));

      const result = await refreshAccessToken(token);

      expect(result).toMatchObject({ accessToken: '', error: 'RefreshAccessTokenError' });
    });

    it.each([429, 500, 503])('keeps the session on a transient %i', async (status) => {
      (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(status, { success: false }));
      await expect(refreshAccessToken(token)).resolves.toBe(token);
    });

    it('keeps the session on a network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('timeout'));
      await expect(refreshAccessToken(token)).resolves.toBe(token);
    });

    it('ends the session without a refresh token', async () => {
      const result = await refreshAccessToken({ ...token, refreshToken: undefined });
      expect(result.error).toBe('RefreshAccessTokenError');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
