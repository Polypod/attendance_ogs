import { Request, Response } from 'express';
import moment from 'moment-timezone';
import { once } from 'events';
import {
  AggregatedAttendanceReportQuery,
  RawAttendanceReportQuery,
  ReportService
} from '@/services/ReportService';
import { encodeCsvRow } from '@/utils/csv';
import { ValidationError } from '@/utils/validators';

const REPORT_TIMEZONE = 'Europe/Stockholm';

export class ReportController {
  constructor(private reportService: ReportService = new ReportService()) {}

  getRawAttendanceReport = async (req: Request, res: Response) => {
    try {
      const result = await this.reportService.getRawAttendanceReport(req.body);
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to generate raw attendance report',
        error: message
      });
    }
  };

  getAggregatedAttendanceReport = async (req: Request, res: Response) => {
    try {
      const result = await this.reportService.getAggregatedAttendanceReport(req.body);
      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ success: false, message: error.message });
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        success: false,
        message: 'Failed to generate aggregated attendance report',
        error: message
      });
    }
  };

  getRawAttendanceReportExportCsv = async (req: Request, res: Response) => {
    try {
      const body = req.body as RawAttendanceReportQuery & { columns: string[] };
      const { columns, ...query } = body;
      const cursor = await this.reportService.getRawAttendanceExportCursor(query);

      const filename = `attendance-raw-${body.from}-${body.to}.csv`;
      res.status(200);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const headerLabels: Record<string, string> = {
        date: 'Date',
        start_time: 'Start',
        end_time: 'End',
        student_name: 'Student',
        class_name: 'Class',
        instructor: 'Instructor',
        status: 'Status',
        category: 'Category',
        notes: 'Notes',
        recorded_by: 'Recorded By',
        recorded_at: 'Recorded At'
      };

      let aborted = false;
      req.on('close', () => {
        aborted = true;
      });

      const writeLine = async (line: string) => {
        if (aborted || res.writableEnded) return;
        if (!res.write(`${line}\n`)) {
          await once(res, 'drain');
        }
      };

      await writeLine(encodeCsvRow(columns.map((c) => headerLabels[c] ?? c)));

      for await (const row of cursor as any) {
        if (aborted || res.writableEnded) break;

        const values = columns.map((col) => {
          switch (col) {
            case 'date':
              return row.date ? moment.tz(row.date, REPORT_TIMEZONE).format('YYYY-MM-DD') : '';
            case 'recorded_at':
              return row.recorded_at
                ? moment.tz(row.recorded_at, REPORT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
                : '';
            default:
              return row[col] ?? '';
          }
        });

        await writeLine(encodeCsvRow(values));
      }

      if (typeof (cursor as any)?.close === 'function') {
        await (cursor as any).close();
      }

      return res.end();
    } catch (error) {
      if (error instanceof ValidationError) {
        if (!res.headersSent) {
          return res.status(400).json({ success: false, message: error.message });
        }
        return res.end();
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Failed to export raw attendance report',
          error: message
        });
      }

      return res.end();
    }
  };

  getAggregatedAttendanceReportExportCsv = async (req: Request, res: Response) => {
    try {
      const body = req.body as AggregatedAttendanceReportQuery & { columns: string[] };
      const { columns, ...query } = body;
      const cursor = await this.reportService.getAggregatedAttendanceExportCursor(query);

      const filename = `attendance-aggregate-${body.groupBy}-${body.from}-${body.to}.csv`;
      res.status(200);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const headerLabels: Record<string, string> = {
        date: 'Date',
        start_time: 'Start',
        end_time: 'End',
        student_name: 'Student',
        class_name: 'Class',
        instructor: 'Instructor',
        presentCount: 'Present',
        totalCount: 'Total'
      };

      let aborted = false;
      req.on('close', () => {
        aborted = true;
      });

      const writeLine = async (line: string) => {
        if (aborted || res.writableEnded) return;
        if (!res.write(`${line}\n`)) {
          await once(res, 'drain');
        }
      };

      await writeLine(encodeCsvRow(columns.map((c) => headerLabels[c] ?? c)));

      for await (const row of cursor as any) {
        if (aborted || res.writableEnded) break;

        const values = columns.map((col) => {
          switch (col) {
            case 'date':
              return row.date ? moment.tz(row.date, REPORT_TIMEZONE).format('YYYY-MM-DD') : '';
            default:
              return row[col] ?? '';
          }
        });

        await writeLine(encodeCsvRow(values));
      }

      if (typeof (cursor as any)?.close === 'function') {
        await (cursor as any).close();
      }

      return res.end();
    } catch (error) {
      if (error instanceof ValidationError) {
        if (!res.headersSent) {
          return res.status(400).json({ success: false, message: error.message });
        }
        return res.end();
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Failed to export aggregated attendance report',
          error: message
        });
      }

      return res.end();
    }
  };
}

export const reportController = new ReportController();
