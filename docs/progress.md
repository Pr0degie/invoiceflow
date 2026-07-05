# Progress log

Newest first. One entry per prompt/work package.

---

## 2026-07-05 — Password reset & e-mail verification UI — Prompt 18b

Frontend for the flows the backend gained in 18a. Reuses the existing auth
form/page patterns (AuthLayout, inline `Alert`, shadcn `Input`/`Button`) — no new
abstractions, no redesign.

**Pages (new):**
- `/auth/forgot-password` — e-mail field; after submit **always** the same neutral
  confirmation, no known/unknown branch (anti-enumeration).
- `/reset-password?token=…` — **root-level**, matches the backend's e-mail link
  (`{FRONTEND_BASE_URL}/reset-password`). New password + repeat, register-grade
  client validation. Success → banner + redirect to `/auth/login?reset=true`.
  Missing/expired/used token → clear message + link back to forgot-password.
- `/verify-email?token=…` — **root-level**, matches the backend link. Redeems the
  token on load (StrictMode-guarded, single-use). Success → login link; failure →
  resend form.
- `/auth/check-email?email=…` — post-register "confirm your inbox" screen with a
  resend button (60 s cooldown).

**Changed:** register no longer auto-logs-in (would 403) → routes to
`/auth/check-email`. Login distinguishes **403 `email_not_verified`** from bad
credentials via a `CredentialsSignin` subclass whose `code` reaches the client as
`res.code`; on that path it shows a "verify first" message + inline resend.
"Forgot password?" is now a real link.

**API proxy routes (new, mirror `register/route.ts`):** `forgot-password`,
`reset-password`, `verify-email`, `resend-verification` under
`src/app/api/auth/*`. forgot/resend collapse every non-429 outcome to a generic
`200` so neither the happy path nor a transport error can leak account state.
These call the backend via a small `backendFetch` helper (plain `fetch`) instead
of the typed `apiClient`, because the committed `openapi.json` predates 18a and
the backend can't be reached from this box to regenerate — **once the spec is
regenerated (`npm run api:types`) they can move onto `apiClient`.**

**i18n:** all new copy in `de` (reference) + `en`, formal "Sie" to match existing
auth strings. New namespaces `auth.{forgotPasswordPage,resetPasswordPage,
verifyEmailPage,checkEmailPage,resend}` + `auth.errors.emailNotVerified` +
`auth.signIn.passwordResetDone`.

**Verified:** `npm run build` green (all 6 new routes registered), `npx tsc
--noEmit` clean, `npm run lint` clean. Dev server: all pages render 200 in `en`
and `de` with the expected copy; API routes exercised without a backend —
forgot/resend → `200 {success}` (generic), bad e-mail → `400`, short password →
`400`, missing token → `400`. Traced the NextAuth internals to confirm a
`CredentialsSignin.code` is propagated into the redirect URL and surfaced as
`res.code` (`@auth/core` index.js L133-134 + `next-auth/react.js` L175).

