import { AlertTriangle, CheckCircle2, CircleSlash, ExternalLink, Table2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { nf, when as whenAny } from './api';

// Operations sections of the owner console (moved from Admin.tsx unchanged in behaviour): overview, usage, costs and limits,
// users, Google Analytics and system. Numbers come only from the server's own counters and the providers' answers.
const when = (ms: number | null | undefined) => whenAny(ms);
const shortDay = (d: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(d + 'T12:00:00Z'),
  );
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

function Kpi({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={warn ? 'ad-kpi warn' : 'ad-kpi'}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? nf.format(value) : value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

// One series, one hue. Thin rounded marks anchored to the baseline, a 2px gap, recessive axes, hover/tap values, and a table view for screen readers.
// The chart is drawn at the width it really has (measured), so its labels stay a readable size on a phone instead of shrinking with a fixed viewBox.
function Chart({
  title,
  values,
  dates,
  kind = 'bars',
  unit = '',
  wide = false,
}: {
  title: string;
  values: number[];
  dates: string[];
  kind?: 'bars' | 'line';
  unit?: string;
  wide?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null),
    [table, setTable] = useState(false),
    [W, setW] = useState(640);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setW(w);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const H = W < 480 ? 170 : 160,
    L = 40,
    R = 10,
    T = 12,
    B = 26,
    n = values.length,
    max = Math.max(1, ...values),
    iw = W - L - R,
    ih = H - T - B;
  const last = n ? values[n - 1] : null;
  const total = values.reduce((a, b) => a + b, 0),
    peakI = values.indexOf(Math.max(...values, 0));
  const x = (i: number) => L + (n <= 1 ? iw / 2 : i * (iw / (n - 1))),
    slot = iw / Math.max(1, n),
    bw = Math.max(2, Math.min(26, slot - 2));
  const y = (v: number) => T + ih - (v / max) * ih;
  const bar = (i: number, v: number) => {
    const bx = L + i * slot + (slot - bw) / 2,
      by = y(v),
      h = T + ih - by,
      r = Math.min(3, bw / 2, h);
    return v > 0
      ? `M${bx},${T + ih}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bw - r}Q${bx + bw},${by} ${bx + bw},${by + r}V${T + ih}Z`
      : '';
  };
  return (
    <section className={wide ? 'panel ad-chart wide' : 'panel ad-chart'}>
      <div className="ad-chart-head">
        <div>
          <h2>{title}</h2>
          <p>
            {last !== null && (
              <>
                <strong className="ad-latest">
                  {nf.format(last)}
                  {unit}
                </strong>{' '}
                latest ({shortDay(dates[n - 1])}) ·{' '}
              </>
            )}
            {nf.format(total)}
            {unit} in {n} days
            {total > 0 && values[peakI] > 0
              ? ` · busiest ${shortDay(dates[peakI])} (${nf.format(values[peakI])})`
              : ''}
          </p>
        </div>
        <button className="text-button" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          <Table2 size={13} />
          {table ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {table ? (
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>{title}</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <td>{shortDay(d)}</td>
                  <td>{nf.format(values[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ad-svg-wrap" ref={wrap}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            role="img"
            aria-label={`${title}: ${nf.format(total)} in ${n} days`}
            onMouseLeave={() => setHover(null)}
          >
            <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="#dbe3d6" />
            <line x1={L} x2={W - R} y1={T} y2={T} stroke="#eef2ea" />
            <text x={L - 6} y={T + 4} textAnchor="end" className="ad-ax">
              {nf.format(max)}
            </text>
            <text x={L - 6} y={T + ih + 4} textAnchor="end" className="ad-ax">
              0
            </text>
            {[0, Math.floor((n - 1) / 2), n - 1]
              .filter((v, i, a) => n > 0 && a.indexOf(v) === i)
              .map((i) => (
                <text
                  key={i}
                  x={kind === 'bars' ? L + i * slot + slot / 2 : x(i)}
                  y={H - 6}
                  textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                  className="ad-ax"
                >
                  {shortDay(dates[i])}
                </text>
              ))}
            {kind === 'bars' ? (
              values.map((v, i) => (
                <path
                  key={i}
                  d={bar(i, v)}
                  fill="#214e3e"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              ))
            ) : (
              <>
                <polyline
                  fill="none"
                  stroke="#214e3e"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                />
                {hover !== null && (
                  <circle
                    cx={x(hover)}
                    cy={y(values[hover])}
                    r="4.5"
                    fill="#214e3e"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                )}
              </>
            )}
            {values.map((_, i) => (
              <rect
                key={i}
                x={kind === 'bars' ? L + i * slot : x(i) - slot / 2}
                y={T}
                width={slot}
                height={ih + B}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={-1}
              />
            ))}
          </svg>
          {hover !== null && (
            <div
              className="ad-tip"
              style={{
                left: `${((kind === 'bars' ? L + hover * slot + slot / 2 : x(hover)) / W) * 100}%`,
              }}
            >
              <b>{nf.format(values[hover])}</b>
              <span>{shortDay(dates[hover])}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Rank({
  title,
  items,
  empty,
}: {
  title: string;
  items: { key: string; count: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="panel ad-rank">
      <h3 role="heading" aria-level={2}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="ad-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.key}>
              <span className="ad-rank-k">{i.key}</span>
              <span className="ad-rank-bar">
                <i style={{ width: `${(i.count / max) * 100}%` }} />
              </span>
              <span className="ad-rank-n">{nf.format(i.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Setup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel ad-setup">
      <AlertTriangle size={20} />
      <div>
        <h3 role="heading" aria-level={2}>
          {title}
        </h3>
        {children}
      </div>
    </section>
  );
}

export function Overview({ ov }: { ov: any }) {
  const t = ov.overview.totals,
    s = ov.overview.series,
    dates = ov.overview.dates;
  return (
    <>
      <div className="ad-kpis">
        <Kpi
          label="Searches"
          value={t.searches}
          sub={`${t.found + t.usualRoute} answered · ${t.notFound} not found`}
        />
        <Kpi
          label="Success rate"
          value={pct(t.successRate)}
          sub={t.errors ? `${t.errors} provider errors` : 'no provider errors'}
          warn={t.errors > 0}
        />
        <Kpi
          label="Active user-days"
          value={t.activeUserDays}
          sub={`peak ${t.peakUsers} a day · ${t.searchesPerActiveUserDay ?? '—'} searches each`}
        />
        <Kpi
          label="Packing lists started"
          value={t.checklistsCreated}
          sub={`${t.checklistsCompleted} fully packed`}
        />
        <Kpi
          label="New enquiries"
          value={t.enquiries}
          sub={ov.unread ? `${ov.unread} unread` : 'none unread'}
          warn={ov.unread > 0}
        />
        <Kpi
          label="App installs"
          value={t.pwaInstalls}
          sub={`${t.landingViews} sign-in screen views · ${t.ctaClicks} sign-up clicks`}
        />
      </div>
      <Chart title="Searches" values={s.searches} dates={dates} />
      <Chart title="Signed-in users" values={s.users} dates={dates} kind="line" />
    </>
  );
}

export function Usage({ ov }: { ov: any }) {
  const t = ov.overview.totals,
    s = ov.overview.series,
    dates = ov.overview.dates;
  return (
    <>
      <div className="ad-grid2">
        <Rank
          title="Top airlines searched"
          items={ov.overview.top.airlines}
          empty="No searches yet."
        />
        <Rank title="Top routes" items={ov.overview.top.routes} empty="No routes yet." />
      </div>
      <div className="ad-grid2">
        <Rank title="Outbound or inbound" items={ov.overview.top.direction} empty="No data yet." />
        <Rank
          title="Flight numbers people could not find"
          items={ov.overview.top.notFoundNumbers}
          empty="Nothing missing. Every search found a flight."
        />
      </div>
      <div className="ad-kpis">
        <Kpi
          label="Sign-in screen views"
          value={t.landingViews}
          sub={`${t.ctaClicks} clicked sign up`}
        />
        <Kpi
          label="Packing lists"
          value={t.checklistsCreated}
          sub={`${t.checklistsCompleted} completed · ${t.checklistSaves} saved to accounts`}
        />
        <Kpi
          label="Cookie choices"
          value={pct(t.consentOptIn)}
          sub={`${t.consentAccept} accepted · ${t.consentReject} declined`}
        />
        <Kpi
          label="Feedback opened"
          value={t.feedbackOpened}
          sub={`${t.enquiries} messages sent`}
        />
      </div>
      <Chart title="Sign-in screen views" values={s.landingViews} dates={dates} />
      <Chart title="Packing lists started" values={s.checklistsCreated} dates={dates} />
    </>
  );
}

export function Costs({ ov }: { ov: any }) {
  const t = ov.overview.totals,
    s = ov.overview.series,
    dates = ov.overview.dates,
    al = ov.allowance;
  return (
    <>
      <section className={al.runsOutBeforeMonthEnd ? 'panel ad-allow warn' : 'panel ad-allow'}>
        <div className="ad-allow-top">
          <div>
            <h3 role="heading" aria-level={2}>
              Flight schedule allowance ({al.month})
            </h3>
            <p>
              {al.used} of {al.cap} units used · {al.left} left
            </p>
          </div>
          {al.runsOutBeforeMonthEnd ? (
            <span className="pill warn">
              <AlertTriangle size={11} />
              Runs out early
            </span>
          ) : (
            <span className="pill ok">
              <CheckCircle2 size={11} />
              On track
            </span>
          )}
        </div>
        <div
          className="ad-meter"
          role="progressbar"
          aria-valuenow={al.used}
          aria-valuemin={0}
          aria-valuemax={al.cap}
          aria-label="Units used this month"
        >
          <i style={{ width: `${Math.min(100, al.cap ? (al.used / al.cap) * 100 : 0)}%` }} />
        </div>
        <p className="ad-allow-note">
          {al.perDay > 0
            ? `About ${al.perDay} units a day so far. ${al.daysUntilEmpty === null ? '' : al.runsOutBeforeMonthEnd ? `At this pace the allowance runs out in about ${al.daysUntilEmpty} days, before the month ends. Searches fall back to live position and routes only.` : 'At this pace it lasts to the end of the month.'}`
            : 'No units used yet this month.'}
        </p>
      </section>
      <div className="ad-kpis">
        <Kpi
          label="Cache hit rate"
          value={pct(t.adbCacheRatio)}
          sub={`${t.adbCacheHits} answered from memory · ${t.adbUnitsSaved} units saved`}
        />
        <Kpi
          label="Paid lookups"
          value={t.adbCalls}
          sub={`${t.adbUnits} units · ${t.adbErrors} failed`}
          warn={t.adbErrors > 0}
        />
        <Kpi
          label="Live position fetches"
          value={t.openskyFetches}
          sub={`${t.openskyCacheHits} cached · ${t.openskyErrors} failed`}
          warn={t.openskyErrors > 0}
        />
        <Kpi label="Route lookups" value={t.routeLookups} sub={`${t.routeCacheHits} cached`} />
        <Kpi
          label="Blocked by limits"
          value={t.rateLimited}
          sub="too many requests from one visitor"
        />
        <Kpi
          label="Refused (not signed in)"
          value={t.authDenied}
          sub="requests without a valid sign-in"
        />
      </div>
      <section className="panel">
        <h3 role="heading" aria-level={2}>
          Average answer time
        </h3>
        <ul className="ad-lat">
          {Object.keys(ov.overview.latencyMs).length === 0 ? (
            <li className="ad-empty">No provider calls yet.</li>
          ) : (
            Object.entries(ov.overview.latencyMs).map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <strong>{v == null ? '—' : `${nf.format(v as number)} ms`}</strong>
              </li>
            ))
          )}
        </ul>
      </section>
      <Chart title="Paid units used" values={s.adbUnits} dates={dates} unit=" units" wide />
      <p className="ad-note">AI usage is not switched on yet, so there is no AI cost to show.</p>
    </>
  );
}

export function UsersView({ users }: { users: any }) {
  return !users.configured ? (
    <Setup title="Show your user numbers here">
      <p>
        This needs your Clerk <b>secret</b> key stored on the server (never in the browser). Add it
        to the private server config as <code>clerk_secret_key</code>, or ask to have it set up for
        you. Until then, see your users in the{' '}
        <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer">
          Clerk dashboard <ExternalLink size={11} />
        </a>
        .
      </p>
    </Setup>
  ) : users.error ? (
    <Setup title="Clerk did not answer">
      <p>{users.error}</p>
    </Setup>
  ) : (
    <>
      <div className="ad-kpis">
        <Kpi label="Accounts" value={users.total} sub="all time" />
        <Kpi label="New in 7 days" value={users.signups7} sub={`${users.signups30} in 30 days`} />
        <Kpi
          label="Active in 7 days"
          value={users.active7}
          sub={users.total ? `${Math.round((users.active7 / users.total) * 100)}% of accounts` : ''}
        />
        <Kpi
          label="Active in 30 days"
          value={users.active30}
          sub={
            users.total ? `${Math.round((users.active30 / users.total) * 100)}% of accounts` : ''
          }
        />
      </div>
      <section className="panel">
        <h3 role="heading" aria-level={2}>
          Newest accounts
        </h3>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {users.newest.map((u: any) => (
                <tr key={u.id}>
                  <td>{u.email || '—'}</td>
                  <td>{when(u.createdAt)}</td>
                  <td>{when(u.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ad-note">Refreshed every five minutes. Checked at {when(users.fetchedAt)}.</p>
      </section>
    </>
  );
}

export function Analytics({ ga }: { ga: any }) {
  return ga.configured && ga.error ? (
    <Setup title="Google Analytics is connected but not answering">
      <p>{ga.error}</p>
    </Setup>
  ) : ga.configured ? (
    <>
      <div className="ad-kpis">
        <Kpi
          label="Visitors, 7 days"
          value={ga.totals['7'].users}
          sub={`${ga.totals['7'].sessions} visits · ${ga.totals['7'].pageViews} page views`}
        />
        <Kpi
          label="Visitors, 28 days"
          value={ga.totals['28'].users}
          sub={`${ga.totals['28'].sessions} visits · ${ga.totals['28'].pageViews} page views`}
        />
        <Kpi
          label="Pages per visit"
          value={
            ga.totals['28'].sessions
              ? (ga.totals['28'].pageViews / ga.totals['28'].sessions).toFixed(1)
              : '—'
          }
          sub="last 28 days"
        />
      </div>
      <Chart
        title="Visitors per day (Google Analytics)"
        values={ga.series.map((d: any) => d.users)}
        dates={ga.series.map((d: any) => d.date)}
        wide
      />
      <div className="ad-grid2">
        <Rank title="Top countries" items={ga.countries} empty="No data yet." />
        <Rank title="Devices" items={ga.devices} empty="No data yet." />
      </div>
      <Rank title="Where visits come from" items={ga.channels} empty="No data yet." />
      <p className="ad-note">
        Only visitors who accepted analytics appear here, so these numbers are lower than real
        traffic. Checked at {when(ga.fetchedAt)}; refreshed every 15 minutes.
      </p>
    </>
  ) : (
    <Setup title="Connect Google Analytics">
      <p>
        Once you add your Google Analytics 4 Measurement ID to the app and a read-only Google
        service account to the server, its visitor numbers (countries, devices, traffic sources)
        will appear here. Until then, open Google Analytics directly.
      </p>
      <p>
        <a
          className="btn btn-secondary"
          href="https://analytics.google.com"
          target="_blank"
          rel="noreferrer"
        >
          Open Google Analytics <ExternalLink size={13} />
        </a>
      </p>
    </Setup>
  );
}

export function SystemView({ sys }: { sys: any }) {
  return (
    <section className="panel">
      <h3 role="heading" aria-level={2}>
        What is switched on
      </h3>
      <ul className="ad-flags">
        {(
          [
            ['Sign-in required for lookups', sys.signInEnforced],
            ['Flight schedule data (AeroDataBox)', sys.aerodatabox],
            ['Live aircraft position (OpenSky)', sys.opensky],
            ['User numbers (Clerk secret key)', sys.clerkApi],
            ['Google Analytics numbers', sys.googleAnalyticsApi],
            ['Email notifications for enquiries', sys.emailNotifications],
            ['AI features', sys.ai],
            ['Ads', sys.ads],
            ['Per-visitor rate limits behind Cloudflare', sys.trustCloudflareIp],
          ] as [string, boolean][]
        ).map(([k, v]) => (
          <li key={k}>
            {v ? (
              <CheckCircle2 size={16} className="ok" />
            ) : (
              <CircleSlash size={16} className="off" />
            )}
            <span>{k}</span>
            <strong>{v ? 'On' : 'Off'}</strong>
          </li>
        ))}
      </ul>
      <p className="ad-note">
        PHP {sys.phpVersion} · server time {sys.serverTime}
      </p>
    </section>
  );
}
