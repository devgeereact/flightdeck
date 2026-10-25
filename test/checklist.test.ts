import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATE, TEMPLATE_ITEM_COUNT } from '../src/features/checklist/checklistTemplate.ts';
import * as M from '../src/features/checklist/checklistModel.ts';

const T0 = 1_800_000_000_000;
const start = () => M.addTrip(M.emptyData(), 'Cape Town', { number: 'BA59', date: '2026-10-24' }, T0);

test('template: transcribed from the paper form, unique stable ids, nothing empty', () => {
  assert.equal(TEMPLATE.length, 8);
  assert.equal(TEMPLATE_ITEM_COUNT, 101);
  const ids = TEMPLATE.flatMap((s) => s.items.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^cl\.[a-z]+\.\d+$/.test(id)));
  assert.ok(TEMPLATE.every((s) => s.items.every((i) => i.text.trim().length > 0 && i.text.length <= M.LIMITS.label)));
  assert.deepEqual(TEMPLATE.map((s) => s.id), ['advance', 'clothes', 'bathroom', 'accessories', 'papers', 'work', 'night', 'last']);
  assert.ok(TEMPLATE.find((s) => s.id === 'papers')!.items.some((i) => i.text === 'Passport'));
});

test('a new trip is active, named, and starts with nothing ticked', () => {
  const d = start();
  assert.equal(d.trips.length, 1);
  assert.equal(d.active, d.trips[0].id);
  assert.deepEqual(M.doneIds(d.trips[0]), []);
  assert.equal(M.progress(M.view(d, d.active)).percent, 0);
  assert.equal(M.progress(M.view(d, d.active)).total, 101);
});

test('tick / untick / reset affect only that trip and are idempotent', () => {
  let d = start();
  const a = d.trips[0].id;
  d = M.addTrip(d, 'Second', undefined, T0 + 1);
  const b = d.trips[1].id;
  d = M.tick(d, a, 'cl.papers.2', true, T0 + 2);
  d = M.tick(d, a, 'cl.papers.2', true, T0 + 3);
  assert.deepEqual(M.doneIds(d.trips.find((t) => t.id === a)!), ['cl.papers.2']);
  assert.deepEqual(M.doneIds(d.trips.find((t) => t.id === b)!), []);
  assert.equal(M.progress(M.view(d, a)).done, 1);
  d = M.tick(d, a, 'cl.papers.2', false, T0 + 4);
  assert.deepEqual(M.doneIds(d.trips.find((t) => t.id === a)!), []);
  d = M.tick(d, a, 'cl.papers.1', true, T0 + 5);
  d = M.resetTicks(d, a, T0 + 6);
  assert.deepEqual(M.doneIds(d.trips.find((t) => t.id === a)!), []);
});

test('editing the list: add, rename, hide, restore; custom items delete outright and untick everywhere', () => {
  let d = start();
  const a = d.trips[0].id;
  d = M.addItem(d, 'papers', '  Travel   pillow ', T0 + 1);
  d = M.addItem(d, 'papers', 'travel pillow', T0 + 2); // duplicate (case-insensitive) ignored
  assert.equal(d.tpl.added.length, 1);
  assert.equal(d.tpl.added[0].text, 'Travel pillow');
  assert.equal(M.addItem(d, 'nope', 'x', T0 + 3), d); // unknown section ignored
  assert.equal(M.addItem(d, 'papers', '   ', T0 + 3), d);
  const custom = d.tpl.added[0].id;
  d = M.tick(d, a, custom, true, T0 + 4);
  assert.equal(M.view(d, a).find((s) => s.id === 'papers')!.items.at(-1)!.text, 'Travel pillow');
  d = M.renameItem(d, 'cl.papers.2', 'Passport (valid 6 months)', T0 + 5);
  assert.equal(M.view(d, a).find((s) => s.id === 'papers')!.items[1].text, 'Passport (valid 6 months)');
  d = M.removeItem(d, 'cl.clothes.4', T0 + 6);
  const clothes = M.view(d, a).find((s) => s.id === 'clothes')!;
  assert.equal(clothes.items.length, 19);
  assert.equal(clothes.hiddenCount, 1);
  d = M.restoreAll(d, T0 + 7);
  assert.equal(M.view(d, a).find((s) => s.id === 'clothes')!.items.length, 20);
  d = M.removeItem(d, custom, T0 + 8);
  assert.equal(d.tpl.added.length, 0);
  assert.deepEqual(M.doneIds(d.trips[0]), []);
});

test('hide and show a whole section (e.g. work items on a holiday)', () => {
  let d = start();
  d = M.hideSection(d, 'work', T0 + 1);
  assert.equal(M.view(d, d.active).find((s) => s.id === 'work')!.items.length, 0);
  assert.equal(M.progress(M.view(d, d.active)).total, 91);
  d = M.showSection(d, 'work', T0 + 2);
  assert.equal(M.progress(M.view(d, d.active)).total, 101);
});