**NOT run here (environment gaps, not code gaps):**
- **Live end-to-end against invoice-api** — the backend isn't running on this
  machine (port 5432 is held by another project's Docker stack; see auto-memory).
  Reset/verify against a live backend would return `204`/`400`; without one they
  correctly fall to `500`. Copy the links from the backend's `LogEmailSender`
  output to run the four flows manually once the backend is up.
- **Playwright screenshots (§5)** — the Playwright MCP wasn't available in the
  session. The pages reuse existing auth layout/components, so no new visual
  surface; still, a 1440/375 + dark-mode pass is owed before this is truly done.
- Note: the backend e-mail links carry **no locale prefix**, so with
  `localePrefix: "as-needed"` they resolve to the default `en` locale even for
  German users. If German landing pages are wanted, the backend must include the
  locale in `FRONTEND_BASE_URL` links (frontend can't fix this alone).

---

## 2026-07-05 — Password reset & e-mail verification — Prompt 18a

Backend-only (invoice-api); the frontend flow follows in Session 18b against the
updated `docs/api-contract.md`. ADR: `../invoice-api/docs/adr/0006-password-reset-and-email-verification.md`.

**Mail:** `IEmailSender` with `SmtpEmailSender` (MailKit, `Email__Smtp*`) and a
log-only `LogEmailSender` (writes the mail + link to the log). Selected by
`Email:Provider`; log-only is the default in Development / when SMTP is unset.
Plain-text German mails, no templates, no queue.

**E-mail verification:** registration now creates the user `EmailVerifiedAt=null`
and **issues no session** — it returns `201 { message }` and mails a 24 h link.
`POST /auth/verify-email { token }` redeems it. Unverified login is blocked with
**`403 email_not_verified`** (a deliberate, documented exception to our
anti-enumeration rule — the user must understand the problem, and existence is
already known to whoever holds the password). `POST /auth/resend-verification`
mirrors forgot-password's anti-enumeration (always generic 200).

**Password reset:** `POST /auth/forgot-password` — always `200`, generic message,
dummy work on the miss path so neither body nor timing leaks account existence;
on a hit, mails a 1 h link. `POST /auth/reset-password { token, newPassword }`
sets the password, consumes the token, and **revokes all refresh tokens**. Login
also now runs a BCrypt verify against a dummy hash for unknown e-mails (timing).

**Data:** `EmailVerifiedAt` on `User`; one `UserTokens` table (SHA-256-hashed,
single-use, TTL, `Type` discriminator PasswordReset|EmailVerification), same
hardening as refresh tokens (ADR 0001). Migration
`AddEmailVerificationAndUserTokens` **backfills `EmailVerifiedAt = CreatedAt`** for
existing users (grandfathered — no lock-out); seed users are pre-verified.

**Verified:** `dotnet test` **141 green** (121 → +20: verify happy/expired/
consumed/wrong-type, resend & forgot known/unknown identical response, reset
happy/reuse/expired/wrong, refresh-token revocation after reset, login blocked
unverified → freed after verify). Migration applied on a real Postgres both
**empty** (fresh apply of all migrations) and **populated** (legacy user →
`EmailVerifiedAt` backfilled to `CreatedAt`; `UserTokens` + indexes + cascade FK
created). Full flow driven over HTTP: register→201, login-unverified→403, verify→
204, login→200, forgot→200, reset→204, old-pw→401, new-pw→200, reused-token→400,
rate-limit→429.

**Open / follow-up:** MailKit 4.8.0 carries a moderate advisory
(GHSA-9j88-vvj5-vhgr) — bump to ≥4.9.0 when convenient (left as-is to keep this
change scoped). No SMTP wired in prod yet — set `Email__Provider=Smtp` + creds +
`FRONTEND_BASE_URL` on Railway before the reset/verify mails go out for real.

---

## 2026-07-04 — E-Rechnung (XRechnung / EN 16931) — Prompt 13

Cross-repo. Every finalized invoice now emits a legally binding German
**E-Rechnung (XRechnung 3.0, EN 16931 CII pure XML)** alongside the PDF, via
`ZUGFeRD-csharp` v18. Generated once at finalization and archived immutably in a
new `InvoiceXml` table (mirrors `InvoicePdf`; discarded on reopen, re-archived on
re-finalize). ADR: `../invoice-api/docs/adr/0004-e-invoice-xrechnung.md`.

**Backend (invoice-api):** migration `AddEInvoiceXRechnungSupport` — structured
recipient fields (`RecipientStreet/PostalCode/City/CountryCode/Email/VatId`,
`BuyerReference`) on `Invoice`, `Phone` on `User`, `InvoiceXml` table. New
`EInvoiceService` (§ 19 → tax category **E** + exemption text; Storno → type
**384** + negative amounts + BT-25 reference; seller from profile, buyer from
invoice; SEPA payment means from IBAN). Finalize now also requires seller phone
(BT-42) and structured recipient address + email (BT-49) → 409. New
`GET /api/invoices/{id}/xml` (draft → 409; legacy backfill only when data is
present). PDF recipient block now renders from structured fields. 7 new backend
tests (4 golden: Kleinunternehmer/Regel/Storno + seller/buyer mapping; XML
archiving; reopen discards XML; recipient precondition); full suite **121** green.

**Frontend (invoiceflow):** regenerated API types; invoice form recipient block
replaced with structured inputs + email + optional VAT ID + buyer reference;
settings gains a phone field + E-Rechnung hints, free-text sender-address
textarea removed (sender address now derived from the structured tax address);
"E-Rechnung (XML)" download button on finalized invoices (disabled + tooltip for
legacy invoices). `tsc` clean, `next build` green.

**Verified:** backend `dotnet test` 121 green; over HTTP against the rebuilt
container — finalize → XML type 380 (XRechnung 3.0, buyer reference, totals
match); Storno → type **384**, BT-25 = original number, negative totals; draft
`/xml` → 409. Sample XML eyeballed (correct spec ID, category E + § 19 text).
Screenshots (settings + invoice form, 1440/375, light + dark) reviewed.
All three sample XMLs (Kleinunternehmer / Regelbesteuerung / Storno) validated
in the **ELSTER E-Rechnung viewer** — render cleanly, no errors, Storno shows
type 384 + negative totals + BT-25 reference to the original. Also fixed a
(pre-existing) dnd-kit SSR hydration warning on the line-items reorder handle
by giving `DndContext` a stable `id`.

---

## 2026-07-04 — Pauschal display mode per line item

Cross-repo. `LineItem.DisplayMode` (`AsEntered` | `FlatRate`, migration
`AddLineItemDisplayMode`): display-only — a FlatRate position renders on the
invoice (PDF + detail view) as quantity 1, unit "pauschal", unit price = line
total, while the entered quantity/unit/price stay stored and keep driving the
math. Storno keeps the sign (−1 × |total|). Copied on Storno; 3 new tests
(114 total). Frontend: "Display" dropdown per form row (As entered / Flat
rate), i18n de/en, detail view mirrors the PDF rendering. PDF header/total
already monochrome from the earlier prompt.

**Verified:** API round-trip (displayMode persists, totals unchanged),
rendered PDF shows 1 × pauschal × 720 € for an 8 h × 90 € entry next to a
normal row; dropdown switch + save in the browser updates the detail view;
screenshots 1440/375 light+dark, no console errors; `dotnet test` (114),
`tsc`, `next build` green.

## 2026-07-04 — Prompt 13 follow-up: drag & drop reordering of line items

Frontend only (the API already persists array order as `Position`). Line-item
rows in the invoice form get a grip handle: dragging reorders via
`useFieldArray().move()` (`@dnd-kit/core` + `sortable` + `modifiers` +
`utilities`, new deps). Drag activates only on the handle (5 px constraint),
restricted to the vertical axis; keyboard sorting via the focused handle
(Space/Enter + arrows) with `scrollBehavior: "auto"` (smooth scroll races the
sensor's rect measurements). Mobile: full-height grip strip on the card;
desktop: extra 24 px grid column, row dissolves into the grid via
`md:contents`. i18n `lineItem.reorder` de/en.

**Verified:** Playwright — mouse-drag row 3 → top, saved, API returns the new
order; keyboard pick-up/move/drop round-trip; screenshots 1440/375
light+dark, no console errors; `tsc` + `next build` green.

## 2026-07-04 — Prompt 13: Line-item order, PDF sender line, reopen finalized invoices

Cross-repo; ADR: `../invoice-api/docs/adr/0003-reopen-finalized-invoices-before-dispatch.md`.

**Backend (invoice-api), 111 tests green:**

1. **Part A — stable line-item order.** `LineItem.Position` (zero-based input
   order; migration `AddLineItemPosition`, existing rows default 0 — original
   order not reconstructible). Stamped from the array index in
   Create/Update, copied on Storno and in the seed data. Every read path
   sorts: ordered `Include`s, `ToResponse` mapping, and defensively in
   `PdfService` — the Guid PK made unsorted `Include`s return arbitrary order.
2. **Part B — DIN 5008 sender line.** Font `.Underline()` replaced by a thin
   rule (`LineHorizontal(0.5f)`, `#d1d5db`, matching the footer) with
   `PaddingTop(2)/PaddingBottom(8)` — no more underline sitting on the
   recipient name.
3. **Part C — `POST /api/invoices/{id}/reopen`** (Finalized → Draft, audited
   GoBD exception for pre-dispatch corrections): number retained, sequence
   untouched; re-finalize reuses the existing number (retry loop skipped);
   archived PDF deleted at reopen, re-archived at re-finalization. Guards:
   Draft → 400; Paid/Cancelled/Cancellation → 409. New guard: reopened drafts
   (number assigned) cannot be deleted (409, would tear a sequence gap).
   Append-only `InvoiceAuditEntries` table (migration `AddInvoiceAuditEntries`)
   records every reopen.
4. 16 new tests: order round-trips (create/update/storno, position-sorted
   reads), reopen guards + audit, re-finalize number reuse without sequence
   increment, fresh-PDF archiving, delete guard.

**Frontend (invoiceflow):**

5. `openapi.json` + `schema.d.ts` regenerated. New `useReopenInvoice()` hook.
6. Detail view: finalized invoices get a "Reopen for editing" action behind
   the more-menu; AlertDialog with GoBD explanation, amber Storno hint, and a
   mandatory "not sent to the recipient" checkbox gating the confirm button.
   On success → redirect to the edit form. i18n de/en (`invoices.reopen.*`).

**Verified:** full E2E against the rebuilt container — order round-trip
(create/edit/PDF), finalize `2026-020` → reopen (400/409 guards, delete 409)
→ edit → re-finalize reuses `2026-020`, next invoice draws `2026-021`,
re-archived PDF shows the corrected recipient (pypdf); audit rows in Postgres;
UI flow incl. checkbox gating + redirect via Playwright, screenshots
1440/375 light+dark, no console errors; `tsc` clean, `next build` green.

## 2026-07-03 — Prompt 12.2: Ausstellungsdatum at finalization (+ lockfile check)

**Backend (invoice-api), 95 tests green:**

1. `POST /api/invoices/{id}/finalize` accepts an optional body
   `{ issueDate?: "YYYY-MM-DD" }`. Default (no body): `IssueDate = today` at
   finalization — a stale draft date no longer becomes the legal
   Ausstellungsdatum on the archived PDF. Explicit `issueDate` is respected;
   future dates → 400.
2. Payment terms preserved: `DueDate` shifts to keep the draft's
   `DueDate − IssueDate` span (clamped to ≥ 0) relative to the new IssueDate.
3. Dates are set before number assignment, so the invoice-number year derives
   from the final IssueDate (December draft finalized in January → `{newYear}-001`).
4. 6 new tests (default today, explicit date, future rejection, span shift,
   span clamp, number-year); overdue-filter and counter-reset tests reworked to
   back-dated finalization (future draft dates can no longer produce overdue
   finalized invoices).

**Frontend (invoiceflow):**

5. `openapi.json` + `schema.d.ts` regenerated. `useFinalizeInvoice` now takes
   `{ id, issueDate? }` — no body sent unless the user overrides (server stamps
   its own today, avoiding client/server midnight skew).
6. Both finalize confirmation dialogs (detail view + row actions) show the
   Ausstellungsdatum (default: today) with a date input capped at today;
   i18n de/en. "Save & Finalize" in the form sends no override.
7. `package-lock.json` audited for the reported `npm ci` drift: already in
   sync at HEAD (`npm install` produced no diff; clean-state `npm ci` green) —
   nothing to commit.

## 2026-07-03 — Prompt 12 Part B: Legally compliant invoices (§ 14/§ 19 UStG, GoBD)

Cross-repo feature; ADR: `../invoice-api/docs/adr/0002-invoice-immutability-and-pdf-archiving.md`.

**Backend (invoice-api), 89 tests green:**

1. Sender tax profile on `User`: Steuernummer, USt-IdNr., Kleinunternehmer
   flag (`IsSmallBusiness`, default true — existing users migrated to false),
   structured address (street/zip/city/country), IBAN/BIC/bank. `UserDto` /
   `PATCH /me` extended (null = unchanged, "" = clear; IBAN validated).
2. Status rework: `Draft → Finalized ⇄ Paid`; `Cancelled` terminal.
   `Sent` folded into `Finalized`; **`Overdue` is derived** (`isOverdue`,
   Finalized + past due), no longer stored. `?status=Overdue` stays as a
   virtual list filter. Migration remaps stored enum ints.
3. `POST /invoices/{id}/finalize`: gates on complete tax profile + service
   date/period (409 otherwise), forces § 19 math (VatRate 0, gross = net),
   snapshots `IsSmallBusiness`, assigns the number **atomically** from a
   per-user/per-year `InvoiceNumberSequence` (`{year}-{NNN}`, counter =
   concurrency token, unique index as backstop), archives the PDF. Invoice
   numbers are `null` while Draft; drafts remain the only editable/deletable
   state (409 otherwise, pre-existing).
4. `POST /invoices/{id}/cancel`: Stornorechnung (own number, negated line
   items, `cancellationOf*` reference, immediately Finalized + archived),
   original → Cancelled. Paid must be un-marked first. PATCH /status can no
   longer reach Cancelled or leave Draft.
5. PDF (QuestPDF): German § 14 Abs. 4 layout — sender block + Absenderzeile,
   recipient, Steuernummer/USt-IdNr., Rechnungs-/Leistungsdatum bzw.
   -zeitraum, positions with Menge/Einheit/Einzelpreis, net total; verbatim
   "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet." for Kleinunternehmer,
   else Netto/USt/Brutto; bank details + Zahlungsziel footer; de-DE formats.
   Rendered **once at finalization**, stored as DB blob (`InvoicePdfs`),
   `GET /pdf` serves the archive (drafts: live ENTWURF-watermark preview).
   Fixed pre-existing bug: Docker image had no fonts → text-less PDFs
   (fontconfig + fonts-liberation added).
6. Stats: `finalizedCount` replaces `sentCount`, `monthlyRevenue[].finalized`
   replaces `.sent`, overdue derived, Cancellation invoices excluded.
7. Seed rework: complete § 19 demo profile, per-year numbers (2025-001…,
   2026-001…), storno pair, archived PDFs, drafts without numbers.

**Frontend (invoiceflow):**

8. Settings: new "Steuern & Rechnungsdaten" tab — tax IDs (+ either/or
   note), Kleinunternehmer switch with explainer, structured address, bank
   details; amber hint while the profile is incomplete. Shared completeness
   check in `src/lib/tax-profile.ts` (mirrors the backend gate).
9. Invoice form: Leistungsdatum/-zeitraum picker (mode toggle + zod
   cross-validation); Kleinunternehmer: VAT select replaced by a § 19 note,
   VAT row hidden in totals, taxRate forced to 0; "Save & finalize" with
   confirmation dialog ("cannot be edited afterwards"), disabled with a
   settings-link hint while tax data is incomplete.
10. List/detail: `Finalized` shown as "Open"/"Offen", derived Overdue badge,
    drafts show italic "Draft/Entwurf" instead of a number; Finalize (confirm
    dialog), Storno (confirm dialog → navigates to the new Stornorechnung),
    Mark as unpaid (Paid → Finalized); cross-reference banners between
    original and Storno; timeline Created → Finalized → Paid/Cancelled.
    Edit stays draft-only (existing redirect guard).
11. `openapi.json` + `schema.d.ts` regenerated; `docs/api-contract.md`
    rewritten for the new endpoints/fields; de/en messages extended.

**Verified:** backend suite (89) green incl. concurrent-finalization numbering
and per-year reset; API E2E over HTTP: draft (number null) → finalize →
`2026-014` + § 19 math + PUT/DELETE 409 + archived PDF → cancel → Storno
`2026-015` referencing `2026-014`, original Cancelled with back-reference,
PATCH→Cancelled 409. PDFs read back and checked for all Pflichtangaben + the
verbatim § 19 sentence. Browser E2E (Playwright, headless): login → settings
tax tab → finalize with dialog → edit-guard redirect → storno with dialog →
dashboard; screenshots at 1440px + 375px + dark mode reviewed; no console
errors. `tsc` clean, `next build` green.

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
