import { ukDate } from '../features/flight/flightFormat';
import type { FlightResponse } from '../types';

// Saved flights and the offline copy of recent results. Both live on this device; a signed-in user's saved list is also kept in
// their Clerk profile (see auth.tsx, SavedSync).
const today = () => ukDate();
// Calendar days are counted against the UK date, so "Today" means today in the UK.
const ymdUTC = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const dayDiff = (d: string) => Math.round((ymdUTC(d) - ymdUTC(today())) / 86400000);
export const dayLabel = (d: string) => {
  const n = dayDiff(d);
  return n === 0
    ? 'Today'
    : n === 1
      ? 'Tomorrow'
      : n === -1
        ? 'Yesterday'
        : new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(d + 'T12:00:00Z'));
};
// The last few results, kept on this device only so a flight can still be read without a connection. Always shown as "last fetched at", never as live.
export const LAST_KEY = 'flightdeck-last-results';
export function rememberResult(key: string, data: FlightResponse) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_KEY) || '{}');
    all[key] = { at: Date.now(), data };
    const keep = Object.keys(all)
      .sort((a, b) => all[b].at - all[a].at)
      .slice(0, 6);
    localStorage.setItem(
      LAST_KEY,
      JSON.stringify(Object.fromEntries(keep.map((k) => [k, all[k]]))),
    );
  } catch {
    /* storage full or blocked: nothing to keep */
  }
}
export function recallResult(key: string): { at: number; data: FlightResponse } | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || '{}')[key] || null;
  } catch {
    return null;
  }
}
export type SavedItem = { number: string; date: string };
export const sameItem = (a: SavedItem, b: SavedItem) => a.number === b.number && a.date === b.date;
export const cleanSaved = (v: unknown): SavedItem[] =>
  Array.isArray(v)
    ? v
        .filter((x: any) => x && typeof x.number === 'string' && typeof x.date === 'string')
        .map((x: any) => ({ number: x.number, date: x.date }))
        .slice(0, 12)
    : [];
