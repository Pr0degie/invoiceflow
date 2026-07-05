"use client";

import { useEffect, useCallback, useState } from "react";
import { useForm, useFieldArray, useWatch, type Resolver } from "react-hook-form";
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
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  invoiceFormSchema,
  type InvoiceFormValues,
  LINE_ITEM_UNITS,
  LINE_ITEM_DISPLAY_MODES,
  CURRENCIES,
  TAX_RATE_OPTIONS,
} from "@/lib/schemas/invoice-form";
import {
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useFinalizeInvoice,
} from "@/lib/api/hooks/useInvoices";
import { useMe } from "@/lib/api/hooks/useMe";
import { isTaxProfileComplete } from "@/lib/tax-profile";
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
    recipientStreet: "",
    recipientPostalCode: "",
    recipientCity: "",
    recipientCountryCode: "DE",
    recipientEmail: "",
    recipientVatId: "",
    buyerReference: "",
    issueDate: TODAY,
    dueDate: IN_14,
    serviceMode: "date",
    serviceDate: TODAY,
    servicePeriodStart: "",
    servicePeriodEnd: "",
    currency: "EUR",
    taxRate: 0.19,
    notes: "",
    lineItems: [
      { description: "", quantity: 1, unitPrice: 0, unit: "h", displayMode: "AsEntered" },
    ],
  };
}

function mapInvoiceToForm(invoice: Invoice): InvoiceFormValues {
  return {
    senderName: invoice.senderName ?? "",
    senderAddress: invoice.senderAddress ?? "",
    recipientName: invoice.recipientName ?? "",
    recipientStreet: invoice.recipientStreet ?? "",
    recipientPostalCode: invoice.recipientPostalCode ?? "",
    recipientCity: invoice.recipientCity ?? "",
    recipientCountryCode: invoice.recipientCountryCode ?? "DE",
    recipientEmail: invoice.recipientEmail ?? "",
    recipientVatId: invoice.recipientVatId ?? "",
    buyerReference: invoice.buyerReference ?? "",
    issueDate: invoice.issueDate ?? TODAY,
    dueDate: invoice.dueDate ?? IN_14,
    serviceMode: invoice.servicePeriodStart ? "period" : "date",
    serviceDate: invoice.serviceDate ?? (invoice.servicePeriodStart ? "" : TODAY),
    servicePeriodStart: invoice.servicePeriodStart ?? "",
    servicePeriodEnd: invoice.servicePeriodEnd ?? "",
    currency:
      (invoice.currency as InvoiceFormValues["currency"]) ?? "EUR",
    taxRate: invoice.taxRate ?? 0.19,
    notes: invoice.notes ?? "",
    lineItems: (invoice.lineItems ?? []).map((item) => ({
      description: item.description ?? "",
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      unit: (item.unit as InvoiceFormValues["lineItems"][number]["unit"]) ?? "h",
      displayMode:
        (item.displayMode as InvoiceFormValues["lineItems"][number]["displayMode"]) ??
        "AsEntered",
    })),
  };
}

