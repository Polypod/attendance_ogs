import { renderHook, waitFor } from '@testing-library/react';

import { useConfig } from '@/hooks/useConfig';

describe('useConfig', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = '';
    (global as any).fetch = jest.fn();
  });

  it('fetches config and updates state on success', async () => {
    const response = {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          categories: [{ value: 'kids', label: 'Kids', description: '', order: 1 }],
          beltLevels: [{ value: '10kyu', label: '10 kyu', rank: 10, color: 'white' }],
        },
      }),
      text: async () => '',
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(response);

    const { result } = renderHook(() => useConfig());

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.config).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.config).toEqual({
      categories: [{ value: 'kids', label: 'Kids', description: '', order: 1 }],
      beltLevels: [{ value: '10kyu', label: '10 kyu', rank: 10, color: 'white' }],
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('/api/config');
  });

  it('sets error when fetch returns non-OK response', async () => {
    const response = {
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'fail',
    } as any;

    (global.fetch as jest.Mock).mockResolvedValue(response);

    const { result } = renderHook(() => useConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toBeNull();
    expect(result.current.error).toBe('Failed to fetch configuration');
  });
});
