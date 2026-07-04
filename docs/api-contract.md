# API Contract — SOURCE OF TRUTH

Backend: `invoice-api` (.NET 8 / ASP.NET Core). Separate repo at `../invoice-api/`.

**Never invent fields or endpoints. If it's not listed here, ask — don't fake it.**

> **Invoice numbers are scoped per user** (unique on `(UserId, Number)`), assigned
> **only at finalization** from a per-year sequence: `{year}-{NNN}` (e.g. `2026-001`,
> counter resets each year). Drafts have `number: null`. Numbers are never reused;
> legacy invoices may still carry the old `INV-{year}-{NNNN}` format.

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
PATCH  /api/auth/me               (any subset of UserDto's editable fields) → UserDto
DELETE /api/auth/me                                          → 204   (deletes the account)
POST   /api/auth/change-password  { currentPassword, newPassword } → 204
POST   /api/auth/logout           { refreshToken }           → 204
```

`AuthResponse`: `{ token, refreshToken, expiresAt, user: UserDto }`

```typescript
interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  defaultSenderName: string | null;    // prefill for new invoices
  defaultSenderAddress: string | null;
  // Sender tax profile (§ 14 Abs. 4 UStG). Finalizing an invoice requires
  // street+postalCode+city+country AND (taxNumber OR vatId) — 409 otherwise.
  taxNumber: string | null;            // Steuernummer
  vatId: string | null;                // USt-IdNr.
  isSmallBusiness: boolean;            // Kleinunternehmer § 19 UStG (default true for new users)
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;                // BT-42 seller contact — REQUIRED to finalize (E-Rechnung)
  iban: string | null;                 // bank details for the PDF footer (optional)
  bic: string | null;
  bankName: string | null;
}
```

`PATCH /api/auth/me` semantics per field: **null/absent = unchanged, `""` = clear**.
IBAN is normalized (spaces stripped, uppercased) and format-validated → 400.

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
  ?status=Draft|Finalized|Paid|Cancelled|Overdue   ← "Overdue" is a VIRTUAL filter
                                                      (Finalized past due date)
  ?search=<text>

POST   /api/invoices                    → Invoice     (status starts as Draft, number: null)
GET    /api/invoices/{id}               → Invoice
PUT    /api/invoices/{id}               → Invoice     (Draft only — 409 otherwise)

POST   /api/invoices/{id}/finalize      → Invoice     (Draft only)
  body (OPTIONAL): { issueDate?: "YYYY-MM-DD" }
  Sets the legal Ausstellungsdatum: today by default, or the explicit issueDate
  (400 if in the future). dueDate shifts to keep the draft's payment-term span
  (dueDate − issueDate, clamped to ≥ 0). The invoice-number year derives from
  the FINAL issueDate. Assigns the sequential number, snapshots isSmallBusiness
  (§ 19 → taxRate forced to 0), renders + archives the PDF, sets status
  Finalized. Also generates + archives the legally binding E-Rechnung
  (XRechnung 3.0, EN 16931 CII XML) — see /xml below. 409 when: not a Draft,
  sender tax profile incomplete (now also requires phone), no service
  date/period, OR the recipient lacks a structured address (street+postalCode
  +city) or email (BT-49). buyerReference defaults to "-", recipient country to
  "DE".
  Afterwards the invoice is IMMUTABLE — corrections go through /cancel
  (or, ONLY before dispatch, /reopen).
  Re-finalizing a reopened invoice REUSES its existing number (no new draw
  from the sequence) and re-archives the PDF.

POST   /api/invoices/{id}/reopen        → Invoice     (Finalized only)
  Audited GoBD exception (ADR 0003 in invoice-api): resets Finalized → Draft
  for corrections BEFORE the invoice is sent to the recipient. The invoice
  keeps its number; the number sequence is untouched. The archived PDF is
  discarded (re-archived at re-finalization) and an append-only audit entry
  is written. 400 if already a Draft; 409 for Paid, Cancelled and
  Cancellation invoices (those are corrected via /cancel + new invoice).

POST   /api/invoices/{id}/cancel        → Invoice     (the new Stornorechnung)
  Finalized only (Paid must be set back to Finalized first — 409 otherwise).
  Creates a Cancellation-type invoice (own sequential number, negated amounts,
  reference to the original) and sets the original to Cancelled (terminal).

PATCH  /api/invoices/{id}/status        → Invoice     (409 on a forbidden transition)
  body: { status: "Finalized"|"Paid" }
  allowed transitions:
    Finalized → Paid
    Paid      → Finalized      (undo path; paidAt survives Paid→Finalized→Paid)
  Draft→Finalized only via /finalize; Cancelled only via /cancel.
  paidAt is set on first Paid, cleared when the invoice is cancelled.

DELETE /api/invoices/{id}                             (Draft only — 409 otherwise)
  Reopened drafts (number already assigned) can NOT be deleted (409) —
  deleting would tear a gap into the number sequence. Re-finalize instead.
GET    /api/invoices/{id}/pdf           → application/pdf (binary)
  Finalized/Paid/Cancelled: the PDF archived at finalization (GoBD — never
  re-rendered). Draft: live preview with an ENTWURF watermark.

GET    /api/invoices/{id}/xml           → application/xml (binary; E-Rechnung)
  The XRechnung 3.0 (EN 16931 CII) XML archived at finalization. Draft → 409
  (drafts have no legal E-Rechnung). Legacy invoices finalized before E-Rechnung
  support are backfilled on demand ONLY if they carry structured recipient data
  + email and a seller phone; otherwise 409 names what's missing.
  Storno invoices are type 384 (Corrected invoice) with negative totals and
  reference the original in BT-25; § 19 invoices use tax category E (0 %).
```

