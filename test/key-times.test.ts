import assert from 'node:assert/strict';
import test from 'node:test';
import { gatePlace, keyTimes, leadTimes } from '../src/features/flight/keyTimes';

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
