import createClient from "openapi-fetch";
import type { paths } from "./schema";

/**
 * Typed API client for invoice-api.
 * Does NOT inject auth headers by itself — callers pass the token via
 * the `headers` option so the same client works in both server and client
 * contexts without any React/session dependency.
 *
 * Usage in hooks:
 *   const { data, error } = await apiClient.GET("/api/invoices", {
 *     params: { query: filters },
 *     headers: { Authorization: `Bearer ${token}` },
 *   });
 */
// Server-side: call the backend directly. Client-side: go through the
// Next.js rewrite proxy at /api/backend so the browser stays same-origin
// and no CORS headers are needed.
const baseUrl =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080")
    : "/api/backend";

export const apiClient = createClient<paths>({ baseUrl });

/** Convenience: build the Authorization header value from a token string. */
export function bearerHeader(token: string | undefined | null) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
