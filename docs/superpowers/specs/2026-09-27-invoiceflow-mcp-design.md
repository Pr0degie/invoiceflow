# InvoiceFlow MCP — AI-drafted invoices from Tempo worklogs

**Date:** 2026-09-27 · **Status:** design approved in chat, awaiting spec review

## 1. Goal

Let an AI assistant (Claude Code) draft hourly invoices in InvoiceFlow from the
hours a freelancer has logged in **Tempo** (Jira Cloud), so a billing run is one
prompt instead of an evening of copy-paste.

Hard requirements:

- **Invoice hours equal Tempo hours, per Jira ticket.** The client audits
  invoices against Tempo. The invoiced quantity is therefore computed in code
  from Tempo data, never typed by the model.
- **Drafts only.** Finalization is irreversible (GoBD: sequential number,
  archived PDF + E-Rechnung). A human reviews and finalizes in the web UI.
- **Weekly hour cap is checked, never enforced.** Weeks over a configured cap
  are reported as a warning. Hours are never cut to fit.
- **Hourly display.** Positions are `unit: "h"`, `displayMode: "AsEntered"`
  (`n h × rate`), not collapsed to *pauschal*.

## 2. Non-goals

- Finalize, cancel, reopen or delete through the MCP.
- Writing to Tempo or Jira (missing hours are reported; the human books them).
- Positions that are not backed by Tempo worklogs.
- Personal access tokens / hosted deployment of the MCP (email + password login
  is enough while it runs locally; revisit when InvoiceFlow is hosted).
- A customer entity (the API has none; the recipient is copied from a previous
  invoice).

## 3. Architecture

```
Claude Code
 ├─ rechnung-erstellen skill (private, ~/.claude/skills — billing rules, client data)
 │    orchestrates:
 ├─ invoiceflow MCP (this repo, mcp/)  ── HTTPS ──► invoice-api  (drafts, profile, PDF)
 │                                      ── HTTPS ──► Tempo API v4 (worklogs)
 ├─ Atlassian MCP (existing)  → issue id → key + summary, meeting ticket
 ├─ Toggl MCP (existing)      → daily totals for reconciliation
 ├─ Google Calendar connector → meetings for reconciliation
 └─ git log (local clones)    → commit messages for position descriptions
```

Split of responsibility: **numbers in code, words by the model.** The MCP owns
everything that must be exact (fetching worklogs, summing, hour quantities,
completeness, overlap, cap). The model owns grouping, descriptions and rate
proposals, and the reconciliation narrative.

The MCP stays generic and public (portfolio). Anything client-specific — rates,
client name/address, meeting ticket key, repo paths — lives in the private
skill and in `mcp/.env`, never in this repo.

## 4. Component: `mcp/` — the InvoiceFlow MCP server

### 4.1 Runtime and layout

- Separate package in `mcp/` with its own `package.json` (`"type": "module"`,
  `engines.node >= 24`). Dependencies: `@modelcontextprotocol/sdk`, `zod`.
- Runs TypeScript directly via Node 24 type stripping
  (`node mcp/src/index.ts`) — no build step. `tsc --noEmit` for type checking
  (`allowImportingTsExtensions`, `erasableSyntaxOnly`).
- API types are imported type-only from `src/lib/api/schema.d.ts` (the
  generated OpenAPI types) — no hand-written API types.
- Transport: stdio. Registered once at user scope:
  `claude mcp add --scope user invoiceflow -- node <repo>/mcp/src/index.ts`.
- Tests: `node --test` (built-in runner, no extra dependency).

```
mcp/
  package.json  tsconfig.json  .env.example  README.md
  src/
    index.ts          MCP server + tool registration
    config.ts         loads mcp/.env (process.loadEnvFile), validates with zod
    invoiceflow.ts    invoice-api client (login, 401 → re-login once, retry)
    tempo.ts          Tempo client (pagination)
    worklogs.ts       pure aggregation: byIssue / byDay / byWeek / cap
    positions.ts      pure: positions → line items, completeness validation
    format.ts         pure: seconds → quantity, "3 h 41 min"
  test/               node:test unit tests + opt-in integration test
```

### 4.2 Configuration (`mcp/.env`, git-ignored)

