/** Structural subset of InvoiceResponse — accepts API invoices directly. */
export interface InvoiceRow {
  id?: string;
  number?: string | null;
  status?: string;
  type?: string;
  recipientName?: string | null;
  serviceDate?: string | null;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Live invoices (drafts included) to the same recipient whose service period touches from..to. */
export function findOverlaps(invoices: InvoiceRow[], recipientName: string, from: string, to: string, ignoreId?: string): InvoiceRow[] {
  return invoices.filter((inv) => {
    if (inv.id === ignoreId || inv.status === "Cancelled" || inv.type === "Cancellation") return false;
    if (norm(inv.recipientName) !== norm(recipientName)) return false;
    const start = inv.servicePeriodStart ?? inv.serviceDate;
    const end = inv.servicePeriodEnd ?? inv.serviceDate;
    return !!start && !!end && start <= to && end >= from;
  });
}
