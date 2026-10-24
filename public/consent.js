/*
 * Flightdeck cookie choices + Google Analytics 4 loader. One plain script shared by the app and the static public pages.
 *
 * - If no GA4 Measurement ID is present (<meta name="fd-ga-id">), this does nothing at all: no banner, no cookies, no requests.
 * - Google's tag (gtag.js) is NOT requested until the visitor presses Accept. Reject (or ignoring the banner) means no request to Google.
 * - Consent Mode defaults are all "denied"; accepting grants analytics_storage only. Advertising consent is never granted here.
 * - Only a short whitelist of event names and parameters can be sent; no user id, no flight numbers, no query strings.
 * - The choice is remembered (and re-asked if VERSION changes). "Cookie settings" links (data-fd-cookie-settings) reopen it.
 */
(function (factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  else factory(window, document);
})(function (win, doc) {
  'use strict';
  var KEY = 'fd-consent', VERSION = 1;
  var GA_ID = /^G-[A-Z0-9]{6,12}$/;
  var EVENTS = { flight_search: 1, flight_saved: 1, checklist_created: 1, checklist_completed: 1, pwa_install: 1, cta_click: 1, feedback_sent: 1 };
  var PARAMS = { result: 1, bucket: 1, source: 1 };
  var state = { id: '', loaded: false, banner: null };

  function meta(name) { var m = doc.querySelector('meta[name="' + name + '"]'); return m ? m.getAttribute('content') || '' : ''; }
  function read() {
    try { var v = JSON.parse(win.localStorage.getItem(KEY)); return v && v.v === VERSION && typeof v.analytics === 'boolean' ? v : null; } catch (e) { return null; }
  }
  function write(analytics) { try { win.localStorage.setItem(KEY, JSON.stringify({ v: VERSION, analytics: analytics, at: Date.now() })); } catch (e) { /* choice just is not remembered */ } }
  function count(name) { try { win.fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name }), keepalive: true }).catch(function () {}); } catch (e) { /* counting never breaks anything */ } }

  function gtag() { (win.dataLayer = win.dataLayer || []).push(arguments); }

  function load() {
    if (state.loaded || !state.id) return;
    state.loaded = true;
    win['ga-disable-' + state.id] = false;
    win.dataLayer = win.dataLayer || [];
    gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date());
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('config', state.id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = doc.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(state.id);
    doc.head.appendChild(s);
    pageview();
  }

  function clearCookies() {
    var names = (doc.cookie || '').split(';');
    for (var i = 0; i < names.length; i++) {
      var n = names[i].split('=')[0].replace(/^\s+/, '');
      if (n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid') {
        var host = win.location.hostname.split('.');
        for (var d = 0; d < host.length - 1; d++) doc.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' + host.slice(d).join('.');
        doc.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
    }
  }

  function unload() {
    if (!state.loaded) return;
    win['ga-disable-' + state.id] = true;
    gtag('consent', 'update', { analytics_storage: 'denied' });
    clearCookies();
    state.loaded = false;
  }

  function pageview() {
    if (!state.loaded) return;
    var loc = win.location;
    gtag('event', 'page_view', { page_location: loc.origin + loc.pathname + (loc.hash || '').split('?')[0], page_title: doc.title });
  }

  function event(name, params) {
    if (!state.loaded || !EVENTS[name]) return;
    var clean = {};
    if (params && typeof params === 'object') {
      for (var k in params) {
        if (PARAMS[k] && (typeof params[k] === 'string' || typeof params[k] === 'number')) clean[k] = String(params[k]).slice(0, 40);
      }
    }
    gtag('event', name, clean);
  }

  function choose(analytics) {
    write(analytics);
    count(analytics ? 'consent_accept' : 'consent_reject');
    if (analytics) load(); else unload();
    close();
  }

  function close() { if (state.banner && state.banner.parentNode) state.banner.parentNode.removeChild(state.banner); state.banner = null; }

  function css() {
    if (doc.getElementById('fd-consent-css')) return;
    var st = doc.createElement('style');
    st.id = 'fd-consent-css';
    st.textContent = '.fd-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin:0 auto;background:#fff;color:#2d4b3d;border:1px solid #dce5d6;border-radius:14px;padding:18px 20px;box-shadow:0 18px 50px #0f2a2335;font:14px/1.6 "DM Sans",system-ui,sans-serif}' +
      '.fd-cc h2{margin:0 0 6px;font:700 15px Manrope,system-ui,sans-serif;color:#173e34}.fd-cc p{margin:0 0 14px;font-size:13px}.fd-cc a{color:#214e3e;text-decoration:underline}' +
      '.fd-cc-row{display:flex;gap:10px;flex-wrap:wrap}.fd-cc button{flex:1 1 140px;border:1px solid #214e3e;background:#fff;color:#214e3e;border-radius:9px;padding:12px 16px;font:600 13px "DM Sans",system-ui,sans-serif;cursor:pointer}' +
      '.fd-cc button:focus-visible{outline:3px solid #92b678;outline-offset:2px}.fd-cc button:hover{background:#f1f6ee}.fd-cc-now{font-size:11px;color:#7a8c7d;margin:10px 0 0}@media print{.fd-cc{display:none}}';
    doc.head.appendChild(st);
  }

  function open() {
    if (!state.id || state.banner) return;
    css();
    var cur = read();
    var el = doc.createElement('div');
    el.className = 'fd-cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'fd-cc-title');
    el.innerHTML = '<h2 id="fd-cc-title">Your cookie choice</h2>' +
      '<p>We would like to use Google Analytics to count how the app is used, so we can improve it. It sets cookies and sends anonymous usage data to Google. Nothing is sent unless you accept, and the app works the same either way. ' +
      'Sign-in cookies are essential and always on. <a href="/cookies/">Read how we use cookies</a>.</p>' +
      '<div class="fd-cc-row"><button type="button" data-fd="accept">Accept analytics</button><button type="button" data-fd="reject">Reject analytics</button></div>' +
      (cur ? '<p class="fd-cc-now">Currently: analytics ' + (cur.analytics ? 'accepted' : 'rejected') + '.</p>' : '');
    el.querySelector('[data-fd="accept"]').addEventListener('click', function () { choose(true); });
    el.querySelector('[data-fd="reject"]').addEventListener('click', function () { choose(false); });
    doc.body.appendChild(el);
    state.banner = el;
    el.querySelector('button').focus({ preventScroll: true });
  }

  function init() {
    var id = meta('fd-ga-id');
    api.enabled = GA_ID.test(id);
    if (!api.enabled) return;
    state.id = id;
    doc.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-fd-cookie-settings]') : null;
      if (t) { e.preventDefault(); open(); }
    });
    var c = read();
    if (c === null) open();
    else if (c.analytics) load();
  }

  var api = { enabled: false, open: open, event: event, pageview: pageview, get: read };
  win.fdConsent = api;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  return api;
});
