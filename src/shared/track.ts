// Anonymous product counters (e.g. "someone installed the app"). Sent to our own server, counted, forgotten: no cookies, no identifiers,
// no flight numbers. The server only accepts a fixed list of names.
export type EventName =
  | 'landing_view'
  | 'cta_click'
  | 'pwa_install'
  | 'consent_accept'
  | 'consent_reject'
  | 'checklist_created'
  | 'checklist_completed'
  | 'feedback_opened'
  | 'signup_started';
export function track(name: EventName) {
  try {
    void fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* counting must never break the app */
  }
}
/** Count something at most once per browser tab session (e.g. a landing page view). */
export function trackOnce(name: EventName) {
  try {
    const k = 'fd-once-' + name;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
  } catch {
    /* still count */
  }
  track(name);
}

type GaName =
  | 'flight_search'
  | 'flight_saved'
  | 'checklist_created'
  | 'checklist_completed'
  | 'pwa_install'
  | 'cta_click'
  | 'feedback_sent';
/** Google Analytics event. Does nothing unless the visitor accepted analytics (public/consent.js enforces that and a strict whitelist). */
export function ga(name: GaName, params?: { result?: string; bucket?: string; source?: string }) {
  try {
    (window as any).fdConsent?.event(name, params);
  } catch {
    /* analytics must never break the app */
  }
}
export const gaPageview = () => {
  try {
    (window as any).fdConsent?.pageview();
  } catch {
    /* ignore */
  }
};
export const cookieSettingsAvailable = () => {
  try {
    return !!(window as any).fdConsent?.enabled;
  } catch {
    return false;
  }
};
