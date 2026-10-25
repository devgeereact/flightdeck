import test from 'node:test';
import assert from 'node:assert/strict';
import { suggest, RULE_IDS } from '../src/features/checklist/checklistRules.ts';
import { contextFromFlight, haversineKm, isRainy, weatherStale, type TripContext } from '../src/features/checklist/tripContext.ts';
import { summarise } from '../src/features/flight/summary.ts';
import * as M from '../src/features/checklist/checklistModel.ts';
import { TEMPLATE } from '../src/features/checklist/checklistTemplate.ts';

const ctx = (o: Partial<TripContext> = {}): TripContext => ({ dir: 'outbound', intl: true, dest: 'CPT', destName: 'Cape Town', lat: -33.97, lon: 18.6, tempC: 18, rain: false, km: 9670, at: 1, ...o });
const items = TEMPLATE.flatMap((s) => s.items.map((i) => i.text));
const ids = (s: ReturnType<typeof suggest>) => s.map((x) => x.id);

test('haversine: London to New York is about 5,540 km; London to itself is 0', () => {
  const d = haversineKm({ lat: 51.47, lon: -0.4543 }, { lat: 40.6413, lon: -73.7781 });
  assert.ok(d > 5500 && d < 5580, String(d));
  assert.equal(Math.round(haversineKm({ lat: 1, lon: 1 }, { lat: 1, lon: 1 })), 0);
});

test('rain codes: drizzle, rain, showers and storms are rain; clear, cloud, fog, snow are not', () => {
  for (const c of [51, 55, 61, 65, 67, 80, 82, 95, 99]) assert.ok(isRainy(c), String(c));
  for (const c of [0, 1, 3, 45, 48, 71, 75, 77, 85, null, undefined]) assert.ok(!isRainy(c as any), String(c));
});

const flight: any = { number: 'BA59', direction: { type: 'outbound' }, origin: { code: 'LHR', city: 'London', name: 'Heathrow', countryCode: 'GB', lat: 51.47, lon: -0.45, timezone: 'Europe/London' },
  destination: { code: 'CPT', city: 'Cape Town', name: 'Cape Town', countryCode: 'ZA', lat: -33.97, lon: 18.6, timezone: 'Africa/Johannesburg' } };

test('context from a flight: direction, international, destination, distance, weather; unknowns stay null', () => {
  const c = contextFromFlight(flight, { temperature_2m: 6.4, weather_code: 61 }, 1000)!;
  assert.deepEqual([c.dir, c.intl, c.dest, c.destName, c.tempC, c.rain, c.at], ['outbound', true, 'CPT', 'Cape Town', 6, true, 1000]);
  assert.ok(c.km! > 9000 && c.km! < 10000);
  const none = contextFromFlight({ ...flight, origin: { code: '—', name: 'x', city: '', country: '', timezone: null, lat: null, lon: null }, direction: undefined }, null)!;
  assert.deepEqual([none.dir, none.intl, none.km, none.tempC, none.rain], [null, null, null, null, null]);
  assert.equal(contextFromFlight({ ...flight, destination: { code: '—', name: '', city: '' } } as any, null), null);
  assert.equal(weatherStale(c, 1000 + 7 * 3600 * 1000), true);
  assert.equal(weatherStale(c, 1000 + 3600 * 1000), false);
});

test('no context means no suggestions (never guess)', () => {
  assert.deepEqual(suggest(null, 5, items), []);
  assert.deepEqual(suggest(undefined, null, items), []);
});

test('international outbound: official-advice reminder, bank, roaming; and the first one points to GOV.UK, not an invented rule', () => {
  const s = suggest(ctx(), null, items);
  assert.ok(ids(s).includes('sg.gov-advice') && ids(s).includes('sg.bank') && ids(s).includes('sg.roaming'));
  assert.match(s.find((x) => x.id === 'sg.gov-advice')!.text, /GOV\.UK/);
  assert.ok(!s.some((x) => /visa required|you need a visa|passport must/i.test(x.text + x.why)));
});

test('weather rules use the destination weather and say why', () => {
  const cold = suggest(ctx({ tempC: 2, intl: null, km: null }), null, items);
  assert.deepEqual(ids(cold), ['sg.cold']);
  assert.match(cold[0].why, /2°C in Cape Town/);
  assert.deepEqual(ids(suggest(ctx({ tempC: 28, intl: null, km: null }), null, items)), ['sg.sun', 'sg.sunglasses']);
  assert.deepEqual(ids(suggest(ctx({ tempC: 12, rain: true, intl: null, km: null }), null, items)), ['sg.rain']);
  assert.deepEqual(suggest(ctx({ tempC: null, rain: null, intl: null, km: null }), null, items), []);
  assert.deepEqual(suggest(ctx({ tempC: 5.0, intl: null, km: null }), null, items).map((x) => x.id), ['sg.cold']);
  assert.deepEqual(suggest(ctx({ tempC: 6, intl: null, km: null }), null, items), []);
});

