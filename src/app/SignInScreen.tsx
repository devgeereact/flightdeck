import { registerSW } from 'virtual:pwa-register';
import { SignIn } from '@clerk/react';
import { Plane } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Brand } from '../shared/Logo';
import { trackOnce } from '../shared/track';

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
  const m = location.hash.match(FLIGHT_LINK);
  const target = m
    ? `${m[1]} on ${dayLabel(m[2])}`
    : location.hash.startsWith('#/checklist')
      ? 'your packing list'
      : '';
  // Where to land after signing in: this same address, captured once, so a flight link opens that flight.
  const [back] = useState(() => (typeof window === 'undefined' ? '/app/' : window.location.href));
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
            <SignIn
              // Virtual routing keeps every sign-in step out of the address bar, so a flight link (#/flight/…) survives the
              // whole flow. Clerk supports it (its modals use it) but types only path and hash for mounted components.
              routing={'virtual' as 'hash'}
              withSignUp
              fallbackRedirectUrl={back}
              signUpFallbackRedirectUrl={back}
            />
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
