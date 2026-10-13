import {
  createClassScheduleSchema,
  createUserSchema,
  updateClassScheduleSchema,
  updateUserSchema
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

  it('allows updating a non-recurring schedule with empty recurrence_end_date', () => {
    const { error } = updateClassScheduleSchema.validate({
      date: '2026-09-07',
      recurring: false,
      recurrence_end_date: ''
    });

    expect(error).toBeUndefined();
  });
});

describe('user OGS link validation', () => {
  const base = { email: 'e@example.com', name: 'Editor', role: 'editor' };

  it('requires a password for an account without an OGS link', () => {
    expect(createUserSchema.validate(base).error).toBeDefined();
    expect(createUserSchema.validate({ ...base, password: 'password123' }).error).toBeUndefined();
  });

  it('allows an OGS-linked account without a password', () => {
    expect(createUserSchema.validate({ ...base, ogs_user_id: 'abc123', sso_enabled: true }).error).toBeUndefined();
  });

  it('still checks the length of an optional password', () => {
    expect(createUserSchema.validate({ ...base, ogs_user_id: 'abc123', password: 'short' }).error).toBeDefined();
  });

  it('accepts null to unlink and rejects malformed ids', () => {
    expect(updateUserSchema.validate({ ogs_user_id: null }).error).toBeUndefined();
    expect(updateUserSchema.validate({ ogs_user_id: '../../etc' }).error).toBeDefined();
    expect(updateUserSchema.validate({ sso_enabled: 'yes please' }).error).toBeDefined();
  });
});
