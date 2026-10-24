// Signed-in users prove who they are to the API with their Clerk session token. It is sent in two headers because some hosts strip Authorization.
let tokenGetter: (() => Promise<string | null>) | null = null;
export const setTokenGetter = (fn: (() => Promise<string | null>) | null) => { tokenGetter = fn; };
export async function apiFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (tokenGetter) {
    try { const t = await tokenGetter(); if (t) { headers.set('Authorization', 'Bearer ' + t); headers.set('X-Session-Token', t); } } catch { /* sent without a token; the server decides */ }
  }
  return fetch(url, { ...init, headers });
}
