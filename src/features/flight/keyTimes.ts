import type { Flight } from '../../types';

/**
 * The times and places a traveller asks about first: boarding, gate closing, take-off, landing, gates and belt.
 * Provider values are used as they are. Airlines rarely publish boarding or gate-closing times to data feeds, so when they are
 * missing these are worked out from the departure time with typical lead times and marked "Typical": never shown as fact.
 */
export type TimeKind =
  | 'Actual'
  | 'Estimated'
  | 'Scheduled'
  | 'Reported'
  | 'Typical'
  | 'Not reported';
export type KeyTime = {
  key: string;
  label: string;
  t: string | null;
  tz: string | null;
  kind: TimeKind;
  note: string;
};

const MIN = 60000;
const shift = (iso: string, mins: number) =>
  new Date(new Date(iso).getTime() + mins * MIN).toISOString();
const valid = (iso: string | null | undefined): iso is string =>
  !!iso && Number.isFinite(new Date(iso).getTime());

/** Minutes between scheduled departure and arrival, or null. */
export function blockMinutes(f: Flight): number | null {
  if (!valid(f.scheduledOut) || !valid(f.scheduledIn)) return null;
  const m = Math.round(
    (new Date(f.scheduledIn).getTime() - new Date(f.scheduledOut).getTime()) / MIN,
  );
  return m > 0 ? m : null;
}

/** Typical lead times before departure: boarding starts and the gate closes. Longer flights board earlier. */
export function leadTimes(block: number | null): { boarding: number; gateClose: number } {
  if (block !== null && block >= 360) return { boarding: 50, gateClose: 20 };
  if (block !== null && block >= 180) return { boarding: 40, gateClose: 20 };
  return { boarding: 30, gateClose: 15 };
}

export function keyTimes(f: Flight): KeyTime[] {
  const o = f.origin.timezone,
    d = f.destination.timezone;
  const dep = [f.actualOut, f.estimatedOut, f.scheduledOut].find(valid) ?? null;
  const arr = [f.actualIn, f.estimatedIn, f.scheduledIn].find(valid) ?? null;
  const depKind: TimeKind = valid(f.actualOut)
    ? 'Actual'
    : valid(f.estimatedOut)
      ? 'Estimated'
      : 'Scheduled';
  const arrKind: TimeKind = valid(f.actualIn)
    ? 'Actual'
    : valid(f.estimatedIn)
      ? 'Estimated'
      : 'Scheduled';
  const lead = leadTimes(blockMinutes(f));
  const typical = (base: string | null, mins: number) => (base ? shift(base, mins) : null);
  const kindOr = (t: string | null, k: TimeKind): TimeKind => (t ? k : 'Not reported');
  const boarding = valid(f.boarding)
    ? { t: f.boarding, kind: 'Reported' as TimeKind, note: 'From the airline' }
    : {
        t: typical(dep, -lead.boarding),
        kind: kindOr(dep, 'Typical'),
        note: `Usually ${lead.boarding} min before departure`,
      };
  const takeoff = valid(f.takeoff)
    ? { t: f.takeoff, kind: 'Actual' as TimeKind, note: 'Wheels off the runway' }
    : valid(f.estimatedTakeoff)
      ? { t: f.estimatedTakeoff, kind: 'Estimated' as TimeKind, note: 'Wheels off the runway' }
      : {
          t: typical(dep, 15),
          kind: kindOr(dep, 'Typical'),
          note: 'Usually about 15 min after leaving the gate',
        };
  const landing = valid(f.landing)
    ? { t: f.landing, kind: 'Actual' as TimeKind, note: 'Wheels on the runway' }
    : valid(f.estimatedLanding)
      ? { t: f.estimatedLanding, kind: 'Estimated' as TimeKind, note: 'Wheels on the runway' }
      : {
          t: typical(arr, -10),
          kind: kindOr(arr, 'Typical'),
          note: 'Usually about 10 min before reaching the gate',
        };
  return [
    { key: 'boarding', label: 'Boarding starts', tz: o, ...boarding },
    {
      key: 'gateclose',
      label: 'Gate closes',
      tz: o,
      t: typical(dep, -lead.gateClose),
      kind: kindOr(dep, 'Typical'),
      note: `Usually ${lead.gateClose} min before departure`,
    },
    {
      key: 'gateout',
      label: 'Leaves the gate',
      tz: o,
      t: dep,
      kind: kindOr(dep, depKind),
      note: 'Departure time',
    },
    { key: 'takeoff', label: 'Take-off', tz: o, ...takeoff },
    { key: 'landing', label: 'Landing', tz: d, ...landing },
    {
      key: 'gatein',
      label: 'Reaches the gate',
      tz: d,
      t: arr,
      kind: kindOr(arr, arrKind),
      note: 'Arrival time',
    },
  ];
}

/** "T5 · Gate B34", the usual terminal as a hint, or null when nothing is known. */
export function gatePlace(
  terminal: string | null,
  gate: string | null,
  hint?: string,
): string | null {
  const parts = [
    terminal ? `T${terminal}` : hint ? `Usually T${hint}` : null,
    gate ? `Gate ${gate}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
