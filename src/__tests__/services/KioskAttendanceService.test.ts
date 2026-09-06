import mongoose from 'mongoose';
import { AttendanceModel } from '../../models/Attendance';
import { ClassModel } from '../../models/Class';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { StudentModel } from '../../models/Student';
import { AttendanceStatusEnum, ClassStatusEnum, StudentCategoryEnum } from '../../types/interfaces';
import { KioskAttendanceService } from '../../services/KioskAttendanceService';

describe('KioskAttendanceService', () => {
  let service: KioskAttendanceService;
  let scheduleId: mongoose.Types.ObjectId;
  let presentStudentId: mongoose.Types.ObjectId;
  let absentStudentId: mongoose.Types.ObjectId;
  let otherStudentId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    process.env.APP_TIMEZONE = 'Europe/Stockholm';
    service = new KioskAttendanceService();
    const classInfo = await ClassModel.create({ name: 'Kids karate', description: 'Kids class', categories: [StudentCategoryEnum.KIDS], instructor: 'Sensei', max_capacity: 20, duration_minutes: 60 });
    const schedule = await ClassScheduleModel.create({ class_id: classInfo._id, date: new Date(), start_time: '17:00', end_time: '18:00', recurring: false, status: ClassStatusEnum.SCHEDULED });
    scheduleId = schedule._id;
    const students = await StudentModel.create([
      { name: 'Present Student', email: 'present@example.com', categories: [StudentCategoryEnum.KIDS], belt_level: '10kyu', registration_date: new Date(), phone: '0700000001', emergency_contact: { name: 'Parent', phone: '0700000001' } },
      { name: 'Absent Student', email: 'absent@example.com', categories: [StudentCategoryEnum.KIDS], belt_level: '9kyu', registration_date: new Date(), phone: '0700000002', emergency_contact: { name: 'Parent', phone: '0700000002' } },
      { name: 'Adult Student', email: 'adult@example.com', categories: [StudentCategoryEnum.ADULT], belt_level: '8kyu', registration_date: new Date(), phone: '0700000003', emergency_contact: { name: 'Parent', phone: '0700000003' } },
    ]);
    [presentStudentId, absentStudentId, otherStudentId] = students.map((student) => student._id) as [mongoose.Types.ObjectId, mongoose.Types.ObjectId, mongoose.Types.ObjectId];
  });

  afterEach(() => {
    delete process.env.APP_TIMEZONE;
  });

  it('separates other students from class-category members and excludes contact details', async () => {
    const result = await service.getTodaySessions();

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].instructorName).toBe('Sensei');
    expect(result.sessions[0].students.map((student) => student.id)).toEqual(expect.arrayContaining([
      presentStudentId.toString(),
      absentStudentId.toString(),
    ]));
    expect(result.sessions[0].otherStudents.map((student) => student.id)).toContain(otherStudentId.toString());
    expect(JSON.stringify(result)).not.toContain('present@example.com');
    expect(JSON.stringify(result)).not.toContain('0700000001');
  });

  it('writes all eligible students as present or absent and completes the session', async () => {
    await expect(
      service.finalizeSession(
        scheduleId.toString(),
        [presentStudentId.toString(), otherStudentId.toString()],
        { id: 'kiosk-id', name: 'Entrance iPad' },
        'Replacement Sensei'
      )
    ).resolves.toEqual({ presentCount: 2, absentCount: 1 });

    const attendance = await AttendanceModel.find({ class_schedule_id: scheduleId });
    expect(attendance.find((entry) => entry.student_id.equals(presentStudentId))?.status).toBe(AttendanceStatusEnum.PRESENT);
    expect(attendance.find((entry) => entry.student_id.equals(absentStudentId))?.status).toBe(AttendanceStatusEnum.ABSENT);
    expect(attendance.find((entry) => entry.student_id.equals(otherStudentId))?.status).toBe(AttendanceStatusEnum.PRESENT);
    expect(attendance.every((entry) => entry.recorded_by === 'kiosk:Entrance iPad')).toBe(true);
    await expect(ClassScheduleModel.findById(scheduleId)).resolves.toMatchObject({
      status: ClassStatusEnum.COMPLETED,
      sessions: [expect.objectContaining({ 'S-instructor': 'Replacement Sensei' })],
    });
  });
});
