import type { Flight } from '../../types';
import type { WebOverlay } from './webFacts';

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
  | 'From the web'
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

export function keyTimes(f: Flight, web?: WebOverlay): KeyTime[] {
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
    : web?.boarding
      ? { t: web.boarding.iso, kind: 'From the web' as TimeKind, note: `From ${web.boarding.site}` }
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

/**
 * What the gate tile on each side of the flight should say. A terminal is not a gate, so when only the terminal is known the tile is
 * labelled as a terminal and says the gate has not been published; and once the flight has left (or landed) it no longer promises a
 * gate for later. (Live smoke test, 8 Nov 2026: an arrived BA117 showed "Arrival gate: T8 - often assigned shortly before landing".)
 */
export function gateTile(
  side: 'out' | 'in',
  f: Pick<Flight, 'gateOut' | 'gateIn' | 'terminalOut' | 'terminalIn' | 'actualOut' | 'actualIn'>,
): { label: string; note: string } {
  const out = side === 'out';
  const gate = out ? f.gateOut : f.gateIn;
  const terminal = out ? f.terminalOut : f.terminalIn;
  const gone = !!(out ? f.actualOut : f.actualIn);
  const word = out ? 'Departure' : 'Arrival';
  if (gate) {
    return {
      label: `${word} gate`,
      note: out
        ? 'Gates can change: follow the airport screens'
        : 'Assigned by the arrival airport',
    };
  }
  const wait = out
    ? 'Usually shown 45–90 min before departure'
    : 'Often assigned shortly before landing';
  if (terminal) {
    return {
      label: `${word} terminal`,
      note: gone ? 'No gate was reported for this flight' : `Gate not published yet. ${wait}`,
    };
  }
  return { label: `${word} gate`, note: gone ? 'Not reported for this flight' : wait };
}

/** The aircraft-position card when no position is held: a landed flight says so instead of "not transmitting yet". */
export function positionCard(f: Pick<Flight, 'actualIn'>): { title: string; text: string } {
  if (f.actualIn) {
    return {
      title: 'Aircraft position: the flight has landed',
      text: 'A position is only shown while the aircraft is in the air and in range of OpenSky Network receivers.',
    };
  }
  return {
    title: 'Aircraft position: not transmitting yet',
    text: 'Position appears once the aircraft is airborne and in range of OpenSky Network receivers. Over oceans there is often no position. Flightdeck does not guess where the aircraft is.',
  };
}
