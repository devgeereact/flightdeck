import {
  Bookmark,
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  Gauge,
  Info,
  ListChecks,
  Search,
  Users,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { ago, call, nf, when } from './api';
import { Badge, ChartPanel, contentState, Empty, Kpi, Meter, Panel, RankTable } from './ui';

// Operations sections of the owner console: overview, usage, costs and limits, users, Google Analytics and system.
// Numbers come only from the server's own counters and the providers' answers; nothing here is an example figure.
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

function Attention({
  title,
  href,
  link,
  children,
}: {
  title: ReactNode;
  href: string;
  link: string;
  children: ReactNode;
}) {
  return (
    <div className="cs-meter">
      <div className="cs-meter-r">
        <b>{title}</b>
        <a href={href} className="cs-quiet">
          {link}
        </a>
      </div>
      <small>{children}</small>
    </div>
  );
}

type HealthSummary = { working: number; failing: number; never: number; lastOk: string | null };
type PageItem = {
  label: string;
  kind: string | null;
  published: boolean;
  unpublished: boolean;
  hasDraft: boolean;
};

export function Overview({ ov, days }: { ov: any; days: number }) {
  const t = ov.overview.totals,
    s = ov.overview.series,
    dates: string[] = ov.overview.dates,
    al = ov.allowance;
  const [pending, setPending] = useState<PageItem[] | null | 'error'>(null),
    [health, setHealth] = useState<HealthSummary | null | 'error'>(null);
  // Two small reads for the "Needs your attention" list: pages waiting to be published, and provider state.
  useEffect(() => {
    const ctl = new AbortController();
    call<{ items: PageItem[] }>('/api/admin/content/page', { signal: ctl.signal })
      .then((d) =>
        setPending(
          d.items.filter((i) => {
            const st = contentState(i);
            return st === 'Changes not published' || st === 'Draft only';
          }),
        ),
      )
      .catch(() => !ctl.signal.aborted && setPending('error'));
    call<{ providers: Record<string, any> }>('/api/admin/health', { signal: ctl.signal })
      .then((d) => {
        const ps = Object.values(d.providers);
        const oks = ps.map((p) => p.lastOk).filter(Boolean) as string[];
        setHealth({
          working: ps.filter((p) => p.lastOk && !p.consecutiveFailures).length,
          failing: ps.filter((p) => p.consecutiveFailures > 0).length,
          never: ps.filter((p) => !p.lastOk && !p.lastFail).length,
          lastOk: oks.sort().pop() ?? null,
        });
      })
      .catch(() => !ctl.signal.aborted && setHealth('error'));
    return () => ctl.abort();
  }, []);
  const stopPct = al.cap ? Math.round((al.used / al.cap) * 100) : 0;
  return (
    <>
      <div className="cs-kpis">
        <Kpi
          icon={<Search size={16} />}
          label="Flight searches"
          value={t.searches}
          corner={t.successRate == null ? undefined : `${t.successRate}% answered`}
          cornerTone="ok"
          spark={s.searches}
        />
        <Kpi
          icon={<Users size={16} />}
          label="Signed-in user-days"
          value={t.activeUserDays}
          corner={`peak ${nf.format(t.peakUsers)} a day`}
          cornerTone="ok"
          spark={s.users}
        />
        <Kpi
          icon={<ListChecks size={16} />}
          label="Packing lists started"
          value={t.checklistsCreated}
          corner={`${nf.format(t.checklistsCompleted)} packed`}
          cornerTone="ok"
          spark={s.checklistsCreated}
        />
        <Kpi
          icon={<Gauge size={16} />}
          label="AeroDataBox units this month"
          value={
            <>
              {nf.format(al.used)}
              <small className="cs-kpi-of"> / {nf.format(al.cap)}</small>
            </>
          }
          corner={`${stopPct}% of stop`}
          cornerTone="warn"
          meter={
            <Meter
              used={al.used}
              cap={al.cap}
              label="AeroDataBox units used this month"
              stopLabel={`Stop at ${al.cap} units`}
            />
          }
        />
      </div>
      <div className="cs-two">
        <ChartPanel
          title="Searches and signed-in users"
          sub={`Per day, the last ${days} days`}
          series={[
            { name: 'Flight searches', values: s.searches, tone: 1 },
            { name: 'Signed-in users', values: s.users, tone: 2 },
          ]}
          dates={dates}
          height={300}
        />
        <Panel title="Needs your attention">
          <Attention
            title={`${nf.format(ov.unread)} unread ${ov.unread === 1 ? 'enquiry' : 'enquiries'}`}
            href="#/admin/inbox"
            link="Open inbox"
          >
            {nf.format(t.enquiries)} received in the last {days} days
          </Attention>
          <Attention
            title={
              pending === null
                ? 'Pages'
                : pending === 'error'
                  ? 'Pages could not be checked'
                  : `${pending.length} ${pending.length === 1 ? 'page' : 'pages'} not published`
            }
            href="#/admin/pages"
            link="Review"
          >
            {pending === null
              ? 'Checking…'
              : pending === 'error'
                ? 'Open the pages list to see their state.'
                : pending
                    .map((p) => p.label)
                    .slice(0, 2)
                    .join(', ') || 'Everything is live'}
          </Attention>
          <Attention
            title={`AeroDataBox at ${stopPct}% of its stop`}
            href="#/admin/costs"
            link="Limits"
          >
            {al.runsOutBeforeMonthEnd
              ? `At this pace the allowance runs out in about ${al.daysUntilEmpty} days, before the month ends.`
              : `Lookups stop at ${nf.format(al.cap)} units so the allowance is never exceeded.`}
          </Attention>
          <Attention
            title={
              health === null
                ? 'Providers'
                : health === 'error'
                  ? 'Provider state could not be read'
                  : health.failing
                    ? `${health.failing} ${health.failing === 1 ? 'provider' : 'providers'} failing`
                    : health.working && !health.never
                      ? 'All providers responding'
                      : `${health.working} responding, ${health.never} not called yet`
            }
            href="#/admin/health"
            link="Health"
          >
            {health === null
              ? 'Checking…'
              : health === 'error'
                ? 'Open provider health for details.'
                : health.lastOk
                  ? `Last answer ${ago(health.lastOk)}`
                  : 'No provider has been called yet.'}
          </Attention>
        </Panel>
      </div>
    </>
  );
}

export function Usage({ ov }: { ov: any }) {
  const t = ov.overview.totals,
    s = ov.overview.series,
    dates = ov.overview.dates;
  return (
    <>
      <ChartPanel
        title="Sign-in screen views and packing lists"
        sub="Per day"
        series={[
          { name: 'Sign-in screen views', values: s.landingViews, tone: 1 },
          { name: 'Packing lists started', values: s.checklistsCreated, tone: 2 },
        ]}
        dates={dates}
      />
      <div className="cs-kpis">
        <Kpi
          icon={<Search size={16} />}
          label="Sign-in screen views"
          value={t.landingViews}
          corner={`${nf.format(t.ctaClicks)} signed up`}
          cornerTone="ok"
          spark={s.landingViews}
        />
        <Kpi
          icon={<ListChecks size={16} />}
          label="Packing lists"
          value={t.checklistsCreated}
          corner={`${nf.format(t.checklistSaves)} saved`}
          cornerTone="ok"
          spark={s.checklistsCreated}
        />
        <Kpi
          icon={<CheckCircle2 size={16} />}
          label="Accepted analytics cookies"
          value={pct(t.consentOptIn)}
          corner={`${nf.format(t.consentAccept + t.consentReject)} choices`}
        />
        <Kpi
          icon={<Bookmark size={16} />}
          label="Feedback opened"
          value={t.feedbackOpened}
          corner={`${nf.format(t.enquiries)} sent`}
          spark={s.enquiries}
        />
      </div>
      <div className="cs-half">
        <RankTable
          title="Top airlines searched"
          keyLabel="Airline"
          countLabel="Searches"
          items={ov.overview.top.airlines}
          empty="No searches yet."
        />
        <RankTable
          title="Top routes"
          keyLabel="Route"
          countLabel="Searches"
          items={ov.overview.top.routes}
          empty="No routes yet."
        />
      </div>
      <div className="cs-half">
        <RankTable
          title="Outbound or inbound"
          keyLabel="Direction"
          countLabel="Searches"
          items={ov.overview.top.direction}
          empty="No data yet."
        />
        <RankTable
          title="Flight numbers people could not find"
          keyLabel="Flight"
          countLabel="Searches"
          items={ov.overview.top.notFoundNumbers}
          empty="Nothing missing. Every search found a flight."
        />
      </div>
    </>
  );
}

function ProviderRow({
  abbr,
  name,
  plan,
  value,
  children,
}: {
  abbr: string;
  name: string;
  plan: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="cs-meter">
      <div className="cs-meter-r">
        <div className="cs-provider">
          <span className="cs-lg" aria-hidden="true">
            {abbr}
          </span>
          <div>
            <b>{name}</b>
            <small>{plan}</small>
          </div>
        </div>
        <b className="cs-num">{value}</b>
      </div>
      {children}
    </div>
  );
}

export function Costs({ ov }: { ov: any }) {
  const t = ov.overview.totals,
    s = ov.overview.series,
    dates = ov.overview.dates,
    al = ov.allowance;
  const resets = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(al.month.slice(0, 4)), Number(al.month.slice(5, 7)), 1, 12)));
  const lat = Object.entries(ov.overview.latencyMs as Record<string, number | null>);
  return (
    <>
      <Panel
        title={`This month (${al.month})`}
        actions={
          al.runsOutBeforeMonthEnd ? (
            <Badge tone="warn">Runs out early</Badge>
          ) : (
            <Badge tone="ok">On track</Badge>
          )
        }
      >
        <ProviderRow
          abbr="ADB"
          name="AeroDataBox"
          plan={`Flight schedules, ${nf.format(al.cap)} units a month`}
          value={`${nf.format(al.used)} of ${nf.format(al.cap)}`}
        >
          <Meter
            used={al.used}
            cap={al.cap}
            label="AeroDataBox units used this month"
            stopLabel={`Stop at ${al.cap} units`}
          />
          <small>
            {al.perDay > 0
              ? `About ${al.perDay} units a day so far. ${al.runsOutBeforeMonthEnd ? `At this pace it runs out in about ${al.daysUntilEmpty} days; searches then fall back to live position and routes only.` : 'At this pace it lasts to the end of the month.'}`
              : 'No units used yet this month.'}{' '}
            Lookups stop at {nf.format(al.cap)} units. Resets on {resets}.
          </small>
        </ProviderRow>
        <ProviderRow
          abbr="OS"
          name="OpenSky Network"
          plan="Live aircraft position"
          value={`${nf.format(t.openskyFetches)} fetches`}
        >
          <small>
            {nf.format(t.openskyCacheHits)} answered from the cache · {nf.format(t.openskyErrors)}{' '}
            failed (this range)
          </small>
        </ProviderRow>
        <ProviderRow
          abbr="ADS"
          name="adsbdb"
          plan="Usual routes"
          value={`${nf.format(t.routeLookups)} lookups`}
        >
          <small>{nf.format(t.routeCacheHits)} answered from the cache (this range)</small>
        </ProviderRow>
      </Panel>
      <div className="cs-kpis">
        <Kpi
          icon={<Gauge size={16} />}
          label="Schedule cache hit rate"
          value={pct(t.adbCacheRatio)}
          corner={`${nf.format(t.adbCacheHits)} hits`}
          cornerTone="ok"
        />
        <Kpi
          icon={<CheckCircle2 size={16} />}
          label="Units saved by the cache"
          value={t.adbUnitsSaved}
          corner={`${nf.format(t.adbCalls)} paid calls`}
          spark={s.adbUnits}
        />
        <Kpi
          icon={<CircleSlash size={16} />}
          label="Blocked by limits"
          value={t.rateLimited}
          corner="too many requests"
          cornerTone={t.rateLimited ? 'warn' : 'muted'}
        />
        <Kpi
          icon={<CircleSlash size={16} />}
          label="Refused, not signed in"
          value={t.authDenied}
          corner="no valid sign-in"
          cornerTone={t.authDenied ? 'warn' : 'muted'}
        />
      </div>
      <div className="cs-two">
        <ChartPanel
          title="Paid units used"
          sub="AeroDataBox units per day. Repeat lookups within 10 minutes come from the cache."
          series={[{ name: 'Units', values: s.adbUnits, tone: 1 }]}
          dates={dates}
        />
        <Panel title="Average answer time" sub="Per provider, this range">
          {lat.length === 0 ? (
            <Empty>No provider calls yet.</Empty>
          ) : (
            <div
              className="cs-tw"
              tabIndex={0}
              role="region"
              aria-label="Table (scrolls sideways on small screens)"
            >
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th className="num">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {lat.map(([k, v]) => (
                    <tr key={k}>
                      <td className="cs-strong">{k}</td>
                      <td className="num">{v == null ? '—' : `${nf.format(v)} ms`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      <p className="cs-label">AI usage is not switched on, so there is no AI cost to show.</p>
    </>
  );
}

function Setup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cs-panel cs-setup">
      <span className="cs-setup-ico" aria-hidden="true">
        <Info size={20} />
      </span>
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function UsersView({ users }: { users: any }) {
  const [q, setQ] = useState('');
  if (!users.configured)
    return (
      <Setup title="Show your user numbers here">
        <p>
          This needs your Clerk <b>secret</b> key stored on the server (never in the browser). Add
          it to the private server config as <code>clerk_secret_key</code>. Until then, see your
          users in the{' '}
          <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer">
            Clerk dashboard <ExternalLink size={12} aria-hidden="true" />
          </a>
          .
        </p>
      </Setup>
    );
  if (users.error)
    return (
      <Setup title="Clerk did not answer">
        <p>{users.error}</p>
      </Setup>
    );
  const rows = (users.newest as any[]).filter((u) =>
    (u.email || '').toLowerCase().includes(q.trim().toLowerCase()),
  );
  const share = (n: number) =>
    users.total ? `${Math.round((n / users.total) * 100)}% of accounts` : undefined;
  return (
    <>
      <div className="cs-kpis">
        <Kpi icon={<Users size={16} />} label="Accounts" value={users.total} corner="all time" />
        <Kpi
          icon={<Users size={16} />}
          label="New in 7 days"
          value={users.signups7}
          corner={`${nf.format(users.signups30)} in 30 days`}
          cornerTone="ok"
        />
        <Kpi
          icon={<Users size={16} />}
          label="Active in 7 days"
          value={users.active7}
          corner={share(users.active7)}
        />
        <Kpi
          icon={<Users size={16} />}
          label="Active in 30 days"
          value={users.active30}
          corner={share(users.active30)}
        />
      </div>
      <Panel>
        <div className="cs-toolbar">
          <div className="cs-search">
            <Search size={18} aria-hidden="true" />
            <label className="cs-sr" htmlFor="cs-uq">
              Search users
            </label>
            <input
              id="cs-uq"
              className="cs-input"
              placeholder="Search by email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <span className="cs-label">
            Newest {nf.format(users.newest.length)} of {nf.format(users.total)} accounts
          </span>
        </div>
        <div
          className="cs-tw"
          tabIndex={0}
          role="region"
          aria-label="Table (scrolls sideways on small screens)"
        >
          <table className="cs-table">
            <thead>
              <tr>
                <th>Email</th>
                <th className="num">Joined</th>
                <th className="num">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td className="cs-strong">{u.email || '—'}</td>
                    <td className="num cs-muted">{when(u.createdAt)}</td>
                    <td className="num cs-muted">{when(u.lastActiveAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="cs-empty-cell">
                    {q ? `No one matches "${q}".` : 'No accounts yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="cs-label">
        From Clerk, refreshed every five minutes. Checked at {when(users.fetchedAt)}.
      </p>
    </>
  );
}

export function Analytics({ ga }: { ga: any }) {
  if (ga.configured && ga.error)
    return (
      <Setup title="Google Analytics is connected but not answering">
        <p>{ga.error}</p>
      </Setup>
    );
  if (!ga.configured)
    return (
      <Setup title="Connect Google Analytics">
        <p>
          Once you add your Google Analytics 4 Measurement ID to the app and a read-only Google
          service account to the server, its visitor numbers (countries, devices, traffic sources)
          will appear here. Until then, open Google Analytics directly.
        </p>
        <p>
          <a
            className="cs-btn ghost sm"
            href="https://analytics.google.com"
            target="_blank"
            rel="noreferrer"
          >
            Open Google Analytics <ExternalLink size={16} aria-hidden="true" />
          </a>
        </p>
      </Setup>
    );
  const t7 = ga.totals['7'],
    t28 = ga.totals['28'];
  const users: number[] = ga.series.map((d: any) => d.users);
  return (
    <>
      <div className="cs-kpis">
        <Kpi
          icon={<Users size={16} />}
          label="Visitors, 7 days"
          value={t7.users}
          corner={`${nf.format(t7.sessions)} visits`}
          spark={users.slice(-7)}
        />
        <Kpi
          icon={<Users size={16} />}
          label="Visitors, 28 days"
          value={t28.users}
          corner={`${nf.format(t28.sessions)} visits`}
          spark={users}
        />
        <Kpi
          icon={<Search size={16} />}
          label="Page views, 28 days"
          value={t28.pageViews}
          corner={`${nf.format(t7.pageViews)} in 7 days`}
        />
        <Kpi
          icon={<Bookmark size={16} />}
          label="Pages per visit"
          value={t28.sessions ? (t28.pageViews / t28.sessions).toFixed(1) : '—'}
          corner="last 28 days"
        />
      </div>
      <ChartPanel
        title="Visitors"
        sub={`Per day, ${nf.format(sum(users))} in total`}
        series={[{ name: 'Visitors', values: users, tone: 1 }]}
        dates={ga.series.map((d: any) => d.date)}
      />
      <div className="cs-half">
        <RankTable
          title="Top countries"
          keyLabel="Country"
          countLabel="Visitors"
          items={ga.countries}
          empty="No data yet."
        />
        <RankTable
          title="Devices"
          keyLabel="Device"
          countLabel="Visitors"
          items={ga.devices}
          empty="No data yet."
        />
      </div>
      <RankTable
        title="How people arrive"
        keyLabel="Source"
        countLabel="Visits"
        items={ga.channels}
        empty="No data yet."
      />
      <p className="cs-label">
        Only visitors who accepted analytics appear here, so these numbers are lower than real
        traffic. Checked at {when(ga.fetchedAt)}; refreshed every 15 minutes.
      </p>
    </>
  );
}

export function SystemView({ sys }: { sys: any }) {
  const flags: [string, boolean][] = [
    ['Sign-in required for lookups', sys.signInEnforced],
    ['Flight schedules (AeroDataBox)', sys.aerodatabox],
    ['Live aircraft position (OpenSky)', sys.opensky],
    ['User numbers (Clerk secret key)', sys.clerkApi],
    ['Google Analytics numbers', sys.googleAnalyticsApi],
    ['Email for new enquiries', sys.emailNotifications],
    ['AI features', sys.ai],
    ['Adverts', sys.ads],
    ['Per-visitor limits behind Cloudflare', sys.trustCloudflareIp],
  ];
  const on = flags.filter(([, v]) => v).length;
  return (
    <div className="cs-ed">
      <Panel
        title="What is switched on"
        sub={`${on} of ${flags.length} switched on. Read from the private server config.`}
      >
        <div className="cs-sysgrid">
          {flags.map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <b>{v ? <Badge tone="ok">On</Badge> : <Badge tone="grey">Off</Badge>}</b>
            </div>
          ))}
        </div>
      </Panel>
      <div className="cs-aside">
        <Panel title="Server">
          <ul className="cs-hist">
            <li>
              <span>
                <b>PHP</b>
                <small className="cs-num">{sys.phpVersion}</small>
              </span>
            </li>
            <li>
              <span>
                <b>Server time</b>
                <small className="cs-num">{when(sys.serverTime)}</small>
              </span>
            </li>
          </ul>
        </Panel>
        <Panel title="Changing these">
          <p className="cs-pb cs-muted">
            These switches live only in the private server config, never in the browser, so they
            cannot be changed from the console. Provider keys are never shown here.
          </p>
        </Panel>
      </div>
    </div>
  );
}
