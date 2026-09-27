import { test } from "node:test";
import assert from "node:assert/strict";
import { InvoiceFlowClient } from "../src/invoiceflow.ts";

const cfg = { apiUrl: "http://api.test/", email: "me@example.com", password: "pw" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fake(responses: Array<Response | Error>) {
  const requests: { method: string; url: string; auth?: string; body?: unknown }[] = [];
  const fn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    requests.push({ method: init.method ?? "GET", url: String(url), auth: headers.Authorization, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request ${String(url)}`);
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fn, requests };
}

test("logs in once and reuses the token", async () => {
  const { fn, requests } = fake([json({ token: "T1" }), json({ name: "A" }), json({ name: "A" })]);
  const client = new InvoiceFlowClient(cfg, fn);
  await client.getProfile();
  await client.getProfile();
  assert.deepEqual(requests.map((r) => `${r.method} ${r.url} ${r.auth ?? "-"}`), [
    "POST http://api.test/api/auth/login -",
    "GET http://api.test/api/auth/me Bearer T1",
    "GET http://api.test/api/auth/me Bearer T1",
  ]);
  assert.deepEqual(requests[0].body, { email: "me@example.com", password: "pw" });
});

test("two concurrent first calls share one in-flight login (review focus)", async () => {
  const { fn, requests } = fake([json({ token: "T1" }), json({ name: "A" }), json({ name: "B" })]);
  const client = new InvoiceFlowClient(cfg, fn);
  const [p1, p2] = await Promise.all([client.getProfile(), client.getProfile()]);
  assert.equal(p1.name, "A");
  assert.equal(p2.name, "B");
  const logins = requests.filter((r) => r.url === "http://api.test/api/auth/login");
  assert.equal(logins.length, 1);
});

test("re-logs in once when the token expired", async () => {
  const { fn, requests } = fake([json({ token: "T1" }), json({}, 401), json({ token: "T2" }), json({ name: "A" })]);
  const profile = await new InvoiceFlowClient(cfg, fn).getProfile();
  assert.equal(profile.name, "A");
  assert.equal(requests[3].auth, "Bearer T2");
});

test("surfaces the API error text verbatim", async () => {
  const { fn } = fake([json({ token: "T" }), json({ error: "Only drafts can be edited." }, 409)]);
  await assert.rejects(new InvoiceFlowClient(cfg, fn).updateInvoice("x", { senderName: "s", senderAddress: "a", recipientName: "r", lineItems: [] }), {
    name: "ApiError",
    message: "InvoiceFlow API error 409: Only drafts can be edited.",
  });
});

test("wrong credentials point at mcp/.env", async () => {
  const { fn } = fake([json({ error: "Invalid credentials" }, 401)]);
  await assert.rejects(new InvoiceFlowClient(cfg, fn).getProfile(), { name: "ApiError", message: /INVOICEFLOW_EMAIL/ });
});

test("unreachable backend suggests starting docker compose", async () => {
  const { fn } = fake([new TypeError("fetch failed")]);
  await assert.rejects(new InvoiceFlowClient(cfg, fn).getProfile(), { name: "ApiError", message: /docker compose up/ });
});

test("listInvoices pages through every result (review focus)", async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}` }));
  const page2 = [{ id: "b0" }, { id: "b1" }, { id: "b2" }];
  const { fn, requests } = fake([json({ token: "T" }), json(page1), json(page2)]);
  const all = await new InvoiceFlowClient(cfg, fn).listInvoices({ status: "Draft" });
  assert.equal(all.length, 103);
  assert.equal(requests[1].url, "http://api.test/api/invoices?page=1&pageSize=100&status=Draft");
  assert.equal(requests[2].url, "http://api.test/api/invoices?page=2&pageSize=100&status=Draft");
});

test("getPdf returns the raw bytes", async () => {
  const { fn } = fake([json({ token: "T" }), new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 })]);
  const pdf = await new InvoiceFlowClient(cfg, fn).getPdf("x");
  assert.deepEqual([...pdf], [37, 80, 68, 70]);
});
