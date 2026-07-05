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

Registration **no longer logs the user in** (the backend keeps new accounts
unverified and login on them returns `403 email_not_verified`).

```
RegisterForm (client)
  → POST /api/auth/register (Next.js API route in src/app/api/auth/register/route.ts)
  → apiClient.POST("/api/auth/register") → invoice-api
  → 201 → redirect to /auth/check-email?email=… (offers "resend", 60 s cooldown)
```

No Prisma user creation. invoice-api owns the user store.

---

## E-mail verification & password reset flows (Prompt 18b)

All four anonymous flows have UI. The two token-landing pages live at the
**root** (`/verify-email`, `/reset-password`) — not under `/auth` — because the
backend e-mails link to `{FRONTEND_BASE_URL}/verify-email?token=…` and
`/reset-password?token=…` with no `/auth` segment and no locale prefix.

| Flow | Page | Proxy route | Backend endpoint |
|---|---|---|---|
| Forgot password | `/auth/forgot-password` | `POST /api/auth/forgot-password` | `POST /auth/forgot-password` |
| Reset password | `/reset-password?token=` | `POST /api/auth/reset-password` | `POST /auth/reset-password` |
| Verify e-mail | `/verify-email?token=` | `POST /api/auth/verify-email` | `POST /auth/verify-email` |
| Resend verification | (shared component) | `POST /api/auth/resend-verification` | `POST /auth/resend-verification` |
| Check inbox (post-register) | `/auth/check-email?email=` | — | — |

**Anti-enumeration:** the `forgot-password` and `resend-verification` proxy routes
collapse every non-`429` outcome (including transport errors) to a generic
`200 { success: true }`, and the forms show one fixed confirmation regardless of
whether the address exists. Never add a "no such account" branch here.

**Login `403 email_not_verified`:** `authorize()` in `src/lib/auth.ts` throws
`EmailNotVerifiedError extends CredentialsSignin` with `code =
"email_not_verified"` on a `403`. Auth.js writes that `code` into the sign-in
redirect URL, and `signIn(..., { redirect: false })` returns it as `res.code`.
`LoginForm` reads `res.code` to show a "verify first" message + inline resend
instead of the generic "wrong password". Every other failure stays `null` →
generic (no leak).

**Note (types):** the four proxy routes call the backend via
`src/lib/api/backend-fetch.ts` (plain `fetch`) rather than the typed `apiClient`,
because the committed `openapi.json` predates these endpoints. Regenerate with
`npm run api:types` (backend must be running) and they can migrate to `apiClient`.

Shared resend UI: `src/components/auth/resend-verification.tsx` (60 s cooldown;
takes a fixed `email` prop, or renders an e-mail field when the address is
unknown, e.g. on the verify-email error state).

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
| `src/app/api/auth/{forgot-password,reset-password,verify-email,resend-verification}/route.ts` | Anonymous auth proxy routes (Prompt 18b) |
| `src/lib/api/backend-fetch.ts` | Server-only `fetch` helper for the not-yet-typed 18b endpoints |
| `src/components/auth/{forgot-password-form,reset-password-form,verify-email-client,check-email-client,resend-verification}.tsx` | 18b flow UI |
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
- Password reset **is** implemented (Prompt 18b) — see the flows section above
- No database adapter — sessions are pure JWT; invoice-api owns the user store.
  Prisma was removed entirely (it broke the Edge middleware and did nothing for
  Credentials logins with JWT session strategy)
