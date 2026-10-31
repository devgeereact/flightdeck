import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
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

// The packing room is styled in styles/workspace.css; packingBoard.css now serves the public printable page only.

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
  const visible = sections.filter((s) => s.items.length > 0);
  const activeSec =
    visible.find((s) => s.id === act) ||
    visible.find((s) => s.doneCount < s.items.length) ||
    visible[0];
  const activeIdx = activeSec ? visible.indexOf(activeSec) : -1;
  const boardRef = useRef<HTMLDivElement>(null),
    railRef = useRef<HTMLElement>(null);
  const [tipsOpen, setTipsOpen] = useState(false),
    [newTrip, setNewTrip] = useState(false),
    [renaming, setRenaming] = useState<string | null>(null),
    [nameEdit, setNameEdit] = useState(false);
  // Choosing a section brings its button in the (sideways-scrolling, on phones) rail into view.
  useEffect(() => {
    railRef.current
      ?.querySelector('.ck-rail-item.on')
      ?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [activeSec?.id]);
  // The open section's items settle in when you switch sections; the progress bar fills. Skipped for reduced motion.
  useGSAP(
    () => {
      withMotion(() => {
        const q = gsap.utils.selector(boardRef);
        fromAny(gsap, q('.ck-sec:not([hidden]) .head, .ck-sec:not([hidden]) .ck-list li'), {
          autoAlpha: 0,
          x: 10,
          duration: 0.3,
          ease: 'power3.out',
          stagger: { amount: 0.25 },
        });
      });
    },
    { scope: boardRef, dependencies: [activeSec?.id, trip?.id], revertOnUpdate: true },
  );

  if (!trip)
    return (
      <section className="cl" aria-labelledby="pk-h">
        <div className="vh">
          <div>
            <h1 id="pk-h">Packing list</h1>
            <p>One list for each trip, in the order a trip happens.</p>
          </div>
        </div>
        <div className="panel state ck-empty">
          <span className="tile">
            <ListChecks size={28} aria-hidden="true" />
          </span>
          <h2>Pack once. Reuse it every trip.</h2>
          <p>
            Start from a ready-made list of{' '}
            {M.view(M.emptyData(), null).reduce((n, s) => n + s.items.length, 0)} things, in the
            order a trip happens: days before, clothes, bathroom bag, documents, the night before
            and the last minute. Tick things off, add your own and hide what you never need. The
            list is kept for next time
            {signedIn
              ? ' and follows you to your other devices'
              : ' on this device. Sign in to keep it across devices'}
            .
          </p>
          <form
            className="ck-start addrow"
            onSubmit={(e) => {
              e.preventDefault();
              commit((d) => M.addTrip(d, newName.trim() || 'My next trip'));
              setNewName('');
            }}
          >
            <label className="sr-only" htmlFor="ck-start-name">
              Name this trip
            </label>
            <input
              id="ck-start-name"
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name this trip, such as Lisbon in spring"
              maxLength={M.LIMITS.name}
              aria-label="Trip name"
            />
            <button className="btn btn-primary" type="submit">
              <Plus size={16} aria-hidden="true" />
              Start my packing list
            </button>
          </form>
          {saved.length > 0 && (
            <div className="ck-quick">
              <span>Or start from a saved flight:</span>
              {saved.slice(0, 4).map((s) => (
                <button
                  key={s.number + s.date}
                  type="button"
                  className="badge blue plain"
                  onClick={() => commit((d) => M.addTrip(d, tripNameFor(s), s))}
                >
                  <Plane size={14} aria-hidden="true" />
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
        </div>
      </section>
    );

  const flightLabel = trip.flight ? tripNameFor(trip.flight) : '';
  const hiddenSections = TEMPLATE.filter((t) => !sections.find((s) => s.id === t.id)?.items.length);
  return (
    <section className="cl" aria-labelledby="pk-h">
      <div className="vh">
        <div>
          <h1 id="pk-h">Packing list</h1>
          <p>
            One list for each trip.{' '}
            {signedIn ? 'Ticks sync to your account.' : 'Ticks are kept on this device.'}
          </p>
        </div>
      </div>
      <div className="panel trip ck-top">
        <div className="trip-main">
          <div className="sel">
            {nameEdit ? (
              <input
                className="ck-name"
                aria-label="Trip name"
                autoFocus
                value={trip.name}
                maxLength={M.LIMITS.name}
                onChange={(e) => commit((d) => M.renameTrip(d, trip.id, e.target.value || ' '))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape')
                    (e.target as HTMLInputElement).blur();
                }}
                onBlur={(e) => {
                  if (!e.target.value.trim())
                    commit((d) => M.renameTrip(d, trip.id, 'My next trip'));
                  setNameEdit(false);
                }}
              />
            ) : (
              <span className="selwrap">
                <select
                  className="ck-trip-select"
                  aria-label="Trip"
                  value={trip.id}
                  onChange={(e) => {
                    const id = e.target.value;
                    commit((d) => ({ ...d, active: id }));
                    setConfirmReset(false);
                    setAct(null);
                  }}
                >
                  {data.trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={20} aria-hidden="true" />
              </span>
            )}
            <button
              type="button"
              className="icon-btn sm"
              aria-label="Rename this trip"
              title="Rename this trip"
              onClick={() => setNameEdit(true)}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="print-only ck-print-title">{trip.name}</p>
          <div className="meta">
            {trip.flight ? (
              <>
                <span className="badge blue plain">
                  <Plane size={14} aria-hidden="true" />
                  {flightLabel}
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onTrack(trip.flight!.number, trip.flight!.date)}
                >
                  Check this flight
                </button>
                <button
                  type="button"
                  className="icon-btn sm ck-unlink"
                  onClick={() => commit((d) => M.linkFlight(d, trip.id, undefined))}
                  aria-label="Unlink flight"
                  title="Unlink flight"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </>
            ) : saved.length > 0 ? (
              <label className="badge plain ck-link">
                <Link2 size={14} aria-hidden="true" />
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
            <span className="badge plain fd-data" aria-live="polite">
              {prog.done} of {prog.total} packed
              {prog.total > 0 && prog.done === prog.total ? ' · all packed' : ''}
            </span>
            {hiddenTotal > 0 && <span className="badge plain fd-data">{hiddenTotal} hidden</span>}
          </div>
          {trip.flight && (
            <div className="ck-ctx">
              <label className="ck-nights">
                <span>Nights away</span>
                <input
                  className="input"
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
                  type="button"
                  className="text-button"
                  disabled={ctxBusy}
                  onClick={() => void loadContext(trip.id, trip.flight!)}
                >
                  <Lightbulb size={14} aria-hidden="true" />
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
        <div className="acts ck-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setTipsOpen(true)}
            disabled={tips.length === 0}
            title={tips.length ? undefined : 'Link a flight to get suggestions'}
          >
            <Info size={16} aria-hidden="true" />
            Suggestions{tips.length ? ` (${tips.length})` : ''}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm ck-print"
            onClick={() => window.print()}
          >
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
          {data.trips.length < M.LIMITS.trips && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setNewTrip(true)}
            >
              <Plus size={16} aria-hidden="true" />
              New trip
            </button>
          )}
        </div>
        <div className="bar" aria-hidden="true">
          <i style={{ width: `${prog.percent}%` }} />
        </div>
        {msg && (
          <p role="alert" className="ck-msg">
            {msg}
          </p>
        )}
      </div>

      {summary.length > 0 && (
        <section className="panel ck-short" aria-label="Your flight in short">
          <h2>Your flight in short</h2>
          <p>{summary.join(' ')}</p>
        </section>
      )}
      <div className="room ck-layout" ref={boardRef}>
        <nav className="panel rail ck-rail" aria-label="Packing list sections" ref={railRef}>
          {visible.map((sec) => {
            const full = sec.items.length > 0 && sec.doneCount === sec.items.length;
            return (
              <button
                key={sec.id}
                type="button"
                className={
                  'ck-rail-item' + (sec === activeSec ? ' on' : '') + (full ? ' full' : '')
                }
                aria-current={sec === activeSec ? 'true' : undefined}
                onClick={() => {
                  setAct(sec.id);
                  setRenaming(null);
                }}
              >
                <b className="ck-rail-title">{sec.title}</b>
                <span className="ck-rail-count fd-data">
                  {sec.doneCount}/{sec.items.length}
                </span>
                <span className="mini ck-rail-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${sec.items.length ? (sec.doneCount / sec.items.length) * 100 : 0}%`,
                    }}
                  />
                </span>
              </button>
            );
          })}
        </nav>
        <div className="ck-panels">
          {visible.map((sec) => {
            const items = onlyLeft ? sec.items.filter((i) => !i.done) : sec.items;
            const left = sec.items.filter((i) => !i.done).map((i) => i.id);
            return (
              <section
                key={sec.id}
                className="panel listpanel ck-sec"
                hidden={sec !== activeSec}
                aria-labelledby={'ck-h-' + sec.id}
              >
                <header className="head">
                  <div>
                    <h2 className="ck-sec-title" id={'ck-h-' + sec.id}>
                      {sec.title}
                    </h2>
                    {sec.hint && <p className="hint ck-sec-hint">{sec.hint}</p>}
                  </div>
                  <div className="head-acts">
                    <button
                      type="button"
                      className={'btn btn-quiet btn-sm' + (onlyLeft ? ' on' : '')}
                      onClick={() => setOnlyLeft((v) => !v)}
                      aria-pressed={onlyLeft}
                    >
                      {onlyLeft ? (
                        <Eye size={16} aria-hidden="true" />
                      ) : (
                        <EyeOff size={16} aria-hidden="true" />
                      )}
                      Still to pack
                    </button>
                    {left.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() =>
                          commit((d) => left.reduce((acc, id) => M.tick(acc, trip.id, id, true), d))
                        }
                      >
                        <Check size={16} aria-hidden="true" />
                        Tick all
                      </button>
                    )}
                  </div>
                </header>
                <ul className="plist ck-list">
                  {items.map((it) => (
                    <li key={it.id} className={it.done ? 'done' : ''}>
                      {renaming === it.id ? (
                        <input
                          className="rename ck-edit"
                          aria-label={`Rename ${it.text}`}
                          defaultValue={it.text}
                          autoFocus
                          maxLength={M.LIMITS.label}
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== it.text)
                              commit((d) => M.renameItem(d, it.id, e.target.value));
                            setRenaming(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') {
                              (e.target as HTMLInputElement).value = it.text;
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      ) : (
                        <label className="ck-check">
                          <input
                            className="tick"
                            type="checkbox"
                            checked={it.done}
                            onChange={(e) =>
                              commit((d) => M.tick(d, trip.id, it.id, e.target.checked))
                            }
                          />
                          <span className="ck-text">{it.text}</span>
                          {it.custom && <span className="mine">Yours</span>}
                        </label>
                      )}
                      <span className="row-acts">
                        <button
                          type="button"
                          aria-label={`Rename ${it.text}`}
                          title="Rename"
                          onClick={() => setRenaming(it.id)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${it.custom ? 'Delete' : 'Hide'} ${it.text}`}
                          title={it.custom ? 'Delete' : 'Hide from the list'}
                          onClick={() => commit((d) => M.removeItem(d, it.id))}
                        >
                          {it.custom ? (
                            <Trash2 size={16} aria-hidden="true" />
                          ) : (
                            <EyeOff size={16} aria-hidden="true" />
                          )}
                        </button>
                      </span>
                    </li>
                  ))}
                  {onlyLeft && items.length === 0 && sec.items.length > 0 && (
                    <li className="ck-allset">
                      <Check size={16} aria-hidden="true" />
                      Everything here is packed
                    </li>
                  )}
                </ul>
                <form
                  className="addrow ck-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = (adding === sec.id ? addText : '').trim();
                    if (!text) return;
                    commit((d) => M.addItem(d, sec.id, text));
                    setAddText('');
                  }}
                >
                  <input
                    className="input"
                    aria-label={`New item in ${sec.title}`}
                    value={adding === sec.id ? addText : ''}
                    onFocus={() => {
                      if (adding !== sec.id) {
                        setAdding(sec.id);
                        setAddText('');
                      }
                    }}
                    onChange={(e) => {
                      setAdding(sec.id);
                      setAddText(e.target.value);
                    }}
                    placeholder={`Add your own item to ${sec.title}`}
                    maxLength={M.LIMITS.label}
                  />
                  <button className="btn btn-primary" type="submit">
                    <Plus size={16} aria-hidden="true" />
                    Add
                  </button>
                </form>
                <div className="listfoot ck-sec-foot">
                  <span className="listfoot-start">
                    {hiddenTotal > 0 && (
                      <span className="ck-restore">
                        {hiddenTotal} item{hiddenTotal > 1 ? 's' : ''} hidden from your list.{' '}
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          onClick={() => commit((d) => M.restoreAll(d))}
                        >
                          <Eye size={16} aria-hidden="true" />
                          Restore all
                        </button>
                      </span>
                    )}
                    {hiddenSections.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => commit((d) => M.showSection(d, t.id))}
                      >
                        Show {t.title} again
                      </button>
                    ))}
                    {sec.items.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => commit((d) => M.hideSection(d, sec.id))}
                      >
                        <EyeOff size={16} aria-hidden="true" />
                        Hide whole section
                      </button>
                    )}
                  </span>
                  <span className="listfoot-end">
                    {confirmReset ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            commit((d) => M.resetTicks(d, trip.id));
                            setConfirmReset(false);
                          }}
                        >
                          Yes, untick everything
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          onClick={() => setConfirmReset(false)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm danger"
                        onClick={() => setConfirmReset(true)}
                        disabled={prog.done === 0}
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Reset ticks
                      </button>
                    )}
                  </span>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="ck-foot">
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
        <div className="ck-foot-acts">
          <button
            type="button"
            className="btn btn-quiet btn-sm danger"
            onClick={() => {
              if (confirm(`Delete the trip “${trip.name}”? Your list items are kept.`))
                commit((d) => M.removeTrip(d, trip.id));
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete this trip
          </button>
          {signedIn &&
            (confirmErase ? (
              <span className="ck-erase">
                This deletes your packing list from our server and from this device. You cannot undo
                it.{' '}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void erase()}
                >
                  Yes, delete everything
                </button>{' '}
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => setConfirmErase(false)}
                >
                  Keep it
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-quiet btn-sm danger"
                onClick={() => setConfirmErase(true)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete my saved packing list
              </button>
            ))}
        </div>
      </div>

      {tipsOpen && (
        <Modal title="Suggestions for this trip" onClose={() => setTipsOpen(false)}>
          <p className="label dialog-sub">
            Based on your flight and the weather. Rules only, no AI. These are ideas, never rules.
          </p>
          {tips.length ? (
            <ul className="sugg ck-tips">
              {tips.map((t) => (
                <li key={t.id}>
                  <span>
                    <b>{t.text}</b>
                    <small>{t.why}</small>
                  </span>
                  <span className="sugg-acts">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        commit((d) => M.dismiss(M.addItem(d, t.section, t.text), trip.id, t.id))
                      }
                    >
                      <Plus size={16} aria-hidden="true" />
                      Add
                    </button>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={`Dismiss ${t.text}`}
                      onClick={() => commit((d) => M.dismiss(d, trip.id, t.id))}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing more to suggest for this trip.</p>
          )}
          <p className="label">
            For entry requirements use the official{' '}
            <a href="https://www.gov.uk/foreign-travel-advice" target="_blank" rel="noreferrer">
              GOV.UK travel advice
            </a>
            .
          </p>
          <div className="dialog-foot">
            <button type="button" className="btn btn-primary" onClick={() => setTipsOpen(false)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {newTrip && (
        <NewTripDialog
          saved={saved}
          onClose={() => setNewTrip(false)}
          onCreate={(name, flight) => {
            const next = M.addTrip(dataRef.current, name, flight);
            commit(() => next);
            setAct(null);
            const created = next.trips.find((t) => t.id === next.active);
            if (created && flight) void loadContext(created.id, flight);
            setNewTrip(false);
          }}
        />
      )}
    </section>
  );
}

// A native modal dialog in the app's dialog style (Escape and the backdrop close it, focus is kept inside).
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function NewTripDialog({
  saved,
  onClose,
  onCreate,
}: {
  saved: Saved[];
  onClose: () => void;
  onCreate: (name: string, flight?: Saved) => void;
}) {
  const [name, setName] = useState(''),
    [link, setLink] = useState(''),
    [err, setErr] = useState('');
  return (
    <Modal title="New packing list" onClose={onClose}>
      <form
        className="dialog-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const flight = saved.find((s) => s.number + '|' + s.date === link);
          const n = name.trim() || (flight ? tripNameFor(flight) : '');
          if (!n) {
            setErr('Give the trip a name, such as the place you are going.');
            return;
          }
          onCreate(n, flight);
        }}
      >
        <div className="form-row">
          <label htmlFor="nt-name">Trip name</label>
          <input
            id="nt-name"
            className="input"
            maxLength={M.LIMITS.name}
            placeholder="Lisbon in spring"
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setErr('');
            }}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? 'nt-err' : undefined}
          />
          {err && (
            <p className="field-error" id="nt-err">
              {err}
            </p>
          )}
        </div>
        <div className="form-row">
          <label htmlFor="nt-flight">Link a saved flight</label>
          <select
            id="nt-flight"
            className="input select"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          >
            <option value="">No flight</option>
            {saved.map((s) => (
              <option key={s.number + s.date} value={s.number + '|' + s.date}>
                {tripNameFor(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="dialog-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create list
          </button>
        </div>
      </form>
    </Modal>
  );
}
