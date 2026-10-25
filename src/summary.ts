// A short plain-English account of a flight, built ONLY from fields the providers reported. Nothing is inferred beyond what is stated:
// if a detail is missing, the sentence for it is simply left out (or says it is not reported). No AI, no guessing.
import type { Flight, Airport } from './types';
import { inZone } from './flightFormat';

const tm = (iso: string | null | undefined, tz: string | null) => inZone(iso, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const day = (iso: string | null | undefined, tz: string | null) => inZone(iso, tz, { weekday: 'short', day: 'numeric', month: 'short' });
// Which clock a time is on. Without the airport's time zone the time is shown in UTC and must say so, not claim to be local.
const clock = (a: Airport | null | undefined, tz: string | null) => (tz ? `${a?.city || 'local'} time` : 'UTC');
const place = (a: Airport) => (!a || a.code === '—' ? null : `${a.city || a.name} (${a.code})`);
const AIR = new Set(['Departed', 'EnRoute', 'Approaching']);

export function summarise(f: Flight): string[] {
  const out: string[] = [];
  const from = place(f.origin), to = place(f.destination);
  const kind = f.direction?.type === 'outbound' ? 'an outbound' : f.direction?.type === 'inbound' ? 'an inbound' : f.direction?.type === 'domestic' ? 'a domestic' : f.direction?.type === 'overseas' ? 'an international' : 'a';
  if (from && to) out.push(`${f.number} is ${kind} flight from ${from} to ${to}.`);
  const st = f.providerStatus;
  const oTz = f.origin?.timezone ?? null, dTz = f.destination?.timezone ?? null;
  if (f.cancelled) out.push('This flight has been cancelled. Contact the airline for your options.');
  else if (f.diverted) out.push('This flight has been diverted. Check with the airline for the new arrival airport.');
  else if (f.usualRouteOnly) out.push('No schedule is published for this date yet, so only the usual route is known. Times appear closer to departure.');
  else if (st === 'Arrived') {
    const t = tm(f.actualIn ?? f.landing, dTz);
    out.push(t ? `It has arrived and reached the gate at ${t}, ${clock(f.destination, dTz)}.` : 'It has arrived.');
  } else if (st && AIR.has(st)) {
    const eta = tm(f.estimatedIn, dTz);
    out.push(`It is in the air${f.progress != null ? `, about ${f.progress}% of the way` : ''}${f.progressBasis && f.progressBasis !== 'status' ? ' (estimated)' : ''}.${eta ? ` Expected at the gate around ${eta} ${clock(f.destination, dTz)}.` : ''}`);
  } else {
    const dep = tm(f.estimatedOut ?? f.scheduledOut, oTz), when = day(f.estimatedOut ?? f.scheduledOut, oTz);
    if (dep) out.push(`It ${f.estimatedOut && f.estimatedOut !== f.scheduledOut ? 'is now expected to leave' : 'is scheduled to leave'} at ${dep} ${clock(f.origin, oTz)}${when ? ` on ${when}` : ''}.`);
  }
  if (!f.cancelled && !f.diverted && !f.usualRouteOnly && st !== 'Arrived') {
    if (f.delayMinutes != null && f.delayMinutes > 0) out.push(`It is running ${f.delayMinutes} minute${f.delayMinutes === 1 ? '' : 's'} late.`);
    else if (f.delayMinutes != null && f.delayMinutes < 0 && f.liveUpdates) out.push(`It is ${Math.abs(f.delayMinutes)} minute${f.delayMinutes === -1 ? '' : 's'} early.`);
  }
  const departed = st != null && (AIR.has(st) || st === 'Arrived');
  if (!departed && !f.cancelled && !f.usualRouteOnly) {
    const bits = [f.terminalOut ? `Terminal ${f.terminalOut}` : null, f.gateOut ? `gate ${f.gateOut}` : null].filter(Boolean);
    if (bits.length) out.push(`Departing from ${bits.join(', ')}.`);
    else if (f.terminalOutHint) out.push(`The usual terminal for this airline here is ${f.terminalOutHint}, but it is not confirmed. Check the airport screens.`);
    else out.push('The gate is not reported yet. Gates are often assigned only a couple of hours before departure.');
  }
  if ((st === 'Arrived' || st === 'Approaching') && !f.cancelled) out.push(f.baggage ? `Baggage belt: ${f.baggage}.` : 'No baggage belt has been reported yet. Check the screens in the arrivals hall.');
  return out;
}
