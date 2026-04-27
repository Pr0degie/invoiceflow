"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale, useFormatter } from "next-intl";
import Link from "next/link";
import {
  Download,
  Loader2,
  MoreHorizontal,
  Send,
  CheckCircle,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronRight,
  Clock,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusIndicator } from "./status-indicator";
import {
  useInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useDownloadInvoicePdf,
} from "@/lib/api/hooks/useInvoices";
import { useFormatCurrency, useFormatDate } from "@/lib/i18n/formatters";
import { ApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { toast } from "sonner";

type Invoice = components["schemas"]["InvoiceResponse"];
type InvoiceStatus = components["schemas"]["InvoiceStatus"];

export function InvoiceDetailView({ id }: { id: string }) {
  const t = useTranslations("invoices");
  const locale = useLocale();
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const router = useRouter();
  const format = useFormatter();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const { data: invoice, isLoading, error, refetch } = useInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const downloadPdf = useDownloadInvoicePdf();

  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    const isNotFound =
      error instanceof ApiError && (error.isNotFound || error.status === 403);
    if (isNotFound) {
      return <NotFoundState t={t} localePrefix={localePrefix} />;
    }
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="size-4" />
        <AlertTitle>{t("detail.loadError")}</AlertTitle>
        <AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => refetch()}
          >
            {t("detail.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!invoice) return <NotFoundState t={t} localePrefix={localePrefix} />;

  const status = (invoice.status ?? "Draft") as InvoiceStatus;
  const invoiceId = invoice.id!;
  const subtotal = invoice.subtotal ?? 0;
  const taxAmount = invoice.taxAmount ?? 0;
  const total = invoice.total ?? 0;
  const taxRate = invoice.taxRate ?? 0;

  function handleStatusChange(newStatus: InvoiceStatus) {
    updateStatus.mutate(
      { id: invoiceId, status: newStatus },
      { onSuccess: () => toast.success(t("detail.statusSuccess")) }
    );
  }

  function handleDelete() {
    deleteInvoice.mutate(invoiceId, {
      onSuccess: () => {
        toast.success(t("deleteSuccess"));
        router.push(`${localePrefix}/app/invoices`);
      },
    });
    setDeleteOpen(false);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground print:hidden"
      >
        <Link
          href={`${localePrefix}/app/invoices`}
          className="transition-colors hover:text-foreground"
        >
          {t("title")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="font-mono text-foreground">
          {invoice.number ?? "—"}
        </span>
      </nav>

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div className="space-y-1.5">
          <h1 className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {invoice.number ?? "—"}
          </h1>
          <StatusIndicator status={status} label={t(`status.${status}`)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download PDF — always visible */}
          <Button
            variant="outline"
            onClick={() =>
              downloadPdf.mutate({
                id: invoiceId,
                number: invoice.number ?? invoiceId,
              })
            }
            disabled={downloadPdf.isPending}
          >
            {downloadPdf.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            {downloadPdf.isPending
              ? t("detail.downloading")
              : t("actions.downloadPdf")}
          </Button>

          {/* Draft: mark as sent */}
          {status === "Draft" && (
            <Button
              onClick={() => handleStatusChange("Sent")}
              disabled={updateStatus.isPending}
            >
              <Send className="mr-2 size-4" />
              {t("actions.markAsSent")}
            </Button>
          )}

          {/* Sent / Overdue: mark as paid */}
          {(status === "Sent" || status === "Overdue") && (
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => handleStatusChange("Paid")}
              disabled={updateStatus.isPending}
            >
              <CheckCircle className="mr-2 size-4" />
              {t("actions.markAsPaid")}
            </Button>
          )}

          {/* Sent: manual overdue force */}
          {status === "Sent" && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange("Overdue")}
              disabled={updateStatus.isPending}
            >
              <Clock className="mr-2 size-4" />
              {t("detail.markAsOverdue")}
            </Button>
          )}

          {/* Draft: more actions (edit + delete) */}
          {status === "Draft" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t("actions.openMenu")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem asChild>
                  <Link
                    href={`${localePrefix}/app/invoices/${invoiceId}/edit`}
                  >
                    <Pencil className="mr-2 size-4" />
                    {t("detail.edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <Trash2 className="mr-2 size-4" />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Invoice preview — left 2 cols */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card p-8 md:p-10">
            {/* Sender */}
            <div className="mb-12">
              <p className="font-semibold">{invoice.senderName ?? "—"}</p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {invoice.senderAddress ?? ""}
              </p>
            </div>

            {/* Recipient + invoice meta */}
            <div className="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("detail.invoiceTo")}
                </p>
                <p className="font-medium">{invoice.recipientName ?? "—"}</p>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {invoice.recipientAddress ?? ""}
                </p>
              </div>
              <div className="space-y-1.5 text-sm sm:text-right">
                <div>
                  <span className="text-muted-foreground">
                    {t("detail.invoiceNumber")}{" "}
                  </span>
                  <span className="font-mono tabular-nums">
                    {invoice.number ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("detail.date")}{" "}
                  </span>
                  <span>
                    {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t("detail.dueDate")}{" "}
                  </span>
                  <span>
                    {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-0 text-xs uppercase tracking-wider text-muted-foreground">
                    {t("detail.lineItems.description")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                    {t("detail.lineItems.qty")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                    {t("detail.lineItems.unit")}
                  </TableHead>
                  <TableHead className="text-right text-xs uppercase tracking-wider text-muted-foreground">
                    {t("detail.lineItems.unitPrice")}
                  </TableHead>
                  <TableHead className="pr-0 text-right text-xs uppercase tracking-wider text-muted-foreground">
                    {t("detail.lineItems.amount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoice.lineItems ?? []).map((item, i) => (
                  <TableRow
                    key={item.id ?? i}
                    className="border-b last:border-b-0"
                  >
                    <TableCell className="pl-0 py-3">
                      {item.description ?? "—"}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums">
                      {item.quantity != null
                        ? item.quantity % 1 === 0
                          ? item.quantity.toFixed(0)
                          : item.quantity.toFixed(2)
                        : "—"}
                    </TableCell>
                    <TableCell className="py-3 text-right text-muted-foreground">
                      {item.unit ?? "—"}
                    </TableCell>
                    <TableCell className="py-3 text-right tabular-nums">
                      {formatCurrency(item.unitPrice ?? 0)}
                    </TableCell>
                    <TableCell className="pr-0 py-3 text-right tabular-nums">
                      {formatCurrency(item.total ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Totals */}
            <div className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("detail.subtotal")}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("detail.vat", {
                    rate: (taxRate * 100).toFixed(0),
                  })}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>{t("detail.total")}</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-10 border-t pt-6">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("detail.notes")}
                </p>
                <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column: timeline + metadata */}
        <div className="space-y-4 print:hidden">
          {/* Status timeline */}
          <div className="rounded-lg border bg-card p-6">
            <p className="mb-5 text-sm font-medium">
              {t("detail.timeline.title")}
            </p>
            <StatusTimeline
              status={status}
              invoice={invoice}
              t={t}
              format={format}
            />
          </div>

          {/* Metadata */}
          <div className="rounded-lg border bg-card p-6">
            <p className="mb-4 text-sm font-medium">
              {t("detail.metadata.title")}
            </p>
            <div className="space-y-3 text-sm">
              <MetaRow
                label={t("detail.metadata.created")}
                value={
                  invoice.createdAt
                    ? format.dateTime(new Date(invoice.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"
                }
              />
              <MetaRow
                label={t("detail.metadata.updated")}
                value={
                  invoice.updatedAt
                    ? format.dateTime(new Date(invoice.updatedAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"
                }
              />
              {invoice.paidAt && (
                <MetaRow
                  label={t("detail.metadata.paidOn")}
                  value={format.dateTime(new Date(invoice.paidAt), {
                    dateStyle: "medium",
                  })}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.deleteDescription", {
                number: invoice.number ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {t("delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



function StatusTimeline({
  status,
  invoice,
  t,
  format,
}: {
  status: InvoiceStatus;
  invoice: Invoice;
  t: ReturnType<typeof useTranslations<"invoices">>;
  format: ReturnType<typeof useFormatter>;
}) {
  const isSent = ["Sent", "Paid", "Overdue"].includes(status);
  const isPaid = status === "Paid";

  const allSteps = [
    {
      key: "created",
      label: t("detail.timeline.created"),
      done: true,
      timestamp: invoice.createdAt ?? null,
    },
    {
      key: "sent",
      label: t("detail.timeline.sent"),
      done: isSent,
      timestamp: null, // API has no sentAt field
    },
    {
      key: "paid",
      label: t("detail.timeline.paid"),
      done: isPaid,
      timestamp: invoice.paidAt ?? null,
    },
  ];

  // Draft: only show Created step
  const steps = status === "Draft" ? allSteps.slice(0, 1) : allSteps;

  return (
    <div>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.key} className="flex gap-3">
            {/* Dot + connector line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "mt-0.5 size-2.5 shrink-0 rounded-full",
                  step.done
                    ? "bg-foreground"
                    : "border-2 border-muted-foreground/40 bg-background"
                )}
              />
              {!isLast && (
                <div className="mt-1.5 w-px flex-1 min-h-8 bg-border" />
              )}
            </div>
            {/* Label + timestamp */}
            <div className={cn("pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  !step.done && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {step.timestamp
                  ? format.dateTime(new Date(step.timestamp), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : step.done
                  ? "—"
                  : t("detail.timeline.notYet")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function NotFoundState({
  t,
  localePrefix,
}: {
  t: ReturnType<typeof useTranslations<"invoices">>;
  localePrefix: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <FileText className="size-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{t("detail.notFound")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("detail.notFoundDescription")}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={`${localePrefix}/app/invoices`}>
          {t("detail.backToList")}
        </Link>
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-3 rounded" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Main layout skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Skeleton className="h-[520px] rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
