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
  studentName?: string;
  classScheduleId?: string;
  instructor?: string;
  status?: string[];
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

    if (query.studentId) {
      match.student_id = new Types.ObjectId(query.studentId);
    }

    if (query.classScheduleId) {
      match.class_schedule_id = new Types.ObjectId(query.classScheduleId);
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

    if (query.instructor) {
      postLookupMatch['class.instructor'] = query.instructor;
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
}
