import { describeOgsSignInError, ogsSignInErrorPath } from "@/lib/ogsSignInErrors";

describe("ogsSignInErrors", () => {
  it("keeps known reasons in the login path", () => {
    expect(ogsSignInErrorPath("not_linked")).toBe("/login?error=OgsSignIn&reason=not_linked");
    expect(ogsSignInErrorPath("ogs_role_missing")).toBe("/login?error=OgsSignIn&reason=ogs_role_missing");
  });

  it("reduces unknown reasons to a generic failure", () => {
    expect(ogsSignInErrorPath("token_replayed")).toBe("/login?error=OgsSignIn&reason=failed");
    expect(ogsSignInErrorPath(undefined)).toBe("/login?error=OgsSignIn&reason=failed");
    expect(ogsSignInErrorPath("<script>")).toBe("/login?error=OgsSignIn&reason=failed");
  });

  it("explains each reason", () => {
    expect(describeOgsSignInError("not_linked")).toMatch(/not linked/);
    expect(describeOgsSignInError("sso_disabled")).toMatch(/not enabled/);
    expect(describeOgsSignInError("ogs_role_missing")).toMatch(/admin or editor/);
    expect(describeOgsSignInError("ogs_unavailable")).toMatch(/could not be reached/);
    expect(describeOgsSignInError("failed")).toBe("Sign-in through OGS failed. Please try again.");
    expect(describeOgsSignInError(null)).toBe("Sign-in through OGS failed. Please try again.");
  });
});
