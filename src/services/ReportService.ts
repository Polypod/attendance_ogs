import moment from 'moment-timezone';
import { PipelineStage, Types } from 'mongoose';
import { AttendanceModel } from '@/models/Attendance';
import { validateDateRange } from '@/utils/validators';

const REPORT_TIMEZONE = 'Europe/Stockholm';

export interface RawAttendanceReportQuery {
  from: string; // YYYY-MM-DD (Stockholm)
  to: string; // YYYY-MM-DD (Stockholm)
  page?: number;
  pageSize?: number;

  studentId?: string;
  studentIds?: string[];
  studentName?: string;
  classScheduleId?: string;
  classScheduleIds?: string[];
  sessions?: Array<{ classScheduleId: string; date: string }>;
  classIds?: string[];
  instructor?: string;
  instructors?: string[];
  status?: string[];
}

export type AggregatedAttendanceGroupBy = 'student' | 'instructor' | 'session' | 'class';

export interface AggregatedAttendanceReportQuery {
  from: string; // YYYY-MM-DD (Stockholm)
  to: string; // YYYY-MM-DD (Stockholm)
  groupBy: AggregatedAttendanceGroupBy;
  page?: number;
  pageSize?: number;

  studentId?: string;
  studentIds?: string[];
  studentName?: string;
  classScheduleId?: string;
  classScheduleIds?: string[];
  sessions?: Array<{ classScheduleId: string; date: string }>;
  classIds?: string[];
  instructor?: string;
  instructors?: string[];
  status?: string[];
}

export interface AggregatedAttendanceReportRow {
  presentCount: number;
  totalCount: number;

  student_id?: string;
  student_name?: string;

  instructor?: string;

  class_schedule_id?: string;
  date?: Date;
  start_time?: string;
  end_time?: string;

  class_id?: string;
  class_name?: string;
}

export interface AggregatedAttendanceReportResult {
  rows: AggregatedAttendanceReportRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface RawAttendanceReportRow {
  attendance_id: string;
  date: Date;
  status: string;
  category: string;
  notes: string;
  recorded_by: string;
  recorded_at: Date;

  student_id: string;
  student_name: string;

  class_schedule_id: string;
  start_time: string;
  end_time: string;

  class_id: string;
  class_name: string;
  instructor: string;
}

export interface RawAttendanceReportResult {
  rows: RawAttendanceReportRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export class ReportService {
  async getRawAttendanceReport(query: RawAttendanceReportQuery): Promise<RawAttendanceReportResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const startDate = moment.tz(query.from, 'YYYY-MM-DD', REPORT_TIMEZONE).startOf('day').toDate();
    const endDate = moment.tz(query.to, 'YYYY-MM-DD', REPORT_TIMEZONE).endOf('day').toDate();
    validateDateRange(startDate, endDate, 'report date range');

    const match: Record<string, any> = {
      date: { $gte: startDate, $lte: endDate }
    };

    const studentIds = [
      ...(query.studentIds ?? []).filter((v) => typeof v === 'string' && v.length > 0),
      ...(query.studentId ? [query.studentId] : [])
    ];
    const uniqueStudentIds = Array.from(new Set(studentIds));
    if (uniqueStudentIds.length > 0) {
      match.student_id = {
        $in: uniqueStudentIds.map((id) => new Types.ObjectId(id))
      };
    }

    if (query.sessions?.length) {
      match.$or = query.sessions.map((s) => {
        const sessionStart = moment.tz(s.date, 'YYYY-MM-DD', REPORT_TIMEZONE).startOf('day').toDate();
        const sessionEnd = moment.tz(s.date, 'YYYY-MM-DD', REPORT_TIMEZONE).endOf('day').toDate();

        return {
          class_schedule_id: new Types.ObjectId(s.classScheduleId),
          date: { $gte: sessionStart, $lte: sessionEnd }
        };
      });
    } else {
      const scheduleIds = [
        ...(query.classScheduleIds ?? []).filter((v) => typeof v === 'string' && v.length > 0),
        ...(query.classScheduleId ? [query.classScheduleId] : [])
      ];
      const uniqueScheduleIds = Array.from(new Set(scheduleIds));
      if (uniqueScheduleIds.length > 0) {
        match.class_schedule_id = {
          $in: uniqueScheduleIds.map((id) => new Types.ObjectId(id))
        };
      }
    }

    if (query.status?.length) {
      match.status = { $in: query.status };
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'classschedules',
          localField: 'class_schedule_id',
          foreignField: '_id',
          as: 'schedule'
        }
      },
      { $unwind: '$schedule' },
      {
        $lookup: {
          from: 'classes',
          localField: 'schedule.class_id',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: '$class' }
    ];

