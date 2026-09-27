import { test } from "node:test";
import assert from "node:assert/strict";
import { saveDraft, type DraftDeps, type DraftInput } from "../src/draft.ts";
import type { Invoice, InvoiceRequest, Profile } from "../src/invoiceflow.ts";
import type { Worklog } from "../src/worklogs.ts";

const w = (id: number, issueId: number, date: string, seconds: number): Worklog => ({ id, issueId, date, seconds, description: "" });

const PROFILE: Profile = {
  name: "Max Muster", defaultSenderName: "Max Muster", defaultSenderAddress: "Weg 1\n12345 Ort", isSmallBusiness: true,
  street: "Weg 1", postalCode: "12345", city: "Ort", country: "DE", phone: "0123", taxNumber: "111/222/33333", iban: "DE89370400440532013000",
};
const LOGS = [w(1, 10, "2026-07-06", 13260), w(2, 11, "2026-07-07", 4500)];
const INPUT: DraftInput = {
  from: "2026-07-06",
  to: "2026-07-19",
  recipient: { name: "Acme GmbH", street: "Hauptstraße 1", postalCode: "10115", city: "Berlin", countryCode: "DE", email: "rechnung@acme.example" },
  positions: [
    { issueIds: [10], description: "ABC-1 Feature", unitPrice: 100 },
    { issueIds: [11], description: "ABC-2 Abstimmungstermine", unitPrice: 80 },
  ],
};

