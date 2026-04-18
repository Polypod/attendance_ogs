import { AttendanceModel } from '@/models/Attendance';
import {
  appendAggregatedGroupStages,
  appendAggregatedSortStages,
  appendRawSortStages,
  buildAttendanceLookupPipeline
} from './reporting/attendancePipelineBuilders';
import type {
  AggregatedAttendanceReportQuery,
  AggregatedAttendanceReportResult,
  AggregatedAttendanceReportRow,
  RawAttendanceReportQuery,
  RawAttendanceReportResult,
  RawAttendanceReportRow
} from './reporting/reportTypes';

export type {
  AggregatedAttendanceGroupBy,
  AggregatedAttendanceReportQuery,
  AggregatedAttendanceReportResult,
  AggregatedAttendanceReportRow,
  RawAttendanceReportQuery,
  RawAttendanceReportResult,
  RawAttendanceReportRow
} from './reporting/reportTypes';

export class ReportService {
  async getRawAttendanceExportCursor(
    query: RawAttendanceReportQuery
  ): Promise<AsyncIterable<RawAttendanceReportRow> & { close?: () => Promise<void> }> {
    const pipeline = buildAttendanceLookupPipeline(query);
    appendRawSortStages(pipeline, query);

    pipeline.push({
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
    });

    return AttendanceModel.aggregate(pipeline)
      .collation({ locale: 'sv', strength: 2 })
      .allowDiskUse(true)
      .cursor({ batchSize: 500 }) as any;
  }

  async getAggregatedAttendanceExportCursor(
    query: AggregatedAttendanceReportQuery
  ): Promise<AsyncIterable<AggregatedAttendanceReportRow> & { close?: () => Promise<void> }> {
    const pipeline = buildAttendanceLookupPipeline(query);
    appendAggregatedGroupStages(pipeline, query.groupBy);
    appendAggregatedSortStages(pipeline, query);

    pipeline.push({
      $project: {
        presentCount: 1,
        totalCount: 1,

        student_id: { $cond: [{ $ifNull: ['$student_id', false] }, { $toString: '$student_id' }, '$$REMOVE'] },
        student_name: 1,

        instructor: 1,

        class_schedule_id: {
          $cond: [{ $ifNull: ['$class_schedule_id', false] }, { $toString: '$class_schedule_id' }, '$$REMOVE']
        },
        date: 1,
        start_time: 1,
        end_time: 1,

        class_id: { $cond: [{ $ifNull: ['$class_id', false] }, { $toString: '$class_id' }, '$$REMOVE'] },
        class_name: 1
      }
    });

    return AttendanceModel.aggregate(pipeline)
      .collation({ locale: 'sv', strength: 2 })
      .allowDiskUse(true)
      .cursor({ batchSize: 500 }) as any;
  }

  async getRawAttendanceReport(query: RawAttendanceReportQuery): Promise<RawAttendanceReportResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const pipeline = buildAttendanceLookupPipeline(query);
    appendRawSortStages(pipeline, query);

    pipeline.push({
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
    });

    const result = await AttendanceModel.aggregate(pipeline)
      .collation({ locale: 'sv', strength: 2 })
      .allowDiskUse(true);
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

    const pipeline = buildAttendanceLookupPipeline(query);
    appendAggregatedGroupStages(pipeline, query.groupBy);
    appendAggregatedSortStages(pipeline, query);

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

    const result = await AttendanceModel.aggregate(pipeline)
      .collation({ locale: 'sv', strength: 2 })
      .allowDiskUse(true);
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
