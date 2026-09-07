import { TimeHelpers } from '../../utilities/timeHelpers';

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