function fakes(opts: { worklogs?: Worklog[]; invoices?: Invoice[]; profile?: Profile } = {}) {
  const calls = { tempo: [] as [string, string][], created: [] as InvoiceRequest[], updated: [] as [string, InvoiceRequest][] };
  const toInvoice = (body: InvoiceRequest, id: string): Invoice => {
    const lineItems = body.lineItems.map((li) => ({ ...li, total: Math.round((li.quantity ?? 0) * (li.unitPrice ?? 0) * 100) / 100 }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
    return { id, status: "Draft", lineItems, subtotal, total: subtotal };
  };
  const deps: DraftDeps = {
    tempo: { getWorklogs: async (from, to) => { calls.tempo.push([from, to]); return opts.worklogs ?? LOGS; } },
    invoiceflow: {
      getProfile: async () => opts.profile ?? PROFILE,
      listInvoices: async () => opts.invoices ?? [],
      createInvoice: async (body) => { calls.created.push(body); return toInvoice(body, "new-id"); },
      updateInvoice: async (id, body) => { calls.updated.push([id, body]); return toInvoice(body, id); },
    },
    weeklyCapHours: 10,
    today: () => "2026-09-27",
  };
  return { deps, calls };
}

test("creates a § 19 hourly draft from Tempo hours", async () => {
  const { deps, calls } = fakes();
  const result = await saveDraft(deps, INPUT);
  const body = calls.created[0];
  assert.equal(body.senderName, "Max Muster");
  assert.equal(body.senderAddress, "Weg 1\n12345 Ort");
  assert.equal(body.recipientName, "Acme GmbH");
  assert.equal(body.recipientEmail, "rechnung@acme.example");
  assert.equal(body.taxRate, 0);
  assert.equal(body.issueDate, "2026-09-27");
  assert.equal(body.dueDate, "2026-10-11");
  assert.equal(body.servicePeriodStart, "2026-07-06");
  assert.equal(body.servicePeriodEnd, "2026-07-19");
  assert.deepEqual(body.lineItems, [
    { description: "ABC-1 Feature (3 h 41 min)", quantity: 3.68, unit: "h", unitPrice: 100, displayMode: "AsEntered" },
    { description: "ABC-2 Abstimmungstermine (1 h 15 min)", quantity: 1.25, unit: "h", unitPrice: 80, displayMode: "AsEntered" },
  ]);
  assert.equal(result.invoiceId, "new-id");
  assert.deepEqual(result.positions.map((p) => p.total), [368, 100]);
  assert.equal(result.total, 468);
  assert.deepEqual(result.warnings, []);
});

test("charges 19 % VAT when the profile is not a small business", async () => {
  const { deps, calls } = fakes({ profile: { ...PROFILE, isSmallBusiness: false } });
  await saveDraft(deps, INPUT);
  assert.equal(calls.created[0].taxRate, 0.19);
});

test("fetches whole ISO weeks but bills only the period", async () => {
  const { deps, calls } = fakes({ worklogs: [w(1, 99, "2026-07-06", 3600), w(2, 10, "2026-07-08", 3600)] });
  await saveDraft(deps, { ...INPUT, from: "2026-07-08", to: "2026-07-15", positions: [{ issueIds: [10], description: "ABC-1", unitPrice: 100 }] });
  assert.deepEqual(calls.tempo, [["2026-07-06", "2026-07-19"]]);
  assert.equal(calls.created[0].lineItems.length, 1);
  assert.equal(calls.created[0].lineItems[0].quantity, 1);
});

test("rejects from after to before calling anything", async () => {
  const { deps, calls } = fakes();
  await assert.rejects(saveDraft(deps, { ...INPUT, from: "2026-07-20" }), { name: "PeriodError" });
  assert.equal(calls.tempo.length, 0);
});

test("blocks an overlapping invoice unless allowOverlap", async () => {
  const existing: Invoice = { id: "old", number: "2026-002", status: "Finalized", type: "Invoice", recipientName: "Acme GmbH", servicePeriodStart: "2026-07-01", servicePeriodEnd: "2026-07-10" };
  const { deps } = fakes({ invoices: [existing] });
  await assert.rejects(saveDraft(deps, INPUT), { name: "ValidationError", message: /2026-002/ });
  await assert.doesNotReject(saveDraft(deps, { ...INPUT, allowOverlap: true }));
});

test("update ignores the invoice being updated in the overlap check", async () => {
  const self: Invoice = { id: "draft-1", number: null, status: "Draft", type: "Invoice", recipientName: "Acme GmbH", servicePeriodStart: "2026-07-06", servicePeriodEnd: "2026-07-19" };
  const { deps, calls } = fakes({ invoices: [self] });
  const result = await saveDraft(deps, INPUT, "draft-1");
  assert.equal(calls.updated[0][0], "draft-1");
  assert.equal(result.invoiceId, "draft-1");
});

test("warns about cap, profile gaps and missing recipient e-mail", async () => {
  const { deps } = fakes({
    worklogs: [w(1, 10, "2026-07-06", 11 * 3600)],
    profile: { ...PROFILE, taxNumber: null, iban: null },
  });
  const { email: _omit, ...recipient } = INPUT.recipient;
  const result = await saveDraft(deps, { ...INPUT, recipient, positions: [{ issueIds: [10], description: "ABC-1", unitPrice: 100 }] });
  assert.deepEqual(result.warnings, [
    "Week of 2026-07-06: 11 h logged — above the 10 h weekly cap.",
    "Profile field missing for finalization: taxNumber or vatId",
    "Profile field recommended: iban",
    "Recipient e-mail missing — required to finalize (E-Rechnung BT-49).",
  ]);
});

test("reports excluded hours in the result and a warning (review focus)", async () => {
  const { deps } = fakes({ worklogs: [...LOGS, w(3, 12, "2026-07-08", 5400)] });
  const result = await saveDraft(deps, { ...INPUT, exclude: [{ issueIds: [12], reason: "billed separately" }] });
  assert.deepEqual(result.excluded, [{ issueIds: [12], seconds: 5400, hours: 1.5, reason: "billed separately" }]);
  assert.ok(result.warnings.includes("Not billed: issues 12 — 1.5 h (billed separately)."));
});

test("warns when an exclude entry has no logged time in the period", async () => {
  const { deps } = fakes();
  const result = await saveDraft(deps, { ...INPUT, exclude: [{ issueIds: [77], reason: "not started yet" }] });
  assert.deepEqual(result.excluded, [{ issueIds: [77], seconds: 0, hours: 0, reason: "not started yet" }]);
  assert.ok(result.warnings.includes("Exclude has no logged time in the period: issues 77 (not started yet)."));
});

test("refuses to draft without a sender address in the profile", async () => {
  const { deps } = fakes({ profile: { ...PROFILE, defaultSenderAddress: null } });
  await assert.rejects(saveDraft(deps, INPUT), { name: "ValidationError", message: /sender name\/address/ });
});
