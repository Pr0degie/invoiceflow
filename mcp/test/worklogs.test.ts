import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPeriod, summarize, weekRange, type Worklog } from "../src/worklogs.ts";

const w = (id: number, issueId: number, date: string, seconds: number): Worklog => ({ id, issueId, date, seconds, description: "" });

test("weekRange expands a period to whole ISO weeks", () => {
  assert.deepEqual(weekRange("2026-07-08", "2026-07-20"), { from: "2026-07-06", to: "2026-07-26" });
});

test("assertPeriod rejects from after to and malformed dates", () => {
  assert.throws(() => assertPeriod("2026-07-10", "2026-07-01"), { name: "PeriodError", message: /after/ });
  assert.throws(() => assertPeriod("06.07.2026", "2026-07-10"), { name: "PeriodError", message: /YYYY-MM-DD/ });
  assert.doesNotThrow(() => assertPeriod("2026-07-06", "2026-07-06"));
});

test("assertPeriod rejects calendar-invalid dates (review focus)", () => {
  assert.throws(() => assertPeriod("2026-02-30", "2026-03-05"), { name: "PeriodError", message: /2026-02-30/ });
  assert.throws(() => assertPeriod("2026-02-30", "2026-03-05"), { name: "PeriodError", message: /not a valid calendar date/ });
});

test("summarize groups by issue and day inside the period only", () => {
  const all = [w(1, 10, "2026-07-05", 3600), w(2, 10, "2026-07-06", 1800), w(3, 11, "2026-07-06", 900), w(4, 10, "2026-07-07", 5400)];
  const s = summarize(all, "2026-07-06", "2026-07-12");
  assert.equal(s.totalSeconds, 8100);
  assert.deepEqual(s.worklogs.map((x) => x.id), [2, 3, 4]);
  assert.deepEqual(s.byIssue, [
    { issueId: 10, seconds: 7200, hours: 2, worklogCount: 2, firstDate: "2026-07-06", lastDate: "2026-07-07" },
    { issueId: 11, seconds: 900, hours: 0.25, worklogCount: 1, firstDate: "2026-07-06", lastDate: "2026-07-06" },
  ]);
  assert.deepEqual(s.byDay, [
    { date: "2026-07-06", seconds: 2700 },
    { date: "2026-07-07", seconds: 5400 },
  ]);
});

test("byWeek counts whole ISO weeks and flags the cap", () => {
  // period Wed 2026-07-08 .. Sun 2026-07-19; the Monday 07-06 lies outside it
  const all = [w(1, 10, "2026-07-06", 4 * 3600), w(2, 10, "2026-07-08", 7 * 3600), w(3, 11, "2026-07-14", 3 * 3600)];
  const s = summarize(all, "2026-07-08", "2026-07-19", 10);
  assert.deepEqual(s.byWeek, [
    { weekStart: "2026-07-06", seconds: 11 * 3600, hours: 11, overCap: true, extendsOutsidePeriod: true },
    { weekStart: "2026-07-13", seconds: 3 * 3600, hours: 3, overCap: false, extendsOutsidePeriod: false },
  ]);
  assert.equal(s.totalSeconds, 10 * 3600); // the Monday outside the period is not billed
});

test("exactly at the cap is not over it; without a cap nothing is flagged", () => {
  const all = [w(1, 10, "2026-07-06", 10 * 3600)];
  assert.equal(summarize(all, "2026-07-06", "2026-07-12", 10).byWeek[0].overCap, false);
  assert.equal(summarize([w(1, 10, "2026-07-06", 50 * 3600)], "2026-07-06", "2026-07-12").byWeek[0].overCap, false);
});
