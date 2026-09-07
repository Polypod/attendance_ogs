import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

const getBackendUrl = (): string => {
  const envApiUrl = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  return envApiUrl || "http://localhost:4000";
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const backendResponse = await fetch(`${getBackendUrl()}/api/students/export/csv`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const headers = new Headers();
  const contentType = backendResponse.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const contentDisposition = backendResponse.headers.get("content-disposition");
  if (contentDisposition) headers.set("content-disposition", contentDisposition);

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers,
  });
}