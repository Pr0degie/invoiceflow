/**
 * fetch for server-side invoice-api calls that re-sends the request with its
 * body buffered instead of streamed.
 *
 * openapi-fetch hands fetch a Request object, which Next.js' fetch patch
 * rebuilds with the body as a ReadableStream. Some undici versions answer any
 * 401 to a streamed body with "TypeError: fetch failed" (the fetch spec needs
 * a re-sendable body for its 401 handling) — seen on Node 24.14, gone on
 * 24.21. There every wrong-password login surfaced as an Auth.js server error
 * instead of CredentialsSignin. Buffering is correct on every version and
 * costs nothing: invoice-api rejects bodies over 2 MB.
 */
export async function bufferedFetch(request: Request): Promise<Response> {
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body ? await request.arrayBuffer() : undefined,
    signal: request.signal,
  });
}
