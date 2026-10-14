import {
  buildEditUserFormFromUser,
  buildOgsLinkChanges,
  formatLastLogin,
  getOgsGrantedRole,
  getOgsLinkFromUser,
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

  describe("OGS link", () => {
    const unlinked = { ogs_user_id: "", sso_enabled: false };
    const linked = { ogs_user_id: "ogs1", sso_enabled: true };

    it("reads the link from a user", () => {
      expect(getOgsLinkFromUser({})).toEqual(unlinked);
      expect(
        getOgsLinkFromUser({ external_identity: { subject: "ogs1" }, sso_enabled: true })
      ).toEqual(linked);
    });

    it("sends nothing when the link is unchanged", () => {
      expect(buildOgsLinkChanges(linked, { ...linked })).toEqual({});
      expect(buildOgsLinkChanges(unlinked, { ...unlinked })).toEqual({});
    });

    it("links and enables in one change", () => {
      expect(buildOgsLinkChanges(unlinked, linked)).toEqual({ ogs_user_id: "ogs1", sso_enabled: true });
    });

    it("links without enabling", () => {
      expect(buildOgsLinkChanges(unlinked, { ogs_user_id: " ogs1 ", sso_enabled: false })).toEqual({
        ogs_user_id: "ogs1",
      });
    });

    it("toggles only the checkbox", () => {
      expect(buildOgsLinkChanges(linked, { ...linked, sso_enabled: false })).toEqual({ sso_enabled: false });
    });

    it("unlinks with null and turns SSO off", () => {
      expect(buildOgsLinkChanges(linked, { ogs_user_id: "", sso_enabled: true })).toEqual({
        ogs_user_id: null,
        sso_enabled: false,
      });
    });

    it("mirrors the backend role rule", () => {
      const account = { id: "1", email: "a", displayName: "A", roles: ["editor"], status: "approved", isActive: null };
      expect(getOgsGrantedRole(account)).toBe("editor");
      expect(getOgsGrantedRole({ ...account, roles: ["editor", "admin"] })).toBe("admin");
      expect(getOgsGrantedRole({ ...account, isActive: false })).toBeNull();
      expect(getOgsGrantedRole({ ...account, status: "pending" })).toBeNull();
      expect(getOgsGrantedRole({ ...account, roles: ["member"] })).toBeNull();
      expect(getOgsGrantedRole(null)).toBeNull();
    });
  });
});

describe("formatApiError", () => {
  const { formatApiError } = jest.requireActual("../../../../app/dashboard/users/userHelpers");

  it("shows the backend message instead of the raw HTTP error", () => {
    const error = new Error(
      'HTTP 400 [requestId=abc]: {"success":false,"message":"OGS single sign-on is not configured (OGS_OIDC_ISSUER)"}'
    );
    expect(formatApiError(error, "Failed")).toBe("OGS single sign-on is not configured (OGS_OIDC_ISSUER)");
  });

  it("adds the detail when the backend gives one", () => {
    const error = new Error(
      'HTTP 400 [requestId=abc]: {"success":false,"message":"Validation error","error":"Password is required"}'
    );
    expect(formatApiError(error, "Failed")).toBe("Validation error: Password is required");
  });

  it("falls back for non-JSON bodies, other errors and non-errors", () => {
    expect(formatApiError(new Error("HTTP 502 [requestId=x]: Bad gateway"), "Failed")).toBe("Bad gateway");
    expect(formatApiError(new Error("Unauthorized"), "Failed")).toBe("Unauthorized");
    expect(formatApiError("nope", "Failed")).toBe("Failed");
  });
});
