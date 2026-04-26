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
- `useUpdateInvoiceStatus()` — mutation with optimistic update
- `useDeleteInvoice()` — mutation
- `useDownloadInvoicePdf()` — mutation (triggers browser download)

### API client

`src/lib/api/client.ts` — typed with `openapi-fetch` against generated `schema.d.ts`.
Auth header injected per-call via `bearerHeader(token)` helper (not a global middleware).

---

## Forms

- `react-hook-form` + `zod` for all forms.
- Zod schemas in `src/lib/validations.ts` (auth) or `src/lib/schemas/` for invoice forms.
- Inline errors under each field; `sonner` toast on unrecoverable submit error.
- Do NOT use `react-hook-form` for simple 1–2 field forms; plain React state is fine.

---

## Error handling

`src/lib/api/errors.ts` exports `ApiError` with `.isUnauthorized`, `.isConflict`, `.isNotFound`.
409 Conflict on delete/update → show specific message ("Only draft invoices can be deleted.").
Global unexpected errors → `sonner` toast with generic message.

---

## QueryProvider location

`src/components/providers/query-provider.tsx` — wrapped in `src/app/[locale]/layout.tsx`.
React Query DevTools visible in development only.
