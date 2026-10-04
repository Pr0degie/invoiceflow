/** Refresh the invoice-api access token this long before it actually expires. */
export const REFRESH_BUFFER_MS = 30_000;

/**
 * True while the access token is usable without a refresh. Shared by the
 * jwt() callback and getApiToken (which refresh past this point) and the
 * routing proxy (which must agree with them — see hasLiveSession).
 * Tokens without an expiry count as fresh, as they always have.
 */
export function isAccessTokenFresh(
  expires: string | undefined,
  now = Date.now()
): boolean {
  if (!expires) return true;
  return now < new Date(expires).getTime() - REFRESH_BUFFER_MS;
}

/**
 * Whether a session cookie proves a working session on its own — without the
 * refresh the routing proxy can't do. A decodable cookie isn't enough: its
 * refresh token may be dead (revoked by a password change, reuse detection,
 * logout elsewhere). Treating such a cookie as logged in bounced /auth/login
 * back to /app, whose layout sent it to /auth/login again — an endless 307
 * loop with two failed refresh calls per hop.
 */
export function hasLiveSession(
  token: { accessTokenExpires?: string; error?: string } | null,
  now = Date.now()
): boolean {
  return !!token && !token.error && isAccessTokenFresh(token.accessTokenExpires, now);
}

/**
 * Whether the routing proxy should exchange the refresh token before the
 * request renders. Server components can't write the rotated cookie, so the
 * proxy is the only place a navigation may refresh (see docs/auth.md). A
 * cookie that already recorded a failed refresh is left to the sign-out path.
 */
export function shouldRefreshSession(
  token: { accessTokenExpires?: string; refreshToken?: string; error?: string } | null,
  now = Date.now()
): boolean {
  return (
    !!token?.refreshToken &&
    !token.error &&
    !isAccessTokenFresh(token.accessTokenExpires, now)
  );
}
