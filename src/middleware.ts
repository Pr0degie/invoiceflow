import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const pathname = nextUrl.pathname;

  // Detect locale prefix for locale-aware redirects
  const localeMatch = pathname.match(/^\/(de)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  // Strip locale prefix to get the clean path for route matching
  const pathWithoutLocale = pathname.replace(/^\/(de)(?=\/|$)/, "") || "/";

  const isAuthRoute = pathWithoutLocale.startsWith("/auth");
  const isApp = pathWithoutLocale.startsWith("/app");

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL(`${localePrefix}/app`, nextUrl));
  }

  if (isApp && !isLoggedIn) {
    return NextResponse.redirect(
      new URL(`${localePrefix}/auth/login`, nextUrl)
    );
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
