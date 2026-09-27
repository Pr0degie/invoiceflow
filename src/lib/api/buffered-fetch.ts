/**
 * fetch for server-side invoice-api calls that re-sends the request with its
 * body buffered instead of streamed.
 *
 * openapi-fetch hands fetch a Request object, which Next.js' fetch patch
 * rebuilds with the body as a ReadableStream. undici answers any 401 to a
 * streamed body with "TypeError: fetch failed" (the fetch spec needs a
 * re-sendable body for its 401 handling) — so every wrong-password login
 * surfaced as an Auth.js server error instead of CredentialsSignin. Bodies
 * are small (invoice-api rejects anything over 2 MB), buffering costs nothing.
 */
export async function bufferedFetch(request: Request): Promise<Response> {
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body ? await request.arrayBuffer() : undefined,
    signal: request.signal,
  });
}
