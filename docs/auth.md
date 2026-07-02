# Auth — Architecture & Conventions

---

## Overview

**Credentials-only.** No OAuth providers (GitHub was removed in cleanup).

Authentication is a two-layer system:
1. **NextAuth v5** — manages the session cookie, CSRF, and JWT rotation.
2. **invoice-api** — the source of truth for user identity and JWT tokens.

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

**Server component / server action:**
```ts
import { auth } from "@/lib/auth";
const session = await auth();
const token = session?.accessToken;
```

**Client component / hook:**
```ts
const { data: session } = useSession();
const token = (session as { accessToken?: string })?.accessToken;
```

**Attaching the Bearer token to API calls:**
```ts
import { bearerHeader } from "@/lib/api/client";
apiClient.GET("/api/invoices", { headers: bearerHeader(token) });
```

The `bearerHeader()` helper returns `{}` if token is undefined — safe to call unconditionally.

---

## Key files

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | NextAuth config — Credentials provider, jwt/session callbacks |
| `src/lib/auth/refresh.ts` | `refreshAccessToken()` — called from jwt() callback |
| `src/lib/api/client.ts` | `apiClient` + `bearerHeader()` |
| `src/types/next-auth.d.ts` | Type extensions: `session.accessToken`, `session.error`, JWT fields |
| `src/app/api/auth/register/route.ts` | Register proxy route |
| `src/lib/auth/sign-out-on-auth-error.ts` | Deduped global signout on dead sessions |
| `src/components/providers/session-guard.tsx` | Client watcher for `session.error` |

---

## Session type shape

```ts
session.user.id          // UUID from invoice-api
session.user.email
session.user.name
session.accessToken      // invoice-api JWT — undefined for non-credentials sessions
session.error            // "RefreshAccessTokenError" | undefined
```

---

## What's NOT here

- No GitHub / Google OAuth
- No magic links
- No password reset (not implemented — ask before adding)
- No database adapter — sessions are pure JWT; invoice-api owns the user store.
  Prisma was removed entirely (it broke the Edge middleware and did nothing for
  Credentials logins with JWT session strategy)