test('long-haul rules need a known distance; nights rules need a trip length', () => {
  assert.ok(ids(suggest(ctx({ km: 5000, intl: null }), null, items)).includes('sg.neck-pillow'));
  assert.ok(!ids(suggest(ctx({ km: 1200, intl: null }), null, items)).includes('sg.neck-pillow'));
  assert.ok(!ids(suggest(ctx({ km: null, intl: null }), null, items)).includes('sg.neck-pillow'));
  assert.ok(ids(suggest(ctx({ km: null, intl: null }), 10, items)).includes('sg.laundry'));
  assert.ok(!ids(suggest(ctx({ km: null, intl: null }), 3, items)).includes('sg.laundry'));
  assert.ok(!ids(suggest(ctx({ km: null, intl: null }), null, items)).includes('sg.laundry'));
  assert.ok(!ids(suggest(ctx({ km: null, intl: null }), 0, items)).includes('sg.laundry'));
  assert.ok(!ids(suggest(ctx({ km: null, intl: null }), NaN, items)).includes('sg.laundry'));
});

test('direction rules: domestic asks for photo ID; inbound plans the journey home; domestic flights get no passport or roaming advice', () => {
  const dom = suggest(ctx({ dir: 'domestic', intl: false, km: 500, tempC: null, rain: null }), null, items);
  assert.deepEqual(ids(dom), ['sg.id']);
  const inb = suggest(ctx({ dir: 'inbound', intl: true, km: null, tempC: null, rain: null }), null, items);
  assert.ok(ids(inb).includes('sg.home') && ids(inb).includes('sg.customs') && !ids(inb).includes('sg.gov-advice') && !ids(inb).includes('sg.roaming'));
});

test('a suggestion already on the list (any wording that contains it) is not offered again; hidden template items do not block it', () => {
  const have = [...items, 'Sun cream', 'my SUNGLASSES please'];
  assert.deepEqual(ids(suggest(ctx({ tempC: 30, intl: null, km: null }), null, have)), []);
  assert.deepEqual(ids(suggest(ctx({ tempC: 30, intl: null, km: null }), null, [])), ['sg.sun', 'sg.sunglasses']);
});

test('dismissed suggestions stay dismissed; the list is capped; order is stable', () => {
  const all = suggest(ctx({ tempC: 1, rain: true, km: 9000 }), 14, []);
  assert.equal(all.length, 6);
  assert.deepEqual(ids(all), ids(suggest(ctx({ tempC: 1, rain: true, km: 9000 }), 14, [])));
  const less = suggest(ctx({ tempC: 1, rain: true, km: 9000 }), 14, [], ['sg.gov-advice', 'sg.bank']);
  assert.ok(!ids(less).includes('sg.gov-advice') && !ids(less).includes('sg.bank'));
  assert.ok(RULE_IDS.every((id) => /^sg\.[a-z-]+$/.test(id)) && new Set(RULE_IDS).size === RULE_IDS.length);
});

test('every suggestion points at a real section and fits the label limit', () => {
  const sections = new Set(TEMPLATE.map((s) => s.id));
  const everything = suggest(ctx({ dir: 'outbound', tempC: 30, rain: true, km: 9000 }), 14, [], [], 99).concat(suggest(ctx({ dir: 'inbound', tempC: 0 }), 14, [], [], 99), suggest(ctx({ dir: 'domestic', intl: false }), null, [], [], 99));
  assert.ok(everything.length >= 12);
  for (const s of everything) assert.ok(sections.has(s.section) && s.text.length <= M.LIMITS.label && s.why.length > 5, s.id);
});

test('trip model: nights and context are kept, validated, merged; dismissing is a mark that is not counted as packed', () => {
  let d = M.addTrip(M.emptyData(), 'Cape Town', { number: 'BA59', date: '2026-10-24' }, 1000);
  const id = d.trips[0].id;
  d = M.setNights(d, id, 9, 2000);
  d = M.setContext(d, id, ctx(), 3000);
  d = M.dismiss(d, id, 'sg.bank', 4000);
  assert.equal(d.trips[0].nights, 9);
  assert.equal(d.trips[0].ctx!.destName, 'Cape Town');
  assert.deepEqual(M.dismissedIds(d.trips[0]), ['sg.bank']);
  assert.deepEqual(M.doneIds(d.trips[0]), []);
  assert.equal(M.progress(M.view(d, id)).done, 0);
  assert.equal(M.sanitize(JSON.parse(JSON.stringify(d))).trips[0].ctx!.tempC, 18);
  const other = M.setNights(d, id, null, 5000);
  assert.equal(M.merge(d, other, 6000).trips[0].nights, undefined); // the newer edit (clearing nights) wins
  const evil = M.sanitize({ trips: [{ id: 't', name: 'x', updatedAt: 1, marks: {}, nights: 9999, ctx: { dest: '<script>', tempC: 9999 } }] });
  assert.equal(evil.trips[0].nights, undefined);
  assert.equal(evil.trips[0].ctx, undefined);
  const odd = M.sanitize({ trips: [{ id: 't', name: 'x', updatedAt: 1, marks: {}, ctx: { dest: 'CPT', destName: 'Cape'.repeat(30), tempC: 9999, lat: 500, dir: 'sideways' } }] });
  assert.deepEqual([odd.trips[0].ctx!.tempC, odd.trips[0].ctx!.lat, odd.trips[0].ctx!.dir, odd.trips[0].ctx!.destName.length <= 40], [null, null, null, true]);
});

