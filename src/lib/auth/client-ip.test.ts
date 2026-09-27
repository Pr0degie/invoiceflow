import { test } from "node:test";
import assert from "node:assert/strict";
import { forwardedForHeader } from "./client-ip.ts";

test("forwards the last X-Forwarded-For entry — the one the edge proxy appended", () => {
  // Earlier entries are client-supplied and would let a caller pick its own bucket
  const headers = new Headers({ "x-forwarded-for": "10.9.9.9, 198.51.100.7" });

  assert.deepEqual(forwardedForHeader(headers), { "X-Forwarded-For": "198.51.100.7" });
});

test("forwards a single client address", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.5" });

  assert.deepEqual(forwardedForHeader(headers), { "X-Forwarded-For": "203.0.113.5" });
});

test("skips empty entries and whitespace", () => {
  const headers = new Headers({ "x-forwarded-for": " 198.51.100.7 , " });

  assert.deepEqual(forwardedForHeader(headers), { "X-Forwarded-For": "198.51.100.7" });
});

test("sends nothing when the request carries no client address", () => {
  assert.deepEqual(forwardedForHeader(new Headers()), {});
});
