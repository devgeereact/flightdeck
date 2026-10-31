import { registerSW } from 'virtual:pwa-register';
import { SignIn } from '@clerk/react';
import { Plane } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Brand } from '../shared/Logo';
import { trackOnce } from '../shared/track';

// Read back (and cleared) by the app in main.tsx once signed in.
const BACK_KEY = 'fd-signin-back';
const FLIGHT_LINK = /^#\/flight\/([A-Z0-9]{3,8})\/(\d{4}-\d{2}-\d{2})$/;
const dayLabel = (d: string) => {
  const t = new Date(d + 'T12:00:00Z');
  return Number.isNaN(t.getTime())
    ? d
    : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// What a signed-out visitor sees at /app/: a photo panel and Clerk's own sign-in, drawn with Flightdeck's tokens (clerkAppearance).
// The same steps create a free account (withSignUp). When they arrived from a flight link, it says which flight opens next; after
// sign-in the same address opens it.
export default function SignInScreen() {
  useEffect(() => {
    trackOnce('landing_view');
  }, []);
  // Signed-out visitors have nothing to lose, so a new release is applied as soon as it is ready.
  useEffect(() => {
    let t: number | undefined;
    const update = registerSW({
      onNeedRefresh: () => {
        void update(true);
      },
      onRegisteredSW: (_u, r) => {
        if (r) {
          r.update().catch(() => {});
          t = window.setInterval(() => {
            r.update().catch(() => {});
          }, 3600000);
        }
      },
    });
    return () => {
      if (t) clearInterval(t);
    };
  }, []);
  // The app link they arrived with (#/flight/…, #/checklist), kept for this tab: Clerk's later steps live at /app/<step>, drop
  // the hash and can remount this screen. After sign-in they land back on it, so a flight link opens that flight.
  const [arrived] = useState(() => {
    try {
      if (location.hash.startsWith('#/')) sessionStorage.setItem(BACK_KEY, location.hash);
      return sessionStorage.getItem(BACK_KEY) || '';
    } catch {
      return location.hash;
    }
  });
  const m = arrived.match(FLIGHT_LINK);
  const target = m
    ? `${m[1]} on ${dayLabel(m[2])}`
    : arrived.startsWith('#/checklist')
      ? 'your packing list'
      : '';
  const back = `${typeof window === 'undefined' ? '' : location.origin}/app/${arrived}`;
  // Clerk reads an app hash such as #/flight/BA59/… as one of its own routes and sends the visitor to its hosted page. So the
  // hash leaves the address bar before the sign-in mounts; `back` (above) still holds it, and sign-in returns there.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (location.hash.startsWith('#/')) {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch {
        /* very old browsers: the hosted sign-in page still works */
      }
    }
    setReady(true);
  }, []);
  return (
    <div className="signin">
      <div className="si-photo">
        <img
          src="/img/sunset-wing.jpg"
          alt="An aircraft wing above the clouds at sunset"
          width="1500"
          height="942"
        />
        <Brand href="/" className="on-photo" />
        <h1>Your flights and packing list, on every device.</h1>
        <ul>
          <li>
            <b className="fd-data">12</b>saved flights on your account
          </li>
          <li>
            <b>1 list</b>for every trip, linked to its flight
          </li>
          <li>
            <b>Free</b>no adverts and nothing to buy
          </li>
        </ul>
      </div>
      <main id="main" className="si-form">
        <div className="si-card">
          <h2 id="signin-h">Sign in to Flightdeck</h2>
          <p>New here? The same steps create your free account.</p>
          {target && (
            <div className="pending">
              <Plane size={20} aria-hidden="true" />
              <span>
                Sign in to see <b>{target}</b>. We will take you straight there.
              </span>
            </div>
          )}
          <div className="si-step">
            {ready && (
              <SignIn
                // Path routing under /app: the steps (code, factor) are /app/<step>, which the host serves the app shell for.
                // Hash routing would clash with the app's own #/ links; virtual routing sent flight links to Clerk's hosted page.
                routing="path"
                path="/app"
                withSignUp
                fallbackRedirectUrl={back}
                signUpFallbackRedirectUrl={back}
              />
            )}
          </div>
          <div className="si-meta">
            <span>
              By continuing you agree to the <a href="/terms/">terms</a> and{' '}
              <a href="/privacy/">privacy policy</a>.
            </span>
            <span>
              No account is needed for the <a href="/guides/">travel guides</a> or the{' '}
              <a href="/travel-checklist/">printable packing list</a>.
            </span>
            <a href="/">Back to the website</a>
          </div>
        </div>
      </main>
    </div>
  );
}
