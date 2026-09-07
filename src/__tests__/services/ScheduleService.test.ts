import mongoose from 'mongoose';
import { ScheduleService } from '../../services/ScheduleService';
import { ClassModel } from '../../models/Class';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { ClassStatusEnum, StudentCategoryEnum } from '../../types/interfaces';

function isoDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

describe('ScheduleService', () => {
  let scheduleService: ScheduleService;
  let testClassId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    scheduleService = new ScheduleService();

    const testClass = await ClassModel.create({
      name: 'Test Class',
      description: 'Test class description',
      categories: [StudentCategoryEnum.KIDS],
      instructor: 'Test Instructor',
      max_capacity: 30,
      duration_minutes: 60,
    });

    testClassId = testClass._id;
  });

  it('expands recurring schedules and applies session-specific status/notes', async () => {
    const base = startOfToday();
    const rangeStart = addDays(base, 1);
    const rangeEnd = addDays(base, 4);

    const sessionDate = new Date(rangeStart);
    const sessionDayOfWeek = sessionDate.getDay();

    const recurring = await ClassScheduleModel.create({
      class_id: testClassId,
      date: rangeStart,
      start_time: '10:00',
      end_time: '11:30',
      recurring: true,
      days_of_week: [sessionDayOfWeek],
      recurrence_end_date: rangeEnd,
      sessions: [
        {
          date: sessionDate,
          status: ClassStatusEnum.CANCELLED,
          notes: 'Instructor sick',
          'S-instructor': 'Replacement',
        } as any,
      ],
    });

    // Also include a normal one-off schedule inside the range
    const oneOff = await ClassScheduleModel.create({
      class_id: testClassId,
      date: addDays(base, 2),
      start_time: '09:00',
      end_time: '10:00',
      recurring: false,
      status: ClassStatusEnum.SCHEDULED,
      day_of_week: 'tuesday',
    });

    const schedules = await scheduleService.getAllSchedules({
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      classId: testClassId.toString(),
      expandRecurring: true,
    });

    // Contains the one-off schedule
    expect(schedules.some((s: any) => String(s._id) === String(oneOff._id))).toBe(true);

    // Contains an expanded recurring instance for the session date
    const expectedDateStr = isoDateOnly(sessionDate);
    const recurringInstance = schedules.find(
      (s: any) => s._isRecurringInstance === true && String(s._originalScheduleId) === String(recurring._id) && isoDateOnly(new Date(s.date)) === expectedDateStr
    );

    expect(recurringInstance).toBeDefined();
    expect(recurringInstance.status).toBe(ClassStatusEnum.CANCELLED);
    expect(recurringInstance.notes).toBe('Instructor sick');

    // For session-backed instances we keep sessions array (for frontend access)
    expect('sessions' in recurringInstance).toBe(true);
  });

  it('creates scheduled instances without sessions field when no session exists for date', async () => {
    const base = startOfToday();
    const rangeStart = addDays(base, 1);
    const rangeEnd = addDays(base, 3);

    const targetDate = new Date(rangeStart);
    const targetDayOfWeek = targetDate.getDay();

    const recurring = await ClassScheduleModel.create({
      class_id: testClassId,
      date: rangeStart,
      start_time: '10:00',
      end_time: '11:30',
      recurring: true,
      days_of_week: [targetDayOfWeek],
      recurrence_end_date: rangeEnd,
      sessions: [],
    });

    const schedules = await scheduleService.getAllSchedules({
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      classId: testClassId.toString(),
      expandRecurring: true,
    });

    const expectedDateStr = isoDateOnly(targetDate);
    const instance = schedules.find(
      (s: any) => s._isRecurringInstance === true && String(s._originalScheduleId) === String(recurring._id) && isoDateOnly(new Date(s.date)) === expectedDateStr
    );

    expect(instance).toBeDefined();
    expect(instance.status).toBe(ClassStatusEnum.SCHEDULED);
    expect('sessions' in instance).toBe(false);
  });
});
