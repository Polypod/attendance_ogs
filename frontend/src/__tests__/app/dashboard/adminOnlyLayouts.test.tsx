import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import UsersLayout from '@/app/dashboard/users/layout';
import SettingsLayout from '@/app/dashboard/settings/layout';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('redirected'); }) }));
jest.mock('@/lib/authOptions', () => ({ authOptions: {} }));

const sessionMock = getServerSession as jest.Mock;
const redirectMock = redirect as jest.Mock;

describe.each([
  ['Users', UsersLayout],
  ['Settings', SettingsLayout],
])('%s layout', (_name, layout) => {
  beforeEach(() => {
    sessionMock.mockReset();
    redirectMock.mockClear();
  });

  it('allows admin', async () => {
    sessionMock.mockResolvedValue({ user: { role: 'admin' } });

    await expect(layout({ children: 'protected content' })).resolves.toBe('protected content');
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects editor on a direct visit', async () => {
    sessionMock.mockResolvedValue({ user: { role: 'editor' } });

    await expect(layout({ children: 'protected content' })).rejects.toThrow('redirected');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });
});
