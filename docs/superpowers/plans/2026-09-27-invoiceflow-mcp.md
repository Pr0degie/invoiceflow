# InvoiceFlow MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local MCP server (`mcp/`) that drafts hourly InvoiceFlow invoices whose hours are computed in code from Tempo worklogs.

**Architecture:** Pure modules (`format`, `worklogs`, `positions`, `overlap`, `profile`) hold all arithmetic and validation; thin HTTP clients (`invoiceflow`, `tempo`) talk to invoice-api and Tempo API v4; `draft` wires them into the create/update pipeline; `index` exposes seven MCP tools over stdio. TypeScript runs directly on Node 24 (type stripping) — no build step.

**Tech Stack:** Node 24, TypeScript 5.9 (typecheck only), `@modelcontextprotocol/sdk` 1.30.x, `zod` 4, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-27-invoiceflow-mcp-design.md`

## Global Constraints

- Node `>=24`; code runs via `node src/index.ts` — **erasable TypeScript only**: no `enum`, no `namespace`, **no constructor parameter properties** (`constructor(private x)`); use `#private` fields.
- Relative imports carry the `.ts` extension; type-only imports use `import type`.
- Runtime dependencies: `@modelcontextprotocol/sdk`, `zod` — nothing else. Dev: `typescript`, `@types/node`.
- API types come from `src/lib/api/schema.d.ts` (generated) — never hand-write API shapes.
- Line items: `quantity = round(seconds / 3600, 2)`, `unit: "h"`, `displayMode: "AsEntered"`, description suffixed with the exact duration `" (3 h 41 min)"`.
- Drafts only: no tool may finalize, cancel, reopen or delete.
- **No personal data in the repo** (public): no client names/addresses, rates, Atlassian account ids, tokens. Tests use fictional data ("Acme GmbH").
- Tool error messages are English and actionable.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A position with < 18 s of logged time** rounds to 0.00 h, which invoice-api rejects (`quantity >= 0.001`) — expect a clear validation error naming the position, not an HTTP 400. → Task 3.
2. **More than 100 invoices** — `GET /api/invoices` is paginated (default 25, max 100, no total); the overlap check must see all pages. → Task 5.
3. **Recipient name spelled differently** (`" acme gmbh "` vs `"Acme GmbH"`) must still be detected as an overlap. → Task 3.
4. **Date arithmetic across the DST switch** (2026-10-25) must not shift dates. → Task 1.
5. **No `mcp/.env` at all** — the server must still start and list its tools; each tool returns a config error naming the missing variables. → Task 7.

---

## File Structure

```
mcp/
  package.json            scripts, deps, engines
  tsconfig.json           typecheck-only config for type stripping
  .env.example            documented config template
  README.md               portfolio-facing overview + setup
  src/
    format.ts             seconds→quantity, "h min", date math, PDF file name
    worklogs.ts           Worklog type, weekRange, assertPeriod, summarize
    positions.ts          PositionInput/ExcludeInput, ValidationError, buildLineItems
    overlap.ts            findOverlaps
    config.ts             env file loading, ConfigError, typed config getters
    tempo.ts              TempoClient (Tempo API v4, pagination)
    invoiceflow.ts        InvoiceFlowClient (login, 401 re-login, pagination), API type aliases
    profile.ts            missingForFinalize, recommended
    draft.ts              saveDraft pipeline (create + update)
    index.ts              MCP server, tool registration
  test/
    format.test.ts  worklogs.test.ts  positions.test.ts  overlap.test.ts
    config.test.ts  tempo.test.ts  invoiceflow.test.ts  profile.test.ts
    draft.test.ts  server.test.ts  integration.test.ts
Modify: tsconfig.json (exclude mcp), .dockerignore (mcp), .github/workflows/ci.yml (mcp job),
        docs/api-contract.md (list pagination)
Outside repo (Task 9): ~/.claude/skills/rechnung-erstellen/SKILL.md, mcp/.env, `claude mcp add`
```

---

### Task 1: Package scaffold, repo integration, `format.ts`

**Files:**
- Create: `mcp/package.json`, `mcp/tsconfig.json`, `mcp/.env.example`, `mcp/src/format.ts`, `mcp/test/format.test.ts`
- Modify: `tsconfig.json` (root, `exclude`), `.dockerignore`

**Interfaces:**
- Produces: `secondsToQuantity(seconds: number): number`, `formatDuration(seconds: number): string`, `addDays(date: string, days: number): string`, `isoWeekStart(date: string): string`, `pdfFileName(number: string | null | undefined, recipient: string, from: string, to: string): string`, `DATE_RE: RegExp`

- [ ] **Step 1: Create `mcp/package.json`**

```json
{
  "name": "invoiceflow-mcp",
  "version": "0.1.0",
  "private": true,
  "description": "MCP server that drafts InvoiceFlow invoices from Tempo worklogs",
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": {
    "start": "node src/index.ts",
    "test": "node --test \"test/**/*.test.ts\"",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create `mcp/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Install dependencies (creates `mcp/package-lock.json`)**

```bash
cd mcp && npm install @modelcontextprotocol/sdk@^1.30.1 zod@^4 && npm install -D typescript@~5.9.3 @types/node@^24
```

Expected: `added N packages`, no errors.

- [ ] **Step 4: Create `mcp/.env.example`**

```dotenv
# InvoiceFlow backend (local: `docker compose up` in ../invoice-api)
INVOICEFLOW_API_URL=http://localhost:8080
INVOICEFLOW_EMAIL=
INVOICEFLOW_PASSWORD=

# Tempo (Jira) → Settings → API Integration → New Token (worklogs: view)
TEMPO_API_TOKEN=
# Atlassian account id whose worklogs are billed
TEMPO_ACCOUNT_ID=
# EU data-residency tenants use https://api.eu.tempo.io/4
TEMPO_API_BASE=https://api.tempo.io/4

# Optional: flag weeks with more hours than this
WEEKLY_HOURS_CAP=
# Optional: where save_invoice_pdf writes (default: ~/Downloads)
INVOICE_PDF_DIR=
```

- [ ] **Step 5: Write the failing test `mcp/test/format.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, DATE_RE, formatDuration, isoWeekStart, pdfFileName, secondsToQuantity } from "../src/format.ts";

test("secondsToQuantity rounds to 0.01 h (36 s)", () => {
  assert.equal(secondsToQuantity(13260), 3.68); // 3 h 41 min
  assert.equal(secondsToQuantity(3350), 0.93);
  assert.equal(secondsToQuantity(3600), 1);
  assert.equal(secondsToQuantity(18), 0.01);
  assert.equal(secondsToQuantity(17), 0);
});

test("formatDuration prints hours and minutes, rounded to the minute", () => {
  assert.equal(formatDuration(13260), "3 h 41 min");
  assert.equal(formatDuration(2700), "45 min");
  assert.equal(formatDuration(7200), "2 h");
  assert.equal(formatDuration(89), "1 min");
});

test("addDays is timezone-proof across the DST switch (review focus)", () => {
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("isoWeekStart returns the Monday of the week", () => {
  assert.equal(isoWeekStart("2026-09-27"), "2026-09-21"); // Sunday
  assert.equal(isoWeekStart("2026-09-21"), "2026-09-21"); // Monday
  assert.equal(isoWeekStart("2026-07-08"), "2026-07-06"); // Wednesday
});

test("pdfFileName is filesystem-safe and falls back to Entwurf", () => {
  assert.equal(pdfFileName(null, "Acme GmbH", "2026-07-06", "2026-08-02"), "Entwurf_Acme_GmbH_2026-07-06_2026-08-02.pdf");
  assert.equal(pdfFileName("2026-002", "Müller & Söhne / Büro", "2026-07-06", "2026-07-06"), "2026-002_Müller_Söhne_Büro_2026-07-06_2026-07-06.pdf");
});

test("DATE_RE accepts YYYY-MM-DD only", () => {
  assert.ok(DATE_RE.test("2026-07-06"));
  assert.ok(!DATE_RE.test("06.07.2026"));
});
```

- [ ] **Step 6: Run it — expect failure**

Run: `cd mcp && npm test`
Expected: FAIL — `Cannot find module '.../src/format.ts'`.

- [ ] **Step 7: Implement `mcp/src/format.ts`**

```ts
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Hours with 0.01 h precision (36 s) — spec §4.4. */
export function secondsToQuantity(seconds: number): number {
  return Math.round(seconds / 36) / 100;
}

/** "3 h 41 min", "45 min", "2 h" — rounded to the nearest minute. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** YYYY-MM-DD ± n days, computed in UTC so DST never shifts the date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `date`. */
export function isoWeekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** "<number|Entwurf>_<recipient>_<from>_<to>.pdf", safe on Windows. */
export function pdfFileName(number: string | null | undefined, recipient: string, from: string, to: string): string {
  const safe = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "");
  return `${safe(number ?? "Entwurf")}_${safe(recipient)}_${from}_${to}.pdf`;
}
```

- [ ] **Step 8: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: `# pass 6`, `# fail 0`; tsc prints nothing.

- [ ] **Step 9: Keep the web app out of `mcp/`**

In root `tsconfig.json` change `"exclude": ["node_modules"]` to:

```json
  "exclude": [
    "node_modules",
    "mcp"
  ]
```

Append to `.dockerignore`:

```
mcp
```

Run: `npx tsc --noEmit` (repo root)
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add mcp/package.json mcp/package-lock.json mcp/tsconfig.json mcp/.env.example mcp/src/format.ts mcp/test/format.test.ts tsconfig.json .dockerignore
git commit -F - <<'EOF'
feat(mcp): scaffold invoiceflow-mcp package with formatting helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: `worklogs.ts` — period filtering and aggregation

**Files:**
- Create: `mcp/src/worklogs.ts`, `mcp/test/worklogs.test.ts`

