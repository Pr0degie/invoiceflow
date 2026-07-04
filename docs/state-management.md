# State Management — Conventions

---

## Server state: TanStack Query

All server data goes through `@tanstack/react-query`. No Redux, no Zustand.

### Query key structure

Centralized in `src/lib/api/query-keys.ts`:

```ts
export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    lists: () => [...queryKeys.invoices.all, "list"] as const,
    list: (filters: InvoiceListFilters) => [...queryKeys.invoices.lists(), filters] as const,
    details: () => [...queryKeys.invoices.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },
  stats: (range: StatsRange) => ["stats", range] as const,
  me: ["me"] as const,
} as const;
```

### Stale-time defaults

| Query | staleTime |
|---|---|
| Invoice list | 30 s |
| Single invoice | 10 s |
| Stats | 60 s |

### Mutations

- Always invalidate affected query keys after success — not `queryClient.clear()`.
- Optimistic updates for status changes (feels instant, rolls back on error).
- Example: `useUpdateInvoiceStatus` in `src/lib/api/hooks/useInvoices.ts`.

### Hook layer

Components import only from `src/lib/api/hooks/` — never `apiClient` directly.

Available hooks:
- `useInvoices(filters?)` — list
- `useInvoice(id)` — single
- `useStats(range?)` — dashboard KPIs
- `useCreateInvoice()` — mutation
- `useUpdateInvoice()` — mutation (PUT, drafts only — 409 otherwise)
- `useUpdateInvoiceStatus()` — mutation with optimistic update (Finalized ↔ Paid only)
- `useFinalizeInvoice()` — mutation, takes `{ id, issueDate? }` (POST `/finalize`; stamps the Ausstellungsdatum — server-today unless `issueDate` overrides — assigns number + archives PDF)
- `useReopenInvoice()` — mutation, takes `id` (POST `/reopen`; Finalized → Draft for pre-dispatch corrections, number retained; detail cache set from the response, lists + stats invalidated)
- `useCancelInvoice()` — mutation (POST `/cancel`, creates the Stornorechnung)
- `useDeleteInvoice()` — mutation (drafts only; reopened drafts with a number → 409)
- `useDownloadInvoicePdf()` — mutation (triggers browser download)

### API client

`src/lib/api/client.ts` — typed with `openapi-fetch` against generated `schema.d.ts`.
Auth header injected per-call via `bearerHeader(token)` helper (not a global middleware).

---

## Forms

- `react-hook-form` + `zod` for all forms.
- Zod schemas in `src/lib/schemas/` (`auth.ts` for auth, `invoice-form.ts` for invoices).
- Inline errors under each field; `sonner` toast on unrecoverable submit error.
- Do NOT use `react-hook-form` for simple 1–2 field forms; plain React state is fine.
- Line items in the invoice form reorder via drag & drop (`@dnd-kit/core` +
  `@dnd-kit/sortable`, grip-handle only) wired to `useFieldArray`'s `move()` —
  the array order is what the API persists as `Position`. Keyboard sorting
  works too (focus handle, Space/Enter picks up, arrows move).

---

## Error handling

`src/lib/api/errors.ts` exports `ApiError` with `.isUnauthorized`, `.isConflict`, `.isNotFound`.
409 Conflict = lifecycle violation — delete/edit of a non-draft, a disallowed status transition, finalizing with an incomplete tax profile or missing service date/period, or cancelling an invoice that isn't Finalized → show the action-specific message (e.g. "Only draft invoices can be deleted.").
Global unexpected errors → `sonner` toast with generic message.

---

## QueryProvider location

`src/components/providers/query-provider.tsx` — wrapped in `src/app/[locale]/layout.tsx`.
React Query DevTools visible in development only.