    const postLookupMatch: Record<string, any> = {};

    const instructors = [
      ...(query.instructors ?? []).filter((v) => typeof v === 'string' && v.trim().length > 0),
      ...(query.instructor ? [query.instructor] : [])
    ];
    const uniqueInstructors = Array.from(new Set(instructors.map((v) => v.trim()))).filter((v) => v.length > 0);
    if (uniqueInstructors.length === 1) {
      postLookupMatch['class.instructor'] = uniqueInstructors[0];
    } else if (uniqueInstructors.length > 1) {
      postLookupMatch['class.instructor'] = { $in: uniqueInstructors };
    }

    if (query.classIds?.length) {
      const uniqueClassIds = Array.from(new Set(query.classIds));
      postLookupMatch['class._id'] = { $in: uniqueClassIds.map((id) => new Types.ObjectId(id)) };
    }

    if (query.studentName) {
      postLookupMatch['student.name'] = {
        $regex: escapeRegExp(query.studentName),
        $options: 'i'
      };
    }

    if (Object.keys(postLookupMatch).length > 0) {
      pipeline.push({ $match: postLookupMatch });
    }

    pipeline.push(
      { $sort: { date: -1, _id: -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: pageSize },
            {
              $project: {
                attendance_id: { $toString: '$_id' },
                date: '$date',
                status: '$status',
                category: '$category',
                notes: '$notes',
                recorded_by: '$recorded_by',
                recorded_at: '$recorded_at',

                student_id: { $toString: '$student._id' },
                student_name: '$student.name',

                class_schedule_id: { $toString: '$schedule._id' },
                start_time: '$schedule.start_time',
                end_time: '$schedule.end_time',

                class_id: { $toString: '$class._id' },
                class_name: '$class.name',
                instructor: '$class.instructor'
              }
            }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    );

    const result = await AttendanceModel.aggregate(pipeline).allowDiskUse(true);
    const facet = result[0] as { rows: RawAttendanceReportRow[]; totalCount: Array<{ count: number }> } | undefined;

    const total = facet?.totalCount?.[0]?.count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      rows: facet?.rows ?? [],
      page,
      pageSize,
      total,
      totalPages
    };
  }

  async getAggregatedAttendanceReport(query: AggregatedAttendanceReportQuery): Promise<AggregatedAttendanceReportResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const startDate = moment.tz(query.from, 'YYYY-MM-DD', REPORT_TIMEZONE).startOf('day').toDate();
    const endDate = moment.tz(query.to, 'YYYY-MM-DD', REPORT_TIMEZONE).endOf('day').toDate();
    validateDateRange(startDate, endDate, 'report date range');

    const match: Record<string, any> = {
      date: { $gte: startDate, $lte: endDate }
    };

    const studentIds = [
      ...(query.studentIds ?? []).filter((v) => typeof v === 'string' && v.length > 0),
      ...(query.studentId ? [query.studentId] : [])
    ];
    const uniqueStudentIds = Array.from(new Set(studentIds));
    if (uniqueStudentIds.length > 0) {
      match.student_id = {
        $in: uniqueStudentIds.map((id) => new Types.ObjectId(id))
      };
    }

    if (query.sessions?.length) {
      match.$or = query.sessions.map((s) => {
        const sessionStart = moment.tz(s.date, 'YYYY-MM-DD', REPORT_TIMEZONE).startOf('day').toDate();
        const sessionEnd = moment.tz(s.date, 'YYYY-MM-DD', REPORT_TIMEZONE).endOf('day').toDate();

        return {
          class_schedule_id: new Types.ObjectId(s.classScheduleId),
          date: { $gte: sessionStart, $lte: sessionEnd }
        };
      });
    } else {
      const scheduleIds = [
        ...(query.classScheduleIds ?? []).filter((v) => typeof v === 'string' && v.length > 0),
        ...(query.classScheduleId ? [query.classScheduleId] : [])
      ];
      const uniqueScheduleIds = Array.from(new Set(scheduleIds));
      if (uniqueScheduleIds.length > 0) {
        match.class_schedule_id = {
          $in: uniqueScheduleIds.map((id) => new Types.ObjectId(id))
        };
      }
    }

