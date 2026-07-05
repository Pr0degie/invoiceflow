# CLAUDE.md — InvoiceFlow

Loaded automatically on every session. Read top-to-bottom before touching code.
Sections §4–§7 are non-negotiable — deviations get the work rejected.

---

## §1 Project

**InvoiceFlow** — invoice management for DACH freelancers and small businesses.
Simultaneously a portfolio project for Tobias (freelance dev, DACH market).
Two audiences: end-users who manage invoices; Malt.de / GitHub visitors evaluating Tobias.

Stack: Next.js 16.2 App Router · Tailwind CSS · shadcn/ui · next-intl · TanStack Query · NextAuth v5 · Sonner

### Repos

| | Path |
|---|---|
| Frontend (this repo) | `.` |
| Backend API (.NET 8) | `../invoice-api/` — start with `docker compose up` |

### Commands

```bash
npm run dev          # dev server
npm run build        # production build — run before declaring done
npx tsc --noEmit     # type check
npm run api:types    # regenerate src/lib/api/schema.d.ts from openapi.json
npx shadcn@latest add <component>
```

### Architecture constraints

- Frontend **only talks to invoice-api** — no direct DB. No other backends.
- Server state via **TanStack Query** — no Redux/Zustand.
- **Never hand-write API types** — generate from OpenAPI spec (`npm run api:types`).
- **No hardcoded strings in JSX** — all UI text via `next-intl`. Default locale: `en`.
- Auth: **Credentials-only** (no OAuth). Token from invoice-api stored in NextAuth JWT cookie.
- **App routes live under `src/app/[locale]/(app)/app/*`.** The `(app)` is a Next.js route group (URL-invisible, used to share the AppShell layout). The second `app` is the real URL segment → `/app`, `/app/invoices`, `/app/settings`. Don't "deduplicate" — they serve different purposes.
- API calls: server-side code calls the backend directly via `API_BASE_URL` (runtime; falls back to `NEXT_PUBLIC_API_BASE_URL` for local dev — the `NEXT_PUBLIC_` value is inlined at build time and therefore frozen inside the Docker image). Browser-side code goes through `/api/backend/*` — the auth-proxy route handler (`src/app/api/backend/[...path]/route.ts`), which injects the Bearer header server-side. The split is handled inside `src/lib/api/client.ts` via `typeof window` — call sites just use `apiClient` and don't need to think about it.
- **Routing/auth gate lives in `src/proxy.ts`** (Next.js 16 convention; migrated from `middleware.ts` 2026-07-05). It must NOT be wrapped in next-auth's `auth()` helper: the wrapper corrupts next-intl's default-locale rewrite into an infinite 307 loop in the standalone production server (`next dev` masks it). Session checks there use `getToken()` directly — see the file's docblock before touching it.

---

## §2 Local dev setup

1. Start the backend: `cd ../invoice-api && docker compose up`
2. Start the frontend: `npm run dev`
3. Open `http://localhost:3000` — demo account: `demo@invoiceflow.app` / `DemoPass123!`

`NEXT_PUBLIC_API_BASE_URL=http://localhost:8080` is used server-side only (local-dev fallback for `API_BASE_URL`, the proxy/RSC backend destination). The browser never calls this URL directly. In the Docker image, set `API_BASE_URL` at runtime instead.

---

## §3 Design principles (landing page + product UI)

> Working on dashboard/invoice UI? Load `docs/branding.md` first — it has finance-specific rules.

- **Whitespace.** `py-24`/`py-32` sections on desktop. Let things breathe.
- **Typographic hierarchy.** One `h1` per page. h1 ≈ 6xl/7xl, h2 ≈ 4xl/5xl.
- **Restrained color.** Neutral base + ONE accent (teal-700). No rainbow gradients.
- **Dark mode.** CSS variables + `dark:` variants. Never hardcode `bg-white`/`text-black`.
- **Mobile-first.** 1440px reference; 375px must feel intentional.
- **Copy.** Short, specific, confident. No filler phrases.

---

## §4 Explicit don'ts (will get the work rejected)

- Purple-to-pink gradients, generic "AI-slop" aesthetics
- Emoji as feature icons — use `lucide-react`
- Literal `✓` checkmarks — use `<Check className="size-4" />`
- Stacked `<h3>` feature lists — use grid/bento layouts
- Placeholder testimonials or fake logo bars — skip the section instead
- Centered body copy paragraphs (hero headline is fine)
- Hardcoded colors (`bg-white`, `text-gray-900`) instead of Tailwind tokens
- Invented API fields — if it's not in `docs/api-contract.md`, **ask**

---

## §5 Visual feedback loop (MANDATORY for any UI change)

1. **Plan** — 3–5 bullets. Which `invoiceflow-pack-en/refs/` examples informed the approach?
2. **Build** — write the code.
3. **Screenshot** — Playwright MCP at **1440px** and **375px**. Dark mode if it differs.
4. **Self-critique** — spacing intentional? clear focal point? linear.app quality or tutorial quality?
5. **Iterate** — fix top 1–3 issues. Re-screenshot.
6. **Report** — show screenshot + what changed + why. Only then mark done.

Reference images in `invoiceflow-pack-en/refs/dashboard-finance/`, `invoiceflow-pack-en/refs/invoices/`, `invoiceflow-pack-en/refs/settings-finance/`.

---

## §6 Definition of done (every task)

- [ ] Screenshots at 1440px + 375px, reviewed
- [ ] Dark mode intentional
- [ ] No hardcoded colors — CSS variables / Tailwind tokens only
- [ ] No console errors, no hydration warnings
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` clean

---

## §7 When in doubt — ask

A two-line question beats 200 lines of code to throw away.

Stop and ask when:
- "Does this field exist in the API?" → check `docs/api-contract.md` first
- "Should this be MVP or placeholder?" → ask
- "Which locale / number format?" → check `docs/i18n.md`
- You're about to invent content (testimonials, fake data, missing features)

---

## §8 Reference docs (read only when working on that subsystem)

| Topic | File |
|---|---|
| API endpoints, schemas, what doesn't exist | `docs/api-contract.md` |
| Auth flow, token refresh, session shape | `docs/auth.md` |
| i18n routing, namespaces, translations | `docs/i18n.md` |
| TanStack Query keys, hooks, mutations, forms | `docs/state-management.md` |
| Colors, typography, status colors, finance UI rules (numbers, dates, money), logo | `docs/branding.md` |
