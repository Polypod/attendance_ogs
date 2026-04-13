import mongoose from 'mongoose';
import { ReportService } from '../../services/ReportService';
import { AttendanceModel } from '../../models/Attendance';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { StudentModel } from '../../models/Student';
import { ClassModel } from '../../models/Class';
import { AttendanceStatusEnum, StudentCategoryEnum, StudentStatusEnum } from '../../types/interfaces';

describe('ReportService', () => {
  let reportService: ReportService;
  let testClassId: mongoose.Types.ObjectId;
  let testScheduleId: mongoose.Types.ObjectId;
  let testSchedule2Id: mongoose.Types.ObjectId;
  let testSchedule3Id: mongoose.Types.ObjectId;
  let studentAliceId: mongoose.Types.ObjectId;
  let studentBobId: mongoose.Types.ObjectId;
  let studentCharlieId: mongoose.Types.ObjectId;

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

    const testSchedule2 = await ClassScheduleModel.create({
      class_id: testClassId,
      date: new Date('2026-04-16T00:00:00.000Z'),
      start_time: '18:00',
      end_time: '19:00',
      status: 'scheduled',
      day_of_week: 'thursday',
      recurring: false
    });
    testSchedule2Id = testSchedule2._id;

    const testSchedule3 = await ClassScheduleModel.create({
      class_id: testClassId,
      date: new Date('2026-04-20T00:00:00.000Z'),
      start_time: '12:00',
      end_time: '13:00',
      status: 'scheduled',
      day_of_week: 'monday',
      recurring: false
    });
    testSchedule3Id = testSchedule3._id;

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

    const charlie = await StudentModel.create({
      name: 'Charlie Closed',
      email: 'charlie@example.com',
      categories: [StudentCategoryEnum.KIDS],
      belt_level: '10kyu',
      registration_date: new Date('2000-01-01'),
      phone: '1234567890',
      emergency_contact: { name: 'Parent', phone: '1234567890' },
      status: StudentStatusEnum.INACTIVE,
      active: false
    });
    studentCharlieId = charlie._id;

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

    await AttendanceModel.create({
      student_id: studentAliceId,
      class_schedule_id: testSchedule2Id,
      date: new Date('2026-04-15T22:30:00.000Z'), // 2026-04-16 00:30 in Europe/Stockholm
      status: AttendanceStatusEnum.PRESENT,
      category: StudentCategoryEnum.KIDS,
      notes: 'Second schedule record',
      recorded_by: 'admin@example.com',
      recorded_at: new Date('2026-04-16T08:00:00.000Z'),
      updated_at: new Date('2026-04-16T08:00:00.000Z')
    });

    // Extra date range to test onlyActiveStudents filter without affecting existing tests
    await AttendanceModel.create({
      student_id: studentAliceId,
      class_schedule_id: testSchedule3Id,
      date: new Date('2026-04-19T22:30:00.000Z'), // 2026-04-20 00:30 in Europe/Stockholm
      status: AttendanceStatusEnum.PRESENT,
      category: StudentCategoryEnum.KIDS,
      notes: 'Active student record',
      recorded_by: 'admin@example.com',
      recorded_at: new Date('2026-04-20T08:00:00.000Z'),
      updated_at: new Date('2026-04-20T08:00:00.000Z')
    });

    await AttendanceModel.create({
      student_id: studentCharlieId,
      class_schedule_id: testSchedule3Id,
      date: new Date('2026-04-19T22:30:00.000Z'), // 2026-04-20 00:30 in Europe/Stockholm
      status: AttendanceStatusEnum.PRESENT,
      category: StudentCategoryEnum.KIDS,
      notes: 'Inactive student record',
      recorded_by: 'admin@example.com',
      recorded_at: new Date('2026-04-20T08:00:00.000Z'),
      updated_at: new Date('2026-04-20T08:00:00.000Z')
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

  it('supports sorting raw report by student name', async () => {
    const asc = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      sortBy: 'student_name',
      sortDir: 'asc'
    });

    expect(asc.total).toBe(2);
    expect(asc.rows).toHaveLength(2);
    expect(asc.rows[0].student_name).toBe('Alice Andersson');
    expect(asc.rows[1].student_name).toBe('Bob Berg');

    const desc = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      sortBy: 'student_name',
      sortDir: 'desc'
    });

    expect(desc.total).toBe(2);
    expect(desc.rows).toHaveLength(2);
    expect(desc.rows[0].student_name).toBe('Bob Berg');
    expect(desc.rows[1].student_name).toBe('Alice Andersson');
  });

  it('supports filtering by multiple class schedule IDs', async () => {
    const result = await reportService.getRawAttendanceReport({
      from: '2026-04-16',
      to: '2026-04-16',
      classScheduleIds: [testSchedule2Id.toString()]
    });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].class_schedule_id).toBe(testSchedule2Id.toString());
  });

  it('supports filtering by specific session instances (classScheduleId + date)', async () => {
    const result = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-16',
      sessions: [{ classScheduleId: testScheduleId.toString(), date: '2026-04-14' }]
    });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].student_name).toBe('Alice Andersson');
  });

  it('supports filtering by multiple student IDs', async () => {
    const result = await reportService.getRawAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-16',
      studentIds: [studentBobId.toString()]
    });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].student_name).toBe('Bob Berg');
  });

  it('supports onlyActiveStudents filter', async () => {
    const all = await reportService.getRawAttendanceReport({
      from: '2026-04-20',
      to: '2026-04-20'
    });

    expect(all.total).toBe(2);
    expect(all.rows).toHaveLength(2);

    const activeOnly = await reportService.getRawAttendanceReport({
      from: '2026-04-20',
      to: '2026-04-20',
      onlyActiveStudents: true
    });

    expect(activeOnly.total).toBe(1);
    expect(activeOnly.rows).toHaveLength(1);
    expect(activeOnly.rows[0].student_name).toBe('Alice Andersson');
  });

  it('aggregates by student and counts present/total', async () => {
    const result = await reportService.getAggregatedAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      groupBy: 'student',
      page: 1,
      pageSize: 25
    });

    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(2);

    const aliceRow = result.rows.find((r) => r.student_id === studentAliceId.toString());
    expect(aliceRow).toBeTruthy();
    expect(aliceRow?.student_name).toBe('Alice Andersson');
    expect(aliceRow?.presentCount).toBe(1);
    expect(aliceRow?.totalCount).toBe(1);

    const bobRow = result.rows.find((r) => r.student_id === studentBobId.toString());
    expect(bobRow).toBeTruthy();
    expect(bobRow?.student_name).toBe('Bob Berg');
    expect(bobRow?.presentCount).toBe(0);
    expect(bobRow?.totalCount).toBe(1);
  });

  it('supports sorting aggregated report by student name', async () => {
    const result = await reportService.getAggregatedAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      groupBy: 'student',
      sortBy: 'student_name',
      sortDir: 'desc'
    });

    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].student_name).toBe('Bob Berg');
    expect(result.rows[1].student_name).toBe('Alice Andersson');
  });

  it('aggregates by instructor and respects date filters', async () => {
    const result = await reportService.getAggregatedAttendanceReport({
      from: '2026-04-13',
      to: '2026-04-14',
      groupBy: 'instructor',
      instructor: 'Instructor A'
    });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].instructor).toBe('Instructor A');
    expect(result.rows[0].totalCount).toBe(2);
    expect(result.rows[0].presentCount).toBe(1);
  });

  it('aggregates by student and supports onlyActiveStudents filter', async () => {
    const result = await reportService.getAggregatedAttendanceReport({
      from: '2026-04-20',
      to: '2026-04-20',
      groupBy: 'student',
      onlyActiveStudents: true
    });

    expect(result.total).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].student_name).toBe('Alice Andersson');
  });
});