**Interfaces:**
- Consumes: `addDays`, `isoWeekStart`, `secondsToQuantity` (Task 1); `ValidationError` is defined in Task 3 — to avoid a cycle, `assertPeriod` throws its own `PeriodError` (below).
- Produces:
  - `interface Worklog { id: number; issueId: number; date: string; seconds: number; description: string }`
  - `interface IssueTotal { issueId: number; seconds: number; hours: number; worklogCount: number; firstDate: string; lastDate: string }`
  - `interface DayTotal { date: string; seconds: number }`
  - `interface WeekTotal { weekStart: string; seconds: number; hours: number; overCap: boolean; extendsOutsidePeriod: boolean }`
  - `interface WorklogSummary { period: { from: string; to: string }; worklogs: Worklog[]; byIssue: IssueTotal[]; byDay: DayTotal[]; byWeek: WeekTotal[]; totalSeconds: number }`
  - `class PeriodError extends Error` (name `"PeriodError"`)
  - `assertPeriod(from: string, to: string): void`
  - `weekRange(from: string, to: string): { from: string; to: string }`
  - `summarize(all: Worklog[], from: string, to: string, weeklyCapHours?: number): WorklogSummary`

- [ ] **Step 1: Write the failing test `mcp/test/worklogs.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPeriod, summarize, weekRange, type Worklog } from "../src/worklogs.ts";

const w = (id: number, issueId: number, date: string, seconds: number): Worklog => ({ id, issueId, date, seconds, description: "" });

test("weekRange expands a period to whole ISO weeks", () => {
  assert.deepEqual(weekRange("2026-07-08", "2026-07-20"), { from: "2026-07-06", to: "2026-07-26" });
});

test("assertPeriod rejects from after to and malformed dates", () => {
  assert.throws(() => assertPeriod("2026-07-10", "2026-07-01"), { name: "PeriodError", message: /after/ });
  assert.throws(() => assertPeriod("06.07.2026", "2026-07-10"), { name: "PeriodError", message: /YYYY-MM-DD/ });
  assert.doesNotThrow(() => assertPeriod("2026-07-06", "2026-07-06"));
});

test("summarize groups by issue and day inside the period only", () => {
  const all = [w(1, 10, "2026-07-05", 3600), w(2, 10, "2026-07-06", 1800), w(3, 11, "2026-07-06", 900), w(4, 10, "2026-07-07", 5400)];
  const s = summarize(all, "2026-07-06", "2026-07-12");
  assert.equal(s.totalSeconds, 8100);
  assert.deepEqual(s.worklogs.map((x) => x.id), [2, 3, 4]);
  assert.deepEqual(s.byIssue, [
    { issueId: 10, seconds: 7200, hours: 2, worklogCount: 2, firstDate: "2026-07-06", lastDate: "2026-07-07" },
    { issueId: 11, seconds: 900, hours: 0.25, worklogCount: 1, firstDate: "2026-07-06", lastDate: "2026-07-06" },
  ]);
  assert.deepEqual(s.byDay, [
    { date: "2026-07-06", seconds: 2700 },
    { date: "2026-07-07", seconds: 5400 },
  ]);
});

test("byWeek counts whole ISO weeks and flags the cap", () => {
  // period Wed 2026-07-08 .. Sun 2026-07-19; the Monday 07-06 lies outside it
  const all = [w(1, 10, "2026-07-06", 4 * 3600), w(2, 10, "2026-07-08", 7 * 3600), w(3, 11, "2026-07-14", 3 * 3600)];
  const s = summarize(all, "2026-07-08", "2026-07-19", 10);
  assert.deepEqual(s.byWeek, [
    { weekStart: "2026-07-06", seconds: 11 * 3600, hours: 11, overCap: true, extendsOutsidePeriod: true },
    { weekStart: "2026-07-13", seconds: 3 * 3600, hours: 3, overCap: false, extendsOutsidePeriod: false },
  ]);
  assert.equal(s.totalSeconds, 10 * 3600); // the Monday outside the period is not billed
});

test("exactly at the cap is not over it; without a cap nothing is flagged", () => {
  const all = [w(1, 10, "2026-07-06", 10 * 3600)];
  assert.equal(summarize(all, "2026-07-06", "2026-07-12", 10).byWeek[0].overCap, false);
  assert.equal(summarize([w(1, 10, "2026-07-06", 50 * 3600)], "2026-07-06", "2026-07-12").byWeek[0].overCap, false);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd mcp && node --test test/worklogs.test.ts`
Expected: FAIL — cannot find `../src/worklogs.ts`.

- [ ] **Step 3: Implement `mcp/src/worklogs.ts`**

```ts
import { addDays, DATE_RE, isoWeekStart, secondsToQuantity } from "./format.ts";

export interface Worklog { id: number; issueId: number; date: string; seconds: number; description: string }
export interface IssueTotal { issueId: number; seconds: number; hours: number; worklogCount: number; firstDate: string; lastDate: string }
export interface DayTotal { date: string; seconds: number }
export interface WeekTotal { weekStart: string; seconds: number; hours: number; overCap: boolean; extendsOutsidePeriod: boolean }
export interface WorklogSummary {
  period: { from: string; to: string };
  worklogs: Worklog[];
  byIssue: IssueTotal[];
  byDay: DayTotal[];
  byWeek: WeekTotal[];
  totalSeconds: number;
}

export class PeriodError extends Error {
  override name = "PeriodError";
}

export function assertPeriod(from: string, to: string): void {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) throw new PeriodError(`Dates must be YYYY-MM-DD (got "${from}", "${to}").`);
  if (from > to) throw new PeriodError(`"from" (${from}) is after "to" (${to}).`);
}

/** The whole ISO weeks (Mon–Sun) a period touches — used for the weekly cap. */
export function weekRange(from: string, to: string): { from: string; to: string } {
  return { from: isoWeekStart(from), to: addDays(isoWeekStart(to), 6) };
}

export function summarize(all: Worklog[], from: string, to: string, weeklyCapHours?: number): WorklogSummary {
  const worklogs = all
    .filter((w) => w.date >= from && w.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const issues = new Map<number, IssueTotal>();
  const days = new Map<string, number>();
  for (const w of worklogs) {
    const t = issues.get(w.issueId);
    if (t) {
      t.seconds += w.seconds;
      t.worklogCount += 1;
      t.lastDate = w.date;
    } else {
      issues.set(w.issueId, { issueId: w.issueId, seconds: w.seconds, hours: 0, worklogCount: 1, firstDate: w.date, lastDate: w.date });
    }
    days.set(w.date, (days.get(w.date) ?? 0) + w.seconds);
  }

  const range = weekRange(from, to);
  const weeks = new Map<string, number>();
  for (const w of all) {
    if (w.date < range.from || w.date > range.to) continue;
    const start = isoWeekStart(w.date);
    weeks.set(start, (weeks.get(start) ?? 0) + w.seconds);
  }

  return {
    period: { from, to },
    worklogs,
    byIssue: [...issues.values()]
      .map((t) => ({ ...t, hours: secondsToQuantity(t.seconds) }))
      .sort((a, b) => a.issueId - b.issueId),
    byDay: [...days.entries()].map(([date, seconds]) => ({ date, seconds })).sort((a, b) => a.date.localeCompare(b.date)),
    byWeek: [...weeks.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, seconds]) => ({
        weekStart,
        seconds,
        hours: secondsToQuantity(seconds),
        overCap: weeklyCapHours !== undefined && seconds > weeklyCapHours * 3600,
        extendsOutsidePeriod: weekStart < from || addDays(weekStart, 6) > to,
      })),
    totalSeconds: worklogs.reduce((sum, w) => sum + w.seconds, 0),
  };
}
```

- [ ] **Step 4: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: all tests pass, tsc silent.

- [ ] **Step 5: Commit**

```bash
git add mcp/src/worklogs.ts mcp/test/worklogs.test.ts
git commit -F - <<'EOF'
feat(mcp): aggregate worklogs by issue, day and ISO week with cap flag

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: `positions.ts` and `overlap.ts` — line items, completeness, double billing

**Files:**
- Create: `mcp/src/positions.ts`, `mcp/src/overlap.ts`, `mcp/test/positions.test.ts`, `mcp/test/overlap.test.ts`

**Interfaces:**
- Consumes: `Worklog` (Task 2), `formatDuration`, `secondsToQuantity` (Task 1)
- Produces:
  - `interface PositionInput { issueIds: number[]; description: string; unitPrice: number }`
  - `interface ExcludeInput { issueIds: number[]; reason: string }`
  - `interface LineItemDraft { description: string; quantity: number; unit: "h"; unitPrice: number; displayMode: "AsEntered"; seconds: number }`
  - `class ValidationError extends Error` (name `"ValidationError"`)
  - `buildLineItems(worklogs: Worklog[], positions: PositionInput[], exclude?: ExcludeInput[]): LineItemDraft[]`
  - `interface InvoiceRow { id?: string; number?: string | null; status?: string; type?: string; recipientName?: string | null; serviceDate?: string | null; servicePeriodStart?: string | null; servicePeriodEnd?: string | null }`
  - `findOverlaps(invoices: InvoiceRow[], recipientName: string, from: string, to: string, ignoreId?: string): InvoiceRow[]`

- [ ] **Step 1: Write the failing test `mcp/test/positions.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLineItems } from "../src/positions.ts";
import type { Worklog } from "../src/worklogs.ts";

const w = (id: number, issueId: number, date: string, seconds: number): Worklog => ({ id, issueId, date, seconds, description: "" });
const logs = [w(1, 10, "2026-07-06", 13260), w(2, 11, "2026-07-07", 1800), w(3, 12, "2026-07-08", 2700), w(4, 99, "2026-07-08", 600)];

test("one line item per position with Tempo-exact hours", () => {
  const items = buildLineItems(
    logs,
    [
      { issueIds: [10], description: "ABC-1 Suchfilter überarbeitet", unitPrice: 100 },
      { issueIds: [11, 12], description: "ABC-2 Abstimmungstermine ", unitPrice: 80 },
    ],
    [{ issueIds: [99], reason: "billed separately" }],
  );
  assert.deepEqual(items, [
    { description: "ABC-1 Suchfilter überarbeitet (3 h 41 min)", quantity: 3.68, unit: "h", unitPrice: 100, displayMode: "AsEntered", seconds: 13260 },
    { description: "ABC-2 Abstimmungstermine (1 h 15 min)", quantity: 1.25, unit: "h", unitPrice: 80, displayMode: "AsEntered", seconds: 4500 },
  ]);
});

