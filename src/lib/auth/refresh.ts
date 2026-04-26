import type { JWT } from "next-auth/jwt";
import { apiClient } from "@/lib/api/client";

/**
 * Called inside NextAuth's jwt() callback when the access token has expired.
 * Exchanges the refresh token for a new access token transparently.
 * Runs server-side only — the client never touches refresh tokens directly.
 */
export async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const { data, error } = await apiClient.POST("/api/auth/refresh", {
      body: { refreshToken: token.refreshToken as string },
    });

    if (error || !data?.token) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    return {
      ...token,
      accessToken: data.token,
      refreshToken: data.refreshToken ?? token.refreshToken,
      accessTokenExpires: data.expiresAt ?? token.accessTokenExpires,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
