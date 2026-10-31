import { AlertCircle, RefreshCw } from 'lucide-react';
import { Brand } from '../shared/Logo';

// While Clerk loads (and when it cannot): the brand, one sentence and, on failure, the way out. Also the error boundary's screen.
export default function AuthLoading({ failed = false }: { failed?: boolean }) {
  return (
    <div className="auth-loading" role="status">
      <Brand href="/" />
      <section className="panel state">
        <span className={failed ? 'tile danger' : 'tile'}>
          {failed ? (
            <AlertCircle size={28} aria-hidden="true" />
          ) : (
            <RefreshCw size={28} className="spin" aria-hidden="true" />
          )}
        </span>
        <h1>{failed ? 'Sign-in could not load' : 'Opening Flightdeck'}</h1>
        <p>
          {failed
            ? 'Flightdeck could not connect to its sign-in service. Reload to try again, or use the live site.'
            : 'Connecting securely to your account…'}
        </p>
        {failed && (
          <div className="acts">
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              Try again
            </button>
            <a className="btn btn-ghost" href="https://flightdeck.gakinz.com/app/">
              Open live Flightdeck
            </a>
          </div>
        )}
        <a className="link-quiet" href="/">
          Back to the website
        </a>
      </section>
    </div>
  );
}
