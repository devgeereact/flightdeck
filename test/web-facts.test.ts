// The app side of ADR-025: when to ask the server for web facts, how a checked fact is laid over the provider's answer, and how it is
// labelled. Provider values always win; a fact from the web is only used where the provider has nothing, and is never silent.
import assert from 'node:assert/strict';
import test from 'node:test';
import { journeySteps } from '../src/features/flight/flightFormat';
import { keyTimes } from '../src/features/flight/keyTimes';
import {
  localDay,
  type WebFactsAnswer,
  webNeeds,
  webOverlay,
  webQuery,
  zonedToIso,
} from '../src/features/flight/webFacts';

const HOUR = 3600000;
// BA75 on a sample day: London 10:10 GMT to Lagos 17:05 (WAT, UTC+1) = 16:05Z.
const f = (over: any = {}): any => ({
  number: 'BA75',
  origin: { code: 'LHR', timezone: 'Europe/London' },
  destination: { code: 'LOS', timezone: 'Africa/Lagos' },
  scheduledOut: '2026-11-09T10:10:00Z',
  estimatedOut: null,
  actualOut: null,
  scheduledIn: '2026-11-09T16:05:00Z',
  estimatedIn: null,
  actualIn: null,
  takeoff: null,
  landing: null,
  boarding: null,
  gateOut: null,
  gateIn: null,
  terminalOut: null,
  terminalIn: null,
  baggage: null,
  cancelled: false,
  diverted: false,
  ...over,
});
const at = (iso: string) => new Date(iso).getTime();
const item = (value: string, over: any = {}) => ({
  value,
  site: 'heathrow.com',
  url: 'https://www.heathrow.com/x',
  quote: 'q',
  ...over,
});
const ok = (items: any, checkedAt = '2026-11-09T07:00:00Z'): WebFactsAnswer => ({
  status: 'ok',
  items,
  checkedAt,
});

test('local day: the calendar day in the airport’s own zone, not the UTC day', () => {
  assert.equal(localDay('2026-11-09T23:30:00Z', 'Africa/Lagos'), '2026-11-10');
  assert.equal(localDay('2026-11-09T23:30:00Z', 'Europe/London'), '2026-11-09');
  assert.equal(localDay('nonsense', 'Europe/London'), null);
  assert.equal(localDay(null, 'Europe/London'), null);
});

test('zoned time: a local clock time in a zone becomes the right instant, summer and winter', () => {
  assert.equal(zonedToIso('2026-11-09', '09:35', 'Europe/London'), '2026-11-09T09:35:00.000Z');
  assert.equal(zonedToIso('2026-11-09', '09:35', 'Africa/Lagos'), '2026-11-09T08:35:00.000Z');
  assert.equal(zonedToIso('2026-07-09', '09:35', 'Europe/London'), '2026-07-09T08:35:00.000Z');
  assert.equal(zonedToIso('2026-11-09', '25:00', 'Europe/London'), null);
});

test('the query carries both local days, so a belt is looked for on the arrival day', () => {
  const q = webQuery(
    f({ scheduledOut: '2026-11-09T23:30:00Z', scheduledIn: '2026-11-10T06:00:00Z' }),
  );
  assert.match(q ?? '', /number=BA75/);
  assert.match(q ?? '', /date=2026-11-09/); // London
  assert.match(q ?? '', /adate=2026-11-10/); // Lagos
  assert.match(q ?? '', /from=LHR&to=LOS/);
  assert.equal(webQuery(f({ scheduledOut: null, estimatedOut: null })), null);
});

test('when to ask: not for a flight days away or long over, never for a cancelled flight', () => {
  const dep = at('2026-11-09T10:10:00Z');
  assert.deepEqual(webNeeds(f(), dep - 72 * HOUR), { links: false, facts: false });
  assert.deepEqual(webNeeds(f(), dep + 20 * HOUR), { links: false, facts: false });
  assert.deepEqual(webNeeds(f({ cancelled: true }), dep - 2 * HOUR), {
    links: false,
    facts: false,
  });
});

