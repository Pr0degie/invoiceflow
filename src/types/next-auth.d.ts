import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** invoice-api JWT — present for Credentials logins, absent for OAuth-only users. */
    accessToken?: string;
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