// ---- plain-English summary: only reported facts ----
const f = (o: any = {}) => ({ ...flight, number: 'BA59', airline: 'British Airways', status: 'Scheduled', providerStatus: 'Expected', cancelled: false, diverted: false, scheduledOut: '2026-10-24T21:30:00.000Z', estimatedOut: '2026-10-24T21:30:00.000Z', actualOut: null, estimatedIn: null, actualIn: null, landing: null,
  gateOut: null, terminalOut: '5', baggage: null, delayMinutes: 0, progress: null, liveUpdates: false, ...o });

test('summary: scheduled outbound flight with a terminal and no gate', () => {
  const s = summarise(f());
  assert.equal(s[0], 'BA59 is an outbound flight from London (LHR) to Cape Town (CPT).');
  assert.ok(s.some((x) => /is scheduled to leave at 22:30 London time on \w{3},? 24 Oct/.test(x)), s.join(' | '));
  assert.ok(s.some((x) => x === 'Departing from Terminal 5.'));
  assert.ok(!s.some((x) => /late|early/.test(x)));
});

test('summary: delays, early running (only with live data), cancellation, diversion, usual-route-only', () => {
  assert.ok(summarise(f({ estimatedOut: '2026-10-24T22:09:00.000Z', delayMinutes: 39 })).some((x) => /now expected to leave at 23:09 London time/.test(x)));
  assert.ok(summarise(f({ delayMinutes: 39 })).includes('It is running 39 minutes late.'));
  assert.ok(summarise(f({ delayMinutes: 1 })).includes('It is running 1 minute late.'));
  assert.ok(!summarise(f({ delayMinutes: -5, liveUpdates: false })).some((x) => /early/.test(x)));
  assert.ok(summarise(f({ delayMinutes: -5, liveUpdates: true })).includes('It is 5 minutes early.'));
  assert.ok(summarise(f({ cancelled: true, providerStatus: 'Canceled' })).some((x) => /cancelled\. Contact the airline/.test(x)));
  assert.ok(summarise(f({ diverted: true })).some((x) => /diverted/.test(x)));
  const usual = summarise(f({ usualRouteOnly: true, scheduledOut: null, estimatedOut: null, terminalOut: null }));
  assert.ok(usual.some((x) => /No schedule is published/.test(x)) && !usual.some((x) => /scheduled to leave|Departing from|gate is not reported/.test(x)));
});

test('summary: in the air and arrived, with belt only when reported', () => {
  const air = summarise(f({ providerStatus: 'EnRoute', progress: 73, progressBasis: 'times', estimatedIn: '2026-10-25T09:00:00.000Z' }));
  assert.ok(air.some((x) => /in the air, about 73% of the way \(estimated\)\. Expected at the gate around 11:00 Cape Town time\./.test(x)), air.join(' | '));
  assert.ok(!air.some((x) => /Departing from/.test(x)));
  const done = summarise(f({ providerStatus: 'Arrived', progress: 100, progressBasis: 'status', actualIn: '2026-10-25T08:47:00.000Z', baggage: '9' }));
  assert.ok(done.some((x) => /has arrived and reached the gate at 10:47, Cape Town time/.test(x)) && done.includes('Baggage belt: 9.'));
  assert.ok(summarise(f({ providerStatus: 'Arrived', actualIn: '2026-10-25T08:47:00.000Z', baggage: null })).some((x) => /No baggage belt has been reported yet/.test(x)));
});

test('summary: a missing gate is said to be missing; the usual terminal hint is labelled unconfirmed; nothing undefined ever leaks', () => {
  assert.ok(summarise(f({ terminalOut: null })).some((x) => /gate is not reported yet/.test(x)));
  const hint = summarise(f({ terminalOut: null, terminalOutHint: '5' }));
  assert.ok(hint.some((x) => /usual terminal for this airline here is 5, but it is not confirmed/.test(x)));
  for (const flightLike of [f(), f({ terminalOut: null, gateOut: 'B34' }), f({ origin: { code: '—', name: 'Airport unavailable', city: '' } }), f({ scheduledOut: null, estimatedOut: null }), f({ direction: undefined })]) {
    const text = summarise(flightLike).join(' ');
    assert.ok(!/undefined|null|NaN|\[object/.test(text), text);
  }
  assert.ok(summarise(f({ gateOut: 'B34' })).includes('Departing from Terminal 5, gate B34.'));
});
