/**
 * The browser's IP as an `X-Forwarded-For` header for server → invoice-api calls.
 *
 * Every auth request (login, refresh, register, password/mail endpoints) reaches
 * the API from this Next.js server, so without the header the API's per-IP rate
 * limits (5/min on login & co.) would be one bucket shared by every user. The API
 * trusts the header only from private-network peers such as this container.
 *
 * Takes the LAST entry: the one our edge proxy (Coolify's Traefik) appended.
 * Earlier entries are client-supplied and spoofable. Next.js fills the header
 * only when it's missing (direct requests in local dev), never appends to it.
 */
export function forwardedForHeader(
  headers: Pick<Headers, "get">
): Record<string, string> {
  const ip = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .at(-1);
  return ip ? { "X-Forwarded-For": ip } : {};
}
