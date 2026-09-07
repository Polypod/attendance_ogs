import { formatDateToIso, type AttendanceRecord } from "../utils";

export type ApiStudentRef = string | { _id: string };
export type ApiAttendance = {
  date?: string;
  student_id: ApiStudentRef;
  status?: AttendanceRecord["status"];
  notes?: string;
};

export type SessionLike = {
  date: string;
  status?: string;
  notes?: string;
  "S-instructor"?: string;
};

export function filterAttendanceForSessionDate(
  attendance: ApiAttendance[],
  sessionDateYmd: string
): ApiAttendance[] {
  return attendance.filter((a) => {
    if (!a.date) return true;
    return a.date.split("T")[0] === sessionDateYmd;
  });
}

export function buildInitialAttendanceMap(
  allStudents: Array<{ _id: string }>,
  existingAttendance: ApiAttendance[]
): Record<string, AttendanceRecord> {
  const initialAttendance: Record<string, AttendanceRecord> = {};

  allStudents.forEach((student) => {
    const existing = existingAttendance.find((a) => {
      const studentId = typeof a.student_id === "string" ? a.student_id : a.student_id._id;
      return studentId === student._id;
    });

    if (existing) {
      initialAttendance[student._id] = {
        student_id: student._id,
        status: (existing.status ?? "absent") as AttendanceRecord["status"],
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

  return initialAttendance;
}

export function buildUpdatedScheduleSessions(
  existingSessions: SessionLike[],
  sessionDateYmd: string,
  sessionInstructor: string,
  sessionNotes: string
): Array<Required<Pick<SessionLike, "date" | "notes" | "S-instructor">> & Pick<SessionLike, "status">> {
  const sessionIndex = existingSessions.findIndex((s) => s.date.split("T")[0] === sessionDateYmd);

  if (sessionIndex >= 0) {
    return existingSessions.map((session, index) => {
      if (index === sessionIndex) {
        return {
          date: session.date,
          "S-instructor": sessionInstructor,
          notes: sessionNotes,
          status: "completed" as const,
        };
      }

      return {
        date: session.date,
        "S-instructor": session["S-instructor"] || "",
        notes: session.notes || "",
        status: session.status,
      };
    });
  }

  const sessionDateISO = formatDateToIso(sessionDateYmd);
  return [
    ...existingSessions.map((s) => ({
      date: s.date,
      "S-instructor": s["S-instructor"] || "",
      notes: s.notes || "",
      status: s.status,
    })),
    {
      date: sessionDateISO,
      "S-instructor": sessionInstructor,
      notes: sessionNotes,
      status: "completed" as const,
    },
  ];
}
