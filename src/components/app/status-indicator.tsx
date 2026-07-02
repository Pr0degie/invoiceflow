import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/schema";

type InvoiceStatus = components["schemas"]["InvoiceStatus"];

// "Overdue" is not a stored status — the API derives it (Finalized + past due
// date) and exposes it as isOverdue. For display it behaves like a status.
export type DisplayStatus = InvoiceStatus | "Overdue";

export function getDisplayStatus(invoice: {
  status?: InvoiceStatus;
  isOverdue?: boolean;
}): DisplayStatus {
  if (invoice.isOverdue) return "Overdue";
  return invoice.status ?? "Draft";
}

export const STATUS_COLORS: Record<DisplayStatus, string> = {
  Draft: "bg-zinc-400",
  Finalized: "bg-blue-500",
  Paid: "bg-emerald-500",
  Overdue: "bg-red-500",
  Cancelled: "bg-zinc-300",
};

interface StatusIndicatorProps {
  status: DisplayStatus;
  label: string;
  className?: string;
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_COLORS[status])} />
      <span>{label}</span>
    </span>
  );
}
