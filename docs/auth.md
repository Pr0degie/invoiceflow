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

Implementation: `src/lib/auth/refresh.ts`

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
- The `PrismaAdapter` is still wired for forward-compat with potential future OAuth;
  it does nothing for Credentials logins with JWT session strategy
