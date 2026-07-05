import { type NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import {
  authSecret,
  getApiToken,
  isSecureRequest,
  sessionCookieName,
} from "@/lib/auth/api-token";

/**
 * Auth proxy for invoice-api.
 *
 * Replaces the former passive next.config rewrite for `/api/backend/:path*`:
 * the browser calls `/api/backend/<api-path>` without any credentials in
 * JS-reachable storage. This handler reads the httpOnly NextAuth JWT cookie
 * server-side, injects `Authorization: Bearer <access token>` and forwards
 * the request to `NEXT_PUBLIC_API_BASE_URL`.
 *
 * - Supports GET/POST/PUT/PATCH/DELETE.
 * - Streams request and response bodies through untouched — binary responses
 *   (PDF/XML download & preview) work without buffering.
 * - Status codes and error bodies pass through unchanged, so a backend 401
 *   (expired session, deleted account) still reaches the client and triggers
 *   the existing sign-out-on-auth-error handling.
 * - If the access token expired, it is refreshed server-side first and the
 *   rotated JWT is persisted back into the session cookie (invoice-api
 *   refresh tokens are single-use).
 */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

// 30 days — NextAuth's default JWT session maxAge, which src/lib/auth.ts
// does not override.
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

// Only forward what the backend actually consumes — no cookies, no
// browser fingerprint headers.
const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "accept-language"];

// Content-length is deliberately absent: Next re-chunks streamed bodies.
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "etag",
];

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const tokenResult = await getApiToken(req.headers);
  if (!tokenResult) {
    // No session or failed refresh — same shape as invoice-api errors so the
    // client's ApiError/401 handling (signOutOnAuthError) applies uniformly.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await ctx.params;
  const target = `${API_BASE}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${tokenResult.accessToken}`);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      cache: "no-store",
      redirect: "manual",
      // Streaming request bodies require half-duplex (undici); the field is
      // missing from the RequestInit type.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
  } catch {
    return NextResponse.json(
      { error: "Backend unreachable" },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // upstream.body is null for 204 & friends — safe to pass through as-is.
  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  // Persist a rotated session JWT so the single-use refresh token in the old
  // cookie is not reused later (which would kill all of the user's sessions).
  if (tokenResult.refreshedJwt) {
    const secure = isSecureRequest(req.headers);
    const cookieName = sessionCookieName(secure);
    const value = await encode({
      token: tokenResult.refreshedJwt,
      secret: authSecret(),
      salt: cookieName,
      maxAge: SESSION_MAX_AGE,
    });
    response.cookies.set(cookieName, value, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }

  return response;
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
