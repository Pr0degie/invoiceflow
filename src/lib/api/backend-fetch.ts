/**
 * Minimal server-side POST helper for the anonymous auth endpoints that are not
 * yet in the generated OpenAPI types (`forgot-password`, `reset-password`,
 * `verify-email`, `resend-verification` — added in invoice-api Prompt 18a; the
 * committed `openapi.json` predates them). It talks to the same base URL the
 * typed `apiClient` uses server-side. Once the spec is regenerated
 * (`npm run api:types`) these calls can move onto `apiClient`.
 *
 * Server-only: uses NEXT_PUBLIC_API_BASE_URL directly, so never import it into
 * client components.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export function backendFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}
