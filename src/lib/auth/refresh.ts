import type { JWT } from "next-auth/jwt";
import { apiClient } from "@/lib/api/client";

/**
 * Called inside NextAuth's jwt() callback when the access token has expired.
 * Exchanges the refresh token for a new access token transparently.
 * Runs server-side only — the client never touches refresh tokens directly.
 * `forwardedFor` carries the browser's IP (see forwardedForHeader) so the
 * API rate-limits refreshes per client, not per Next.js server.
 */
export async function refreshAccessToken(
  token: JWT,
  forwardedFor: Record<string, string> = {}
): Promise<JWT> {
  try {
    const { data, error } = await apiClient.POST("/api/auth/refresh", {
      headers: forwardedFor,
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

/**
 * Revokes a refresh token at invoice-api (logout). Never throws: a failed
 * revoke (API down, token already dead) must not keep the user signed in.
 */
export async function revokeRefreshToken(
  refreshToken: string,
  forwardedFor: Record<string, string> = {}
): Promise<void> {
  try {
    await apiClient.POST("/api/auth/logout", {
      headers: forwardedFor,
      body: { refreshToken },
    });
  } catch {
    // Signing out locally still happens; the token expires on its own.
  }
}
