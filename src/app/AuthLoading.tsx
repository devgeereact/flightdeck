import { Plane } from 'lucide-react';
export default function AuthLoading({ failed = false }: { failed?: boolean }) {
  return (
    <div className="auth-loading" role="status">
      <a className="brand" href="/">
        <span className="brand-mark">
          <Plane size={23} />
        </span>
        flightdeck.
      </a>
      <section>
        <Plane size={30} />
        <h1>{failed ? 'Sign-in could not load' : 'Opening Flightdeck'}</h1>
        <p>
          {failed
            ? 'Flightdeck could not connect to its sign-in service. Reload to try again, or use the live site.'
            : 'Connecting securely to your account…'}
        </p>
        {failed && (
          <div className="auth-loading-actions">
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Try again
            </button>
            <a className="btn btn-secondary" href="https://flightdeck.gakinz.com/app/">
              Open live Flightdeck
            </a>
          </div>
        )}
        <a href="/">Back to the website</a>
      </section>
    </div>
  );
}
