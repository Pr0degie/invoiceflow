import { getToken, type JWT } from "next-auth/jwt";
import { refreshAccessToken } from "@/lib/auth/refresh";

/**
 * Server-only access to the invoice-api access token stored inside the
 * httpOnly NextAuth JWT cookie.
 *
 * Since the auth-proxy rework (Prompt 14) the token is deliberately NOT
 * exposed on the client session anymore (`session.accessToken` is gone) —
 * XSS cannot steal what never reaches the browser. The only consumers are:
 *   - the auth proxy (`src/app/api/backend/[...path]/route.ts`), which
 *     injects the Bearer header for all browser-originated API calls, and
 *   - server components that call invoice-api directly.
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

export interface ApiTokenResult {
  accessToken: string;
  /**
   * Present when the access token had expired and was refreshed while being
   * read. invoice-api rotates refresh tokens (single-use + 60 s grace — see
   * docs/auth.md), so route handlers MUST persist this JWT back into the
   * session cookie. Server components cannot set cookies; a refresh they
   * trigger is not persisted — the next proxy call re-refreshes with the old
   * token inside the backend's 60 s rotation grace window and persists then.
   * (Since the proxy.ts migration the routing layer no longer refreshes.)
   */
  refreshedJwt?: JWT;
}

// Dedupe concurrent refreshes within this server instance (a dashboard load
// fires several proxy calls at once). Cross-instance concurrency is covered
// by the backend's 60 s rotation grace window.
const inflightRefresh = new Map<string, Promise<JWT>>();

/**
 * Reads the invoice-api access token from the session cookie, refreshing it
 * server-side against the API when expired (same 30 s buffer as the jwt()
 * callback in src/lib/auth.ts). Returns null when there is no session or the
 * refresh failed — callers should respond 401 so the client's existing
 * sign-out-on-auth-error handling kicks in.
 */
export async function getApiToken(
  headers: Headers
): Promise<ApiTokenResult | null> {
  const token = await getToken({
    req: { headers },
    secret: authSecret(),
    secureCookie: isSecureRequest(headers),
  });
  if (!token?.accessToken) return null;

  if (!token.accessTokenExpires) return { accessToken: token.accessToken };
  const expiresAt = new Date(token.accessTokenExpires).getTime();
  if (Date.now() < expiresAt - 30_000) {
    return { accessToken: token.accessToken };
  }

  // Expired — refresh directly against invoice-api (never through the own
  // proxy), exactly like the jwt() callback does.
  const key = token.refreshToken ?? "";
  let pending = inflightRefresh.get(key);
  if (!pending) {
    pending = refreshAccessToken(token).finally(() =>
      inflightRefresh.delete(key)
    );
    inflightRefresh.set(key, pending);
  }
  const refreshed = await pending;
  if (refreshed.error || !refreshed.accessToken) return null;

  return { accessToken: refreshed.accessToken, refreshedJwt: refreshed };
}
