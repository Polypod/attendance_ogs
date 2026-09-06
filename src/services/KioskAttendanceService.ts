import moment from 'moment-timezone';
import { Types } from 'mongoose';
import { AttendanceModel } from '../models/Attendance';
import { ClassScheduleModel } from '../models/ClassSchedule';
import { StudentModel } from '../models/Student';
import { AttendanceStatusEnum, ClassStatusEnum, ClassScheduleSession, StudentCategoryEnum, StudentStatusEnum } from '../types/interfaces';

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
  recurring: boolean;
  days_of_week?: number[];
  status: ClassStatusEnum;
  sessions?: ClassScheduleSession[];
}

interface KioskSessionSource {
  schedule: PopulatedSchedule;
  sessionDate: Date;
  status: ClassStatusEnum;
  instructorName: string;
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

export class KioskAttendanceService {
  private readonly timeZone = process.env.APP_TIMEZONE || 'Europe/Stockholm';

  async getTodaySessions(): Promise<{ date: string; sessions: KioskSessionView[] }> {
    const { dateKey, start, end } = this.todayRange();
    const sources = await this.getSessionSources(start, end, dateKey);
    const attendanceBySessionAndStudent = await this.getAttendanceStatuses(sources, start, end);

    const sessions = await Promise.all(sources.map(async ({ schedule, status, instructorName }) => {
      const allStudents = await this.getStudents();
      const scheduleId = schedule._id.toString();
      const students = allStudents.filter((student) => this.isInClassCategories(student, schedule.class_id.categories));
      const otherStudents = allStudents.filter((student) => !this.isInClassCategories(student, schedule.class_id.categories));
      return {
        id: scheduleId,
        className: schedule.class_id.name,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        categories: schedule.class_id.categories,
        status,
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
    }));

    return {
      date: dateKey,
      sessions: sessions.sort((left, right) => left.startTime.localeCompare(right.startTime)),
    };
  }

  async finalizeSession(
    scheduleId: string,
    presentStudentIds: string[],
    kiosk: KioskIdentity,
    instructorName?: string
  ): Promise<{ presentCount: number; absentCount: number }> {
    if (!Types.ObjectId.isValid(scheduleId)) {
      throw new KioskAttendanceError(400, 'Invalid class schedule ID');
    }
    if (presentStudentIds.some((studentId) => !Types.ObjectId.isValid(studentId))) {
      throw new KioskAttendanceError(400, 'Invalid student ID');
    }

    const { dateKey, start, end } = this.todayRange();
    const sources = await this.getSessionSources(start, end, dateKey);
    const source = sources.find(({ schedule }) => schedule._id.toString() === scheduleId);
    if (!source) {
      throw new KioskAttendanceError(404, 'No active session found for this schedule today');
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
            date: { $gte: start, $lte: end },
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
            },
          },
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await AttendanceModel.bulkWrite(operations);
    }
    await this.completeSession(source, dateKey, instructorName);

    return {
      presentCount: requestedPresentIds.size,
      absentCount: activeStudents.filter((student) => !requestedPresentIds.has(student._id.toString())).length,
    };
  }

  private todayRange(): { dateKey: string; start: Date; end: Date } {
    const now = moment.tz(this.timeZone);
    return {
      dateKey: now.format('YYYY-MM-DD'),
      start: now.clone().startOf('day').toDate(),
      end: now.clone().endOf('day').toDate(),
    };
  }

  private async getSessionSources(start: Date, end: Date, dateKey: string): Promise<KioskSessionSource[]> {
    const [oneOffSchedules, recurringSchedules] = await Promise.all([
      ClassScheduleModel.find({
        recurring: { $ne: true },
        date: { $gte: start, $lte: end },
        status: { $ne: ClassStatusEnum.CANCELLED },
      }).populate<{ class_id: KioskClassInfo }>('class_id', 'name instructor categories').lean<PopulatedSchedule[]>(),
      ClassScheduleModel.find({
        recurring: true,
        date: { $lte: end },
        $or: [
          { recurrence_end_date: { $exists: false } },
          { recurrence_end_date: null },
          { recurrence_end_date: { $gte: start } },
        ],
      }).populate<{ class_id: KioskClassInfo }>('class_id', 'name instructor categories').lean<PopulatedSchedule[]>(),
    ]);

    const directSources: KioskSessionSource[] = oneOffSchedules
      .map((schedule) => {
        return {
          schedule,
          sessionDate: start,
          status: schedule.status,
          instructorName: schedule.class_id.instructor,
        };
      });

    const todayDayOfWeek = moment.tz(dateKey, 'YYYY-MM-DD', this.timeZone).day();
    const recurringSources = recurringSchedules
      .filter((schedule) => schedule.days_of_week?.includes(todayDayOfWeek) ?? false)
      .map((schedule) => {
        const session = schedule.sessions?.find((entry) => this.dateKeyFor(entry.date) === dateKey);
        return {
          schedule,
          sessionDate: start,
          status: session?.status ?? ClassStatusEnum.SCHEDULED,
          instructorName: schedule.class_id.instructor,
        };
      })
      .filter(({ status }) => status !== ClassStatusEnum.CANCELLED);

    return [...directSources, ...recurringSources];
  }

  private async getStudents(): Promise<KioskStudent[]> {
    return StudentModel.find({})
      .select('name belt_level categories active status')
      .sort({ name: 1 })
      .lean<KioskStudent[]>();
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

    const attendance = await AttendanceModel.find({
      class_schedule_id: { $in: scheduleIds },
      date: { $gte: start, $lte: end },
    }).select('class_schedule_id student_id status').lean();

    return new Map(attendance.map((entry) => [
      `${entry.class_schedule_id.toString()}:${entry.student_id.toString()}`,
      entry.status,
    ]));
  }

  private async completeSession(source: KioskSessionSource, dateKey: string, instructorName?: string): Promise<void> {
    const schedule = await ClassScheduleModel.findById(source.schedule._id);
    if (!schedule) {
      throw new KioskAttendanceError(404, 'Class schedule no longer exists');
    }

    const resolvedInstructorName = instructorName?.trim() || source.instructorName;
    const existingSession = schedule.sessions?.find((entry) => this.dateKeyFor(entry.date) === dateKey);
    if (existingSession) {
      existingSession.status = ClassStatusEnum.COMPLETED;
      existingSession['S-instructor'] = resolvedInstructorName;
    } else {
      schedule.sessions = [
        ...(schedule.sessions ?? []),
        {
          date: source.sessionDate,
          status: ClassStatusEnum.COMPLETED,
          notes: '',
          'S-instructor': resolvedInstructorName,
        },
      ];
    }

    if (!schedule.recurring) {
      schedule.status = ClassStatusEnum.COMPLETED;
    }

    await schedule.save();
  }

  private dateKeyFor(date: Date): string {
    return moment(date).tz(this.timeZone).format('YYYY-MM-DD');
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