| Var | Required | Meaning |
|---|---|---|
| `INVOICEFLOW_API_URL` | yes | e.g. `http://localhost:8080` |
| `INVOICEFLOW_EMAIL` / `INVOICEFLOW_PASSWORD` | yes | InvoiceFlow login |
| `TEMPO_API_TOKEN` | yes | Tempo → Settings → API Integration (read worklogs) |
| `TEMPO_ACCOUNT_ID` | yes | Atlassian account id whose worklogs are billed |
| `TEMPO_API_BASE` | no | default `https://api.tempo.io/4` (EU tenants: `https://api.eu.tempo.io/4`) |
| `WEEKLY_HOURS_CAP` | no | if set, weeks above it are flagged |
| `INVOICE_PDF_DIR` | no | default `<home>/Downloads` |

Missing/invalid config → the server still starts; every tool returns a clear
error naming the missing variable.

Why Tempo's API and not Jira's worklogs: Tempo writes Jira worklogs under its
app account ("Timesheets by Tempo"), so Jira cannot tell whose hours they are
(`worklogAuthor = currentUser()` returns nothing). Only Tempo knows the author.

### 4.3 Tools

**`get_profile()`** → sender profile plus `missingForFinalize: string[]`
(street, postalCode, city, country, phone, taxNumber-or-vatId) and
`recommended: string[]` (iban).

**`list_invoices({ status?, search? })`** → compact rows: `id, number, status,
type, recipientName, servicePeriodStart, servicePeriodEnd, serviceDate,
total, issueDate`.

**`get_invoice({ id })`** → the full invoice (used to copy recipient data from
the previous invoice to the same client).

**`get_worklogs({ from, to })`** — dates `YYYY-MM-DD`, inclusive.
Fetches the account's Tempo worklogs (`GET /worklogs/user/{accountId}`, all
pages). For the cap check it also fetches the rest of every ISO week (Mon–Sun)
that the period touches. Returns:

```ts
{
  period: { from, to },
  worklogs: { id, issueId, date, seconds, description }[],   // inside period only
  byIssue:  { issueId, seconds, hours, worklogCount, firstDate, lastDate }[],
  byDay:    { date, seconds }[],
  byWeek:   { weekStart, seconds, hours, overCap, extendsOutsidePeriod }[],
  totalSeconds
}
```

Tempo v4 returns issue **ids**, not keys; the skill resolves them via the
Atlassian MCP (`id in (…)`).

**`create_draft_invoice(input)`**

```ts
{
  from, to,                                   // becomes the Leistungszeitraum
  recipient: { name, street, postalCode, city, countryCode, email?, vatId?, buyerReference? },
  positions: { issueIds: number[], description: string, unitPrice: number }[],
  exclude?:  { issueIds: number[], reason: string }[],
  dueInDays?: number,                         // default 14
  notes?: string,
  allowOverlap?: boolean                      // default false
}
```

The tool **re-fetches** the worklogs for `from..to` itself (it never trusts
hour numbers from the model), then:

1. **Completeness:** every worklog's `issueId` must appear in exactly one
   position or in `exclude`. Unassigned or double-assigned ids → error listing
   them. A position whose issues have 0 seconds in the period → error.
2. **Overlap:** a non-cancelled invoice to the same `recipient.name` whose
   service period/date overlaps `from..to` → error, unless `allowOverlap`.
3. **Line items:** per position `quantity = round(seconds / 3600, 2)`,
   `unit: "h"`, `displayMode: "AsEntered"`, `unitPrice` as given, and the exact
   duration appended to the description: `"… (3 h 41 min)"`.
4. **Invoice:** sender from the profile defaults, `taxRate` 0 when the profile
   is `isSmallBusiness` (else 0.19), `issueDate` today,
   `dueDate` today + `dueInDays`, `servicePeriodStart/End` = `from/to`.
5. `POST /api/invoices` → returns `{ invoiceId, positions: [{ description,
   hours, unitPrice, total }], total, warnings }` where warnings include
   over-cap weeks and `missingForFinalize`.

**`update_draft_invoice({ id, ...same input as create })`** — same pipeline,
`PUT /api/invoices/{id}` (the API rejects non-drafts with 409, surfaced as-is).
Overlap check ignores the invoice being updated.

**`save_invoice_pdf({ id, directory? })`** → downloads `GET
/api/invoices/{id}/pdf` to
`<dir>/<number or "Entwurf">_<recipient>_<from>_<to>.pdf`, returns the path.

### 4.4 Precision decision

`quantity` is rounded to **0.01 h** (36 s). Reason: the PDF prints quantities
as `0.##` while the line total uses the stored quantity — an unrounded
`3.6833 h × 100 €` would print as `3,68 × 100,00 = 368,33 €`, visibly wrong
arithmetic on a legal document. With 0.01 h the maximum deviation is 18 s per
position, the exact duration is stated in the description, and 2-decimal hours
are also what Tempo's reports display. This is display precision, not billing
rounding (no rounding up to 15 minutes).

