"use client";

import { useEffect, useCallback } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { addDays, format } from "date-fns";
import {
  Plus,
  Trash2,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  invoiceFormSchema,
  type InvoiceFormValues,
  LINE_ITEM_UNITS,
  CURRENCIES,
  TAX_RATE_OPTIONS,
} from "@/lib/schemas/invoice-form";
import {
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useUpdateInvoiceStatus,
} from "@/lib/api/hooks/useInvoices";
import { useFormatCurrency } from "@/lib/i18n/formatters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { components } from "@/lib/api/schema";

type Invoice = components["schemas"]["InvoiceResponse"];


const TODAY = format(new Date(), "yyyy-MM-dd");
const IN_14 = format(addDays(new Date(), 14), "yyyy-MM-dd");
const IN_30 = format(addDays(new Date(), 30), "yyyy-MM-dd");

function getCreateDefaults(d?: { senderName?: string; senderAddress?: string }): InvoiceFormValues {
  return {
    senderName: d?.senderName ?? "",
    senderAddress: d?.senderAddress ?? "",
    recipientName: "",
    recipientAddress: "",
    issueDate: TODAY,
    dueDate: IN_14,
    currency: "EUR",
    taxRate: 0.19,
    notes: "",
    lineItems: [{ description: "", quantity: 1, unitPrice: 0, unit: "h" }],
  };
}

function mapInvoiceToForm(invoice: Invoice): InvoiceFormValues {
  return {
    senderName: invoice.senderName ?? "",
    senderAddress: invoice.senderAddress ?? "",
    recipientName: invoice.recipientName ?? "",
    recipientAddress: invoice.recipientAddress ?? "",
    issueDate: invoice.issueDate ?? TODAY,
    dueDate: invoice.dueDate ?? IN_14,
    currency:
      (invoice.currency as InvoiceFormValues["currency"]) ?? "EUR",
    taxRate: invoice.taxRate ?? 0.19,
    notes: invoice.notes ?? "",
    lineItems: (invoice.lineItems ?? []).map((item) => ({
      description: item.description ?? "",
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      unit: (item.unit as InvoiceFormValues["lineItems"][number]["unit"]) ?? "h",
    })),
  };
}

function mapFormToApi(values: InvoiceFormValues) {
  return {
    senderName: values.senderName,
    senderAddress: values.senderAddress,
    recipientName: values.recipientName,
    recipientAddress: values.recipientAddress,
    issueDate: values.issueDate || null,
    dueDate: values.dueDate || null,
    currency: values.currency,
    taxRate: Number(values.taxRate),
    notes: values.notes || null,
    lineItems: values.lineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      unit: item.unit,
    })),
  };
}


/** Rendered directly on the /invoices/new page (server passes sender defaults). */
export function InvoiceFormCreate({ defaults }: { defaults?: { senderName?: string; senderAddress?: string } }) {
  return <InvoiceForm mode="create" defaults={defaults} />;
}

/** Loads the invoice then renders the edit form. Used on /invoices/[id]/edit. */
export function InvoiceFormEditLoader({ id }: { id: string }) {
  const t = useTranslations("invoices.form");
  const locale = useLocale();
  const router = useRouter();
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const { data: invoice, isLoading, error } = useInvoice(id);

  useEffect(() => {
    if (invoice && invoice.status !== "Draft") {
      toast.error(t("errors.notDraft"));
      router.replace(`${localePrefix}/app/invoices/${id}`);
    }
  }, [invoice, id, localePrefix, router, t]);

  if (isLoading) return <FormSkeleton />;

  if (error || !invoice) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircle className="size-4" />
        <AlertTitle>{t("errors.loadFailed")}</AlertTitle>
        <AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            asChild
          >
            <Link href={`${localePrefix}/app/invoices`}>
              {t("actions.cancel")}
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (invoice.status !== "Draft") return null;

  return <InvoiceForm mode="edit" invoice={invoice} />;
}


type Props =
  | { mode: "create"; defaults?: { senderName?: string; senderAddress?: string } }
  | { mode: "edit"; invoice: Invoice };

