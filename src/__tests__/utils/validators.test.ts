import { ValidationError, validateObjectId, validateStudentCategory, validateAttendanceStatus, validateRequiredFields, validateDateRange, validateTimeRange } from '../../utils/validators';
import { ConfigService } from '../../services/ConfigService';
import mongoose from 'mongoose';

jest.mock('../../services/ConfigService');

const mockConfig = {
  isValidCategory: jest.fn(),
  getCategoryValues: jest.fn()
};

describe('validators', () => {
  beforeAll(() => {
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates object id', () => {
    expect(() => validateObjectId(new mongoose.Types.ObjectId().toString())).not.toThrow();
    expect(() => validateObjectId('bad', 'id')).toThrow(ValidationError);
  });

  it('validates student category', () => {
    mockConfig.isValidCategory.mockReturnValueOnce(true);
    expect(() => validateStudentCategory('kids')).not.toThrow();

    mockConfig.isValidCategory.mockReturnValueOnce(false);
    mockConfig.getCategoryValues.mockReturnValueOnce(['kids', 'adult']);
    expect(() => validateStudentCategory('nope')).toThrow('Invalid student category: nope. Must be one of: kids, adult');
  });

  it('validates attendance status', () => {
    expect(() => validateAttendanceStatus('present')).not.toThrow();
    expect(() => validateAttendanceStatus('zzz')).toThrow('Invalid attendance status: zzz. Must be one of: present, absent, late, excused');
  });

  it('validates required fields', () => {
    expect(() => validateRequiredFields({ a: 1 }, ['a'], 'ctx')).not.toThrow();
    expect(() => validateRequiredFields({ a: '' }, ['a'], 'ctx')).toThrow('Missing required ctx fields: a');
  });

  it('validates date range', () => {
    expect(() => validateDateRange(new Date('2020-01-01'), new Date('2020-01-02'))).not.toThrow();
    expect(() => validateDateRange(new Date('2020-01-02'), new Date('2020-01-01'))).toThrow(/Invalid date range: start date/);
  });

  it('validates time range', () => {
    expect(() => validateTimeRange('09:00', '10:00')).not.toThrow();
    expect(() => validateTimeRange('10:00', '09:00')).toThrow('Invalid time range: start time (10:00) must be before end time (09:00)');
  });
});