test("rejects logged time that is in no position and not excluded", () => {
  assert.throws(() => buildLineItems(logs, [{ issueIds: [10, 11, 12], description: "x", unitPrice: 90 }]), {
    name: "ValidationError",
    message: /no position or exclude: 99/,
  });
});

test("rejects an issue claimed twice", () => {
  assert.throws(
    () => buildLineItems(logs, [
      { issueIds: [10, 11], description: "a", unitPrice: 90 },
      { issueIds: [10, 12], description: "b", unitPrice: 90 },
    ], [{ issueIds: [99], reason: "r" }]),
    { name: "ValidationError", message: /more than once: 10/ },
  );
});

test("rejects a position without logged time", () => {
  assert.throws(
    () => buildLineItems(logs, [
      { issueIds: [10, 11, 12], description: "a", unitPrice: 90 },
      { issueIds: [55], description: "ghost", unitPrice: 90 },
    ], [{ issueIds: [99], reason: "r" }]),
    { name: "ValidationError", message: /Position 2 \("ghost"\) has no logged time/ },
  );
});

test("rejects a position below 0.01 h (review focus)", () => {
  assert.throws(() => buildLineItems([w(1, 10, "2026-07-06", 17)], [{ issueIds: [10], description: "tiny", unitPrice: 90 }]), {
    name: "ValidationError",
    message: /Position 1 \("tiny"\) has only 17 s — below 0\.01 h/,
  });
});

test("rejects an empty position list", () => {
  assert.throws(() => buildLineItems(logs, []), { name: "ValidationError", message: /At least one position/ });
});
```

- [ ] **Step 2: Write the failing test `mcp/test/overlap.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { findOverlaps, type InvoiceRow } from "../src/overlap.ts";

const inv = (o: Partial<InvoiceRow>): InvoiceRow => ({
  id: "a", number: "2026-001", status: "Finalized", type: "Invoice", recipientName: "Acme GmbH",
  serviceDate: null, servicePeriodStart: null, servicePeriodEnd: null, ...o,
});
const find = (rows: InvoiceRow[], ignoreId?: string) => findOverlaps(rows, "Acme GmbH", "2026-07-06", "2026-08-02", ignoreId);

test("detects an overlapping service period", () => {
  assert.equal(find([inv({ servicePeriodStart: "2026-07-01", servicePeriodEnd: "2026-07-06" })]).length, 1);
});

test("adjacent periods do not overlap", () => {
  assert.equal(find([inv({ servicePeriodStart: "2026-06-01", servicePeriodEnd: "2026-07-05" })]).length, 0);
});

test("a single service date inside the period overlaps", () => {
  assert.equal(find([inv({ serviceDate: "2026-07-20" })]).length, 1);
});

test("recipient match ignores case and surrounding whitespace (review focus)", () => {
  assert.equal(find([inv({ recipientName: "  acme gmbh ", serviceDate: "2026-07-20" })]).length, 1);
});

test("drafts count as overlaps", () => {
  assert.equal(find([inv({ status: "Draft", number: null, serviceDate: "2026-07-20" })]).length, 1);
});

test("ignores cancelled, storno, other recipients, undated and the invoice being updated", () => {
  const rows = [
    inv({ id: "c", status: "Cancelled", serviceDate: "2026-07-20" }),
    inv({ id: "s", type: "Cancellation", serviceDate: "2026-07-20" }),
    inv({ id: "o", recipientName: "Other AG", serviceDate: "2026-07-20" }),
    inv({ id: "u" }),
    inv({ id: "self", status: "Draft", serviceDate: "2026-07-20" }),
  ];
  assert.equal(find(rows, "self").length, 0);
});
```

- [ ] **Step 3: Run both — expect failure**

Run: `cd mcp && node --test test/positions.test.ts test/overlap.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `mcp/src/positions.ts`**

```ts
import { formatDuration, secondsToQuantity } from "./format.ts";
import type { Worklog } from "./worklogs.ts";

export interface PositionInput { issueIds: number[]; description: string; unitPrice: number }
export interface ExcludeInput { issueIds: number[]; reason: string }
export interface LineItemDraft {
  description: string;
  quantity: number;
  unit: "h";
  unitPrice: number;
  displayMode: "AsEntered";
  seconds: number;
}

export class ValidationError extends Error {
  override name = "ValidationError";
}

/**
 * Turns the period's worklogs into one hourly line item per position.
 * Every issue with logged time must be claimed exactly once — by a position
 * or by `exclude` — so no logged time is silently dropped or billed twice.
 */
export function buildLineItems(worklogs: Worklog[], positions: PositionInput[], exclude: ExcludeInput[] = []): LineItemDraft[] {
  if (positions.length === 0) throw new ValidationError("At least one position is required.");

  const claimed = new Set<number>();
  const doubles = new Set<number>();
  for (const id of [...positions.flatMap((p) => p.issueIds), ...exclude.flatMap((e) => e.issueIds)]) {
    if (claimed.has(id)) doubles.add(id);
    claimed.add(id);
  }

  const secondsByIssue = new Map<number, number>();
  for (const w of worklogs) secondsByIssue.set(w.issueId, (secondsByIssue.get(w.issueId) ?? 0) + w.seconds);

  const problems: string[] = [];
  if (doubles.size > 0) problems.push(`Issue ids assigned more than once: ${[...doubles].sort((a, b) => a - b).join(", ")}`);
  const unassigned = [...secondsByIssue.keys()].filter((id) => !claimed.has(id)).sort((a, b) => a - b);
  if (unassigned.length > 0) problems.push(`Issue ids with logged time in the period but in no position or exclude: ${unassigned.join(", ")}`);

  const items = positions.map((p, i): LineItemDraft => {
    const description = p.description.trim();
    const seconds = p.issueIds.reduce((sum, id) => sum + (secondsByIssue.get(id) ?? 0), 0);
    const quantity = secondsToQuantity(seconds);
    if (seconds === 0) problems.push(`Position ${i + 1} ("${description}") has no logged time in the period`);
    else if (quantity === 0) problems.push(`Position ${i + 1} ("${description}") has only ${seconds} s — below 0.01 h; merge it into another position`);
    return { description: `${description} (${formatDuration(seconds)})`, quantity, unit: "h", unitPrice: p.unitPrice, displayMode: "AsEntered", seconds };
  });

  if (problems.length > 0) throw new ValidationError(problems.join("\n"));
  return items;
}
```

- [ ] **Step 5: Implement `mcp/src/overlap.ts`**

```ts
/** Structural subset of InvoiceResponse — accepts API invoices directly. */
export interface InvoiceRow {
  id?: string;
  number?: string | null;
  status?: string;
  type?: string;
  recipientName?: string | null;
  serviceDate?: string | null;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Live invoices (drafts included) to the same recipient whose service period touches from..to. */
export function findOverlaps(invoices: InvoiceRow[], recipientName: string, from: string, to: string, ignoreId?: string): InvoiceRow[] {
  return invoices.filter((inv) => {
    if (inv.id === ignoreId || inv.status === "Cancelled" || inv.type === "Cancellation") return false;
    if (norm(inv.recipientName) !== norm(recipientName)) return false;
    const start = inv.servicePeriodStart ?? inv.serviceDate;
    const end = inv.servicePeriodEnd ?? inv.serviceDate;
    return !!start && !!end && start <= to && end >= from;
  });
}
```

- [ ] **Step 6: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: all pass, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add mcp/src/positions.ts mcp/src/overlap.ts mcp/test/positions.test.ts mcp/test/overlap.test.ts
git commit -F - <<'EOF'
feat(mcp): build Tempo-exact line items and detect overlapping invoices

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: `config.ts` and `tempo.ts`

**Files:**
- Create: `mcp/src/config.ts`, `mcp/src/tempo.ts`, `mcp/test/config.test.ts`, `mcp/test/tempo.test.ts`

**Interfaces:**
- Consumes: `Worklog` (Task 2)
- Produces:
  - `type Env = Record<string, string | undefined>`
  - `class ConfigError extends Error` (name `"ConfigError"`)
  - `DEFAULT_ENV_FILE: string` (absolute path of `mcp/.env`)
  - `readEnvFile(path: string): Record<string, string>` (missing file → `{}`)
  - `loadEnv(file?: string, processEnv?: Env): Env` (file defaults to `process.env.INVOICEFLOW_MCP_ENV_FILE ?? DEFAULT_ENV_FILE`; process env wins)
  - `interface InvoiceFlowConfig { apiUrl: string; email: string; password: string }` + `invoiceFlowConfig(env: Env): InvoiceFlowConfig`
  - `interface TempoConfig { baseUrl: string; token: string; accountId: string }` + `tempoConfig(env: Env): TempoConfig`
  - `interface Settings { weeklyCapHours?: number; pdfDir: string }` + `settings(env: Env): Settings`
  - `class TempoError extends Error` (name `"TempoError"`)
  - `class TempoClient { constructor(cfg: TempoConfig, fetchFn?: typeof fetch); getWorklogs(from: string, to: string): Promise<Worklog[]> }`