function mapFormToApi(values: InvoiceFormValues, isSmallBusiness: boolean) {
  return {
    senderName: values.senderName,
    senderAddress: values.senderAddress,
    recipientName: values.recipientName,
    recipientStreet: values.recipientStreet,
    recipientPostalCode: values.recipientPostalCode,
    recipientCity: values.recipientCity,
    recipientCountryCode: values.recipientCountryCode || "DE",
    recipientEmail: values.recipientEmail,
    recipientVatId: values.recipientVatId || null,
    buyerReference: values.buyerReference || null,
    issueDate: values.issueDate || null,
    dueDate: values.dueDate || null,
    serviceDate: values.serviceMode === "date" ? values.serviceDate || null : null,
    servicePeriodStart:
      values.serviceMode === "period" ? values.servicePeriodStart || null : null,
    servicePeriodEnd:
      values.serviceMode === "period" ? values.servicePeriodEnd || null : null,
    currency: values.currency,
    // § 19 UStG: Kleinunternehmer invoices never carry VAT
    taxRate: isSmallBusiness ? 0 : Number(values.taxRate),
    notes: values.notes || null,
    lineItems: values.lineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      unit: item.unit,
      displayMode: item.displayMode,
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
  const finalizeInvoice = useFinalizeInvoice();

  const { data: me } = useMe();
  const isSmallBusiness = me?.isSmallBusiness ?? false;
  const profileComplete = isTaxProfileComplete(me);

  // Values validated by "Save & finalize" and awaiting dialog confirmation
  const [pendingFinalize, setPendingFinalize] = useState<InvoiceFormValues | null>(null);

  const isSubmitting =
    createInvoice.isPending ||
    updateInvoice.isPending ||
    finalizeInvoice.isPending;

  const form = useForm<InvoiceFormValues>({
    // zodResolver's inferred generics diverge from InvoiceFormValues under
    // Zod 4 (z.coerce splits input/output types); the runtime output matches.
    resolver: zodResolver(invoiceFormSchema) as unknown as Resolver<InvoiceFormValues>,
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

  const { fields, append, remove, move } = useFieldArray({
    name: "lineItems",
    control,
  });

  // Drag & drop reordering — the array order IS the position on the invoice
  // (the API stamps Position from the array index, see docs/api-contract.md).
  // Drag starts only from the grip handle, so the row's inputs stay usable.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // scrollBehavior "auto": the default smooth scroll races the sensor's rect
    // measurements — on a scrolled page arrow-key moves land half a row off.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      scrollBehavior: "auto",
    })
  );

  function handleLineItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from !== -1 && to !== -1) move(from, to);
  }

  // Live totals
  const watchedItems = useWatch({ control, name: "lineItems" });
  const watchedTaxRate = useWatch({ control, name: "taxRate" });
  const serviceMode = useWatch({ control, name: "serviceMode" });
  const subtotal = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);
  const taxAmount = isSmallBusiness ? 0 : subtotal * (Number(watchedTaxRate) || 0);
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
    async (values: InvoiceFormValues, intent: "draft" | "finalize") => {
      const apiData = mapFormToApi(values, isSmallBusiness);

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

        if (intent === "finalize") {
          // No issueDate override: the server stamps today as Ausstellungsdatum
          const finalized = await finalizeInvoice.mutateAsync({ id: created.id! });
          toast.success(tf("success.finalized", { number: finalized.number ?? "" }));
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
    [mode, invoice, isSmallBusiness, createInvoice, updateInvoice, finalizeInvoice, router, localePrefix, tf]
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
              disabled={isSubmitting || !profileComplete}
              onClick={handleSubmit((v) => setPendingFinalize(v))}
            >
              {finalizeInvoice.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {tf("actions.saveAndFinalize")}
            </Button>
          </div>
        </div>
        {!profileComplete && (
          <div className="mx-auto mt-2 max-w-4xl text-xs text-amber-700 dark:text-amber-400">
            {tf("finalize.profileIncomplete")}{" "}
            <Link
              href={`${localePrefix}/app/settings?tab=tax`}
              className="font-medium underline underline-offset-2"
            >
              {tf("finalize.goToSettings")}
            </Link>
          </div>
        )}
      </div>

      {/* Finalize confirmation — after this the invoice is immutable */}
      <AlertDialog
        open={!!pendingFinalize}
        onOpenChange={(open) => !open && setPendingFinalize(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tf("finalize.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tf("finalize.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tf("finalize.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const values = pendingFinalize;
                setPendingFinalize(null);
                if (values) onSubmit(values, "finalize");
              }}
            >
              {tf("finalize.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            label={tf("fields.recipientStreet")}
            error={errors.recipientStreet?.message}
          >
            <Input
              {...register("recipientStreet")}
              placeholder="Leopoldstraße 1"
              aria-invalid={!!errors.recipientStreet}
            />
          </FieldWrapper>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <FieldWrapper
              label={tf("fields.recipientPostalCode")}
              error={errors.recipientPostalCode?.message}
            >
              <Input
                {...register("recipientPostalCode")}
                placeholder="80802"
                aria-invalid={!!errors.recipientPostalCode}
              />
            </FieldWrapper>
            <FieldWrapper
              label={tf("fields.recipientCity")}
              error={errors.recipientCity?.message}
            >
              <Input
                {...register("recipientCity")}
                placeholder="München"
                aria-invalid={!!errors.recipientCity}
              />
            </FieldWrapper>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper
              label={tf("fields.recipientCountryCode")}
              error={errors.recipientCountryCode?.message}
            >
              <Input
                {...register("recipientCountryCode")}
                placeholder="DE"
                aria-invalid={!!errors.recipientCountryCode}
              />
            </FieldWrapper>
            <FieldWrapper
              label={tf("fields.recipientEmail")}
              error={errors.recipientEmail?.message}
            >
              <Input
                type="email"
                {...register("recipientEmail")}
                placeholder="rechnung@techstart.de"
                aria-invalid={!!errors.recipientEmail}
              />
            </FieldWrapper>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldWrapper
              label={tf("fields.recipientVatId")}
              error={errors.recipientVatId?.message}
            >
              <Input
                {...register("recipientVatId")}
                placeholder="DE123456789"
                aria-invalid={!!errors.recipientVatId}
              />
            </FieldWrapper>
            <FieldWrapper
              label={tf("fields.buyerReference")}
              error={errors.buyerReference?.message}
            >
              <>
                <Input
                  {...register("buyerReference")}
                  placeholder="PO-4711"
                  aria-invalid={!!errors.buyerReference}
                />
                <p className="text-muted-foreground text-xs">
                  {tf("fields.buyerReferenceHint")}
                </p>
              </>
            </FieldWrapper>
          </div>
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

            {/* Tax rate — hidden for Kleinunternehmer (§ 19 UStG: always 0%) */}
            {isSmallBusiness ? (
              <FieldWrapper label={tf("fields.taxRate")}>
                <div className="flex min-h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                  {tf("smallBusinessTaxNote")}
                </div>
              </FieldWrapper>
            ) : (
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
            )}

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

          {/* Leistungsdatum / Leistungszeitraum — Pflichtangabe (§ 14 Abs. 4 UStG) */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm">{tf("fields.servicePerformed")}</Label>
              <div className="inline-flex rounded-md border p-0.5">
                {(["date", "period"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setValue("serviceMode", m, { shouldDirty: true })
                    }
                    className={cn(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      serviceMode === m
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "date"
                      ? tf("fields.serviceModeDate")
                      : tf("fields.serviceModePeriod")}
                  </button>
                ))}
              </div>
            </div>

            {serviceMode === "date" ? (
              <FieldWrapper
                label={tf("fields.serviceDate")}
                error={errors.serviceDate?.message}
              >
                <Input
                  type="date"
                  {...register("serviceDate")}
                  aria-invalid={!!errors.serviceDate}
                />
              </FieldWrapper>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrapper
                  label={tf("fields.servicePeriodStart")}
                  error={errors.servicePeriodStart?.message}
                >
                  <Input
                    type="date"
                    {...register("servicePeriodStart")}
                    aria-invalid={!!errors.servicePeriodStart}
                  />
                </FieldWrapper>
                <FieldWrapper
                  label={tf("fields.servicePeriodEnd")}
                  error={
                    errors.servicePeriodEnd?.message === "beforeStart"
                      ? tf("errors.periodEndBeforeStart")
                      : errors.servicePeriodEnd?.message
                  }
                >
                  <Input
                    type="date"
                    {...register("servicePeriodEnd")}
                    aria-invalid={!!errors.servicePeriodEnd}
                  />
                </FieldWrapper>
              </div>
            )}
          </div>
        </FormSection>

        {/* Line items */}
        <FormSection title={tf("sections.lineItems")}>
          {/* Header row — desktop only */}
          <div className="hidden grid-cols-[24px_1fr_70px_90px_105px_90px_130px_40px] gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <span />
            <span>{tf("lineItem.description")}</span>
            <span className="text-right">{tf("lineItem.quantity")}</span>
            <span>{tf("lineItem.unit")}</span>
            <span className="text-right">{tf("lineItem.unitPrice")}</span>
            <span className="text-right">{tf("lineItem.amount")}</span>
            <span>{tf("lineItem.displayMode")}</span>
            <span />
          </div>

          <DndContext
            id="line-items"
            sensors={dndSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleLineItemDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
          <div className="space-y-2">
            {fields.map((field, index) => {
              const itemQty = Number(watchedItems?.[index]?.quantity) || 0;
              const itemPrice =
                Number(watchedItems?.[index]?.unitPrice) || 0;
              const itemAmount = itemQty * itemPrice;

              return (
                <SortableLineItemRow
                  key={field.id}
                  id={field.id}
                  handleLabel={tf("lineItem.reorder")}
                  dragDisabled={fields.length <= 1}
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
                              displayMode: "AsEntered",
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

                  {/* Display mode — FlatRate renders 1 × pauschal × line total on the invoice */}
                  <div className="mb-2 md:mb-0">
                    <Label className="mb-1 text-xs text-muted-foreground md:hidden">
                      {tf("lineItem.displayMode")}
                    </Label>
                    <Select
                      defaultValue={field.displayMode}
                      onValueChange={(v) =>
                        setValue(
                          `lineItems.${index}.displayMode`,
                          v as InvoiceFormValues["lineItems"][number]["displayMode"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINE_ITEM_DISPLAY_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {tf(`displayModes.${m}` as Parameters<typeof tf>[0])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                </SortableLineItemRow>
              );
            })}
          </div>
            </SortableContext>
          </DndContext>

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
              append({
                description: "",
                quantity: 1,
                unitPrice: 0,
                unit: "h",
                displayMode: "AsEntered",
              })
            }
          >
            <Plus className="mr-2 size-4" />
            {tf("lineItem.addItem")}
          </Button>
        </FormSection>

        {/* Totals */}
        <FormSection title={tf("sections.totals")}>
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
            {!isSmallBusiness && (
              <>
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
              </>
            )}
            <div className="flex justify-between font-semibold">
              <span>{t("detail.total")}</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
            {isSmallBusiness && (
              <p className="text-xs text-muted-foreground">
                {tf("smallBusinessHint")}
              </p>
            )}
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


/**
 * One draggable line-item row. Mobile: card with a full-height grip strip on
 * the left. Desktop: the wrapper dissolves (`md:contents`) so the field cells
 * join the surrounding grid — same column template as the header row.
 */
function SortableLineItemRow({
  id,
  handleLabel,
  dragDisabled,
  children,
}: {
  id: string;
  handleLabel: string;
  dragDisabled: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: dragDisabled });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex gap-2 rounded-lg border p-3",
        "md:grid md:grid-cols-[24px_1fr_70px_90px_105px_90px_130px_40px] md:items-start md:gap-2 md:rounded-none md:border-0 md:border-b md:p-1 md:last:border-b-0",
        isDragging &&
          "relative z-10 bg-background shadow-lg md:rounded-lg md:border md:border-b"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        disabled={dragDisabled}
        className={cn(
          "flex touch-none items-center justify-center self-stretch rounded text-muted-foreground/50 transition-colors md:h-9 md:self-auto",
          dragDisabled
            ? "cursor-default opacity-40"
            : "cursor-grab hover:text-foreground active:cursor-grabbing"
        )}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1 md:contents">{children}</div>
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
