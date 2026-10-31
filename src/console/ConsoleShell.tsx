import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  HeartPulse,
  History,
  Inbox as InboxIcon,
  LineChart,
  ListTree,
  Megaphone,
  MessageCircleQuestion,
  Plane,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brand } from '../shared/Logo';
import AuditView from './AuditView';
import { call } from './api';
import ContentSection, { type Section as ContentSectionId } from './content/ContentSection';
import HealthView from './HealthView';
import Inbox from './Inbox';
import { Analytics, Costs, Overview, SystemView, Usage, UsersView } from './Ops';
import { LoadError, Loading, PageHead, Toasts, useRise } from './ui';
import '../styles/console.css';

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type Id =
  | ContentSectionId
  | 'inbox'
  | 'overview'
  | 'usage'
  | 'costs'
  | 'health'
  | 'users'
  | 'analytics'
  | 'system'
  | 'audit';
const GROUPS: { title: string; items: { id: Id; label: string; icon: typeof Activity }[] }[] = [
  {
    title: 'Content',
    items: [
      { id: 'pages', label: 'Pages', icon: FileText },
      { id: 'guides', label: 'Guides', icon: BookOpen },
      { id: 'faqs', label: 'Help and FAQ', icon: MessageCircleQuestion },
      { id: 'announcements', label: 'Announcements', icon: Megaphone },
      { id: 'navigation', label: 'Menus', icon: ListTree },
    ],
  },
  { title: 'Inbox', items: [{ id: 'inbox', label: 'Enquiries', icon: InboxIcon }] },
  {
    title: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', icon: Activity },
      { id: 'usage', label: 'Usage', icon: BarChart3 },
      { id: 'costs', label: 'Costs and limits', icon: Gauge },
      { id: 'health', label: 'Provider health', icon: HeartPulse },
    ],
  },
  {
    title: 'People',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'analytics', label: 'Google Analytics', icon: LineChart },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'settings', label: 'Site settings', icon: Settings },
      { id: 'system', label: 'System', icon: Server },
      { id: 'audit', label: 'Audit log', icon: History },
    ],
  },
];
const ALL = GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
const CONTENT: Id[] = ['pages', 'guides', 'faqs', 'announcements', 'navigation', 'settings'];
type OpsId = 'overview' | 'usage' | 'costs' | 'users' | 'analytics' | 'system';
const OPS: OpsId[] = ['overview', 'usage', 'costs', 'users', 'analytics', 'system'];
const RANGED: Id[] = ['overview', 'usage', 'costs'];
const TITLES: Record<OpsId, [string, string]> = {
  overview: ['Overview', 'Searches, people and the paid allowance.'],
  usage: ['Usage', 'What people look up and use.'],
  costs: ['Costs and limits', 'Provider allowances, the cache and how much is used.'],
  users: ['Users', 'Accounts, from Clerk.'],
  analytics: ['Google Analytics', 'Only visitors who accepted analytics cookies.'],
  system: ['System', 'What is switched on.'],
};