test('removing a trip leaves a tombstone and picks another active trip', () => {
  let d = start();
  d = M.addTrip(d, 'B', undefined, T0 + 1);
  const [a, b] = d.trips.map((t) => t.id);
  d = M.removeTrip(d, b, T0 + 2);
  assert.equal(d.active, a);
  assert.equal(d.gone[b], T0 + 2);
  assert.equal(d.trips.length, 1);
});

test('limits: trips, label length, total size', () => {
  let d = M.emptyData();
  for (let i = 0; i < 20; i++) d = M.addTrip(d, `T${i}`, undefined, T0 + i);
  assert.equal(d.trips.length, M.LIMITS.trips);
  d = M.addItem(d, 'last', 'x'.repeat(500), T0 + 99);
  assert.equal(d.tpl.added[0].text.length, M.LIMITS.label);
  assert.ok(M.fits(d));
  const huge = { ...d, tpl: { ...d.tpl, renamed: Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [`k${i}`, 'y'.repeat(60)])) } };
  assert.equal(M.fits(huge), false);
});

test('sanitize: garbage in, safe data out; never throws', () => {
  for (const bad of [null, undefined, 5, 'x', [], { trips: 'no' }, { tpl: 7 }, { trips: [{ id: 1 }] }]) assert.doesNotThrow(() => M.sanitize(bad));
  const d = M.sanitize({ rev: -3, tpl: { hidden: ['a', 5, null], renamed: { a: '  ', b: 'ok' }, added: [{ id: 'z', sec: 'last', text: 'hi' }, { id: 1 }] },
    trips: [{ id: 't', name: '', updatedAt: 'x', done: ['a', 'a', 7] }], active: 'missing' }); // old format: a plain list of ticked ids
  assert.equal(d.rev, 0);
  assert.deepEqual(d.tpl.hidden, ['a']);
  assert.deepEqual(d.tpl.renamed, { b: 'ok' });
  assert.equal(d.tpl.added.length, 1);
  assert.equal(d.trips[0].name, 'My trip');
  assert.deepEqual(M.doneIds(d.trips[0]), ['a']);
  assert.equal(d.active, 't');
});

test('merge: newest wins per trip, template edits follow the newer copy, deletes win over older copies', () => {
  const base = start();
  const id = base.trips[0].id;
  const phone = M.tick(base, id, 'cl.papers.2', true, T0 + 10);
  const laptop = M.tick(base, id, 'cl.papers.1', true, T0 + 20);
  const m = M.merge(phone, laptop, T0 + 1000);
  assert.deepEqual(M.doneIds(m.trips[0]).sort(), ['cl.papers.1', 'cl.papers.2']); // ticks from BOTH devices survive
  assert.deepEqual(M.merge(laptop, phone, T0 + 1000), m); // symmetric
  assert.deepEqual(M.merge(m, m, T0 + 1000), m); // idempotent
  // a stale copy with one fresh tick must not wipe out many older ticks made elsewhere
  let busy = base;
  for (let i = 1; i <= 20; i++) busy = M.tick(busy, id, `cl.clothes.${i}`, true, T0 + 10 + i);
  const staleCopy = M.tick(base, id, 'cl.last.1', true, T0 + 500);
  assert.equal(M.doneIds(M.merge(busy, staleCopy, T0 + 1000).trips[0]).length, 21);
  // an untick newer than a tick on the other device wins; an older one does not
  const unticked = M.tick(phone, id, 'cl.papers.2', false, T0 + 40);
  assert.deepEqual(M.doneIds(M.merge(phone, unticked, T0 + 1000).trips[0]), []);
  const tickedAgain = M.tick(unticked, id, 'cl.papers.2', true, T0 + 60);
  assert.deepEqual(M.doneIds(M.merge(unticked, tickedAgain, T0 + 1000).trips[0]), ['cl.papers.2']);
  // a rename on one device and a tick on another both survive
  const renamed = M.renameTrip(base, id, 'Cape Town in October', T0 + 70);
  const both = M.merge(renamed, M.tick(base, id, 'cl.papers.2', true, T0 + 80), T0 + 1000);
  assert.equal(both.trips[0].name, 'Cape Town in October');
  assert.deepEqual(M.doneIds(both.trips[0]), ['cl.papers.2']);

  const tplA = M.addItem(base, 'last', 'Umbrella', T0 + 30);
  const tplB = M.renameItem(base, 'cl.last.1', 'Coat packed', T0 + 40);
  assert.equal(M.merge(tplA, tplB).tpl.renamed['cl.last.1'], 'Coat packed');
  assert.deepEqual(M.merge(tplA, tplB), M.merge(tplB, tplA));

  const deleted = M.removeTrip(base, id, T0 + 50);
  const stale = M.tick(base, id, 'cl.papers.3', true, T0 + 45);
  assert.equal(M.merge(deleted, stale).trips.length, 0); // delete newer than the other device's edit
  const revived = M.tick(base, id, 'cl.papers.3', true, T0 + 60);
  assert.equal(M.merge(deleted, revived).trips.length, 1); // edit newer than the delete keeps the trip
});

