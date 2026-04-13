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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Student = {
  _id: string;
  name: string;
};

type Schedule = {
  _id: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  class_id?: {
    _id: string;
    name: string;
    instructor?: string;
  };
};

type RawAttendanceRow = {
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

type RawAttendanceReportResult = {
  rows: RawAttendanceRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type AggregatedGroupBy = "student" | "instructor" | "session" | "class";

type AggregatedAttendanceRow = {
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

type AggregatedAttendanceReportResult = {
  rows: AggregatedAttendanceRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ViewMode = "raw" | "aggregate";

const normalizeApiErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("<html") || lower.includes("<!doctype html")) {
    return "API returned HTML instead of JSON. Check that NEXT_PUBLIC_API_URL points to the backend (e.g. http://localhost:4000) and that the backend is running.";
  }
  return message;
};

const formatDateSv = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("sv-SE");
  } catch {
    return iso;
  }
};

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

const addDaysIsoDate = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"] as const;

export default function ReportsPage() {
  const { data: session, status: authStatus } = useSession();
  const { isAdmin, isInstructor } = useAuth();
  const hasAccess = isAdmin || isInstructor;

  const today = useMemo(() => getTodayIsoDate(), []);
  const defaultFrom = useMemo(() => addDaysIsoDate(today, -30), [today]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);

  const [studentId, setStudentId] = useState<string>("all");
  const [studentName, setStudentName] = useState<string>("");
  const [classScheduleId, setClassScheduleId] = useState<string>("all");
  const [instructor, setInstructor] = useState<string>("all");
  const [status, setStatus] = useState<string[]>([]);

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

  const instructors = useMemo(() => {
    const unique = new Set<string>();
    for (const s of schedules) {
      const name = s.class_id?.instructor;
      if (name) unique.add(name);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [from, to, studentId, studentName, classScheduleId, instructor, status.join(","), mode, groupBy]);

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

        if (studentId !== "all") body.studentId = studentId;
        if (studentName.trim()) body.studentName = studentName.trim();
        if (classScheduleId !== "all") body.classScheduleId = classScheduleId;
        if (instructor !== "all") body.instructor = instructor;
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
  }, [authStatus, classScheduleId, from, groupBy, hasAccess, instructor, mode, page, pageSize, session, status.join(","), studentId, studentName, to]);

  const currentReport = mode === "raw" ? rawReport : aggregatedReport;
  const canPrev = (currentReport?.page ?? 1) > 1;
  const canNext = currentReport ? currentReport.page < currentReport.totalPages : false;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Attendance report (Raw / Aggregated)
        </p>
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
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {mode === "aggregate" && (
            <div>
              <label htmlFor="groupBy" className="block text-sm font-medium mb-1">
                Group by
              </label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as AggregatedGroupBy)}>
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
          )}

          <div>
            <label htmlFor="from" className="block text-sm font-medium mb-1">
              From
            </label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="to" className="block text-sm font-medium mb-1">
              To
            </label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="student" className="block text-sm font-medium mb-1">
              Student
            </label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger id="student" className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {students
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="studentName"
              className="block text-sm font-medium mb-1"
            >
              Student name contains
            </label>
            <Input
              id="studentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="e.g. Andersson"
            />
          </div>

          <div>
            <label htmlFor="schedule" className="block text-sm font-medium mb-1">
              Class schedule
            </label>
            <Select value={classScheduleId} onValueChange={setClassScheduleId}>
              <SelectTrigger id="schedule" className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {schedules.map((s) => {
                  const className = s.class_id?.name ?? "Class";
                  const date = s.date ? formatDateSv(s.date) : "";
                  const start = s.start_time ?? "";
                  const end = s.end_time ?? "";
                  const label = `${className} ${date} ${start}-${end}`.trim();
                  return (
                    <SelectItem key={s._id} value={s._id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor="instructor"
              className="block text-sm font-medium mb-1"
            >
              Instructor
            </label>
            <Select value={instructor} onValueChange={setInstructor}>
              <SelectTrigger id="instructor" className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {instructors.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <div className="text-sm font-medium mb-2">Status</div>
            <div className="flex flex-wrap gap-4">
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
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFrom(defaultFrom);
              setTo(today);
              setStudentId("all");
              setStudentName("");
              setClassScheduleId("all");
              setInstructor("all");
              setStatus([]);
            }}
          >
            Reset
          </Button>
        </div>
      </Card>
      )}

      {error && (
        <Card className="p-4 border border-destructive/30 bg-destructive/10">
          <p className="text-sm">{error}</p>
        </Card>
      )}

      {authStatus === "authenticated" && hasAccess && (
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-muted-foreground">Loading report...</div>
        ) : !currentReport || currentReport.rows.length === 0 ? (
          <div className="p-6 text-muted-foreground">No results.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {mode === "raw" ? (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead>Recorded at</TableHead>
                  </>
                ) : groupBy === "session" ? (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Total</TableHead>
                  </>
                ) : groupBy === "student" ? (
                  <>
                    <TableHead>Student</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Total</TableHead>
                  </>
                ) : groupBy === "instructor" ? (
                  <>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Total</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Class</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Total</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mode === "raw"
                ? (rawReport?.rows ?? []).map((r) => (
                    <TableRow key={r.attendance_id}>
                      <TableCell>{formatDateSv(r.date)}</TableCell>
                      <TableCell>{r.start_time}</TableCell>
                      <TableCell>{r.end_time}</TableCell>
                      <TableCell className="font-medium">{r.student_name}</TableCell>
                      <TableCell>{r.class_name}</TableCell>
                      <TableCell>{r.instructor}</TableCell>
                      <TableCell className="capitalize">{r.status}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell className="max-w-[18rem] truncate" title={r.notes}>
                        {r.notes}
                      </TableCell>
                      <TableCell>{r.recorded_by}</TableCell>
                      <TableCell>{formatDateSv(r.recorded_at)}</TableCell>
                    </TableRow>
                  ))
                : (aggregatedReport?.rows ?? []).map((r, idx) => (
                    <TableRow
                      key={
                        r.student_id ?? r.class_schedule_id ?? r.class_id ?? r.instructor ?? `row-${idx}`
                      }
                    >
                      {groupBy === "session" ? (
                        <>
                          <TableCell>{r.date ? formatDateSv(r.date) : ""}</TableCell>
                          <TableCell>{r.start_time ?? ""}</TableCell>
                          <TableCell>{r.end_time ?? ""}</TableCell>
                          <TableCell>{r.class_name ?? ""}</TableCell>
                          <TableCell>{r.instructor ?? ""}</TableCell>
                          <TableCell>{r.presentCount}</TableCell>
                          <TableCell>{r.totalCount}</TableCell>
                        </>
                      ) : groupBy === "student" ? (
                        <>
                          <TableCell className="font-medium">{r.student_name ?? ""}</TableCell>
                          <TableCell>{r.presentCount}</TableCell>
                          <TableCell>{r.totalCount}</TableCell>
                        </>
                      ) : groupBy === "instructor" ? (
                        <>
                          <TableCell className="font-medium">{r.instructor ?? ""}</TableCell>
                          <TableCell>{r.presentCount}</TableCell>
                          <TableCell>{r.totalCount}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{r.class_name ?? ""}</TableCell>
                          <TableCell>{r.instructor ?? ""}</TableCell>
                          <TableCell>{r.presentCount}</TableCell>
                          <TableCell>{r.totalCount}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Card>
      )}

      {authStatus === "authenticated" && hasAccess && (
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {currentReport ? (
            <span>
              Total: {currentReport.total} · Page {currentReport.page} / {currentReport.totalPages || 1}
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!canPrev}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
