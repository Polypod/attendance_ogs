import moment from 'moment';
import { TimeHelpers } from '../../utilities/timeHelpers';

describe('TimeHelpers', () => {
  it('detects class starting soon within threshold', () => {
    const soon = moment().add(10, 'minutes').format('HH:mm');
    const later = moment().add(40, 'minutes').format('HH:mm');
    expect(TimeHelpers.isClassStartingSoon(soon)).toBe(true);
    expect(TimeHelpers.isClassStartingSoon(later)).toBe(false);
  });

  it('detects class currently running', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T10:00:00Z').valueOf());
    const start = moment().subtract(5, 'minutes').format('HH:mm');
    const end = moment().add(5, 'minutes').format('HH:mm');
    const futureStart = moment().add(60, 'minutes').format('HH:mm');
    const futureEnd = moment().add(90, 'minutes').format('HH:mm');

    expect(TimeHelpers.isClassCurrent(start, end)).toBe(true);
    expect(TimeHelpers.isClassCurrent(futureStart, futureEnd)).toBe(false);
    nowSpy.mockRestore();
  });

  it('returns next class time sorted by start time', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T00:00:00Z').valueOf());
    const sooner = '10:30';
    const later = '12:00';
    const muchLater = '15:00';

    const next = TimeHelpers.getNextClassTime([
      { start_time: later },
      { start_time: sooner },
      { start_time: muchLater }
    ]);
    expect(next?.start_time).toBe(sooner);
    nowSpy.mockRestore();
  });

  it('formats time range', () => {
    expect(TimeHelpers.formatTimeRange('09:00', '10:00')).toBe('09:00-10:00');
  });

  it('returns day of week in lowercase', () => {
    const day = TimeHelpers.getDayOfWeek(new Date('2024-01-01T10:00:00Z'));
    expect(day).toBe('monday');
  });
});

describe('TimeHelpers.normalizeScheduleDayOfWeek', () => {
  it('derives the day of week from the schedule date when the field is blank', () => {
    expect(
      TimeHelpers.normalizeScheduleDayOfWeek({
        date: '2026-09-07',
        day_of_week: ''
      })
    ).toBe('monday');
  });

  it('reuses the existing schedule date when an update omits the day of week', () => {
    expect(
      TimeHelpers.normalizeScheduleDayOfWeek(
        { day_of_week: undefined },
        new Date('2026-09-08T00:00:00.000Z')
      )
    ).toBe('tuesday');
  });
});
