import { apiFetch } from '../shared/api';

/** A failed console request: the server's message, its status, and per-field errors when a form did not validate. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Record<string, string> | null,
  ) {
    super(message);
  }
}

/** JSON in, JSON out, with the signed-in user's token. `raw` sends a file body as it is (image uploads). */
export async function call<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; raw?: Blob; signal?: AbortSignal } = {},
): Promise<T> {
  const init: RequestInit = { method: opts.method || 'GET', signal: opts.signal };
  if (opts.raw) {
    init.body = opts.raw;
    init.headers = { 'Content-Type': opts.raw.type };
  } else if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const r = await apiFetch(path, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new ApiError(j.error || `Request failed (${r.status})`, r.status, j.errors || null);
  return j as T;
}

export const nf = new Intl.NumberFormat('en-GB');
/** "just now", "12 min ago", "3 h ago", then the date ("27 Oct"). For lists; the full time is shown alongside where it matters. */
export const ago = (v: number | string | null | undefined) => {
  if (!v) return 'Never';
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return 'Never';
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(t));
};
/** UK date and time, or "Never". Accepts ms or an ISO string. */
export const when = (v: number | string | null | undefined) => {
  if (!v) return 'Never';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? 'Never'
    : new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/London',
      }).format(d);
};
