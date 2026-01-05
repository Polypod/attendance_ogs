import mongoose from 'mongoose';
import { AttendanceService } from '../../services/AttendanceService';
import { Attendance } from '../../models/Attendance';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { StudentModel } from '../../models/Student';
import { ClassModel } from '../../models/Class';
import { 
  StudentCategoryEnum, 
  AttendanceStatusEnum,
  StudentCategory,
  AttendanceStatus
} from '../../types/interfaces';
import { ValidationError } from '../../utils/validators';

describe('AttendanceService', () => {
  let attendanceService: AttendanceService;
  let testClassId: mongoose.Types.ObjectId;
  let testScheduleId: mongoose.Types.ObjectId;
  let testStudentId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    attendanceService = new AttendanceService();
    
    // Create test data
    const testClass = await ClassModel.create({
      name: 'Test Class',
      instructor: 'Test Instructor',
      categories: [StudentCategoryEnum.KIDS, StudentCategoryEnum.YOUTH],
      schedule: [],
      description: 'Test class description'
    });
    testClassId = testClass._id;

    const testSchedule = await ClassScheduleModel.create({
      class_id: testClassId,
      date: new Date(),
      start_time: '10:00',
      end_time: '11:30',
      status: 'scheduled',
      day_of_week: 'monday',
      recurring: false
    });
    testScheduleId = testSchedule._id;

    const testStudent = await StudentModel.create({
      name: 'Test Student',
      email: 'test@example.com',
      category: StudentCategoryEnum.BEGINNER,
      date_of_birth: new Date('2000-01-01'),
      join_date: new Date(),
      emergency_contact: '1234567890'
    });
    testStudentId = testStudent._id;
  });

  describe('markMultipleAttendance', () => {
    it('should mark attendance for multiple students', async () => {
      const testData = [{
        student_id: testStudentId.toString(),
        class_schedule_id: testScheduleId.toString(),
        status: AttendanceStatusEnum.PRESENT,
        category: StudentCategoryEnum.KIDS,
        notes: 'Test attendance'
      }];

      const results = await attendanceService.markMultipleAttendance(testData, 'test@example.com');
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].attendance).toBeDefined();
      expect(results[0].attendance?.status).toBe(AttendanceStatusEnum.PRESENT);
      
      // Verify the attendance was saved in the database
      const attendance = await Attendance.findOne({
        student_id: new mongoose.Types.ObjectId(testStudentId),
        class_schedule_id: new mongoose.Types.ObjectId(testScheduleId)
      });
      expect(attendance).not.toBeNull();
      expect(attendance?.status).toBe(AttendanceStatusEnum.PRESENT);
    });

    it('should handle validation errors', async () => {
      const attendanceData = [{
        student_id: 'invalid-id',
        class_schedule_id: testScheduleId.toString(),
        status: 'invalid-status',
        category: StudentCategoryEnum.KIDS,
        notes: 'Test attendance'
      }];

      const results = await attendanceService.markMultipleAttendance(attendanceData as any, 'test@example.com');
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBeDefined();
    });
  });

  describe('getClassAttendance', () => {
    it('should return attendance for a class', async () => {
      // First, mark attendance
      await attendanceService.markMultipleAttendance(
        [
          {
            student_id: testStudentId.toString(),
            class_schedule_id: testScheduleId.toString(),
            status: AttendanceStatusEnum.PRESENT,
            category: StudentCategoryEnum.KIDS,
            notes: 'Test attendance'
          }
        ],
        'test-user'
      );

      const attendance = await attendanceService.getClassAttendance(
        testScheduleId.toString(),
        StudentCategoryEnum.KIDS
      );

      expect(attendance).toHaveLength(1);
      expect(attendance[0].student_id).toEqual(testStudentId);
      expect(attendance[0].status).toBe(AttendanceStatusEnum.PRESENT);
    });

    it('should throw error for invalid schedule ID', async () => {
      await expect(
        attendanceService.getClassAttendance('invalid-id')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('searchPastClasses', () => {
    it('should return past classes with filters', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      await ClassScheduleModel.create({
        class_id: testClassId,
        date: pastDate,
        start_time: '10:00',
        end_time: '11:30',
        status: 'completed'
      });

      const pastClasses = await attendanceService.searchPastClasses({
        date: pastDate,
        instructor: 'Test Instructor',
        category: StudentCategoryEnum.KIDS
      });

      expect(pastClasses.length).toBeGreaterThan(0);
      expect(pastClasses[0].class_id.name).toBe('Test Class');
    });
  });

  describe('generateAttendanceReports', () => {
    it('should generate attendance reports for a date range', async () => {
      // First, mark some attendance
      await attendanceService.markMultipleAttendance(
        [
          {
            student_id: testStudentId.toString(),
            class_schedule_id: testScheduleId.toString(),
            status: AttendanceStatusEnum.PRESENT,
            category: StudentCategoryEnum.KIDS,
            notes: 'Test attendance for report'
          }
        ],
        'test@example.com'
      );

      const dateRange = `${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}_${new Date().toISOString()}`;
      const reports = await attendanceService.generateAttendanceReports(dateRange);

      expect(reports).toBeInstanceOf(Array);
      expect(reports.length).toBeGreaterThan(0);
      expect(reports[0]).toHaveProperty('class_name');
      expect(reports[0]).toHaveProperty('total_students');
      expect(reports[0]).toHaveProperty('present_count');
      const report = reports.find(r => r.student_id.equals(testStudentId));
      expect(report).toBeDefined();
      expect(report?.total_classes).toBe(1);
      expect(report?.present).toBe(1);
      expect(report?.attendance_percentage).toBe(100);
    });
  });
});