- [ ] **Step 1: Write the failing test `mcp/test/config.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { invoiceFlowConfig, loadEnv, readEnvFile, settings, tempoConfig } from "../src/config.ts";

test("invoiceFlowConfig lists every missing variable (empty counts as missing)", () => {
  assert.throws(() => invoiceFlowConfig({ INVOICEFLOW_API_URL: "http://x", INVOICEFLOW_EMAIL: "" }), {
    name: "ConfigError",
    message: /INVOICEFLOW_EMAIL, INVOICEFLOW_PASSWORD .*mcp\/\.env/,
  });
});

test("invoiceFlowConfig returns the values", () => {
  assert.deepEqual(invoiceFlowConfig({ INVOICEFLOW_API_URL: "http://x", INVOICEFLOW_EMAIL: "a@b.de", INVOICEFLOW_PASSWORD: "pw" }), {
    apiUrl: "http://x", email: "a@b.de", password: "pw",
  });
});

test("tempoConfig requires token and account id and defaults the base URL", () => {
  assert.throws(() => tempoConfig({}), { name: "ConfigError", message: /TEMPO_API_TOKEN, TEMPO_ACCOUNT_ID/ });
  assert.equal(tempoConfig({ TEMPO_API_TOKEN: "t", TEMPO_ACCOUNT_ID: "a", TEMPO_API_BASE: "" }).baseUrl, "https://api.tempo.io/4");
});

test("settings parses the cap and defaults the PDF directory", () => {
  assert.deepEqual(settings({ WEEKLY_HOURS_CAP: "10" }), { weeklyCapHours: 10, pdfDir: join(homedir(), "Downloads") });
  assert.deepEqual(settings({ WEEKLY_HOURS_CAP: "", INVOICE_PDF_DIR: "C:/out" }), { weeklyCapHours: undefined, pdfDir: "C:/out" });
  assert.throws(() => settings({ WEEKLY_HOURS_CAP: "ten" }), { name: "ConfigError", message: /WEEKLY_HOURS_CAP/ });
});

test("readEnvFile parses a file and returns {} when it is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ifmcp-"));
  const file = join(dir, ".env");
  writeFileSync(file, "INVOICEFLOW_EMAIL=a@b.de\n# comment\nWEEKLY_HOURS_CAP=10\n");
  assert.deepEqual(readEnvFile(file), { INVOICEFLOW_EMAIL: "a@b.de", WEEKLY_HOURS_CAP: "10" });
  assert.deepEqual(readEnvFile(join(dir, "missing.env")), {});
});

test("loadEnv lets the process environment win over the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "ifmcp-"));
  const file = join(dir, ".env");
  writeFileSync(file, "A=file\nB=file\n");
  const env = loadEnv(file, { B: "process" });
  assert.equal(env.A, "file");
  assert.equal(env.B, "process");
});
```

- [ ] **Step 2: Write the failing test `mcp/test/tempo.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TempoClient } from "../src/tempo.ts";

const cfg = { baseUrl: "https://api.tempo.io/4/", token: "tok", accountId: "acc:1" };
const first = "https://api.tempo.io/4/worklogs/user/acc%3A1?from=2026-07-06&to=2026-07-12&limit=1000";
const second = `${first}&offset=1000`;

function fake(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
  return { fn, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("follows metadata.next, sends the bearer token and maps worklogs", async () => {
  const { fn, calls } = fake((url) =>
    url === first
      ? json({ metadata: { next: second }, results: [{ tempoWorklogId: 1, issue: { id: 10 }, timeSpentSeconds: 3600, startDate: "2026-07-06", description: "a" }] })
      : json({ metadata: {}, results: [{ tempoWorklogId: 2, issue: { id: 11 }, timeSpentSeconds: 60, startDate: "2026-07-07" }] }),
  );
  const logs = await new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12");
  assert.deepEqual(calls.map((c) => c.url), [first, second]);
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.deepEqual(logs, [
    { id: 1, issueId: 10, date: "2026-07-06", seconds: 3600, description: "a" },
    { id: 2, issueId: 11, date: "2026-07-07", seconds: 60, description: "" },
  ]);
});

test("401 explains the token problem", async () => {
  const { fn } = fake(() => json({}, 401));
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), { name: "TempoError", message: /token invalid/ });
});

test("network failure says Tempo is unreachable", async () => {
  const { fn } = fake(() => { throw new TypeError("fetch failed"); });
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), { name: "TempoError", message: /not reachable/ });
});

test("other HTTP errors include status and body", async () => {
  const { fn } = fake(() => new Response("boom", { status: 500 }));
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), { name: "TempoError", message: /500: boom/ });
});
```

- [ ] **Step 3: Run both — expect failure**

Run: `cd mcp && node --test test/config.test.ts test/tempo.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `mcp/src/config.ts`**

```ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

export const DEFAULT_ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));

