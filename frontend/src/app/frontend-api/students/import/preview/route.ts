import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/authOptions";

const getBackendUrl = (): string => {
  const envApiUrl = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  return envApiUrl || "http://localhost:4000";
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const backendResponse = await fetch(`${getBackendUrl()}/api/students/import/preview`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await backendResponse.text();

  return new Response(payload, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") ?? "application/json",
    },
  });
}