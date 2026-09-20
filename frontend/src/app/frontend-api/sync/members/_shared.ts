import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

const getBackendUrl = (): string => {
  const envApiUrl = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  return envApiUrl || "http://localhost:4000";
};

/**
 * Proxy a member sync call to the backend using the caller's own token, so the
 * backend's admin authorization stays the single place that guards the sync.
 */
export const proxyMemberSync = async (
  path: string,
  method: "GET" | "POST",
): Promise<Response> => {
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const backendResponse = await fetch(`${getBackendUrl()}/api/sync/members${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await backendResponse.text();

  return new Response(payload, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") ?? "application/json",
    },
  });
};
