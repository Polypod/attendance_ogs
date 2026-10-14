/** @jest-environment node */

const handler = jest.fn(async () => new Response("nextauth"));

jest.mock("next-auth", () => ({ __esModule: true, default: () => handler }));
jest.mock("@/lib/authOptions", () => ({ authOptions: {}, OGS_PROVIDER_ID: "ogs" }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/auth/[...nextauth]/route";

const ctx = { params: Promise.resolve({ nextauth: ["callback", "ogs"] }) };

describe("NextAuth route", () => {
  const env = process.env;

  beforeEach(() => {
    handler.mockClear();
    process.env = { ...env, NEXTAUTH_URL: "https://att.minamail.se" };
  });
  afterAll(() => {
    process.env = env;
  });

  it("shows why OGS denied the sign-in", async () => {
    const res = await GET(
      new NextRequest("http://localhost:4011/api/auth/callback/ogs?error=access_denied&state=x"),
      ctx
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://att.minamail.se/login?error=OgsSignIn&reason=ogs_role_missing"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports other OGS errors as a generic failure", async () => {
    const res = await GET(new NextRequest("http://localhost:4011/api/auth/callback/ogs?error=server_error"), ctx);
    expect(res.headers.get("location")).toBe("https://att.minamail.se/login?error=OgsSignIn&reason=failed");
  });

  it("leaves successful callbacks and other routes to NextAuth", async () => {
    await GET(new NextRequest("http://localhost:4011/api/auth/callback/ogs?code=abc&state=x"), ctx);
    await GET(new NextRequest("http://localhost:4011/api/auth/session"), ctx);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
