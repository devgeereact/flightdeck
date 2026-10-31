import { registerSW } from 'virtual:pwa-register';
import Lenis from 'lenis';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  CircleHelp,
  Info,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Announcements from './app/Announcements';
import AppBoundary from './app/AppBoundary';
import AuthLoading from './app/AuthLoading';
import { AuthBar, SavedSync, SignedOutCleanup, SignOutItem, TokenBridge } from './app/auth';
import { clerkAppearance } from './app/clerkAppearance';
import Feedback, { openFeedback } from './app/Feedback';
import HelpView from './app/HelpView';
import InstallHelp from './app/InstallHelp';
import SavedFlights from './app/SavedFlightCollection';
import { recallResult, rememberResult, type SavedItem } from './app/savedFlights';
import TrackerHome from './app/TrackerHome';
import FlightView from './features/flight/FlightView';
import { time, ukDate } from './features/flight/flightFormat';
import SiteFooter from './SiteFooter';
import { apiFetch, readableError } from './shared/api';
import { Brand } from './shared/Logo';
import { smoothScrollAllowed } from './shared/smoothScroll';
import { ga, gaPageview, track } from './shared/track';
import type { Flight, FlightResponse } from './types';
import 'lenis/dist/lenis.css';
import { ClerkProvider, useAuth } from '@clerk/react';
import './styles/tokens.css';
import './style.css';
import './styles/workspace.css';

