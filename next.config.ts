import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
};

export default withNextIntl(nextConfig);
