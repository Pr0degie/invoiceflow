import { test } from "node:test";
import assert from "node:assert/strict";
import { findOverlaps, type InvoiceRow } from "../src/overlap.ts";

const inv = (o: Partial<InvoiceRow>): InvoiceRow => ({
  id: "a", number: "2026-001", status: "Finalized", type: "Invoice", recipientName: "Acme GmbH",
  serviceDate: null, servicePeriodStart: null, servicePeriodEnd: null, ...o,
});
const find = (rows: InvoiceRow[], ignoreId?: string) => findOverlaps(rows, "Acme GmbH", "2026-07-06", "2026-08-02", ignoreId);

test("detects an overlapping service period", () => {
  assert.equal(find([inv({ servicePeriodStart: "2026-07-01", servicePeriodEnd: "2026-07-06" })]).length, 1);
});

test("adjacent periods do not overlap", () => {
  assert.equal(find([inv({ servicePeriodStart: "2026-06-01", servicePeriodEnd: "2026-07-05" })]).length, 0);
});

test("a single service date inside the period overlaps", () => {
  assert.equal(find([inv({ serviceDate: "2026-07-20" })]).length, 1);
});

test("recipient match ignores case and surrounding whitespace (review focus)", () => {
  assert.equal(find([inv({ recipientName: "  acme gmbh ", serviceDate: "2026-07-20" })]).length, 1);
});

test("drafts count as overlaps", () => {
  assert.equal(find([inv({ status: "Draft", number: null, serviceDate: "2026-07-20" })]).length, 1);
});

test("ignores cancelled, storno, other recipients, undated and the invoice being updated", () => {
  const rows = [
    inv({ id: "c", status: "Cancelled", serviceDate: "2026-07-20" }),
    inv({ id: "s", type: "Cancellation", serviceDate: "2026-07-20" }),
    inv({ id: "o", recipientName: "Other AG", serviceDate: "2026-07-20" }),
    inv({ id: "u" }),
    inv({ id: "self", status: "Draft", serviceDate: "2026-07-20" }),
  ];
  assert.equal(find(rows, "self").length, 0);
});