    if (query.status?.length) {
      match.status = { $in: query.status };
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'classschedules',
          localField: 'class_schedule_id',
          foreignField: '_id',
          as: 'schedule'
        }
      },
      { $unwind: '$schedule' },
      {
        $lookup: {
          from: 'classes',
          localField: 'schedule.class_id',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: '$class' }
    ];

    const postLookupMatch: Record<string, any> = {};

    const instructors = [
      ...(query.instructors ?? []).filter((v) => typeof v === 'string' && v.trim().length > 0),
      ...(query.instructor ? [query.instructor] : [])
    ];
    const uniqueInstructors = Array.from(new Set(instructors.map((v) => v.trim()))).filter((v) => v.length > 0);
    if (uniqueInstructors.length === 1) {
      postLookupMatch['class.instructor'] = uniqueInstructors[0];
    } else if (uniqueInstructors.length > 1) {
      postLookupMatch['class.instructor'] = { $in: uniqueInstructors };
    }

    if (query.classIds?.length) {
      const uniqueClassIds = Array.from(new Set(query.classIds));
      postLookupMatch['class._id'] = { $in: uniqueClassIds.map((id) => new Types.ObjectId(id)) };
    }

    if (query.studentName) {
      postLookupMatch['student.name'] = {
        $regex: escapeRegExp(query.studentName),
        $options: 'i'
      };
    }

    if (Object.keys(postLookupMatch).length > 0) {
      pipeline.push({ $match: postLookupMatch });
    }

    const presentStatuses = ['present', 'late'];
    const commonSums = {
      presentCount: {
        $sum: {
          $cond: [{ $in: ['$status', presentStatuses] }, 1, 0]
        }
      },
      totalCount: { $sum: 1 }
    };

    const groupBy = query.groupBy;
    if (groupBy === 'student') {
      pipeline.push(
        {
          $group: {
            _id: '$student._id',
            student_id: { $first: '$student._id' },
            student_name: { $first: '$student.name' },
            ...commonSums
          }
        },
        { $sort: { totalCount: -1, student_name: 1, _id: 1 } }
      );
    } else if (groupBy === 'instructor') {
      pipeline.push(
        {
          $group: {
            _id: '$class.instructor',
            instructor: { $first: '$class.instructor' },
            ...commonSums
          }
        },
        { $sort: { totalCount: -1, instructor: 1, _id: 1 } }
      );
    } else if (groupBy === 'session') {
      pipeline.push(
        {
          $group: {
            _id: '$schedule._id',
            class_schedule_id: { $first: '$schedule._id' },
            date: { $first: '$schedule.date' },
            start_time: { $first: '$schedule.start_time' },
            end_time: { $first: '$schedule.end_time' },
            class_id: { $first: '$class._id' },
            class_name: { $first: '$class.name' },
            instructor: { $first: '$class.instructor' },
            ...commonSums
          }
        },
        { $sort: { date: -1, start_time: 1, _id: 1 } }
      );
    } else if (groupBy === 'class') {
      pipeline.push(
        {
          $group: {
            _id: '$class._id',
            class_id: { $first: '$class._id' },
            class_name: { $first: '$class.name' },
            instructor: { $first: '$class.instructor' },
            ...commonSums
          }
        },
        { $sort: { totalCount: -1, class_name: 1, _id: 1 } }
      );
    } else {
      throw new Error(`Unsupported groupBy: ${groupBy}`);
    }

    pipeline.push({
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              presentCount: 1,
              totalCount: 1,

              student_id: { $cond: [{ $ifNull: ['$student_id', false] }, { $toString: '$student_id' }, '$$REMOVE'] },
              student_name: 1,

              instructor: 1,

              class_schedule_id: { $cond: [{ $ifNull: ['$class_schedule_id', false] }, { $toString: '$class_schedule_id' }, '$$REMOVE'] },
              date: 1,
              start_time: 1,
              end_time: 1,

              class_id: { $cond: [{ $ifNull: ['$class_id', false] }, { $toString: '$class_id' }, '$$REMOVE'] },
              class_name: 1
            }
          }
        ],
        totalCount: [{ $count: 'count' }]
      }
    });

    const result = await AttendanceModel.aggregate(pipeline).allowDiskUse(true);
    const facet = result[0] as { rows: AggregatedAttendanceReportRow[]; totalCount: Array<{ count: number }> } | undefined;

    const total = facet?.totalCount?.[0]?.count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      rows: facet?.rows ?? [],
      page,
      pageSize,
      total,
      totalPages
    };
  }
}
