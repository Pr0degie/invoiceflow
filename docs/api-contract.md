# API Contract — SOURCE OF TRUTH

Backend: `invoice-api` (.NET 8 / ASP.NET Core). Separate repo at `../invoice-api/`.

**Never invent fields or endpoints. If it's not listed here, ask — don't fake it.**

> **Invoice numbers are scoped per user** (unique on `(UserId, Number)`). Two users
> may both have `INV-2026-0001`. Numbers are sequential within a user's own history.

---

## Base URL

| Env | URL |
|---|---|
| Local dev | `http://localhost:8080` — start with `docker compose up` in `../invoice-api/` |
| Production | Railway — set `NEXT_PUBLIC_API_BASE_URL` env var on Vercel |

---

## Authentication

All endpoints except `/api/auth/*` and `/health` require:
```
Authorization: Bearer <jwt>
```

---

## Auth Endpoints

```
POST   /api/auth/register         { name, email, password } → AuthResponse
POST   /api/auth/login            { email, password }        → AuthResponse
POST   /api/auth/refresh          { refreshToken }           → AuthResponse
GET    /api/auth/me                                          → UserDto
PATCH  /api/auth/me               { name?, defaultSenderName?, defaultSenderAddress? } → UserDto
DELETE /api/auth/me                                          → 204   (deletes the account)
POST   /api/auth/change-password  { currentPassword, newPassword } → 204
POST   /api/auth/logout           { refreshToken }           → 204
```

`AuthResponse`: `{ token, refreshToken, expiresAt, user: UserDto }`
`UserDto`: `{ id, email, name, createdAt, defaultSenderName, defaultSenderAddress }`
(`defaultSenderName` / `defaultSenderAddress` are nullable — used to prefill the sender fields on new invoices)

Refresh tokens are single-use (rotated on every refresh) with a **60 s grace
window**: re-sending a token rotated <60 s ago returns the *same* successor
tokens (concurrent-refresh safe). Reuse **after** 60 s revokes all of the
user's refresh tokens (theft signal) → 401. `register`, `login`, `refresh`,
`logout`, and `change-password` are rate-limited per IP (5/min) → 429 when
exceeded.

---

## Invoice Endpoints

All return the entity directly — not wrapped in `{ invoice }` or `{ data }`.

```
GET    /api/invoices                    → Invoice[]   ← FLAT ARRAY, no pagination
  ?status=Draft|Sent|Paid|Overdue|Cancelled
  ?search=<text>
  ?from=<iso-date>&to=<iso-date>

POST   /api/invoices                    → Invoice     (status starts as Draft)
GET    /api/invoices/{id}               → Invoice
PUT    /api/invoices/{id}               → Invoice     (Draft only — 409 otherwise)
PATCH  /api/invoices/{id}/status        → Invoice     (409 on a forbidden transition)
  body: { status: "Sent"|"Paid"|"Overdue"|"Cancelled" }
  allowed transitions:
    Draft   → Sent
    Sent    → Paid | Overdue | Cancelled
    Overdue → Paid | Cancelled
    Paid    → Overdue          (undo path; paidAt survives Paid→Overdue→Paid)
  paidAt is set on first Paid, cleared only on Cancelled
DELETE /api/invoices/{id}                             (Draft only — 409 otherwise)
GET    /api/invoices/{id}/pdf           → application/pdf (binary)
```

---

## Stats Endpoint

```
GET /api/invoices/stats?from=<iso>&to=<iso>
→ {
    totalOutstanding: number,     // Sent + Overdue
    totalPaid: number,
    totalDraft: number,
    overdueCount: number,
    draftCount: number,
    sentCount: number,
    paidCount: number,
    monthlyRevenue: [{ month: "2026-01", paid: number, sent: number }],
    topRecipients:  [{ name: string, total: number, count: number }]
  }
```

---

## Invoice Schema

```typescript
type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
type LineItemUnit  = "h" | "flat" | "piece" | "day";

interface LineItem {
  id?: string;           // present on existing items only
  description: string;
  quantity: number;
  unit: LineItemUnit;
  unitPrice: number;
  total: number;         // computed server-side; field is "total" not "lineTotal"
}

interface Invoice {
  id: string;            // UUID
  number: string;        // "INV-2026-0001", auto-generated, per-user sequential
  status: InvoiceStatus;
  senderName: string;
  senderAddress: string; // multiline, \n-separated
  recipientName: string;
  recipientAddress: string;
  taxRate: number;       // 0.19 = 19%
  currency: string;      // "EUR"
  lineItems: LineItem[];
  subtotal: number;      // computed
  taxAmount: number;     // computed
  total: number;         // computed
  issueDate: string;     // "YYYY-MM-DD"
  dueDate: string;       // "YYYY-MM-DD"
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## Error shape

All 4xx errors return `{ "error": "<message>" }` (unchanged by the 2026-07
hardening pass — errors are now produced by a central middleware, same shape).
`400` validation, `401` unauthenticated/dead session, `404` not found,
`409` conflict (non-draft edit/delete, forbidden status transition,
email already registered), `429` rate-limited.

---

## What the API does NOT have

Do not build UI for these — no placeholder either unless explicitly asked:

- Customer entity (recipient is free text)
- Partial payments or payment history
- Dunning / reminder stages
- Recurring invoices
- Multi-currency conversion
- Team / workspace features
- File attachments

---

## TypeScript Types

Types are generated from the OpenAPI spec. **Never hand-write them.**

```bash
# Fetch spec (requires API running locally):
curl http://localhost:8080/swagger/v1/swagger.json > openapi.json

# Regenerate types:
npm run api:types
```

Generated output: `src/lib/api/schema.d.ts`
