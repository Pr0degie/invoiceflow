import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLineItems } from "../src/positions.ts";
import type { Worklog } from "../src/worklogs.ts";

const w = (id: number, issueId: number, date: string, seconds: number): Worklog => ({ id, issueId, date, seconds, description: "" });
const logs = [w(1, 10, "2026-07-06", 13260), w(2, 11, "2026-07-07", 1800), w(3, 12, "2026-07-08", 2700), w(4, 99, "2026-07-08", 600)];

test("one line item per position with Tempo-exact hours", () => {
  const items = buildLineItems(
    logs,
    [
      { issueIds: [10], description: "ABC-1 Suchfilter überarbeitet", unitPrice: 100 },
      { issueIds: [11, 12], description: "ABC-2 Abstimmungstermine ", unitPrice: 80 },
    ],
    [{ issueIds: [99], reason: "billed separately" }],
  );
  assert.deepEqual(items, [
    { description: "ABC-1 Suchfilter überarbeitet (3 h 41 min)", quantity: 3.68, unit: "h", unitPrice: 100, displayMode: "AsEntered", seconds: 13260 },
    { description: "ABC-2 Abstimmungstermine (1 h 15 min)", quantity: 1.25, unit: "h", unitPrice: 80, displayMode: "AsEntered", seconds: 4500 },
  ]);
});

test("strips an existing duration suffix before appending the fresh one (review focus)", () => {
  const items = buildLineItems([w(1, 10, "2026-07-06", 13260)], [{ issueIds: [10], description: "ABC-1 Feature (3 h 50 min)", unitPrice: 100 }]);
  assert.equal(items[0].description, "ABC-1 Feature (3 h 41 min)");
});

test("rejects logged time that is in no position and not excluded", () => {
  assert.throws(() => buildLineItems(logs, [{ issueIds: [10, 11, 12], description: "x", unitPrice: 90 }]), {
    name: "ValidationError",
    message: /no position or exclude: 99/,
  });
});

test("rejects an issue claimed twice", () => {
  assert.throws(
    () => buildLineItems(logs, [
      { issueIds: [10, 11], description: "a", unitPrice: 90 },
      { issueIds: [10, 12], description: "b", unitPrice: 90 },
    ], [{ issueIds: [99], reason: "r" }]),
    { name: "ValidationError", message: /more than once: 10/ },
  );
});

test("rejects a position without logged time", () => {
  assert.throws(
    () => buildLineItems(logs, [
      { issueIds: [10, 11, 12], description: "a", unitPrice: 90 },
      { issueIds: [55], description: "ghost", unitPrice: 90 },
    ], [{ issueIds: [99], reason: "r" }]),
    { name: "ValidationError", message: /Position 2 \("ghost"\) has no logged time/ },
  );
});

test("rejects a position below 0.01 h (review focus)", () => {
  assert.throws(() => buildLineItems([w(1, 10, "2026-07-06", 17)], [{ issueIds: [10], description: "tiny", unitPrice: 90 }]), {
    name: "ValidationError",
    message: /Position 1 \("tiny"\) has only 17 s — below 0\.01 h/,
  });
});

test("rejects an empty position list", () => {
  assert.throws(() => buildLineItems(logs, []), { name: "ValidationError", message: /At least one position/ });
});
