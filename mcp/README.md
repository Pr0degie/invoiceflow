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
