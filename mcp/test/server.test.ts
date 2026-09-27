import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = fileURLToPath(new URL("..", import.meta.url));

test("starts without any config, lists all tools and reports missing config (review focus)", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["src/index.ts"],
    cwd: root,
    env: { ...getDefaultEnvironment(), INVOICEFLOW_MCP_ENV_FILE: join(tmpdir(), "invoiceflow-mcp-does-not-exist.env") },
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      "create_draft_invoice", "get_invoice", "get_profile", "get_worklogs", "list_invoices", "save_invoice_pdf", "update_draft_invoice",
    ]);
    const res = await client.callTool({ name: "get_profile", arguments: {} });
    assert.equal(res.isError, true);
    assert.match((res.content as { type: string; text: string }[])[0].text, /INVOICEFLOW_API_URL, INVOICEFLOW_EMAIL, INVOICEFLOW_PASSWORD/);
  } finally {
    await client.close();
  }
});
