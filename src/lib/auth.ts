import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/schemas/auth";
import { apiClient } from "@/lib/api/client";
import { headers } from "next/headers";
import { refreshAccessToken } from "@/lib/auth/refresh";
import { forwardedForHeader } from "@/lib/auth/client-ip";
import { isAccessTokenFresh } from "@/lib/auth/session-state";

/**
 * Thrown when the backend rejects login with 403 `email_not_verified`. The
 * `code` is propagated into the sign-in redirect URL and returned to the client
 * as `res.code`, so the login form can offer "resend verification" instead of
 * the generic "wrong password" message. See docs/auth.md.
 */
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

/**
 * jwt() receives no request object. It runs inside a route handler
 * (/api/auth/session) or a server component's auth() call, where the incoming
 * headers are still reachable via next/headers — outside a request scope that
 * throws, and the refresh simply goes out without a client IP.
 */
async function requestForwardedFor(): Promise<Record<string, string>> {
  try {
    return forwardedForHeader(await headers());
  } catch {
    return {};
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, user object is populated; merge invoice-api tokens into the JWT.
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        return token;
      }

      // On subsequent requests, check if the invoice-api access token is still valid.
      if (!token.accessToken || isAccessTokenFresh(token.accessTokenExpires)) {
        return token;
      }

      // Token expired — attempt silent refresh.
      return refreshAccessToken(token, await requestForwardedFor());
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as string) ?? "USER";
      // Deliberately NOT exposing token.accessToken on the session: the
      // invoice-api token stays in the server-only JWT cookie and is attached
      // by the auth proxy (src/app/api/backend/[...path]/route.ts). XSS
      // cannot steal what never reaches the client.
      session.error = token.error as "RefreshAccessTokenError" | undefined;
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { data, error, response } = await apiClient.POST(
          "/api/auth/login",
          {
            headers: forwardedForHeader(request.headers),
            body: {
              email: parsed.data.email,
              password: parsed.data.password,
            },
          }
        );

        // 403 = account exists but e-mail not verified — surface distinctly so
        // the form can offer a resend. All other failures stay generic (null →
        // "Invalid credentials") to avoid leaking which addresses are registered.
        if (response.status === 403) throw new EmailNotVerifiedError();

        if (error || !data?.token || !data?.user) return null;

        return {
          id: data.user.id ?? "",
          email: data.user.email ?? "",
          name: data.user.name ?? "",
          role: "USER",
          accessToken: data.token,
          refreshToken: data.refreshToken ?? undefined,
          accessTokenExpires: data.expiresAt ?? undefined,
        };
      },
    }),
  ],
});
