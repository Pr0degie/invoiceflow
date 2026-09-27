import type { TempoConfig } from "./config.ts";
import type { Worklog } from "./worklogs.ts";

interface TempoWorklog {
  tempoWorklogId: number;
  issue: { id: number };
  timeSpentSeconds: number;
  startDate: string;
  description?: string | null;
}
interface TempoPage { metadata: { next?: string }; results: TempoWorklog[] }

export class TempoError extends Error {
  override name = "TempoError";
}

const MAX_PAGES = 100;

/** Tempo API v4 — the only source that knows who logged a worklog. */
export class TempoClient {
  #cfg: TempoConfig;
  #fetch: typeof fetch;

  constructor(cfg: TempoConfig, fetchFn: typeof fetch = fetch) {
    this.#cfg = cfg;
    this.#fetch = fetchFn;
  }

  async getWorklogs(from: string, to: string): Promise<Worklog[]> {
    const base = this.#cfg.baseUrl.replace(/\/+$/, "");
    let url: string | undefined = `${base}/worklogs/user/${encodeURIComponent(this.#cfg.accountId)}?from=${from}&to=${to}&limit=1000`;
    const out: Worklog[] = [];
    for (let page = 0; url && page < MAX_PAGES; page++) {
      let res: Response;
      try {
        res = await this.#fetch(url, { headers: { Authorization: `Bearer ${this.#cfg.token}` } });
      } catch {
        throw new TempoError(`Tempo API not reachable at ${base}.`);
      }
      if (res.status === 401 || res.status === 403) {
        throw new TempoError("Tempo token invalid, expired or lacks worklog read scope (Tempo → Settings → API Integration).");
      }
      if (!res.ok) throw new TempoError(`Tempo API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as TempoPage;
      for (const w of body.results) {
        out.push({ id: w.tempoWorklogId, issueId: w.issue.id, date: w.startDate, seconds: w.timeSpentSeconds, description: w.description ?? "" });
      }
      url = body.metadata.next;
    }
    if (url) throw new TempoError("Tempo returned more than 100 pages of worklogs — narrow the period.");
    return out;
  }
}
