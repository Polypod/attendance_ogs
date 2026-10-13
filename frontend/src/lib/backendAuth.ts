// frontend/src/lib/backendAuth.ts - Server-side calls from NextAuth to the backend
import type { JWT } from "next-auth/jwt";
import { logger } from "@/lib/logger";

// Refresh this long before the access token expires, so a request made right
// after a session fetch still carries a valid token.
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

export type BackendSession = {
  id: string;
  email: string;
  name: string;
  role: string;
  accessToken: string;
  refreshToken: string;
};

export function getBackendUrl(): string {
  // Use BACKEND_URL for server-side requests (supports remote development)
  const envApiUrl =
    process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();

  // In dev, default backend is the Express server on :4000.
  // In production, require an explicit env var to avoid accidentally calling the wrong host.
  return envApiUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");
}

/**
 * Expiry (ms since epoch) of a backend access token. The token is only
 * decoded, not verified: it came straight from the backend.
 */
export function getAccessTokenExpiry(accessToken: string): number | undefined {
  try {
    const [, payload] = accessToken.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? json.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Exchange the ID token OGS issued for an attendance session. The backend
 * verifies the token's signature itself; the shared secret only proves the
 * call comes from this server.
 */
export async function exchangeOgsIdToken(
  idToken: string
): Promise<{ session: BackendSession } | { error: string }> {
  const apiUrl = getBackendUrl();
  const secret = process.env.SSO_INTERNAL_SECRET?.trim();
  if (!apiUrl || !secret) {
    logger.error("nextauth_ogs_sso_not_configured");
    return { error: "not_configured" };
  }

  try {
    const res = await fetch(`${apiUrl}/api/auth/sso/ogs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
      body: JSON.stringify({ idToken }),
    });
    const data = await readJson(res);

    if (res.ok && data?.success && data.user) {
      return {
        session: {
          id: data.user._id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          accessToken: data.token,
          refreshToken: data.refreshToken,
        },
      };
    }

    logger.warn("nextauth_ogs_sso_denied", { status: res.status, code: data?.code });
    return { error: typeof data?.code === "string" ? data.code : "denied" };
  } catch (error) {
    logger.error("nextauth_ogs_sso_error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { error: "unavailable" };
  }
}

/**
 * Renew the access token kept in the NextAuth JWT. For an OGS session the
 * backend re-checks OGS here, which is what ends a session whose OGS role
 * was removed. On failure the token is marked so the session ends.
 */
export async function refreshAccessToken(token: JWT): Promise<JWT> {
  const apiUrl = getBackendUrl();
  if (!apiUrl || !token.refreshToken) {
    return { ...token, accessToken: "", error: "RefreshAccessTokenError" };
  }

  try {
    const res = await fetch(`${apiUrl}/api/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });
    const data = await readJson(res);

    // 401/403 mean the session is over (expired refresh token, account or
    // OGS role removed). Anything else is transient: keep the session and
    // try again at the next session fetch.
    if (res.status === 401 || res.status === 403) {
      logger.warn("nextauth_refresh_denied", { status: res.status, code: data?.code });
      return { ...token, accessToken: "", error: "RefreshAccessTokenError" };
    }
    if (!res.ok || !data?.success || typeof data.token !== "string") {
      logger.warn("nextauth_refresh_failed", { status: res.status, code: data?.code });
      return token;
    }

    return {
      ...token,
      accessToken: data.token,
      accessTokenExpires: getAccessTokenExpiry(data.token),
      role: typeof data.role === "string" ? data.role : token.role,
      error: undefined,
    };
  } catch (error) {
    // A network failure is not a revocation either. The backend still
    // rejects the expired access token meanwhile.
    logger.error("nextauth_refresh_error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return token;
  }
}
