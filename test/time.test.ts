// Time correctness: every flight time is shown in the airport's own zone, across clock changes, whatever zone this machine is in.
// Run the suite under another TZ too (e.g. TZ=America/Los_Angeles pnpm test): nothing here may depend on the device's zone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { time, day, ukDate, journeySteps } from '../src/flightFormat.ts';
import { summarise } from '../src/summary.ts';
import { isPlainDate, sanitize } from '../src/checklistModel.ts';
import type { Flight } from '../src/types.ts';

const LHR = { code: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom', countryCode: 'GB', timezone: 'Europe/London', lat: 51.47, lon: -0.4543 };
const JFK = { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States', countryCode: 'US', timezone: 'America/New_York', lat: 40.6413, lon: -73.7781 };
const flight = (o: Partial<Flight> = {}): Flight => ({
  id: 't', number: 'BA117', airline: 'British Airways', status: 'Scheduled', providerStatus: 'Expected', cancelled: false, diverted: false,
  origin: LHR, destination: JFK, scheduledOut: null, estimatedOut: null, actualOut: null, scheduledIn: null, estimatedIn: null, actualIn: null,
  takeoff: null, landing: null, boarding: null, gateOut: null, gateIn: null, terminalOut: '5', terminalIn: null, baggage: null, aircraft: null,
  registration: null, progress: null, delayMinutes: 0, position: null, ...o,
} as Flight);

test('autumn change, 25 Oct 2026: 00:30 UTC is 01:30 BST and 01:30 UTC is 01:30 GMT at LHR', () => {
  assert.equal(time('2026-10-25T00:30:00.000Z', 'Europe/London'), '01:30');
  assert.equal(time('2026-10-25T01:30:00.000Z', 'Europe/London'), '01:30');
  assert.equal(day('2026-10-25T00:30:00.000Z', 'Europe/London'), '25 Oct');
  assert.equal(day('2026-10-25T01:30:00.000Z', 'Europe/London'), '25 Oct');
  // The hour after the change and a time just before midnight UTC that is already the next UK day.
  assert.equal(time('2026-10-25T02:30:00.000Z', 'Europe/London'), '02:30');
  assert.equal(time('2026-10-24T23:30:00.000Z', 'Europe/London'), '00:30');
  assert.equal(day('2026-10-24T23:30:00.000Z', 'Europe/London'), '25 Oct');
});

test('spring change, 29 Mar 2026: 00:30 UTC is 00:30 GMT, 01:30 UTC is 02:30 BST at LHR; New York is already on EDT', () => {
  assert.equal(time('2026-03-29T00:30:00.000Z', 'Europe/London'), '00:30');
  assert.equal(time('2026-03-29T01:30:00.000Z', 'Europe/London'), '02:30');
  assert.equal(day('2026-03-29T01:30:00.000Z', 'Europe/London'), '29 Mar');
  // A flight leaving LHR at 00:30 GMT and reaching JFK at 08:30 UTC: 04:30 EDT (US clocks changed on 8 Mar 2026).
  const f = flight({ scheduledOut: '2026-03-29T00:30:00.000Z', scheduledIn: '2026-03-29T08:30:00.000Z' });
  const steps = journeySteps(f);
  const out = steps.find((s) => s.key === 'gateout')!, inn = steps.find((s) => s.key === 'gatein')!;
  assert.equal(time(out.t, out.tz), '00:30');
  assert.equal(time(inn.t, inn.tz), '04:30');
  assert.equal(day(inn.t, inn.tz), '29 Mar');
});

test('the same instant shows each airport its own local date (no off-by-one in western zones)', () => {
  // 03:00 UTC on 25 Oct is 23:00 on 24 Oct in New York (EDT until 1 Nov 2026).
  assert.equal(day('2026-10-25T03:00:00.000Z', 'America/New_York'), '24 Oct');
  assert.equal(time('2026-10-25T03:00:00.000Z', 'America/New_York'), '23:00');
  assert.equal(day('2026-10-25T03:00:00.000Z', 'Europe/London'), '25 Oct');
  // Offset form (not Z) is read as the same instant.
  assert.equal(time('2026-10-25T01:30:00+01:00', 'Europe/London'), '01:30');
});

test('missing or unreadable times and zones are never turned into a made-up time', () => {
  assert.equal(time(null, 'Europe/London'), 'Not available');
  assert.equal(time('not a time', 'Europe/London'), 'Not available');
  assert.equal(time('2026-10-25T00:30:00.000Z', 'Not/AZone'), 'Not available');
  assert.equal(day('garbage', 'Europe/London'), '');
  assert.equal(day(null, null), '');
  // No zone: UTC, and the views label it as UTC.
  assert.equal(time('2026-10-25T00:30:00.000Z', null), '00:30');
});

test('UK today: the default search date is the Europe/London date, not UTC and not the device zone', () => {
  assert.equal(ukDate(Date.parse('2026-06-30T23:30:00Z')), '2026-07-01'); // 00:30 BST
  assert.equal(ukDate(Date.parse('2026-10-24T23:30:00Z')), '2026-10-25'); // 00:30 BST on the change day
  assert.equal(ukDate(Date.parse('2026-10-25T23:30:00Z')), '2026-10-25'); // 23:30 GMT, same UK day
  assert.equal(ukDate(Date.parse('2026-12-31T23:59:00Z')), '2026-12-31'); // winter: UK = UTC
  assert.equal(ukDate(new Date('2026-03-29T00:59:00Z')), '2026-03-29');
});

test('summary: departure across the autumn change is in London time; a missing zone is called UTC, not local', () => {
  const bst = summarise(flight({ scheduledOut: '2026-10-25T00:30:00.000Z', estimatedOut: '2026-10-25T00:30:00.000Z' }));
  assert.ok(bst.some((x) => /scheduled to leave at 01:30 London time on Sun,? 25 Oct\./.test(x)), bst.join(' | '));
  const gmt = summarise(flight({ scheduledOut: '2026-10-25T01:30:00.000Z', estimatedOut: '2026-10-25T01:30:00.000Z' }));
  assert.ok(gmt.some((x) => /scheduled to leave at 01:30 London time on Sun,? 25 Oct\./.test(x)), gmt.join(' | '));
  const noZone = summarise(flight({ origin: { ...LHR, timezone: null }, scheduledOut: '2026-10-25T01:30:00.000Z' }));
  assert.ok(noZone.some((x) => /scheduled to leave at 01:30 UTC on Sun,? 25 Oct\./.test(x)), noZone.join(' | '));
  assert.ok(!noZone.some((x) => /London time/.test(x)));
  const landedNoZone = summarise(flight({ providerStatus: 'Arrived', destination: { ...JFK, timezone: null }, actualIn: '2026-10-25T13:05:00.000Z' }));
  assert.ok(landedNoZone.some((x) => x.includes('reached the gate at 13:05, UTC.')), landedNoZone.join(' | '));
});

test('saved packing-list trips keep only real calendar dates for their flight', () => {
  assert.ok(isPlainDate('2026-10-25') && isPlainDate('2028-02-29'));
  assert.ok(!isPlainDate('2026-02-29') && !isPlainDate('2026-13-01') && !isPlainDate('25/10/2026') && !isPlainDate('') && !isPlainDate(20261025));
  const d = sanitize({ trips: [{ id: 'a', name: 'A', updatedAt: 1, marks: {}, flight: { number: 'BA117', date: '2026-10-25' } }, { id: 'b', name: 'B', updatedAt: 1, marks: {}, flight: { number: 'BA117', date: '<img onerror>' } }] });
  assert.deepEqual(d.trips[0].flight, { number: 'BA117', date: '2026-10-25' });
  assert.equal(d.trips[1].flight, undefined);
});
