import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { bufferedFetch } from "./buffered-fetch.ts";

// Answers every request like invoice-api does for a wrong password: 401 + JSON.
let server: http.Server;
let url: string;

before(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid credentials." }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/login`;
});

after(() => server.close());

// What Next.js' fetch patch hands to fetch: the body as a ReadableStream
function streamedPost(): Request {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"email":"a@b.cd"}'));
      controller.close();
    },
  });
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("passes the 401 through when the body arrives as a stream", async () => {
  const response = await bufferedFetch(streamedPost());

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid credentials." });
});

test("keeps method, headers and body", async () => {
  const echo = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ method: req.method, xff: req.headers["x-forwarded-for"], body }));
    });
  });
  await new Promise<void>((resolve) => echo.listen(0, "127.0.0.1", resolve));
  const echoUrl = `http://127.0.0.1:${(echo.address() as AddressInfo).port}/`;

  const response = await bufferedFetch(
    new Request(echoUrl, {
      method: "PUT",
      headers: { "X-Forwarded-For": "198.51.100.7" },
      body: "payload",
    })
  );
  echo.close();

  assert.deepEqual(await response.json(), { method: "PUT", xff: "198.51.100.7", body: "payload" });
});
