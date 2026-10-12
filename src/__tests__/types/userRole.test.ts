import { createUserSchema, updateUserSchema } from '../../types/validation';

describe('editor user role', () => {
  it('accepts editor for creation and role changes', () => {
    expect(createUserSchema.validate({
      email: 'editor@example.com',
      password: 'ChangeMe123!',
      name: 'Editor',
      role: 'editor'
    }).error).toBeUndefined();
    expect(updateUserSchema.validate({ role: 'editor' }).error).toBeUndefined();
  });
});
