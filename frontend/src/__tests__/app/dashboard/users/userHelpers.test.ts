import {
  buildEditUserFormFromUser,
  formatLastLogin,
  getRoleBadgeColor,
  getStatusBadgeColor,
} from "../../../../app/dashboard/users/userHelpers";

describe("userHelpers", () => {
  describe("buildEditUserFormFromUser", () => {
    it("maps user to edit form", () => {
      expect(
        buildEditUserFormFromUser({
          name: "Alice",
          role: "admin",
          status: "active",
        })
      ).toEqual({ name: "Alice", role: "admin", status: "active" });
    });
  });

  describe("getRoleBadgeColor", () => {
    it("returns known classes per role", () => {
      expect(getRoleBadgeColor("admin")).toContain("bg-red-100");
      expect(getRoleBadgeColor("instructor")).toContain("bg-blue-100");
      expect(getRoleBadgeColor("staff")).toContain("bg-green-100");
      expect(getRoleBadgeColor("student")).toContain("bg-gray-100");
    });
  });

  describe("getStatusBadgeColor", () => {
    it("returns known classes per status", () => {
      expect(getStatusBadgeColor("active")).toContain("bg-green-100");
      expect(getStatusBadgeColor("inactive")).toContain("bg-gray-100");
      expect(getStatusBadgeColor("suspended")).toContain("bg-red-100");
    });
  });

  describe("formatLastLogin", () => {
    it("returns Never when missing", () => {
      expect(formatLastLogin(undefined)).toBe("Never");
      expect(formatLastLogin("")).toBe("Never");
    });

    it("formats the date using locale", () => {
      const iso = "2026-01-08T00:00:00.000Z";
      expect(formatLastLogin(iso)).toBe(new Date(iso).toLocaleDateString());
    });
  });
});