---

## Stats Endpoint

```
GET /api/invoices/stats?from=<iso>&to=<iso>
→ {
    totalOutstanding: number,     // Finalized (unpaid); Cancellation invoices excluded
    totalPaid: number,
    totalDraft: number,
    overdueCount: number,         // subset of finalizedCount past its due date
    draftCount: number,
    finalizedCount: number,
    paidCount: number,
    monthlyRevenue: [{ month: "2026-01", paid: number, finalized: number }],
    topRecipients:  [{ name: string, total: number, count: number }]
  }
```

---

## Invoice Schema

```typescript
type InvoiceStatus = "Draft" | "Finalized" | "Paid" | "Cancelled";
// NOTE: "Overdue" is NOT a status — it is derived server-side as isOverdue
// (Finalized + past due date) and accepted as a virtual ?status= filter value.
type InvoiceType   = "Invoice" | "Cancellation";  // Cancellation = Stornorechnung
type LineItemUnit  = "h" | "flat" | "piece" | "day";

interface LineItem {
  id?: string;           // present on existing items only
  description: string;
  quantity: number;      // negative on Cancellation invoices
  unit: LineItemUnit;
  unitPrice: number;
  total: number;         // computed server-side; field is "total" not "lineTotal"
}

interface Invoice {
  id: string;            // UUID
  number: string | null; // null while Draft; "2026-001" after finalization
  status: InvoiceStatus;
  type: InvoiceType;
  isOverdue: boolean;    // derived: Finalized ∧ dueDate < today (never on drafts/stornos)
  senderName: string;
  senderAddress: string; // multiline, \n-separated
  recipientName: string;
  recipientAddress: string;      // legacy free-text; server composes it from the structured fields below
  // Structured recipient (buyer) data — for the E-Rechnung. Nullable on drafts /
  // legacy invoices; street+postalCode+city+email enforced at finalization.
  recipientStreet: string | null;
  recipientPostalCode: string | null;
  recipientCity: string | null;
  recipientCountryCode: string | null;  // ISO 3166-1 alpha-2, defaults to "DE"
  recipientEmail: string | null;        // BT-49 buyer electronic address
  recipientVatId: string | null;        // BT-48 (optional)
  buyerReference: string | null;        // BT-10; defaults to "-" at finalize
  taxRate: number;       // 0.19 = 19%; § 19 forces 0 at finalization
  isSmallBusiness: boolean; // § 19 snapshot taken at finalization
  currency: string;      // "EUR"
  lineItems: LineItem[];  // ALWAYS in input order — the API stores a per-item
                          // Position (array index at create/update) and sorts
                          // every response by it; send arrays in display order.
                          // Each item carries displayMode: "AsEntered" | "FlatRate".
                          // FlatRate is DISPLAY-ONLY: PDF + detail view render the
                          // position as 1 × pauschal × line total; the stored
                          // quantity/unit/unitPrice stay untouched and drive totals.

  subtotal: number;      // computed (net)
  taxAmount: number;     // computed (0 for Kleinunternehmer)
  total: number;         // computed (gross; = subtotal when § 19)
  issueDate: string;     // "YYYY-MM-DD"
  dueDate: string;       // "YYYY-MM-DD"
  // Leistungsdatum OR Leistungszeitraum — exactly one form; required to finalize
  serviceDate: string | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  paidAt: string | null;
  notes: string | null;
  // Storno cross-references:
  cancellationOfId: string | null;      // on Cancellation invoices: the original's id
  cancellationOfNumber: string | null;  // …and its number (snapshot)
  cancelledByNumber: string | null;     // on Cancelled originals (detail GET only)
  createdAt: string;
  updatedAt: string;
}
```

---

## Error shape

All 4xx errors return `{ "error": "<message>" }` (unchanged by the 2026-07
hardening pass — errors are now produced by a central middleware, same shape).
`400` validation, `401` unauthenticated/dead session, `404` not found,
`409` conflict (non-draft edit/delete, delete of a reopened draft that owns a
number, forbidden status transition, finalize with incomplete tax profile or
missing service date, cancel of a non-Finalized invoice, reopen of a
Paid/Cancelled/Cancellation invoice, email already registered), `429`
rate-limited.

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
