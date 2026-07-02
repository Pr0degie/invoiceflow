# Progress log

Newest first. One entry per prompt/work package.

---

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
