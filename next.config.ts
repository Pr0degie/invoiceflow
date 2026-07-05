import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy — second XSS defense layer next to the auth proxy
// (the API token itself never reaches the browser anymore). Every relaxation
// of `default-src 'self'` is deliberate:
// - script-src 'unsafe-inline': the App Router emits inline bootstrap /
//   hydration scripts without nonces when the CSP comes from static
//   headers(); a strict nonce-based CSP would require per-request header
//   injection via middleware, which this task explicitly does not ask for.
//   The trade-off is documented here instead. Dev additionally needs
//   'unsafe-eval' for react-refresh/HMR — never shipped in prod.
// - style-src 'unsafe-inline': Radix primitives, recharts and motion set
//   style="" attributes; next-themes toggles inline styles on theme switch.
// - img-src blob: data:: generated favicon/OG images and object URLs.
// - frame-src blob:: the invoice PDF preview dialog renders the fetched PDF
//   blob (object URL) in an iframe; without this it falls back to
//   default-src 'self', which excludes blob:.
// - connect-src ws: (dev only): HMR websocket.
// - frame-ancestors 'none' mirrors X-Frame-Options: DENY for modern browsers.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// HSTS is managed by Vercel — deliberately not duplicated here.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Redundant with frame-ancestors 'none', kept for older user agents.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.178.30"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  // NOTE: the former `/api/backend/:path*` rewrite is gone — the auth proxy
  // route handler in src/app/api/backend/[...path]/route.ts serves that path
  // now and injects the Authorization header server-side.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
