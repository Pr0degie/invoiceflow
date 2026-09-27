import { test } from "node:test";
import assert from "node:assert/strict";
import { InvoiceFlowClient } from "../src/invoiceflow.ts";

const enabled = process.env.INVOICEFLOW_IT === "1";

test("draft round-trip against the local invoice-api (demo account)", { skip: enabled ? false : "set INVOICEFLOW_IT=1 with invoice-api running" }, async () => {
  const client = new InvoiceFlowClient({
    apiUrl: process.env.INVOICEFLOW_API_URL ?? "http://localhost:8080",
    email: process.env.INVOICEFLOW_IT_EMAIL ?? "demo@invoiceflow.app",
    password: process.env.INVOICEFLOW_IT_PASSWORD ?? "DemoPass123!",
  });
  const created = await client.createInvoice({
    senderName: "IT Sender",
    senderAddress: "Teststraße 1\n12345 Teststadt",
    recipientName: "IT Recipient",
    issueDate: "2026-09-27",
    dueDate: "2026-10-11",
    servicePeriodStart: "2026-07-06",
    servicePeriodEnd: "2026-07-12",
    taxRate: 0,
    lineItems: [{ description: "ABC-1 Test (3 h 41 min)", quantity: 3.68, unit: "h", unitPrice: 100, displayMode: "AsEntered" }],
  });
  try {
    const back = await client.getInvoice(created.id!);
    assert.equal(back.status, "Draft");
    const li = back.lineItems![0];
    assert.equal(li.quantity, 3.68);
    assert.equal(li.unit, "h");
    assert.equal(li.displayMode, "AsEntered");
    assert.equal(li.total, 368);
    const pdf = await client.getPdf(created.id!);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), "%PDF");
  } finally {
    await client.deleteInvoice(created.id!);
  }
});
