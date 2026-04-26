import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/schema";

type InvoiceStatus = components["schemas"]["InvoiceStatus"];

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Draft: "bg-zinc-400",
  Sent: "bg-blue-500",
  Paid: "bg-emerald-500",
  Overdue: "bg-red-500",
  Cancelled: "bg-zinc-300",
};

interface StatusIndicatorProps {
  status: InvoiceStatus;
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
