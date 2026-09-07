import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/authOptions";

type ExportPayload = {
  mode: "raw" | "aggregate";
  [key: string]: any;
};

const getBackendUrl = (): string => {
  const envApiUrl = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  return envApiUrl || "http://localhost:4000";
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const payloadRaw = form.get("payload");

  if (typeof payloadRaw !== "string" || !payloadRaw) {
    return new Response("Missing payload", { status: 400 });
  }

  let payload: ExportPayload;
  try {
    payload = JSON.parse(payloadRaw) as ExportPayload;
  } catch {
    return new Response("Invalid payload JSON", { status: 400 });
  }

  const backendUrl = getBackendUrl();

  const path =
    payload.mode === "aggregate"
      ? "/api/reports/attendance/aggregate/export/csv"
      : "/api/reports/attendance/raw/export/csv";

  const backendRes = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const headers = new Headers();
  const contentType = backendRes.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const contentDisposition = backendRes.headers.get("content-disposition");
  if (contentDisposition) headers.set("content-disposition", contentDisposition);

  const cacheControl = backendRes.headers.get("cache-control");
  if (cacheControl) headers.set("cache-control", cacheControl);

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers,
  });
}
