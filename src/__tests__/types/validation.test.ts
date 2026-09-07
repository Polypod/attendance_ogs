import {
  createClassScheduleSchema,
  updateClassScheduleSchema
} from '../../types/validation';

describe('class schedule validation', () => {
  it('allows creating a non-recurring schedule without an explicit day_of_week', () => {
    const { error } = createClassScheduleSchema.validate({
      class_id: '507f1f77bcf86cd799439011',
      date: '2026-09-07',
      start_time: '18:00',
      end_time: '19:00',
      day_of_week: '',
      recurring: false,
      status: 'scheduled'
    });

    expect(error).toBeUndefined();
  });

  it('allows updating a schedule with a blank day_of_week from the form payload', () => {
    const { error } = updateClassScheduleSchema.validate({
      date: '2026-09-07',
      day_of_week: '',
      recurring: false,
      status: 'scheduled'
    });

    expect(error).toBeUndefined();
  });
});
