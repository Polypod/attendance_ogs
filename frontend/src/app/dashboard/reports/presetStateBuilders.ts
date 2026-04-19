import { sessionKeysToSessions } from "./sessionFilters";
import type { AggregatedGroupBy, ReportPresetState, SortDir, SortKey, ViewMode } from "./types";

type Args = {
  mode: ViewMode;
  groupBy: AggregatedGroupBy;
  from: string;
  to: string;
  search: string;
  pageSize: number;
  sortBy: SortKey | null;
  sortDir: SortDir;
  studentIds: string[];
  classIds: string[];
  instructors: string[];
  status: string[];
  selectedSessionKeys: string[];
  onlyActiveStudents: boolean;
  rawColumnVisibility: Record<string, boolean>;
  aggregatedColumnVisibility: Record<string, boolean>;
};

export function buildReportPresetState({
  mode,
  groupBy,
  from,
  to,
  search,
  pageSize,
  sortBy,
  sortDir,
  studentIds,
  classIds,
  instructors,
  status,
  selectedSessionKeys,
  onlyActiveStudents,
  rawColumnVisibility,
  aggregatedColumnVisibility,
}: Args): ReportPresetState {
  const sessions = sessionKeysToSessions(selectedSessionKeys);
  const trimmedSearch = search.trim();

  return {
    mode,
    groupBy,
    from,
    to,
    search: trimmedSearch ? trimmedSearch : undefined,
    pageSize,
    sortBy: sortBy ?? undefined,
    sortDir: sortBy ? sortDir : undefined,
    studentIds: studentIds.length > 0 ? studentIds : undefined,
    classIds: classIds.length > 0 ? classIds : undefined,
    instructors: instructors.length > 0 ? instructors : undefined,
    status: status.length > 0 ? status : undefined,
    sessions: sessions.length > 0 ? sessions : undefined,
    onlyActiveStudents,
    rawColumnVisibility,
    aggregatedColumnVisibility,
  };
}
