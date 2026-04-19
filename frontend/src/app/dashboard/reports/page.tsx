"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";
import { createApiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ATTENDANCE_STATUSES,
  type AggregatedAttendanceReportResult,
  type AggregatedGroupBy,
  type ColumnDefinition,
  type ColumnKey,
  type ReportPreset,
  type ReportPresetSessionFilter,
  type ReportPresetState,
  type RawAttendanceReportResult,
  type Schedule,
  type SortDir,
  type SortKey,
  type ViewMode,
} from "./types";

import {
  addDaysIsoDate,
  formatDateSv,
  getTodayIsoDate,
  isoToYmd,
  normalizeApiErrorMessage,
  orderColumns,
  sessionKey,
} from "./utils";

import {
  createDefaultAggregatedColumnVisibility,
  createDefaultRawColumnVisibility,
  getAggregatedColumns,
  getRawColumns,
} from "./columns";

import { sessionKeysToSessions } from "./sessionFilters";
import { ReportResultsPanel } from "./ReportResultsPanel";
import { ColumnsPanel } from "./ColumnsPanel";
import { PresetsPanel } from "./PresetsPanel";
import { StatusFilterPanel } from "./StatusFilterPanel";
import { DateRangeSearchPanel } from "./DateRangeSearchPanel";
import { StudentsFilterPanel } from "./StudentsFilterPanel";
import { ClassesFilterPanel } from "./ClassesFilterPanel";
import { SessionsFilterPanel } from "./SessionsFilterPanel";
import { InstructorsFilterPanel } from "./InstructorsFilterPanel";
import { ReportActionsRow } from "./ReportActionsRow";
import { buildAttendanceExportPayload, buildAttendanceReportRequestBody } from "./payloadBuilders";
import { buildReportPresetState } from "./presetStateBuilders";
import { submitHiddenPayloadForm } from "./submitHiddenPayloadForm";
import { useReportStudents } from "./useReportStudents";

