import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceFormSchema } from "./invoice-form.ts";

// The limits mirror invoice-api's request validation (docs/api-contract.md,
// "Request limits"). Past them the API answers a bare 400 the form can't
// attach to a field — so the form has to catch them first.

const lineItem = {
  description: "Development",
  quantity: 2,
  unitPrice: 80,
  unit: "h",
  displayMode: "AsEntered",
};

const valid = {
  senderName: "Demo User",
  senderAddress: "Musterstraße 42\n80331 München",
  recipientName: "Kranich Software AG",
  recipientStreet: "Hafenstraße 1",
  recipientPostalCode: "20095",
  recipientCity: "Hamburg",
  recipientCountryCode: "DE",
  recipientEmail: "billing@example.com",
  recipientVatId: "",
  buyerReference: "",
  issueDate: "2026-10-04",
  dueDate: "2026-10-18",
  serviceMode: "date",
  serviceDate: "2026-10-01",
  servicePeriodStart: "",
  servicePeriodEnd: "",
  currency: "EUR",
  taxRate: 0.19,
  notes: "",
  lineItems: [lineItem],
};

/** Paths of the fields the schema rejects for `overrides` on a valid form. */
function rejected(overrides: Record<string, unknown>): string[] {
  const result = invoiceFormSchema.safeParse({ ...valid, ...overrides });
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

test("a form at the limits is valid", () => {
  assert.deepEqual(
    rejected({
      senderName: "a".repeat(200),
      senderAddress: "a".repeat(500),
      recipientName: "a".repeat(200),
      recipientStreet: "a".repeat(200),
      recipientPostalCode: "1".repeat(20),
      recipientCity: "a".repeat(100),
      recipientVatId: "a".repeat(20),
      buyerReference: "a".repeat(50),
      notes: "a".repeat(4000),
      lineItems: Array.from({ length: 200 }, () => ({
        ...lineItem,
        description: "a".repeat(2000),
        quantity: 1_000_000,
        unitPrice: 10_000_000,
      })),
    }),
    []
  );
});

test("text fields longer than the API accepts are rejected at the field", () => {
  for (const [field, max] of [
    ["senderName", 200],
    ["senderAddress", 500],
    ["recipientName", 200],
    ["recipientStreet", 200],
    ["recipientPostalCode", 20],
    ["recipientCity", 100],
    ["recipientVatId", 20],
    ["buyerReference", 50],
    ["notes", 4000],
  ] as const) {
    assert.deepEqual(rejected({ [field]: "a".repeat(max + 1) }), [field]);
  }
});

test("an e-mail address longer than 256 characters is rejected", () => {
  const email = `${"a".repeat(250)}@example.com`;
  assert.deepEqual(rejected({ recipientEmail: email }), ["recipientEmail"]);
});

test("more than 200 line items are rejected", () => {
  const lineItems = Array.from({ length: 201 }, () => lineItem);
  assert.deepEqual(rejected({ lineItems }), ["lineItems"]);
});

test("a line item description longer than 2000 characters is rejected", () => {
  const lineItems = [{ ...lineItem, description: "a".repeat(2001) }];
  assert.deepEqual(rejected({ lineItems }), ["lineItems.0.description"]);
});

test("quantities outside 0.001 – 1,000,000 are rejected", () => {
  assert.deepEqual(rejected({ lineItems: [{ ...lineItem, quantity: 0.0001 }] }), [
    "lineItems.0.quantity",
  ]);
  assert.deepEqual(rejected({ lineItems: [{ ...lineItem, quantity: 1_000_001 }] }), [
    "lineItems.0.quantity",
  ]);
});

test("a unit price above 10,000,000 is rejected", () => {
  assert.deepEqual(rejected({ lineItems: [{ ...lineItem, unitPrice: 10_000_001 }] }), [
    "lineItems.0.unitPrice",
  ]);
});
