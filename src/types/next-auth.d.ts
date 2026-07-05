import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    // No `accessToken` here on purpose: the invoice-api JWT lives only in the
    // server-only NextAuth JWT (below) and is attached by the auth proxy
    // (src/app/api/backend/[...path]/route.ts) — never exposed to client JS.
    /** Set to "RefreshAccessTokenError" when the refresh token has expired. */
    error?: "RefreshAccessTokenError";
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: string;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: string;
    error?: "RefreshAccessTokenError";
  }
}
