import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gatePlace,
  gateTile,
  keyTimes,
  leadTimes,
  positionCard,
} from '../src/features/flight/keyTimes';

const f = (over: any = {}): any => ({
  number: 'BA117',
  origin: { code: 'LHR', timezone: 'Europe/London' },
  destination: { code: 'JFK', timezone: 'America/New_York' },
  scheduledOut: '2026-11-01T08:20:00Z',
  estimatedOut: null,
  actualOut: null,
  scheduledIn: '2026-11-01T16:20:00Z',
  estimatedIn: null,
  actualIn: null,
  takeoff: null,
  landing: null,
  boarding: null,
  ...over,
});
const by = (list: any[], k: string) => list.find((x) => x.key === k);

test('lead times grow with flight length', () => {
  assert.deepEqual(leadTimes(90), { boarding: 30, gateClose: 15 });
  assert.deepEqual(leadTimes(200), { boarding: 40, gateClose: 20 });
  assert.deepEqual(leadTimes(480), { boarding: 50, gateClose: 20 });
  assert.deepEqual(leadTimes(null), { boarding: 30, gateClose: 15 });
});

test('long-haul boarding and gate close are typical times before departure, never facts', () => {
  const k = keyTimes(f());
  assert.equal(by(k, 'boarding').t, '2026-11-01T07:30:00.000Z');
  assert.equal(by(k, 'boarding').kind, 'Typical');
  assert.equal(by(k, 'gateclose').t, '2026-11-01T08:00:00.000Z');
  assert.equal(by(k, 'gateclose').kind, 'Typical');
  assert.equal(by(k, 'gateout').kind, 'Scheduled');
});

test('a reported boarding time and runway times win over estimates', () => {
  const k = keyTimes(
    f({
      boarding: '2026-11-01T07:40:00Z',
      takeoff: '2026-11-01T08:41:00Z',
      estimatedLanding: '2026-11-01T16:02:00Z',
    }),
  );
  assert.equal(by(k, 'boarding').kind, 'Reported');
  assert.equal(by(k, 'takeoff').kind, 'Actual');
  assert.equal(by(k, 'landing').kind, 'Estimated');
});

test('estimates follow a delay: the typical times move with the estimated departure', () => {
  const k = keyTimes(f({ estimatedOut: '2026-11-01T09:20:00Z' }));
  assert.equal(by(k, 'gateclose').t, '2026-11-01T09:00:00.000Z');
  assert.equal(by(k, 'takeoff').t, '2026-11-01T09:35:00.000Z');
});

test('no times means nothing is invented', () => {
  const k = keyTimes(f({ scheduledOut: null, scheduledIn: null }));
  for (const x of k) {
    assert.equal(x.t, null);
    assert.equal(x.kind, 'Not reported');
  }
});

test('gate place reads naturally', () => {
  assert.equal(gatePlace('5', 'B34'), 'T5 · Gate B34');
  assert.equal(gatePlace(null, null, '5'), 'Usually T5');
  assert.equal(gatePlace(null, null), null);
});

// ---- smoke test of the live site, 8 Nov 2026: BA117 (arrived) showed "Departure gate: T5" and "Arrival gate: T8" although the
// airports had reported terminals only, and "often assigned shortly before landing" for a flight that landed hours earlier.

test('gate tile: a known gate keeps the gate label and says gates can change', () => {
  const t = gateTile('out', f({ terminalOut: '5', gateOut: 'B34' }));
  assert.equal(t.label, 'Departure gate');
  assert.match(t.note, /can change/i);
  assert.equal(gateTile('in', f({ terminalIn: '8', gateIn: '12' })).label, 'Arrival gate');
});

test('gate tile: terminal only is labelled as a terminal, never as a gate, and says the gate is not published yet', () => {
  const out = gateTile('out', f({ terminalOut: '5', gateOut: null }));
  assert.equal(out.label, 'Departure terminal');
  assert.match(out.note, /gate (is )?not (published|reported) yet/i);
  assert.match(out.note, /45.90 min before departure/);
  const inn = gateTile('in', f({ terminalIn: '8', gateIn: null }));
  assert.equal(inn.label, 'Arrival terminal');
  assert.match(inn.note, /shortly before landing/);
});

test('gate tile: once the flight has left or landed it no longer promises a gate for later', () => {
  const left = gateTile('out', f({ terminalOut: '5', actualOut: '2026-11-01T08:50:00Z' }));
  assert.doesNotMatch(left.note, /usually shown|before departure/i);
  assert.match(left.note, /no gate was reported/i);
  const landed = gateTile('in', f({ terminalIn: '8', actualIn: '2026-11-01T16:05:00Z' }));
  assert.doesNotMatch(landed.note, /shortly before landing|often assigned/i);
  assert.match(landed.note, /no gate was reported/i);
});

test('gate tile: nothing known keeps the plain gate label with the usual-timing note', () => {
  const t = gateTile('out', f());
  assert.equal(t.label, 'Departure gate');
  assert.match(t.note, /45.90 min before departure/);
  const landed = gateTile('in', f({ actualIn: '2026-11-01T16:05:00Z' }));
  assert.equal(landed.label, 'Arrival gate');
  assert.match(landed.note, /not reported/i);
});

test('position card: a landed flight says it has landed, not "not transmitting yet"', () => {
  const c = positionCard(f({ actualIn: '2026-11-01T16:05:00Z', position: null }));
  assert.match(c.title, /landed/i);
  assert.doesNotMatch(c.title, /not transmitting/i);
  assert.doesNotMatch(c.text, /appears once the aircraft is airborne/i);
});

test('position card: before departure and while airborne without a position keep the honest existing wording', () => {
  const before = positionCard(f({ position: null }));
  assert.match(before.title, /not transmitting yet/i);
  assert.match(before.text, /does not guess/i);
  const air = positionCard(f({ actualOut: '2026-11-01T08:50:00Z', position: null }));
  assert.match(air.title, /not transmitting yet/i);
});
