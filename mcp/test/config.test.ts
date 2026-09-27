import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { invoiceFlowConfig, loadEnv, readEnvFile, settings, tempoConfig } from "../src/config.ts";

test("invoiceFlowConfig lists every missing variable (empty counts as missing)", () => {
  assert.throws(() => invoiceFlowConfig({ INVOICEFLOW_API_URL: "http://x", INVOICEFLOW_EMAIL: "" }), {
    name: "ConfigError",
    message: /INVOICEFLOW_EMAIL, INVOICEFLOW_PASSWORD .*mcp\/\.env/,
  });
});

test("invoiceFlowConfig returns the values", () => {
  assert.deepEqual(invoiceFlowConfig({ INVOICEFLOW_API_URL: "http://x", INVOICEFLOW_EMAIL: "a@b.de", INVOICEFLOW_PASSWORD: "pw" }), {
    apiUrl: "http://x", email: "a@b.de", password: "pw",
  });
});

test("tempoConfig requires token and account id and defaults the base URL", () => {
  assert.throws(() => tempoConfig({}), { name: "ConfigError", message: /TEMPO_API_TOKEN, TEMPO_ACCOUNT_ID/ });
  assert.equal(tempoConfig({ TEMPO_API_TOKEN: "t", TEMPO_ACCOUNT_ID: "a", TEMPO_API_BASE: "" }).baseUrl, "https://api.tempo.io/4");
});

test("settings parses the cap and defaults the PDF directory", () => {
  assert.deepEqual(settings({ WEEKLY_HOURS_CAP: "10" }), { weeklyCapHours: 10, pdfDir: join(homedir(), "Downloads") });
  assert.deepEqual(settings({ WEEKLY_HOURS_CAP: "", INVOICE_PDF_DIR: "C:/out" }), { weeklyCapHours: undefined, pdfDir: "C:/out" });
  assert.throws(() => settings({ WEEKLY_HOURS_CAP: "ten" }), { name: "ConfigError", message: /WEEKLY_HOURS_CAP/ });
});

test("readEnvFile parses a file and returns {} when it is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "ifmcp-"));
  const file = join(dir, ".env");
  writeFileSync(file, "INVOICEFLOW_EMAIL=a@b.de\n# comment\nWEEKLY_HOURS_CAP=10\n");
  assert.deepEqual(readEnvFile(file), { INVOICEFLOW_EMAIL: "a@b.de", WEEKLY_HOURS_CAP: "10" });
  assert.deepEqual(readEnvFile(join(dir, "missing.env")), {});
});

test("loadEnv lets the process environment win over the file", () => {
  const dir = mkdtempSync(join(tmpdir(), "ifmcp-"));
  const file = join(dir, ".env");
  writeFileSync(file, "A=file\nB=file\n");
  const env = loadEnv(file, { B: "process" });
  assert.equal(env.A, "file");
  assert.equal(env.B, "process");
});
