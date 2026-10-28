import test from 'node:test';
import assert from 'node:assert/strict';
import { duration, countdown } from '../src/features/flight/countdown';

const base: any = {
  id: 'x',
  number: 'BA59',
  airline: 'BA',
  status: 'Scheduled',
  cancelled: false,
  diverted: false,
  origin: { code: 'LHR' },
  destination: { code: 'CPT' },
  scheduledOut: null,
  estimatedOut: null,
  actualOut: null,
  scheduledIn: null,
  estimatedIn: null,
  actualIn: null,
  takeoff: null,
  landing: null,
};
const now = Date.UTC(2026, 9, 25, 1, 0);

test('duration reads naturally', () => {
  assert.equal(duration(45 * 60000), '45 min');
  assert.equal(duration(135 * 60000), '2 h 15 min');
  assert.equal(duration(120 * 60000), '2 h');
  assert.equal(duration((27 * 60 + 5) * 60000), '1 day 3 h');
  assert.equal(duration(20000), 'under a minute');
});

test('before departure: counts down to the best known departure time', () => {
  assert.equal(
    countdown({ ...base, scheduledOut: new Date(now + 135 * 60000).toISOString() }, now),
    'Leaves in 2 h 15 min',
  );
  assert.equal(
    countdown(
      {
        ...base,
        scheduledOut: new Date(now + 60 * 60000).toISOString(),
        estimatedOut: new Date(now + 90 * 60000).toISOString(),
      },
      now,
    ),
    'Leaves in 1 h 30 min',
    'an estimate beats the schedule',
  );
  assert.equal(
    countdown({ ...base, scheduledOut: new Date(now - 20 * 60000).toISOString() }, now),
    'Was due to leave 20 min ago',
  );
});

test('in the air and arrived', () => {
  assert.equal(
    countdown(
      {
        ...base,
        providerStatus: 'EnRoute',
        estimatedIn: new Date(now + 300 * 60000).toISOString(),
      },
      now,
    ),
    'Due at the gate in 5 h',
  );
  assert.equal(countdown({ ...base, providerStatus: 'EnRoute' }, now), 'In the air');
  assert.equal(
    countdown(
      { ...base, providerStatus: 'Arrived', actualIn: new Date(now - 10 * 60000).toISOString() },
      now,
    ),
    'Arrived 10 min ago',
  );
});

test('no label when there is nothing honest to say', () => {
  assert.equal(countdown(base, now), null);
  assert.equal(
    countdown(
      { ...base, cancelled: true, scheduledOut: new Date(now + 60000 * 60).toISOString() },
      now,
    ),
    null,
  );
  assert.equal(countdown({ ...base, usualRouteOnly: true }, now), null);
});
