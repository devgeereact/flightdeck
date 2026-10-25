// Pure checklist logic: no React, no browser APIs, so it is unit-tested in node and reused by the sync layer.
// Stored data is small on purpose: the template ships in the app, a user stores only their edits and per-trip ticks.
import { TEMPLATE, type TemplateSection } from './checklistTemplate';

export type Flight = { number: string; date: string };
// marks: item id -> timestamp of its last tick (positive) or untick (negative). Merging keeps the newest mark per ITEM, so ticks made on
// two devices both survive. (A plain "newest trip copy wins" silently dropped one device's ticks.)
import type { TripContext } from './tripContext';
export type Trip = { id: string; name: string; flight?: Flight; nights?: number; ctx?: TripContext; metaAt: number; updatedAt: number; marks: Record<string, number> };
// ids starting "dis." record dismissed suggestions (same newest-mark-wins merge as ticks); they are not packed items
export const doneIds = (t: Trip) => Object.entries(t.marks).filter(([k, v]) => v > 0 && !k.startsWith('dis.')).map(([k]) => k);
export const dismissedIds = (t: Trip | undefined | null) => (t ? Object.entries(t.marks).filter(([k, v]) => v > 0 && k.startsWith('dis.')).map(([k]) => k.slice(4)) : []);
const KEEP_UNTICKS_MS = 60 * 24 * 3600 * 1000;
export type Added = { id: string; sec: string; text: string };
export type ChecklistData = {
  v: 1;
  rev: number; // server revision for conflict detection (0 = never synced)
  tpl: { updatedAt: number; hidden: string[]; renamed: Record<string, string>; added: Added[] };
  trips: Trip[];
  gone: Record<string, number>; // deleted trip id -> time, so a delete survives a merge
  active: string | null;
};
export type ViewItem = { id: string; text: string; custom: boolean; done: boolean };
export type ViewSection = { id: string; title: string; hint?: string; items: ViewItem[]; hiddenCount: number; doneCount: number };

export const LIMITS = { bytes: 64 * 1024, trips: 12, items: 250, label: 80, name: 60 };

export const emptyData = (): ChecklistData => ({ v: 1, rev: 0, tpl: { updatedAt: 0, hidden: [], renamed: {}, added: [] }, trips: [], gone: {}, active: null });

const clean = (t: string, max: number) => t.replace(/\s+/g, ' ').trim().slice(0, max);
export const uid = (prefix: string, now = Date.now(), rnd = Math.random()) => `${prefix}.${now.toString(36)}${Math.floor(rnd * 1e6).toString(36)}`;

