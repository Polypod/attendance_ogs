import {
  buildCreateStudentPayload,
  buildUpdateStudentPayload,
  computeAttendanceStats,
  filterStudentsByActive,
} from "@/app/dashboard/students/studentHelpers";

describe("studentHelpers", () => {
  describe("buildCreateStudentPayload", () => {
    it("omits empty phone and emergency_contact", () => {
      const payload = buildCreateStudentPayload({
        name: "Alice",
        categories: ["kids"],
        belt_level: "white",
        email: "a@example.com",
        phone: "   ",
        emergency_contact: { name: " ", phone: "" },
        active: true,
      });

      expect(payload).toEqual({
        name: "Alice",
        categories: ["kids"],
        belt_level: "white",
        email: "a@example.com",
        active: true,
      });
    });

    it("keeps trimmed phone and only filled emergency_contact fields", () => {
      const payload = buildCreateStudentPayload({
        name: "Bob",
        categories: ["adult"],
        belt_level: "yellow",
        email: "b@example.com",
        phone: "  070-123  ",
        emergency_contact: { name: "  Mom ", phone: "" },
        active: true,
      });

      expect(payload).toEqual({
        name: "Bob",
        categories: ["adult"],
        belt_level: "yellow",
        email: "b@example.com",
        phone: "070-123",
        emergency_contact: { name: "Mom" },
        active: true,
      });
    });
  });

  describe("buildUpdateStudentPayload", () => {
    it("sets phone to null when cleared", () => {
      const payload = buildUpdateStudentPayload({
        name: "Alice",
        categories: ["kids"],
        belt_level: "white",
        phone: "",
        emergency_contact: { name: "X", phone: "Y" },
        active: true,
      });

      expect(payload.phone).toBeNull();
    });

    it("sets emergency_contact to null when both empty", () => {
      const payload = buildUpdateStudentPayload({
        name: "Alice",
        categories: ["kids"],
        belt_level: "white",
        phone: "070",
        emergency_contact: { name: " ", phone: "" },
        active: true,
      });

      expect(payload.emergency_contact).toBeNull();
    });

    it("sets empty emergency_contact fields to null", () => {
      const payload = buildUpdateStudentPayload({
        name: "Alice",
        categories: ["kids"],
        belt_level: "white",
        phone: "070",
        emergency_contact: { name: "Dad", phone: "  " },
        active: true,
      });

      expect(payload.emergency_contact).toEqual({ name: "Dad", phone: null });
    });
  });

  describe("filterStudentsByActive", () => {
    it("filters out inactive when showOnlyActive=true", () => {
      const students = [
        { _id: "1", active: true },
        { _id: "2", active: false },
        { _id: "3" }, // undefined treated as active
      ];

      expect(filterStudentsByActive(students, true).map((s) => s._id)).toEqual(["1", "3"]);
    });

    it("keeps all when showOnlyActive=false", () => {
      const students = [{ _id: "1", active: false }];
      expect(filterStudentsByActive(students, false)).toHaveLength(1);
    });
  });

  describe("computeAttendanceStats", () => {
    it("computes counts and percentage", () => {
      const records = [
        { status: "present" },
        { status: "late" },
        { status: "excused" },
        { status: "absent" },
      ];

      const stats = computeAttendanceStats(records);
      expect(stats).toEqual({
        total: 4,
        present: 1,
        late: 1,
        excused: 1,
        absent: 1,
        pct: 63, // (1 + 1 + 0.5) / 4 = 0.625 => 63
      });
    });

    it("returns pct=0 when empty", () => {
      expect(computeAttendanceStats([])).toEqual({
        total: 0,
        present: 0,
        late: 0,
        excused: 0,
        absent: 0,
        pct: 0,
      });
    });
  });
});
