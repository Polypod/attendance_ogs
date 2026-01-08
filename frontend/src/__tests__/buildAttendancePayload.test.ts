import { buildAttendancePayload, formatDateToIso } from '../app/dashboard/attendance/utils';

describe('buildAttendancePayload', () => {
  it('maps attendance records to payload with ISO dates and categories', () => {
    const attendance = {
      s1: { student_id: 's1', status: 'present', notes: 'On time' },
      s2: { student_id: 's2', status: 'absent', notes: '' },
    } as const;

    const allStudents = [
      { _id: 's1', name: 'Alice', email: 'a@example.com', categories: ['adult'], belt_level: 'blue' },
      { _id: 's2', name: 'Bob', email: 'b@example.com', categories: ['kids'], belt_level: '10kyu' },
    ];

    const scheduleId = 'schedule123';
    const sessionDate = '2026-01-08';

    const payload = buildAttendancePayload(attendance as any, allStudents as any, scheduleId, sessionDate);

    const expectedDate = formatDateToIso(sessionDate);

    expect(payload).toHaveLength(2);

    const byId: Record<string, any> = {};
    payload.forEach((p: any) => (byId[p.student_id] = p));

    expect(byId['s1']).toMatchObject({
      student_id: 's1',
      class_schedule_id: scheduleId,
      date: expectedDate,
      status: 'present',
      notes: 'On time',
      category: 'adult',
    });

    expect(byId['s2']).toMatchObject({
      student_id: 's2',
      class_schedule_id: scheduleId,
      date: expectedDate,
      status: 'absent',
      notes: undefined,
      category: 'kids',
    });
  });
});
