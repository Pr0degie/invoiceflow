import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

export const DEFAULT_ENV_FILE = fileURLToPath(new URL("../.env", import.meta.url));

export function readEnvFile(path: string): Record<string, string> {
  try {
    // spread → plain object (deepStrictEqual compares prototypes)
    return { ...(parseEnv(readFileSync(path, "utf8")) as Record<string, string>) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}

/** mcp/.env merged under the process environment (process wins). */
export function loadEnv(file = process.env.INVOICEFLOW_MCP_ENV_FILE ?? DEFAULT_ENV_FILE, processEnv: Env = process.env): Env {
  return { ...readEnvFile(file), ...processEnv };
}

function required(env: Env, names: string[]): string[] {
  const missing = names.filter((n) => !env[n]?.trim());
  if (missing.length > 0) {
    throw new ConfigError(`Missing configuration: ${missing.join(", ")} — set them in mcp/.env (see mcp/.env.example).`);
  }
  return names.map((n) => env[n]!.trim());
}

export interface InvoiceFlowConfig { apiUrl: string; email: string; password: string }
export function invoiceFlowConfig(env: Env): InvoiceFlowConfig {
  const [apiUrl, email, password] = required(env, ["INVOICEFLOW_API_URL", "INVOICEFLOW_EMAIL", "INVOICEFLOW_PASSWORD"]);
  return { apiUrl, email, password };
}

export interface TempoConfig { baseUrl: string; token: string; accountId: string }
export function tempoConfig(env: Env): TempoConfig {
  const [token, accountId] = required(env, ["TEMPO_API_TOKEN", "TEMPO_ACCOUNT_ID"]);
  return { baseUrl: env.TEMPO_API_BASE?.trim() || "https://api.tempo.io/4", token, accountId };
}

export interface Settings { weeklyCapHours?: number; pdfDir: string }
export function settings(env: Env): Settings {
  const rawCap = env.WEEKLY_HOURS_CAP?.trim();
  const weeklyCapHours = rawCap ? Number(rawCap) : undefined;
  if (weeklyCapHours !== undefined && !(weeklyCapHours > 0)) {
    throw new ConfigError(`WEEKLY_HOURS_CAP must be a positive number (got "${rawCap}").`);
  }
  return { weeklyCapHours, pdfDir: env.INVOICE_PDF_DIR?.trim() || join(homedir(), "Downloads") };
}
