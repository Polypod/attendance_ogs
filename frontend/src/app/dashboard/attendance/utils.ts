export function formatDateToIso(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map((s) => Number(s));
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

export type AttendanceRecord = {
  student_id: string;
  status: "present" | "absent" | "excused";
  notes: string;
};

export type StudentMinimal = { _id: string; categories: string[] };

export function buildAttendancePayload(
  attendance: Record<string, AttendanceRecord>,
  allStudents: StudentMinimal[],
  scheduleId: string,
  sessionDate: string
) {
  return Object.values(attendance).map((record) => {
    const student = allStudents.find((s) => s._id === record.student_id);
    return {
      student_id: record.student_id,
      class_schedule_id: scheduleId,
      date: formatDateToIso(sessionDate),
      status: record.status,
      notes: record.notes || undefined,
      category: student?.categories[0] || "vuxen",
    };
  });
}
