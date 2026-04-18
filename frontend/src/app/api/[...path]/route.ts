import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendUrl(): string {
  const backendUrl = process.env.BACKEND_URL?.trim();
  if (backendUrl) return backendUrl;

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApiUrl) return publicApiUrl;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing BACKEND_URL (or NEXT_PUBLIC_API_URL) for Next.js API proxy"
    );
  }

  return "http://localhost:4000";
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  let backendUrl: string;
  try {
    backendUrl = getBackendUrl();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Configuration error";
    return Response.json({ error: message }, { status: 500 });
  }

  const incomingUrl = new URL(req.url);
  const path = pathSegments.join("/");
  const targetUrl = `${backendUrl}/api/${path}${incomingUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream fetch failed";
    return Response.json(
      { error: "Proxy request failed", details: message },
      { status: 502 }
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, ctx: RouteContext) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
