// frontend/src/lib/ogsSignInErrors.ts - Why a sign-in through OGS failed

// Reasons the backend (POST /api/auth/sso/ogs) and the OGS issuer report.
const MESSAGES: Record<string, string> = {
  not_linked:
    "Your OGS account is not linked to a user in attendance. Ask an administrator to link it under Users.",
  sso_disabled:
    "Sign-in through OGS is not enabled for your user. Ask an administrator to enable it under Users.",
  account_inactive: "Your attendance account is not active. Contact an administrator.",
  ogs_role_missing:
    "Your OGS account needs the admin or editor role, and must be approved and active, to sign in to attendance.",
  ogs_unavailable: "OGS could not be reached. Please try again in a moment.",
  unavailable: "OGS could not be reached. Please try again in a moment.",
  not_configured: "Sign-in through OGS is not configured. Contact an administrator.",
};

const GENERIC = "Sign-in through OGS failed. Please try again.";

/** Login page path that shows why a sign-in through OGS failed. */
export function ogsSignInErrorPath(reason: string | null | undefined): string {
  const known = reason && reason in MESSAGES ? reason : "failed";
  return `/login?error=OgsSignIn&reason=${encodeURIComponent(known)}`;
}

export function describeOgsSignInError(reason: string | null | undefined): string {
  return (reason && MESSAGES[reason]) || GENERIC;
}
