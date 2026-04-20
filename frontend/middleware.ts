import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const nextAction = request.headers.get("next-action");

  // Bots/scanners sometimes probe Next.js Server Actions by sending a bogus
  // `next-action` header (e.g. "x", "hi", "run"), which causes noisy errors.
  // We don't use Server Actions in this app, so we can safely reject obviously
  // invalid action identifiers.
  if (nextAction) {
    const value = nextAction.trim();

    // Legit action IDs are long (hash-like). Short values are almost certainly probes.
    if (value.length > 0 && value.length < 10) {
      return new NextResponse(null, { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run for all routes except static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
