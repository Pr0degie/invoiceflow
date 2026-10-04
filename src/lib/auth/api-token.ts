import { encode, getToken, type JWT } from "next-auth/jwt";
import { refreshAccessToken } from "@/lib/auth/refresh";
import { forwardedForHeader } from "@/lib/auth/client-ip";
import { isAccessTokenFresh } from "@/lib/auth/session-state";

/**
 * Server-only access to the invoice-api access token stored inside the
 * httpOnly NextAuth JWT cookie.
 *
 * Since the auth-proxy rework (Prompt 14) the token is deliberately NOT
 * exposed on the client session anymore (`session.accessToken` is gone) —
 * XSS cannot steal what never reaches the browser. The only consumers are:
 *   - the auth proxy (`src/app/api/backend/[...path]/route.ts`), which
 *     injects the Bearer header for all browser-originated API calls,
 *   - server components that call invoice-api directly, and
 *   - the routing proxy (`src/proxy.ts`), which refreshes it on navigation.
 */

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

/**
 * Mirrors how Auth.js picks the cookie name: behind HTTPS the session cookie
 * carries the `__Secure-` prefix. Next.js always sets `x-forwarded-proto`
 * (Auth.js itself derives its action URLs from the same header).
 */
export function isSecureRequest(headers: Headers): boolean {
  const proto = headers.get("x-forwarded-proto");
  return proto ? proto.split(",")[0].trim() === "https" : false;
}

export function sessionCookieName(secure: boolean): string {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

// 30 days — NextAuth's default JWT session maxAge, which src/lib/auth.ts
// does not override.
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * The session cookie carrying a rotated JWT, for the two places that refresh
 * outside Auth.js and therefore have to write it themselves: the routing
 * proxy and the auth-proxy route handler.
 */
export async function sessionCookie(jwt: JWT, secure: boolean) {
  const name = sessionCookieName(secure);
  const value = await encode({
    token: jwt,
    secret: authSecret(),
    salt: name,
    maxAge: SESSION_MAX_AGE,
  });
  return {
    name,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}

/** Decodes the session JWT from the request's cookie. Never refreshes. */
export function readSessionToken(headers: Headers): Promise<JWT | null> {
  return getToken({
    req: { headers },
    secret: authSecret(),
    secureCookie: isSecureRequest(headers),
  });
}

export interface ApiTokenResult {
  accessToken: string;
  /**
   * Present when the access token had expired and was refreshed while being
   * read. invoice-api rotates refresh tokens (single-use + 60 s grace — see
   * docs/auth.md), so the caller MUST persist this JWT back into the session
   * cookie (sessionCookie). Only code that can set cookies may call
   * getApiToken: route handlers. Server components use readApiToken.
   */
  refreshedJwt?: JWT;
}

// Dedupe concurrent refreshes within this server instance (a dashboard load
// fires several proxy calls at once). Cross-instance concurrency is covered
// by the backend's 60 s rotation grace window.
const inflightRefresh = new Map<string, Promise<JWT>>();

/**
 * Exchanges the session's refresh token at invoice-api (never through the own
 * proxy). The returned JWT carries `error` when the refresh failed. Callers
 * must be able to persist the result — the old refresh token is spent.
 */
export function refreshSession(token: JWT, headers: Headers): Promise<JWT> {
  const key = token.refreshToken ?? "";
  let pending = inflightRefresh.get(key);
  if (!pending) {
    pending = refreshAccessToken(token, forwardedForHeader(headers)).finally(() =>
      inflightRefresh.delete(key)
    );
    inflightRefresh.set(key, pending);
  }
  return pending;
}

/**
 * Reads the invoice-api access token from the session cookie, refreshing it
 * server-side against the API when expired (isAccessTokenFresh — the same
 * 30 s buffer the jwt() callback uses). Returns null when there is no session or the
 * refresh failed — callers should respond 401 so the client's existing
 * sign-out-on-auth-error handling kicks in.
 */
export async function getApiToken(
  headers: Headers
): Promise<ApiTokenResult | null> {
  const token = await readSessionToken(headers);
  if (!token?.accessToken) return null;

  if (isAccessTokenFresh(token.accessTokenExpires)) {
    return { accessToken: token.accessToken };
  }

  const refreshed = await refreshSession(token, headers);
  if (refreshed.error || !refreshed.accessToken) return null;

  return { accessToken: refreshed.accessToken, refreshedJwt: refreshed };
}

/**
 * The access token for server components, which can't set cookies and so
 * must never refresh: a rotation they trigger is lost, and the next request
 * replays the spent refresh token — past the backend's 60 s grace that reads
 * as token theft and ends all of the user's sessions. proxy.ts refreshes
 * before the render, so an expired token here means that refresh failed.
 */
export async function readApiToken(
  headers: Headers
): Promise<string | undefined> {
  const token = await readSessionToken(headers);
  if (!token?.accessToken || !isAccessTokenFresh(token.accessTokenExpires)) {
    return undefined;
  }
  return token.accessToken;
}
