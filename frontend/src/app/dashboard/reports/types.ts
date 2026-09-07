export type Student = {
  _id: string;
  name: string;
  active?: boolean;
  status?: string;
};

export type Schedule = {
  _id: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  class_id?: {
    _id: string;
    name: string;
    instructor?: string;
  };
  _isRecurringInstance?: boolean;
  _originalScheduleId?: string;
};

export type RawAttendanceRow = {
  attendance_id: string;
  date: string;
  status: string;
  category: string;
  notes: string;
  recorded_by: string;
  recorded_at: string;
  student_id: string;
  student_name: string;
  class_schedule_id: string;
  start_time: string;
  end_time: string;
  class_id: string;
  class_name: string;
  instructor: string;
};

export type RawAttendanceReportResult = {
  rows: RawAttendanceRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AggregatedGroupBy = 'student' | 'instructor' | 'session' | 'class';

export type AggregatedAttendanceRow = {
  presentCount: number;
  totalCount: number;

  student_id?: string;
  student_name?: string;

  instructor?: string;

  class_schedule_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;

  class_id?: string;
  class_name?: string;
};

export type AggregatedAttendanceReportResult = {
  rows: AggregatedAttendanceRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ViewMode = 'raw' | 'aggregate';

export type ReportPresetSessionFilter = {
  classScheduleId: string;
  date: string; // YYYY-MM-DD
};

export type SortDir = 'asc' | 'desc';

export type ColumnKey =
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
  | 'recorded_at'
  | 'presentCount'
  | 'totalCount';

export type SortKey = ColumnKey;

export type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  sortable: boolean;
  width?: string;
};

export type ReportPresetState = {
  mode: ViewMode;
  groupBy?: AggregatedGroupBy;

  from: string;
  to: string;

  search?: string;

  pageSize?: number;

  sortBy?: SortKey;
  sortDir?: SortDir;

  studentIds?: string[];
  classIds?: string[];
  instructors?: string[];
  status?: string[];
  sessions?: ReportPresetSessionFilter[];
  onlyActiveStudents?: boolean;

  rawColumnVisibility?: Record<string, boolean>;
  aggregatedColumnVisibility?: Record<string, boolean>;
};

export type ReportPreset = {
  _id: string;
  name: string;
  shared: boolean;
  schemaVersion: number;
  state: ReportPresetState;
};

export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'] as const;
