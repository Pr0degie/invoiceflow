import { Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "default" | "lg";
}

export function Logo({ className, size = "default" }: LogoProps) {
  const isLg = size === "lg";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0",
          isLg ? "size-9" : "size-7"
        )}
      >
        <Receipt className={isLg ? "size-5" : "size-4"} />
      </div>
      <span
        className={cn(
          "font-semibold tracking-tight",
          isLg ? "text-xl" : "text-sm"
        )}
      >
        InvoiceFlow
      </span>
    </div>
  );
}
