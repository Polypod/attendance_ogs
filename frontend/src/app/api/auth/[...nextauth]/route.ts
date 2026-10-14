// frontend/src/app/api/auth/[...nextauth]/route.ts - NextAuth configuration
import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions, OGS_PROVIDER_ID } from "@/lib/authOptions";
import { ogsSignInErrorPath } from "@/lib/ogsSignInErrors";

const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

/**
 * OGS answers a denied sign-in with ?error=access_denied, which NextAuth
 * reduces to a generic "Callback" error. Show the reason instead.
 */
async function GET(req: NextRequest, ctx: RouteContext) {
  const url = new URL(req.url);
  if (url.pathname.endsWith(`/callback/${OGS_PROVIDER_ID}`) && url.searchParams.has("error")) {
    const reason = url.searchParams.get("error") === "access_denied" ? "ogs_role_missing" : "failed";
    const base = process.env.NEXTAUTH_URL?.trim() || url.origin;
    return NextResponse.redirect(new URL(ogsSignInErrorPath(reason), base));
  }
  return handler(req, ctx);
}

export { GET, handler as POST };
