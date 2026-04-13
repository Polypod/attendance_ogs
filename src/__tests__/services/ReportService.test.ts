import mongoose from 'mongoose';
import { ReportService } from '../../services/ReportService';
import { AttendanceModel } from '../../models/Attendance';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { StudentModel } from '../../models/Student';
import { ClassModel } from '../../models/Class';
import { AttendanceStatusEnum, StudentCategoryEnum } from '../../types/interfaces';

describe('ReportService', () => {
  let reportService: ReportService;
  let testClassId: mongoose.Types.ObjectId;
  let testScheduleId: mongoose.Types.ObjectId;
  let studentAliceId: mongoose.Types.ObjectId;
  let studentBobId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    reportService = new ReportService();

    const testClass = await ClassModel.create({
      name: 'Test Class',
      description: 'Test class description',
      categories: [StudentCategoryEnum.KIDS],
      instructor: 'Instructor A',
      max_capacity: 30,
      duration_minutes: 60
    });
    testClassId = testClass._id;

    const testSchedule = await ClassScheduleModel.create({
      class_id: testClassId,
      date: new Date('2026-04-14T00:00:00.000Z'),
      start_time: '10:00',
      end_time: '11:00',
      status: 'scheduled',
      day_of_week: 'tuesday',
      recurring: false
    });
    testScheduleId = testSchedule._id;

    const alice = await StudentModel.create({
      name: 'Alice Andersson',
      email: 'alice@example.com',
      categories: [StudentCategoryEnum.KIDS],
      belt_level: '10kyu',
      registration_date: new Date('2000-01-01'),
      phone: '1234567890',
      emergency_contact: { name: 'Parent', phone: '1234567890' }
    });
    studentAliceId = alice._id;

    const bob = await StudentModel.create({
      name: 'Bob Berg',
      email: 'bob@example.com',
      categories: [StudentCategoryEnum.KIDS],
      belt_level: '10kyu',
      registration_date: new Date('2000-01-01'),
      phone: '1234567890',
      emergency_contact: { name: 'Parent', phone: '1234567890' }
    });
    studentBobId = bob._id;

    // NOTE: date values are intentionally chosen to exercise Stockholm date boundaries
    await AttendanceModel.create({
      student_id: studentAliceId,
      class_schedule_id: testScheduleId,
      date: new Date('2026-04-13T22:30:00.000Z'), // 2026-04-14 00:30 in Europe/Stockholm
      status: AttendanceStatusEnum.PRESENT,
      category: StudentCategoryEnum.KIDS,
      notes: 'Late night record',
      recorded_by: 'admin@example.com',
      recorded_at: new Date('2026-04-14T08:00:00.000Z'),
      updated_at: new Date('2026-04-14T08:00:00.000Z')
    });

    await AttendanceModel.create({
      student_id: studentBobId,
      class_schedule_id: testScheduleId,
      date: new Date('2026-04-13T10:00:00.000Z'), // 2026-04-13 in Europe/Stockholm
      status: AttendanceStatusEnum.ABSENT,
      category: StudentCategoryEnum.KIDS,
      notes: 'Earlier record',
      recorded_by: 'admin@example.com',
      recorded_at: new Date('2026-04-13T12:00:00.000Z'),
      updated_at: new Date('2026-04-13T12:00:00.000Z')
    });
  });

  it('returns rows within Stockholm date range (inclusive days)', async () => {
    const result = await reportService.getRawAttendanceReport({
      from: '2026-04-14',
      to: '2026-04-14',
      page: 1,
      pageSize: 25
    });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].student_name).toBe('Alice Andersson');
  });

  it('supports studentName contains filter (case-insensitive)', async () => {
    const result = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      studentName: 'alice'
    });

    expect(result.total).toBe(1);
    expect(result.rows[0].student_name).toBe('Alice Andersson');
  });

  it('supports instructor and status filters', async () => {
    const result = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      instructor: 'Instructor A',
      status: [AttendanceStatusEnum.ABSENT]
    });

    expect(result.total).toBe(1);
    expect(result.rows[0].student_name).toBe('Bob Berg');
    expect(result.rows[0].status).toBe(AttendanceStatusEnum.ABSENT);
  });

  it('paginates results and returns total counts', async () => {
    const page1 = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      page: 1,
      pageSize: 1
    });

    expect(page1.total).toBe(2);
    expect(page1.rows).toHaveLength(1);
    expect(page1.totalPages).toBe(2);

    const page2 = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      page: 2,
      pageSize: 1
    });

    expect(page2.total).toBe(2);
    expect(page2.rows).toHaveLength(1);
  });
});