function InvoiceForm(props: Props) {
  const { mode } = props;
  const invoice = mode === "edit" ? props.invoice : undefined;
  const defaults = mode === "create" ? props.defaults : undefined;

  const t = useTranslations("invoices");
  const tf = useTranslations("invoices.form");
  const locale = useLocale();
  const router = useRouter();
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const formatCurrency = useFormatCurrency();

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const updateStatus = useUpdateInvoiceStatus();

  const isSubmitting =
    createInvoice.isPending ||
    updateInvoice.isPending ||
    updateStatus.isPending;

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues:
      mode === "edit" ? mapInvoiceToForm(invoice!) : getCreateDefaults(defaults),
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = form;

  const { fields, append, remove } = useFieldArray({
    name: "lineItems",
    control,
  });

  // Live totals
  const watchedItems = useWatch({ control, name: "lineItems" });
  const watchedTaxRate = useWatch({ control, name: "taxRate" });
  const subtotal = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);
  const taxAmount = subtotal * (Number(watchedTaxRate) || 0);
  const total = subtotal + taxAmount;

  // Unsaved changes warning on tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Cmd/Ctrl+Enter → save as draft
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit((values) => onSubmit(values, "draft"))();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const onSubmit = useCallback(
    async (values: InvoiceFormValues, intent: "draft" | "send") => {
      const apiData = mapFormToApi(values);

      try {
        let created: Invoice;

        if (mode === "create") {
          created = await createInvoice.mutateAsync(apiData);
        } else {
          created = await updateInvoice.mutateAsync({
            id: invoice!.id!,
            data: apiData,
          });
        }

        if (intent === "send") {
          await updateStatus.mutateAsync({
            id: created.id!,
            status: "Sent",
          });
          toast.success(
            mode === "create"
              ? tf("success.createdAndSent")
              : tf("success.updatedAndSent")
          );
        } else {
          toast.success(
            mode === "create" ? tf("success.created") : tf("success.updated")
          );
        }

        router.push(`${localePrefix}/app/invoices/${created.id}`);
      } catch {
        // toast already shown by the mutation's onError
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, invoice, createInvoice, updateInvoice, updateStatus, router, localePrefix, tf]
  );


  const invoiceId = invoice?.id;
  const invNumber = invoice?.number;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Breadcrumb + title */}
          <div>
            <nav className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link
                href={`${localePrefix}/app/invoices`}
                className="hover:text-foreground transition-colors"
              >
                {t("title")}
              </Link>
              {mode === "edit" && invNumber && (
                <>
                  <ChevronRight className="size-3.5 shrink-0" />
                  <Link
                    href={`${localePrefix}/app/invoices/${invoiceId}`}
                    className="font-mono hover:text-foreground transition-colors"
                  >
                    {invNumber}
                  </Link>
                </>
              )}
              <ChevronRight className="size-3.5 shrink-0" />
              <span className="text-foreground">
                {mode === "create"
                  ? tf("breadcrumbNew")
                  : tf("breadcrumbEdit")}
              </span>
            </nav>
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "create" ? tf("newTitle") : tf("editTitle")}
            </h1>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {isDirty ? (
              <DiscardButton localePrefix={localePrefix} tf={tf} />
            ) : (
              <Button variant="outline" asChild>
                <Link href={`${localePrefix}/app/invoices`}>
                  {tf("actions.cancel")}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={handleSubmit((v) => onSubmit(v, "draft"))}
            >
              {createInvoice.isPending || updateInvoice.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {mode === "create"
                ? tf("actions.saveAsDraft")
                : tf("actions.saveChanges")}
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleSubmit((v) => onSubmit(v, "send"))}
            >
              {updateStatus.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {mode === "create"
                ? tf("actions.createAndSend")
                : tf("actions.saveAndSend")}
            </Button>
          </div>
        </div>
      </div>

      {/* Form body */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit((v) => onSubmit(v, "draft"))();
        }}
        className="space-y-6 pb-24 sm:pb-0"
      >
        {/* Sender */}
        <FormSection title={tf("sections.sender")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper
              label={tf("fields.senderName")}
              error={errors.senderName?.message}
            >
              <Input
                {...register("senderName")}
                placeholder="Demo GmbH"
                aria-invalid={!!errors.senderName}
              />
            </FieldWrapper>
            <div />
          </div>
          <FieldWrapper
            label={tf("fields.senderAddress")}
            error={errors.senderAddress?.message}
          >
            <Textarea
              {...register("senderAddress")}
              rows={3}
              placeholder={"Musterstraße 1\n80331 München\nDeutschland"}
              aria-invalid={!!errors.senderAddress}
            />
          </FieldWrapper>
        </FormSection>

        {/* Recipient */}
        <FormSection title={tf("sections.recipient")}>
          <FieldWrapper
            label={tf("fields.recipientName")}
            error={errors.recipientName?.message}
          >
            <Input
              {...register("recipientName")}
              placeholder="TechStart GmbH"
              aria-invalid={!!errors.recipientName}
            />
          </FieldWrapper>
          <FieldWrapper
            label={tf("fields.recipientAddress")}
            error={errors.recipientAddress?.message}
          >
            <Textarea
              {...register("recipientAddress")}
              rows={3}
              placeholder={"Leopoldstraße 1\n80802 München\nDeutschland"}
              aria-invalid={!!errors.recipientAddress}
            />
          </FieldWrapper>
        </FormSection>

        {/* Invoice details */}
        <FormSection title={tf("sections.details")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Invoice number (read-only) */}
            <FieldWrapper label={tf("fields.invoiceNumber")}>
              <Input
                value={
                  mode === "edit" && invNumber
                    ? invNumber
                    : tf("fields.invoiceNumberAuto")
                }
                readOnly
                className="text-muted-foreground bg-muted/50 cursor-not-allowed"
              />
            </FieldWrapper>

            {/* Currency */}
            <FieldWrapper label={tf("fields.currency")}>
              <Select
                defaultValue={
                  mode === "edit"
                    ? (invoice?.currency as string) ?? "EUR"
                    : "EUR"
                }
                onValueChange={(v) =>
                  setValue(
                    "currency",
                    v as InvoiceFormValues["currency"],
                    { shouldDirty: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>

            {/* Issue date */}
            <FieldWrapper
              label={tf("fields.issueDate")}
              error={errors.issueDate?.message}
            >
              <Input
                type="date"
                {...register("issueDate")}
                aria-invalid={!!errors.issueDate}
              />
            </FieldWrapper>

            {/* Tax rate */}
            <FieldWrapper label={tf("fields.taxRate")}>
              <Select
                defaultValue={String(
                  mode === "edit" ? (invoice?.taxRate ?? 0.19) : 0.19
                )}
                onValueChange={(v) =>
                  setValue("taxRate", Number(v), { shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_RATE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {tf(`taxRates.${(r * 100).toFixed(0)}` as Parameters<typeof tf>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>

            {/* Due date */}
            <FieldWrapper
              label={tf("fields.dueDate")}
              error={errors.dueDate?.message}
            >
              <Input
                type="date"
                {...register("dueDate")}
                aria-invalid={!!errors.dueDate}
              />
              {/* Quick presets */}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(
                  [
                    [tf("dueDatePresets.immediate"), TODAY],
                    [tf("dueDatePresets.14days"), IN_14],
                    [tf("dueDatePresets.30days"), IN_30],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setValue("dueDate", value, { shouldDirty: true })
                    }
                    className="rounded border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </FieldWrapper>
          </div>
        </FormSection>

        {/* Line items */}
        <FormSection title={tf("sections.lineItems")}>
          {/* Header row — desktop only */}
          <div className="hidden grid-cols-[1fr_80px_100px_120px_100px_40px] gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <span>{tf("lineItem.description")}</span>
            <span className="text-right">{tf("lineItem.quantity")}</span>
            <span>{tf("lineItem.unit")}</span>
            <span className="text-right">{tf("lineItem.unitPrice")}</span>
            <span className="text-right">{tf("lineItem.amount")}</span>
            <span />
          </div>

          <div className="space-y-2">
            {fields.map((field, index) => {
              const itemQty = Number(watchedItems?.[index]?.quantity) || 0;
              const itemPrice =
                Number(watchedItems?.[index]?.unitPrice) || 0;
              const itemAmount = itemQty * itemPrice;

              return (
                <div
                  key={field.id}
                  className={cn(
                    "rounded-lg border p-3",
                    "md:grid md:grid-cols-[1fr_80px_100px_120px_100px_40px] md:items-start md:gap-2 md:rounded-none md:border-0 md:border-b md:p-1 md:last:border-b-0"
                  )}
                >
                  {/* Description */}
                  <div className="mb-2 md:mb-0">
                    <Label className="mb-1 text-xs text-muted-foreground md:hidden">
                      {tf("lineItem.description")}
                    </Label>
                    <Input
                      {...register(`lineItems.${index}.description`)}
                      placeholder={tf("lineItem.description")}
                      aria-invalid={
                        !!errors.lineItems?.[index]?.description
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (index < fields.length - 1) {
                            const next = document.querySelector<HTMLInputElement>(
                              `input[name="lineItems.${index + 1}.description"]`
                            );
                            next?.focus();
                          } else {
                            append({
                              description: "",
                              quantity: 1,
                              unitPrice: 0,
                              unit: "h",
                            });
                            setTimeout(() => {
                              const next =
                                document.querySelector<HTMLInputElement>(
                                  `input[name="lineItems.${index + 1}.description"]`
                                );
                              next?.focus();
                            }, 50);
                          }
                        }
                      }}
                    />
                    {errors.lineItems?.[index]?.description && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.lineItems[index].description?.message}
                      </p>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="mb-2 md:mb-0">
                    <Label className="mb-1 text-xs text-muted-foreground md:hidden">
                      {tf("lineItem.quantity")}
                    </Label>
                    <Input
                      {...register(`lineItems.${index}.quantity`)}
                      type="number"
                      min="0"
                      step="0.5"
                      className="text-right tabular-nums"
                      aria-invalid={!!errors.lineItems?.[index]?.quantity}
                    />
                  </div>

                  {/* Unit */}
                  <div className="mb-2 md:mb-0">
                    <Label className="mb-1 text-xs text-muted-foreground md:hidden">
                      {tf("lineItem.unit")}
                    </Label>
                    <Select
                      defaultValue={field.unit}
                      onValueChange={(v) =>
                        setValue(
                          `lineItems.${index}.unit`,
                          v as InvoiceFormValues["lineItems"][number]["unit"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINE_ITEM_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {tf(
                              `units.${u}` as Parameters<typeof tf>[0]
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unit price */}
                  <div className="mb-2 md:mb-0">
                    <Label className="mb-1 text-xs text-muted-foreground md:hidden">
                      {tf("lineItem.unitPrice")}
                    </Label>
                    <Input
                      {...register(`lineItems.${index}.unitPrice`)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right tabular-nums"
                      aria-invalid={
                        !!errors.lineItems?.[index]?.unitPrice
                      }
                    />
                  </div>

                  {/* Amount (read-only) */}
                  <div className="mb-2 flex items-center md:mb-0 md:justify-end">
                    <Label className="mr-2 text-xs text-muted-foreground md:hidden">
                      {tf("lineItem.amount")}
                    </Label>
                    <span className="tabular-nums text-sm">
                      {formatCurrency(itemAmount)}
                    </span>
                  </div>

                  {/* Delete */}
                  <div className="flex justify-end md:justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      disabled={fields.length <= 1}
                      onClick={() => remove(index)}
                      aria-label={tf("lineItem.remove")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {errors.lineItems?.root?.message && (
            <p className="text-sm text-destructive">
              {errors.lineItems.root.message}
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full border border-dashed text-muted-foreground hover:text-foreground"
            onClick={() =>
              append({ description: "", quantity: 1, unitPrice: 0, unit: "h" })
            }
          >
            <Plus className="mr-2 size-4" />
            {tf("lineItem.addItem")}
          </Button>
        </FormSection>

        {/* Totals */}
        <FormSection title={tf("sections.totals")}>
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>{t("detail.subtotal")}</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>
                {t("detail.vat", {
                  rate: ((Number(watchedTaxRate) || 0) * 100).toFixed(0),
                })}
              </span>
              <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>{t("detail.total")}</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </FormSection>

        {/* Notes */}
        <FormSection title={tf("sections.notes")}>
          <FieldWrapper label={tf("fields.notes")}>
            <Textarea
              {...register("notes")}
              rows={3}
              placeholder="Payment due within 14 days of invoice date."
            />
          </FieldWrapper>
        </FormSection>
      </form>

      {/* Mobile sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-4 backdrop-blur sm:hidden">
        <Button
          className="w-full"
          disabled={isSubmitting}
          onClick={handleSubmit((v) => onSubmit(v, "draft"))}
        >
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {mode === "create"
            ? tf("actions.saveAsDraft")
            : tf("actions.saveChanges")}
        </Button>
      </div>
    </div>
  );
}


function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FieldWrapper({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function DiscardButton({
  localePrefix,
  tf,
}: {
  localePrefix: string;
  tf: ReturnType<typeof useTranslations<"invoices.form">>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{tf("actions.cancel")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tf("discard.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {tf("discard.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tf("discard.cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link href={`${localePrefix}/app/invoices`}>
              {tf("discard.confirm")}
            </Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  );
}
