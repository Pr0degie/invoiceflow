import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Typed API client for invoice-api.
 *
 * Server-side (RSC, NextAuth callbacks): talks to the backend directly;
 * callers attach the Bearer token via `bearerHeader(...)`, sourced from the
 * server-only JWT (see src/lib/auth/api-token.ts).
 *
 * Client-side: every call goes through the auth proxy route handler at
 * /api/backend (src/app/api/backend/[...path]/route.ts), which reads the
 * httpOnly session cookie and injects the Authorization header server-side.
 * Hooks never see or send tokens — the browser has no Bearer header and no
 * token in JS-reachable storage, and the request stays same-origin (no CORS).
 */
const baseUrl =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080")
    : "/api/backend";

export const apiClient = createClient<paths>({ baseUrl });

/**
 * Convenience: build the Authorization header value from a token string.
 * Server-side use only — client code must not handle tokens (they are no
 * longer exposed there anyway).
 */
export function bearerHeader(token: string | undefined | null) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
