// Anonymous product counters (e.g. "someone installed the app"). Sent to our own server, counted, forgotten: no cookies, no identifiers,
// no flight numbers. The server only accepts a fixed list of names.
export type EventName = 'landing_view' | 'cta_click' | 'pwa_install' | 'consent_accept' | 'consent_reject' | 'checklist_created' | 'checklist_completed' | 'feedback_opened' | 'signup_started';
export function track(name: EventName) {
  try { void fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), keepalive: true }).catch(() => {}); } catch { /* counting must never break the app */ }
}
/** Count something at most once per browser tab session (e.g. a landing page view). */
export function trackOnce(name: EventName) {
  try { const k = 'fd-once-' + name; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch { /* still count */ }
  track(name);
}
