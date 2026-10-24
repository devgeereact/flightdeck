import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync(new URL('../public/consent.js', import.meta.url), 'utf8');
const GA = 'G-TEST123456';

function page({ id = GA, stored = null, hash = '', path = '/' } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><title>T</title>${id ? `<meta name="fd-ga-id" content="${id}">` : ''}</head><body><a href="#" data-fd-cookie-settings>Cookie settings</a></body></html>`,
    { url: `https://flightdeck.gakinz.com${path}${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const posted = [];
  w.fetch = (url, init) => { posted.push({ url, body: init && init.body }); return Promise.resolve({ ok: true }); };
  if (stored) w.localStorage.setItem('fd-consent', JSON.stringify(stored));
  w.eval(code);
  if (w.document.readyState === 'loading') w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const googleScripts = () => [...w.document.querySelectorAll('script')].filter((s) => /googletagmanager|google-analytics/.test(s.src));
  const dl = () => JSON.parse(JSON.stringify([...(w.dataLayer || [])].map((a) => [...a]))); // plain objects: jsdom values come from another realm
  const banner = () => w.document.querySelector('.fd-cc');
  const click = (sel) => w.document.querySelector(sel).dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  return { w, posted, googleScripts, dl, banner, click };
}

test('no Measurement ID: the script does nothing at all (no banner, no Google, no cookies)', () => {
  const p = page({ id: '' });
  assert.equal(p.w.fdConsent.enabled, false);
  assert.equal(p.banner(), null);
  assert.equal(p.googleScripts().length, 0);
  assert.equal(p.posted.length, 0);
  p.w.fdConsent.event('flight_search', { result: 'ok' });
  assert.equal(p.dl().length, 0);
});

test('a malformed Measurement ID is ignored rather than trusted', () => {
  for (const bad of ['UA-12345', 'G-<script>', 'G-', 'g-abcdef12', 'G-ABCDEF1234567890123']) assert.equal(page({ id: bad }).w.fdConsent.enabled, false, bad);
});

test('first visit: banner with two equally weighted buttons, and NOTHING is sent to Google', () => {
  const p = page();
  assert.ok(p.banner());
  const buttons = [...p.banner().querySelectorAll('button')].map((b) => b.textContent);
  assert.deepEqual(buttons, ['Accept analytics', 'Reject analytics']);
  assert.equal(p.googleScripts().length, 0);
  assert.equal(p.dl().length, 0);
  assert.equal(p.w.fdConsent.get(), null);
  assert.ok(p.banner().querySelector('a[href="/cookies/"]'));
});

test('events are never sent before consent', () => {
  const p = page();
  p.w.fdConsent.event('flight_search', { result: 'ok' });
  p.w.fdConsent.pageview();
  assert.equal(p.dl().length, 0);
});

