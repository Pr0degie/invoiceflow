import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { authSecret, isSecureRequest } from "@/lib/auth/api-token";

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
 * Trade-off vs. the wrapper: the proxy no longer refreshes an expired access
 * token during navigations. Refresh happens in the auth-proxy route handler
 * (persisted) and in getApiToken() for server components (not persisted —
 * covered by the backend's 60 s refresh-rotation grace window).
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

  if (isAuthRoute || isApp) {
    const token = await getToken({
      req,
      secret: authSecret(),
      secureCookie: isSecureRequest(req.headers),
    });
    const isLoggedIn = !!token;

    if (isAuthRoute && isLoggedIn) {
      return NextResponse.redirect(new URL(`${localePrefix}/app`, nextUrl));
    }

    if (isApp && !isLoggedIn) {
      return NextResponse.redirect(
        new URL(`${localePrefix}/auth/login`, nextUrl)
      );
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Exclude Next.js file-based metadata routes (icon/apple-icon/opengraph-image
  // generate extension-less URLs like /icon) so auth+intl don't redirect them —
  // otherwise the browser tab icon request bounces to /auth/login instead of the PNG.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|sitemap.xml|robots.txt).*)",
  ],
};
