import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import {
  isSecureRequest,
  readSessionToken,
  refreshSession,
  sessionCookie,
} from "@/lib/auth/api-token";
import { hasLiveSession, shouldRefreshSession } from "@/lib/auth/session-state";

const intlMiddleware = createMiddleware(routing);

/**
 * Proxy (the Next.js 16 name for middleware — renamed per
 * nextjs.org/docs/messages/middleware-to-proxy).
 *
 * Deliberately NOT wrapped in next-auth's `auth()` helper: the wrapper
 * post-processes the returned response, and in the standalone production
 * server (next-auth 5.0.0-beta.30 / next 16.2.10) that corrupts next-intl's
 * default-locale REWRITE into a 307 redirect to the request's own URL — an
 * infinite loop on every unprefixed route. `next dev` masks the bug. Session
 * state for the route gates below is read directly from the JWT cookie
 * instead; this check is UX-only (the API authorizes every call itself).
 *
 * The proxy is also the ONLY place a page navigation refreshes an expired
 * access token: it can write the rotated session cookie, server components
 * can't (see readApiToken). The refreshed JWT goes onto the request as well,
 * so the render that follows already sees it.
 */
export default async function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Detect locale prefix for locale-aware redirects
  const localeMatch = pathname.match(/^\/(de)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  // Strip locale prefix to get the clean path for route matching
  const pathWithoutLocale = pathname.replace(/^\/(de)(?=\/|$)/, "") || "/";

  const isAuthRoute = pathWithoutLocale.startsWith("/auth");
  const isApp = pathWithoutLocale.startsWith("/app");

  if (!isAuthRoute && !isApp) return intlMiddleware(req);

  let token = await readSessionToken(req.headers);
  let rotated: Awaited<ReturnType<typeof sessionCookie>> | undefined;
  if (token && shouldRefreshSession(token)) {
    token = await refreshSession(token, req.headers);
    if (!token.error) {
      rotated = await sessionCookie(token, isSecureRequest(req.headers));
      req.cookies.set(rotated.name, rotated.value);
    }
  }

  // Bounce away from /auth only on a session proven live, and into /app only
  // with one: a cookie whose refresh token died gets the login page instead
  // of ping-ponging between the two redirects.
  const live = hasLiveSession(token);
  let response: NextResponse;
  if (isAuthRoute && live) {
    response = NextResponse.redirect(new URL(`${localePrefix}/app`, nextUrl));
  } else if (isApp && !live) {
    response = NextResponse.redirect(
      new URL(`${localePrefix}/auth/login`, nextUrl)
    );
  } else {
    response = intlMiddleware(req);
  }

  if (rotated) {
    response.cookies.set(rotated.name, rotated.value, rotated.options);
  }
  return response;
}

export const config = {
  // Exclude Next.js file-based metadata routes (icon/apple-icon/opengraph-image
  // generate extension-less URLs like /icon) so auth+intl don't redirect them —
  // otherwise the browser tab icon request bounces to /auth/login instead of the PNG.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|sitemap.xml|robots.txt).*)",
  ],
};