export default function ReportsPage() {
  const { data: session, status: authStatus } = useSession();
  const { isAdmin, isInstructor } = useAuth();
  const hasAccess = isAdmin || isInstructor;
  const accessToken = (session as any)?.accessToken as string | undefined;
  const canLoad = hasAccess && authStatus === "authenticated" && !!accessToken;

  const today = useMemo(() => getTodayIsoDate(), []);
  const defaultFrom = useMemo(() => addDaysIsoDate(today, -30), [today]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);

  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [onlyActiveStudents, setOnlyActiveStudents] = useState(true);
  const [selectedSessionKeys, setSelectedSessionKeys] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [instructorsSelected, setInstructorsSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>(["present"]);
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const defaultRawColumnVisibility = useMemo(() => createDefaultRawColumnVisibility(), []);
  const defaultAggregatedColumnVisibility = useMemo(() => createDefaultAggregatedColumnVisibility(), []);

  const [rawColumnVisibility, setRawColumnVisibility] = useState<Record<string, boolean>>(
    () => defaultRawColumnVisibility
  );
  const [aggregatedColumnVisibility, setAggregatedColumnVisibility] = useState<Record<string, boolean>>(
    () => defaultAggregatedColumnVisibility
  );

  const [mode, setMode] = useState<ViewMode>("raw");
  const [groupBy, setGroupBy] = useState<AggregatedGroupBy>("student");

  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawReport, setRawReport] = useState<RawAttendanceReportResult | null>(null);
  const [aggregatedReport, setAggregatedReport] = useState<AggregatedAttendanceReportResult | null>(null);

  const { students } = useReportStudents({
    enabled: canLoad,
    accessToken,
    onError: setError,
  });

  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const [presetSharedDraft, setPresetSharedDraft] = useState(false);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => presets.find((p) => p._id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );

  const instructorEditingShared = isInstructor && !!selectedPreset?.shared;

  const instructors = useMemo(() => {
    const unique = new Set<string>();
    for (const s of schedules) {
      const name = s.class_id?.instructor;
      if (name) unique.add(name);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [schedules]);

  const classesInRange = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; instructor?: string }>();
    for (const s of schedules) {
      const cls = s.class_id;
      if (!cls?._id) continue;
      if (!byId.has(cls._id)) byId.set(cls._id, { id: cls._id, name: cls.name, instructor: cls.instructor });
    }

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedules]);

  const sessionOptions = useMemo(() => {
    const options: Array<{ key: string; classScheduleId: string; ymd: string; label: string }> = [];
    const seen = new Set<string>();

    for (const s of schedules) {
      if (!s.date) continue;
      const ymd = isoToYmd(s.date);
      if (!ymd) continue;

      const classScheduleId = s._id;
      const key = sessionKey(classScheduleId, ymd);
      if (seen.has(key)) continue;
      seen.add(key);

      const className = s.class_id?.name ?? "Class";
      const dateLabel = s.date ? formatDateSv(s.date) : "";
      const start = s.start_time ?? "";
      const end = s.end_time ?? "";
      const label = `${dateLabel} ${start}-${end} ${className}`.trim();

      options.push({ key, classScheduleId, ymd, label });
    }

    options.sort((a, b) => {
      const d = a.ymd.localeCompare(b.ymd);
      if (d !== 0) return d;
      return a.label.localeCompare(b.label);
    });

    return options;
  }, [schedules]);

  // Load schedules whenever date range changes (for schedule + instructor dropdowns)
  useEffect(() => {
    let isCancelled = false;

    async function loadSchedules() {
      if (!canLoad || !accessToken) return;
      try {
        const qs = new URLSearchParams({
          startDate: from,
          endDate: to,
          expandRecurring: "true",
        });
        const api = createApiClient(accessToken);
        const data = await api.get(`/api/schedules?${qs.toString()}`);
        const list: Schedule[] = data?.data ?? [];
        if (!isCancelled) setSchedules(list);
      } catch (e: unknown) {
        if (e instanceof Error) setError(normalizeApiErrorMessage(e.message));
        else setError("Failed to fetch schedules");
      }
    }

    loadSchedules();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, canLoad, from, to]);

  // Load presets whenever auth becomes available
  useEffect(() => {
    let isCancelled = false;

    async function loadPresets() {
      if (!canLoad || !accessToken) return;

      try {
        setPresetError(null);
        const api = createApiClient(accessToken);
        const data = await api.get("/api/report-presets");
        const list: ReportPreset[] = data?.data ?? [];
        if (!isCancelled) setPresets(list);
      } catch (e: unknown) {
        if (!isCancelled) {
          if (e instanceof Error) setPresetError(normalizeApiErrorMessage(e.message));
          else setPresetError("Failed to fetch presets");
        }
      }
    }

    loadPresets();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, canLoad]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    from,
    to,
    onlyActiveStudents,
    search,
    studentIds.join(","),
    selectedSessionKeys.join(","),
    classIds.join(","),
    instructorsSelected.join(","),
    status.join(","),
    mode,
    groupBy,
  ]);

  // Load report when query changes
  useEffect(() => {
    let isCancelled = false;

    async function loadReport() {
      if (!canLoad || !accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const body = buildAttendanceReportRequestBody({
          mode,
          groupBy,
          from,
          to,
          page,
          pageSize,
          search,
          sortBy,
          sortDir,
          onlyActiveStudents,
          studentIds,
          selectedSessionKeys,
          classIds,
          instructors: instructorsSelected,
          status,
        });

        const api = createApiClient(accessToken);

        if (mode === "raw") {
          const data = await api.post("/api/reports/attendance/raw", body);
          const result: RawAttendanceReportResult = data?.data;
          if (!isCancelled) {
            setRawReport(result);
            setAggregatedReport(null);
          }
        } else {
          const data = await api.post("/api/reports/attendance/aggregate", body);
          const result: AggregatedAttendanceReportResult = data?.data;
          if (!isCancelled) {
            setAggregatedReport(result);
            setRawReport(null);
          }
        }
      } catch (e: unknown) {
        if (!isCancelled) {
          if (e instanceof Error) setError(normalizeApiErrorMessage(e.message));
          else setError("Failed to fetch report");
          setRawReport(null);
          setAggregatedReport(null);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadReport();

    return () => {
      isCancelled = true;
    };
  }, [
    accessToken,
    classIds.join(","),
    from,
    groupBy,
    instructorsSelected.join(","),
    mode,
    onlyActiveStudents,
    page,
    pageSize,
    selectedSessionKeys.join(","),
    search,
    sortBy ?? "",
    sortDir,
    status.join(","),
    studentIds.join(","),
    to,
    canLoad,
  ]);

  const buildPresetState = (): ReportPresetState =>
    buildReportPresetState({
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
      instructors: instructorsSelected,
      status,
      selectedSessionKeys,
      onlyActiveStudents,
      rawColumnVisibility,
      aggregatedColumnVisibility,
    });

  const applyPresetState = (state: ReportPresetState) => {
    // Presets should never apply pagination state
    setPage(1);

    if (state.mode === "aggregate") {
      setGroupBy((state.groupBy ?? "student") as AggregatedGroupBy);
      setMode("aggregate");
    } else {
      setMode("raw");
      if (state.groupBy) setGroupBy(state.groupBy as AggregatedGroupBy);
    }

    setFrom(state.from);
    setTo(state.to);

    setSearch(state.search ?? "");

    setOnlyActiveStudents(state.onlyActiveStudents ?? true);
    setStudentIds(state.studentIds ?? []);
    setClassIds(state.classIds ?? []);
    setInstructorsSelected(state.instructors ?? []);
    setStatus(state.status ?? []);

    setSelectedSessionKeys((state.sessions ?? []).map((s) => sessionKey(s.classScheduleId, s.date)));

    setRawColumnVisibility(state.rawColumnVisibility ?? defaultRawColumnVisibility);
    setAggregatedColumnVisibility(state.aggregatedColumnVisibility ?? defaultAggregatedColumnVisibility);

    if (state.sortBy) {
      setSortBy(state.sortBy as SortKey);
      setSortDir((state.sortDir as SortDir) ?? "asc");
    } else {
      setSortBy(null);
      setSortDir("asc");
    }
  };

  const reloadPresets = async (nextSelectedId?: string) => {
    if (!canLoad || !accessToken) return;

    const api = createApiClient(accessToken);
    const data = await api.get("/api/report-presets");
    const list: ReportPreset[] = data?.data ?? [];
    setPresets(list);

    if (nextSelectedId !== undefined) {
      setSelectedPresetId(nextSelectedId);
    }
  };

  const handleSavePreset = async () => {
    const name = presetNameDraft.trim();
    if (!name) {
      setPresetError("Preset name is required");
      return;
    }

    if (!canLoad || !accessToken) return;

    setPresetBusy(true);
    setPresetError(null);

    try {
      const api = createApiClient(accessToken);
      const body: any = {
        name,
        schemaVersion: 1,
        state: buildPresetState(),
      };

      if (isAdmin) body.shared = presetSharedDraft;

      const data = await api.post("/api/report-presets", body);
      const created: ReportPreset | undefined = data?.data;
      await reloadPresets(created?._id);
    } catch (e: unknown) {
      if (e instanceof Error) setPresetError(normalizeApiErrorMessage(e.message));
      else setPresetError("Failed to save preset");
    } finally {
      setPresetBusy(false);
    }
  };

  const handleUpdatePreset = async () => {
    if (!selectedPresetId) return;

    if (!canLoad || !accessToken) return;

    setPresetBusy(true);
    setPresetError(null);

    try {
      const api = createApiClient(accessToken);
      const body: any = {
        schemaVersion: 1,
        state: buildPresetState(),
      };

      const name = presetNameDraft.trim();
      if (name) body.name = name;
      if (isAdmin) body.shared = presetSharedDraft;

      await api.put(`/api/report-presets/${selectedPresetId}`, body);
      await reloadPresets(selectedPresetId);
    } catch (e: unknown) {
      if (e instanceof Error) setPresetError(normalizeApiErrorMessage(e.message));
      else setPresetError("Failed to update preset");
    } finally {
      setPresetBusy(false);
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;

    if (!canLoad || !accessToken) return;

    setPresetBusy(true);
    setPresetError(null);

    try {
      const api = createApiClient(accessToken);
      await api.delete(`/api/report-presets/${selectedPresetId}`);

      setSelectedPresetId("");
      setPresetNameDraft("");
      setPresetSharedDraft(false);

      await reloadPresets("");
    } catch (e: unknown) {
      if (e instanceof Error) setPresetError(normalizeApiErrorMessage(e.message));
      else setPresetError("Failed to delete preset");
    } finally {
      setPresetBusy(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  };

  const handleExportCsv = () => {
    const payload = buildAttendanceExportPayload({
      mode,
      groupBy,
      from,
      to,
      columns: visibleColumns.map((c) => c.key),
      search,
      sortBy,
      sortDir,
      onlyActiveStudents,
      studentIds,
      selectedSessionKeys,
      classIds,
      instructors: instructorsSelected,
      status,
    });

    submitHiddenPayloadForm({
      action: "/api/reports/attendance/export/csv",
      payload,
    });
  };

  const rawColumns = useMemo<ColumnDefinition[]>(() => getRawColumns(), []);

  const aggregatedColumns = useMemo<ColumnDefinition[]>(() => getAggregatedColumns(groupBy), [groupBy]);

  const currentColumns = mode === "raw" ? rawColumns : aggregatedColumns;

  const [rawColumnOrder, setRawColumnOrder] = useState<ColumnKey[]>(() => rawColumns.map((c) => c.key));
  const [aggregatedColumnOrderByGroupBy, setAggregatedColumnOrderByGroupBy] = useState<
    Partial<Record<AggregatedGroupBy, ColumnKey[]>>
  >({});

  useEffect(() => {
    setRawColumnOrder((prev) => orderColumns(rawColumns, prev).map((c) => c.key));
  }, [rawColumns]);

  useEffect(() => {
    if (mode !== "aggregate") return;

    setAggregatedColumnOrderByGroupBy((prev) => {
      if (prev[groupBy]?.length) return prev;
      return { ...prev, [groupBy]: aggregatedColumns.map((c) => c.key) };
    });
  }, [aggregatedColumns, groupBy, mode]);

  const activeColumnOrder = mode === "raw" ? rawColumnOrder : aggregatedColumnOrderByGroupBy[groupBy];
  const orderedColumns = useMemo(
    () => orderColumns(currentColumns, activeColumnOrder),
    [activeColumnOrder, currentColumns]
  );

  const activeColumnVisibility = mode === "raw" ? rawColumnVisibility : aggregatedColumnVisibility;
  const setActiveColumnVisibility = mode === "raw" ? setRawColumnVisibility : setAggregatedColumnVisibility;
  const visibleColumns = orderedColumns.filter((c) => activeColumnVisibility[c.key] !== false);

  const moveColumn = (key: ColumnKey, direction: -1 | 1) => {
    const keys = orderedColumns.map((c) => c.key);
    const idx = keys.indexOf(key);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= keys.length) return;

    const next = keys.slice();
    [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];

    if (mode === "raw") {
      setRawColumnOrder(next);
    } else {
      setAggregatedColumnOrderByGroupBy((prev) => ({ ...prev, [groupBy]: next }));
    }
  };

  useEffect(() => {
    if (!sortBy) return;
    const sortableKeys = new Set<SortKey>(
      currentColumns.filter((c) => c.sortable).map((c) => c.key as SortKey)
    );
    if (!sortableKeys.has(sortBy)) {
      setSortBy(null);
      setSortDir("asc");
    }
  }, [currentColumns, sortBy]);

  const currentReport = mode === "raw" ? rawReport : aggregatedReport;
  const canPrev = (currentReport?.page ?? 1) > 1;
  const canNext = currentReport ? currentReport.page < currentReport.totalPages : false;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">Attendance report</p>
      </div>

      {authStatus === "loading" && (
        <Card className="p-6">
          <p className="text-muted-foreground">Loading session...</p>
        </Card>
      )}

      {authStatus !== "loading" && !hasAccess && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You do not have permission to access this page. Only administrators
            and instructors can view reports.
          </p>
        </Card>
      )}

      {authStatus === "authenticated" && hasAccess && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Card className="p-4 md:col-span-4 md:sticky md:top-6 md:max-h-[calc(100vh-6rem)] md:overflow-auto">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mode" className="block text-sm font-medium mb-1">
                    View
                  </label>
                  <Select value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
                    <SelectTrigger id="mode" className="w-full">
                      <SelectValue placeholder="Raw" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">Raw</SelectItem>
                      <SelectItem value="aggregate">Aggregated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="groupBy" className="block text-sm font-medium mb-1">
                    Group by
                  </label>
                  <Select
                    value={groupBy}
                    onValueChange={(v) => setGroupBy(v as AggregatedGroupBy)}
                    disabled={mode !== "aggregate"}
                  >
                    <SelectTrigger id="groupBy" className="w-full">
                      <SelectValue placeholder="Student" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                      <SelectItem value="class">Class</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <PresetsPanel
                presets={presets}
                selectedPresetId={selectedPresetId}
                presetNameDraft={presetNameDraft}
                presetSharedDraft={presetSharedDraft}
                presetBusy={presetBusy}
                presetError={presetError}
                isAdmin={isAdmin}
                instructorEditingShared={instructorEditingShared}
                onSelectedPresetIdChange={setSelectedPresetId}
                onPresetNameDraftChange={setPresetNameDraft}
                onPresetSharedDraftChange={setPresetSharedDraft}
                onPresetErrorChange={setPresetError}
                onApplyPresetState={applyPresetState}
                onSave={handleSavePreset}
                onUpdate={handleUpdatePreset}
                onDelete={handleDeletePreset}
              />

              <DateRangeSearchPanel
                from={from}
                to={to}
                search={search}
                onFromChange={setFrom}
                onToChange={setTo}
                onSearchChange={setSearch}
              />

              <StatusFilterPanel
                statuses={ATTENDANCE_STATUSES}
                selectedStatuses={status}
                onToggleStatus={(s, nextChecked) => {
                  setStatus((prev) => {
                    if (nextChecked) return Array.from(new Set([...prev, s]));
                    return prev.filter((x) => x !== s);
                  });
                }}
              />

              <StudentsFilterPanel
                students={students}
                selectedStudentIds={studentIds}
                onlyActiveStudents={onlyActiveStudents}
                onOnlyActiveStudentsChange={setOnlyActiveStudents}
                onClearSelected={() => setStudentIds([])}
                onToggleStudent={(studentId, nextChecked) => {
                  setStudentIds((prev) => {
                    if (nextChecked) return Array.from(new Set([...prev, studentId]));
                    return prev.filter((id) => id !== studentId);
                  });
                }}
              />

              <ClassesFilterPanel
                classesInRange={classesInRange}
                selectedClassIds={classIds}
                onClearSelected={() => setClassIds([])}
                onToggleClass={(classId, nextChecked) => {
                  setClassIds((prev) => {
                    if (nextChecked) return Array.from(new Set([...prev, classId]));
                    return prev.filter((id) => id !== classId);
                  });
                }}
              />

              <SessionsFilterPanel
                sessionOptions={sessionOptions}
                selectedSessionKeys={selectedSessionKeys}
                onClearSelected={() => setSelectedSessionKeys([])}
                onToggleSession={(sessionKey, nextChecked) => {
                  setSelectedSessionKeys((prev) => {
                    if (nextChecked) return Array.from(new Set([...prev, sessionKey]));
                    return prev.filter((k) => k !== sessionKey);
                  });
                }}
              />

              <InstructorsFilterPanel
                instructors={instructors}
                selectedInstructors={instructorsSelected}
                onClearSelected={() => setInstructorsSelected([])}
                onToggleInstructor={(name, nextChecked) => {
                  setInstructorsSelected((prev) => {
                    if (nextChecked) return Array.from(new Set([...prev, name]));
                    return prev.filter((n) => n !== name);
                  });
                }}
              />

              <ReportActionsRow
                onReset={() => {
                  setFrom(defaultFrom);
                  setTo(today);
                  setStudentIds([]);
                  setOnlyActiveStudents(true);
                  setSelectedSessionKeys([]);
                  setClassIds([]);
                  setInstructorsSelected([]);
                  setStatus(["present"]);
                  setSearch("");
                }}
                onExportCsv={handleExportCsv}
                exportDisabled={loading || visibleColumns.length === 0}
              />

              <ColumnsPanel
                orderedColumns={orderedColumns}
                activeColumnVisibility={activeColumnVisibility}
                onSetColumnVisible={(key, visible) =>
                  setActiveColumnVisibility((prev) => ({ ...prev, [key]: visible }))
                }
                onMoveColumn={moveColumn}
              />
            </div>
          </Card>

          <ReportResultsPanel
            error={error}
            loading={loading}
            mode={mode}
            visibleColumns={visibleColumns}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            rawReport={rawReport}
            aggregatedReport={aggregatedReport}
            currentReport={currentReport}
            canPrev={canPrev}
            canNext={canNext}
            onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setPage((p) => p + 1)}
          />
        </div>
      )}

    </div>
  );
}
