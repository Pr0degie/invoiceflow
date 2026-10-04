import { cache } from "react";
import { headers } from "next/headers";
import { readSessionToken } from "@/lib/auth/api-token";
import { hasLiveSession } from "@/lib/auth/session-state";

/**
 * The signed-in user for server components — use this instead of `auth()`.
 * `auth()` runs the jwt() callback, which refreshes an expired access token
 * but can't persist the rotated refresh token from a server component (see
 * readApiToken). This only decodes the cookie that proxy.ts already
 * refreshed; null means no usable session.
 */
export const getSessionUser = cache(async () => {
  const token = await readSessionToken(await headers());
  if (!hasLiveSession(token)) return null;
  return { name: token?.name, email: token?.email };
});
