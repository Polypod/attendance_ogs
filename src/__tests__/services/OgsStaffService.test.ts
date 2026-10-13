import {
  fetchOgsStaff,
  OgsStaffAccount,
  OgsStaffService,
  resolveAttendanceRole,
  resolveOgsStaffUrl,
} from '../../services/OgsStaffService';
import { UserRoleEnum } from '../../types/interfaces';

const account = (overrides: Partial<OgsStaffAccount> = {}): OgsStaffAccount => ({
  id: 'ogs1',
  email: 'a@example.com',
  displayName: 'A',
  roles: ['editor'],
  status: 'approved',
  isActive: null,
  ...overrides,
});

describe('resolveAttendanceRole', () => {
  it('maps editor and admin, with admin taking precedence', () => {
    expect(resolveAttendanceRole(account({ roles: ['editor'] }))).toBe(UserRoleEnum.EDITOR);
    expect(resolveAttendanceRole(account({ roles: ['admin'] }))).toBe(UserRoleEnum.ADMIN);
    expect(resolveAttendanceRole(account({ roles: ['editor', 'admin', 'member'] }))).toBe(UserRoleEnum.ADMIN);
  });

  it('allows an account without an isActive value', () => {
    expect(resolveAttendanceRole(account({ isActive: null }))).toBe(UserRoleEnum.EDITOR);
    expect(resolveAttendanceRole(account({ isActive: true }))).toBe(UserRoleEnum.EDITOR);
  });

  it.each([
    ['member only', { roles: ['member'] }],
    ['pending', { status: 'pending' }],
    ['rejected', { status: 'rejected' }],
    ['inactive', { isActive: false }],
    ['no roles', { roles: undefined as unknown as string[] }],
  ])('denies %s', (_label, overrides) => {
    expect(resolveAttendanceRole(account(overrides as Partial<OgsStaffAccount>))).toBeNull();
  });

  it('denies a missing account', () => {
    expect(resolveAttendanceRole(null)).toBeNull();
  });
});

describe('resolveOgsStaffUrl', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = { ...env };
    delete process.env.OGS_STAFF_URL;
    delete process.env.OGS_SYNC_URL;
  });
  afterAll(() => {
    process.env = env;
  });

  it('prefers OGS_STAFF_URL', () => {
    process.env.OGS_STAFF_URL = 'https://ogs.test/api/x';
    process.env.OGS_SYNC_URL = 'https://ogs.test/api/attendance-sync/members';
    expect(resolveOgsStaffUrl()).toBe('https://ogs.test/api/x');
  });

  it('derives the URL from the member sync URL', () => {
    process.env.OGS_SYNC_URL = 'https://ogs.test/api/attendance-sync/members/';
    expect(resolveOgsStaffUrl()).toBe('https://ogs.test/api/attendance-sync/staff');
  });

  it('returns null when nothing can be derived', () => {
    process.env.OGS_SYNC_URL = 'https://ogs.test/other';
    expect(resolveOgsStaffUrl()).toBeNull();
  });
});

describe('fetchOgsStaff', () => {
  const env = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...env,
      OGS_STAFF_URL: 'https://ogs.test/api/attendance-sync/staff',
      OGS_SYNC_API_KEY: 'key',
    };
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  afterAll(() => {
    process.env = env;
  });

  it('sends the API key and the id filter', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ staff: [account()] }),
    });
    global.fetch = fetchMock as any;

    await expect(fetchOgsStaff('ogs1')).resolves.toEqual([account()]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://ogs.test/api/attendance-sync/staff?id=ogs1');
    expect(init.headers.Authorization).toBe('users API-Key key');
  });

  it('fails on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as any;
    await expect(fetchOgsStaff()).rejects.toThrow('status 401');
  });

  it('fails on a malformed response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
    await expect(fetchOgsStaff()).rejects.toThrow('staff array');
  });

  it('fails without configuration', async () => {
    delete process.env.OGS_SYNC_API_KEY;
    await expect(fetchOgsStaff()).rejects.toThrow('OGS_SYNC_API_KEY');
  });
});

describe('OgsStaffService', () => {
  it('finds an account by id only on an exact id match', async () => {
    const fetcher = jest.fn().mockResolvedValue([account({ id: 'other' })]);
    const service = new OgsStaffService(fetcher);

    await expect(service.findById('ogs1')).resolves.toBeNull();
    expect(fetcher).toHaveBeenCalledWith('ogs1');
  });
});