test('merge keeps trips created on different devices', () => {
  const a = M.addTrip(M.emptyData(), 'Phone trip', undefined, T0 + 1);
  const b = M.addTrip(M.emptyData(), 'Laptop trip', undefined, T0 + 2);
  assert.equal(M.merge(a, b).trips.length, 2);
});

test('isBlank: an untouched list is not worth syncing or keeping', () => {
  assert.ok(M.isBlank(M.emptyData()));
  assert.ok(!M.isBlank(start()));
  assert.ok(!M.isBlank(M.hideSection(M.emptyData(), 'work', T0)));
});

// ---- account sync (two devices against a fake server with the same revision rules as the PHP API) ----
import { syncOnce, type Api } from '../src/features/checklist/checklistSync.ts';
function fakeServer() {
  const s = { rev: 0, data: null as unknown, puts: 0, conflicts: 0, failNext: 0 };
  const api: Api = {
    async get() { if (s.failNext) { s.failNext--; throw new Error('offline'); } return { rev: s.rev, data: s.data == null ? null : JSON.parse(JSON.stringify(s.data)) }; },
    async put(base, data) {
      if (s.failNext) { s.failNext--; throw new Error('offline'); }
      s.puts++;
      if (base !== s.rev) { s.conflicts++; return { ok: false, rev: s.rev, data: JSON.parse(JSON.stringify(s.data)) }; }
      s.rev++; s.data = JSON.parse(JSON.stringify(data)); return { ok: true, rev: s.rev };
    },
  };
  return { s, api };
}

test('sync: a blank device with a blank server does nothing (no pointless write)', async () => {
  const { s, api } = fakeServer();
  const r = await syncOnce(M.emptyData(), api);
  assert.equal(s.puts, 0);
  assert.ok(M.isBlank(r));
});

test('sync: first device uploads, second device downloads the same list', async () => {
  const { s, api } = fakeServer();
  let phone = start();
  const id = phone.trips[0].id;
  phone = M.tick(phone, id, 'cl.papers.2', true, T0 + 5);
  phone = await syncOnce(phone, api);
  assert.equal(s.rev, 1);
  const laptop = await syncOnce(M.emptyData(), api);
  assert.equal(laptop.trips.length, 1);
  assert.deepEqual(M.doneIds(laptop.trips[0]), ['cl.papers.2']);
  assert.equal(s.puts, 1); // the laptop only read
});

test('sync: edits on both devices end up the same everywhere (newest wins per trip, template edits kept)', async () => {
  const { api } = fakeServer();
  let phone = await syncOnce(start(), api);
  let laptop = await syncOnce(M.emptyData(), api);
  const id = phone.trips[0].id;
  phone = M.tick(phone, id, 'cl.papers.2', true, T0 + 100);
  laptop = M.addItem(laptop, 'last', 'Umbrella', T0 + 200);
  laptop = M.tick(laptop, id, 'cl.papers.1', true, T0 + 300); // newer than the phone's tick
  phone = await syncOnce(phone, api);
  laptop = await syncOnce(laptop, api);
  phone = await syncOnce(phone, api);
  assert.deepEqual(phone.trips, laptop.trips);
  assert.deepEqual(phone.tpl, laptop.tpl);
  assert.equal(phone.tpl.added[0].text, 'Umbrella');
});

test('sync: a conflict (someone saved in between) is merged and retried, not lost', async () => {
  const { s, api } = fakeServer();
  let a = await syncOnce(start(), api);
  const id = a.trips[0].id;
  // Another device writes while we are mid-sync: bump the server behind our back after our pull.
  const racing: Api = { ...api, async get() { const r = await api.get(); s.rev++; s.data = JSON.parse(JSON.stringify(M.tick(sanitizeCopy(s.data), id, 'cl.last.1', true, T0 + 900))); return r; } };
  a = M.tick(a, id, 'cl.papers.2', true, T0 + 800);
  const out = await syncOnce(a, racing);
  assert.ok(s.conflicts >= 1);
  assert.deepEqual(M.doneIds(out.trips[0]).sort(), ['cl.last.1', 'cl.papers.2'].sort()); // both devices' ticks survive the conflict
});
function sanitizeCopy(x: unknown) { return M.sanitize(x); }

test('sync: offline failures reject cleanly and leave the local list untouched', async () => {
  const { s, api } = fakeServer();
  const local = start();
  s.failNext = 1;
  await assert.rejects(() => syncOnce(local, api));
  assert.equal(local.trips.length, 1);
  const ok = await syncOnce(local, api); // later, back online
  assert.equal(s.rev, 1);
  assert.equal(ok.rev, 1);
});

test('sync: a trip deleted on one device is deleted on the other, and not resurrected', async () => {
  const { api } = fakeServer();
  let phone = await syncOnce(start(), api);
  let laptop = await syncOnce(M.emptyData(), api);
  const id = phone.trips[0].id;
  phone = M.removeTrip(phone, id, T0 + 1000);
  phone = await syncOnce(phone, api);
  laptop = await syncOnce(laptop, api);
  assert.equal(laptop.trips.length, 0);
  phone = await syncOnce(phone, api);
  assert.equal(phone.trips.length, 0);
});
