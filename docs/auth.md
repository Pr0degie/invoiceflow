# Auth — Architecture & Conventions

---

## Overview

**Credentials-only.** No OAuth providers (GitHub was removed in cleanup).

Authentication is a two-layer system:
1. **NextAuth v5** — manages the session cookie, CSRF, and JWT rotation.
2. **invoice-api** — the source of truth for user identity and JWT tokens.

**The invoice-api access token never reaches the browser.** It lives only in
the server-side NextAuth JWT (httpOnly cookie); `session.accessToken` does not
exist. Client code talks to the API exclusively through the auth proxy at
`/api/backend/...`, which injects the Bearer header server-side. See
"Auth proxy" below.

---

## Login flow

```
LoginForm (client)
  → POST /api/auth/login (Next.js API route — handled by NextAuth)
  → NextAuth Credentials.authorize()
      → apiClient.POST("/api/auth/login") → invoice-api
      → returns { token, refreshToken, expiresAt, user }
  → stored in NextAuth signed httpOnly JWT cookie
```

---

## Auth proxy (`/api/backend/[...path]`)

`src/app/api/backend/[...path]/route.ts` — the only path browser code uses to
reach invoice-api (it replaced the former passive `next.config` rewrite):

```
Browser fetch /api/backend/api/invoices     (no Authorization header —
  |                                          only the httpOnly session cookie)
  → route handler (server):
      getApiToken() — decodes the NextAuth JWT cookie (src/lib/auth/api-token.ts)
        → access token still valid (30 s buffer)? use it
        → expired? refreshAccessToken() directly against invoice-api;
          the rotated JWT is re-encoded and persisted via Set-Cookie
        → no session / refresh failed? respond 401 {"error":"Unauthorized"}
      fetch NEXT_PUBLIC_API_BASE_URL/<path>?<query>
        with Authorization: Bearer <access token> injected
  → response streamed back unchanged (status, error bodies, binary PDF/XML)
```

Supported methods: GET/POST/PUT/PATCH/DELETE. Backend 401s pass through
unchanged so the client-side dead-session handling (below) keeps working.

Server-side code (RSC, NextAuth callbacks) does NOT use the proxy — it calls
the API directly (`apiClient` + `bearerHeader()`), sourcing the token from
`getApiToken(await headers())`.

---

## Token refresh

Runs **server-side** inside NextAuth's `jwt()` callback — the client never handles refresh directly.

```
useSession() / auth()
  → NextAuth jwt() callback
  → if expiresAt - 30s > now: return current token
  → else: refreshAccessToken(token)
      → POST /api/auth/refresh → invoice-api
      → returns new { token, refreshToken, expiresAt }
  → new tokens stored in JWT cookie
```

If refresh fails: `session.error = "RefreshAccessTokenError"` — sign the user out and redirect.

The backend rotates refresh tokens on every refresh (single-use) with a 60 s
grace window for concurrent refreshes; reuse after the window kills all of the
user's sessions. See `../invoice-api/docs/adr/0001-refresh-token-rotation-grace.md`.

Implementation: `src/lib/auth/refresh.ts`

The auth proxy performs the same refresh via `getApiToken()` when a
`/api/backend` call arrives with an expired access token (deduped per refresh
token within the server instance; the rotated JWT is written back into the
session cookie on the proxy response). Refresh always goes directly against
invoice-api — never through the proxy itself.

---

## Dead-session handling (global)

Three layers end a dead session instead of failing silently:

1. **Server:** the `(app)` layout redirects to login when `session.error` is set
   (only runs on navigation).
2. **Client, session-driven:** `SessionGuard` (mounted in `Providers`) watches
   `useSession()` and calls `signOut({ callbackUrl: "/auth/login" })` when
   `session.error === "RefreshAccessTokenError"`.
3. **Client, API-driven:** the `QueryClient`'s `QueryCache`/`MutationCache`
   `onError` (in `query-provider.tsx`) triggers the same signout on any
   `ApiError` with status 401. 401s are not retried.

All three funnel through `signOutOnAuthError()`
(`src/lib/auth/sign-out-on-auth-error.ts`), which dedupes concurrent triggers.

---

## Register flow

```
RegisterForm (client)
  → POST /api/auth/register (Next.js API route in src/app/api/auth/register/route.ts)
  → apiClient.POST("/api/auth/register") → invoice-api
  → 201 → redirect to /auth/login?registered=true
```

No Prisma user creation. invoice-api owns the user store.

---

## Using the session

**Server component / server action** (identity only — no token on the session):
```ts
import { auth } from "@/lib/auth";
const session = await auth();
session?.user.id;
```

**Server-side API calls** (RSC / route handlers — token from the server-only JWT):
```ts
import { headers } from "next/headers";
import { getApiToken } from "@/lib/auth/api-token";
import { apiClient, bearerHeader } from "@/lib/api/client";

const token = (await getApiToken(await headers()))?.accessToken;
apiClient.GET("/api/auth/me", { headers: bearerHeader(token) });
```

**Client component / hook** — no tokens, no auth headers. Just call the API;
`apiClient`'s client-side baseUrl is `/api/backend`, the proxy does the rest:
```ts
const result = await apiClient.GET("/api/invoices", { params: { query: filters } });
// gate queries on session status, not on a token:
const { status } = useSession();
useQuery({ ..., enabled: status === "authenticated" });
```

`bearerHeader()` returns `{}` if token is undefined — safe to call
unconditionally, but it is server-side-only by convention now.

---

## Key files

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config — Credentials provider, jwt/session callbacks |
| `src/lib/auth/refresh.ts` | `refreshAccessToken()` — called from jwt() callback and the auth proxy |
| `src/lib/auth/api-token.ts` | `getApiToken()` — server-only access to the invoice-api token (decode JWT cookie + refresh) |
| `src/app/api/backend/[...path]/route.ts` | Auth proxy — injects the Bearer header for all browser API calls |
| `src/lib/api/client.ts` | `apiClient` + `bearerHeader()` (bearer: server-side only) |
| `src/types/next-auth.d.ts` | Type extensions: `session.error`, JWT fields (`accessToken` is JWT-only) |
| `src/app/api/auth/register/route.ts` | Register proxy route |
| `src/lib/auth/sign-out-on-auth-error.ts` | Deduped global signout on dead sessions |
| `src/components/providers/session-guard.tsx` | Client watcher for `session.error` |

---

## Session type shape

```ts
session.user.id          // UUID from invoice-api
session.user.email
session.user.name
session.error            // "RefreshAccessTokenError" | undefined
// NO session.accessToken — the invoice-api JWT is server-only (auth proxy).
```

---

## What's NOT here

- No GitHub / Google OAuth
- No magic links
- No password reset (not implemented — ask before adding)
- No database adapter — sessions are pure JWT; invoice-api owns the user store.
  Prisma was removed entirely (it broke the Edge middleware and did nothing for
  Credentials logins with JWT session strategy)
