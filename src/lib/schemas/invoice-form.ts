import { z } from "zod";

export const LINE_ITEM_UNITS = ["h", "flat", "piece", "day"] as const;
export const CURRENCIES = ["EUR", "USD", "CHF"] as const;
export const TAX_RATE_OPTIONS = [0, 0.07, 0.19] as const;

export type LineItemUnit = (typeof LINE_ITEM_UNITS)[number];
export type Currency = (typeof CURRENCIES)[number];

export const lineItemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  unitPrice: z.coerce.number().min(0, "Must be ≥ 0"),
  unit: z.enum(LINE_ITEM_UNITS),
});

export const invoiceFormSchema = z.object({
  senderName: z.string().min(1, "Required"),
  senderAddress: z.string().min(1, "Required"),
  recipientName: z.string().min(1, "Required"),
  recipientAddress: z.string().min(1, "Required"),
  issueDate: z.string().min(1, "Required"),
  dueDate: z.string().min(1, "Required"),
  currency: z.enum(CURRENCIES),
  taxRate: z.coerce.number().min(0).max(1),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
