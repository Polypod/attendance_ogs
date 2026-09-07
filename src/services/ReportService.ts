import { AttendanceModel } from '@/models/Attendance';
import {
  appendAggregatedGroupStages,
  appendAggregatedSortStages,
  appendRawSortStages,
  buildAttendanceLookupPipeline
} from './reporting/attendancePipelineBuilders';
import {
  aggregatedAttendanceRowProjectionStage,
  rawAttendanceRowProjectionStage
} from './reporting/attendanceProjections';
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

    pipeline.push(rawAttendanceRowProjectionStage());

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

    pipeline.push(aggregatedAttendanceRowProjectionStage());

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
          rawAttendanceRowProjectionStage()
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
          aggregatedAttendanceRowProjectionStage()
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