export function readEnvFile(path: string): Record<string, string> {
  try {
    // spread → plain object (deepStrictEqual compares prototypes)
    return { ...(parseEnv(readFileSync(path, "utf8")) as Record<string, string>) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}

/** mcp/.env merged under the process environment (process wins). */
export function loadEnv(file = process.env.INVOICEFLOW_MCP_ENV_FILE ?? DEFAULT_ENV_FILE, processEnv: Env = process.env): Env {
  return { ...readEnvFile(file), ...processEnv };
}

function required(env: Env, names: string[]): string[] {
  const missing = names.filter((n) => !env[n]?.trim());
  if (missing.length > 0) {
    throw new ConfigError(`Missing configuration: ${missing.join(", ")} — set them in mcp/.env (see mcp/.env.example).`);
  }
  return names.map((n) => env[n]!.trim());
}

export interface InvoiceFlowConfig { apiUrl: string; email: string; password: string }
export function invoiceFlowConfig(env: Env): InvoiceFlowConfig {
  const [apiUrl, email, password] = required(env, ["INVOICEFLOW_API_URL", "INVOICEFLOW_EMAIL", "INVOICEFLOW_PASSWORD"]);
  return { apiUrl, email, password };
}

export interface TempoConfig { baseUrl: string; token: string; accountId: string }
export function tempoConfig(env: Env): TempoConfig {
  const [token, accountId] = required(env, ["TEMPO_API_TOKEN", "TEMPO_ACCOUNT_ID"]);
  return { baseUrl: env.TEMPO_API_BASE?.trim() || "https://api.tempo.io/4", token, accountId };
}

export interface Settings { weeklyCapHours?: number; pdfDir: string }
export function settings(env: Env): Settings {
  const rawCap = env.WEEKLY_HOURS_CAP?.trim();
  const weeklyCapHours = rawCap ? Number(rawCap) : undefined;
  if (weeklyCapHours !== undefined && !(weeklyCapHours > 0)) {
    throw new ConfigError(`WEEKLY_HOURS_CAP must be a positive number (got "${rawCap}").`);
  }
  return { weeklyCapHours, pdfDir: env.INVOICE_PDF_DIR?.trim() || join(homedir(), "Downloads") };
}
```

- [ ] **Step 5: Implement `mcp/src/tempo.ts`**

```ts
import type { TempoConfig } from "./config.ts";
import type { Worklog } from "./worklogs.ts";

interface TempoWorklog {
  tempoWorklogId: number;
  issue: { id: number };
  timeSpentSeconds: number;
  startDate: string;
  description?: string | null;
}
interface TempoPage { metadata: { next?: string }; results: TempoWorklog[] }

export class TempoError extends Error {
  override name = "TempoError";
}

const MAX_PAGES = 100;

/** Tempo API v4 — the only source that knows who logged a worklog. */
export class TempoClient {
  #cfg: TempoConfig;
  #fetch: typeof fetch;

  constructor(cfg: TempoConfig, fetchFn: typeof fetch = fetch) {
    this.#cfg = cfg;
    this.#fetch = fetchFn;
  }

  async getWorklogs(from: string, to: string): Promise<Worklog[]> {
    const base = this.#cfg.baseUrl.replace(/\/+$/, "");
    let url: string | undefined = `${base}/worklogs/user/${encodeURIComponent(this.#cfg.accountId)}?from=${from}&to=${to}&limit=1000`;
    const out: Worklog[] = [];
    for (let page = 0; url && page < MAX_PAGES; page++) {
      let res: Response;
      try {
        res = await this.#fetch(url, { headers: { Authorization: `Bearer ${this.#cfg.token}` } });
      } catch {
        throw new TempoError(`Tempo API not reachable at ${base}.`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new TempoError("Tempo token invalid, expired or lacks worklog read scope (Tempo → Settings → API Integration).");
      }
      if (!res.ok) throw new TempoError(`Tempo API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as TempoPage;
      for (const w of body.results) {
        out.push({ id: w.tempoWorklogId, issueId: w.issue.id, date: w.startDate, seconds: w.timeSpentSeconds, description: w.description ?? "" });
      }
      url = body.metadata.next;
    }
    return out;
  }
}
```

- [ ] **Step 6: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: all pass, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add mcp/src/config.ts mcp/src/tempo.ts mcp/test/config.test.ts mcp/test/tempo.test.ts
git commit -F - <<'EOF'
feat(mcp): env-file config and paginated Tempo worklog client

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: `invoiceflow.ts` — invoice-api client

**Files:**
- Create: `mcp/src/invoiceflow.ts`, `mcp/test/invoiceflow.test.ts`

**Interfaces:**
- Consumes: `InvoiceFlowConfig` (Task 4); generated `components` from `src/lib/api/schema.d.ts`
- Produces:
  - `type Invoice = components["schemas"]["InvoiceResponse"]`
  - `type Profile = components["schemas"]["UserDto"]`
  - `type InvoiceRequest = components["schemas"]["CreateInvoiceRequest"]`
  - `class ApiError extends Error { readonly status: number }` (name `"ApiError"`)
  - `class InvoiceFlowClient { constructor(cfg: InvoiceFlowConfig, fetchFn?: typeof fetch); getProfile(): Promise<Profile>; listInvoices(q?: { status?: string; search?: string }): Promise<Invoice[]>; getInvoice(id: string): Promise<Invoice>; createInvoice(body: InvoiceRequest): Promise<Invoice>; updateInvoice(id: string, body: InvoiceRequest): Promise<Invoice>; deleteInvoice(id: string): Promise<void>; getPdf(id: string): Promise<Uint8Array> }`

`deleteInvoice` exists for test cleanup only and is never exposed as a tool.

- [ ] **Step 1: Write the failing test `mcp/test/invoiceflow.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { InvoiceFlowClient } from "../src/invoiceflow.ts";

const cfg = { apiUrl: "http://api.test/", email: "me@example.com", password: "pw" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fake(responses: Array<Response | Error>) {
  const requests: { method: string; url: string; auth?: string; body?: unknown }[] = [];
  const fn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    requests.push({ method: init.method ?? "GET", url: String(url), auth: headers.Authorization, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${String(url)}`);
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fn, requests };
}

test("logs in once and reuses the token", async () => {
  const { fn, requests } = fake([json({ token: "T1" }), json({ name: "A" }), json({ name: "A" })]);
  const client = new InvoiceFlowClient(cfg, fn);
  await client.getProfile();
  await client.getProfile();
  assert.deepEqual(requests.map((r) => `${r.method} ${r.url} ${r.auth ?? "-"}`), [
    "POST http://api.test/api/auth/login -",
    "GET http://api.test/api/auth/me Bearer T1",
    "GET http://api.test/api/auth/me Bearer T1",
  ]);
  assert.deepEqual(requests[0].body, { email: "me@example.com", password: "pw" });
});

test("re-logs in once when the token expired", async () => {
  const { fn, requests } = fake([json({ token: "T1" }), json({}, 401), json({ token: "T2" }), json({ name: "A" })]);
  const profile = await new InvoiceFlowClient(cfg, fn).getProfile();
  assert.equal(profile.name, "A");
  assert.equal(requests[3].auth, "Bearer T2");
});

test("surfaces the API error text verbatim", async () => {
  const { fn } = fake([json({ token: "T" }), json({ error: "Only drafts can be edited." }, 409)]);
  await assert.rejects(new InvoiceFlowClient(cfg, fn).updateInvoice("x", { senderName: "s", senderAddress: "a", recipientName: "r", lineItems: [] }), {
    name: "ApiError",
    message: "InvoiceFlow API error 409: Only drafts can be edited.",
  });
});

test("wrong credentials point at mcp/.env", async () => {
  const { fn } = fake([json({ error: "Invalid credentials" }, 401)]);
  await assert.rejects(new InvoiceFlowClient(cfg, fn).getProfile(), { name: "ApiError", message: /INVOICEFLOW_EMAIL/ });
});

test("unreachable backend suggests starting docker compose", async () => {
  const { fn } = fake([new TypeError("fetch failed")]);
  await assert.rejects(new InvoiceFlowClient(cfg, fn).getProfile(), { name: "ApiError", message: /docker compose up/ });
});

test("listInvoices pages through every result (review focus)", async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}` }));
  const page2 = [{ id: "b0" }, { id: "b1" }, { id: "b2" }];
  const { fn, requests } = fake([json({ token: "T" }), json(page1), json(page2)]);
  const all = await new InvoiceFlowClient(cfg, fn).listInvoices({ status: "Draft" });
  assert.equal(all.length, 103);
  assert.equal(requests[1].url, "http://api.test/api/invoices?page=1&pageSize=100&status=Draft");
  assert.equal(requests[2].url, "http://api.test/api/invoices?page=2&pageSize=100&status=Draft");
});

test("getPdf returns the raw bytes", async () => {
  const { fn } = fake([json({ token: "T" }), new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 })]);
  const pdf = await new InvoiceFlowClient(cfg, fn).getPdf("x");
  assert.deepEqual([...pdf], [37, 80, 68, 70]);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd mcp && node --test test/invoiceflow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `mcp/src/invoiceflow.ts`**

```ts
import type { components } from "../../src/lib/api/schema.d.ts";
import type { InvoiceFlowConfig } from "./config.ts";

export type Invoice = components["schemas"]["InvoiceResponse"];
export type Profile = components["schemas"]["UserDto"];
export type InvoiceRequest = components["schemas"]["CreateInvoiceRequest"];
type AuthResponse = components["schemas"]["AuthResponseDto"];

export class ApiError extends Error {
  override name = "ApiError";
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PAGE_SIZE = 100; // server maximum

export class InvoiceFlowClient {
  #cfg: InvoiceFlowConfig;
  #fetch: typeof fetch;
  #token: string | null = null;

  constructor(cfg: InvoiceFlowConfig, fetchFn: typeof fetch = fetch) {
    this.#cfg = cfg;
    this.#fetch = fetchFn;
  }

  getProfile(): Promise<Profile> {
    return this.#json("GET", "/api/auth/me");
  }

  /** GET /api/invoices is paginated (no total count) — read pages until a short one. */
  async listInvoices(q: { status?: string; search?: string } = {}): Promise<Invoice[]> {
    const all: Invoice[] = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q.status) params.set("status", q.status);
      if (q.search) params.set("search", q.search);
      const batch = await this.#json<Invoice[]>("GET", `/api/invoices?${params}`);
      all.push(...batch);
      if (batch.length < PAGE_SIZE) return all;
    }
  }

  getInvoice(id: string): Promise<Invoice> {
    return this.#json("GET", `/api/invoices/${encodeURIComponent(id)}`);
  }

  createInvoice(body: InvoiceRequest): Promise<Invoice> {
    return this.#json("POST", "/api/invoices", body);
  }

  updateInvoice(id: string, body: InvoiceRequest): Promise<Invoice> {
    return this.#json("PUT", `/api/invoices/${encodeURIComponent(id)}`, body);
  }

  /** Test cleanup only — deliberately not exposed as an MCP tool. */
  async deleteInvoice(id: string): Promise<void> {
    await this.#request("DELETE", `/api/invoices/${encodeURIComponent(id)}`);
  }

  async getPdf(id: string): Promise<Uint8Array> {
    const res = await this.#request("GET", `/api/invoices/${encodeURIComponent(id)}/pdf`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async #json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.#request(method, path, body);
    return (await res.json()) as T;
  }

  async #request(method: string, path: string, body?: unknown, retried = false): Promise<Response> {
    if (!this.#token) await this.#login();
    const res = await this.#send(method, path, body, this.#token);
    if (res.status === 401 && !retried) {
      this.#token = null;
      return this.#request(method, path, body, true);
    }
    if (!res.ok) throw await toApiError(res);
    return res;
  }

  async #login(): Promise<void> {
    const res = await this.#send("POST", "/api/auth/login", { email: this.#cfg.email, password: this.#cfg.password }, null);
    if (res.status === 401) throw new ApiError(401, "InvoiceFlow login failed — check INVOICEFLOW_EMAIL / INVOICEFLOW_PASSWORD in mcp/.env.");
    if (res.status === 403) throw new ApiError(403, "InvoiceFlow account e-mail is not verified yet — verify it, then retry.");
    if (!res.ok) throw await toApiError(res);
    const auth = (await res.json()) as AuthResponse;
    if (!auth.token) throw new ApiError(500, "InvoiceFlow login returned no token.");
    this.#token = auth.token;
  }

  async #send(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const url = `${this.#cfg.apiUrl.replace(/\/+$/, "")}${path}`;
    try {
      return await this.#fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, `InvoiceFlow API not reachable at ${this.#cfg.apiUrl} — is \`docker compose up\` running in invoice-api?`);
    }
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `InvoiceFlow API error ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = `${message}: ${body.error}`;
  } catch {
    // non-JSON error body — keep the status-only message
  }
  return new ApiError(res.status, message);
}
```

- [ ] **Step 4: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: all pass, tsc silent. If tsc rejects the `schema.d.ts` specifier (TS2846 or "cannot import a declaration file"), first make sure it is `import type`; if it still fails, use `"../../src/lib/api/schema.js"` — TypeScript maps it to `schema.d.ts` and the type-only import is erased at runtime.

- [ ] **Step 5: Commit**

```bash
git add mcp/src/invoiceflow.ts mcp/test/invoiceflow.test.ts
git commit -F - <<'EOF'
feat(mcp): invoice-api client with re-login, pagination and PDF download

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: `profile.ts` and `draft.ts` — the create/update pipeline

**Files:**
- Create: `mcp/src/profile.ts`, `mcp/src/draft.ts`, `mcp/test/profile.test.ts`, `mcp/test/draft.test.ts`

**Interfaces:**
- Consumes: `Profile`, `Invoice`, `InvoiceRequest`, `InvoiceFlowClient` (Task 5); `TempoClient` (Task 4); `assertPeriod`, `summarize`, `weekRange`, `Worklog` (Task 2); `buildLineItems`, `ValidationError`, `PositionInput`, `ExcludeInput` (Task 3); `findOverlaps` (Task 3); `addDays` (Task 1)
- Produces:
  - `missingForFinalize(p: Profile): string[]`, `recommended(p: Profile): string[]`
  - `interface Recipient { name: string; street: string; postalCode: string; city: string; countryCode: string; email?: string; vatId?: string; buyerReference?: string }`
  - `interface DraftInput { from: string; to: string; recipient: Recipient; positions: PositionInput[]; exclude?: ExcludeInput[]; dueInDays?: number; notes?: string; allowOverlap?: boolean }`
  - `interface DraftDeps { invoiceflow: Pick<InvoiceFlowClient, "getProfile" | "listInvoices" | "createInvoice" | "updateInvoice">; tempo: Pick<TempoClient, "getWorklogs">; weeklyCapHours?: number; today: () => string }`
  - `interface DraftResult { invoiceId: string; status: string; positions: { description: string; hours: number; unitPrice: number; total: number }[]; subtotal: number; total: number; warnings: string[] }`
  - `saveDraft(deps: DraftDeps, input: DraftInput, existingId?: string): Promise<DraftResult>`

- [ ] **Step 1: Write the failing test `mcp/test/profile.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { missingForFinalize, recommended } from "../src/profile.ts";

const complete = { street: "Weg 1", postalCode: "12345", city: "Ort", country: "DE", phone: "0123", taxNumber: "111/222/33333", iban: "DE89370400440532013000" };

test("a complete profile is ready to finalize", () => {
  assert.deepEqual(missingForFinalize(complete), []);
  assert.deepEqual(recommended(complete), []);
});

test("lists missing fields; vatId can replace taxNumber", () => {
  assert.deepEqual(missingForFinalize({ ...complete, phone: " ", taxNumber: null }), ["phone", "taxNumber or vatId"]);
  assert.deepEqual(missingForFinalize({ ...complete, taxNumber: null, vatId: "DE123456789" }), []);
  assert.deepEqual(recommended({ ...complete, iban: null }), ["iban"]);
});
```

- [ ] **Step 2: Write the failing test `mcp/test/draft.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveDraft, type DraftDeps, type DraftInput } from "../src/draft.ts";
import type { Invoice, InvoiceRequest, Profile } from "../src/invoiceflow.ts";
import type { Worklog } from "../src/worklogs.ts";

const w = (id: number, issueId: number, date: string, seconds: number): Worklog => ({ id, issueId, date, seconds, description: "" });

const PROFILE: Profile = {
  name: "Max Muster", defaultSenderName: "Max Muster", defaultSenderAddress: "Weg 1\n12345 Ort", isSmallBusiness: true,
  street: "Weg 1", postalCode: "12345", city: "Ort", country: "DE", phone: "0123", taxNumber: "111/222/33333", iban: "DE89370400440532013000",
};
const LOGS = [w(1, 10, "2026-07-06", 13260), w(2, 11, "2026-07-07", 4500)];
const INPUT: DraftInput = {
  from: "2026-07-06",
  to: "2026-07-19",
  recipient: { name: "Acme GmbH", street: "Hauptstraße 1", postalCode: "10115", city: "Berlin", countryCode: "DE", email: "rechnung@acme.example" },
  positions: [
    { issueIds: [10], description: "ABC-1 Feature", unitPrice: 100 },
    { issueIds: [11], description: "ABC-2 Abstimmungstermine", unitPrice: 80 },
  ],
};

function fakes(opts: { worklogs?: Worklog[]; invoices?: Invoice[]; profile?: Profile } = {}) {
  const calls = { tempo: [] as [string, string][], created: [] as InvoiceRequest[], updated: [] as [string, InvoiceRequest][] };
  const toInvoice = (body: InvoiceRequest, id: string): Invoice => {
    const lineItems = body.lineItems.map((li) => ({ ...li, total: Math.round((li.quantity ?? 0) * (li.unitPrice ?? 0) * 100) / 100 }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
    return { id, status: "Draft", lineItems, subtotal, total: subtotal };
  };
  const deps: DraftDeps = {
    tempo: { getWorklogs: async (from, to) => { calls.tempo.push([from, to]); return opts.worklogs ?? LOGS; } },
    invoiceflow: {
      getProfile: async () => opts.profile ?? PROFILE,
      listInvoices: async () => opts.invoices ?? [],
      createInvoice: async (body) => { calls.created.push(body); return toInvoice(body, "new-id"); },
      updateInvoice: async (id, body) => { calls.updated.push([id, body]); return toInvoice(body, id); },
    },
    weeklyCapHours: 10,
    today: () => "2026-09-27",
  };
  return { deps, calls };
}

test("creates a § 19 hourly draft from Tempo hours", async () => {
  const { deps, calls } = fakes();
  const result = await saveDraft(deps, INPUT);
  const body = calls.created[0];
  assert.equal(body.senderName, "Max Muster");
  assert.equal(body.senderAddress, "Weg 1\n12345 Ort");
  assert.equal(body.recipientName, "Acme GmbH");
  assert.equal(body.recipientEmail, "rechnung@acme.example");
  assert.equal(body.taxRate, 0);
  assert.equal(body.issueDate, "2026-09-27");
  assert.equal(body.dueDate, "2026-10-11");
  assert.equal(body.servicePeriodStart, "2026-07-06");
  assert.equal(body.servicePeriodEnd, "2026-07-19");
  assert.deepEqual(body.lineItems, [
    { description: "ABC-1 Feature (3 h 41 min)", quantity: 3.68, unit: "h", unitPrice: 100, displayMode: "AsEntered" },
    { description: "ABC-2 Abstimmungstermine (1 h 15 min)", quantity: 1.25, unit: "h", unitPrice: 80, displayMode: "AsEntered" },
  ]);
  assert.equal(result.invoiceId, "new-id");
  assert.deepEqual(result.positions.map((p) => p.total), [368, 100]);
  assert.equal(result.total, 468);
  assert.deepEqual(result.warnings, []);
});

test("charges 19 % VAT when the profile is not a small business", async () => {
  const { deps, calls } = fakes({ profile: { ...PROFILE, isSmallBusiness: false } });
  await saveDraft(deps, INPUT);
  assert.equal(calls.created[0].taxRate, 0.19);
});

test("fetches whole ISO weeks but bills only the period", async () => {
  const { deps, calls } = fakes({ worklogs: [w(1, 99, "2026-07-06", 3600), w(2, 10, "2026-07-08", 3600)] });
  await saveDraft(deps, { ...INPUT, from: "2026-07-08", to: "2026-07-15", positions: [{ issueIds: [10], description: "ABC-1", unitPrice: 100 }] });
  assert.deepEqual(calls.tempo, [["2026-07-06", "2026-07-19"]]);
  assert.equal(calls.created[0].lineItems.length, 1);
  assert.equal(calls.created[0].lineItems[0].quantity, 1);
});

test("rejects from after to before calling anything", async () => {
  const { deps, calls } = fakes();
  await assert.rejects(saveDraft(deps, { ...INPUT, from: "2026-07-20" }), { name: "PeriodError" });
  assert.equal(calls.tempo.length, 0);
});

test("blocks an overlapping invoice unless allowOverlap", async () => {
  const existing: Invoice = { id: "old", number: "2026-002", status: "Finalized", type: "Invoice", recipientName: "Acme GmbH", servicePeriodStart: "2026-07-01", servicePeriodEnd: "2026-07-10" };
  const { deps } = fakes({ invoices: [existing] });
  await assert.rejects(saveDraft(deps, INPUT), { name: "ValidationError", message: /2026-002/ });
  await assert.doesNotReject(saveDraft(deps, { ...INPUT, allowOverlap: true }));
});

test("update ignores the invoice being updated in the overlap check", async () => {
  const self: Invoice = { id: "draft-1", number: null, status: "Draft", type: "Invoice", recipientName: "Acme GmbH", servicePeriodStart: "2026-07-06", servicePeriodEnd: "2026-07-19" };
  const { deps, calls } = fakes({ invoices: [self] });
  const result = await saveDraft(deps, INPUT, "draft-1");
  assert.equal(calls.updated[0][0], "draft-1");
  assert.equal(result.invoiceId, "draft-1");
});

test("warns about cap, profile gaps and missing recipient e-mail", async () => {
  const { deps } = fakes({
    worklogs: [w(1, 10, "2026-07-06", 11 * 3600)],
    profile: { ...PROFILE, taxNumber: null, iban: null },
  });
  const { email: _omit, ...recipient } = INPUT.recipient;
  const result = await saveDraft(deps, { ...INPUT, recipient, positions: [{ issueIds: [10], description: "ABC-1", unitPrice: 100 }] });
  assert.deepEqual(result.warnings, [
    "Week of 2026-07-06: 11 h logged — above the 10 h weekly cap.",
    "Profile field missing for finalization: taxNumber or vatId",
    "Profile field recommended: iban",
    "Recipient e-mail missing — required to finalize (E-Rechnung BT-49).",
  ]);
});

test("refuses to draft without a sender address in the profile", async () => {
  const { deps } = fakes({ profile: { ...PROFILE, defaultSenderAddress: null } });
  await assert.rejects(saveDraft(deps, INPUT), { name: "ValidationError", message: /sender name\/address/ });
});
```

- [ ] **Step 3: Run both — expect failure**

Run: `cd mcp && node --test test/profile.test.ts test/draft.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `mcp/src/profile.ts`**

```ts
import type { Profile } from "./invoiceflow.ts";

const blank = (s: string | null | undefined) => !s?.trim();

/** Mirrors invoice-api's finalize gate (address, country, phone, taxNumber or vatId). */
export function missingForFinalize(p: Profile): string[] {
  const missing = (["street", "postalCode", "city", "country", "phone"] as const).filter((f) => blank(p[f]));
  const fields: string[] = [...missing];
  if (blank(p.taxNumber) && blank(p.vatId)) fields.push("taxNumber or vatId");
  return fields;
}

export function recommended(p: Profile): string[] {
  return blank(p.iban) ? ["iban"] : [];
}
```

- [ ] **Step 5: Implement `mcp/src/draft.ts`**

```ts
import { addDays } from "./format.ts";
import type { InvoiceFlowClient, InvoiceRequest } from "./invoiceflow.ts";
import { findOverlaps } from "./overlap.ts";
import { buildLineItems, ValidationError, type ExcludeInput, type PositionInput } from "./positions.ts";
import { missingForFinalize, recommended } from "./profile.ts";
import type { TempoClient } from "./tempo.ts";
import { assertPeriod, summarize, weekRange } from "./worklogs.ts";

export interface Recipient {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  email?: string;
  vatId?: string;
  buyerReference?: string;
}

export interface DraftInput {
  from: string;
  to: string;
  recipient: Recipient;
  positions: PositionInput[];
  exclude?: ExcludeInput[];
  dueInDays?: number;
  notes?: string;
  allowOverlap?: boolean;
}

export interface DraftDeps {
  invoiceflow: Pick<InvoiceFlowClient, "getProfile" | "listInvoices" | "createInvoice" | "updateInvoice">;
  tempo: Pick<TempoClient, "getWorklogs">;
  weeklyCapHours?: number;
  today: () => string;
}

export interface DraftResult {
  invoiceId: string;
  status: string;
  positions: { description: string; hours: number; unitPrice: number; total: number }[];
  subtotal: number;
  total: number;
  warnings: string[];
}

/** Create (or, with existingId, replace) a draft whose hours come straight from Tempo. */
export async function saveDraft(deps: DraftDeps, input: DraftInput, existingId?: string): Promise<DraftResult> {
  assertPeriod(input.from, input.to);

  // Re-fetch instead of trusting numbers from the model; whole weeks for the cap check.
  const range = weekRange(input.from, input.to);
  const summary = summarize(await deps.tempo.getWorklogs(range.from, range.to), input.from, input.to, deps.weeklyCapHours);
  const items = buildLineItems(summary.worklogs, input.positions, input.exclude);

  if (!input.allowOverlap) {
    const clashes = findOverlaps(await deps.invoiceflow.listInvoices(), input.recipient.name, input.from, input.to, existingId);
    if (clashes.length > 0) {
      const list = clashes
        .map((c) => `${c.number ?? `draft ${c.id}`} (${c.servicePeriodStart ?? c.serviceDate} – ${c.servicePeriodEnd ?? c.serviceDate})`)
        .join(", ");
      throw new ValidationError(`Period overlaps existing invoice(s) to ${input.recipient.name}: ${list}. Pass allowOverlap: true only if this is intentional.`);
    }
  }

  const profile = await deps.invoiceflow.getProfile();
  const senderName = profile.defaultSenderName?.trim() || profile.name?.trim() || "";
  const senderAddress = profile.defaultSenderAddress?.trim() || "";
  if (!senderName || !senderAddress) {
    throw new ValidationError("Profile has no default sender name/address — fill them in InvoiceFlow → Settings first.");
  }

  const today = deps.today();
  const r = input.recipient;
  const body: InvoiceRequest = {
    senderName,
    senderAddress,
    recipientName: r.name,
    recipientStreet: r.street,
    recipientPostalCode: r.postalCode,
    recipientCity: r.city,
    recipientCountryCode: r.countryCode,
    recipientEmail: r.email ?? null,
    recipientVatId: r.vatId ?? null,
    buyerReference: r.buyerReference ?? null,
    issueDate: today,
    dueDate: addDays(today, input.dueInDays ?? 14),
    servicePeriodStart: input.from,
    servicePeriodEnd: input.to,
    taxRate: profile.isSmallBusiness ? 0 : 0.19,
    currency: "EUR",
    notes: input.notes ?? null,
    lineItems: items.map(({ description, quantity, unit, unitPrice, displayMode }) => ({ description, quantity, unit, unitPrice, displayMode })),
  };

  const invoice = existingId ? await deps.invoiceflow.updateInvoice(existingId, body) : await deps.invoiceflow.createInvoice(body);

  const warnings = [
    ...summary.byWeek
      .filter((wk) => wk.overCap)
      .map((wk) => `Week of ${wk.weekStart}: ${wk.hours} h logged — above the ${deps.weeklyCapHours} h weekly cap${wk.extendsOutsidePeriod ? " (week extends outside this period)" : ""}.`),
    ...missingForFinalize(profile).map((f) => `Profile field missing for finalization: ${f}`),
    ...recommended(profile).map((f) => `Profile field recommended: ${f}`),
    ...(r.email ? [] : ["Recipient e-mail missing — required to finalize (E-Rechnung BT-49)."]),
  ];

  return {
    invoiceId: invoice.id ?? existingId ?? "",
    status: invoice.status ?? "Draft",
    positions: (invoice.lineItems ?? []).map((li) => ({
      description: li.description ?? "",
      hours: li.quantity ?? 0,
      unitPrice: li.unitPrice ?? 0,
      total: li.total ?? 0,
    })),
    subtotal: invoice.subtotal ?? 0,
    total: invoice.total ?? 0,
    warnings,
  };
}
```

- [ ] **Step 6: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: all pass, tsc silent.

- [ ] **Step 7: Commit**

```bash
git add mcp/src/profile.ts mcp/src/draft.ts mcp/test/profile.test.ts mcp/test/draft.test.ts
git commit -F - <<'EOF'
feat(mcp): draft pipeline — Tempo re-fetch, overlap guard, warnings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: `index.ts` — MCP server and tools

**Files:**
- Create: `mcp/src/index.ts`, `mcp/test/server.test.ts`

**Interfaces:**
- Consumes: everything above: `loadEnv`, `invoiceFlowConfig`, `tempoConfig`, `settings` (Task 4); `InvoiceFlowClient` (Task 5); `TempoClient` (Task 4); `saveDraft`, `DraftInput` (Task 6); `missingForFinalize`, `recommended` (Task 6); `assertPeriod`, `summarize`, `weekRange` (Task 2); `DATE_RE`, `pdfFileName` (Task 1)
- Produces: stdio MCP server named `invoiceflow` with tools `get_profile`, `list_invoices`, `get_invoice`, `get_worklogs`, `create_draft_invoice`, `update_draft_invoice`, `save_invoice_pdf`

- [ ] **Step 1: Write the failing test `mcp/test/server.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = fileURLToPath(new URL("..", import.meta.url));

test("starts without any config, lists all tools and reports missing config (review focus)", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["src/index.ts"],
    cwd: root,
    env: { ...getDefaultEnvironment(), INVOICEFLOW_MCP_ENV_FILE: join(tmpdir(), "invoiceflow-mcp-does-not-exist.env") },
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      "create_draft_invoice", "get_invoice", "get_profile", "get_worklogs", "list_invoices", "save_invoice_pdf", "update_draft_invoice",
    ]);
    const res = await client.callTool({ name: "get_profile", arguments: {} });
    assert.equal(res.isError, true);
    assert.match((res.content as { type: string; text: string }[])[0].text, /INVOICEFLOW_API_URL, INVOICEFLOW_EMAIL, INVOICEFLOW_PASSWORD/);
  } finally {
    await client.close();
  }
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd mcp && node --test test/server.test.ts`
Expected: FAIL — the child process exits (`src/index.ts` missing), connect/listTools rejects.

- [ ] **Step 3: Implement `mcp/src/index.ts`**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { invoiceFlowConfig, loadEnv, settings, tempoConfig } from "./config.ts";
import { saveDraft, type DraftInput } from "./draft.ts";
import { DATE_RE, pdfFileName } from "./format.ts";
import { InvoiceFlowClient } from "./invoiceflow.ts";
import { missingForFinalize, recommended } from "./profile.ts";
import { TempoClient } from "./tempo.ts";
import { assertPeriod, summarize, weekRange } from "./worklogs.ts";

const env = loadEnv();
let invoiceflowClient: InvoiceFlowClient | undefined;
let tempoClient: TempoClient | undefined;
const invoiceflow = () => (invoiceflowClient ??= new InvoiceFlowClient(invoiceFlowConfig(env)));
const tempo = () => (tempoClient ??= new TempoClient(tempoConfig(env)));
const today = () => new Date().toLocaleDateString("sv-SE"); // local YYYY-MM-DD

async function run(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn(), null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] };
  }
}

const date = z.string().regex(DATE_RE, "Use YYYY-MM-DD");
const issueIds = z.array(z.number().int().positive()).min(1);
const draftShape = {
  from: date.describe("First day of the service period (Leistungszeitraum), inclusive"),
  to: date.describe("Last day of the service period, inclusive"),
  recipient: z.object({
    name: z.string().min(1),
    street: z.string().min(1),
    postalCode: z.string().min(1),
    city: z.string().min(1),
    countryCode: z.string().length(2).default("DE"),
    email: z.email().optional().describe("Required later for finalization (E-Rechnung)"),
    vatId: z.string().optional(),
    buyerReference: z.string().optional(),
  }).describe("Copy from the previous invoice to this client (get_invoice)"),
  positions: z.array(z.object({
    issueIds: issueIds.describe("Tempo issue ids (from get_worklogs) billed in this position"),
    description: z.string().min(1).describe("German position text, starting with the Jira key; the exact duration is appended automatically"),
    unitPrice: z.number().positive().describe("Hourly rate in EUR"),
  })).min(1),
  exclude: z.array(z.object({ issueIds, reason: z.string().min(1) })).optional()
    .describe("Issues with logged time in the period that are deliberately not billed here"),
  dueInDays: z.number().int().min(0).max(90).optional().describe("Payment term, default 14"),
  notes: z.string().optional(),
  allowOverlap: z.boolean().optional().describe("Only true if double-billing a period is intentional"),
};

const server = new McpServer({ name: "invoiceflow", version: "0.1.0" });

server.registerTool(
  "get_profile",
  {
    title: "Get sender profile",
    description: "The InvoiceFlow sender profile, plus fields still missing for finalization (missingForFinalize) and recommended fields (recommended).",
  },
  () => run(async () => {
    const profile = await invoiceflow().getProfile();
    return { profile, missingForFinalize: missingForFinalize(profile), recommended: recommended(profile) };
  }),
);

server.registerTool(
  "list_invoices",
  {
    title: "List invoices",
    description: "All invoices (every page), compact. Use it to check whether a period is already billed and to find the previous invoice to a client.",
    inputSchema: {
      status: z.enum(["Draft", "Finalized", "Paid", "Cancelled", "Overdue"]).optional(),
      search: z.string().optional(),
    },
  },
  ({ status, search }) => run(async () =>
    (await invoiceflow().listInvoices({ status, search })).map((i) => ({
      id: i.id, number: i.number, status: i.status, type: i.type, recipientName: i.recipientName,
      servicePeriodStart: i.servicePeriodStart, servicePeriodEnd: i.servicePeriodEnd, serviceDate: i.serviceDate,
      total: i.total, issueDate: i.issueDate,
    }))),
);

server.registerTool(
  "get_invoice",
  { title: "Get invoice", description: "One invoice with all fields and line items.", inputSchema: { id: z.string().min(1) } },
  ({ id }) => run(() => invoiceflow().getInvoice(id)),
);

server.registerTool(
  "get_worklogs",
  {
    title: "Get Tempo worklogs",
    description: "The configured account's Tempo worklogs for a period, summed per issue (Tempo issue ids — resolve keys via Jira), per day and per ISO week (weekly cap check covers whole weeks).",
    inputSchema: { from: date, to: date },
  },
  ({ from, to }) => run(async () => {
    assertPeriod(from, to);
    const range = weekRange(from, to);
    return summarize(await tempo().getWorklogs(range.from, range.to), from, to, settings(env).weeklyCapHours);
  }),
);

server.registerTool(
  "create_draft_invoice",
  {
    title: "Create draft invoice from Tempo",
    description: "Creates a DRAFT invoice. Hours are re-fetched from Tempo and computed by the server; every issue with logged time in the period must be in exactly one position or in exclude. Never finalizes.",
    inputSchema: draftShape,
  },
  (input) => run(() => saveDraft({ invoiceflow: invoiceflow(), tempo: tempo(), weeklyCapHours: settings(env).weeklyCapHours, today }, input as DraftInput)),
);

server.registerTool(
  "update_draft_invoice",
  {
    title: "Replace a draft invoice from Tempo",
    description: "Recomputes and replaces an existing DRAFT (same input as create_draft_invoice). Finalized invoices are rejected by the API.",
    inputSchema: { id: z.string().min(1), ...draftShape },
  },
  ({ id, ...input }) => run(() => saveDraft({ invoiceflow: invoiceflow(), tempo: tempo(), weeklyCapHours: settings(env).weeklyCapHours, today }, input as DraftInput, id)),
);

server.registerTool(
  "save_invoice_pdf",
  {
    title: "Save invoice PDF",
    description: "Downloads the invoice PDF (drafts carry an ENTWURF watermark) and returns the local file path.",
    inputSchema: { id: z.string().min(1), directory: z.string().optional() },
  },
  ({ id, directory }) => run(async () => {
    const inv = await invoiceflow().getInvoice(id);
    const pdf = await invoiceflow().getPdf(id);
    const dir = directory ?? settings(env).pdfDir;
    await mkdir(dir, { recursive: true });
    const from = inv.servicePeriodStart ?? inv.serviceDate ?? inv.issueDate ?? "";
    const to = inv.servicePeriodEnd ?? inv.serviceDate ?? inv.issueDate ?? "";
    const path = join(dir, pdfFileName(inv.number, inv.recipientName ?? "", from, to));
    await writeFile(path, pdf);
    return { path, bytes: pdf.length };
  }),
);

await server.connect(new StdioServerTransport());
```

If `registerTool` rejects zod 4 schemas at typecheck or runtime, pin `zod@^3.25` (`npm install zod@^3.25`), change `z.email()` to `z.string().email()`, and re-run — do not change anything else.

- [ ] **Step 4: Run tests and typecheck — expect pass**

Run: `cd mcp && npm test && npx tsc --noEmit`
Expected: all tests pass (including the server test), tsc silent.

- [ ] **Step 5: Commit**

```bash
git add mcp/src/index.ts mcp/test/server.test.ts
git commit -F - <<'EOF'
feat(mcp): expose seven invoice tools over stdio

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: CI, README, contract fix, opt-in integration test

**Files:**
- Create: `mcp/README.md`, `mcp/test/integration.test.ts`
- Modify: `.github/workflows/ci.yml`, `docs/api-contract.md` (the `GET /api/invoices` block)

**Interfaces:**
- Consumes: `InvoiceFlowClient` incl. `deleteInvoice` (Task 5)

- [ ] **Step 1: Write `mcp/test/integration.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { InvoiceFlowClient } from "../src/invoiceflow.ts";

const enabled = process.env.INVOICEFLOW_IT === "1";

test("draft round-trip against the local invoice-api (demo account)", { skip: enabled ? false : "set INVOICEFLOW_IT=1 with invoice-api running" }, async () => {
  const client = new InvoiceFlowClient({
    apiUrl: process.env.INVOICEFLOW_API_URL ?? "http://localhost:8080",
    email: process.env.INVOICEFLOW_IT_EMAIL ?? "demo@invoiceflow.app",
    password: process.env.INVOICEFLOW_IT_PASSWORD ?? "DemoPass123!",
  });
  const created = await client.createInvoice({
    senderName: "IT Sender",
    senderAddress: "Teststraße 1\n12345 Teststadt",
    recipientName: "IT Recipient",
    issueDate: "2026-09-27",
    dueDate: "2026-10-11",
    servicePeriodStart: "2026-07-06",
    servicePeriodEnd: "2026-07-12",
    taxRate: 0,
    lineItems: [{ description: "ABC-1 Test (3 h 41 min)", quantity: 3.68, unit: "h", unitPrice: 100, displayMode: "AsEntered" }],
  });
  try {
    const back = await client.getInvoice(created.id!);
    assert.equal(back.status, "Draft");
    const li = back.lineItems![0];
    assert.equal(li.quantity, 3.68);
    assert.equal(li.unit, "h");
    assert.equal(li.displayMode, "AsEntered");
    assert.equal(li.total, 368);
    const pdf = await client.getPdf(created.id!);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), "%PDF");
  } finally {
    await client.deleteInvoice(created.id!);
  }
});
```

- [ ] **Step 2: Run it both ways**

Run: `cd mcp && npm test`
Expected: integration test reported as `# SKIP`, all others pass.

