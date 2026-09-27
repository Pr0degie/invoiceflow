import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, DATE_RE, formatDuration, isoWeekStart, pdfFileName, secondsToQuantity } from "../src/format.ts";

test("secondsToQuantity rounds to 0.01 h (36 s)", () => {
  assert.equal(secondsToQuantity(13260), 3.68); // 3 h 41 min
  assert.equal(secondsToQuantity(3350), 0.93);
  assert.equal(secondsToQuantity(3600), 1);
  assert.equal(secondsToQuantity(18), 0.01);
  assert.equal(secondsToQuantity(17), 0);
});

test("formatDuration prints hours and minutes, rounded to the minute", () => {
  assert.equal(formatDuration(13260), "3 h 41 min");
  assert.equal(formatDuration(2700), "45 min");
  assert.equal(formatDuration(7200), "2 h");
  assert.equal(formatDuration(89), "1 min");
});

test("formatDuration never prints 0 min for sub-minute but non-zero durations (review focus)", () => {
  assert.equal(formatDuration(20), "< 1 min");
  assert.equal(formatDuration(29), "< 1 min");
  assert.equal(formatDuration(0), "0 min");
});

test("addDays is timezone-proof across the DST switch (review focus)", () => {
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(addDays("2026-03-28", 1), "2026-03-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("isoWeekStart returns the Monday of the week", () => {
  assert.equal(isoWeekStart("2026-09-27"), "2026-09-21"); // Sunday
  assert.equal(isoWeekStart("2026-09-21"), "2026-09-21"); // Monday
  assert.equal(isoWeekStart("2026-07-08"), "2026-07-06"); // Wednesday
});

test("pdfFileName is filesystem-safe and falls back to Entwurf", () => {
  assert.equal(pdfFileName(null, "Acme GmbH", "2026-07-06", "2026-08-02"), "Entwurf_Acme_GmbH_2026-07-06_2026-08-02.pdf");
  assert.equal(pdfFileName("2026-002", "Müller & Söhne / Büro", "2026-07-06", "2026-07-06"), "2026-002_Müller_Söhne_Büro_2026-07-06_2026-07-06.pdf");
});

test("DATE_RE accepts YYYY-MM-DD only", () => {
  assert.ok(DATE_RE.test("2026-07-06"));
  assert.ok(!DATE_RE.test("06.07.2026"));
});
