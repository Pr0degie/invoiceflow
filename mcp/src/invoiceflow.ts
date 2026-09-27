import type { components } from "../../src/lib/api/schema.d.ts";
import type { InvoiceFlowConfig } from "./config.ts";

export type Invoice = components["schemas"]["InvoiceResponse"];
export type Profile = components["schemas"]["UserDto"];
export type InvoiceRequest = components["schemas"]["CreateInvoiceRequest"];
type AuthResponse = components["schemas"]["AuthResponseDto"];

export class ApiError extends Error {
  override name = "ApiError";
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PAGE_SIZE = 100; // server maximum

export class InvoiceFlowClient {
  #cfg: InvoiceFlowConfig;
  #fetch: typeof fetch;
  #token: string | null = null;
  #loginPromise: Promise<void> | null = null;

  constructor(cfg: InvoiceFlowConfig, fetchFn: typeof fetch = fetch) {
    this.#cfg = cfg;
    this.#fetch = fetchFn;
  }

  getProfile(): Promise<Profile> {
    return this.#json("GET", "/api/auth/me");
  }

  /** GET /api/invoices is paginated (no total count) — read pages until a short one. */
  async listInvoices(q: { status?: string; search?: string } = {}): Promise<Invoice[]> {
    const all: Invoice[] = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q.status) params.set("status", q.status);
      if (q.search) params.set("search", q.search);
      const batch = await this.#json<Invoice[]>("GET", `/api/invoices?${params}`);
      all.push(...batch);
      if (batch.length < PAGE_SIZE) return all;
    }
  }

  getInvoice(id: string): Promise<Invoice> {
    return this.#json("GET", `/api/invoices/${encodeURIComponent(id)}`);
  }

  createInvoice(body: InvoiceRequest): Promise<Invoice> {
    return this.#json("POST", "/api/invoices", body);
  }

  updateInvoice(id: string, body: InvoiceRequest): Promise<Invoice> {
    return this.#json("PUT", `/api/invoices/${encodeURIComponent(id)}`, body);
  }

  /** Test cleanup only — deliberately not exposed as an MCP tool. */
  async deleteInvoice(id: string): Promise<void> {
    await this.#request("DELETE", `/api/invoices/${encodeURIComponent(id)}`);
  }

  async getPdf(id: string): Promise<Uint8Array> {
    const res = await this.#request("GET", `/api/invoices/${encodeURIComponent(id)}/pdf`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async #json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.#request(method, path, body);
    return (await res.json()) as T;
  }

  async #request(method: string, path: string, body?: unknown, retried = false): Promise<Response> {
    if (!this.#token) await this.#loginOnce();
    const res = await this.#send(method, path, body, this.#token);
    if (res.status === 401 && !retried) {
      this.#token = null;
      return this.#request(method, path, body, true);
    }
    if (!res.ok) throw await toApiError(res);
    return res;
  }

  /** Concurrent callers share one in-flight login instead of each triggering their own. */
  #loginOnce(): Promise<void> {
    if (!this.#loginPromise) {
      this.#loginPromise = this.#login().finally(() => {
        this.#loginPromise = null;
      });
    }
    return this.#loginPromise;
  }

  async #login(): Promise<void> {
    const res = await this.#send("POST", "/api/auth/login", { email: this.#cfg.email, password: this.#cfg.password }, null);
    if (res.status === 401) throw new ApiError(401, "InvoiceFlow login failed — check INVOICEFLOW_EMAIL / INVOICEFLOW_PASSWORD in mcp/.env.");
    if (res.status === 403) throw new ApiError(403, "InvoiceFlow account e-mail is not verified yet — verify it, then retry.");
    if (!res.ok) throw await toApiError(res);
    const auth = (await res.json()) as AuthResponse;
    if (!auth.token) throw new ApiError(500, "InvoiceFlow login returned no token.");
    this.#token = auth.token;
  }

  async #send(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const url = `${this.#cfg.apiUrl.replace(/\/+$/, "")}${path}`;
    try {
      return await this.#fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, `InvoiceFlow API not reachable at ${this.#cfg.apiUrl} — is \`docker compose up\` running in invoice-api?`);
    }
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `InvoiceFlow API error ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = `${message}: ${body.error}`;
  } catch {
    // non-JSON error body — keep the status-only message
  }
  return new ApiError(res.status, message);
}
