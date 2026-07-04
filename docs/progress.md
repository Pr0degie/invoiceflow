# Progress log

Newest first. One entry per prompt/work package.

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
