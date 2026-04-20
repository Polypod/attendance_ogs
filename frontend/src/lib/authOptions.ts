import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { logger } from "@/lib/logger";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Call backend login endpoint
          // Use BACKEND_URL for server-side requests (supports remote development)
          const envApiUrl =
            process.env.BACKEND_URL?.trim() ||
            process.env.NEXT_PUBLIC_API_URL?.trim();

          // In dev, default backend is the Express server on :4000.
          // In production, require an explicit env var to avoid accidentally calling the wrong host.
          const apiUrl =
            envApiUrl ||
            (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");

          if (!apiUrl) {
            logger.error("nextauth_missing_backend_url");
            return null;
          }

          const res = await fetch(`${apiUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const responseText = await res.text();
          let data: any = null;
          try {
            data = responseText ? JSON.parse(responseText) : null;
          } catch {
            data = null;
          }

          if (res.ok && data.success && data.user) {
            // Return user object with tokens
            return {
              id: data.user._id,
              email: data.user.email,
              name: data.user.name,
              role: data.user.role,
              accessToken: data.token,
              refreshToken: data.refreshToken,
            } as any;
          }

          // Login failed
          return null;
        } catch (error) {
          logger.error("nextauth_authentication_error", {
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom fields to session
      if (token) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;
        (session as any).accessToken = (token as any).accessToken;
        (session as any).refreshToken = (token as any).refreshToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
