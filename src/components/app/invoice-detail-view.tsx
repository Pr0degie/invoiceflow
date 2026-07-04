"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale, useFormatter } from "next-intl";
import Link from "next/link";
import {
  Download,
  Loader2,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  Ban,
  FileCheck,
  Pencil,
  Trash2,
  ChevronRight,
  RotateCcw,
  FileText,
  LockOpen,
} from "lucide-react";
import { format as formatDateFns } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { StatusIndicator, getDisplayStatus } from "./status-indicator";
import {
  useInvoice,
  useUpdateInvoiceStatus,
  useDeleteInvoice,
  useDownloadInvoicePdf,
  useFinalizeInvoice,
  useCancelInvoice,
  useReopenInvoice,
} from "@/lib/api/hooks/useInvoices";
import { useMe } from "@/lib/api/hooks/useMe";
import { isTaxProfileComplete } from "@/lib/tax-profile";
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
  const { data: me } = useMe();
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const downloadPdf = useDownloadInvoicePdf();
  const finalizeInvoice = useFinalizeInvoice();
  const cancelInvoice = useCancelInvoice();
  const reopenInvoice = useReopenInvoice();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  // "" = no override → the server stamps its own today as Ausstellungsdatum
  const [finalizeIssueDate, setFinalizeIssueDate] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  // GoBD gate: the user must explicitly confirm the invoice never left the house
  const [reopenNotSentConfirmed, setReopenNotSentConfirmed] = useState(false);

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
  const displayStatus = getDisplayStatus(invoice);
  const isCancellation = invoice.type === "Cancellation";
  const invoiceId = invoice.id!;
  const subtotal = invoice.subtotal ?? 0;
  const taxAmount = invoice.taxAmount ?? 0;
  const total = invoice.total ?? 0;
  const taxRate = invoice.taxRate ?? 0;
  const numberLabel = invoice.number ?? t("draftNumber");
  // § 19: finalized invoices carry the snapshot; drafts preview the setting
  const smallBusiness =
    invoice.isSmallBusiness || (status === "Draft" && !!me?.isSmallBusiness);
  const profileComplete = isTaxProfileComplete(me);
  const todayIso = formatDateFns(new Date(), "yyyy-MM-dd");

  function handleStatusChange(newStatus: InvoiceStatus) {
    updateStatus.mutate(
      { id: invoiceId, status: newStatus },
      { onSuccess: () => toast.success(t("detail.statusSuccess")) }
    );
  }

  function handleFinalize() {
    finalizeInvoice.mutate(
      { id: invoiceId, issueDate: finalizeIssueDate || undefined },
      {
        onSuccess: (finalized) =>
          toast.success(
            t("form.success.finalized", { number: finalized.number ?? "" })
          ),
      }
    );
    setFinalizeOpen(false);
  }

  function handleCancelInvoice() {
    cancelInvoice.mutate(invoiceId, {
      onSuccess: (storno) => {
        toast.success(t("storno.success", { number: storno.number ?? "" }));
        router.push(`${localePrefix}/app/invoices/${storno.id}`);
      },
    });
    setCancelOpen(false);
  }

  function handleReopen() {
    reopenInvoice.mutate(invoiceId, {
      onSuccess: (draft) => {
        toast.success(t("reopen.success", { number: draft.number ?? "" }));
        router.push(`${localePrefix}/app/invoices/${invoiceId}/edit`);
      },
    });
    setReopenOpen(false);
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
          {numberLabel}
        </span>
      </nav>

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div className="space-y-1.5">
          <h1 className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
            {numberLabel}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <StatusIndicator
              status={displayStatus}
              label={t(`status.${displayStatus}`)}
            />
            {isCancellation && (
              <span className="rounded border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("detail.cancellationBadge")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download PDF — always visible */}
          <Button
            variant="outline"
            onClick={() =>
              downloadPdf.mutate({
                id: invoiceId,
                number: invoice.number,
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

          {/* Draft: finalize (assigns the number, freezes the invoice) */}
          {status === "Draft" && (
            <Button
              onClick={() => {
                setFinalizeIssueDate("");
                setFinalizeOpen(true);
              }}
              disabled={finalizeInvoice.isPending || !profileComplete}
            >
              {finalizeInvoice.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileCheck className="mr-2 size-4" />
              )}
              {t("actions.finalize")}
            </Button>
          )}

          {/* Finalized (incl. derived overdue): mark as paid */}
          {status === "Finalized" && !isCancellation && (
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => handleStatusChange("Paid")}
              disabled={updateStatus.isPending}
            >
              <CheckCircle className="mr-2 size-4" />
              {t("actions.markAsPaid")}
            </Button>
          )}

          {/* Finalized: Storno */}
          {status === "Finalized" && !isCancellation && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-600 dark:text-red-400"
              onClick={() => setCancelOpen(true)}
              disabled={cancelInvoice.isPending}
            >
              {cancelInvoice.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Ban className="mr-2 size-4" />
              )}
              {t("actions.storno")}
            </Button>
          )}

          {/* Finalized: rare, deliberate actions (reopen) behind the menu */}
          {status === "Finalized" && !isCancellation && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t("actions.openMenu")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem
                  onClick={() => {
                    setReopenNotSentConfirmed(false);
                    setReopenOpen(true);
                  }}
                  disabled={reopenInvoice.isPending}
                >
                  <LockOpen className="mr-2 size-4" />
                  {t("actions.reopen")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Paid: undo path back to Finalized */}
          {status === "Paid" && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange("Finalized")}
              disabled={updateStatus.isPending}
            >
              <RotateCcw className="mr-2 size-4" />
              {t("actions.markAsUnpaid")}
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

      {/* Draft + incomplete tax profile: finalize blocked, link to settings */}
      {status === "Draft" && !profileComplete && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400 print:hidden">
          {t("form.finalize.profileIncomplete")}{" "}
          <Link
            href={`${localePrefix}/app/settings?tab=tax`}
            className="font-medium underline underline-offset-2"
          >
            {t("form.finalize.goToSettings")}
          </Link>
        </div>
      )}

      {/* Cancellation ↔ original cross-references */}
      {isCancellation && invoice.cancellationOfNumber && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm print:hidden">
          {t("storno.referencesOriginal", {
            number: invoice.cancellationOfNumber,
          })}{" "}
          {invoice.cancellationOfId && (
            <Link
              href={`${localePrefix}/app/invoices/${invoice.cancellationOfId}`}
              className="font-medium underline underline-offset-2"
            >
              {t("storno.viewOriginal")}
            </Link>
          )}
        </div>
      )}
      {status === "Cancelled" && invoice.cancelledByNumber && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm print:hidden">
          {t("storno.cancelledBy", { number: invoice.cancelledByNumber })}
        </div>
      )}

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
                    {numberLabel}
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
                {invoice.serviceDate && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("detail.serviceDate")}{" "}
                    </span>
                    <span>{formatDate(invoice.serviceDate)}</span>
                  </div>
                )}
                {invoice.servicePeriodStart && invoice.servicePeriodEnd && (
                  <div>
                    <span className="text-muted-foreground">
                      {t("detail.servicePeriod")}{" "}
                    </span>
                    <span>
                      {formatDate(invoice.servicePeriodStart)} –{" "}
                      {formatDate(invoice.servicePeriodEnd)}
                    </span>
                  </div>
                )}
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

            {/* Totals — § 19 UStG: no VAT line for Kleinunternehmer */}
            <div className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
              {!smallBusiness && (
                <>
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
                </>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>{t("detail.total")}</span>
                <span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
              {smallBusiness && (
                <p className="text-xs text-muted-foreground">
                  {t("detail.smallBusinessNote")}
                </p>
              )}
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

      {/* Finalize confirmation — after this the invoice is immutable */}
      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("form.finalize.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("form.finalize.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Ausstellungsdatum: today unless overridden (past dates only) */}
          <div className="space-y-1.5">
            <Label htmlFor="finalize-issue-date">
              {t("form.finalize.issueDateLabel")}
            </Label>
            <Input
              id="finalize-issue-date"
              type="date"
              max={todayIso}
              value={finalizeIssueDate || todayIso}
              onChange={(e) => setFinalizeIssueDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("form.finalize.issueDateHint")}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.finalize.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>
              {t("form.finalize.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen confirmation — audited GoBD exception, only for unsent invoices */}
      <AlertDialog
        open={reopenOpen}
        onOpenChange={(open) => {
          setReopenOpen(open);
          if (!open) setReopenNotSentConfirmed(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("reopen.title", { number: invoice.number ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("reopen.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              {t("reopen.stornoHint")}
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="reopen-not-sent"
                checked={reopenNotSentConfirmed}
                onCheckedChange={(checked) =>
                  setReopenNotSentConfirmed(checked === true)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="reopen-not-sent"
                className="text-sm font-normal leading-snug"
              >
                {t("reopen.notSentConfirm")}
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("reopen.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReopen}
              disabled={!reopenNotSentConfirmed}
            >
              {t("reopen.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Storno confirmation */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("storno.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("storno.description", { number: invoice.number ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("storno.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvoice}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {t("storno.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("detail.deleteDescription", {
                number: numberLabel,
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
  const isFinalized = status !== "Draft";
  const isPaid = status === "Paid";
  const isCancelled = status === "Cancelled";

  const allSteps = [
    {
      key: "created",
      label: t("detail.timeline.created"),
      done: true,
      timestamp: invoice.createdAt ?? null,
    },
    {
      key: "finalized",
      label: t("detail.timeline.finalized"),
      done: isFinalized,
      timestamp: null, // API has no finalizedAt field
    },
    isCancelled
      ? {
          key: "cancelled",
          label: t("detail.timeline.cancelled"),
          done: true,
          timestamp: null,
        }
      : {
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
