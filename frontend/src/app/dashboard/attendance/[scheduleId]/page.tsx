"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createApiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, CheckCircle, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClassInfo = {
  _id: string;
  name: string;
  instructor: string;
  categories: string[];
};

type ClassScheduleSession = {
  date: string;
  status?: string;
  notes?: string;
  "S-instructor": string;
};

type Schedule = {
  _id: string;
  class_id: ClassInfo;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  sessions?: ClassScheduleSession[];
};

type Student = {
  _id: string;
  name: string;
  email: string;
  categories: string[];
  belt_level: string;
  active?: boolean;
};

type AttendanceRecord = {
  student_id: string;
  status: "present" | "absent" | "excused";
  notes: string;
};

export default function TakeAttendancePage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = params.scheduleId as string;
  const dateFromUrl = searchParams.get('date'); // Get date from URL query parameter

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [sInstructor, setSInstructor] = useState("");
  const [sessionDate, setSessionDate] = useState<string>(""); // Store the actual session date
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'authenticated' && session?.accessToken) {
      fetchScheduleAndStudents();
    } else if (authStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [authStatus, session, scheduleId]);

  async function fetchScheduleAndStudents() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      
      // Fetch schedule
      const scheduleData = await api.get(`/api/schedules/${scheduleId}`);
      const scheduleInfo = scheduleData.data;
      setSchedule(scheduleInfo);

      // Use date from URL parameter if available, otherwise use schedule date
      const actualDate = dateFromUrl || scheduleInfo.date.split('T')[0];
      setSessionDate(actualDate);

      // Check if there's already a session for this date
      const existingSession = scheduleInfo.sessions?.find(
        (s: ClassScheduleSession) => s.date.split('T')[0] === actualDate
      );

      // Set session instructor and notes - use existing session or leave empty
      if (existingSession) {
        setSInstructor(existingSession["S-instructor"] || "");
        setSessionNotes(existingSession.notes || "");
      } else {
        // Don't prefill with class default - user must specify instructor for each session
        setSInstructor("");
        setSessionNotes("");
      }

      // Fetch all students
      const studentsData = await api.get("/api/students");
      const allStudentsList = studentsData.data || [];
      setAllStudents(allStudentsList);

      // Filter students by class categories
      const classCategories = typeof scheduleInfo.class_id === 'object' 
        ? scheduleInfo.class_id.categories 
        : [];
      
      const filteredStudents = allStudentsList.filter((student: Student) =>
        student.categories.some((cat: string) => classCategories.includes(cat))
      );
      
      setStudents(filteredStudents);

      // Fetch existing attendance for this schedule
      try {
        const attendanceRes = await api.get(`/api/attendance/class/${scheduleId}`);
        const existingAttendanceList = attendanceRes.data || [];
        
        // Filter attendance for this specific date (important for recurring classes)
        const existingAttendance = existingAttendanceList.filter((a: any) => {
          if (!a.date) return true; // Old format without date
          return a.date.split('T')[0] === actualDate;
        });
        
        // Initialize attendance records with existing data or absent as default
        const initialAttendance: Record<string, AttendanceRecord> = {};
        allStudentsList.forEach((student: Student) => {
          const existing = existingAttendance.find(
            (a: any) => (a.student_id._id || a.student_id) === student._id
          );
          
          if (existing) {
            initialAttendance[student._id] = {
              student_id: student._id,
              status: existing.status,
              notes: existing.notes || "",
            };
          } else {
            initialAttendance[student._id] = {
              student_id: student._id,
              status: "absent",
              notes: "",
            };
          }
        });
        setAttendance(initialAttendance);
      } catch (attendanceError) {
        // If no attendance found, initialize with defaults
        const initialAttendance: Record<string, AttendanceRecord> = {};
        allStudentsList.forEach((student: Student) => {
          initialAttendance[student._id] = {
            student_id: student._id,
            status: "absent",
            notes: "",
          };
        });
        setAttendance(initialAttendance);
      }

    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to fetch schedule and students");
    } finally {
      setLoading(false);
    }
  }

  function updateAttendanceStatus(studentId: string, status: "present" | "absent" | "excused") {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  }

  function updateAttendanceNotes(studentId: string, notes: string) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || !schedule) return;

    console.log('[ATTENDANCE] handleSubmit called');
    console.log('[ATTENDANCE] Current S-instructor state:', sInstructor);
    console.log('[ATTENDANCE] S-instructor type:', typeof sInstructor);
    console.log('[ATTENDANCE] S-instructor length:', sInstructor.length);

    if (!sInstructor.trim()) {
      setError("Please specify an instructor for this session");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const api = createApiClient((session as any)?.accessToken);
      
      // Prepare attendance records
      const attendanceRecords = Object.values(attendance).map((record) => {
        const student = allStudents.find(s => s._id === record.student_id);
        return {
          student_id: record.student_id,
          class_schedule_id: scheduleId,
          date: sessionDate, // Use the date from URL or schedule
          status: record.status,
          notes: record.notes || undefined,
          category: student?.categories[0] || "adult",
        };
      });

      // Get current user email for recorded_by
      const userEmail = (session as any)?.user?.email || "system";

      // Update schedule with session-specific instructor and notes
      const existingSessions = schedule.sessions || [];
      
      console.log('[ATTENDANCE] Existing sessions before update:', 
        existingSessions.map(s => ({
          date: s.date,
          'S-instructor': s['S-instructor'],
          status: s.status
        }))
      );
      
      const sessionIndex = existingSessions.findIndex(
        (s) => s.date.split('T')[0] === sessionDate
      );

      console.log('[ATTENDANCE] Found session at index:', sessionIndex, 'for date:', sessionDate);
      console.log('[ATTENDANCE] S-instructor value to save:', sInstructor);

      let updatedSessions;
      if (sessionIndex >= 0) {
        // Update existing session - create a completely new array with updated session
        updatedSessions = existingSessions.map((session, index) => {
          if (index === sessionIndex) {
            // Update this session with new instructor and notes
            return {
              date: session.date, // Preserve original date
              "S-instructor": sInstructor,
              notes: sessionNotes,
              status: "completed" as const,
            };
          }
          // Keep other sessions unchanged - but filter out old 'instructor' field
          return {
            date: session.date,
            "S-instructor": session["S-instructor"] || "",
            notes: session.notes || "",
            status: session.status,
          };
        });
      } else {
        // Add new session - create ISO date string for MongoDB
        const sessionDateISO = new Date(sessionDate + 'T00:00:00').toISOString();
        updatedSessions = [
          ...existingSessions.map(s => ({
            date: s.date,
            "S-instructor": s["S-instructor"] || "",
            notes: s.notes || "",
            status: s.status,
          })),
          {
            date: sessionDateISO,
            "S-instructor": sInstructor,
            notes: sessionNotes,
            status: "completed" as const,
          },
        ];
      }

      // Update the schedule with session info
      console.log('[ATTENDANCE] Updating schedule with sessions:', {
        scheduleId,
        sessionDate,
        sInstructor,
        updatedSessions: updatedSessions.map(s => ({
          date: s.date,
          'S-instructor': s['S-instructor'],
          status: s.status
        }))
      });
      
      const schedulePayload = {
        sessions: updatedSessions,
        status: "completed",
      };
      
      console.log('[ATTENDANCE] Full PUT payload:', JSON.stringify(schedulePayload, null, 2));
      
      const scheduleUpdateResponse = await api.put(`/api/schedules/${scheduleId}`, schedulePayload);
      
      console.log('[ATTENDANCE] Schedule updated successfully:', {
        returnedSessions: scheduleUpdateResponse.data?.sessions?.map((s: any) => ({
          date: s.date,
          'S-instructor': s['S-instructor'],
          status: s.status
        }))
      });
      
      console.log('[ATTENDANCE] FULL RESPONSE DATA:', JSON.stringify(scheduleUpdateResponse.data, null, 2));
      
      // Verify the specific session we just saved
      const savedSessionForOurDate = scheduleUpdateResponse.data?.sessions?.find((s: any) => 
        s.date.split('T')[0] === sessionDate
      );
      console.log('[ATTENDANCE] CRITICAL: Saved session for date', sessionDate, ':', savedSessionForOurDate);

      // Submit attendance
      await api.post("/api/attendance/bulk", {
        attendance: attendanceRecords,
        recorded_by: userEmail,
      });

      console.log('[ATTENDANCE] Attendance submitted successfully');

      // Don't update the state - the user already set the correct values
      // Just show success and redirect
      setSuccess("Attendance recorded successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);

    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to record attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto w-full">
        <Card className="p-6">
          <p className="text-muted-foreground">Loading...</p>
        </Card>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="max-w-6xl mx-auto w-full">
        <Card className="p-6">
          <p className="text-red-600">Schedule not found</p>
          <Button className="mt-4" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const classInfo = typeof schedule.class_id === 'object' ? schedule.class_id : null;
  const presentCount = Object.values(attendance).filter(a => a.status === "present").length;
  const absentCount = Object.values(attendance).filter(a => a.status === "absent").length;

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Take Attendance</h1>
          {classInfo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Class:</p>
                <p className="font-semibold">{classInfo.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date:</p>
                <p className="font-semibold">
                  {sessionDate ? new Date(sessionDate + 'T00:00:00').toLocaleDateString('sv-SE') : new Date(schedule.date).toLocaleDateString('sv-SE')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Time:</p>
                <p className="font-semibold">
                  {schedule.start_time} - {schedule.end_time}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Categories:</p>
                <p className="font-semibold">{classInfo.categories.join(", ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Default Instructor:</p>
                <p className="font-semibold">{classInfo.instructor}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Instructor for this session *
              </label>
              <Input
                type="text"
                value={sInstructor}
                onChange={(e) => setSInstructor(e.target.value)}
                placeholder="Enter instructor name"
                required
              />
              <p className="text-sm text-muted-foreground mt-1">
                You can specify a different instructor for this specific session
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Session Notes
              </label>
              <Input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Notes for this session (optional)"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Any notes or comments about this specific session
              </p>
            </div>
          </div>
        </Card>

        {error && (
          <Card className="p-4 bg-red-50 border-red-200 mb-6">
            <p className="text-red-600">{error}</p>
          </Card>
        )}

        {success && (
          <Card className="p-4 bg-green-50 border-green-200 mb-6">
            <p className="text-green-600">{success}</p>
          </Card>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Checkbox
            id="show-active-attendance"
            checked={showOnlyActive}
            onCheckedChange={(checked) => setShowOnlyActive(checked === true)}
          />
          <label
            htmlFor="show-active-attendance"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Show only active students
          </label>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Students in Class Categories ({showOnlyActive ? students.filter(s => s.active !== false).length : students.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Students matching class categories
              </p>
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 font-medium">
                  Present: {presentCount}
                </span>
                <span className="text-red-600 font-medium">
                  Absent: {absentCount}
                </span>
              </div>
              {allStudents.length > students.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllStudents(!showAllStudents)}
                >
                  {showAllStudents ? "Hide" : "Show"} Other Students ({allStudents.length - students.length})
                </Button>
              )}
            </div>
          </div>

          {students.length === 0 ? (
            <p className="text-muted-foreground">
              No students found matching class categories.
            </p>
          ) : (
            <div className="space-y-3">
              {(showOnlyActive ? students.filter(s => s.active !== false) : students).map((student) => (
                <Card key={student._id} className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold">{student.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.belt_level} | {student.categories.join(", ")}
                      </p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-3 md:items-center">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={attendance[student._id]?.status === "present" ? "default" : "outline"}
                          onClick={() => updateAttendanceStatus(student._id, "present")}
                          className="flex-1 md:flex-none"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Present
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={attendance[student._id]?.status === "absent" ? "destructive" : "outline"}
                          onClick={() => updateAttendanceStatus(student._id, "absent")}
                          className="flex-1 md:flex-none"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Absent
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={attendance[student._id]?.status === "excused" ? "secondary" : "outline"}
                          onClick={() => updateAttendanceStatus(student._id, "excused")}
                          className="flex-1 md:flex-none"
                        >
                          Excused
                        </Button>
                      </div>
                      
                      <Input
                        type="text"
                        placeholder="Notes (optional)"
                        value={attendance[student._id]?.notes || ""}
                        onChange={(e) => updateAttendanceNotes(student._id, e.target.value)}
                        className="md:w-48"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {showAllStudents && allStudents.length > students.length && (
          <Card className="p-6 mb-6 bg-gray-50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Other Students ({allStudents.length - students.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Students not in class categories but can still attend
              </p>
            </div>
            <div className="space-y-3">
              {allStudents
                .filter(student => !students.some(s => s._id === student._id))
                .filter(student => showOnlyActive ? student.active !== false : true)
                .map((student) => (
                  <Card key={student._id} className="p-4 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{student.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.belt_level} | {student.categories.join(", ")}
                        </p>
                      </div>
                      
                      <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={attendance[student._id]?.status === "present" ? "default" : "outline"}
                            onClick={() => updateAttendanceStatus(student._id, "present")}
                            className="flex-1 md:flex-none"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Present
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={attendance[student._id]?.status === "absent" ? "destructive" : "outline"}
                            onClick={() => updateAttendanceStatus(student._id, "absent")}
                            className="flex-1 md:flex-none"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Absent
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={attendance[student._id]?.status === "excused" ? "secondary" : "outline"}
                            onClick={() => updateAttendanceStatus(student._id, "excused")}
                            className="flex-1 md:flex-none"
                          >
                            Excused
                          </Button>
                        </div>
                        
                        <Input
                          type="text"
                          placeholder="Notes (optional)"
                          value={attendance[student._id]?.notes || ""}
                          onChange={(e) => updateAttendanceNotes(student._id, e.target.value)}
                          className="md:w-48"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving || students.length === 0}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Attendance"}
          </Button>
        </div>
      </form>
    </div>
  );
}
