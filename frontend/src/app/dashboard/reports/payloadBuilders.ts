import { sessionKeysToSessions } from "./sessionFilters";
import type { AggregatedGroupBy, SortDir, SortKey, ViewMode } from "./types";

type AttendanceFilterArgs = {
  from: string;
  to: string;
  search: string;
  sortBy: SortKey | null;
  sortDir: SortDir;
  onlyActiveStudents: boolean;
  studentIds: string[];
  selectedSessionKeys: string[];
  classIds: string[];
  instructors: string[];
  status: string[];
};

export function buildAttendanceFiltersPayload({
  from,
  to,
  search,
  sortBy,
  sortDir,
  onlyActiveStudents,
  studentIds,
  selectedSessionKeys,
  classIds,
  instructors,
  status,
}: AttendanceFilterArgs): Record<string, any> {
  const payload: Record<string, any> = {
    from,
    to,
  };

  const trimmedSearch = search.trim();
  if (trimmedSearch) payload.search = trimmedSearch;

  if (sortBy) {
    payload.sortBy = sortBy;
    payload.sortDir = sortDir;
  }

  if (onlyActiveStudents) payload.onlyActiveStudents = true;
  if (studentIds.length > 0) payload.studentIds = studentIds;

  const sessions = sessionKeysToSessions(selectedSessionKeys);
  if (sessions.length > 0) payload.sessions = sessions;

  if (classIds.length > 0) payload.classIds = classIds;
  if (instructors.length > 0) payload.instructors = instructors;
  if (status.length > 0) payload.status = status;

  return payload;
}

export function buildAttendanceReportRequestBody({
  mode,
  groupBy,
  page,
  pageSize,
  ...filters
}: AttendanceFilterArgs & {
  mode: ViewMode;
  groupBy: AggregatedGroupBy;
  page: number;
  pageSize: number;
}): Record<string, any> {
  const body: Record<string, any> = {
    ...buildAttendanceFiltersPayload(filters),
    page,
    pageSize,
  };

  if (mode === "aggregate") {
    body.groupBy = groupBy;
  }

  return body;
}

export function buildAttendanceExportPayload({
  mode,
  groupBy,
  columns,
  ...filters
}: AttendanceFilterArgs & {
  mode: ViewMode;
  groupBy: AggregatedGroupBy;
  columns: string[];
}): Record<string, any> {
  const payload: Record<string, any> = {
    ...buildAttendanceFiltersPayload(filters),
    mode,
    columns,
  };

  if (mode === "aggregate") {
    payload.groupBy = groupBy;
  }

  return payload;
}
