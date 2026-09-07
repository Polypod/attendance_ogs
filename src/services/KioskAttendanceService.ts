import moment from 'moment';
import { Types } from 'mongoose';
import { Attendance } from '../models/Attendance';
import { ClassScheduleModel } from '../models/ClassSchedule';
import { StudentModel } from '../models/Student';
import { AttendanceStatusEnum, ClassStatusEnum, StudentCategoryEnum, StudentStatusEnum } from '../types/interfaces';

interface KioskClassInfo {
  _id: Types.ObjectId;
  name: string;
  instructor: string;
  categories: StudentCategoryEnum[];
}

interface KioskStudent {
  _id: Types.ObjectId;
  name: string;
  belt_level: string;
  categories: StudentCategoryEnum[];
  active?: boolean;
  status: StudentStatusEnum;
}

interface PopulatedSchedule {
  _id: Types.ObjectId;
  class_id: KioskClassInfo;
  date: Date;
  start_time: string;
  end_time: string;
  status: ClassStatusEnum;
}

interface KioskSessionSource {
  schedule: PopulatedSchedule;
}

export interface KioskIdentity {
  id: string;
  name: string;
}

export interface KioskStudentView {
  id: string;
  name: string;
  beltLevel: string;
  category: StudentCategoryEnum;
  active: boolean;
  attendanceStatus?: AttendanceStatusEnum;
}

export interface KioskSessionView {
  id: string;
  className: string;
  startTime: string;
  endTime: string;
  categories: StudentCategoryEnum[];
  status: ClassStatusEnum;
  instructorName: string;
  students: KioskStudentView[];
  otherStudents: KioskStudentView[];
}

export class KioskAttendanceError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'KioskAttendanceError';
  }
}

const KIOSK_DATE_RANGE_DAYS = 3;

export class KioskAttendanceService {
  async getSessionsForDate(requestedDate?: string): Promise<{ date: string; sessions: KioskSessionView[] }> {
    const { dateKey, start, end } = this.resolveDateRange(requestedDate);
    const sources = await this.getSessionSources(start, end);
    const attendanceBySessionAndStudent = await this.getAttendanceStatuses(sources, start, end);
    const instructorsBySchedule = await this.getInstructorsBySchedule(sources, start, end);
    const allStudents = await this.getStudents();

    const sessions = sources.map(({ schedule }) => {
      const scheduleId = schedule._id.toString();
      const students = allStudents.filter((student) => this.isInClassCategories(student, schedule.class_id.categories));
      const otherStudents = allStudents.filter((student) => !this.isInClassCategories(student, schedule.class_id.categories));
      // Use saved instructor name from attendance if available, otherwise use class default
      const savedInstructor = instructorsBySchedule.get(scheduleId);
      const instructorName = savedInstructor || schedule.class_id.instructor;
      return {
        id: scheduleId,
        className: schedule.class_id.name,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        categories: schedule.class_id.categories,
        status: schedule.status,
        instructorName,
        students: students.map((student) => this.toStudentView(
          student,
          schedule.class_id.categories,
          attendanceBySessionAndStudent.get(`${scheduleId}:${student._id.toString()}`)
        )),
        otherStudents: otherStudents.map((student) => this.toStudentView(
          student,
          undefined,
          attendanceBySessionAndStudent.get(`${scheduleId}:${student._id.toString()}`)
        )),
      };
    });

    return {
      date: dateKey,
      sessions: sessions.sort((left, right) => left.startTime.localeCompare(right.startTime)),
    };
  }

