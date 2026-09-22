import mongoose from 'mongoose';
import { KioskAttendanceService, KioskIdentity } from '../../services/KioskAttendanceService';
import { ClassModel } from '../../models/Class';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { StudentModel } from '../../models/Student';
import { Attendance } from '../../models/Attendance';
import {
  StudentCategoryEnum,
  StudentStatusEnum,
  ClassStatusEnum,
  AttendanceStatusEnum,
} from '../../types/interfaces';

// Mirrors the service's own local-midnight math so fixtures land inside the
// [start, end) window it queries for "today", regardless of the host timezone.
const localMidnight = (date: Date = new Date()): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Mirrors the service's dateOnlyUtc(): real schedule.sessions[] entries are
// always written with a true UTC-midnight date (see completeSession), so any
// fixture emulating one has to match that, not local midnight.
const utcMidnight = (date: Date = new Date()): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

const dateKeyFor = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

describe('KioskAttendanceService', () => {
  let service: KioskAttendanceService;
  const kiosk: KioskIdentity = { id: 'kiosk-1', name: 'Dojo Kiosk' };

  beforeEach(() => {
    service = new KioskAttendanceService();
  });

  describe('getSessionsForDate', () => {
    it('lists non-recurring and expanded recurring sessions, groups students by category, and attaches attendance', async () => {
      const barnClass = await ClassModel.create({
        name: 'Barnträning',
        description: 'Barnträning',
        categories: [StudentCategoryEnum.KIDS],
        instructor: 'Sensei A',
        max_capacity: 20,
        duration_minutes: 60,
      });

      const vuxenClass = await ClassModel.create({
        name: 'Vuxenträning',
        description: 'Vuxenträning',
        categories: [StudentCategoryEnum.ADULT],
        instructor: 'Sensei B',
        max_capacity: 20,
        duration_minutes: 60,
      });

      const today = localMidnight();
      const dateKey = dateKeyFor(today);

      const barnSchedule = await ClassScheduleModel.create({
        class_id: barnClass._id,
        date: today,
        start_time: '10:00',
        end_time: '11:00',
        status: ClassStatusEnum.SCHEDULED,
        recurring: false,
        sessions: [{ date: utcMidnight(today), 'S-instructor': 'Vikarie' }],
      });

      const templateAnchor = new Date(today);
      templateAnchor.setDate(templateAnchor.getDate() - 28);
      const vuxenTemplate = await ClassScheduleModel.create({
        class_id: vuxenClass._id,
        date: templateAnchor,
        start_time: '19:00',
        end_time: '20:00',
        status: ClassStatusEnum.SCHEDULED,
        recurring: true,
        days_of_week: [today.getDay()],
      });

      // Cancelled session on the same day must not appear
      await ClassScheduleModel.create({
        class_id: barnClass._id,
        date: today,
        start_time: '15:00',
        end_time: '16:00',
        status: ClassStatusEnum.CANCELLED,
        recurring: false,
      });

      const barnActive = await StudentModel.create({
        name: 'Barn Aktiv',
        email: 'barn.aktiv@example.com',
        categories: [StudentCategoryEnum.KIDS],
        belt_level: '10kyu',
      });
      const vuxenActive = await StudentModel.create({
        name: 'Vuxen Aktiv',
        email: 'vuxen.aktiv@example.com',
        categories: [StudentCategoryEnum.ADULT],
        belt_level: '9kyu',
      });

      await Attendance.create({
        student_id: barnActive._id,
        class_schedule_id: barnSchedule._id,
        date: today,
        status: AttendanceStatusEnum.PRESENT,
        category: StudentCategoryEnum.KIDS,
        recorded_by: 'kiosk:test-setup',
      });

      const result = await service.getSessionsForDate();

      expect(result.date).toBe(dateKey);
      expect(result.sessions).toHaveLength(2);

      const barnSession = result.sessions.find((session) => session.id === barnSchedule._id.toString());
      expect(barnSession).toBeDefined();
      expect(barnSession!.instructorName).toBe('Vikarie');
      expect(barnSession!.students.map((student) => student.name)).toEqual(['Barn Aktiv']);
      expect(barnSession!.students[0].attendanceStatus).toBe(AttendanceStatusEnum.PRESENT);
      expect(barnSession!.otherStudents.map((student) => student.name)).toEqual(['Vuxen Aktiv']);

      const vuxenSession = result.sessions.find((session) => session.id === vuxenTemplate._id.toString());
      expect(vuxenSession).toBeDefined();
      expect(vuxenSession!.instructorName).toBe('Sensei B');
      expect(vuxenSession!.students.map((student) => student.name)).toEqual(['Vuxen Aktiv']);
      expect(vuxenSession!.otherStudents.map((student) => student.name)).toEqual(['Barn Aktiv']);
    });

    it('rejects an invalid date format', async () => {
      await expect(service.getSessionsForDate('not-a-date')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('rejects a date outside the allowed window', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 10);

      await expect(service.getSessionsForDate(dateKeyFor(farFuture))).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('within'),
      });
    });
  });

  describe('finalizeSession', () => {
    async function createBarnFixture() {
      const barnClass = await ClassModel.create({
        name: 'Barnträning',
        description: 'Barnträning',
        categories: [StudentCategoryEnum.KIDS],
        instructor: 'Sensei A',
        max_capacity: 20,
        duration_minutes: 60,
      });

      const schedule = await ClassScheduleModel.create({
        class_id: barnClass._id,
        date: localMidnight(),
        start_time: '10:00',
        end_time: '11:00',
        status: ClassStatusEnum.SCHEDULED,
        recurring: false,
      });

      const present = await StudentModel.create({
        name: 'Present Student',
        email: 'present@example.com',
        categories: [StudentCategoryEnum.KIDS],
        belt_level: '10kyu',
      });
      const absent = await StudentModel.create({
        name: 'Absent Student',
        email: 'absent@example.com',
        categories: [StudentCategoryEnum.KIDS],
        belt_level: '10kyu',
      });
      const inactiveButPresent = await StudentModel.create({
        name: 'Inactive But Present',
        email: 'inactive.present@example.com',
        categories: [StudentCategoryEnum.KIDS],
        belt_level: '10kyu',
        active: false,
      });
      const statusInactive = await StudentModel.create({
        name: 'Status Inactive',
        email: 'status.inactive@example.com',
        categories: [StudentCategoryEnum.KIDS],
        belt_level: '10kyu',
        status: StudentStatusEnum.INACTIVE,
      });

      return { schedule, present, absent, inactiveButPresent, statusInactive };
    }

    it('marks present/absent attendance, includes an explicitly-selected inactive student, and completes the session', async () => {
      const { schedule, present, absent, inactiveButPresent } = await createBarnFixture();

      const result = await service.finalizeSession(
        schedule._id.toString(),
        [present._id.toString(), inactiveButPresent._id.toString()],
        kiosk,
        undefined,
        'Overriding Instructor'
      );

      expect(result.presentCount).toBe(2);
      expect(result.absentCount).toBe(1);

      const presentRecord = await Attendance.findOne({ student_id: present._id, class_schedule_id: schedule._id });
      expect(presentRecord?.status).toBe(AttendanceStatusEnum.PRESENT);
      expect(presentRecord?.category).toBe(StudentCategoryEnum.KIDS);
      expect(presentRecord?.recorded_by).toBe(`kiosk:${kiosk.name}`);

      const absentRecord = await Attendance.findOne({ student_id: absent._id, class_schedule_id: schedule._id });
      expect(absentRecord?.status).toBe(AttendanceStatusEnum.ABSENT);

      const inactivePresentRecord = await Attendance.findOne({
        student_id: inactiveButPresent._id,
        class_schedule_id: schedule._id,
      });
      expect(inactivePresentRecord?.status).toBe(AttendanceStatusEnum.PRESENT);

      const updatedSchedule = await ClassScheduleModel.findById(schedule._id);
      expect(updatedSchedule?.status).toBe(ClassStatusEnum.COMPLETED);
      expect((updatedSchedule?.sessions?.[0] as any)?.['S-instructor']).toBe('Overriding Instructor');
    });

    it('updates the existing session entry (instead of adding a new one) when finalized twice for the same date', async () => {
      const { schedule, present } = await createBarnFixture();

      await service.finalizeSession(schedule._id.toString(), [present._id.toString()], kiosk, undefined, 'First Instructor');
      await service.finalizeSession(schedule._id.toString(), [present._id.toString()], kiosk, undefined, 'Second Instructor');

      const updatedSchedule = await ClassScheduleModel.findById(schedule._id);
      expect(updatedSchedule?.sessions).toHaveLength(1);
      expect((updatedSchedule?.sessions?.[0] as any)?.['S-instructor']).toBe('Second Instructor');
    });

    it('completes the session without touching sessions[] when no instructor override is given', async () => {
      const { schedule, present } = await createBarnFixture();

      await service.finalizeSession(schedule._id.toString(), [present._id.toString()], kiosk);

      const updatedSchedule = await ClassScheduleModel.findById(schedule._id);
      expect(updatedSchedule?.status).toBe(ClassStatusEnum.COMPLETED);
      expect(updatedSchedule?.sessions).toHaveLength(0);
    });

    it('rejects an invalid schedule id', async () => {
      await expect(service.finalizeSession('not-an-id', [], kiosk)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects an invalid student id', async () => {
      const { schedule } = await createBarnFixture();

      await expect(
        service.finalizeSession(schedule._id.toString(), ['not-an-id'], kiosk)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects when no schedule exists for the given id on the selected date', async () => {
      const missingId = new mongoose.Types.ObjectId().toString();

      await expect(service.finalizeSession(missingId, [], kiosk)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rejects when a selected student does not exist', async () => {
      const { schedule } = await createBarnFixture();
      const unknownStudentId = new mongoose.Types.ObjectId().toString();

      await expect(
        service.finalizeSession(schedule._id.toString(), [unknownStudentId], kiosk)
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