const today = () => ukDate();
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
// A flight can be opened from a link: #/flight/BA59/2026-10-25
const FLIGHT_LINK = /^#\/flight\/([A-Z0-9]{3,8})\/(\d{4}-\d{2}-\d{2})$/;
const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const ROUTES = ['overview', 'saved', 'checklist', 'help', 'admin'];
// The owner console has its own sections under #/admin/<section>/..., so only the first part picks the screen.
const readRoute = () => {
  const h = location.hash.replace(/^#\/?/, '').split('/')[0];
  return ROUTES.includes(h) ? h : 'overview';
};
// Smooth scrolling for the signed-in app. Lenis sits on top of normal scrolling, so keyboard, find-in-page and anchors keep working. It is never started for people who prefer reduced motion (see smoothScroll.ts).
let lenis: Lenis | null = null;
const toTop = () => {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
};
// Tiny hash router: #/checklist etc. Works with the static host (no server rewrites) and with the browser back button.
function useHashRoute(): [string, (r: string) => void] {
  const [r, setR] = useState(readRoute);
  useEffect(() => {
    const f = () => {
      setR(readRoute());
      toTop();
      gaPageview();
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return [
    r,
    (n: string) => {
      const next = n === 'overview' ? '' : '/' + n;
      if (location.hash.replace(/^#/, '') !== next) location.hash = next;
      else setR(readRoute());
    },
  ];
}
const ChecklistView = lazy(() => import('./features/checklist/Checklist'));
const AdminView = lazy(() => import('./console/ConsoleShell'));
const SignInScreen = lazy(() => import('./app/SignInScreen'));
// Signed-out visitors get the sign-in screen; signed-in users get the app. Without a Clerk key the app is open (no accounts).
function Gate() {
  const { isLoaded, isSignedIn } = useAuth();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, [isLoaded]);
  if (!isLoaded) return <AuthLoading failed={slow} />;
  return isSignedIn ? (
    <Dashboard />
  ) : (
    <>
      <SignedOutCleanup />
      <Suspense fallback={<AuthLoading />}>
        <SignInScreen />
      </Suspense>
    </>
  );
}
type NavItem = {
  id: string;
  icon: typeof LayoutGrid;
  label: string;
  text: string;
  short: string;
  count: number | null;
};
function Dashboard() {
  const [number, setNumber] = useState(''),
    [date, setDate] = useState(today),
    [live, setLive] = useState(true),
    [data, setData] = useState<FlightResponse | null>(null),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [tab, setTab] = useHashRoute(),
    [online, setOnline] = useState(navigator.onLine),
    [now, setNow] = useState(new Date()),
    [auto, setAuto] = useState(false),
    [changes, setChanges] = useState<string[]>([]),
    [saved, setSaved] = useState<SavedItem[]>(() => {
      try {
        return JSON.parse(localStorage.getItem('flightdeck-saved') || '[]');
      } catch {
        return [];
      }
    }),
    [install, setInstall] = useState<any>(null),
    [needRefresh, setNeedRefresh] = useState(false),
    [userId, setUserId] = useState<string | null>(null),
    [packFor, setPackFor] = useState<SavedItem | null>(null),
    [me, setMe] = useState<{ isAdmin: boolean; unread: number | null }>({
      isAdmin: false,
      unread: null,
    }),
    [signedIn, setSignedIn] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const [stale, setStale] = useState(''),
    [shareNote, setShareNote] = useState(''),
    [installHelp, setInstallHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null),
    request = useRef<AbortController | null>(null),
    version = useRef(0),
    previous = useRef<Flight | null>(null),
    active = useRef<{ number: string; date: string } | null>(null),
    // The last look-up asked for, so "Try again" after a failed search repeats it (active is only set after a success).
    attempt = useRef<{ number: string; date: string } | null>(null);
  const flight = data?.flights[selected];
  useEffect(() => {
    if (!CLERK_KEY || !userId) {
      setMe({ isAdmin: false, unread: null });
      return;
    }
    let live = true;
    apiFetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (live && j) setMe({ isAdmin: !!j.isAdmin, unread: j.unread ?? null });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);
  useEffect(() => {
    if (!smoothScrollAllowed()) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.12, allowNestedScroll: true });
    lenis = l;
    return () => {
      l.destroy();
      if (lenis === l) lenis = null;
    };
  }, []);
  useEffect(() => {
    const f = () => {
      track('pwa_install');
      ga('pwa_install');
    };
    window.addEventListener('appinstalled', f);
    return () => window.removeEventListener('appinstalled', f);
  }, []);
  useEffect(() => {
    updateRef.current = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW: (_url, r) => {
        if (r)
          setInterval(() => {
            r.update().catch(() => {});
          }, 3600000);
      },
    });
  }, []);
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => setLive(!!d.liveAvailable))
      .catch(() => {});
    const a = () => setOnline(true),
      b = () => setOnline(false),
      i = (e: Event) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    window.addEventListener('beforeinstallprompt', i);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
      window.removeEventListener('beforeinstallprompt', i);
    };
  }, []);
  async function load(n = number, d = date, refresh = false) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const id = ++version.current;
    attempt.current = { number: n, date: d };
    setBusy(true);
    setError('');
    setStale('');
    if (!refresh) {
      setData(null);
      setChanges([]);
      previous.current = null;
      active.current = null;
      setAuto(false);
    }
    try {
      const r = await apiFetch(`/api/flights?number=${encodeURIComponent(n)}&date=${d}&mode=live`, {
        signal: controller.signal,
      });
      const result = await r.json();
      if (!r.ok)
        throw Error(result.error || 'Flightdeck could not get this flight. Please try again.');
      if (version.current !== id) return;
      const p = previous.current;
      const next: Flight | undefined = p
        ? result.flights.find((f: Flight) => f.id === p.id)
        : result.flights[0];
      if (refresh && p && next) {
        const updates: string[] = [];
        for (const [key, label] of [
          ['status', 'Status'],
          ['gateOut', 'Departure gate'],
          ['gateIn', 'Arrival gate'],
          ['baggage', 'Baggage belt'],
          ['estimatedIn', 'Estimated arrival'],
        ] as const) {
          if (p[key] !== next[key])
            updates.push(
              `${label} updated at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
            );
        }
        if (updates.length) setChanges((old) => [...updates, ...old].slice(0, 8));
      }
      ga('flight_search', { result: result.flights.length ? 'ok' : 'fail' });
      setData(result);
      rememberResult(n + '|' + d, result);
      try {
        if (!refresh || location.hash.startsWith('#/flight/'))
          history.replaceState(null, '', `#/flight/${n}/${d}`);
      } catch {
        /* old browsers: no link, still works */
      }
      setSelected(
        Math.max(0, next ? result.flights.findIndex((f: Flight) => f.id === next.id) : 0),
      );
      previous.current = next || null;
      active.current = { number: n, date: d };
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && version.current === id) {
        const kept = recallResult(n + '|' + d);
        if (kept && (!navigator.onLine || (e as Error).name === 'TypeError')) {
          setData(kept.data);
          active.current = { number: n, date: d };
          setStale(
            `You're offline. This is what Flightdeck last fetched at ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: localZone() }).format(new Date(kept.at))}, so it may be out of date.`,
          );
        } else setError(readableError(e));
      }
    } finally {
      if (version.current === id) setBusy(false);
    }
  }
  useEffect(() => {
    if (!auto || !online) return;
    const timer = setInterval(() => {
      const a = active.current;
      if (a) void load(a.number, a.date, true);
    }, 60000);
    return () => clearInterval(timer);
  }, [auto, online]);
  const storeSaved = (items: SavedItem[], failText: string) => {
    setSaved(items);
    try {
      localStorage.setItem('flightdeck-saved', JSON.stringify(items));
    } catch {
      setError(failText);
    }
  };
  const isSaved = (n: { number: string; date: string } | null) =>
    !!n && saved.some((s) => s.number === n.number && s.date === n.date);
  // Save toggles: a flight that is already saved is removed again (the button then reads "Saved").
  function save() {
    const a = active.current;
    if (!a) return;
    if (isSaved(a)) {
      storeSaved(
        saved.filter((s) => s.number !== a.number || s.date !== a.date),
        'Your browser could not update saved flights.',
      );
      return;
    }
    ga('flight_saved');
    storeSaved(
      [a, ...saved.filter((s) => s.number !== a.number || s.date !== a.date)].slice(0, 12),
      'Your browser could not save this flight.',
    );
  }
  const refresh = () => {
    const a = active.current || attempt.current;
    if (a) void load(a.number, a.date, !!active.current);
  };
  // Back to the tracker's start screen: forget the flight on screen (it stays in the offline copy and can be opened again).
  const clearFlight = () => {
    request.current?.abort();
    version.current++;
    setBusy(false);
    setData(null);
    setError('');
    setStale('');
    setChanges([]);
    setAuto(false);
    previous.current = null;
    active.current = null;
    try {
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    const m = location.hash.match(FLIGHT_LINK);
    if (m) {
      setNumber(m[1]);
      setDate(m[2]);
      void load(m[1], m[2]);
    }
  }, []);
  const openFlight = (s: SavedItem) => {
    setNumber(s.number);
    setDate(s.date);
    setTab('overview');
    void load(s.number, s.date);
  };
  const removeSaved = (index: number) =>
    storeSaved(
      saved.filter((_, j) => j !== index),
      'Your browser could not update saved flights.',
    );
  async function share() {
    const a = active.current;
    if (!a) return;
    const url = `${location.origin}/app/#/flight/${a.number}/${a.date}`;
    const note = (t: string, ms = 3000) => {
      setShareNote(t);
      setTimeout(() => setShareNote(''), ms);
    };
    try {
      if (navigator.share) {
        await navigator.share({ title: `${a.number} on Flightdeck`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      note('Link copied. Anyone signed in can open it.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') note('Copy this link: ' + url, 8000);
    }
  }
  const installApp = async () => {
    if (install) {
      await install.prompt();
      setInstall(null);
    } else setInstallHelp(true);
  };
  const lookup = () => {
    if (!number.trim()) {
      searchRef.current?.focus();
      return;
    }
    setTab('overview');
    void load();
  };
  // The travel menu: the sidebar shows full labels (icons only between 761 and 1200px), the phone tab bar short ones.
  const navItems: NavItem[] = [
    {
      id: 'overview',
      icon: LayoutGrid,
      label: 'Flight tracker',
      text: 'Tracker',
      short: 'Tracker',
      count: null,
    },
    {
      id: 'saved',
      icon: Bookmark,
      label: 'Saved flights',
      text: 'Saved flights',
      short: 'Saved',
      count: saved.length,
    },
    {
      id: 'checklist',
      icon: ListChecks,
      label: 'Packing list',
      text: 'Packing list',
      short: 'Packing',
      count: null,
    },
  ];
  const navName = (n: NavItem) => (n.count == null ? n.label : `${n.label} (${n.count})`);
  const go = (id: string) => {
    // The tracker item always leads to the tracker's start screen, as the breadcrumb does.
    if (id === 'overview' && tab === 'overview') clearFlight();
    setTab(id);
  };
  const skipToMain = (e: React.MouseEvent) => {
    e.preventDefault();
    const m = document.getElementById('main');
    m?.focus();
    m?.scrollIntoView?.();
  };
  const ownerName = me.unread ? `Owner console (${me.unread} unread)` : 'Owner console';
  const legPicker =
    data && data.flights.length > 1 ? (
      <label className="flight-picker">
        Choose a leg{' '}
        <select
          onChange={(e) => {
            const i = Number(e.target.value);
            setSelected(i);
            previous.current = data.flights[i];
          }}
          value={selected}
        >
          {data.flights.map((f, i) => (
            <option value={i} key={f.id}>
              {f.number} · {f.origin.code} → {f.destination.code} ·{' '}
              {time(f.scheduledOut, f.origin.timezone)}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={skipToMain}>
        Skip to content
      </a>
      {CLERK_KEY && <TokenBridge />}
      {CLERK_KEY && (
        <SavedSync
          saved={saved}
          setSaved={(items) => {
            setSaved(items);
            try {
              localStorage.setItem('flightdeck-saved', JSON.stringify(items));
            } catch {}
          }}
          setSignedIn={setSignedIn}
          setUserId={setUserId}
        />
      )}
      <aside className="sidebar" aria-label="Sidebar">
        <Brand href="#" className="side-brand" />
        <h2 className="side-label">Travel</h2>
        <nav className="side-nav" aria-label="Main">
          {navItems.map((n) => (
            <button
              key={n.id}
              type="button"
              className={'nav nav-' + n.id + (tab === n.id ? ' active' : '')}
              aria-current={tab === n.id ? 'page' : undefined}
              aria-label={navName(n)}
              title={navName(n)}
              onClick={() => go(n.id)}
            >
              <n.icon size={20} aria-hidden="true" />
              <span className="nav-text">{n.text}</span>
              {n.count != null && <span className="count fd-data">{n.count}</span>}
            </button>
          ))}
        </nav>
        <h2 className="side-label">Support</h2>
        <nav className="side-nav" aria-label="Support">
          <button
            type="button"
            className={'nav' + (tab === 'help' ? ' active' : '')}
            aria-current={tab === 'help' ? 'page' : undefined}
            aria-label="Help and FAQ"
            title="Help and FAQ"
            onClick={() => setTab('help')}
          >
            <CircleHelp size={20} aria-hidden="true" />
            <span className="nav-text">Help and FAQ</span>
          </button>
          <button
            type="button"
            className="nav"
            aria-label="Send feedback"
            title="Send feedback"
            onClick={openFeedback}
          >
            <MessageCircle size={20} aria-hidden="true" />
            <span className="nav-text">Send feedback</span>
          </button>
          <button
            type="button"
            className="nav install"
            aria-label="Install the app"
            title="Install the app"
            onClick={() => void installApp()}
          >
            <Smartphone size={20} aria-hidden="true" />
            <span className="nav-text">Install the app</span>
          </button>
        </nav>
        <div className="side-foot">
          {!online && (
            <p className="connection" role="status">
              <span className="dot offline" />
              <span className="nav-text">Offline · updates paused</span>
            </p>
          )}
          {me.isAdmin && (
            <button
              type="button"
              className={'owner-link' + (tab === 'admin' ? ' active' : '')}
              aria-current={tab === 'admin' ? 'page' : undefined}
              aria-label={ownerName}
              title={ownerName}
              onClick={() => setTab('admin')}
            >
              <ShieldCheck size={20} aria-hidden="true" />
              <span className="nav-text">Owner console</span>
              {me.unread ? <span className="count fd-data">{me.unread}</span> : null}
            </button>
          )}
          {CLERK_KEY && <SignOutItem />}
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <header className="topbar">
          <Brand href="#" className="top-brand" />
          <form
            className="topsearch"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              lookup();
            }}
          >
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="Look up a flight number"
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              placeholder="Look up a flight, such as BA117"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
            />
          </form>
          <div className="top-end">
            <Announcements />
            <Feedback />
            {CLERK_KEY ? (
              <AuthBar isAdmin={me.isAdmin} onConsole={() => setTab('admin')} />
            ) : (
              <span className="avatar" aria-hidden="true">
                FD
              </span>
            )}
          </div>
        </header>
        <div className={'view view-' + tab}>
          {needRefresh && (
            <div role="status" className="notice">
              <RefreshCw size={18} aria-hidden="true" />
              <span>
                <strong>A new version is ready.</strong> Reload to update.
              </span>
              <button className="text-button" onClick={() => void updateRef.current?.(true)}>
                Reload
              </button>
            </div>
          )}
          {!online && (
            <div className="notice error">
              <AlertCircle size={18} aria-hidden="true" />
              <span>
                You're offline. What you've already loaded may be out of date. Updates restart when
                you're back online.
              </span>
            </div>
          )}
          {tab === 'overview' && stale && (
            <div role="status" className="notice warn">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{stale}</span>
            </div>
          )}
          {error && (
            <div role="alert" className="notice error">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
              <button className="text-button" onClick={refresh}>
                Try again
              </button>
            </div>
          )}
          {tab === 'overview' && !live && (
            <div className="notice error">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Live flight data is not configured on this server yet.</span>
            </div>
          )}
          {tab === 'admin' ? (
            me.isAdmin ? (
              <Suspense
                fallback={
                  <div role="status" className="panel state">
                    Loading the owner console…
                  </div>
                }
              >
                <AdminView onUnread={(n: number) => setMe((m) => ({ ...m, unread: n }))} />
              </Suspense>
            ) : (
              <div className="panel state">
                <span className="tile">
                  <ShieldCheck size={28} aria-hidden="true" />
                </span>
                <h1>This area is for the site owner</h1>
                <p>You are signed in, but this account does not have owner access.</p>
              </div>
            )
          ) : tab === 'checklist' ? (
            <Suspense
              fallback={
                <div role="status" className="panel state">
                  Loading your packing list…
                </div>
              }
            >
              <ChecklistView
                saved={saved}
                signedIn={signedIn}
                userId={userId}
                request={packFor}
                onRequestDone={() => setPackFor(null)}
                onTrack={(n: string, d: string) => openFlight({ number: n, date: d })}
              />
            </Suspense>
          ) : tab === 'saved' ? (
            <SavedFlights
              items={saved}
              signedIn={signedIn}
              onOpen={openFlight}
              onPack={(s) => {
                setPackFor(s);
                setTab('checklist');
              }}
              onRemove={removeSaved}
              onLookup={() => go('overview')}
            />
          ) : tab === 'help' ? (
            <HelpView
              onFeedback={openFeedback}
              onInstall={() => void installApp()}
              account={!!CLERK_KEY}
            />
          ) : flight && data ? (
            <>
              <nav className="crumb" aria-label="Breadcrumb">
                <button type="button" onClick={clearFlight}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Tracker
                </button>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{flight.number}</span>
              </nav>
              {data.notes?.length ? (
                <div role="status" className="notice">
                  <Info size={18} aria-hidden="true" />
                  <span>{data.notes.join(' ')}</span>
                </div>
              ) : null}
              <FlightView
                flight={flight}
                data={data}
                now={now}
                busy={busy}
                auto={auto}
                setAuto={setAuto}
                changes={changes}
                onRefresh={refresh}
                onSave={save}
                saved={isSaved(active.current)}
                offline={!!stale}
                onShare={() => void share()}
                legPicker={legPicker}
              />
            </>
          ) : (
            <TrackerHome
              number={number}
              setNumber={setNumber}
              date={date}
              setDate={setDate}
              busy={busy}
              data={data}
              error={error}
              searchRef={searchRef}
              onSearch={lookup}
              saved={saved}
              userId={userId}
              now={now}
              onOpen={openFlight}
              onPack={(s) => {
                setPackFor(s);
                setTab('checklist');
              }}
              onRemove={removeSaved}
              onGo={setTab}
            />
          )}
        </div>
        {installHelp && <InstallHelp onClose={() => setInstallHelp(false)} />}
        {shareNote && (
          <div className="toast" role="status">
            {shareNote}
          </div>
        )}
        <div className="sf-gap" />
        <SiteFooter inApp />
      </main>
      <nav className="mobile-nav" aria-label="Main">
        {navItems.map((n) => (
          <button
            key={n.id}
            type="button"
            className={tab === n.id ? 'on' : undefined}
            aria-current={tab === n.id ? 'page' : undefined}
            aria-label={n.count ? `${n.short} (${n.count})` : undefined}
            onClick={() => go(n.id)}
          >
            <n.icon size={20} aria-hidden="true" />
            {n.short}
          </button>
        ))}
        <button
          type="button"
          className={tab === 'help' ? 'on' : undefined}
          aria-current={tab === 'help' ? 'page' : undefined}
          onClick={() => setTab('help')}
        >
          <CircleHelp size={20} aria-hidden="true" />
          Help
        </button>
      </nav>
    </div>
  );
}
const app = CLERK_KEY ? <Gate /> : <Dashboard />;
createRoot(document.getElementById('root')!).render(
  <AppBoundary>
    <React.StrictMode>
      {CLERK_KEY ? (
        <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/" appearance={clerkAppearance}>
          {app}
        </ClerkProvider>
      ) : (
        app
      )}
    </React.StrictMode>
  </AppBoundary>,
);