test('when to ask: links from a day before, departure facts from five hours before', () => {
  const dep = at('2026-11-09T10:10:00Z');
  assert.deepEqual(webNeeds(f(), dep - 20 * HOUR), { links: true, facts: false });
  assert.deepEqual(webNeeds(f(), dep - 3 * HOUR), { links: true, facts: true });
  // Everything the departure side could offer is already known: no need to ask.
  const known = f({ gateOut: '12', terminalOut: '5', boarding: '2026-11-09T09:35:00Z' });
  assert.equal(webNeeds(known, dep - 3 * HOUR).facts, false);
  // A boarding time alone is not worth a paid search: it comes along when the gate or terminal is asked for.
  assert.equal(webNeeds(f({ gateOut: '12', terminalOut: '5' }), dep - 3 * HOUR).facts, false);
  assert.equal(
    webNeeds(f({ gateOut: '12' }), dep - 3 * HOUR).facts,
    true,
    'terminal still missing',
  );
});

test('when to ask: once the flight has left, departure facts stop; arrival facts start two hours before landing', () => {
  const left = f({ actualOut: '2026-11-09T10:40:00Z', gateOut: null });
  assert.equal(webNeeds(left, at('2026-11-09T11:00:00Z')).facts, false);
  assert.equal(webNeeds(left, at('2026-11-09T14:30:00Z')).facts, true);
  assert.equal(webNeeds(left, at('2026-11-09T14:30:00Z')).links, true);
});

test('when to ask: a belt is worth asking for after landing, until two hours later', () => {
  const landed = f({
    actualOut: '2026-11-09T10:40:00Z',
    actualIn: '2026-11-09T16:00:00Z',
    gateIn: '3',
    terminalIn: 'I',
  });
  assert.equal(webNeeds(landed, at('2026-11-09T16:30:00Z')).facts, true, 'belt still missing');
  assert.equal(webNeeds({ ...landed, baggage: '4' }, at('2026-11-09T16:30:00Z')).facts, false);
  assert.equal(webNeeds(landed, at('2026-11-09T19:30:00Z')).facts, false, 'too late to matter');
});

test('overlay: a checked fact fills a gap and is remembered as web-sourced', () => {
  const o = webOverlay(
    f(),
    ok({ departureGate: item('12'), departureTerminal: item('5'), baggageBelt: item('3') }),
    at('2026-11-09T07:00:00Z'),
  );
  assert.equal(o.gateOut?.value, '12');
  assert.equal(o.terminalOut?.value, '5');
  assert.equal(o.baggage?.value, '3');
  assert.equal(o.checkedAt, '2026-11-09T07:00:00Z');
});

test('overlay: the provider’s value always wins, and nothing is shown twice', () => {
  const o = webOverlay(
    f({ gateOut: '9', terminalOut: '5', baggage: '7' }),
    ok({ departureGate: item('12'), departureTerminal: item('5'), baggageBelt: item('3') }),
    at('2026-11-09T07:00:00Z'),
  );
  assert.equal(o.gateOut, undefined);
  assert.equal(o.terminalOut, undefined);
  assert.equal(o.baggage, undefined);
});

test('overlay: after take-off a departure gate is no longer useful, but an arrival belt is', () => {
  const o = webOverlay(
    f({ actualOut: '2026-11-09T10:40:00Z' }),
    ok({ departureGate: item('12'), arrivalGate: item('B4'), baggageBelt: item('3') }),
    at('2026-11-09T15:00:00Z'),
  );
  assert.equal(o.gateOut, undefined);
  assert.equal(o.gateIn?.value, 'B4');
  assert.equal(o.baggage?.value, '3');
});

test('overlay: nothing from an off, capped or failed answer, or from a missing one', () => {
  for (const r of [
    null,
    undefined,
    { status: 'off' },
    { status: 'cap' },
    { status: 'error' },
    { status: 'ok' },
  ])
    assert.deepEqual(webOverlay(f(), r as any, at('2026-11-09T07:00:00Z')), {});
});

