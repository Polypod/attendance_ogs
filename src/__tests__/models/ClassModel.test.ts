import { ClassModel } from '../../models/Class';

describe('ClassModel validation', () => {
  it('creates successfully with valid categories', async () => {
    const cls = new ClassModel({
      name: 'Valid Class',
      description: 'A valid class',
      categories: ['barn'],
      instructor: 'Instructor A',
      max_capacity: 10,
      duration_minutes: 60
    });

    const saved = await cls.save();
    expect(saved._id).toBeDefined();
    expect(saved.categories).toEqual(['barn']);
  });

  it('fails validation for unknown category', async () => {
    const cls = new ClassModel({
      name: 'Invalid Category Class',
      description: 'An invalid class',
      categories: ['unknown_category'],
      instructor: 'Instructor B',
      max_capacity: 10,
      duration_minutes: 60
    });

    await expect(cls.save()).rejects.toThrow(/Invalid class category/i);
  });

  it('fails validation when categories is empty', async () => {
    const cls = new ClassModel({
      name: 'Empty Categories',
      description: 'No categories',
      categories: [],
      instructor: 'Instructor C',
      max_capacity: 10,
      duration_minutes: 60
    });

    // Mongoose will either report the custom validator message or the `required` message
    await expect(cls.save()).rejects.toThrow(/(At least one category is required|Invalid class category)/i);
  });
});
