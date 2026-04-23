import { buildReportPresetState } from "@/app/dashboard/reports/presetStateBuilders";

describe("reports/presetStateBuilders", () => {
  it("normalizes empty values to undefined and trims search", () => {
    const state = buildReportPresetState({
      mode: "raw",
      groupBy: "student",
      from: "2026-01-01",
      to: "2026-01-31",
      search: "   ",
      pageSize: 50,
      sortBy: null,
      sortDir: "asc",
      studentIds: [],
      classIds: [],
      instructors: [],
      status: [],
      selectedSessionKeys: [],
      onlyActiveStudents: true,
      rawColumnVisibility: { date: true },
      aggregatedColumnVisibility: { presentCount: true },
    });

    expect(state).toEqual({
      mode: "raw",
      groupBy: "student",
      from: "2026-01-01",
      to: "2026-01-31",
      search: undefined,
      pageSize: 50,
      sortBy: undefined,
      sortDir: undefined,
      studentIds: undefined,
      classIds: undefined,
      instructors: undefined,
      status: undefined,
      sessions: undefined,
      onlyActiveStudents: true,
      rawColumnVisibility: { date: true },
      aggregatedColumnVisibility: { presentCount: true },
    });
  });

  it("keeps non-empty filters and session mappings", () => {
    const state = buildReportPresetState({
      mode: "aggregate",
      groupBy: "class",
      from: "2026-01-01",
      to: "2026-01-31",
      search: "  alice  ",
      pageSize: 25,
      sortBy: "date",
      sortDir: "desc",
      studentIds: ["s1"],
      classIds: ["c1"],
      instructors: ["Sensei"],
      status: ["present"],
      selectedSessionKeys: ["sched1:2026-01-02", "bad"],
      onlyActiveStudents: false,
      rawColumnVisibility: { date: true },
      aggregatedColumnVisibility: { presentCount: true },
    });

    expect(state.search).toBe("alice");
    expect(state.sortBy).toBe("date");
    expect(state.sortDir).toBe("desc");

    expect(state.studentIds).toEqual(["s1"]);
    expect(state.classIds).toEqual(["c1"]);
    expect(state.instructors).toEqual(["Sensei"]);
    expect(state.status).toEqual(["present"]);

    expect(state.sessions).toEqual([{ classScheduleId: "sched1", date: "2026-01-02" }]);
    expect(state.onlyActiveStudents).toBe(false);
  });
});
