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

// Upper limits mirror invoice-api's request validation (docs/api-contract.md,
// "Request limits"). Beyond them the API answers a 400 the form can't attach
// to a field, so they are caught here first.
const text = (max: number) => z.string().max(max, `Max. ${max} characters`);
const required = (max: number) => text(max).min(1, "Required");

export const lineItemSchema = z.object({
  description: required(2000),
  quantity: z.coerce
    .number()
    .positive("Must be > 0")
    .min(0.001, "Must be ≥ 0.001")
    .max(1_000_000, "Must be ≤ 1,000,000"),
  unitPrice: z.coerce
    .number()
    .min(0, "Must be ≥ 0")
    .max(10_000_000, "Must be ≤ 10,000,000"),
  unit: z.enum(LINE_ITEM_UNITS),
  displayMode: z.enum(LINE_ITEM_DISPLAY_MODES),
});

export const invoiceFormSchema = z
  .object({
    senderName: required(200),
    senderAddress: required(500),
    recipientName: required(200),
    // Structured recipient (buyer) data — required for the E-Rechnung (XRechnung).
    recipientStreet: required(200),
    recipientPostalCode: required(20),
    recipientCity: required(100),
    recipientCountryCode: required(2),
    recipientEmail: required(256).email("Invalid email"),
    recipientVatId: text(20).optional(),
    buyerReference: text(50).optional(),
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
    notes: text(4000).optional(),
    lineItems: z
      .array(lineItemSchema)
      .min(1, "Add at least one line item")
      .max(200, "Max. 200 line items"),
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
