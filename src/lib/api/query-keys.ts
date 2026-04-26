export interface InvoiceListFilters {
  status?: "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled";
  search?: string;
  from?: string;
  to?: string;
}

export interface StatsRange {
  from?: string;
  to?: string;
}

export const queryKeys = {
  invoices: {
    all: ["invoices"] as const,
    lists: () => [...queryKeys.invoices.all, "list"] as const,
    list: (filters: InvoiceListFilters) =>
      [...queryKeys.invoices.lists(), filters] as const,
    details: () => [...queryKeys.invoices.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },
  stats: (range: StatsRange) => ["stats", range] as const,
  me: ["me"] as const,
} as const;
