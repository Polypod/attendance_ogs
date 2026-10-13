import { requireInternalSecret } from '../../middleware/internalAuth';

describe('requireInternalSecret', () => {
  const env = process.env;
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res: any = { status };
  const next = jest.fn();
  const req = (secret?: string): any => ({
    get: (name: string) => (name === 'x-internal-secret' ? secret : undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env, SSO_INTERNAL_SECRET: 'a-long-shared-secret' };
  });
  afterAll(() => {
    process.env = env;
  });

  it('passes with the right secret', () => {
    requireInternalSecret(req('a-long-shared-secret'), res, next);
    expect(next).toHaveBeenCalled();
  });

  it.each([undefined, '', 'wrong', 'a-long-shared-secreT'])('rejects %p', (secret) => {
    requireInternalSecret(req(secret), res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('is closed when no secret is configured', () => {
    delete process.env.SSO_INTERNAL_SECRET;
    requireInternalSecret(req(''), res, next);
    expect(status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