With invoice-api running (`cd ../invoice-api && docker compose up -d`):
Run: `cd mcp && INVOICEFLOW_IT=1 npm test`
Expected: all pass, including the round-trip.

- [ ] **Step 3: Add the `mcp` CI job** — append under `jobs:` in `.github/workflows/ci.yml`, at the same indentation as `build:`

```yaml
  mcp:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mcp

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: "npm"
          cache-dependency-path: mcp/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test

      - name: Audit dependencies (high and above)
        run: npm audit --audit-level=high
```

- [ ] **Step 4: Fix the list endpoint in `docs/api-contract.md`**

Replace the line

```
GET    /api/invoices                    → Invoice[]   ← FLAT ARRAY, no pagination
```

with

```
GET    /api/invoices                    → Invoice[]   ← flat array, PAGINATED:
  ?page=<n> (default 1) & ?pageSize=<n> (default 25, max 100); no total count —
  read pages until one comes back shorter than pageSize
```

- [ ] **Step 5: Write `mcp/README.md`**

````markdown
# InvoiceFlow MCP

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant draft
hourly invoices in InvoiceFlow from **Tempo** (Jira) worklogs.

**Numbers in code, words by the model.** The model groups Jira tickets into
positions, writes the descriptions and proposes rates. The server fetches the
worklogs itself, computes every hour quantity, and refuses a draft that leaves
logged time unbilled, bills an issue twice, or overlaps an existing invoice to
the same client. It only creates and edits **drafts** — finalizing (irreversible
under GoBD) stays a human step in the web UI.

