// Signed-in users prove who they are to the API with their Clerk session token. It is sent in two headers because some hosts strip Authorization.
let tokenGetter: (() => Promise<string | null>) | null = null;
export const setTokenGetter = (fn: (() => Promise<string | null>) | null) => {
  tokenGetter = fn;
};
export async function apiFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (tokenGetter) {
    try {
      const t = await tokenGetter();
      if (t) {
        headers.set('Authorization', 'Bearer ' + t);
        headers.set('X-Session-Token', t);
      }
    } catch {
      /* sent without a token; the server decides */
    }
  }
  return fetch(url, { ...init, headers });
}

// What a person reads when a request fails. A network failure (including the service worker's "no-response" report, which is a TypeError
// carrying Workbox's internal text) becomes a plain sentence; anything the server sent on purpose is shown as it is.
export function readableError(e: unknown): string {
  const err = e as Error | undefined;
  const text = String(err?.message || '');
  if (
    err?.name === 'TypeError' ||
    /no-response|Failed to fetch|NetworkError|Load failed|FetchEvent/i.test(text)
  )
    return 'Flightdeck could not be reached. Check your connection, then try again.';
  if (err?.name === 'SyntaxError')
    return 'Flightdeck sent a reply it could not read. Please try again.';
  return text || 'Something went wrong. Please try again.';
}
