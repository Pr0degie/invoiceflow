import { test } from "node:test";
import assert from "node:assert/strict";
import { hasLiveSession, isAccessTokenFresh } from "./session-state.ts";

const NOW = Date.parse("2026-09-28T12:00:00Z");
const inMinutes = (m: number) => new Date(NOW + m * 60_000).toISOString();

test("an access token with minutes left is fresh", () => {
  assert.equal(isAccessTokenFresh(inMinutes(5), NOW), true);
});

test("an access token inside the 30 s refresh buffer is no longer fresh", () => {
  // Matches the jwt() callback, which refreshes 30 s before expiry
  assert.equal(isAccessTokenFresh(new Date(NOW + 20_000).toISOString(), NOW), false);
});

test("an expired access token is not fresh", () => {
  assert.equal(isAccessTokenFresh(inMinutes(-1), NOW), false);
});

test("a token without an expiry counts as fresh", () => {
  assert.equal(isAccessTokenFresh(undefined, NOW), true);
});

test("no cookie means no live session", () => {
  assert.equal(hasLiveSession(null, NOW), false);
});

test("a decodable cookie with a fresh access token is a live session", () => {
  assert.equal(hasLiveSession({ accessTokenExpires: inMinutes(5) }, NOW), true);
});

test("a cookie whose access token expired is not proven live", () => {
  // Its refresh token may be dead (revoked elsewhere, reused, rate-limited) —
  // only a refresh can tell, and the routing proxy doesn't refresh
  assert.equal(hasLiveSession({ accessTokenExpires: inMinutes(-1) }, NOW), false);
});

test("a cookie that recorded a failed refresh is not live", () => {
  assert.equal(
    hasLiveSession({ accessTokenExpires: inMinutes(5), error: "RefreshAccessTokenError" }, NOW),
    false
  );
});
