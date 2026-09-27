import { test } from "node:test";
import assert from "node:assert/strict";
import { TempoClient } from "../src/tempo.ts";

const cfg = { baseUrl: "https://api.tempo.io/4/", token: "tok", accountId: "acc:1" };
const first = "https://api.tempo.io/4/worklogs/user/acc%3A1?from=2026-07-06&to=2026-07-12&limit=1000";
const second = `${first}&offset=1000`;

function fake(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
  return { fn, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("follows metadata.next, sends the bearer token and maps worklogs", async () => {
  const { fn, calls } = fake((url) =>
    url === first
      ? json({ metadata: { next: second }, results: [{ tempoWorklogId: 1, issue: { id: 10 }, timeSpentSeconds: 3600, startDate: "2026-07-06", description: "a" }] })
      : json({ metadata: {}, results: [{ tempoWorklogId: 2, issue: { id: 11 }, timeSpentSeconds: 60, startDate: "2026-07-07" }] }),
  );
  const logs = await new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12");
  assert.deepEqual(calls.map((c) => c.url), [first, second]);
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer tok");
  assert.deepEqual(logs, [
    { id: 1, issueId: 10, date: "2026-07-06", seconds: 3600, description: "a" },
    { id: 2, issueId: 11, date: "2026-07-07", seconds: 60, description: "" },
  ]);
});

test("401 explains the token problem", async () => {
  const { fn } = fake(() => json({}, 401));
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), { name: "TempoError", message: /token invalid/ });
});

test("network failure says Tempo is unreachable", async () => {
  const { fn } = fake(() => { throw new TypeError("fetch failed"); });
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), { name: "TempoError", message: /not reachable/ });
});

test("other HTTP errors include status and body", async () => {
  const { fn } = fake(() => new Response("boom", { status: 500 }));
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), { name: "TempoError", message: /500: boom/ });
});

test("never silently truncates when a page always links to a next page (review focus)", async () => {
  const { fn } = fake((url) => json({ metadata: { next: `${url}&x=1` }, results: [] }));
  await assert.rejects(new TempoClient(cfg, fn).getWorklogs("2026-07-06", "2026-07-12"), {
    name: "TempoError",
    message: /more than 100 pages/,
  });
});
