import {
  buildInitialAttendanceMap,
  buildUpdatedScheduleSessions,
  filterAttendanceForSessionDate,
  type ApiAttendance,
  type SessionLike,
} from "../../../../app/dashboard/attendance/[scheduleId]/attendanceHelpers";
import { formatDateToIso } from "../../../../app/dashboard/attendance/utils";

describe("attendanceHelpers", () => {
  describe("filterAttendanceForSessionDate", () => {
    it("keeps records with missing date and matching YYYY-MM-DD", () => {
      const records: ApiAttendance[] = [
        { student_id: "s1", status: "present", notes: "ok", date: "2026-01-08T00:00:00.000Z" },
        { student_id: "s2", status: "absent", notes: "", date: "2026-01-09T00:00:00.000Z" },
        { student_id: "s3", status: "excused", notes: "" },
      ];

      const filtered = filterAttendanceForSessionDate(records, "2026-01-08");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => (typeof r.student_id === "string" ? r.student_id : r.student_id._id)).sort()).toEqual(
        ["s1", "s3"]
      );
    });
  });

  describe("buildInitialAttendanceMap", () => {
    it("uses existing attendance per student and defaults others to absent", () => {
      const allStudents = [{ _id: "s1" }, { _id: "s2" }, { _id: "s3" }];
      const existing: ApiAttendance[] = [
        { student_id: "s1", status: "present", notes: "On time" },
        { student_id: { _id: "s2" }, status: "excused", notes: "Sick" },
      ];

      const initial = buildInitialAttendanceMap(allStudents, existing);

      expect(initial).toMatchObject({
        s1: { student_id: "s1", status: "present", notes: "On time" },
        s2: { student_id: "s2", status: "excused", notes: "Sick" },
        s3: { student_id: "s3", status: "absent", notes: "" },
      });
    });

    it("treats missing status as absent", () => {
      const allStudents = [{ _id: "s1" }];
      const existing: ApiAttendance[] = [{ student_id: "s1", notes: "" }];

      const initial = buildInitialAttendanceMap(allStudents, existing);
      expect(initial.s1.status).toBe("absent");
    });
  });

  describe("buildUpdatedScheduleSessions", () => {
    it("adds a new completed session when none exists for date", () => {
      const existing: SessionLike[] = [
        {
          date: "2026-01-01T00:00:00.000Z",
          "S-instructor": "A",
          notes: "old",
          status: "completed",
        },
      ];

      const updated = buildUpdatedScheduleSessions(existing, "2026-01-08", "Sensei B", "Note");

      expect(updated).toHaveLength(2);
      expect(updated[1]).toMatchObject({
        date: formatDateToIso("2026-01-08"),
        "S-instructor": "Sensei B",
        notes: "Note",
        status: "completed",
      });
    });

    it("updates the existing session for date and normalizes other sessions", () => {
      const existing: SessionLike[] = [
        {
          date: "2026-01-08T00:00:00.000Z",
          "S-instructor": "Old",
          notes: "Old note",
          status: "planned",
        },
        {
          date: "2026-01-15T00:00:00.000Z",
          status: "planned",
        },
      ];

      const updated = buildUpdatedScheduleSessions(existing, "2026-01-08", "New", "New note");

      expect(updated).toHaveLength(2);
      expect(updated[0]).toMatchObject({
        date: "2026-01-08T00:00:00.000Z",
        "S-instructor": "New",
        notes: "New note",
        status: "completed",
      });

      expect(updated[1]).toMatchObject({
        date: "2026-01-15T00:00:00.000Z",
        "S-instructor": "",
        notes: "",
        status: "planned",
      });
    });
  });
});