## Tools

| Tool | Purpose |
|---|---|
| `get_profile` | Sender profile + fields missing for finalization |
| `list_invoices` / `get_invoice` | Read invoices (all pages) |
| `get_worklogs` | Tempo worklogs per issue / day / ISO week, weekly-cap flag |
| `create_draft_invoice` / `update_draft_invoice` | Draft from Tempo hours (`n h × rate`, 0.01 h precision) |
| `save_invoice_pdf` | Download the (watermarked) PDF |

## Setup

Requires Node 24 — TypeScript runs directly via type stripping, no build step.

```bash
cd mcp
npm ci
cp .env.example .env   # fill in InvoiceFlow login + Tempo token/account id
claude mcp add --scope user invoiceflow -- node /absolute/path/to/invoiceflow/mcp/src/index.ts
```

## Development

```bash
npm test                      # unit + server tests
npm run typecheck
INVOICEFLOW_IT=1 npm test     # + round-trip against a local invoice-api (demo account)
```
````

- [ ] **Step 6: Verify the whole repo**

Run: `cd mcp && npm test && npx tsc --noEmit && cd .. && npx tsc --noEmit && npm run lint`
Expected: tests pass (integration skipped), both typechecks silent, lint clean.

- [ ] **Step 7: Commit**

```bash
git add mcp/README.md mcp/test/integration.test.ts .github/workflows/ci.yml docs/api-contract.md
git commit -F - <<'EOF'
chore(mcp): CI job, README, integration test; document list pagination

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: Register the server and write the private skill (main session only — not a subagent)

This task touches personal configuration outside the repo. The concrete values
(client, rates, meeting ticket, repo paths, author e-mails, weekly cap) come
from the private memory note `plan-invoiceflow-mcp-billing` and **must not be
written into this repo**.

**Files (outside the repo):**
- Create: `mcp/.env` (git-ignored — the user fills the password and Tempo token themselves)
- Create: `~/.claude/skills/rechnung-erstellen/SKILL.md`

- [ ] **Step 1: Create `mcp/.env` from the example** — copy `.env.example`; fill `INVOICEFLOW_API_URL`, `INVOICEFLOW_EMAIL`, `TEMPO_ACCOUNT_ID`, `WEEKLY_HOURS_CAP`; leave `INVOICEFLOW_PASSWORD` and `TEMPO_API_TOKEN` for the user to paste. Verify: `git status --short mcp/` does not list `.env`.

- [ ] **Step 2: Register the server at user scope**

```bash
claude mcp add --scope user invoiceflow -- node <absolute path to the repo>/mcp/src/index.ts
claude mcp list
```

Expected: `invoiceflow` listed; after the user fills `.env` and restarts Claude Code it shows as connected.

- [ ] **Step 3: Write `~/.claude/skills/rechnung-erstellen/SKILL.md`** with frontmatter `name: rechnung-erstellen` and a `description` that triggers on "Rechnung erstellen / abrechnen / Stunden abrechnen", and these sections (values from the memory note):
  1. **Regeln** — rate table (meetings, standard dev, complex dev + criteria: new features/architecture/integration = complex; bugfix/UI tweaks/Jira upkeep = standard), meeting ticket key, weekly cap, § 19, payment term 14 days, recipient to copy from.
  2. **Quellen** — `invoiceflow` MCP; Atlassian MCP (cloud id from the note) to resolve `id in (...)` → key + summary; Toggl MCP daily totals for the relevant projects; `git -C <repo> fetch --all` then `git log --all --since --until` for each author e-mail; Google Calendar connector for meetings.
  3. **Ablauf** — the seven steps of spec §5 verbatim in German, with the hard stops: reconciliation discrepancies → table + "bitte in Tempo nachbuchen", stop; over-cap weeks → warn, never cut; propose positions (one per ticket, rate + one-line reason) and wait for confirmation; then `create_draft_invoice` → `save_invoice_pdf` → summary table + warnings + PDF path; never finalize.

- [ ] **Step 4: Smoke test after the user filled `.env` and restarted** — call `get_profile` (expect profile + `missingForFinalize`), `list_invoices` (expect the existing invoices), and — once the Tempo token exists — `get_worklogs` for 2026-07-06..2026-07-12 (expect byIssue entries; compare the total with Tempo's own report for that week).

No commit — nothing in this task lives in the repo.
