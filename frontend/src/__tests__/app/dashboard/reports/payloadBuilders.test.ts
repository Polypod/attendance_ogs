import {
  buildAttendanceExportPayload,
  buildAttendanceFiltersPayload,
  buildAttendanceReportRequestBody,
} from "@/app/dashboard/reports/payloadBuilders";

describe("reports/payloadBuilders", () => {
  describe("buildAttendanceFiltersPayload", () => {
    it("includes required fields and omits empty optional fields", () => {
      const payload = buildAttendanceFiltersPayload({
        from: "2026-01-01",
        to: "2026-01-31",
        search: "   ",
        sortBy: null,
        sortDir: "asc",
        onlyActiveStudents: false,
        studentIds: [],
        selectedSessionKeys: [],
        classIds: [],
        instructors: [],
        status: [],
      });

      expect(payload).toEqual({
        from: "2026-01-01",
        to: "2026-01-31",
      });
    });

    it("trims search, includes sort and maps sessions", () => {
      const payload = buildAttendanceFiltersPayload({
        from: "2026-01-01",
        to: "2026-01-31",
        search: "  alice  ",
        sortBy: "date",
        sortDir: "desc",
        onlyActiveStudents: true,
        studentIds: ["s1"],
        selectedSessionKeys: ["sched1:2026-01-02", "bad", "sched2:2026-01-03"],
        classIds: ["c1"],
        instructors: ["Sensei"],
        status: ["present"],
      });

      expect(payload.search).toBe("alice");
      expect(payload.sortBy).toBe("date");
      expect(payload.sortDir).toBe("desc");
      expect(payload.onlyActiveStudents).toBe(true);
      expect(payload.studentIds).toEqual(["s1"]);
      expect(payload.classIds).toEqual(["c1"]);
      expect(payload.instructors).toEqual(["Sensei"]);
      expect(payload.status).toEqual(["present"]);

      expect(payload.sessions).toEqual([
        { classScheduleId: "sched1", date: "2026-01-02" },
        { classScheduleId: "sched2", date: "2026-01-03" },
      ]);
    });
  });

  describe("buildAttendanceReportRequestBody", () => {
    it("adds groupBy only for aggregate mode", () => {
      const common = {
        from: "2026-01-01",
        to: "2026-01-31",
        search: "",
        sortBy: null as const,
        sortDir: "asc" as const,
        onlyActiveStudents: true,
        studentIds: [],
        selectedSessionKeys: [],
        classIds: [],
        instructors: [],
        status: ["present"],
        page: 2,
        pageSize: 25,
      };

      const rawBody = buildAttendanceReportRequestBody({
        ...common,
        mode: "raw",
        groupBy: "student",
      });
      expect(rawBody.groupBy).toBeUndefined();
      expect(rawBody.page).toBe(2);
      expect(rawBody.pageSize).toBe(25);

      const aggregatedBody = buildAttendanceReportRequestBody({
        ...common,
        mode: "aggregate",
        groupBy: "student",
      });
      expect(aggregatedBody.groupBy).toBe("student");
    });
  });

  describe("buildAttendanceExportPayload", () => {
    it("always includes mode + columns and adds groupBy only for aggregate", () => {
      const common = {
        from: "2026-01-01",
        to: "2026-01-31",
        search: "",
        sortBy: null as const,
        sortDir: "asc" as const,
        onlyActiveStudents: true,
        studentIds: [],
        selectedSessionKeys: [],
        classIds: [],
        instructors: [],
        status: ["present"],
        columns: ["date", "student_name"],
      };

      const rawPayload = buildAttendanceExportPayload({
        ...common,
        mode: "raw",
        groupBy: "student",
      });

      expect(rawPayload.mode).toBe("raw");
      expect(rawPayload.columns).toEqual(["date", "student_name"]);
      expect(rawPayload.groupBy).toBeUndefined();

      const aggregatedPayload = buildAttendanceExportPayload({
        ...common,
        mode: "aggregate",
        groupBy: "student",
      });

      expect(aggregatedPayload.mode).toBe("aggregate");
      expect(aggregatedPayload.columns).toEqual(["date", "student_name"]);
      expect(aggregatedPayload.groupBy).toBe("student");
    });
  });
});