/** A departure date as the search form sends it (YYYY-MM-DD, a real calendar day). Checked as text, so no time zone is involved. */
export function isPlainDate(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Defensive parse of anything read from storage or the network. Never throws; drops what it does not understand. */
export function sanitize(raw: unknown): ChecklistData {
  const out = emptyData();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as any;
  out.rev = Number.isInteger(r.rev) && r.rev >= 0 ? r.rev : 0;
  const t = r.tpl && typeof r.tpl === 'object' ? r.tpl : {};
  out.tpl.updatedAt = Number.isFinite(t.updatedAt) ? t.updatedAt : 0;
  out.tpl.hidden = Array.isArray(t.hidden) ? t.hidden.filter((x: unknown) => typeof x === 'string').slice(0, 400) : [];
  if (t.renamed && typeof t.renamed === 'object') {
    for (const [k, v] of Object.entries(t.renamed)) if (typeof v === 'string' && v.trim()) out.tpl.renamed[k] = clean(v, LIMITS.label);
  }
  if (Array.isArray(t.added)) {
    out.tpl.added = t.added
      .filter((a: any) => a && typeof a.id === 'string' && typeof a.sec === 'string' && typeof a.text === 'string' && a.text.trim())
      .slice(0, LIMITS.items).map((a: any) => ({ id: a.id, sec: a.sec, text: clean(a.text, LIMITS.label) }));
  }
  if (Array.isArray(r.trips)) {
    out.trips = r.trips
      .filter((x: any) => x && typeof x.id === 'string' && typeof x.name === 'string')
      .slice(0, LIMITS.trips).map((x: any): Trip => {
        const updatedAt = Number.isFinite(x.updatedAt) ? x.updatedAt : 0;
        const marks: Record<string, number> = {};
        if (x.marks && typeof x.marks === 'object') {
          for (const [k, v] of Object.entries(x.marks).slice(0, 500)) if (Number.isFinite(v) && v !== 0 && Math.abs(v as number) < 4.1e12) marks[k] = v as number;
        } else if (Array.isArray(x.done)) {
          for (const k of x.done.slice(0, 500)) if (typeof k === 'string') marks[k] = Math.max(1, updatedAt); // older saved lists stored a plain list of ticked ids
        }
        return {
          id: x.id, name: clean(x.name, LIMITS.name) || 'My trip', metaAt: Number.isFinite(x.metaAt) ? x.metaAt : updatedAt, updatedAt, marks,
          ...(x.flight && typeof x.flight.number === 'string' && isPlainDate(x.flight.date) ? { flight: { number: x.flight.number.slice(0, 12), date: x.flight.date.slice(0, 10) } } : {}),
          ...(Number.isInteger(x.nights) && x.nights > 0 && x.nights <= 365 ? { nights: x.nights } : {}),
          ...(cleanCtx(x.ctx) ? { ctx: cleanCtx(x.ctx)! } : {}),
        };
      });
  }
  if (r.gone && typeof r.gone === 'object') for (const [k, v] of Object.entries(r.gone)) if (Number.isFinite(v)) out.gone[k] = v as number;
  out.active = typeof r.active === 'string' && out.trips.some((x) => x.id === r.active) ? r.active : out.trips[0]?.id ?? null;
  return out;
}

const DIRS = ['outbound', 'inbound', 'domestic', 'overseas'];
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
function cleanCtx(c: any): TripContext | null {
  if (!c || typeof c !== 'object' || typeof c.dest !== 'string' || !/^[A-Z0-9]{2,5}$/.test(c.dest)) return null;
  return {
    dir: DIRS.includes(c.dir) ? c.dir : null, intl: typeof c.intl === 'boolean' ? c.intl : null, dest: c.dest, destName: clean(String(c.destName ?? c.dest), 40) || c.dest,
    lat: num(c.lat, -90, 90), lon: num(c.lon, -180, 180), tempC: num(c.tempC, -90, 60), rain: typeof c.rain === 'boolean' ? c.rain : null, km: num(c.km, 0, 20100), at: num(c.at, 0, 4.1e12) ?? 0,
  };
}
export const bytes = (d: ChecklistData) => new TextEncoder().encode(JSON.stringify(d)).length;

/** The sections the user actually sees, with their edits applied. */
export function view(d: ChecklistData, tripId: string | null, sections: TemplateSection[] = TEMPLATE): ViewSection[] {
  const trip = d.trips.find((t) => t.id === tripId);
  const done = new Set(trip ? doneIds(trip) : []);
  const hidden = new Set(d.tpl.hidden);
  return sections.map((sec) => {
    const all = [
      ...sec.items.map((i) => ({ id: i.id, text: d.tpl.renamed[i.id] ?? i.text, custom: false })),
      ...d.tpl.added.filter((a) => a.sec === sec.id).map((a) => ({ id: a.id, text: a.text, custom: true })),
    ];
    const shown = all.filter((i) => !hidden.has(i.id)).map((i) => ({ ...i, done: done.has(i.id) }));
    return { id: sec.id, title: sec.title, hint: sec.hint, items: shown, hiddenCount: all.length - shown.length, doneCount: shown.filter((i) => i.done).length };
  });
}

export function progress(sections: ViewSection[]) {
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const done = sections.reduce((n, s) => n + s.doneCount, 0);
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
}

const touchTrip = (d: ChecklistData, id: string, fn: (t: Trip) => Trip, now: number, meta = false): ChecklistData =>
  ({ ...d, trips: d.trips.map((t) => (t.id === id ? { ...fn(t), updatedAt: now, ...(meta ? { metaAt: now } : {}) } : t)) });
const touchTpl = (d: ChecklistData, tpl: Partial<ChecklistData['tpl']>, now: number): ChecklistData => ({ ...d, tpl: { ...d.tpl, ...tpl, updatedAt: now } });

export function addTrip(d: ChecklistData, name: string, flight?: Flight, now = Date.now()): ChecklistData {
  if (d.trips.length >= LIMITS.trips) return d;
  const t: Trip = { id: uid('trip', now), name: clean(name, LIMITS.name) || 'My next trip', metaAt: now, updatedAt: now, marks: {}, ...(flight ? { flight } : {}) };
  return { ...d, trips: [...d.trips, t], active: t.id };
}
export function removeTrip(d: ChecklistData, id: string, now = Date.now()): ChecklistData {
  const trips = d.trips.filter((t) => t.id !== id);
  return { ...d, trips, gone: { ...d.gone, [id]: now }, active: d.active === id ? trips[0]?.id ?? null : d.active };
}
export const renameTrip = (d: ChecklistData, id: string, name: string, now = Date.now()) =>
  touchTrip(d, id, (t) => ({ ...t, name: clean(name, LIMITS.name) || t.name }), now, true);
export const linkFlight = (d: ChecklistData, id: string, flight: Flight | undefined, now = Date.now()) =>
  touchTrip(d, id, ({ flight: _old, ...t }) => ({ ...t, ...(flight ? { flight } : {}) }), now, true);
const stamp = (t: Trip, itemId: string, now: number) => Math.max(now, Math.abs(t.marks[itemId] ?? 0) + 1); // always newer than the previous mark on this item
export const tick = (d: ChecklistData, id: string, itemId: string, on: boolean, now = Date.now()) =>
  touchTrip(d, id, (t) => ({ ...t, marks: { ...t.marks, [itemId]: (on ? 1 : -1) * stamp(t, itemId, now) } }), now);
export const setNights = (d: ChecklistData, id: string, nights: number | null, now = Date.now()) =>
  touchTrip(d, id, ({ nights: _n, ...t }) => ({ ...t, ...(nights && nights > 0 && nights <= 365 ? { nights: Math.floor(nights) } : {}) }), now, true);
export const setContext = (d: ChecklistData, id: string, ctx: TripContext | null, now = Date.now()) =>
  touchTrip(d, id, ({ ctx: _c, ...t }) => ({ ...t, ...(ctx ? { ctx } : {}) }), now, true);
export const dismiss = (d: ChecklistData, id: string, suggestionId: string, now = Date.now()) => tick(d, id, 'dis.' + suggestionId, true, now);
export const resetTicks = (d: ChecklistData, id: string, now = Date.now()) =>
  touchTrip(d, id, (t) => ({ ...t, marks: Object.fromEntries(Object.entries(t.marks).map(([k, v]) => [k, v > 0 ? -stamp(t, k, now) : v])) }), now);

export function addItem(d: ChecklistData, sec: string, text: string, now = Date.now()): ChecklistData {
  const t = clean(text, LIMITS.label);
  if (!t || d.tpl.added.length >= LIMITS.items || !TEMPLATE.some((s) => s.id === sec)) return d;
  if (d.tpl.added.some((a) => a.sec === sec && a.text.toLowerCase() === t.toLowerCase())) return d;
  return touchTpl(d, { added: [...d.tpl.added, { id: uid('cx', now), sec, text: t }] }, now);
}
export function renameItem(d: ChecklistData, id: string, text: string, now = Date.now()): ChecklistData {
  const t = clean(text, LIMITS.label);
  if (!t) return d;
  if (d.tpl.added.some((a) => a.id === id)) return touchTpl(d, { added: d.tpl.added.map((a) => (a.id === id ? { ...a, text: t } : a)) }, now);
  return touchTpl(d, { renamed: { ...d.tpl.renamed, [id]: t } }, now);
}
/** Template items are hidden (and can be restored); items the user added are deleted outright. */
export function removeItem(d: ChecklistData, id: string, now = Date.now()): ChecklistData {
  if (d.tpl.added.some((a) => a.id === id)) {
    return { ...touchTpl(d, { added: d.tpl.added.filter((a) => a.id !== id) }, now), trips: d.trips.map((t) => { const { [id]: _gone, ...marks } = t.marks; return { ...t, marks }; }) };
  }
  return touchTpl(d, { hidden: [...new Set([...d.tpl.hidden, id])] }, now);
}
export const restoreAll = (d: ChecklistData, now = Date.now()) => touchTpl(d, { hidden: [] }, now);
export const hideSection = (d: ChecklistData, sectionId: string, now = Date.now()) => {
  const ids = (TEMPLATE.find((s) => s.id === sectionId)?.items ?? []).map((i) => i.id);
  return touchTpl(d, { hidden: [...new Set([...d.tpl.hidden, ...ids])] }, now);
};
export const showSection = (d: ChecklistData, sectionId: string, now = Date.now()) => {
  const ids = new Set((TEMPLATE.find((s) => s.id === sectionId)?.items ?? []).map((i) => i.id));
  return touchTpl(d, { hidden: d.tpl.hidden.filter((h) => !ids.has(h)) }, now);
};

/**
 * Merge two copies (this device and the server). Template edits: the newer copy wins as a whole. Trips: matched by id, the newer
 * updatedAt wins; a delete beats an older copy of the trip. Deterministic and symmetric, so repeated merges converge.
 */
export function merge(a: ChecklistData, b: ChecklistData, now = Date.now()): ChecklistData {
  const gone: Record<string, number> = { ...a.gone };
  for (const [k, v] of Object.entries(b.gone)) gone[k] = Math.max(gone[k] ?? 0, v);
  const mergeTrip = (x: Trip, y: Trip): Trip => {
    const marks: Record<string, number> = { ...x.marks };
    for (const [k, v] of Object.entries(y.marks)) if (Math.abs(v) > Math.abs(marks[k] ?? 0)) marks[k] = v;
    for (const [k, v] of Object.entries(marks)) if (v < 0 && -v < now - KEEP_UNTICKS_MS) delete marks[k]; // old "unticked" notes are no longer needed
    const meta = x.metaAt > y.metaAt || (x.metaAt === y.metaAt && JSON.stringify([x.name, x.flight, x.nights, x.ctx]) >= JSON.stringify([y.name, y.flight, y.nights, y.ctx])) ? x : y;
    return { id: x.id, name: meta.name, ...(meta.flight ? { flight: meta.flight } : {}), ...(meta.nights ? { nights: meta.nights } : {}), ...(meta.ctx ? { ctx: meta.ctx } : {}), metaAt: Math.max(x.metaAt, y.metaAt), updatedAt: Math.max(x.updatedAt, y.updatedAt), marks };
  };
  const byId = new Map<string, Trip>();
  for (const t of [...a.trips, ...b.trips]) { const cur = byId.get(t.id); byId.set(t.id, cur ? mergeTrip(cur, t) : t); }
  const trips = [...byId.values()].filter((t) => !(gone[t.id] >= t.updatedAt)).sort((x, y) => x.id.localeCompare(y.id)).slice(0, LIMITS.trips);
  const tpl = a.tpl.updatedAt > b.tpl.updatedAt || (a.tpl.updatedAt === b.tpl.updatedAt && JSON.stringify(a.tpl) >= JSON.stringify(b.tpl)) ? a.tpl : b.tpl;
  const active = trips.some((t) => t.id === a.active) ? a.active : trips[0]?.id ?? null;
  return { v: 1, rev: Math.max(a.rev, b.rev), tpl, trips, gone, active };
}

export const fits = (d: ChecklistData) => bytes(d) <= LIMITS.bytes && d.trips.length <= LIMITS.trips && d.tpl.added.length <= LIMITS.items;

/** Is there anything worth saving? (An untouched, never-used list is not.) */
export const isBlank = (d: ChecklistData) => !d.trips.length && !d.tpl.hidden.length && !d.tpl.added.length && !Object.keys(d.tpl.renamed).length;
