export const REPORT_TIMEZONE = 'Europe/Stockholm' as const;

export interface RawAttendanceReportQuery {
  from: string; // YYYY-MM-DD (Stockholm)
  to: string; // YYYY-MM-DD (Stockholm)
  search?: string;
  page?: number;
  pageSize?: number;

  sortBy?:
    | 'date'
    | 'start_time'
    | 'end_time'
    | 'student_name'
    | 'class_name'
    | 'instructor'
    | 'status'
    | 'category'
    | 'notes'
    | 'recorded_by'
    | 'recorded_at';
  sortDir?: 'asc' | 'desc';

  onlyActiveStudents?: boolean;

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
  search?: string;
  groupBy: AggregatedAttendanceGroupBy;
  page?: number;
  pageSize?: number;

  sortBy?:
    | 'date'
    | 'start_time'
    | 'end_time'
    | 'student_name'
    | 'class_name'
    | 'instructor'
    | 'presentCount'
    | 'totalCount';
  sortDir?: 'asc' | 'desc';

  onlyActiveStudents?: boolean;

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
