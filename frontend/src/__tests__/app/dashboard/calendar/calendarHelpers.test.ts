import {
  attendanceCountKey,
  countPresentAttendance,
  dayValuesToNumbers,
  daysOfWeekToValues,
  filterAttendanceForScheduleDate,
  isoDatePart,
} from "@/app/dashboard/calendar/calendarHelpers";

describe("calendarHelpers", () => {
  describe("isoDatePart", () => {
    it("returns the YYYY-MM-DD part", () => {
      expect(isoDatePart("2026-01-02T10:11:12.000Z")).toBe("2026-01-02");
    });
  });

  describe("filterAttendanceForScheduleDate", () => {
    it("keeps legacy records without a date and filters by schedule date", () => {
      const scheduleDate = "2026-02-10";
      const attendance = [
        { _id: "a1", status: "present", date: "2026-02-10T08:00:00.000Z" },
        { _id: "a2", status: "absent", date: "2026-02-11T08:00:00.000Z" },
        { _id: "a3", status: "present" }, // legacy format
      ];

      const filtered = filterAttendanceForScheduleDate(attendance, scheduleDate);
      expect(filtered.map((a) => a._id)).toEqual(["a1", "a3"]);
    });
  });

  describe("countPresentAttendance", () => {
    it("counts only status === present", () => {
      const attendance = [
        { status: "present" },
        { status: "absent" },
        { status: "present" },
      ];

      expect(countPresentAttendance(attendance)).toBe(2);
    });
  });

  describe("attendanceCountKey", () => {
    it("formats scheduleId + date", () => {
      expect(attendanceCountKey("sch1", "2026-01-01")).toBe("sch1-2026-01-01");
    });
  });

  describe("dayValuesToNumbers", () => {
    it("maps selected day values to numeric days when recurring", () => {
      expect(dayValuesToNumbers(["monday", "sunday", "unknown"], "2026-01-01", true)).toEqual([
        1,
        0,
        0,
      ]);
    });
  });

  describe("daysOfWeekToValues", () => {
    it("converts numeric days to string values", () => {
      expect(daysOfWeekToValues([1, 3, 0], undefined)).toEqual([
        "monday",
        "wednesday",
        "sunday",
      ]);
    });

    it("keeps string values as-is", () => {
      expect(daysOfWeekToValues(["monday", "tuesday"], undefined)).toEqual([
        "monday",
        "tuesday",
      ]);
    });

    it("falls back to legacy single day_of_week", () => {
      expect(daysOfWeekToValues(undefined, "friday")).toEqual(["friday"]);
    });

    it("filters unknown numeric values", () => {
      expect(daysOfWeekToValues([999], undefined)).toEqual([]);
    });
  });
});