/** #/admin/<section>/<id> -> [section, id]. */
const parse = (): [Id, string | null] => {
  const p = location.hash.replace(/^#\/?admin\/?/, '').split('/');
  const s = p[0] as Id;
  return [
    ALL.some((x) => x.id === s) ? s : 'overview',
    p[1] ? decodeURIComponent(p.slice(1).join('/')) : null,
  ];
};

/**
 * The owner console. Every request is checked on the server (verified sign-in plus the owner's user id); this screen only shows
 * it. It has its own full-page frame (sidebar, top bar), so while it is open it is drawn straight into <body> and the app's own
 * frame is hidden (`html.cs-open`, see console.css). Leaving #/admin unmounts it and the app comes back as it was.
 */
export default function ConsoleShell({ onUnread }: { onUnread: (n: number) => void }) {
  const [[section, openId], setRoute] = useState<[Id, string | null]>(parse);
  const [days, setDays] = useState(30),
    [err, setErr] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(0),
    [unread, setUnread] = useState<number | null>(null),
    [itemTitle, setItemTitle] = useState<string | null>(null);
  const [ov, setOv] = useState<any>(null),
    [users, setUsers] = useState<any>(null),
    [sys, setSys] = useState<any>(null),
    [ga, setGa] = useState<any>(null);
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('cs-open');
    return () => html.classList.remove('cs-open');
  }, []);
  useEffect(() => {
    const f = () => setRoute(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  // A new screen starts at the top, and the editor's title in the breadcrumb is cleared until the editor sets it again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every route change by design
  useEffect(() => {
    setItemTitle(null);
    window.scrollTo?.(0, 0);
  }, [section, openId]);
  const go = (s: Id, id: string | null = null) => {
    const h = `#/admin/${s}${id ? `/${encodeURIComponent(id)}` : ''}`;
    if (location.hash !== h) location.hash = h;
    else setRoute([s, id]);
  };
  const noteUnread = useCallback(
    (n: number) => {
      setUnread(n);
      onUnread(n);
    },
    [onUnread],
  );
  // Operations data. A newer request (another range, another section) cancels the one still in flight.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is the Refresh button
  useEffect(() => {
    if (!OPS.includes(section as OpsId)) return;
    const ctl = new AbortController();
    setBusy(true);
    setErr(null);
    (async () => {
      try {
        if (RANGED.includes(section)) {
          const d = await call(`/api/admin/overview?days=${days}`, { signal: ctl.signal });
          setOv(d);
          noteUnread(d.unread);
        } else if (section === 'users')
          setUsers(await call('/api/admin/users', { signal: ctl.signal }));
        else if (section === 'system')
          setSys(await call('/api/admin/system', { signal: ctl.signal }));
        else if (section === 'analytics')
          setGa(await call('/api/admin/analytics', { signal: ctl.signal }));
      } catch (e) {
        if (!ctl.signal.aborted) setErr(e);
      } finally {
        if (!ctl.signal.aborted) setBusy(false);
      }
    })();
    return () => ctl.abort();
  }, [section, days, tick, noteUnread]);
  useEffect(() => {
    if (unread === null)
      call('/api/admin/overview?days=1')
        .then((d) => noteUnread(d.unread))
        .catch(() => {});
  }, [unread, noteUnread]);

  const view = useRef<HTMLDivElement>(null);
  const isOps = OPS.includes(section as OpsId);
  const opsData =
    section === 'users' ? users : section === 'system' ? sys : section === 'analytics' ? ga : ov;
  // Operations screens rise in when their numbers arrive (the other screens animate themselves when they have loaded).
  useRise(view, [section, isOps && !!opsData, isOps ? days : 0], isOps);

  const cur = ALL.find((x) => x.id === section) ?? ALL[0];
  const opsHead = isOps && (
    <PageHead
      title={TITLES[section as OpsId][0]}
      lede={
        RANGED.includes(section)
          ? `${TITLES[section as OpsId][1]} The last ${days} days.`
          : TITLES[section as OpsId][1]
      }
      actions={
        <>
          {RANGED.includes(section) && (
            <div className="cs-seg" role="group" aria-label="Time range">
              {[7, 30, 90].map((d) => (
                <button type="button" key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
                  {d} days
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="cs-btn ghost sm"
            onClick={() => setTick((t) => t + 1)}
            disabled={busy}
          >
            <RefreshCw size={16} className={busy ? 'cs-spin' : ''} aria-hidden="true" />
            Refresh
          </button>
        </>
      }
    />
  );
  const opsBody = (() => {
    if (!isOps) return null;
    if (err && !opsData) return <LoadError error={err} retry={() => setTick((t) => t + 1)} />;
    if (!opsData) return <Loading />;
    switch (section) {
      case 'overview':
        return <Overview ov={ov} days={days} />;
      case 'usage':
        return <Usage ov={ov} />;
      case 'costs':
        return <Costs ov={ov} />;
      case 'users':
        return <UsersView users={users} />;
      case 'analytics':
        return <Analytics ga={ga} />;
      default:
        return <SystemView sys={sys} />;
    }
  })();

  const shell = (
    <div className="cs">
      <a className="cs-skip" href="#cs-view">
        Skip to content
      </a>
      <div className="cs-shell">
        <aside className="cs-side" aria-label="Console navigation">
          <div className="cs-side-brand">
            <Brand href="/" size={30} />
            <span className="cs-badge violet plain cs-ctx">Owner console</span>
          </div>
          <nav className="cn-nav" aria-label="Owner console sections">
            {GROUPS.map((g) => (
              <div key={g.title} className="cs-grp">
                <h2>{g.title}</h2>
                <ul>
                  {g.items.map((x) => (
                    <li key={x.id}>
                      <a
                        href={`#/admin/${x.id}`}
                        aria-current={section === x.id ? 'page' : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          go(x.id);
                        }}
                      >
                        <x.icon size={18} aria-hidden="true" />
                        <span>{x.label}</span>
                        {x.id === 'inbox' && !!unread && (
                          <span className="cs-count">
                            {unread}
                            <span className="cs-sr"> unread</span>
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="cs-side-bottom">
            <a href="/">
              <Globe size={16} aria-hidden="true" />
              View the website
            </a>
            <a href="#/">
              <Plane size={16} aria-hidden="true" />
              Open the app
            </a>
          </div>
        </aside>
        <div className="cs-main">
          <header className="cs-top">
            <div className="cs-mnav">
              <label className="cs-sr" htmlFor="cs-msel">
                Console section
              </label>
              <select
                id="cs-msel"
                value={section}
                onChange={(e) => go(e.target.value as Id)}
                className="cs-input"
              >
                {GROUPS.map((g) => (
                  <optgroup key={g.title} label={g.title}>
                    {g.items.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                        {x.id === 'inbox' && unread ? ` (${unread} unread)` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <nav className="cs-crumb" aria-label="Breadcrumb">
              <span>{cur.group}</span>
              <ChevronRight size={16} aria-hidden="true" />
              <b aria-current="page">{itemTitle || cur.label}</b>
            </nav>
            <div className="cs-top-end">
              <a className="cs-btn ghost sm cs-viewsite" href="/" target="_blank" rel="noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                View site
              </a>
              <span className="cs-avatar" title="Signed in as the owner">
                <ShieldCheck size={18} aria-hidden="true" />
                <span className="cs-sr">Signed in as the owner</span>
              </span>
            </div>
          </header>
          {/* A div with role="main", not <main>: the app styles every <main> element (margins, widths, children), and none of that may reach the console. */}
          {/* biome-ignore lint/a11y/useSemanticElements: see the line above */}
          <div className="cs-view" id="cs-view" role="main" tabIndex={-1} ref={view}>
            {CONTENT.includes(section) && (
              <ContentSection
                key={section}
                section={section as ContentSectionId}
                openId={openId}
                navigate={(id) => go(section, id)}
                onTitle={setItemTitle}
              />
            )}
            {section === 'inbox' && <Inbox onUnread={noteUnread} />}
            {section === 'health' && <HealthView />}
            {section === 'audit' && <AuditView />}
            {opsHead}
            {isOps && err && opsData ? <LoadError error={err} /> : null}
            {opsBody}
          </div>
        </div>
      </div>
      <Toasts />
    </div>
  );
  return createPortal(shell, document.body);
}
