import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, RefreshCw } from 'lucide-react';
import { call, nf, when } from './api';

type Provider = {
  name: string;
  lastOk: string | null;
  lastFail: string | null;
  lastFailCategory: string | null;
  consecutiveFailures: number;
};
const CATEGORY: Record<string, string> = {
  no_response: 'No answer (network or timeout)',
  rejected_credentials: 'Key or credentials rejected',
  limit_reached: 'Limit or allowance reached',
  provider_error: 'The provider had an error',
  unexpected_response: 'Unexpected answer',
};

/** Provider health and cache state. Shows only what the server recorded; a provider that has not been called says so. */
export default function HealthView() {
  const [d, setD] = useState<{
      providers: Record<string, Provider>;
      cache: {
        files: number;
        bytes: number;
        snapshotFetchedAt: string | null;
        snapshotAircraft: number | null;
      };
      allowance: any;
    } | null>(null),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      setD(await call('/api/admin/health'));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!d)
    return err ? (
      <div role="alert" className="notice error">
        <AlertTriangle size={16} />
        {err}
      </div>
    ) : (
      <p className="ad-loading" role="status">
        Loading…
      </p>
    );
  const al = d.allowance;
  return (
    <>
      <section className="panel">
        <div className="cn-panel-head">
          <h2>Data providers</h2>
          <button className="text-button" onClick={() => void load()} disabled={busy}>
            <RefreshCw size={13} className={busy ? 'spin' : ''} />
            Refresh
          </button>
        </div>
        <p className="ad-note">
          Recorded each time Flightdeck really asks a provider (answers served from the cache are
          not calls).
        </p>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>State</th>
                <th>Last success</th>
                <th>Last failure</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.providers).map(([id, p]) => {
                const failing = p.consecutiveFailures > 0;
                const never = !p.lastOk && !p.lastFail;
                return (
                  <tr key={id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>
                      {never ? (
                        <span className="cn-state off">
                          <CircleSlash size={14} />
                          No calls yet
                        </span>
                      ) : failing ? (
                        <span className="cn-state bad">
                          <AlertTriangle size={14} />
                          Failing ({p.consecutiveFailures} in a row)
                        </span>
                      ) : (
                        <span className="cn-state ok">
                          <CheckCircle2 size={14} />
                          Working
                        </span>
                      )}
                    </td>
                    <td>{when(p.lastOk)}</td>
                    <td>
                      {p.lastFail ? (
                        <>
                          {when(p.lastFail)}
                          <br />
                          <small>{CATEGORY[p.lastFailCategory || ''] || p.lastFailCategory}</small>
                        </>
                      ) : (
                        'Never'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="ad-kpis">
        <div className="ad-kpi">
          <span>Schedule allowance ({al.month})</span>
          <strong>
            {nf.format(al.used)} / {nf.format(al.cap)}
          </strong>
          <small>
            {al.left} units left{al.runsOutBeforeMonthEnd ? ' · runs out early at this pace' : ''}
          </small>
        </div>
        <div className="ad-kpi">
          <span>Live position snapshot</span>
          <strong>
            {d.cache.snapshotFetchedAt ? when(d.cache.snapshotFetchedAt) : 'None cached'}
          </strong>
          <small>
            {d.cache.snapshotAircraft != null
              ? `${nf.format(d.cache.snapshotAircraft)} aircraft · refreshed at most every 2 minutes`
              : 'Fetched when someone searches'}
          </small>
        </div>
        <div className="ad-kpi">
          <span>Cache</span>
          <strong>{nf.format(d.cache.files)} files</strong>
          <small>
            {(d.cache.bytes / 1024 / 1024).toFixed(1)} MB · expired files are removed automatically
          </small>
        </div>
      </div>
    </>
  );
}
