import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  Lightbulb,
  Link2,
  ListChecks,
  Pencil,
  Plane,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../shared/api';
import { fromAny, withMotion } from '../../shared/motion';
import { ga, track } from '../../shared/track';
import { summarise } from '../flight/summary';
import * as M from './checklistModel';
import { suggest } from './checklistRules';
import { clearLocal, getOwner, loadLocal, saveLocal, setOwner } from './checklistStore';
import { httpApi, syncOnce } from './checklistSync';
import { TEMPLATE } from './checklistTemplate';
import { contextFromFlight, weatherStale } from './tripContext';
import './packingBoard.css';

gsap.registerPlugin(useGSAP);
type Saved = { number: string; date: string };
type Props = {
  saved: Saved[];
  signedIn: boolean;
  userId: string | null;
  request: Saved | null;
  onRequestDone: () => void;
  onTrack: (n: string, d: string) => void;
};
const shortDate = (d: string) => {
  const t = new Date(d + 'T12:00:00');
  return isNaN(+t)
    ? d
    : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(t);
};
const tripNameFor = (f: Saved) => `${f.number} · ${shortDate(f.date)}`;

function Ring({ percent, size = 64 }: { percent: number; size?: number }) {
  const r = size / 2 - 6,
    c = 2 * Math.PI * r;
  return (
    <svg
      className="ck-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${percent}% packed`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3eadf" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#214e3e"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .4s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ck-ring-text">
        {percent}%
      </text>
    </svg>
  );
}

