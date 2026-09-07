"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, LogIn, RefreshCw, Search, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const KIOSK_STORAGE_KEY = "attendance-kiosk-key";
const MAX_DAY_OFFSET = 3;

function dateKeyForOffset(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type KioskStudent = {
  id: string;
  name: string;
  beltLevel: string;
  category: string;
  active: boolean;
  attendanceStatus?: AttendanceStatus;
};
type KioskSession = {
  id: string;
  className: string;
  startTime: string;
  endTime: string;
  categories: string[];
  status: string;
  instructorName: string;
  students: KioskStudent[];
  otherStudents: KioskStudent[];
};
type KioskPayload<T> = { success: boolean; data?: T; message?: string; error?: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Något gick fel";
}

async function kioskRequest<T>(path: string, accessKey: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Attendance-Kiosk-Key": accessKey,
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json() as KioskPayload<T>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || payload.message || "Kunde inte kontakta närvarokiosken");
  }
  return payload.data;
}

export default function AttendanceKioskPage() {
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [sessions, setSessions] = useState<KioskSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [instructorName, setInstructorName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showOtherStudents, setShowOtherStudents] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const keyFromUrl = url.searchParams.get("k");
    const storedKey = keyFromUrl || window.localStorage.getItem(KIOSK_STORAGE_KEY);
    if (keyFromUrl) {
      window.localStorage.setItem(KIOSK_STORAGE_KEY, keyFromUrl);
      url.searchParams.delete("k");
      window.history.replaceState({}, "", url);
    }
    setAccessKey(storedKey);
  }, []);

  const loadSessions = async (key = accessKey, offset = dayOffset) => {
    if (!key) return;
    setLoading(true);
    setError(null);
    try {
      const data = await kioskRequest<{ date: string; sessions: KioskSession[] }>(
        `/api/kiosk-attendance/today?date=${dateKeyForOffset(offset)}`,
        key
      );
      setDate(data.date);
      setSessions(data.sessions);
    } catch (nextError: unknown) {
      window.localStorage.removeItem(KIOSK_STORAGE_KEY);
      setAccessKey(null);
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  const changeDayOffset = (offset: number) => {
    if (offset < -MAX_DAY_OFFSET || offset > MAX_DAY_OFFSET) return;
    setDayOffset(offset);
    setSelectedSessionId(null);
    loadSessions(accessKey, offset);
  };

  useEffect(() => {
    if (accessKey) {
      loadSessions();
    } else if (accessKey === null) {
      setLoading(false);
    }
  }, [accessKey]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;
  const filterStudents = (students: KioskStudent[]) => {
    const query = search.trim().toLocaleLowerCase("sv-SE");
    return students.filter((student) =>
      (showInactive || student.active) &&
      student.name.toLocaleLowerCase("sv-SE").includes(query)
    );
  };
  const visibleStudents = useMemo(
    () => selectedSession ? filterStudents(selectedSession.students) : [],
    [selectedSession, search, showInactive]
  );
  const visibleOtherStudents = useMemo(
    () => selectedSession && showOtherStudents ? filterStudents(selectedSession.otherStudents) : [],
    [selectedSession, search, showInactive, showOtherStudents]
  );

  const openSession = (session: KioskSession) => {
    setSelectedSessionId(session.id);
    setSelectedStudentIds(
      [...session.students, ...session.otherStudents]
        .filter((student) => student.attendanceStatus === "present")
        .map((student) => student.id)
    );
    setInstructorName(session.instructorName);
    setSearch("");
    setShowInactive(false);
    setShowOtherStudents(false);
    setSuccess(null);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) => current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId]);
  };

  const finalizeAttendance = async () => {
    if (!accessKey || !selectedSession) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await kioskRequest<{ presentCount: number; absentCount: number }>(
        `/api/kiosk-attendance/sessions/${selectedSession.id}/finalize`,
        accessKey,
        {
          method: "POST",
          body: JSON.stringify({ presentStudentIds: selectedStudentIds, date }),
        }
      );
      setSuccess(`${result.presentCount} närvarande och ${result.absentCount} frånvarande sparades.`);
      await loadSessions(accessKey, dayOffset);
    } catch (nextError: unknown) {
      setError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  const renderStudentCards = (students: KioskStudent[]) => (
    <div className="grid gap-3 md:grid-cols-2">
      {students.map((student) => {
        const selected = selectedStudentIds.includes(student.id);
        return (
          <button
            key={student.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggleStudent(student.id)}
            className={`group flex min-h-22 items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 ${
              selected
                ? "border-emerald-500 bg-emerald-50 shadow-sm"
                : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            }`}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-slate-50 text-slate-400 group-hover:border-red-300"
            }`}>
              {selected && <Check className="size-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-950">{student.name}</span>
              <span className="mt-0.5 block text-sm font-medium text-slate-500">
                Grupp: {student.category} <span className="px-1 text-slate-300">·</span> {student.beltLevel}
                {!student.active && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Inaktiv</span>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  if (!accessKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5">
        <Card className="w-full max-w-xl overflow-hidden border-0 bg-white py-0 shadow-2xl">
          <div className="h-2 bg-red-700" />
          <CardHeader className="px-8 pb-3 pt-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-700">Okinawa Goju-Ryu Södertörn</p>
            <CardTitle className="mt-2 text-2xl text-slate-950">Närvarokiosken är inte aktiverad</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <p className="text-slate-600">Öppna den unika aktiveringslänken från administratören på denna enhet.</p>
            {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center text-white">
          <div className="mx-auto mb-5 flex size-14 animate-pulse items-center justify-center rounded-2xl bg-red-700"><Users className="size-7" /></div>
          <p className="text-lg font-medium">Hämtar dagens pass...</p>
        </div>
      </main>
    );
  }

  if (selectedSession) {
    return (
      <main className="min-h-screen bg-[#f7f7f5] text-slate-950">
        <header className="border-b border-white/10 bg-slate-950 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Button variant="ghost" className="min-h-12 px-3 text-base text-white hover:bg-white/10 hover:text-white" onClick={() => setSelectedSessionId(null)}>
              <ChevronLeft />Alla pass
            </Button>
            <p className="hidden text-sm font-semibold tracking-wide text-slate-300 sm:block">Okinawa Goju-Ryu Södertörn</p>
            <Button variant="ghost" className="min-h-12 px-3 text-white hover:bg-white/10 hover:text-white" onClick={() => loadSessions()} disabled={saving}>
              <RefreshCw className="size-5" /><span className="hidden sm:inline">Uppdatera</span>
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl p-4 sm:p-6">
          <section className="mb-5 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-red-300">Närvaroregistrering</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{selectedSession.className}</h1>
                <p className="mt-2 text-lg text-slate-300">{selectedSession.startTime}–{selectedSession.endTime}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-5 py-3 text-center">
                <p className="text-2xl font-bold">{selectedStudentIds.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Närvarande</p>
              </div>
            </div>
          </section>
          <Card className="mb-4 border-0 bg-white py-0 shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <label htmlFor="kiosk-instructor" className="mb-2 block text-sm font-bold text-slate-700">Instruktör för detta pass</label>
              <Input
                id="kiosk-instructor"
                value={instructorName}
                onChange={(event) => setInstructorName(event.target.value)}
                maxLength={100}
                className="min-h-13 border-slate-200 bg-slate-50 text-lg font-medium"
              />
            </CardContent>
          </Card>
          <div className="sticky top-0 z-10 mb-5 space-y-3 bg-[#f7f7f5]/95 py-3 backdrop-blur">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-4 size-5 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Sök medlem" className="min-h-14 rounded-2xl border-slate-200 bg-white pl-12 text-lg shadow-sm" />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <label className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-700">
                <Checkbox className="size-5" checked={showInactive} onCheckedChange={(checked) => setShowInactive(checked === true)} />
                Visa inaktiva
              </label>
              <label className="flex min-h-10 items-center gap-3 text-base font-semibold text-slate-700">
                <Checkbox className="size-5" checked={showOtherStudents} onCheckedChange={(checked) => setShowOtherStudents(checked === true)} />
                Visa övriga medlemmar
              </label>
            </div>
          </div>
          {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}
          {success && <p role="status" className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-medium text-emerald-800">{success}</p>}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xl font-bold">Passets grupper</h2>
              <span className="text-sm font-medium text-slate-500">{visibleStudents.length} medlemmar</span>
            </div>
            {renderStudentCards(visibleStudents)}
          </section>
          {showOtherStudents && (
            <section className="mt-7 border-t border-slate-200 pt-6">
              <h2 className="text-xl font-bold">Övriga medlemmar</h2>
              <p className="mb-3 mt-1 text-sm text-slate-500">Markera endast de som deltar i detta pass.</p>
              {renderStudentCards(visibleOtherStudents)}
            </section>
          )}
          <div className="sticky bottom-0 z-10 mt-6 border-t border-slate-200 bg-[#f7f7f5]/95 py-4 backdrop-blur">
            <Button className="min-h-16 w-full rounded-2xl bg-red-700 text-lg font-bold shadow-lg hover:bg-red-800" onClick={finalizeAttendance} disabled={saving || instructorName.trim().length < 2}>
              <Check className="size-5" />{saving ? "Sparar närvaro..." : `Spara ${selectedStudentIds.length} närvarande`}
            </Button>
            <p className="mt-2 text-center text-sm font-medium text-slate-500">Omarkerade aktiva medlemmar i passets grupper sparas som frånvarande.</p>
          </div>
        </main>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-slate-950">
      <header className="bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-4 pb-8 pt-5 sm:px-6 sm:pb-10">
          <div className="flex items-center justify-end">
            <Button asChild variant="ghost" className="min-h-11 text-slate-300 hover:bg-white/10 hover:text-white">
              <Link href="/login"><LogIn className="size-4" />Logga in</Link>
            </Button>
          </div>
          <div className="mt-4">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-300">Okinawa Goju-Ryu Södertörn</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{dayOffset === 0 ? "Dagens närvaro" : "Närvaro"}</h1>
            <div className="mt-4 flex items-center gap-2 text-lg text-slate-300">
              <CalendarDays className="size-5 text-red-300" />
              <p>{new Date(`${date}T12:00:00`).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="-mt-10 mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-700"><Users className="size-5" /></span>
            <div>
              <p className="font-bold">Välj ett pass</p>
              <p className="text-sm text-slate-500">{sessions.length} pass att registrera</p>
            </div>
          </div>
          <Button variant="outline" className="min-h-11 rounded-xl border-slate-200" onClick={() => loadSessions()}>
            <RefreshCw className="size-4" /><span className="hidden sm:inline">Uppdatera</span>
          </Button>
        </div>
        <div className="mb-6 flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => changeDayOffset(dayOffset - 1)}
            disabled={dayOffset <= -MAX_DAY_OFFSET}
            aria-label="Föregående dag"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex flex-1 justify-between gap-1 overflow-x-auto sm:gap-2">
            {Array.from({ length: MAX_DAY_OFFSET * 2 + 1 }, (_, index) => index - MAX_DAY_OFFSET).map((offset) => {
              const optionDate = new Date(`${dateKeyForOffset(offset)}T12:00:00`);
              const active = offset === dayOffset;
              return (
                <button
                  key={offset}
                  type="button"
                  onClick={() => changeDayOffset(offset)}
                  className={`flex min-w-14 flex-1 flex-col items-center rounded-xl px-2 py-2 text-center transition-colors ${
                    active ? "bg-red-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {offset === 0 ? "Idag" : optionDate.toLocaleDateString("sv-SE", { weekday: "short" })}
                  </span>
                  <span className="text-sm font-bold">{optionDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</span>
                </button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => changeDayOffset(dayOffset + 1)}
            disabled={dayOffset >= MAX_DAY_OFFSET}
            aria-label="Nästa dag"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-medium text-red-800">{error}</p>}
        {sessions.length === 0 ? (
          <Card className="border-0 bg-white py-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-lg font-semibold">Det finns inga pass att registrera {dayOffset === 0 ? "i dag" : "denna dag"}.</p>
              <p className="mt-2 text-slate-500">När nya pass läggs in visas de här.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {sessions.map((session) => {
              const presentCount = [...session.students, ...session.otherStudents].filter((student) => student.attendanceStatus === "present").length;
              return (
                <button key={session.id} type="button" onClick={() => openSession(session)} className="group rounded-3xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200">
                  <Card className="min-h-52 border-0 bg-white py-0 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl">
                    <CardContent className="flex min-h-52 flex-col justify-between p-6">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-3xl font-bold tracking-tight text-red-700">{session.startTime}</p>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">{session.endTime}</span>
                        </div>
                        <h2 className="mt-5 text-2xl font-bold tracking-tight">{session.className}</h2>
                        <p className="mt-2 text-sm font-medium text-slate-500">{session.categories.join(" · ")}</p>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-sm font-semibold text-slate-500">{presentCount} registrerade</span>
                        <span className="text-sm font-bold text-red-700">Registrera →</span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </main>
  );
}
