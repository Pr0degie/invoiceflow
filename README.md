<div align="center">

# InvoiceFlow

**Invoicing that gets out of your way.**

Full-stack invoice management for freelancers and small teams.
GoBD-compliant invoices, PDF export, status tracking — built as a portfolio project.

[![Status](https://img.shields.io/badge/status-in%20development-orange)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[🇩🇪 Deutsche Version](README.de.md)

</div>

---

## What this is

InvoiceFlow is a real product, built end-to-end, designed to demonstrate the kind
of work clients can expect — separate backend and frontend repositories, real auth,
real domain logic, real deployment, no shortcuts.

> **Live demo:** _coming soon_ — currently in active development

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Frontend (this repo)   │         │  invoice-api             │
│                         │         │  (separate repository)   │
│  • Next.js 15           │ ◄─────► │                          │
│  • NextAuth.js v5       │  HTTPS  │  • ASP.NET Core 8        │
│  • TanStack Query       │  + JWT  │  • PostgreSQL + EF Core  │
│  • Typed API client     │         │  • QuestPDF              │
│  • i18n (EN + DE)       │         │  • JWT auth              │
│                         │         │                          │
│  → Vercel               │         │  → Railway               │
└─────────────────────────┘         └──────────────────────────┘
```

Frontend and backend are independent services, communicating via a typed REST API.
TypeScript types are auto-generated from the backend's OpenAPI spec — no manual
schema synchronization.

**Backend repository:** [Pr0degie/invoice-api](https://github.com/Pr0degie/invoice-api)

## Status

| Area | Status |
|------|--------|
| Marketing landing page | ✅ Done |
| Sign-up / Sign-in | ✅ Done |
| API client (typed, with refresh flow) | 🚧 In progress |
| App shell (sidebar + topbar) | ⏳ Planned |
| Dashboard (KPIs, revenue chart) | ⏳ Planned |
| Invoice list (filters, PDF download) | ⏳ Planned |
| Invoice detail + status flow | ⏳ Planned |
| Invoice create/edit form | ⏳ Planned |
| Settings | ⏳ Planned |
| Production deployment | ⏳ Planned |

## Tech Stack

**Framework & language:** Next.js 15 (App Router), TypeScript 5
**Styling:** Tailwind CSS 4, shadcn/ui, lucide-react
**State:** TanStack Query for server state, React Hook Form + Zod for forms
**Auth:** NextAuth.js v5 (credentials provider against the invoice-api JWT endpoint)
**i18n:** next-intl, English default with German support
**Charts:** Recharts
**Toasts:** Sonner
**Tooling:** pnpm, ESLint, Playwright (visual feedback during development)

## Design philosophy

This is a **finance UI**, not a generic SaaS dashboard. That means:

- Numbers are right-aligned, `tabular-nums`, locale-aware (`€1,234.56` / `1.234,56 €`)
- Status colors used sparingly and consistently across all views
- One restrained accent (teal) — no rainbow gradients
- Typography over icons — finance tools read better when uncluttered
- Empty, loading, and error states are first-class, not afterthoughts

## Local development

```bash
# 1. Backend — in ../invoice-api/
docker compose up

# 2. Frontend — in this repo
npm install
cp .env.example .env
# Edit .env: set AUTH_SECRET=$(openssl rand -base64 32)
npm run dev
```

Frontend runs at `http://localhost:3000`. Full env reference: `.env.example`.

### Scripts

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Local dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint check |
| `pnpm typecheck` | TypeScript check |
| `pnpm api:types` | Regenerate TS types from `openapi.json` |

## What this project deliberately does NOT have

A truthful product, not a feature list cosplay. The following are explicitly
out of scope:

- No customer/CRM entity — recipients are free text per invoice
- No payment history tracking — only invoice status transitions
- No dunning / reminder workflow
- No recurring invoices
- No multi-currency conversion
- No team or workspace features
- No file attachments

If a real product needs these later, they get added as proper features — not
faked in the UI.

## Repository structure

```
invoiceflow-frontend/
├── src/
│   ├── app/              # Next.js App Router routes
│   │   ├── [locale]/     # i18n route group
│   │   └── api/          # NextAuth handlers
│   ├── components/       # UI components
│   ├── lib/
│   │   ├── api/          # Typed API client + hooks
│   │   ├── i18n/         # Formatters
│   │   └── schemas/      # Zod schemas
│   └── messages/         # i18n translations
├── _prompts/             # Build prompts driving development
├── refs/                 # UI reference screenshots (gitignored)
├── CLAUDE.md             # Design brief + API contract
└── openapi.json          # API spec (source for type generation)
```

## Built with intention

The codebase is built using a structured prompt-driven workflow with Claude Code,
where each major area (auth, dashboard, invoice flow) has a corresponding spec
in `_prompts/`. Specs are versioned alongside the code — useful both as a
working document during development and as a record of decisions for anyone
reading the repo afterward.

## License

MIT — see [LICENSE](LICENSE).

## Author

Built by [@Pr0degie](https://github.com/Pr0degie). Open to feedback, issues,
and constructive criticism.