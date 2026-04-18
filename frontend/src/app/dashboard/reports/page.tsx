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
  type Student,
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

export default function ReportsPage() {
  const { data: session, status: authStatus } = useSession();
  const { isAdmin, isInstructor } = useAuth();
  const hasAccess = isAdmin || isInstructor;

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

  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawReport, setRawReport] = useState<RawAttendanceReportResult | null>(null);
  const [aggregatedReport, setAggregatedReport] = useState<AggregatedAttendanceReportResult | null>(null);

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

  // Load students once
  useEffect(() => {
    let isCancelled = false;

    async function loadStudents() {
      if (!hasAccess) return;
      if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;
      try {
        const api = createApiClient((session as any)?.accessToken);
        const data = await api.get("/api/students");
        const list: Student[] = data?.data ?? [];
        if (!isCancelled) setStudents(list);
      } catch (e: unknown) {
        if (e instanceof Error) setError(normalizeApiErrorMessage(e.message));
        else setError("Failed to fetch students");
      }
    }

    loadStudents();

    return () => {
      isCancelled = true;
    };
  }, [authStatus, hasAccess, session]);

  // Load schedules whenever date range changes (for schedule + instructor dropdowns)
  useEffect(() => {
    let isCancelled = false;

    async function loadSchedules() {
      if (!hasAccess) return;
      if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;
      try {
        const qs = new URLSearchParams({
          startDate: from,
          endDate: to,
          expandRecurring: "true",
        });
        const api = createApiClient((session as any)?.accessToken);
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
  }, [authStatus, from, hasAccess, session, to]);

  // Load presets whenever auth becomes available
  useEffect(() => {
    let isCancelled = false;

    async function loadPresets() {
      if (!hasAccess) return;
      if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;

      try {
        setPresetError(null);
        const api = createApiClient((session as any)?.accessToken);
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
  }, [authStatus, hasAccess, session]);

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
      if (!hasAccess) return;
      if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, any> = {
          from,
          to,
          page,
          pageSize,
        };

        const trimmedSearch = search.trim();
        if (trimmedSearch) body.search = trimmedSearch;

        if (sortBy) {
          body.sortBy = sortBy;
          body.sortDir = sortDir;
        }

        if (onlyActiveStudents) body.onlyActiveStudents = true;
        if (studentIds.length > 0) body.studentIds = studentIds;
        if (selectedSessionKeys.length > 0) {
          body.sessions = sessionKeysToSessions(selectedSessionKeys);
        }
        if (classIds.length > 0) body.classIds = classIds;
        if (instructorsSelected.length > 0) body.instructors = instructorsSelected;
        if (status.length > 0) body.status = status;

        const api = createApiClient((session as any)?.accessToken);

        if (mode === "raw") {
          const data = await api.post("/api/reports/attendance/raw", body);
          const result: RawAttendanceReportResult = data?.data;
          if (!isCancelled) {
            setRawReport(result);
            setAggregatedReport(null);
          }
        } else {
          body.groupBy = groupBy;
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
    authStatus,
    classIds.join(","),
    from,
    groupBy,
    hasAccess,
    instructorsSelected.join(","),
    mode,
    onlyActiveStudents,
    page,
    pageSize,
    selectedSessionKeys.join(","),
    search,
    session,
    sortBy ?? "",
    sortDir,
    status.join(","),
    studentIds.join(","),
    to,
  ]);

  const buildPresetState = (): ReportPresetState => {
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
      instructors: instructorsSelected.length > 0 ? instructorsSelected : undefined,
      status: status.length > 0 ? status : undefined,
      sessions: sessions.length > 0 ? sessions : undefined,
      onlyActiveStudents,
      rawColumnVisibility,
      aggregatedColumnVisibility,
    };
  };

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
    if (!hasAccess) return;
    if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;

    const api = createApiClient((session as any)?.accessToken);
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

    if (!hasAccess) return;
    if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;

    setPresetBusy(true);
    setPresetError(null);

    try {
      const api = createApiClient((session as any)?.accessToken);
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

    if (!hasAccess) return;
    if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;

    setPresetBusy(true);
    setPresetError(null);

    try {
      const api = createApiClient((session as any)?.accessToken);
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

    if (!hasAccess) return;
    if (authStatus !== "authenticated" || !(session as any)?.accessToken) return;

    setPresetBusy(true);
    setPresetError(null);

    try {
      const api = createApiClient((session as any)?.accessToken);
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
    const sessions = sessionKeysToSessions(selectedSessionKeys);

    const payload: Record<string, any> = {
      mode,
      from,
      to,
      columns: visibleColumns.map((c) => c.key),
    };

    const trimmedSearch = search.trim();
    if (trimmedSearch) payload.search = trimmedSearch;

    if (sortBy) {
      payload.sortBy = sortBy;
      payload.sortDir = sortDir;
    }

    if (onlyActiveStudents) payload.onlyActiveStudents = true;
    if (studentIds.length > 0) payload.studentIds = studentIds;
    if (sessions.length > 0) payload.sessions = sessions;
    if (classIds.length > 0) payload.classIds = classIds;
    if (instructorsSelected.length > 0) payload.instructors = instructorsSelected;
    if (status.length > 0) payload.status = status;

    if (mode === "aggregate") {
      payload.groupBy = groupBy;
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/reports/attendance/export/csv";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    form.remove();
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

              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm font-medium">Presets</div>

                <div>
                  <label htmlFor="preset" className="block text-sm font-medium mb-1">
                    Select preset
                  </label>
                  <Select
                    value={selectedPresetId ? selectedPresetId : "__none"}
                    onValueChange={(v) => {
                      if (v === "__none") {
                        setSelectedPresetId("");
                        return;
                      }

                      const preset = presets.find((p) => p._id === v);
                      setSelectedPresetId(v);

                      if (preset) {
                        setPresetError(null);
                        setPresetNameDraft(preset.name);
                        setPresetSharedDraft(preset.shared);
                        applyPresetState(preset.state);
                      }
                    }}
                  >
                    <SelectTrigger id="preset" className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None</SelectItem>
                      {presets.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.shared ? `Shared: ${p.name}` : `My: ${p.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="presetName" className="block text-sm font-medium mb-1">
                    Preset name
                  </label>
                  <Input
                    id="presetName"
                    value={presetNameDraft}
                    onChange={(e) => setPresetNameDraft(e.target.value)}
                    placeholder="e.g. My weekly view"
                  />
                </div>

                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={presetSharedDraft} onCheckedChange={(v) => setPresetSharedDraft(v === true)} />
                    <span>Shared</span>
                  </label>
                )}

                {instructorEditingShared && (
                  <p className="text-xs text-muted-foreground">
                    Shared presets are read-only for instructors.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSavePreset} disabled={presetBusy || presetNameDraft.trim().length < 1}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUpdatePreset}
                    disabled={presetBusy || !selectedPresetId || instructorEditingShared}
                  >
                    Update
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeletePreset}
                    disabled={presetBusy || !selectedPresetId || instructorEditingShared}
                  >
                    Delete
                  </Button>
                </div>

                {presetError && <p className="text-xs text-destructive">{presetError}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="from" className="block text-sm font-medium mb-1">
                    From
                  </label>
                  <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>

                <div>
                  <label htmlFor="to" className="block text-sm font-medium mb-1">
                    To
                  </label>
                  <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>

              <div>
                <label htmlFor="search" className="block text-sm font-medium mb-1">
                  Search
                </label>
                <Input
                  id="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students, classes, instructors..."
                />
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Status</div>
                <div className="grid grid-cols-2 gap-2">
                  {ATTENDANCE_STATUSES.map((s) => {
                    const checked = status.includes(s);
                    return (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const nextChecked = v === true;
                            setStatus((prev) => {
                              if (nextChecked) return Array.from(new Set([...prev, s]));
                              return prev.filter((x) => x !== s);
                            });
                          }}
                        />
                        <span className="capitalize">{s}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Students</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                      <Checkbox
                        checked={onlyActiveStudents}
                        onCheckedChange={(v) => setOnlyActiveStudents(v === true)}
                      />
                      <span>Only active</span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={studentIds.length === 0}
                      onClick={() => setStudentIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="rounded-md border p-2 min-h-40 max-h-40 overflow-auto space-y-2">
                  {students
                    .filter((s) => {
                      if (!onlyActiveStudents) return true;
                      const isActive = (s.active ?? true) !== false && (s.status ?? 'active') !== 'inactive';
                      return isActive;
                    })
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((s) => {
                      const checked = studentIds.includes(s._id);
                      return (
                        <label key={s._id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const nextChecked = v === true;
                              setStudentIds((prev) => {
                                if (nextChecked) return Array.from(new Set([...prev, s._id]));
                                return prev.filter((id) => id !== s._id);
                              });
                            }}
                          />
                          <span className="truncate" title={s.name}>
                            {s.name}
                          </span>
                        </label>
                      );
                    })}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {studentIds.length === 0 ? "All students" : `Selected: ${studentIds.length}`}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Classes</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={classIds.length === 0}
                    onClick={() => setClassIds([])}
                  >
                    Clear
                  </Button>
                </div>
                <div className="rounded-md border p-2 min-h-32 max-h-32 overflow-auto space-y-2">
                  {classesInRange.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No classes in range.</div>
                  ) : (
                    classesInRange.map((c) => {
                      const checked = classIds.includes(c.id);
                      const label = c.instructor ? `${c.name} (${c.instructor})` : c.name;
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const nextChecked = v === true;
                              setClassIds((prev) => {
                                if (nextChecked) return Array.from(new Set([...prev, c.id]));
                                return prev.filter((id) => id !== c.id);
                              });
                            }}
                          />
                          <span className="truncate" title={label}>
                            {label}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {classIds.length === 0 ? "All classes" : `Selected: ${classIds.length}`}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Sessions</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={selectedSessionKeys.length === 0}
                    onClick={() => setSelectedSessionKeys([])}
                  >
                    Clear
                  </Button>
                </div>
                <div className="rounded-md border p-2 min-h-48 max-h-48 overflow-auto space-y-2">
                  {sessionOptions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No sessions in range.</div>
                  ) : (
                    sessionOptions.map((opt) => {
                      const checked = selectedSessionKeys.includes(opt.key);
                      return (
                        <label key={opt.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const nextChecked = v === true;
                              setSelectedSessionKeys((prev) => {
                                if (nextChecked) return Array.from(new Set([...prev, opt.key]));
                                return prev.filter((k) => k !== opt.key);
                              });
                            }}
                          />
                          <span className="truncate" title={opt.label}>
                            {opt.label}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedSessionKeys.length === 0 ? "All sessions" : `Selected: ${selectedSessionKeys.length}`}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">Instructors</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={instructorsSelected.length === 0}
                    onClick={() => setInstructorsSelected([])}
                  >
                    Clear
                  </Button>
                </div>
                <div className="rounded-md border p-2 min-h-32 max-h-32 overflow-auto space-y-2">
                  {instructors.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No instructors in range.</div>
                  ) : (
                    instructors.map((name) => {
                      const checked = instructorsSelected.includes(name);
                      return (
                        <label key={name} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const nextChecked = v === true;
                              setInstructorsSelected((prev) => {
                                if (nextChecked) return Array.from(new Set([...prev, name]));
                                return prev.filter((n) => n !== name);
                              });
                            }}
                          />
                          <span className="truncate" title={name}>
                            {name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {instructorsSelected.length === 0 ? "All instructors" : `Selected: ${instructorsSelected.length}`}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
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
                >
                  Reset
                </Button>

                <Button type="button" onClick={handleExportCsv} disabled={loading || visibleColumns.length === 0}>
                  Export CSV
                </Button>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Columns</div>
                <div className="space-y-2">
                  {orderedColumns.map((c, idx) => {
                    const checked = activeColumnVisibility[c.key] !== false;
                    return (
                      <div key={c.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const nextChecked = v === true;
                            setActiveColumnVisibility((prev) => ({ ...prev, [c.key]: nextChecked }));
                          }}
                        />
                        <span className="flex-1">{c.label}</span>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          disabled={idx === 0}
                          onClick={() => moveColumn(c.key, -1)}
                          aria-label={`Move ${c.label} up`}
                          title="Move up"
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          disabled={idx === orderedColumns.length - 1}
                          onClick={() => moveColumn(c.key, 1)}
                          aria-label={`Move ${c.label} down`}
                          title="Move down"
                        >
                          ↓
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
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
