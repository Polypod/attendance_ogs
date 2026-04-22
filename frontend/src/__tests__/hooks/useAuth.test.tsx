import { renderHook } from '@testing-library/react';

import { useAuth } from '@/hooks/useAuth';

const mockUseSession = jest.fn();

jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

describe('useAuth', () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it('returns loading state while session is loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('maps role flags for authenticated users', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'admin', name: 'A' } },
      status: 'authenticated',
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toEqual({ role: 'admin', name: 'A' });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isInstructor).toBe(false);
    expect(result.current.isStaff).toBe(false);
    expect(result.current.isStudent).toBe(false);
  });

  it('returns unauthenticated defaults', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeUndefined();

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.isInstructor).toBe(false);
    expect(result.current.isStaff).toBe(false);
    expect(result.current.isStudent).toBe(false);
  });
});