type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error';
export default function Checklist({
  saved,
  signedIn,
  userId,
  request,
  onRequestDone,
  onTrack,
}: Props) {
  // A list left on this device by a different account is never shown to this one.
  const [data, setData] = useState<M.ChecklistData>(() => {
    const owner = getOwner();
    if (userId && owner && owner !== userId) {
      clearLocal();
      return M.emptyData();
    }
    return loadLocal();
  });
  const [sync, setSync] = useState<SyncState>('local');
  const syncing = useRef(false),
    again = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(false);
  const [onlyLeft, setOnlyLeft] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState<string | null>(null),
    [act, setAct] = useState<string | null>(null);
  const [addText, setAddText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false),
    [confirmErase, setConfirmErase] = useState(false),
    [ctxBusy, setCtxBusy] = useState(false),
    [ctxNote, setCtxNote] = useState('');

  // One place every change goes through: apply, check it still fits, keep it on this device straight away (works offline).
  const commit = (fn: (d: M.ChecklistData) => M.ChecklistData) => {
    const prev = dataRef.current;
    const next = fn(prev);
    if (next === prev) return;
    if (next.trips.some((t) => !prev.trips.some((p) => p.id === t.id))) {
      track('checklist_created');
      ga('checklist_created');
    }
    const p = next.trips.find((t) => t.id === next.active);
    if (p) {
      const pr = M.progress(M.view(next, p.id));
      if (pr.total > 0 && pr.done === pr.total) {
        try {
          const k = 'fd-done-' + p.id;
          if (!localStorage.getItem(k)) {
            localStorage.setItem(k, '1');
            track('checklist_completed');
            ga('checklist_completed', { bucket: '100' });
          }
        } catch {}
      }
    }
    if (!M.fits(next)) {
      setMsg('Your packing list is full. Remove a trip or some of your own items first.');
      return;
    }
    dataRef.current = next;
    setData(next);
    setMsg('');
    if (!saveLocal(next))
      setMsg('Your browser could not save this. Changes will be lost when you close the page.');
    scheduleSync();
  };

  // Reconcile with the account copy: pull, merge, push. Failures never lose anything; the list stays on this device and retries later.
  const runSync = async () => {
    if (!userId) return;
    if (syncing.current) {
      again.current = true;
      return;
    }
    syncing.current = true;
    setSync('syncing');
    try {
      const res = await syncOnce(dataRef.current, httpApi(apiFetch));
      const final = { ...M.merge(dataRef.current, res), rev: res.rev };
      dataRef.current = final;
      setData(final);
      saveLocal(final);
      setOwner(userId);
      setSync('synced');
    } catch {
      setSync(navigator.onLine ? 'error' : 'offline');
    } finally {
      syncing.current = false;
      if (again.current) {
        again.current = false;
        void runSync();
      }
    }
  };
  function scheduleSync() {
    if (!userId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void runSync();
    }, 900);
  }
  useEffect(() => {
    if (!userId) return;
    void runSync();
    const online = () => {
      void runSync();
    };
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('online', online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId]);

  // "Make a packing list for this flight" from the saved-flights list.
  useEffect(() => {
    if (!request) return;
    const existing = dataRef.current.trips.find(
      (t) => t.flight && t.flight.number === request.number && t.flight.date === request.date,
    );
    if (existing) {
      commit((d) => ({ ...d, active: existing.id }));
      if (!existing.ctx) void loadContext(existing.id, request);
    } else {
      const next = M.addTrip(dataRef.current, tripNameFor(request), request);
      commit(() => next);
      const created = next.trips.find((t) => t.id === next.active);
      if (created) void loadContext(created.id, request);
    }
    onRequestDone();
  }, [request]);

  // Read the linked flight once (the server caches it) and keep only the few facts the suggestions need. Weather is refreshed for free later.
  async function loadContext(tripId: string, flight: Saved) {
    setCtxBusy(true);
    setCtxNote('');
    try {
      const r = await apiFetch(
        `/api/flights?number=${encodeURIComponent(flight.number)}&date=${flight.date}&mode=live`,
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.error || '');
      const f = j.flights?.[0];
      if (!f) throw Error('not found');
      let w = null;
      if (typeof f.destination?.lat === 'number') {
        try {
          const wr = await apiFetch(
            `/api/weather?lat=${f.destination.lat}&lon=${f.destination.lon}`,
          );
          if (wr.ok) w = await wr.json();
        } catch {
          /* weather is optional */
        }
      }
      const ctx = contextFromFlight(f, w);
      if (!ctx) throw Error('no route');
      commit((d) => M.setContext(d, tripId, ctx));
      setSummary(summarise(f));
    } catch {
      setCtxNote(
        'Could not read this flight just now, so there are no suggestions yet. Try again in a moment.',
      );
    } finally {
      setCtxBusy(false);
    }
  }
  async function refreshWeather(tripId: string, c: NonNullable<M.Trip['ctx']>) {
    if (c.lat == null || c.lon == null) return;
    try {
      const r = await apiFetch(`/api/weather?lat=${c.lat}&lon=${c.lon}`);
      if (!r.ok) return;
      const w = await r.json();
      const fresh = {
        ...c,
        tempC: typeof w.temperature_2m === 'number' ? Math.round(w.temperature_2m) : c.tempC,
        rain:
          w.weather_code != null
            ? (w.weather_code >= 51 && w.weather_code <= 67) ||
              (w.weather_code >= 80 && w.weather_code <= 82) ||
              w.weather_code >= 95
            : c.rain,
        at: Date.now(),
      };
      commit((d) => M.setContext(d, tripId, fresh));
    } catch {
      /* keep what we have */
    }
  }
  async function erase() {
    try {
      const r = await apiFetch('/api/checklist', { method: 'DELETE' });
      if (!r.ok) throw Error();
      const empty = M.emptyData();
      dataRef.current = empty;
      setData(empty);
      clearLocal();
      setSync('synced');
      setConfirmErase(false);
      setMsg('');
    } catch {
      setMsg('Your saved packing list could not be deleted just now. Please try again.');
    }
  }
  const [summary, setSummary] = useState<string[]>([]);
  useEffect(() => {
    setSummary([]);
  }, [data.active]);
  const trip = data.trips.find((t) => t.id === data.active) || null;
  useEffect(() => {
    if (trip?.ctx && weatherStale(trip.ctx)) void refreshWeather(trip.id, trip.ctx);
  }, [trip?.id]);
  const sections = M.view(data, trip?.id ?? null);
  const tips = trip
    ? suggest(
        trip.ctx,
        trip.nights,
        sections.flatMap((s) => s.items.map((i) => i.text)),
        M.dismissedIds(trip),
      )
    : [];
  const prog = M.progress(sections);
  const hiddenTotal = sections.reduce((n, s) => n + s.hiddenCount, 0);
  // One section is open at a time. Until the person chooses one, the first section with something left to pack is shown.
  const visible = sections.filter((s) => edit || s.items.length > 0);
  const activeSec =
    visible.find((s) => s.id === act) ||
    visible.find((s) => s.doneCount < s.items.length) ||
    visible[0];
  const activeIdx = activeSec ? visible.indexOf(activeSec) : -1;
  const boardRef = useRef<HTMLDivElement>(null),
    railRef = useRef<HTMLElement>(null),
    paged = useRef(false);
  // Suggestions start open on wider screens and folded (with their count showing) on phones.
  const [tipsOpen] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(min-width: 701px)').matches,
  );
  // Previous/Next changes the open section: bring its chip in the (scrolling) rail into view.
  const goTo = (id: string) => {
    paged.current = true;
    setAct(id);
  };
  useEffect(() => {
    if (!paged.current) return;
    paged.current = false;
    railRef.current
      ?.querySelector('.ck-rail-item.on')
      ?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [activeSec?.id]);
  // The open section's items settle in when you switch sections; skipped for people who prefer reduced motion.
  useGSAP(
    () => {
      withMotion(() => {
        const q = gsap.utils.selector(boardRef);
        fromAny(gsap, q('.ck-sec:not([hidden]) .ck-sec-head, .ck-sec:not([hidden]) .ck-list li'), {
          autoAlpha: 0,
          y: 8,
          duration: 0.35,
          ease: 'power2.out',
          stagger: { amount: 0.3 },
        });
      });
    },
    { scope: boardRef, dependencies: [activeSec?.id, trip?.id], revertOnUpdate: true },
  );

  if (!trip)
    return (
      <section className="panel ck-empty">
        <span className="packing-empty-icon">
          <ListChecks size={34} />
        </span>
        <p className="workspace-eyebrow">THE PACKING ROOM</p>
        <h1>Pack once. Reuse it every trip.</h1>
        <p>
          Start from a ready-made list of{' '}
          {M.view(M.emptyData(), null).reduce((n, s) => n + s.items.length, 0)} things, in the order
          a trip happens: days before, clothes, bathroom bag, documents, the night before and the
          last minute. Tick things off, add your own and hide what you never need. The list is kept
          for next time
          {signedIn
            ? ' and follows you to your other devices'
            : ' on this device. Sign in to keep it across devices'}
          .
        </p>
        <form
          className="ck-start"
          onSubmit={(e) => {
            e.preventDefault();
            commit((d) => M.addTrip(d, newName || 'My next trip'));
            setNewName('');
          }}
        >
          <label>
            <span>Name this trip</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Cape Town in October"
              maxLength={M.LIMITS.name}
              aria-label="Trip name"
            />
          </label>
          <button className="btn btn-primary btn-lg" type="submit">
            <Plus size={16} />
            Start my packing list
          </button>
        </form>
        {saved.length > 0 && (
          <div className="ck-quick">
            <span>Or start from a saved flight:</span>
            {saved.slice(0, 4).map((s) => (
              <button
                key={s.number + s.date}
                className="text-button"
                onClick={() => commit((d) => M.addTrip(d, tripNameFor(s), s))}
              >
                <Plane size={13} />
                {tripNameFor(s)}
              </button>
            ))}
          </div>
        )}
        {msg && (
          <p role="alert" className="ck-msg">
            {msg}
          </p>
        )}
      </section>
    );

  const flightLabel = trip.flight ? tripNameFor(trip.flight) : '';
  return (
    <section className="cl" aria-label="Packing list">
      <header className="packing-heading">
        <div>
          <p className="workspace-eyebrow">THE PACKING ROOM</p>
          <h1>Good trips start prepared.</h1>
          <p>Your essentials, organised. One less thing to keep in your head.</p>
        </div>
        <ListChecks size={32} aria-hidden="true" />
      </header>
      <div className="ck-top panel">
        <div className="ck-tripbar">
          <div className="ck-tabs" role="group" aria-label="Your trips">
            {data.trips.map((t) => (
              <button
                key={t.id}
                aria-pressed={t.id === trip.id}
                className={t.id === trip.id ? 'ck-tab active' : 'ck-tab'}
                onClick={() => {
                  commit((d) => ({ ...d, active: t.id }));
                  setConfirmReset(false);
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
          {data.trips.length < M.LIMITS.trips && (
            <button
              className="ck-tab add"
              onClick={() => commit((d) => M.addTrip(d, 'My next trip'))}
              aria-label="Add a trip"
            >
              <Plus size={14} />
              New trip
            </button>
          )}
        </div>
        <div className="ck-head">
          <Ring percent={prog.percent} />
          <div className="ck-title">
            <input
              className="ck-name"
              aria-label="Trip name"
              value={trip.name}
              maxLength={M.LIMITS.name}
              onChange={(e) => commit((d) => M.renameTrip(d, trip.id, e.target.value || ' '))}
              onBlur={(e) => {
                if (!e.target.value.trim()) commit((d) => M.renameTrip(d, trip.id, 'My next trip'));
              }}
            />
            <p aria-live="polite">
              {prog.done} of {prog.total} packed
              {prog.total > 0 && prog.done === prog.total ? ' · all packed' : ''}
            </p>
            <div className="ck-flight">
              {trip.flight ? (
                <>
                  <span className="pill">
                    <Plane size={10} /> {flightLabel}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => onTrack(trip.flight!.number, trip.flight!.date)}
                  >
                    Check this flight
                  </button>
                  <button
                    className="icon-button ck-unlink"
                    onClick={() => commit((d) => M.linkFlight(d, trip.id, undefined))}
                    aria-label="Unlink flight"
                    title="Unlink flight"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : saved.length > 0 ? (
                <label className="ck-link">
                  <Link2 size={13} />
                  <select
                    aria-label="Link a saved flight"
                    value=""
                    onChange={(e) => {
                      const s = saved.find((x) => x.number + '|' + x.date === e.target.value);
                      if (s) {
                        commit((d) => M.linkFlight(d, trip.id, s));
                        void loadContext(trip.id, s);
                      }
                    }}
                  >
                    <option value="">Link a saved flight…</option>
                    {saved.map((s) => (
                      <option key={s.number + s.date} value={s.number + '|' + s.date}>
                        {tripNameFor(s)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="ck-hint">Save a flight to link it to this trip.</span>
              )}
            </div>
            {trip.flight && (
              <div className="ck-ctx">
                <label className="ck-nights">
                  <span>Nights away</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    inputMode="numeric"
                    value={trip.nights ?? ''}
                    placeholder="optional"
                    onChange={(e) =>
                      commit((d) =>
                        M.setNights(d, trip.id, e.target.value ? Number(e.target.value) : null),
                      )
                    }
                  />
                </label>
                {!trip.ctx && (
                  <button
                    className="text-button"
                    disabled={ctxBusy}
                    onClick={() => void loadContext(trip.id, trip.flight!)}
                  >
                    <Lightbulb size={13} />
                    {ctxBusy ? 'Reading your flight…' : 'Get suggestions for this flight'}
                  </button>
                )}
                {trip.ctx && (
                  <small className="ck-ctxline">
                    {trip.ctx.dir
                      ? `${trip.ctx.dir === 'overseas' ? 'International' : trip.ctx.dir[0].toUpperCase() + trip.ctx.dir.slice(1)} flight to ${trip.ctx.destName}`
                      : `Flight to ${trip.ctx.destName}`}
                    {trip.ctx.tempC != null
                      ? ` · ${trip.ctx.tempC}°C there now${trip.ctx.rain ? ', rain' : ''}`
                      : ''}
                    {trip.ctx.km ? ` · about ${trip.ctx.km.toLocaleString('en-GB')} km` : ''}
                  </small>
                )}
              </div>
            )}
            {ctxNote && (
              <p role="alert" className="ck-msg">
                {ctxNote}
              </p>
            )}
          </div>
          <div className="ck-actions">
            <button
              className={onlyLeft ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setOnlyLeft((v) => !v)}
              aria-pressed={onlyLeft}
            >
              {onlyLeft ? <Eye size={14} /> : <EyeOff size={14} />}Still to pack
            </button>
            <button
              className={edit ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setEdit((v) => !v)}
              aria-pressed={edit}
            >
              <Pencil size={14} />
              {edit ? 'Done editing' : 'Edit list'}
            </button>
            {confirmReset ? (
              <>
                <button
                  className="btn btn-secondary btn-danger"
                  onClick={() => {
                    commit((d) => M.resetTicks(d, trip.id));
                    setConfirmReset(false);
                  }}
                >
                  Yes, untick everything
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmReset(true)}
                disabled={prog.done === 0}
              >
                <RotateCcw size={14} />
                Reset ticks
              </button>
            )}
            <button className="btn btn-secondary ck-print" onClick={() => window.print()}>
              <Printer size={14} />
              Print
            </button>
            <button
              className="btn btn-secondary btn-danger"
              onClick={() => {
                if (confirm(`Delete the trip “${trip.name}”? Your list items are kept.`))
                  commit((d) => M.removeTrip(d, trip.id));
              }}
              aria-label="Delete this trip"
              title="Delete this trip"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {msg && (
          <p role="alert" className="ck-msg">
            {msg}
          </p>
        )}
      </div>

      {summary.length > 0 && (
        <section className="panel ck-short" aria-label="Your flight in short">
          <h3>Your flight in short</h3>
          <p>{summary.join(' ')}</p>
        </section>
      )}
      {tips.length > 0 && (
        <details className="panel ck-tips" open={tipsOpen}>
          <summary>
            <Lightbulb size={15} aria-hidden="true" />
            {tips.length} suggestion{tips.length > 1 ? 's' : ''} for this trip
          </summary>
          <ul>
            {tips.map((t) => (
              <li key={t.id}>
                <div>
                  <strong>{t.text}</strong>
                  <small>{t.why}</small>
                </div>
                <button
                  className="text-button primary"
                  onClick={() =>
                    commit((d) => M.dismiss(M.addItem(d, t.section, t.text), trip!.id, t.id))
                  }
                >
                  <Plus size={13} />
                  Add
                </button>
                <button
                  className="ck-x"
                  aria-label={`Dismiss ${t.text}`}
                  onClick={() => commit((d) => M.dismiss(d, trip!.id, t.id))}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <p className="ck-sec-hint">
            Based on your flight and the weather. These are ideas, never rules. For entry
            requirements use the official{' '}
            <a href="https://www.gov.uk/foreign-travel-advice" target="_blank" rel="noreferrer">
              GOV.UK travel advice
            </a>
            .
          </p>
        </details>
      )}
      <div className="ck-layout" ref={boardRef}>
        <nav className="ck-rail" aria-label="Packing list sections" ref={railRef}>
          {visible.map((sec, i) => {
            const full = sec.items.length > 0 && sec.doneCount === sec.items.length;
            return (
              <button
                key={sec.id}
                className={
                  'ck-rail-item' + (sec === activeSec ? ' on' : '') + (full ? ' full' : '')
                }
                aria-current={sec === activeSec ? 'true' : undefined}
                onClick={() => setAct(sec.id)}
              >
                <span className="ck-n" aria-hidden="true">
                  {full ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="ck-rail-title">{sec.title}</span>
                <span className="ck-rail-count">
                  {sec.doneCount}/{sec.items.length}
                </span>
                <i className="ck-rail-bar" aria-hidden="true">
                  <b
                    style={{
                      width: `${sec.items.length ? (sec.doneCount / sec.items.length) * 100 : 0}%`,
                    }}
                  />
                </i>
              </button>
            );
          })}
        </nav>
        <div className="ck-panels">
          {visible.map((sec, si) => {
            const items = onlyLeft ? sec.items.filter((i) => !i.done) : sec.items;
            const left = sec.items.filter((i) => !i.done).map((i) => i.id);
            const prev = visible[si - 1],
              next = visible[si + 1];
            return (
              <section
                key={sec.id}
                className="panel ck-sec"
                hidden={sec !== activeSec}
                aria-labelledby={'ck-h-' + sec.id}
              >
                <header className="ck-sec-head">
                  <span className="ck-n" aria-hidden="true">
                    {si + 1}
                  </span>
                  <div>
                    <h2 className="ck-sec-title" id={'ck-h-' + sec.id}>
                      {sec.title}
                    </h2>
                    {sec.hint && <p className="ck-sec-hint">{sec.hint}</p>}
                  </div>
                  <span
                    className="ck-sec-count"
                    aria-label={`${sec.doneCount} of ${sec.items.length} packed`}
                  >
                    {sec.doneCount}/{sec.items.length}
                  </span>
                </header>
                <ul className="ck-list">
                  {items.map((it) => (
                    <li key={it.id} className={it.done ? 'done' : ''}>
                      {edit ? (
                        <>
                          <input
                            className="ck-edit"
                            aria-label={`Rename ${it.text}`}
                            defaultValue={it.text}
                            maxLength={M.LIMITS.label}
                            onBlur={(e) => {
                              if (e.target.value.trim() && e.target.value !== it.text)
                                commit((d) => M.renameItem(d, it.id, e.target.value));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                          />
                          <button
                            className="ck-x"
                            aria-label={`${it.custom ? 'Delete' : 'Hide'} ${it.text}`}
                            onClick={() => commit((d) => M.removeItem(d, it.id))}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <label className="ck-check">
                          <input
                            type="checkbox"
                            checked={it.done}
                            onChange={(e) =>
                              commit((d) => M.tick(d, trip.id, it.id, e.target.checked))
                            }
                          />
                          <span className="ck-box" aria-hidden="true">
                            <Check size={13} strokeWidth={3} />
                          </span>
                          <span className="ck-text">{it.text}</span>
                        </label>
                      )}
                    </li>
                  ))}
                  {onlyLeft && items.length === 0 && sec.items.length > 0 && (
                    <li className="ck-allset">
                      <Check size={14} />
                      Everything here is packed
                    </li>
                  )}
                </ul>
                <div className="ck-sec-foot">
                  {adding === sec.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        commit((d) => M.addItem(d, sec.id, addText));
                        setAddText('');
                        setAdding(null);
                      }}
                      className="ck-add"
                    >
                      <input
                        autoFocus
                        aria-label={`New item in ${sec.title}`}
                        value={addText}
                        onChange={(e) => setAddText(e.target.value)}
                        placeholder="Add your own item"
                        maxLength={M.LIMITS.label}
                      />
                      <button className="text-button primary" type="submit">
                        Add
                      </button>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => {
                          setAdding(null);
                          setAddText('');
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => {
                        setAdding(sec.id);
                        setAddText('');
                      }}
                    >
                      <Plus size={13} />
                      Add item
                    </button>
                  )}
                  {!edit && left.length > 1 && (
                    <button
                      className="text-button"
                      onClick={() =>
                        commit((d) => left.reduce((acc, id) => M.tick(acc, trip.id, id, true), d))
                      }
                    >
                      <CheckCheck size={13} />
                      Tick all
                    </button>
                  )}
                  {edit &&
                    (sec.items.length > 0 ? (
                      <button
                        className="text-button"
                        onClick={() => commit((d) => M.hideSection(d, sec.id))}
                      >
                        Hide whole section
                      </button>
                    ) : (
                      TEMPLATE.some((t) => t.id === sec.id) && (
                        <button
                          className="text-button"
                          onClick={() => commit((d) => M.showSection(d, sec.id))}
                        >
                          Show section again
                        </button>
                      )
                    ))}
                </div>
                <footer className="ck-pager">
                  {prev ? (
                    <button className="text-button" onClick={() => goTo(prev.id)}>
                      <ArrowLeft size={14} />
                      {prev.title}
                    </button>
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <button className="text-button primary" onClick={() => goTo(next.id)}>
                      {next.title}
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <span />
                  )}
                </footer>
              </section>
            );
          })}
        </div>
      </div>

      {hiddenTotal > 0 && (
        <p className="ck-restore">
          {hiddenTotal} item{hiddenTotal > 1 ? 's' : ''} hidden from your list.{' '}
          <button className="text-button" onClick={() => commit((d) => M.restoreAll(d))}>
            Restore all
          </button>
        </p>
      )}
      {signedIn && (
        <p className="ck-erase">
          {confirmErase ? (
            <>
              This deletes your packing list from our server and from this device. You cannot undo
              it.{' '}
              <button className="text-button danger" onClick={() => void erase()}>
                Yes, delete everything
              </button>{' '}
              <button className="text-button" onClick={() => setConfirmErase(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button className="text-button" onClick={() => setConfirmErase(true)}>
              <Trash2 size={13} />
              Delete my saved packing list
            </button>
          )}
        </p>
      )}
      <p className="ck-note" aria-live="polite">
        {!signedIn
          ? 'Your list is kept on this device only. Sign in to keep it across devices. It works without a connection.'
          : sync === 'syncing'
            ? 'Saving to your account…'
            : sync === 'synced'
              ? 'Saved to your account and on this device. It works without a connection.'
              : sync === 'offline'
                ? 'You are offline. Your changes are saved on this device and will sync when you are back online.'
                : sync === 'error'
                  ? 'Could not reach your account just now. Your changes are safe on this device and will sync later.'
                  : 'Saved on this device.'}
      </p>
    </section>
  );
}
