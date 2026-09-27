import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { invoiceFlowConfig, loadEnv, settings, tempoConfig } from "./config.ts";
import { saveDraft, type DraftInput } from "./draft.ts";
import { DATE_RE, pdfFileName } from "./format.ts";
import { InvoiceFlowClient } from "./invoiceflow.ts";
import { missingForFinalize, recommended } from "./profile.ts";
import { TempoClient } from "./tempo.ts";
import { assertPeriod, summarize, weekRange } from "./worklogs.ts";

const env = loadEnv();
let invoiceflowClient: InvoiceFlowClient | undefined;
let tempoClient: TempoClient | undefined;
const invoiceflow = () => (invoiceflowClient ??= new InvoiceFlowClient(invoiceFlowConfig(env)));
const tempo = () => (tempoClient ??= new TempoClient(tempoConfig(env)));
const today = () => new Date().toLocaleDateString("sv-SE"); // local YYYY-MM-DD

async function run(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn(), null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] };
  }
}

const date = z.string().regex(DATE_RE, "Use YYYY-MM-DD");
const issueIds = z.array(z.number().int().positive()).min(1);
const draftShape = {
  from: date.describe("First day of the service period (Leistungszeitraum), inclusive"),
  to: date.describe("Last day of the service period, inclusive"),
  recipient: z.object({
    name: z.string().min(1),
    street: z.string().min(1),
    postalCode: z.string().min(1),
    city: z.string().min(1),
    countryCode: z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2, uppercase (e.g. DE)").default("DE"),
    email: z.email().optional().describe("Required later for finalization (E-Rechnung)"),
    vatId: z.string().optional(),
    buyerReference: z.string().optional(),
  }).describe("Copy from the previous invoice to this client (get_invoice)"),
  positions: z.array(z.object({
    issueIds: issueIds.describe("Tempo issue ids (from get_worklogs) billed in this position"),
    description: z.string().min(1).describe("German position text, starting with the Jira key; the exact duration is appended automatically"),
    unitPrice: z.number().positive().describe("Hourly rate in EUR"),
  })).min(1),
  exclude: z.array(z.object({ issueIds, reason: z.string().min(1) })).optional()
    .describe("Issues with logged time in the period that are deliberately not billed here"),
  dueInDays: z.number().int().min(0).max(90).optional().describe("Payment term, default 14"),
  notes: z.string().optional(),
  allowOverlap: z.boolean().optional().describe("Only true if double-billing a period is intentional"),
};

const server = new McpServer({ name: "invoiceflow", version: "0.1.0" });

server.registerTool(
  "get_profile",
  {
    title: "Get sender profile",
    description: "The InvoiceFlow sender profile, plus fields still missing for finalization (missingForFinalize) and recommended fields (recommended).",
  },
  () => run(async () => {
    const profile = await invoiceflow().getProfile();
    return { profile, missingForFinalize: missingForFinalize(profile), recommended: recommended(profile) };
  }),
);

server.registerTool(
  "list_invoices",
  {
    title: "List invoices",
    description: "All invoices (every page), compact. Use it to check whether a period is already billed and to find the previous invoice to a client.",
    inputSchema: {
      status: z.enum(["Draft", "Finalized", "Paid", "Cancelled", "Overdue"]).optional(),
      search: z.string().optional(),
    },
  },
  ({ status, search }) => run(async () =>
    (await invoiceflow().listInvoices({ status, search })).map((i) => ({
      id: i.id, number: i.number, status: i.status, type: i.type, recipientName: i.recipientName,
      servicePeriodStart: i.servicePeriodStart, servicePeriodEnd: i.servicePeriodEnd, serviceDate: i.serviceDate,
      total: i.total, issueDate: i.issueDate,
    }))),
);

server.registerTool(
  "get_invoice",
  { title: "Get invoice", description: "One invoice with all fields and line items.", inputSchema: { id: z.string().min(1) } },
  ({ id }) => run(() => invoiceflow().getInvoice(id)),
);

server.registerTool(
  "get_worklogs",
  {
    title: "Get Tempo worklogs",
    description: "The configured account's Tempo worklogs for a period, summed per issue (Tempo issue ids — resolve keys via Jira), per day and per ISO week (weekly cap check covers whole weeks).",
    inputSchema: { from: date, to: date },
  },
  ({ from, to }) => run(async () => {
    assertPeriod(from, to);
    const range = weekRange(from, to);
    return summarize(await tempo().getWorklogs(range.from, range.to), from, to, settings(env).weeklyCapHours);
  }),
);

server.registerTool(
  "create_draft_invoice",
  {
    title: "Create draft invoice from Tempo",
    description: "Creates a DRAFT invoice. Hours are re-fetched from Tempo and computed by the server; every issue with logged time in the period must be in exactly one position or in exclude. Never finalizes.",
    inputSchema: draftShape,
  },
  (input) => {
    const draft: DraftInput = input;
    return run(() => saveDraft({ invoiceflow: invoiceflow(), tempo: tempo(), weeklyCapHours: settings(env).weeklyCapHours, today }, draft));
  },
);

server.registerTool(
  "update_draft_invoice",
  {
    title: "Replace a draft invoice from Tempo",
    description: "Recomputes and replaces an existing DRAFT (same input as create_draft_invoice), overwriting the whole draft — including any edits made in the web UI. Finalized invoices are rejected by the API.",
    inputSchema: { id: z.string().min(1), ...draftShape },
  },
  ({ id, ...input }) => {
    const draft: DraftInput = input;
    return run(() => saveDraft({ invoiceflow: invoiceflow(), tempo: tempo(), weeklyCapHours: settings(env).weeklyCapHours, today }, draft, id));
  },
);

server.registerTool(
  "save_invoice_pdf",
  {
    title: "Save invoice PDF",
    description: "Downloads the invoice PDF (drafts carry an ENTWURF watermark) and returns the local file path.",
    inputSchema: { id: z.string().min(1), directory: z.string().optional() },
  },
  ({ id, directory }) => run(async () => {
    const dir = directory?.trim() || settings(env).pdfDir;
    if (!isAbsolute(dir)) throw new Error("directory must be an absolute path");
    const inv = await invoiceflow().getInvoice(id);
    const pdf = await invoiceflow().getPdf(id);
    await mkdir(dir, { recursive: true });
    const from = inv.servicePeriodStart ?? inv.serviceDate ?? inv.issueDate ?? "";
    const to = inv.servicePeriodEnd ?? inv.serviceDate ?? inv.issueDate ?? "";
    const path = join(dir, pdfFileName(inv.number, inv.recipientName ?? "", from, to));
    await writeFile(path, pdf);
    return { path, bytes: pdf.length };
  }),
);

await server.connect(new StdioServerTransport());