test('overlay: a boarding time becomes a real instant at the departure airport, and only if it is plausible', () => {
  const now = at('2026-11-09T07:00:00Z');
  assert.equal(
    webOverlay(f(), ok({ boardingTime: item('09:35') }), now).boarding?.iso,
    '2026-11-09T09:35:00.000Z',
  );
  // After departure, or the evening before: not a boarding time for this flight.
  assert.equal(webOverlay(f(), ok({ boardingTime: item('10:40') }), now).boarding, undefined);
  assert.equal(webOverlay(f(), ok({ boardingTime: item('04:00') }), now).boarding, undefined);
  // A provider’s own boarding time wins.
  assert.equal(
    webOverlay(f({ boarding: '2026-11-09T09:30:00Z' }), ok({ boardingTime: item('09:35') }), now)
      .boarding,
    undefined,
  );
});

test('key times: a web boarding time is labelled From the web, not Reported and not Typical', () => {
  const now = at('2026-11-09T07:00:00Z');
  const web = webOverlay(f(), ok({ boardingTime: item('09:35') }), now);
  const b = keyTimes(f(), web).find((x) => x.key === 'boarding');
  assert.equal(b?.t, '2026-11-09T09:35:00.000Z');
  assert.equal(b?.kind, 'From the web');
  assert.match(b?.note ?? '', /heathrow\.com/);
  // Without the overlay the answer is exactly what it was before.
  assert.equal(keyTimes(f()).find((x) => x.key === 'boarding')?.kind, 'Typical');
});

test('journey: boarding and the belt carry the same From the web label, and never count as done', () => {
  const now = at('2026-11-09T07:00:00Z');
  const web = webOverlay(f(), ok({ boardingTime: item('09:35'), baggageBelt: item('3') }), now);
  const steps = journeySteps(f(), web);
  const boarding = steps.find((s) => s.key === 'boarding');
  assert.equal(boarding?.kind, 'From the web');
  assert.equal(boarding?.t, '2026-11-09T09:35:00.000Z');
  assert.equal(boarding?.done, false, 'only the airline’s own report counts as done');
  const bags = steps.find((s) => s.key === 'bags');
  assert.equal(bags?.note, 'Belt 3');
  assert.equal(bags?.kind, 'From the web');
  assert.equal(bags?.done, false);
  // No overlay: unchanged.
  assert.equal(journeySteps(f()).find((s) => s.key === 'bags')?.note, 'Belt not assigned yet');
  // The airline’s own belt wins over the web’s.
  const own = journeySteps(
    f({ baggage: '7' }),
    webOverlay(f({ baggage: '7' }), ok({ baggageBelt: item('3') }), now),
  );
  assert.equal(own.find((s) => s.key === 'bags')?.note, 'Belt 7');
  assert.equal(own.find((s) => s.key === 'bags')?.kind, 'Belt reported');
});

test('overlay: a late-night flight boards the evening before, on the previous day', () => {
  const night = f({ scheduledOut: '2026-11-09T00:20:00Z', scheduledIn: '2026-11-09T08:00:00Z' });
  const o = webOverlay(night, ok({ boardingTime: item('23:50') }), at('2026-11-08T20:00:00Z'));
  assert.equal(o.boarding?.iso, '2026-11-08T23:50:00.000Z');
});

test('overlay: nothing is used unless the answer says ok, even if it carries items', () => {
  for (const status of ['off', 'cap', 'error'])
    assert.deepEqual(
      webOverlay(
        f(),
        { status, items: { departureGate: item('12') } } as any,
        at('2026-11-09T07:00:00Z'),
      ),
      {},
    );
});

test('a diverted flight gets no arrival facts for the airport it is no longer going to', () => {
  const div = f({ diverted: true });
  const o = webOverlay(
    div,
    ok({ arrivalGate: item('B4'), arrivalTerminal: item('I'), baggageBelt: item('3') }),
    at('2026-11-09T15:00:00Z'),
  );
  assert.deepEqual(o, {});
  assert.equal(webNeeds(div, at('2026-11-09T15:00:00Z')).facts, false);
});
