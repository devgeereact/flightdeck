import { Info, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ago, call, nf, when } from './api';
import { Badge, LoadError, Loading, Meter, PageHead, Panel, useRise } from './ui';

type Provider = {
  name: string;
  lastOk: string | null;
  lastFail: string | null;
  lastFailCategory: string | null;
  consecutiveFailures: number;
};
type Health = {
  providers: Record<string, Provider>;
  cache: {
    files: number;
    bytes: number;
    snapshotFetchedAt: string | null;
    snapshotAircraft: number | null;
  };
  allowance: any;
};
const CATEGORY: Record<string, string> = {
  no_response: 'No answer (network or timeout)',
  rejected_credentials: 'Key or credentials rejected',
  limit_reached: 'Limit or allowance reached',
  provider_error: 'The provider had an error',
  unexpected_response: 'Unexpected answer',
};
const ROLE: Record<string, string> = {
  aerodatabox: 'Schedules, terminals, gates',
  opensky: 'Aircraft position',
  adsbdb: 'Usual routes',
  openmeteo: 'Destination weather',
};

/** Provider health and cache state. Shows only what the server recorded; a provider that has not been called says so. */
export default function HealthView() {
  const [d, setD] = useState<Health | null>(null),
    [err, setErr] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      setD(await call('/api/admin/health'));
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const root = useRef<HTMLDivElement>(null);
  useRise(root, [!!d]);
  const al = d?.allowance;
  return (
    <div className="cs-stack" ref={root}>
      <PageHead
        title="Provider health"
        lede="Recorded each time Flightdeck really asks a provider. Answers served from the cache are not calls."
        actions={
          <button
            type="button"
            className="cs-btn ghost sm"
            onClick={() => void load()}
            disabled={busy}
          >
            <RefreshCw size={16} className={busy ? 'cs-spin' : ''} aria-hidden="true" />
            {busy ? 'Checking…' : 'Check now'}
          </button>
        }
      />
      {err ? <LoadError error={err} retry={() => void load()} /> : null}
      {!d ? (
        !err && <Loading />
      ) : (
        <>
          <Panel aria-busy={busy}>
            <div className="cs-tw">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Status</th>
                    <th className="num">Last success</th>
                    <th className="num">Last failure</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.providers).map(([id, p]) => {
                    const failing = p.consecutiveFailures > 0;
                    const never = !p.lastOk && !p.lastFail;
                    return (
                      <tr key={id}>
                        <td>
                          <span className="cs-t">{p.name}</span>
                          {ROLE[id] && <span className="cs-s">{ROLE[id]}</span>}
                        </td>
                        <td>
                          {busy ? (
                            <Badge>Checking</Badge>
                          ) : never ? (
                            <Badge tone="grey">No calls yet</Badge>
                          ) : failing ? (
                            <Badge tone="danger">Failing ({p.consecutiveFailures} in a row)</Badge>
                          ) : (
                            <Badge tone="ok">Responding</Badge>
                          )}
                        </td>
                        <td className="num">
                          <span className="cs-t-plain">{p.lastOk ? ago(p.lastOk) : 'Never'}</span>
                          {p.lastOk && <span className="cs-s">{when(p.lastOk)}</span>}
                        </td>
                        <td className="num">
                          <span className="cs-t-plain">
                            {p.lastFail ? ago(p.lastFail) : 'Never'}
                          </span>
                          {p.lastFail && (
                            <span className="cs-s">
                              {CATEGORY[p.lastFailCategory || ''] || p.lastFailCategory}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Allowance and cache">
            <div className="cs-meter">
              <div className="cs-meter-r">
                <b>Schedule allowance ({al.month})</b>
                <b className="cs-num">
                  {nf.format(al.used)} of {nf.format(al.cap)}
                </b>
              </div>
              <Meter
                used={al.used}
                cap={al.cap}
                label="AeroDataBox units used this month"
                stopLabel={`Stop at ${al.cap} units`}
              />
              <small>
                {nf.format(al.left)} units left
                {al.runsOutBeforeMonthEnd ? ', runs out early at this pace' : ''}. Lookups stop at
                the allowance so it is never exceeded.
              </small>
            </div>
            <div className="cs-meter">
              <div className="cs-meter-r">
                <b>Live position snapshot</b>
                <b className="cs-num">
                  {d.cache.snapshotFetchedAt ? ago(d.cache.snapshotFetchedAt) : 'None cached'}
                </b>
              </div>
              <small>
                {d.cache.snapshotAircraft != null
                  ? `${nf.format(d.cache.snapshotAircraft)} aircraft, refreshed at most every 2 minutes.`
                  : 'Fetched when someone searches.'}
              </small>
            </div>
            <div className="cs-meter">
              <div className="cs-meter-r">
                <b>Provider cache</b>
                <b className="cs-num">
                  {nf.format(d.cache.files)} files · {(d.cache.bytes / 1024 / 1024).toFixed(1)} MB
                </b>
              </div>
              <small>Expired files are removed automatically.</small>
            </div>
          </Panel>
          <div className="cs-panel cs-infonote">
            <Info size={20} aria-hidden="true" />
            <p>
              "Check now" reads the latest recorded state again; it does not call the providers.
              When a provider fails, the app says the source could not be reached. It never fills
              the gap with a guess.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