### 4.5 Errors

All tool failures return an MCP error result with a human-readable message:

| Situation | Message gist |
|---|---|
| invoice-api unreachable | "InvoiceFlow API not reachable at `<url>` — is `docker compose up` running in invoice-api?" |
| login 401 / 403 `email_not_verified` | wrong credentials / verify the account first |
| any 4xx from invoice-api | the API's `{ error }` text verbatim |
| Tempo 401/403 | "Tempo token invalid, expired or lacks worklog read scope" |
| completeness / overlap violation | the offending issue ids / invoice numbers |

## 5. Component: `rechnung-erstellen` skill (private)

Lives in `~/.claude/skills/rechnung-erstellen/SKILL.md`, **not in this repo**
(it contains client data and rates). Holds the billing rules: rate table
(meeting rate, standard rate, complex-work rate with criteria), meeting ticket
key, recipient to copy from, local repo paths + author emails, calendar filter.

Workflow for "Rechnung für <Zeitraum>":

1. **Period and recipient.** Ask for `from`/`to` if not given (no sprint
   automation — the Jira project has no sprints). Copy recipient data from the
   latest invoice to that client (`list_invoices` + `get_invoice`); ask for the
   recipient e-mail if missing.
2. **Pre-checks.** `get_profile` (warn about missing fields),
   `list_invoices` (period already billed?).
3. **Hours.** `get_worklogs`; resolve issue ids → keys + summaries via the
   Atlassian MCP.
4. **Reconcile, then stop if anything is off.** Compare Tempo `byDay` with
   Toggl daily totals; list calendar meetings with no matching worklog on the
   meeting ticket; list commit days without worklogs. Output one table of
   discrepancies and ask the user to book the missing time in Tempo, then
   re-run step 3.
5. **Cap.** Show `byWeek` entries with `overCap`.
6. **Propose positions.** One position per Jira ticket (auditable 1:1 against
   Tempo). Description = ticket key + summary + what was done (from commits and
   Toggl text), in German, in the style of previous invoices. Rate proposal per
   position with a one-line justification; meeting ticket → meeting rate.
   The user confirms or edits.
7. **Draft.** `create_draft_invoice` → `save_invoice_pdf` → show a summary table
   (ticket, hours, rate, total), warnings, and the PDF path. Remind the user to
   review and finalize in the web UI. Never finalize.

## 6. Repo integration

- Root `tsconfig.json`: add `"mcp"` to `exclude` (the root `include` of
  `**/*.ts` would otherwise type-check it against the Next.js config).
- `.dockerignore`: add `mcp` (not part of the web image).
- `.env` is already git-ignored at any depth; add `mcp/.env.example`.
- CI (`.github/workflows/ci.yml`): new `mcp` job — `npm ci`, `npx tsc --noEmit`,
  `node --test` inside `mcp/`.
- `mcp/README.md`: what it does, setup, tool list — written for portfolio
  readers.

## 7. Testing

- **Unit (node:test), pure modules:** aggregation (by issue/day/ISO week,
  weeks extending outside the period, cap flag), seconds → quantity and
  "h min" formatting, completeness (unassigned, double-assigned, empty
  position), overlap detection (period vs. period, period vs. single service
  date, cancelled invoices ignored, self ignored on update).
- **Tempo client:** mocked `fetch`, pagination via `metadata.next`, auth errors.
- **Integration (opt-in, `INVOICEFLOW_IT=1`):** against the local invoice-api —
  login, create draft, read back line items (quantity, unit, displayMode,
  totals), clean up via `DELETE` in the test itself.
- **Acceptance:** the first real draft, compared ticket by ticket with the
  Tempo report by the user.

## 8. Rollout

1. Build `mcp/` with tests; wire CI.
2. Write the private skill.
3. Setup: `mcp/.env`, `claude mcp add --scope user invoiceflow …`, connect the
   Google Calendar connector; Atlassian (plugin) and Toggl MCPs already work.
4. User: book calendar meetings on the meeting ticket in Tempo; fill tax
   number and IBAN in the profile.
5. First run on the oldest open period; user reviews against Tempo, finalizes.

**Fallback if no Tempo API token can be obtained:** replace the Tempo client
with a parser for Tempo's "Logged Time" CSV export, configured via
`TEMPO_CSV_PATH` so that `get_worklogs` and the create/update re-fetch read the
same file; column mapping taken from a real export at that point. Everything
downstream stays the same. Not built unless needed.
