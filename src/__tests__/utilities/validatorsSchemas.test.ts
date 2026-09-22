import {
  attendanceValidationSchema,
  classValidationSchema,
  studentValidationSchema,
} from '../../utilities/validators';
import { ConfigService } from '../../services/ConfigService';

jest.mock('../../services/ConfigService', () => ({
  ConfigService: {
    getInstance: jest.fn(),
  },
}));

describe('utilities validators schemas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockConfig({ validCategory, validBelt }: { validCategory: boolean; validBelt: boolean }) {
    (ConfigService.getInstance as jest.Mock).mockReturnValue({
      isValidCategory: jest.fn(() => validCategory),
      isValidBeltLevel: jest.fn(() => validBelt),
    });
  }

  it('studentValidationSchema: accepts valid payload', () => {
    mockConfig({ validCategory: true, validBelt: true });

    const { error } = studentValidationSchema.validate({
      name: 'John Doe',
      email: 'john@example.com',
      categories: ['barn'],
      belt_level: 'white',
      phone: '+46 70 123 45 67',
      emergency_contact: { name: 'Parent', phone: '+46 70 111 22 33' },
    });

    expect(error).toBeUndefined();
  });

  it('studentValidationSchema: rejects invalid category', () => {
    mockConfig({ validCategory: false, validBelt: true });

    const { error } = studentValidationSchema.validate({
      name: 'John Doe',
      email: 'john@example.com',
      categories: ['unknown'],
      belt_level: 'white',
      phone: '+46 70 123 45 67',
      emergency_contact: { name: 'Parent', phone: '+46 70 111 22 33' },
    });

    expect(error).toBeDefined();
  });

  it('studentValidationSchema: rejects invalid belt level', () => {
    mockConfig({ validCategory: true, validBelt: false });

    const { error } = studentValidationSchema.validate({
      name: 'John Doe',
      email: 'john@example.com',
      categories: ['barn'],
      belt_level: 'unknown',
      phone: '+46 70 123 45 67',
      emergency_contact: { name: 'Parent', phone: '+46 70 111 22 33' },
    });

    expect(error).toBeDefined();
  });

  it('classValidationSchema: rejects invalid category', () => {
    mockConfig({ validCategory: false, validBelt: true });

    const { error } = classValidationSchema.validate({
      name: 'Class',
      description: 'Desc',
      categories: ['bad'],
      instructor: 'Sensei',
      max_capacity: 20,
      duration_minutes: 60,
    });

    expect(error).toBeDefined();
  });

  it('attendanceValidationSchema: rejects invalid category', () => {
    mockConfig({ validCategory: false, validBelt: true });

    const { error } = attendanceValidationSchema.validate({
      student_id: 's1',
      class_schedule_id: 'cs1',
      status: 'present',
      category: 'bad',
    });

    expect(error).toBeDefined();
  });
});
