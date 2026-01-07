import { ClassModel } from '../../models/Class';
import mongoose from 'mongoose';
import { ConfigService } from '../../services/ConfigService';

// Ensure ConfigService is initialized with local config
beforeAll(async () => {
  // ConfigService.initialize() reads config/system.yaml on startup in the app,
  // but in tests we can ensure getCategoryValues() works by calling getInstance()
  // which will throw if not initialized. In this test environment, the file
  // exists in the repo so calling getCategories/getCategoryValues is safe.
  // If needed, we could call ConfigService.initialize() asynchronously here.
  try {
    await ConfigService.initialize();
  } catch (err: unknown) {
    // If initialization fails, let tests proceed; validator will throw accordingly
    // but we don't want the test harness to crash here.
    // eslint-disable-next-line no-console
    console.warn('ConfigService initialization in test failed, continuing:', (err instanceof Error ? err.message : err));
  }
});

describe('ClassModel validation', () => {
  it('creates successfully with valid categories', async () => {
    const cls = new ClassModel({
      name: 'Valid Class',
      description: 'A valid class',
      categories: ['kids'],
      instructor: 'Instructor A',
      max_capacity: 10,
      duration_minutes: 60
    });

    const saved = await cls.save();
    expect(saved._id).toBeDefined();
    expect(saved.categories).toEqual(['kids']);
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
