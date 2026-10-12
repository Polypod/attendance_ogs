import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import KioskSettings from '@/components/settings/KioskSettings';
import { api } from '@/lib/api';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'admin-token' }, status: 'authenticated' }),
}));
jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

describe('KioskSettings', () => {
  it('shows request details and lets an admin approve the device', async () => {
    const getMock = api.get as jest.Mock;
    getMock.mockImplementation(async (path: string) => path === '/api/kiosks'
      ? { success: true, data: [] }
      : { success: true, data: [{
        id: 'request-1', name: 'Entré-iPad', requestedAt: '2026-10-12T08:30:00.000Z',
        ipAddress: '192.0.2.10', userAgent: 'Mozilla/5.0 (iPad) Safari/605.1',
      }] });
    (api.post as jest.Mock).mockResolvedValue({ success: true });

    render(<KioskSettings />);

    expect(await screen.findByText('Entré-iPad')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.10')).toBeInTheDocument();
    expect(screen.getByText('iPad · Safari')).toBeInTheDocument();
    expect(screen.getByText('Mozilla/5.0 (iPad) Safari/605.1')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-12/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Godkänn åtkomst' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/kiosk-requests/request-1/approve', {}));
  });
});
