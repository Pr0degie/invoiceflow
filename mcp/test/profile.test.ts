import { test } from "node:test";
import assert from "node:assert/strict";
import { missingForFinalize, recommended } from "../src/profile.ts";

const complete = { street: "Weg 1", postalCode: "12345", city: "Ort", country: "DE", phone: "0123", taxNumber: "111/222/33333", iban: "DE89370400440532013000" };

test("a complete profile is ready to finalize", () => {
  assert.deepEqual(missingForFinalize(complete), []);
  assert.deepEqual(recommended(complete), []);
});

test("lists missing fields; vatId can replace taxNumber", () => {
  assert.deepEqual(missingForFinalize({ ...complete, phone: " ", taxNumber: null }), ["phone", "taxNumber or vatId"]);
  assert.deepEqual(missingForFinalize({ ...complete, taxNumber: null, vatId: "DE123456789" }), []);
  assert.deepEqual(recommended({ ...complete, iban: null }), ["iban"]);
});
