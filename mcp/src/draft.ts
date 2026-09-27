import { addDays, secondsToQuantity } from "./format.ts";
import type { InvoiceFlowClient, InvoiceRequest } from "./invoiceflow.ts";
import { findOverlaps } from "./overlap.ts";
import { buildLineItems, ValidationError, type ExcludeInput, type PositionInput } from "./positions.ts";
import { missingForFinalize, recommended } from "./profile.ts";
import type { TempoClient } from "./tempo.ts";
import { assertPeriod, summarize, weekRange } from "./worklogs.ts";

export interface Recipient {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
  email?: string;
  vatId?: string;
  buyerReference?: string;
}

export interface DraftInput {
  from: string;
  to: string;
  recipient: Recipient;
  positions: PositionInput[];
  exclude?: ExcludeInput[];
  dueInDays?: number;
  notes?: string;
  allowOverlap?: boolean;
}

export interface DraftDeps {
  invoiceflow: Pick<InvoiceFlowClient, "getProfile" | "listInvoices" | "createInvoice" | "updateInvoice">;
  tempo: Pick<TempoClient, "getWorklogs">;
  weeklyCapHours?: number;
  today: () => string;
}

export interface DraftResult {
  invoiceId: string;
  status: string;
  positions: { description: string; hours: number; unitPrice: number; total: number }[];
  subtotal: number;
  total: number;
  excluded: { issueIds: number[]; seconds: number; hours: number; reason: string }[];
  warnings: string[];
}

/** Create (or, with existingId, replace) a draft whose hours come straight from Tempo. */
export async function saveDraft(deps: DraftDeps, input: DraftInput, existingId?: string): Promise<DraftResult> {
  assertPeriod(input.from, input.to);

  // Re-fetch instead of trusting numbers from the model; whole weeks for the cap check.
  const range = weekRange(input.from, input.to);
  const summary = summarize(await deps.tempo.getWorklogs(range.from, range.to), input.from, input.to, deps.weeklyCapHours);
  const items = buildLineItems(summary.worklogs, input.positions, input.exclude);

  if (!input.allowOverlap) {
    const clashes = findOverlaps(await deps.invoiceflow.listInvoices(), input.recipient.name, input.from, input.to, existingId);
    if (clashes.length > 0) {
      const list = clashes
        .map((c) => `${c.number ?? `draft ${c.id}`} (${c.servicePeriodStart ?? c.serviceDate} – ${c.servicePeriodEnd ?? c.serviceDate})`)
        .join(", ");
      throw new ValidationError(`Period overlaps existing invoice(s) to ${input.recipient.name}: ${list}. Pass allowOverlap: true only if this is intentional.`);
    }
  }

  const profile = await deps.invoiceflow.getProfile();
  const senderName = profile.defaultSenderName?.trim() || profile.name?.trim() || "";
  const senderAddress = profile.defaultSenderAddress?.trim() || "";
  if (!senderName || !senderAddress) {
    throw new ValidationError("Profile has no default sender name/address — fill them in InvoiceFlow → Settings first.");
  }

  const today = deps.today();
  const r = input.recipient;
  const body: InvoiceRequest = {
    senderName,
    senderAddress,
    recipientName: r.name,
    recipientStreet: r.street,
    recipientPostalCode: r.postalCode,
    recipientCity: r.city,
    recipientCountryCode: r.countryCode,
    recipientEmail: r.email ?? null,
    recipientVatId: r.vatId ?? null,
    buyerReference: r.buyerReference ?? null,
    issueDate: today,
    dueDate: addDays(today, input.dueInDays ?? 14),
    servicePeriodStart: input.from,
    servicePeriodEnd: input.to,
    taxRate: profile.isSmallBusiness ? 0 : 0.19,
    currency: "EUR",
    notes: input.notes ?? null,
    lineItems: items.map(({ description, quantity, unit, unitPrice, displayMode }) => ({ description, quantity, unit, unitPrice, displayMode })),
  };

  const invoice = existingId ? await deps.invoiceflow.updateInvoice(existingId, body) : await deps.invoiceflow.createInvoice(body);

  const excluded = (input.exclude ?? []).map((ex) => {
    const seconds = summary.worklogs
      .filter((w) => ex.issueIds.includes(w.issueId))
      .reduce((sum, w) => sum + w.seconds, 0);
    return { issueIds: ex.issueIds, seconds, hours: secondsToQuantity(seconds), reason: ex.reason };
  });

  const warnings = [
    ...summary.byWeek
      .filter((wk) => wk.overCap)
      .map((wk) => `Week of ${wk.weekStart}: ${wk.hours} h logged — above the ${deps.weeklyCapHours} h weekly cap${wk.extendsOutsidePeriod ? " (week extends outside this period)" : ""}.`),
    ...excluded.map((ex) =>
      ex.seconds > 0
        ? `Not billed: issues ${ex.issueIds.join(", ")} — ${ex.hours} h (${ex.reason}).`
        : `Exclude has no logged time in the period: issues ${ex.issueIds.join(", ")} (${ex.reason}).`,
    ),
    ...missingForFinalize(profile).map((f) => `Profile field missing for finalization: ${f}`),
    ...recommended(profile).map((f) => `Profile field recommended: ${f}`),
    ...(r.email ? [] : ["Recipient e-mail missing — required to finalize (E-Rechnung BT-49)."]),
  ];

  return {
    invoiceId: invoice.id ?? existingId ?? "",
    status: invoice.status ?? "Draft",
    positions: (invoice.lineItems ?? []).map((li) => ({
      description: li.description ?? "",
      hours: li.quantity ?? 0,
      unitPrice: li.unitPrice ?? 0,
      total: li.total ?? 0,
    })),
    subtotal: invoice.subtotal ?? 0,
    total: invoice.total ?? 0,
    excluded,
    warnings,
  };
}
