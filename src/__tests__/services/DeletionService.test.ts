import { deletionService } from '../../services/DeletionService';
import { ClassModel } from '../../models/Class';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { AttendanceModel } from '../../models/Attendance';
import { StudentModel } from '../../models/Student';
import { AttendanceStatusEnum, StudentCategoryEnum } from '../../types/interfaces';
import { ConfigService } from '../../services/ConfigService';

describe('DeletionService (cascade delete)', () => {
  const getValidCategory = () =>
    ConfigService.getInstance().getCategoryValues()[0] as StudentCategoryEnum;
  const getValidBeltLevel = () => ConfigService.getInstance().getBeltLevelValues()[0];

  const createClass = async () => {
    const category = getValidCategory();
    return await ClassModel.create({
      name: 'Test Class',
      description: 'Test class description',
      categories: [category],
      instructor: 'Sensei Test',
      max_capacity: 20,
      duration_minutes: 60,
    });
  };

  const createStudent = async (email: string) => {
    const category = getValidCategory();
    const belt = getValidBeltLevel();
    return await StudentModel.create({
      name: 'Test Student',
      email,
      categories: [category],
      belt_level: belt,
      active: true,
    });
  };

  const createSchedule = async (classId: string, date: Date) => {
    return await ClassScheduleModel.create({
      class_id: classId,
      date,
      start_time: '10:00',
      end_time: '11:00',
      recurring: false,
      sessions: [],
    });
  };

  const createAttendance = async (studentId: string, scheduleId: string, date: Date) => {
    const category = getValidCategory();
    return await AttendanceModel.create({
      student_id: studentId,
      class_schedule_id: scheduleId,
      date,
      status: AttendanceStatusEnum.PRESENT,
      category,
      notes: '',
      recorded_by: 'test',
      recorded_at: new Date(),
    });
  };

  it('deletes schedule and related attendance', async () => {
    const classDoc = await createClass();
    const student = await createStudent('student1@example.com');

    const scheduleDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const schedule = await createSchedule(classDoc._id.toString(), scheduleDate);

    await createAttendance(student._id.toString(), schedule._id.toString(), scheduleDate);

    const result = await deletionService.deleteScheduleCascade(schedule._id.toString());
    expect(result).not.toBeNull();

    const scheduleAfter = await ClassScheduleModel.findById(schedule._id);
    expect(scheduleAfter).toBeNull();

    const attendanceCount = await AttendanceModel.countDocuments({ class_schedule_id: schedule._id });
    expect(attendanceCount).toBe(0);
  });

  it('deletes class and cascades to schedules and attendance', async () => {
    const classDoc = await createClass();
    const student = await createStudent('student2@example.com');

    const d1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const d2 = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const s1 = await createSchedule(classDoc._id.toString(), d1);
    const s2 = await createSchedule(classDoc._id.toString(), d2);

    await createAttendance(student._id.toString(), s1._id.toString(), d1);
    await createAttendance(student._id.toString(), s2._id.toString(), d2);

    const result = await deletionService.deleteClassCascade(classDoc._id.toString());
    expect(result).not.toBeNull();

    const classAfter = await ClassModel.findById(classDoc._id);
    expect(classAfter).toBeNull();

    const schedulesAfter = await ClassScheduleModel.countDocuments({ class_id: classDoc._id });
    expect(schedulesAfter).toBe(0);

    const attendanceAfter = await AttendanceModel.countDocuments({ class_schedule_id: { $in: [s1._id, s2._id] } });
    expect(attendanceAfter).toBe(0);
  });
});
