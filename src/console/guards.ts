/**
 * True when an /api/admin/overview answer has what the Overview, Usage and Costs screens read (`overview.totals`).
 * Without this check a malformed answer (an error object, an older or newer server shape) crashed the whole app with
 * "Cannot read properties of undefined (reading 'totals')". Now the console shows its own "could not load" panel with a retry.
 */
export function hasOverview(x: unknown): boolean {
  const o = (x as { overview?: { totals?: unknown } } | null | undefined)?.overview;
  return !!o && typeof o === 'object' && !!o.totals && typeof o.totals === 'object';
}
