<div align="center">

# InvoiceFlow

**Rechnungen, die sich schreiben lassen.**

Full-Stack-Rechnungsverwaltung für Freelancer und kleine Teams.
GoBD-konforme Rechnungen, PDF-Export, Status-Tracking — gebaut als Portfolio-Projekt.

[![Status](https://img.shields.io/badge/status-in%20entwicklung-orange)]()
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

[🇬🇧 English version](README.md)

</div>

---

## Worum es geht

InvoiceFlow ist ein echtes Produkt, end-to-end gebaut, das die Art von Arbeit
zeigt, die Kunden erwarten können — separates Backend und Frontend in eigenen
Repositories, echte Authentifizierung, echte Domänen-Logik, echtes Deployment,
keine Abkürzungen.

> **Live-Demo:** _kommt bald_ — aktuell in aktiver Entwicklung

## Architektur

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Frontend (dieses Repo) │         │  invoice-api             │
│                         │         │  (separates Repository)  │
│  • Next.js 16           │ ◄─────► │                          │
│  • NextAuth.js v5       │  HTTPS  │  • ASP.NET Core 8        │
│  • TanStack Query       │  + JWT  │  • PostgreSQL + EF Core  │
│  • Typed API Client     │         │  • QuestPDF              │
│  • i18n (EN + DE)       │         │  • JWT-Auth              │
│                         │         │                          │
│  → Vercel               │         │  → Railway               │
└─────────────────────────┘         └──────────────────────────┘
```

Frontend und Backend sind unabhängige Services, kommunizieren über eine typisierte
REST-API. TypeScript-Types werden automatisch aus der OpenAPI-Spec des Backends
generiert — keine manuelle Schema-Synchronisation.

**Backend-Repository:** [Pr0degie/invoice-api](https://github.com/Pr0degie/invoice-api)

## Status

| Bereich | Status |
|---------|--------|
| Marketing-Landing-Page | ✅ Fertig |
| Sign-up / Sign-in | ✅ Fertig |
| API-Client (typisiert, mit Refresh-Flow) | ✅ Fertig |
| App-Shell (Sidebar + Topbar) | ✅ Fertig |
| Dashboard (KPIs, Umsatz-Chart) | ✅ Fertig |
| Rechnungsliste (Filter, PDF-Download) | ✅ Fertig |
| Rechnungs-Detail + Status-Flow (Entwurf → Festschreiben → Bezahlt / Storno) | ✅ Fertig |
| Entsperren vor Versand (auditierte GoBD-Ausnahme, Nummer bleibt erhalten) | ✅ Fertig |
| Rechnungs-Formular (erstellen/bearbeiten, Leistungsdatum/-zeitraum) | ✅ Fertig |
| Einstellungen (inkl. Steuern & Rechnungsdaten, § 19 UStG) | ✅ Fertig |
| Production-Deployment | ⏳ Geplant |

## Tech Stack

**Framework & Sprache:** Next.js 16 (App Router), TypeScript 5
**Styling:** Tailwind CSS 4, shadcn/ui, lucide-react
**State:** TanStack Query für Server-State, React Hook Form + Zod für Formulare
**Auth:** NextAuth.js v5 (Credentials-Provider gegen den invoice-api JWT-Endpunkt)
**i18n:** next-intl, Englisch als Default mit deutscher Unterstützung
**Charts:** Recharts
**Toasts:** Sonner
**Tooling:** npm, ESLint, Playwright (visuelles Feedback während der Entwicklung)

## Design-Philosophie

Das hier ist ein **Finance-UI**, kein generisches SaaS-Dashboard. Konkret:

- Zahlen sind rechtsbündig, `tabular-nums`, locale-bewusst (`1.234,56 €` / `€1,234.56`)
- Status-Farben sparsam und konsistent über alle Views eingesetzt
- Ein zurückhaltender Akzent (Teal) — keine Regenbogen-Gradienten
- Typografie vor Icons — Finance-Tools lesen sich besser ohne visuelles Rauschen
- Empty-, Loading- und Error-States sind erstklassig, kein Nachtrag

## Lokale Entwicklung

```bash
git clone https://github.com/Pr0degie/invoiceflow-frontend
cd invoiceflow-frontend
npm install
cp .env.example .env.local
# .env.local bearbeiten — NEXT_PUBLIC_API_BASE_URL auf deine invoice-api zeigen
npm run dev
```

Frontend läuft auf `http://localhost:3000`. Setzt eine laufende
[invoice-api](https://github.com/Pr0degie/invoice-api)-Instanz voraus
(üblicherweise `http://localhost:8080` via `docker compose up`).

### Scripts

| Befehl | Was er macht |
|--------|--------------|
| `npm run dev` | Lokaler Dev-Server mit Hot Reload |
| `npm run build` | Production Build |
| `npm run lint` | ESLint-Check |
| `npm run typecheck` | TypeScript-Check |
| `npm run api:types` | TS-Types aus `openapi.json` neu generieren |

## Was das Projekt bewusst NICHT enthält

Ein ehrliches Produkt, keine Feature-Liste-Kosplay. Folgendes ist explizit
out of scope:

- Keine Kunden-/CRM-Entity — Empfänger sind Freitext pro Rechnung
- Keine Zahlungs-Historie — nur Status-Übergänge
- Kein Mahnwesen
- Keine wiederkehrenden Rechnungen
- Keine Multi-Currency-Umrechnung
- Keine Team- oder Workspace-Features
- Keine Datei-Anhänge

Wenn ein echtes Produkt diese Features später braucht, werden sie als richtige
Features ergänzt — nicht im UI vorgetäuscht.

## Repository-Struktur

```
invoiceflow-frontend/
├── src/
│   ├── app/              # Next.js App Router Routes
│   │   ├── [locale]/     # i18n Route-Gruppe
│   │   └── api/          # NextAuth-Handler (Login, Register)
│   ├── components/       # UI-Komponenten
│   ├── i18n/             # next-intl Routing + Navigation
│   └── lib/
│       ├── api/          # Typisierter API-Client + Hooks
│       ├── i18n/         # Formatter
│       ├── schemas/      # Zod-Schemas
│       └── tax-profile.ts # Steuerprofil-Helper (§ 19 UStG, Pflichtfelder)
├── messages/             # i18n-Übersetzungen (en.json / de.json)
├── docs/                 # API-Contract, Auth, i18n, Branding, Progress-Log
├── CLAUDE.md             # Projekt-Briefing (Design-Regeln, Workflow)
└── openapi.json          # API-Spec (Quelle für Type-Generation)
```

## Mit Absicht gebaut

Der Codebase entsteht in einem strukturierten, prompt-getriebenen Workflow mit
Claude Code, in dem jedes Subsystem (Auth, API-Contract, State-Management, i18n) eine
zugehörige Doku in `docs/` hat. Die Docs werden parallel zum Code versioniert
— nützlich sowohl als Arbeitsdokument während der Entwicklung als auch als
Entscheidungs-Dokumentation für jeden, der das Repo später liest.

## Lizenz

MIT — siehe [LICENSE](LICENSE).

## Autor

Gebaut von [@Pr0degie](https://github.com/Pr0degie). Offen für Feedback, Issues
und konstruktive Kritik.