  async finalizeSession(
    scheduleId: string,
    presentStudentIds: string[],
    kiosk: KioskIdentity,
    requestedDate?: string,
    instructorName?: string
  ): Promise<{ presentCount: number; absentCount: number }> {
    if (!Types.ObjectId.isValid(scheduleId)) {
      throw new KioskAttendanceError(400, 'Invalid class schedule ID');
    }
    if (presentStudentIds.some((studentId) => !Types.ObjectId.isValid(studentId))) {
      throw new KioskAttendanceError(400, 'Invalid student ID');
    }

    const { start, end } = this.resolveDateRange(requestedDate);
    const sources = await this.getSessionSources(start, end);
    const source = sources.find(({ schedule }) => schedule._id.toString() === scheduleId);
    if (!source) {
      throw new KioskAttendanceError(404, 'No active session found for this schedule on the selected date');
    }

    const allStudents = await this.getStudents();
    const students = allStudents.filter((student) => this.isInClassCategories(student, source.schedule.class_id.categories));
    const activeStudents = students.filter((student) => this.isActiveStudent(student));
    const knownStudentIds = new Set(allStudents.map((student) => student._id.toString()));
    const requestedPresentIds = new Set(presentStudentIds);
    if ([...requestedPresentIds].some((studentId) => !knownStudentIds.has(studentId))) {
      throw new KioskAttendanceError(400, 'A selected student does not exist');
    }

    const additionalPresentStudents = allStudents.filter((student) =>
      requestedPresentIds.has(student._id.toString()) && !activeStudents.some((activeStudent) => activeStudent._id.equals(student._id))
    );
    const studentsToRecord = [...activeStudents, ...additionalPresentStudents];
    const operations = studentsToRecord.map((student) => {
      const category = this.categoryForStudent(student, source.schedule.class_id.categories);
      const status = requestedPresentIds.has(student._id.toString())
        ? AttendanceStatusEnum.PRESENT
        : AttendanceStatusEnum.ABSENT;
      return {
        updateOne: {
          filter: {
            student_id: student._id,
            class_schedule_id: source.schedule._id,
          },
          update: {
            $set: {
              student_id: student._id,
              class_schedule_id: source.schedule._id,
              date: start,
              category,
              status,
              notes: '',
              recorded_by: `kiosk:${kiosk.name}`,
              recorded_at: new Date(),
              ...(instructorName && { instructor: instructorName }),
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);
    }

    // Note: The completeSession call updates the schedule status separately.
    // This is a two-step operation without transactional protection. If completeSession fails
    // after attendance is recorded, the schedule won't be marked as COMPLETED. Consider using
    // MongoDB transactions if this becomes critical, but for now this is acceptable since:
    // 1. The core attendance data is persisted
    // 2. The schedule can be manually completed via the calendar interface
    // 3. A missed status update doesn't prevent future attendance recording
    try {
      await this.completeSession(source);
    } catch (error) {
      console.warn('Failed to mark schedule as completed, but attendance was recorded:', error);
      // Re-throw to inform the caller, but attendance data is safe
      throw error;
    }

    return {
      presentCount: requestedPresentIds.size,
      absentCount: activeStudents.filter((student) => !requestedPresentIds.has(student._id.toString())).length,
    };
  }

  private todayKey(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Validates the requested date (if any) is a real calendar date within the allowed
  // +/- window from today, then builds the UTC start/end range used to query schedules.
  private resolveDateRange(requestedDate?: string): { dateKey: string; start: Date; end: Date } {
    const todayKey = this.todayKey();
    if (!requestedDate) {
      return this.dateRangeFor(todayKey);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      throw new KioskAttendanceError(400, 'Invalid date format, expected YYYY-MM-DD');
    }

    const [reqYear, reqMonth, reqDay] = requestedDate.split('-').map(Number);
    const requested = new Date(reqYear, reqMonth - 1, reqDay);
    if (Number.isNaN(requested.getTime())) {
      throw new KioskAttendanceError(400, 'Invalid date');
    }

    const [todayYear, todayMonth, todayDay] = todayKey.split('-').map(Number);
    const today = new Date(todayYear, todayMonth - 1, todayDay);

    const diffDays = Math.round((requested.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < -KIOSK_DATE_RANGE_DAYS || diffDays > KIOSK_DATE_RANGE_DAYS) {
      throw new KioskAttendanceError(400, `Date must be within ${KIOSK_DATE_RANGE_DAYS} days of today`);
    }

    return this.dateRangeFor(requestedDate);
  }

  private dateRangeFor(dateKey: string): { dateKey: string; start: Date; end: Date } {
    const [year, month, day] = dateKey.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    return { dateKey, start, end };
  }

  private async getSessionSources(start: Date, end: Date): Promise<KioskSessionSource[]> {
    const schedules = await ClassScheduleModel.find({
      date: { $gte: start, $lt: end },
      status: { $ne: ClassStatusEnum.CANCELLED },
    }).populate<{ class_id: KioskClassInfo }>('class_id', 'name instructor categories').lean<PopulatedSchedule[]>();

    return schedules.map((schedule) => ({ schedule }));
  }

  private async getStudents(): Promise<KioskStudent[]> {
    return StudentModel.find({})
      .select('name belt_level categories active status')
      .sort({ name: 1 })
      .lean<KioskStudent[]>();
  }

  private async getInstructorsBySchedule(
    sources: KioskSessionSource[],
    start: Date,
    end: Date
  ): Promise<Map<string, string>> {
    const scheduleIds = sources.map(({ schedule }) => schedule._id);
    if (scheduleIds.length === 0) {
      return new Map();
    }

    // Get the most recent instructor name for each schedule
    const attendance = await Attendance.find({
      class_schedule_id: { $in: scheduleIds },
      date: { $gte: start, $lte: end },
      instructor: { $exists: true, $ne: null },
    }).select('class_schedule_id instructor recorded_at').sort({ recorded_at: -1 }).lean();

    const instructorMap = new Map<string, string>();
    // Build map with most recent instructor per schedule (results are sorted by recorded_at desc)
    attendance.forEach((entry) => {
      const scheduleId = entry.class_schedule_id.toString();
      // Only set if not already set (we iterate in descending order by recorded_at)
      if (!instructorMap.has(scheduleId) && entry.instructor) {
        instructorMap.set(scheduleId, entry.instructor);
      }
    });

    return instructorMap;
  }

  private async getAttendanceStatuses(
    sources: KioskSessionSource[],
    start: Date,
    end: Date
  ): Promise<Map<string, AttendanceStatusEnum>> {
    const scheduleIds = sources.map(({ schedule }) => schedule._id);
    if (scheduleIds.length === 0) {
      return new Map();
    }

    const attendance = await Attendance.find({
      class_schedule_id: { $in: scheduleIds },
      date: { $gte: start, $lte: end },
    }).select('class_schedule_id student_id status').lean();

    return new Map(attendance.map((entry) => [
      `${entry.class_schedule_id.toString()}:${entry.student_id.toString()}`,
      entry.status,
    ]));
  }

  private async completeSession(source: KioskSessionSource): Promise<void> {
    const schedule = await ClassScheduleModel.findById(source.schedule._id);
    if (!schedule) {
      throw new KioskAttendanceError(404, 'Class schedule no longer exists');
    }
    schedule.status = ClassStatusEnum.COMPLETED;
    await schedule.save();
  }

  private isActiveStudent(student: KioskStudent): boolean {
    return student.active !== false && student.status === StudentStatusEnum.ACTIVE;
  }

  private isInClassCategories(student: KioskStudent, classCategories: StudentCategoryEnum[]): boolean {
    return student.categories.some((category) => classCategories.includes(category));
  }

  private categoryForStudent(student: KioskStudent, classCategories?: StudentCategoryEnum[]): StudentCategoryEnum {
    const category = classCategories?.find((candidate) => student.categories.includes(candidate)) ?? student.categories[0];
    if (!category) {
      throw new KioskAttendanceError(400, `Student ${student._id.toString()} has no category`);
    }
    return category;
  }

  private toStudentView(
    student: KioskStudent,
    classCategories: StudentCategoryEnum[] | undefined,
    attendanceStatus?: AttendanceStatusEnum
  ): KioskStudentView {
    return {
      id: student._id.toString(),
      name: student.name,
      beltLevel: student.belt_level,
      category: this.categoryForStudent(student, classCategories),
      active: this.isActiveStudent(student),
      attendanceStatus,
    };
  }

}
