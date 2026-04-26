"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFormatCurrency, useFormatRelative } from "@/lib/i18n/formatters";
import type { components } from "@/lib/api/schema";

type Invoice = components["schemas"]["InvoiceResponse"];
type InvoiceStatus = components["schemas"]["InvoiceStatus"];

const STATUS_DOT: Record<InvoiceStatus, string> = {
  Draft: "bg-zinc-400",
  Sent: "bg-blue-500",
  Paid: "bg-emerald-500",
  Overdue: "bg-red-500",
  Cancelled: "bg-zinc-300",
};

interface ActivityListProps {
  invoices: Invoice[];
  loading?: boolean;
}

export function ActivityList({ invoices, loading }: ActivityListProps) {
  const t = useTranslations("dashboard.activity");
  const locale = useLocale();
  const prefix = locale === "en" ? "" : "/de";
  const formatCurrency = useFormatCurrency();
  const formatRelative = useFormatRelative();

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {loading ? (
          <ul className="divide-y divide-border px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="size-2 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3.5 w-16" />
              </li>
            ))}
          </ul>
        ) : invoices.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`${prefix}/app/invoices/${inv.id}`}
                  className="flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-accent/50"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      STATUS_DOT[inv.status ?? "Draft"]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{inv.number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.recipientName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums">
                      {formatCurrency(inv.total ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inv.createdAt
                        ? formatRelative(inv.createdAt)
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <CardFooter className="border-t pt-3">
        <Link
          href={`${prefix}/app/invoices`}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("viewAll")}
          <ArrowRight className="size-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
