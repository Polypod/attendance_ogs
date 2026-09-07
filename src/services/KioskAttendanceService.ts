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

export class KioskAttendanceService {
  async getTodaySessions(): Promise<{ date: string; sessions: KioskSessionView[] }> {
    const { dateKey, start, end } = this.todayRange();
    const sources = await this.getSessionSources(start, end);
    const attendanceBySessionAndStudent = await this.getAttendanceStatuses(sources, start, end);
    const allStudents = await this.getStudents();

    const sessions = sources.map(({ schedule }) => {
      const scheduleId = schedule._id.toString();
      const students = allStudents.filter((student) => this.isInClassCategories(student, schedule.class_id.categories));
      const otherStudents = allStudents.filter((student) => !this.isInClassCategories(student, schedule.class_id.categories));
      return {
        id: scheduleId,
        className: schedule.class_id.name,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        categories: schedule.class_id.categories,
        status: schedule.status,
        instructorName: schedule.class_id.instructor,
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
    instructorName?: string
  ): Promise<{ presentCount: number; absentCount: number }> {
    if (!Types.ObjectId.isValid(scheduleId)) {
      throw new KioskAttendanceError(400, 'Invalid class schedule ID');
    }
    if (presentStudentIds.some((studentId) => !Types.ObjectId.isValid(studentId))) {
      throw new KioskAttendanceError(400, 'Invalid student ID');
    }

    const { dateKey, start, end } = this.todayRange();
    const sources = await this.getSessionSources(start, end);
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
      await Attendance.bulkWrite(operations);
    }
    await this.completeSession(source, instructorName);

    return {
      presentCount: requestedPresentIds.size,
      absentCount: activeStudents.filter((student) => !requestedPresentIds.has(student._id.toString())).length,
    };
  }

  private todayRange(): { dateKey: string; start: Date; end: Date } {
    // Match the calendar frontend's date calculation to ensure consistent timezone handling.
    // The frontend uses: new Date().toISOString().slice(0, 10)
    // This ensures both calendar and kiosk see the same "today" date.
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);  // "YYYY-MM-DD" in UTC
    
    // Create start/end dates using the same dateKey that calendar sends
    const start = new Date(dateKey);  // Midnight UTC on that date
    const end = new Date(dateKey);
    end.setDate(end.getDate() + 1);   // Next day, then subtract 1ms in query
    
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

  private async completeSession(source: KioskSessionSource, _instructorName?: string): Promise<void> {
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
