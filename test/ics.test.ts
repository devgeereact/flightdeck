import assert from 'node:assert/strict';
import test from 'node:test';
import { flightIcs } from '../src/features/flight/ics';

const f: any = {
  number: 'BA59',
  airline: 'British Airways',
  cancelled: false,
  origin: { code: 'LHR', name: 'London Heathrow', city: 'London' },
  destination: { code: 'CPT', name: 'Cape Town International', city: 'Cape Town' },
  scheduledOut: '2026-10-25T21:20:00.000Z',
  estimatedOut: null,
  scheduledIn: '2026-10-26T10:10:00.000Z',
  estimatedIn: null,
  terminalOut: '5',
};

test('calendar file uses UTC times, CRLF lines and escaped text', () => {
  const ics = flightIcs(
    f,
    'https://flightdeck.gakinz.com/#/flight/BA59/2026-10-25',
    Date.UTC(2026, 9, 25, 1, 0),
  )!;
  assert.ok(ics.includes('DTSTART:20261025T212000Z') && ics.includes('DTEND:20261026T101000Z'));
  assert.ok(ics.includes('SUMMARY:BA59 London (LHR) to Cape Town (CPT)'));
  assert.ok(ics.includes('departure terminal 5') && ics.includes('Times and gates can change'));
  assert.ok(
    ics.split('\r\n').every((l) => l.length <= 75),
    'lines are folded',
  );
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
});

test('an estimate replaces the schedule; commas and semicolons are escaped', () => {
  const ics = flightIcs(
    { ...f, estimatedOut: '2026-10-25T21:50:00.000Z', airline: 'Air, Test; Ltd' },
    'x',
  )!;
  assert.ok(ics.includes('DTSTART:20261025T215000Z') && ics.includes('Air\\, Test; Ltd'));
});

test('no file when a time is missing, the flight is cancelled or only the usual route is known', () => {
  assert.equal(flightIcs({ ...f, scheduledIn: null }, 'x'), null);
  assert.equal(flightIcs({ ...f, cancelled: true }, 'x'), null);
  assert.equal(flightIcs({ ...f, usualRouteOnly: true }, 'x'), null);
});