test('accept: consent defaults are all denied, then ONLY analytics is granted; ads stay denied; tag loads', () => {
  const p = page();
  p.click('[data-fd="accept"]');
  const d = p.dl();
  assert.deepEqual(d[0], ['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  assert.deepEqual(d[2], ['consent', 'update', { analytics_storage: 'granted' }]);
  const config = d.find((x) => x[0] === 'config');
  assert.equal(config[1], GA);
  assert.equal(config[2].send_page_view, false);
  assert.equal(config[2].allow_google_signals, false);
  assert.equal(config[2].allow_ad_personalization_signals, false);
  assert.ok(!JSON.stringify(d).includes('"ad_storage":"granted"'));
  assert.equal(p.googleScripts().length, 1);
  assert.ok(p.googleScripts()[0].src.startsWith('https://www.googletagmanager.com/gtag/js?id=' + GA));
  assert.equal(p.banner(), null);
  assert.equal(p.w.fdConsent.get().analytics, true);
});

test('reject: no tag, no data layer, choice remembered, banner gone', () => {
  const p = page();
  p.click('[data-fd="reject"]');
  assert.equal(p.googleScripts().length, 0);
  assert.equal(p.dl().length, 0);
  assert.equal(p.banner(), null);
  assert.equal(p.w.fdConsent.get().analytics, false);
});

test('the choice is counted anonymously on our own server only', () => {
  const a = page(); a.click('[data-fd="accept"]');
  const r = page(); r.click('[data-fd="reject"]');
  assert.deepEqual(a.posted.map((x) => [x.url, JSON.parse(x.body).name]), [['/api/event', 'consent_accept']]);
  assert.deepEqual(r.posted.map((x) => [x.url, JSON.parse(x.body).name]), [['/api/event', 'consent_reject']]);
});

test('a remembered ACCEPT loads analytics on the next page without asking again; a remembered REJECT stays silent', () => {
  const yes = page({ stored: { v: 1, analytics: true } });
  assert.equal(yes.banner(), null);
  assert.equal(yes.googleScripts().length, 1);
  const no = page({ stored: { v: 1, analytics: false } });
  assert.equal(no.banner(), null);
  assert.equal(no.googleScripts().length, 0);
  assert.equal(no.dl().length, 0);
});

test('an old or corrupted stored choice asks again instead of assuming consent', () => {
  for (const stored of [{ v: 0, analytics: true }, { v: 1, analytics: 'yes' }, { analytics: true }, { v: 2, analytics: true }]) {
    const p = page({ stored });
    assert.ok(p.banner(), JSON.stringify(stored));
    assert.equal(p.googleScripts().length, 0);
  }
  const bad = page(); bad.w.localStorage.setItem('fd-consent', '{not json'); 
});

test('events: only whitelisted names and parameters, short strings, nothing personal', () => {
  const p = page({ stored: { v: 1, analytics: true } });
  const before = p.dl().length;
  p.w.fdConsent.event('flight_search', { result: 'ok', flight: 'BA117', email: 'a@b.c', user_id: 'u1' });
  p.w.fdConsent.event('not_allowed', { result: 'ok' });
  p.w.fdConsent.event('checklist_completed', { bucket: 'x'.repeat(200) });
  const added = p.dl().slice(before);
  assert.equal(added.length, 2);
  assert.deepEqual(added[0], ['event', 'flight_search', { result: 'ok' }]);
  assert.equal(added[1][2].bucket.length, 40);
});

test('page views carry no query string and no secrets, only path and hash route', () => {
  const p = page({ stored: { v: 1, analytics: true }, path: '/', hash: '#/checklist?token=SECRET' });
  const pv = p.dl().find((x) => x[0] === 'event' && x[1] === 'page_view');
  assert.equal(pv[2].page_location, 'https://flightdeck.gakinz.com/#/checklist');
  assert.ok(!JSON.stringify(p.dl()).includes('SECRET'));
});

test('changing your mind later: reject after accept switches Google off and removes its cookies', () => {
  const p = page({ stored: { v: 1, analytics: true } });
  p.w.document.cookie = '_ga=GA1.1.1; path=/';
  p.w.document.cookie = '_ga_TEST123456=GS1; path=/';
  p.w.document.cookie = 'keepme=1; path=/';
  p.click('[data-fd-cookie-settings]');
  assert.ok(p.banner());
  assert.ok(p.banner().textContent.includes('Currently: analytics accepted'));
  p.click('[data-fd="reject"]');
  assert.equal(p.w['ga-disable-' + GA], true);
  assert.deepEqual(p.dl().filter((x) => x[0] === 'consent').pop(), ['consent', 'update', { analytics_storage: 'denied' }]);
  assert.ok(!p.w.document.cookie.includes('_ga'));
  assert.ok(p.w.document.cookie.includes('keepme=1'));
  const before = p.dl().length;
  p.w.fdConsent.event('flight_search', { result: 'ok' });
  assert.equal(p.dl().length, before);
});

test('"Cookie settings" reopens the banner from anywhere and never stacks two banners', () => {
  const p = page({ stored: { v: 1, analytics: false } });
  p.click('[data-fd-cookie-settings]');
  p.click('[data-fd-cookie-settings]');
  assert.equal(p.w.document.querySelectorAll('.fd-cc').length, 1);
  p.click('[data-fd="accept"]');
  assert.equal(p.googleScripts().length, 1);
  assert.equal(p.w.document.querySelectorAll('.fd-cc').length, 0);
});

test('banner is accessible: dialog role, labelled, first button focusable', () => {
  const p = page();
  assert.equal(p.banner().getAttribute('role'), 'dialog');
  assert.equal(p.banner().getAttribute('aria-labelledby'), 'fd-cc-title');
  assert.ok(p.w.document.getElementById('fd-cc-title'));
});
