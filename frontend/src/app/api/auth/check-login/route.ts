// Server-side proxy for login pre-check – avoids client trying to reach localhost
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const apiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // Forward the real client IP so the backend rate limiter works per user
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": clientIp,
        "X-Real-IP": clientIp
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    const nextRes = NextResponse.json(data, { status: res.status });
    // Forward rate limit headers so the client can show an accurate countdown
    const resetHeader = res.headers.get("RateLimit-Reset");
    if (resetHeader) nextRes.headers.set("RateLimit-Reset", resetHeader);
    return nextRes;
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach authentication server" },
      { status: 503 }
    );
  }
}
