# Branding — InvoiceFlow

---

## Identity

- **Name:** InvoiceFlow
- **Tagline (en):** "Invoicing that gets out of your way."
- **Tagline (de):** "Rechnungen, die sich schreiben lassen."

---

## Color

- **Primary:** muted blue-green / teal — `#0F766E` / Tailwind `teal-700`.
- Feel: **professional, not hip.** Avoid pastel and neon.
- Use sparingly. Finance tools should feel restrained.
- CSS variable: `--color-primary` (set in `globals.css`).

---

## Typography

- **Font:** Geist Sans (loaded via `next/font`). No serif. No Google Fonts via `<link>`.
  (Web UI only — the invoice PDF is a separate backend artifact and deliberately
  uses Liberation Serif; see `../../invoice-api` `PdfService.cs`.)
- Numbers: always `tabular-nums` in tables and KPI displays.
- Large headlines: `tracking-tight`, `leading-[1.05]`.

---

## Logo

- Text logo: "InvoiceFlow" + small `Receipt` or `FileText` icon from `lucide-react` in accent color.
- No AI-generated logos.
- Favicon: the `Receipt` icon on the accent color, matching `<Logo />` (rendered by
  `src/app/icon.tsx` / `apple-icon.tsx`).

---

## Finance UI conventions

These override generic SaaS defaults:

| Rule | Detail |
|---|---|
| Amounts | Right-aligned, `tabular-nums`. DE: `1.234,56 €`. EN: `€1,234.56`. |
| Outstanding / overdue | `text-red-600 dark:text-red-500` — never neon red |
| Paid / positive | `text-emerald-600 dark:text-emerald-500` — never neon green |
| Status dots | Consistent colors everywhere (see below) |
| Icons | Minimal. No icon next to every label. Exceptions: status dots, `MoreHorizontal` row actions. |
| Date format | `de-DE` → `12.03.2026`, `en-US` → `Mar 12, 2026`. Use `date-fns` with locale. |

---

## Status colors (use consistently across the entire app)

| Status | Color | Dot / Badge |
|---|---|---|
| Draft | `zinc` / gray | Gray dot |
| Open (Finalized) | `blue` | Blue dot |
| Paid | `emerald` | Green dot |
| Overdue *(derived — `isOverdue` flag on Finalized invoices past due, not a stored status)* | `red` | Red dot |
| Cancelled | `zinc` (muted) | Gray dot, strikethrough text |
