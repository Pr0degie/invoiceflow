import { z } from "zod";

export const LINE_ITEM_UNITS = ["h", "flat", "piece", "day"] as const;
export const CURRENCIES = ["EUR", "USD", "CHF"] as const;
export const TAX_RATE_OPTIONS = [0, 0.07, 0.19] as const;

export type LineItemUnit = (typeof LINE_ITEM_UNITS)[number];
export type Currency = (typeof CURRENCIES)[number];

// Display-only: "FlatRate" renders the position on the invoice as
// 1 × pauschal × line total; the entered values stay stored and drive the math.
export const LINE_ITEM_DISPLAY_MODES = ["AsEntered", "FlatRate"] as const;
export type LineItemDisplayMode = (typeof LINE_ITEM_DISPLAY_MODES)[number];

export const lineItemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
  unit: z.enum(LINE_ITEM_UNITS),
  displayMode: z.enum(LINE_ITEM_DISPLAY_MODES),
});

export const invoiceFormSchema = z
  .object({
    senderName: z.string().min(1, "Required"),
    senderAddress: z.string().min(1, "Required"),
    recipientName: z.string().min(1, "Required"),
    recipientAddress: z.string().min(1, "Required"),
    issueDate: z.string().min(1, "Required"),
    dueDate: z.string().min(1, "Required"),
    // Leistungsdatum (single date) or Leistungszeitraum (period) — § 14 Abs. 4
    // Nr. 6 UStG requires one of the two before finalization.
    serviceMode: z.enum(["date", "period"]),
    serviceDate: z.string(),
    servicePeriodStart: z.string(),
    servicePeriodEnd: z.string(),
    currency: z.enum(CURRENCIES),
    taxRate: z.coerce.number().min(0).max(1),
    notes: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .superRefine((values, ctx) => {
    if (values.serviceMode === "date") {
      if (!values.serviceDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["serviceDate"],
          message: "Required",
        });
      }
      return;
    }
    if (!values.servicePeriodStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["servicePeriodStart"],
        message: "Required",
      });
    }
    if (!values.servicePeriodEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["servicePeriodEnd"],
        message: "Required",
      });
    }
    if (
      values.servicePeriodStart &&
      values.servicePeriodEnd &&
      values.servicePeriodEnd < values.servicePeriodStart
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["servicePeriodEnd"],
        message: "beforeStart",
      });
    }
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
