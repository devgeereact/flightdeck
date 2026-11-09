import type { Flight } from '../../types';

/**
 * Gate, terminal, belt and boarding-time facts read from the web by the server (ADR-025). The server has already checked each one:
 * the flight number, the date, the airport and the exact words. Here the app decides WHEN to ask, and how a checked fact is laid over
 * the provider's answer: the provider's value always wins, and a fact from the web is only used where the provider has nothing and is
 * always shown with its label, its source and the time it was checked.
 */
export type FactField =
  | 'departureGate'
  | 'departureTerminal'
  | 'arrivalGate'
  | 'arrivalTerminal'
  | 'baggageBelt'
  | 'boardingTime';
export type WebFactItem = { value: string; site: string; url: string; quote: string };
export type WebFactsAnswer = {
  status: 'ok' | 'off' | 'cap' | 'error';
  items?: Partial<Record<FactField, WebFactItem>>;
  checkedAt?: string;
};
export type WebOverlay = {
  gateOut?: WebFactItem;
  terminalOut?: WebFactItem;
  gateIn?: WebFactItem;
  terminalIn?: WebFactItem;
  baggage?: WebFactItem;
  boarding?: WebFactItem & { iso: string };
  checkedAt?: string;
};

const MIN = 60000;
const HOUR = 60 * MIN;
const ms = (v: string | null | undefined) => (v ? Date.parse(v) : Number.NaN);
const first = (...v: (string | null | undefined)[]) =>
  v.map(ms).find(Number.isFinite) ?? Number.NaN;

/** The calendar day ("2026-11-09") of an instant in a time zone, or null. Airports and web pages use the local day, not the UTC day. */
export function localDay(
  iso: string | null | undefined,
  tz: string | null | undefined,
): string | null {
  const t = ms(iso);
  if (!Number.isFinite(t)) return null;
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(t));
    const v = (k: string) => p.find((x) => x.type === k)?.value;
    return `${v('year')}-${v('month')}-${v('day')}`;
  } catch {
    return null;
  }
}

function offsetMs(utc: number, tz: string): number {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utc));
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utc;
}

/** The instant for a local clock time ("09:35") on a local day in a zone, or null if the text is not a valid time. */
export function zonedToIso(ymd: string, hm: string, tz: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm);
  if (!d || !t) return null;
  try {
    const naive = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
    const guess = naive - offsetMs(naive, tz);
    return new Date(naive - offsetMs(guess, tz)).toISOString();
  } catch {
    return null;
  }
}

/** The query for /api/web-check: both local days, so belt and arrival-gate facts are looked for on the arrival day. */
export function webQuery(f: Flight): string | null {
  const date = localDay(f.scheduledOut ?? f.estimatedOut, f.origin.timezone);
  if (!date) return null;
  const adate = localDay(f.scheduledIn ?? f.estimatedIn, f.destination.timezone) ?? date;
  return `number=${encodeURIComponent(f.number)}&date=${date}&adate=${adate}&from=${f.origin.code}&to=${f.destination.code}`;
}

/**
 * Whether a search is worth paying for now. Links (the "Latest from the web" card): from a day before departure until three hours
 * after arrival, while anything is still missing. Facts: departure gate/terminal from five hours before departure until it leaves,
 * arrival gate/terminal/belt from two hours before landing until two hours after. Never for a cancelled flight. A boarding time alone
 * does not start a search; it is picked up when the gate or terminal is asked for.
 */
export function webNeeds(f: Flight, now: number): { links: boolean; facts: boolean } {
  const none = { links: false, facts: false };
  const dep = first(f.actualOut, f.estimatedOut, f.scheduledOut);
  const arr = first(f.actualIn, f.estimatedIn, f.scheduledIn);
  if (f.cancelled || !Number.isFinite(dep)) return none;
  const end = Number.isFinite(arr) ? arr : dep + 24 * HOUR;
  const inWindow = now >= dep - 24 * HOUR && now <= end + 3 * HOUR;
  const missingOut = !f.actualOut && (!f.gateOut || !f.terminalOut);
  const missingIn = !f.diverted && (!f.gateIn || !f.terminalIn || !f.baggage);
  const depFacts = missingOut && now >= dep - 5 * HOUR && now <= dep + 30 * MIN;
  const arrFacts =
    missingIn && Number.isFinite(arr) && now >= arr - 2 * HOUR && now <= arr + 2 * HOUR;
  return { links: inWindow && (missingOut || missingIn), facts: depFacts || arrFacts };
}

/** A boarding time as an instant, if it is plausible for this flight: after four hours before departure, and not after it. */
function boardingIso(f: Flight, hm: string): string | null {
  const tz = f.origin.timezone || 'UTC';
  const day = localDay(f.scheduledOut ?? f.estimatedOut, tz);
  const times = [ms(f.scheduledOut), ms(f.estimatedOut)].filter(Number.isFinite);
  if (!day || times.length === 0) return null;
  const lo = Math.min(...times) - 4 * HOUR;
  const hi = Math.max(...times);
  const iso = zonedToIso(day, hm, tz);
  if (!iso) return null;
  let t = Date.parse(iso);
  // A flight just after midnight boards the evening before.
  if (t > hi) t -= 24 * HOUR;
  return t >= lo ? new Date(t).toISOString() : null; // t <= hi always holds here
}

/** The checked web facts that may be shown: only where the provider has nothing, and only while they could still be useful. */
export function webOverlay(
  f: Flight,
  answer: WebFactsAnswer | null | undefined,
  _now: number,
): WebOverlay {
  if (!answer || answer.status !== 'ok' || !answer.items) return {};
  const it = answer.items;
  const o: WebOverlay = {};
  const ahead = !f.actualOut; // a departure gate is no use once the flight has left
  const text = (x: WebFactItem | undefined) =>
    x && typeof x.value === 'string' && x.value ? x : undefined;
  if (ahead && !f.gateOut && text(it.departureGate)) o.gateOut = it.departureGate;
  if (ahead && !f.terminalOut && text(it.departureTerminal)) o.terminalOut = it.departureTerminal;
  if (!f.diverted) {
    if (!f.gateIn && text(it.arrivalGate)) o.gateIn = it.arrivalGate;
    if (!f.terminalIn && text(it.arrivalTerminal)) o.terminalIn = it.arrivalTerminal;
    if (!f.baggage && text(it.baggageBelt)) o.baggage = it.baggageBelt;
  }
  const b = text(it.boardingTime);
  if (ahead && !f.boarding && b) {
    const iso = boardingIso(f, b.value);
    if (iso) o.boarding = { ...b, iso };
  }
  if (Object.keys(o).length > 0 && answer.checkedAt) o.checkedAt = answer.checkedAt;
  return o;
}
