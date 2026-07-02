# Progress log

Newest first. One entry per prompt/work package.

---

## 2026-07-02 — Prompt 12.1: Security & robustness hardening

Cross-repo pass (invoice-api + invoiceflow), one commit per task.

**Backend (invoice-api), 65 tests green:**

1. Middleware order fixed — `UseRateLimiter` after auth (per-user partitioning
   works now), `UseForwardedHeaders` first (real client IP behind Railway).
2. `refresh` + `logout` rate-limited per IP (`auth-ip`, 5/min).
3. JWT signing-key fallback (`new string('x', 32)`) removed.
4. Stopgap status-transition guard in `UpdateStatusAsync`
   (Draft→Sent, Sent→Paid|Overdue|Cancelled, Overdue→Paid|Cancelled,
   Paid→Overdue; 409 otherwise; `PaidAt` survives Paid→Overdue→Paid, cleared
   only on Cancelled). Full workflow rework: Prompt 12 Part B.
5. Refresh tokens stored as SHA-256 hashes; migration wipes old rows
   (users re-login); login deletes the user's expired tokens.
6. 60 s rotation grace window (concurrent refreshes get the same successor
   from an in-memory cache) + theft detection (reuse after grace revokes all
   sessions). ADR: `../invoice-api/docs/adr/0001-refresh-token-rotation-grace.md`.
7. Central `ExceptionHandlingMiddleware` (400/401/404/409, `{ error }` shape
   unchanged); per-action try/catch removed; Register keeps email-in-use→409.
8. CORS: `AllowCredentials` dropped; Vercel preview origins now via
   `Cors:PreviewOriginSuffix` (empty = disabled).
9. `Seed:Enabled=false` in Production defaults; demo instance opts in via
   `Seed__Enabled=true`; warning logged when seeding in Production.

**Frontend (invoiceflow):**

10. Global dead-session handling: `SessionGuard` signs out on
    `RefreshAccessTokenError`; `QueryCache`/`MutationCache` `onError` signs out
    on 401 (no retry, deduped via `signOutOnAuthError()`). See `docs/auth.md`.
11. Cleanup: redundant `staleTime` removed from `useInvoices` list hook;
    `docs.zip` removed from the repo (backend: committed `build.log` removed).

**Verified:** full backend suite (65) green; over HTTP against the rebuilt
container: grace replay returns identical tokens, post-grace replay 401s and
kills the successor session, 6th auth request in a minute → 429, Draft→Paid →
409 `{ error }`, unknown invoice → 404 `{ error }`. Frontend: `tsc` clean,
`next build` green. Still manual: browser check that an invalidated session
redirects to login on the next query (no Playwright available in this run).
