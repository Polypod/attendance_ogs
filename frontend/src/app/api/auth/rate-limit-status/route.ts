// Server-side proxy for rate limit status check – no login attempt consumed
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  try {
    const res = await fetch(`${apiUrl}/api/auth/rate-limit-status`, {
      headers: {
        "X-Forwarded-For": clientIp,
        "X-Real-IP": clientIp
      }
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ rateLimited: false, resetAt: null });
  }
}
