"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale, useFormatter } from "next-intl";
import Link from "next/link";
import { formatDistanceToNow, isBefore } from "date-fns";
import { de, enUS } from "date-fns/locale";
import {
  Search,
  Plus,
  AlertCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useInvoices } from "@/lib/api/hooks/useInvoices";
import type { components } from "@/lib/api/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useFormatCurrency } from "@/lib/i18n/formatters";
import { StatusIndicator, STATUS_COLORS } from "./status-indicator";
import { InvoiceRowActions } from "./invoice-row-actions";

type Invoice = components["schemas"]["InvoiceResponse"];
type InvoiceStatus = components["schemas"]["InvoiceStatus"];

const PAGE_SIZE = 25;
const STATUSES: InvoiceStatus[] = ["Draft", "Sent", "Paid", "Overdue", "Cancelled"];

export function InvoiceListView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("invoices");
  const locale = useLocale();
  const format = useFormatter();
  const formatCurrency = useFormatCurrency();
  const dateFnsLocale = locale === "de" ? de : enUS;
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const q = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [searchInput, setSearchInput] = useState(q);

  // Debounce search input → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput) {
        params.set("q", searchInput);
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Sync input when q changes externally (reset filters)
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function resetFilters() {
    router.replace(pathname);
    setSearchInput("");
  }

  function goPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function shortDate(dateStr?: string | null) {
    if (!dateStr) return "—";
    return format.dateTime(new Date(dateStr), { month: "short", day: "numeric" });
  }

  function longDateTime(dateStr?: string | null) {
    if (!dateStr) return "";
    return format.dateTime(new Date(dateStr), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function dueDateInfo(dueDate?: string | null, status?: InvoiceStatus | null) {
    if (!dueDate) return { label: "—", overdue: false };
    const date = new Date(dueDate);
    const past = isBefore(date, new Date());
    const overdue =
      status === "Overdue" ||
      (past && status !== "Paid" && status !== "Cancelled");
    const label = formatDistanceToNow(date, {
      addSuffix: true,
      locale: dateFnsLocale,
    });
    return { label, overdue };
  }

  const statusFilter = STATUSES.includes(statusParam as InvoiceStatus)
    ? (statusParam as InvoiceStatus)
    : undefined;

  const {
    data: invoices,
    isLoading,
    error,
    refetch,
  } = useInvoices({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q ? { search: q } : {}),
  });

  const allInvoices = invoices ?? [];
  const total = allInvoices.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const sliceFrom = (currentPage - 1) * PAGE_SIZE;
  const paginated = allInvoices.slice(sliceFrom, sliceFrom + PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : sliceFrom + 1;
  const showingTo = Math.min(sliceFrom + PAGE_SIZE, total);

  const isFirstEmpty = !isLoading && !error && total === 0 && !statusFilter && !q;
  const isFilteredEmpty = !isLoading && !error && total === 0 && (!!statusFilter || !!q);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader t={t} localePrefix={localePrefix} />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("error.title")}</AlertTitle>
          <AlertDescription>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              {t("error.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <PageHeader t={t} localePrefix={localePrefix} />

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select
            value={statusParam || "all"}
            onValueChange={(v) => setParam("status", v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("statusOptions.all")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* First-time empty */}
        {isFirstEmpty && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{t("empty.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("empty.description")}
              </p>
            </div>
            <Button asChild>
              <Link href={`${localePrefix}/app/invoices/new`}>
                <Plus className="mr-2 size-4" />
                {t("empty.cta")}
              </Link>
            </Button>
          </div>
        )}

        {/* Filtered empty */}
        {isFilteredEmpty && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              {t("filteredEmpty.description")}
            </p>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              {t("filteredEmpty.reset")}
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <>
            {/* Desktop */}
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <SkeletonHeader t={t} />
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-4">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="px-4">
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell className="px-4">
                        <Skeleton className="h-4 w-14" />
                      </TableCell>
                      <TableCell className="px-4">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="px-4">
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                      <TableCell className="px-4">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell className="w-12 px-4" />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="space-y-2 md:hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border p-4"
                >
                  <Skeleton className="size-2 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Data */}
        {!isLoading && paginated.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <SkeletonHeader t={t} />
                </TableHeader>
                <TableBody>
                  {paginated.map((inv) => {
                    const due = dueDateInfo(inv.dueDate, inv.status);
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          router.push(
                            `${localePrefix}/app/invoices/${inv.id}`
                          )
                        }
                      >
                        <TableCell className="px-4 py-3 font-mono text-sm tabular-nums">
                          {inv.number ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate px-4 py-3 text-sm">
                          {inv.recipientName ?? "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {shortDate(inv.issueDate)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {longDateTime(inv.issueDate)}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <span
                            className={cn(
                              due.overdue &&
                                "text-red-600 dark:text-red-400"
                            )}
                          >
                            {due.label}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right text-sm tabular-nums">
                          {formatCurrency(inv.total ?? 0)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <StatusIndicator
                            status={(inv.status ?? "Draft") as InvoiceStatus}
                            label={t(`status.${inv.status ?? "Draft"}`)}
                          />
                        </TableCell>
                        <TableCell
                          className="w-12 px-2 py-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <InvoiceRowActions invoice={inv} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {paginated.map((inv) => {
                const due = dueDateInfo(inv.dueDate, inv.status);
                const status = (inv.status ?? "Draft") as InvoiceStatus;
                return (
                  <Link
                    key={inv.id}
                    href={`${localePrefix}/app/invoices/${inv.id}`}
                    className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        STATUS_COLORS[status]
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-mono text-sm font-medium tabular-nums">
                          {inv.number ?? "—"}
                        </p>
                        <p className="shrink-0 text-sm tabular-nums">
                          {formatCurrency(inv.total ?? 0)}
                        </p>
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {inv.recipientName ?? "—"}
                        </p>
                        <p
                          className={cn(
                            "shrink-0 text-xs",
                            due.overdue
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {due.label}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>
                  {t("pagination.showing", {
                    from: showingFrom,
                    to: showingTo,
                    total,
                  })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="size-4" />
                    {t("pagination.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goPage(currentPage + 1)}
                    disabled={currentPage >= pageCount}
                  >
                    {t("pagination.next")}
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

function PageHeader({
  t,
  localePrefix,
}: {
  t: ReturnType<typeof useTranslations<"invoices">>;
  localePrefix: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <Button asChild>
        <Link href={`${localePrefix}/app/invoices/new`}>
          <Plus className="mr-2 size-4" />
          {t("newInvoice")}
        </Link>
      </Button>
    </div>
  );
}

function SkeletonHeader({
  t,
}: {
  t: ReturnType<typeof useTranslations<"invoices">>;
}) {
  return (
    <TableRow>
      <TableHead className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("columns.number")}
      </TableHead>
      <TableHead className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("columns.recipient")}
      </TableHead>
      <TableHead className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("columns.issued")}
      </TableHead>
      <TableHead className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("columns.due")}
      </TableHead>
      <TableHead className="px-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("columns.amount")}
      </TableHead>
      <TableHead className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("columns.status")}
      </TableHead>
      <TableHead className="w-12 px-4" />
    </TableRow>
  );
}
