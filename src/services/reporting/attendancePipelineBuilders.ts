import moment from 'moment-timezone';
import { PipelineStage, Types } from 'mongoose';
import { ValidationError, validateDateRange } from '@/utils/validators';
import {
  AggregatedAttendanceGroupBy,
  AggregatedAttendanceReportQuery,
  RawAttendanceReportQuery,
  REPORT_TIMEZONE
} from './reportTypes';

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parseReportDateRange = (from: string, to: string) => {
  const startDate = moment.tz(from, 'YYYY-MM-DD', REPORT_TIMEZONE).startOf('day').toDate();
  const endDate = moment.tz(to, 'YYYY-MM-DD', REPORT_TIMEZONE).endOf('day').toDate();
  validateDateRange(startDate, endDate, 'report date range');
  return { startDate, endDate };
};

const buildAttendanceBaseMatch = (query: RawAttendanceReportQuery | AggregatedAttendanceReportQuery) => {
  const { startDate, endDate } = parseReportDateRange(query.from, query.to);

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

  return match;
};

export const buildAttendanceLookupPipeline = (
  query: RawAttendanceReportQuery | AggregatedAttendanceReportQuery
): PipelineStage[] => {
  const match = buildAttendanceBaseMatch(query);

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

  if (query.onlyActiveStudents) {
    postLookupMatch['student.active'] = { $ne: false };
    postLookupMatch['student.status'] = { $ne: 'inactive' };
  }

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

  const searchValue = query.search?.trim();
  const postLookupAnd: Record<string, any>[] = [];
  if (Object.keys(postLookupMatch).length > 0) {
    postLookupAnd.push(postLookupMatch);
  }
  if (searchValue) {
    const escaped = escapeRegExp(searchValue);
    postLookupAnd.push({
      $or: [
        { 'student.name': { $regex: escaped, $options: 'i' } },
        { 'class.name': { $regex: escaped, $options: 'i' } },
        { 'class.instructor': { $regex: escaped, $options: 'i' } }
      ]
    });
  }

  if (postLookupAnd.length === 1) {
    pipeline.push({ $match: postLookupAnd[0] });
  } else if (postLookupAnd.length > 1) {
    pipeline.push({ $match: { $and: postLookupAnd } });
  }

  return pipeline;
};

export const appendRawSortStages = (pipeline: PipelineStage[], query: RawAttendanceReportQuery) => {
  const rawSortFieldMap: Record<NonNullable<RawAttendanceReportQuery['sortBy']>, string> = {
    date: 'date',
    start_time: 'schedule.start_time',
    end_time: 'schedule.end_time',
    student_name: 'student.name',
    class_name: 'class.name',
    instructor: 'class.instructor',
    status: 'status',
    category: 'category',
    notes: 'notes',
    recorded_by: 'recorded_by',
    recorded_at: 'recorded_at'
  };

  const rawStringSortKeys = new Set<NonNullable<RawAttendanceReportQuery['sortBy']>>([
    'start_time',
    'end_time',
    'student_name',
    'class_name',
    'instructor',
    'status',
    'category',
    'notes',
    'recorded_by'
  ]);

  const sortDir = query.sortDir === 'desc' ? -1 : 1;
  if (query.sortBy) {
    const mappedField = rawSortFieldMap[query.sortBy];
    if (!mappedField) {
      throw new ValidationError(`Unsupported sortBy for raw report: ${query.sortBy}`);
    }

    if (rawStringSortKeys.has(query.sortBy)) {
      const sortValueExpr = `$${mappedField}`;
      pipeline.push({
        $addFields: {
          __sortEmpty: {
            $cond: [{ $or: [{ $eq: [sortValueExpr, null] }, { $eq: [sortValueExpr, ''] }] }, 1, 0]
          }
        }
      });
      pipeline.push({ $sort: { __sortEmpty: 1, [mappedField]: sortDir, _id: -1 } });
    } else {
      pipeline.push({ $sort: { [mappedField]: sortDir, _id: -1 } });
    }
  } else {
    pipeline.push({ $sort: { date: -1, _id: -1 } });
  }
};

