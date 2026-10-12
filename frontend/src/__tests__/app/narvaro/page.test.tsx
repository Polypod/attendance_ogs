import { fireEvent, render, screen, within } from '@testing-library/react';

import AttendanceKioskPage from '@/app/narvaro/page';

jest.mock('@/hooks/useConfig', () => ({
  useConfig: () => ({ config: null }),
  getBeltLabel: () => '10 kyu',
}));

describe('AttendanceKioskPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('attendance-kiosk-key', 'test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          date: '2026-10-12',
          sessions: [{
            id: 'session-1',
            className: 'Träning',
            startTime: '18:00',
            endTime: '19:00',
            categories: ['Barn'],
            status: 'scheduled',
            instructorName: 'Instruktör',
            students: [
              { id: '1', name: 'Anna', beltLevel: '10kyu', category: 'Barn', active: true, attendanceStatus: 'present' },
              { id: '2', name: 'Bertil', beltLevel: '10kyu', category: 'Barn', active: false, attendanceStatus: 'present' },
              { id: '3', name: 'Cecilia', beltLevel: '10kyu', category: 'Barn', active: true },
            ],
            otherStudents: [
              { id: '4', name: 'David', beltLevel: '10kyu', category: 'Vuxna', active: true, attendanceStatus: 'present' },
              { id: '5', name: 'Erik', beltLevel: '10kyu', category: 'Vuxna', active: false, attendanceStatus: 'present' },
              { id: '6', name: 'Filip', beltLevel: '10kyu', category: 'Vuxna', active: true },
            ],
          }],
        },
      }),
    } as Response);
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('shows present members from hidden lists first and moves newly selected members there', async () => {
    render(<AttendanceKioskPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Träning/ }));

    const present = screen.getByRole('heading', { name: 'Närvarande' }).closest('section')!;
    const groups = screen.getByRole('heading', { name: 'Passets grupper' }).closest('section')!;
    expect(present.compareDocumentPosition(groups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(present).getAllByRole('button')).toHaveLength(4);
    for (const name of ['Anna', 'Bertil', 'David', 'Erik']) {
      expect(within(present).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(within(groups).getAllByRole('button')).toHaveLength(1);
    expect(within(groups).getByRole('button', { name: /Cecilia/ })).toBeInTheDocument();
    expect(screen.queryByText('Filip')).not.toBeInTheDocument();

    fireEvent.click(within(groups).getByRole('button', { name: /Cecilia/ }));
    expect(within(present).getByRole('button', { name: /Cecilia/ })).toBeInTheDocument();
    expect(within(groups).queryByRole('button', { name: /Cecilia/ })).not.toBeInTheDocument();
  });
});
