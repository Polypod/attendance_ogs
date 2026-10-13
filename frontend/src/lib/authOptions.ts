import type { NextAuthOptions } from "next-auth";
import type { OAuthConfig, Provider } from "next-auth/providers/index";
import CredentialsProvider from "next-auth/providers/credentials";
import { logger } from "@/lib/logger";
import {
  ACCESS_TOKEN_REFRESH_MARGIN_MS,
  BackendSession,
  exchangeOgsIdToken,
  getAccessTokenExpiry,
  getBackendUrl,
  refreshAccessToken,
} from "@/lib/backendAuth";

export const OGS_PROVIDER_ID = "ogs";

type OgsProfile = { sub: string; email?: string; name?: string };

/**
 * OpenID Connect provider for OGS (gojuryu.se, or ogs.minamail.se in test).
 * Only registered when the issuer and client credentials are configured.
 */
export function createOgsProvider(): OAuthConfig<OgsProfile> | null {
  const issuer = process.env.OGS_OIDC_ISSUER?.trim();
  const clientId = process.env.OGS_OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OGS_OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) return null;

  return {
    id: OGS_PROVIDER_ID,
    name: "OGS",
    type: "oauth",
    wellKnown: `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
    issuer,
    clientId,
    clientSecret,
    idToken: true,
    checks: ["pkce", "state", "nonce"],
    authorization: { params: { scope: "openid email profile" } },
    profile(profile) {
      return {
        id: profile.sub,
        email: profile.email ?? "",
        name: profile.name ?? profile.email ?? "",
        role: "",
        accessToken: "",
      };
    },
  };
}

const ogsProvider = createOgsProvider();

export const authOptions: NextAuthOptions = {
  providers: [
    ...(ogsProvider ? [ogsProvider as Provider] : []),
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
          const apiUrl = getBackendUrl();

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
    async signIn({ user, account }) {
      if (account?.provider !== OGS_PROVIDER_ID) return true;

      if (!account.id_token) return "/login?error=OgsAccessDenied";

      // OGS has authenticated the user; attendance decides whether they get a
      // session. The backend result replaces the OGS profile on `user`, which
      // NextAuth passes on to the jwt callback.
      const result = await exchangeOgsIdToken(account.id_token);
      if ("error" in result) {
        return result.error === "not_linked" || result.error === "sso_disabled" ||
          result.error === "ogs_role_missing" || result.error === "account_inactive"
          ? "/login?error=OgsAccessDenied"
          : "/login?error=OgsUnavailable";
      }

      const session: BackendSession = result.session;
      Object.assign(user, session);
      return true;
    },
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
        token.accessTokenExpires = getAccessTokenExpiry((user as any).accessToken);
        token.refreshToken = (user as any).refreshToken;
        token.error = undefined;
        return token;
      }

      if (token.error) return token;

      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - ACCESS_TOKEN_REFRESH_MARGIN_MS
      ) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Add custom fields to session. The refresh token is deliberately left
      // out: it never leaves the server.
      if (token) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;
        (session as any).accessToken = (token as any).accessToken;
        if (token.error) (session as any).error = token.error;
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