export const appendAggregatedGroupStages = (pipeline: PipelineStage[], groupBy: AggregatedAttendanceGroupBy) => {
  const presentStatuses = ['present', 'late'];
  const commonSums = {
    presentCount: {
      $sum: {
        $cond: [{ $in: ['$status', presentStatuses] }, 1, 0]
      }
    },
    totalCount: { $sum: 1 }
  };

  if (groupBy === 'student') {
    pipeline.push({
      $group: {
        _id: '$student._id',
        student_id: { $first: '$student._id' },
        student_name: { $first: '$student.name' },
        ...commonSums
      }
    });
  } else if (groupBy === 'instructor') {
    pipeline.push({
      $group: {
        _id: '$class.instructor',
        instructor: { $first: '$class.instructor' },
        ...commonSums
      }
    });
  } else if (groupBy === 'session') {
    pipeline.push({
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
    });
  } else if (groupBy === 'class') {
    pipeline.push({
      $group: {
        _id: '$class._id',
        class_id: { $first: '$class._id' },
        class_name: { $first: '$class.name' },
        instructor: { $first: '$class.instructor' },
        ...commonSums
      }
    });
  } else {
    throw new Error(`Unsupported groupBy: ${groupBy}`);
  }
};

export const appendAggregatedSortStages = (pipeline: PipelineStage[], query: AggregatedAttendanceReportQuery) => {
  const groupBy = query.groupBy;
  const aggregatedAllowedSortByByGroup: Record<AggregatedAttendanceGroupBy, Set<NonNullable<AggregatedAttendanceReportQuery['sortBy']>>> = {
    student: new Set(['student_name', 'presentCount', 'totalCount']),
    instructor: new Set(['instructor', 'presentCount', 'totalCount']),
    session: new Set(['date', 'start_time', 'end_time', 'class_name', 'instructor', 'presentCount', 'totalCount']),
    class: new Set(['class_name', 'instructor', 'presentCount', 'totalCount'])
  };

  const aggregatedDefaultSortByGroup: Record<AggregatedAttendanceGroupBy, Record<string, 1 | -1>> = {
    student: { presentCount: -1, totalCount: -1, student_name: 1, _id: 1 },
    instructor: { presentCount: -1, totalCount: -1, instructor: 1, _id: 1 },
    session: { date: -1, start_time: 1, _id: 1 },
    class: { presentCount: -1, totalCount: -1, class_name: 1, _id: 1 }
  };

  const aggregatedSortFieldMap: Record<NonNullable<AggregatedAttendanceReportQuery['sortBy']>, string> = {
    date: 'date',
    start_time: 'start_time',
    end_time: 'end_time',
    student_name: 'student_name',
    class_name: 'class_name',
    instructor: 'instructor',
    presentCount: 'presentCount',
    totalCount: 'totalCount'
  };

  const aggregatedStringSortKeys = new Set<NonNullable<AggregatedAttendanceReportQuery['sortBy']>>([
    'start_time',
    'end_time',
    'student_name',
    'class_name',
    'instructor'
  ]);

  const aggSortDir = query.sortDir === 'desc' ? -1 : 1;
  if (query.sortBy) {
    if (!aggregatedAllowedSortByByGroup[groupBy].has(query.sortBy)) {
      throw new ValidationError(`Unsupported sortBy for aggregated report (groupBy=${groupBy}): ${query.sortBy}`);
    }
    const mappedField = aggregatedSortFieldMap[query.sortBy];

    if (aggregatedStringSortKeys.has(query.sortBy)) {
      const sortValueExpr = `$${mappedField}`;
      pipeline.push({
        $addFields: {
          __sortEmpty: {
            $cond: [{ $or: [{ $eq: [sortValueExpr, null] }, { $eq: [sortValueExpr, ''] }] }, 1, 0]
          }
        }
      });
      pipeline.push({ $sort: { __sortEmpty: 1, [mappedField]: aggSortDir, _id: 1 } });
    } else {
      pipeline.push({ $sort: { [mappedField]: aggSortDir, _id: 1 } });
    }
  } else {
    pipeline.push({ $sort: aggregatedDefaultSortByGroup[groupBy] });
  }
};
