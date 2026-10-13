// frontend/src/types/next-auth.d.ts - Extend NextAuth types
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    accessToken: string;
    refreshToken?: string;
  }

  // The refresh token stays in the encrypted JWT cookie and is never part
  // of the session object sent to the browser.
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    accessToken: string;
    error?: "RefreshAccessTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    accessToken: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: "RefreshAccessTokenError";
  }
}
