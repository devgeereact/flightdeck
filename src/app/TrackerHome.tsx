import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  AlertCircle,
  Bookmark,
  CalendarDays,
  Info,
  ListChecks,
  Navigation,
  Plane,
  Search,
} from 'lucide-react';
import { type RefObject, useRef, useState } from 'react';
import * as M from '../features/checklist/checklistModel';
import { getOwner, loadLocal, saveLocal } from '../features/checklist/checklistStore';
import { inZone, time, ukDate } from '../features/flight/flightFormat';
import { fromAny, withMotion } from '../shared/motion';
import type { Flight, FlightResponse } from '../types';
import { SavedCards } from './SavedFlightCollection';
import { recallResult, type SavedItem } from './savedFlights';
import { flightTime, zoneAbbr } from './zone';

gsap.registerPlugin(useGSAP);

type Props = {
  number: string;
  setNumber: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  busy: boolean;
  data: FlightResponse | null;
  error: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: () => void;
  saved: SavedItem[];
  userId: string | null;
  now: Date;
  onOpen: (s: SavedItem) => void;
  onPack: (s: SavedItem) => void;
  onRemove: (index: number) => void;
  onGo: (tab: string) => void;
};
const shiftDay = (ymd: string, by: number) => {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};
const dm = (t: Date | string, tz: string | null) =>
  inZone(typeof t === 'string' ? t : t.toISOString(), tz, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) || '';

// The soonest saved flight that still has a departure ahead of now, from the copy Flightdeck last fetched for it (never invented).
function nextFlight(saved: SavedItem[], nowMs: number) {
  let best: { item: SavedItem; f: Flight; dep: number; at: number } | null = null;
  for (const item of saved) {
    const kept = recallResult(item.number + '|' + item.date);
    const f = kept?.data.flights[0];
    const t = f && (f.estimatedOut || f.scheduledOut);
    if (!f || !t || f.cancelled) continue;
    const dep = new Date(t).getTime();
    if (Number.isNaN(dep) || dep <= nowMs) continue;
    if (!best || dep < best.dep) best = { item, f, dep, at: kept.at };
  }
  return best;
}

function NextFlightPanel({
  saved,
  now,
  onOpen,
}: {
  saved: SavedItem[];
  now: Date;
  onOpen: (s: SavedItem) => void;
}) {
  const n = nextFlight(saved, now.getTime());
  if (!n)
    return (
      <div className="panel next">
        <div className="state compact">
          <span className="tile">
            <Plane size={24} aria-hidden="true" />
          </span>
          <h2>No upcoming flights</h2>
          <p>
            {saved.length
              ? 'Open one of your saved flights and its countdown appears here, from the times Flightdeck fetched.'
              : 'Save a flight and the countdown appears here.'}
          </p>
        </div>
      </div>
    );
  const { item, f, dep } = n;
  const left = Math.max(0, dep - now.getTime());
  const days = Math.floor(left / 864e5),
    hours = Math.floor((left % 864e5) / 36e5),
    mins = Math.floor((left % 36e5) / 6e4);
  const oTz = f.origin.timezone,
    dTz = f.destination.timezone;
  const arr = f.estimatedIn || f.scheduledIn;
  const leaves = [
    f.origin.name || f.origin.city || f.origin.code,
    f.terminalOut && `T${f.terminalOut}`,
  ]
    .filter(Boolean)
    .join(' ');
  // The usual milestones before a departure, worked out from the reported departure time. They are rules of thumb, and say so.
  const steps: [string, number, string][] = [
    ['Check-in opens', dep - 24 * 36e5, '24 h before'],
    ['Leave for the airport', dep - 4 * 36e5, 'About 4 h before'],
    ['Gate closes', dep - 20 * 6e4, '20 min before'],
    [
      'Departure',
      dep,
      f.estimatedOut && f.estimatedOut !== f.scheduledOut ? 'Estimated' : 'Scheduled',
    ],
  ];
  return (
    <div className="panel next">
      <div className="panel-head">
        <div>
          <p className="label">Next flight</p>
          <h2>
            {f.number} to {f.destination.city || f.destination.name || f.destination.code}
          </h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(item)}>
          Open flight
        </button>
      </div>
      <div className="countdown fd-data" role="timer" aria-label="Time until departure">
        <div>
          <b>{days}</b>
          <span>{days === 1 ? 'day' : 'days'}</span>
        </div>
        <div>
          <b>{hours}</b>
          <span>{hours === 1 ? 'hour' : 'hours'}</span>
        </div>
        <div>
          <b>{mins}</b>
          <span>{mins === 1 ? 'minute' : 'minutes'}</span>
        </div>
      </div>
      <div className="facts fd-data">
        <div>
          <span>Leaves from</span>
          <b>{leaves}</b>
        </div>
        <div>
          <span>Lands</span>
          <b>{arr ? `${time(arr, dTz)} ${zoneAbbr(arr, dTz)}` : 'Not reported yet'}</b>
        </div>
        <div>
          <span>Flight time</span>
          <b>{flightTime(f.scheduledOut, f.scheduledIn) || 'Not reported yet'}</b>
        </div>
      </div>
      <ol className="tl">
        {steps.map(([t, at, s]) => (
          <li key={t} className={at < now.getTime() ? 'done' : ''}>
            <i aria-hidden="true" />
            <b>{t}</b>
            <span className="fd-data">
              {dm(new Date(at), oTz)}, {time(new Date(at).toISOString(), oTz)}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PackingPanel({ userId, onGo }: { userId: string | null; onGo: (tab: string) => void }) {
  // The list on this device, unless it belongs to a different account (the packing room clears that one when it opens).
  const [data, setData] = useState<M.ChecklistData>(() => {
    const owner = getOwner();
    return userId && owner && owner !== userId ? M.emptyData() : loadLocal();
  });
  const trip = data.trips.find((t) => t.id === data.active) || data.trips[0] || null;
  if (!trip)
    return (
      <div className="panel packcard">
        <div className="state compact">
          <span className="tile">
            <ListChecks size={24} aria-hidden="true" />
          </span>
          <h2>No packing list yet</h2>
          <p>
            Start from a ready-made list in the order a trip happens, and tick things off as you go.
          </p>
          <div className="acts">
            <button type="button" className="btn btn-ghost" onClick={() => onGo('checklist')}>
              Start a packing list
            </button>
          </div>
        </div>
      </div>
    );
  const sections = M.view(data, trip.id);
  const p = M.progress(sections);
  const left = sections
    .flatMap((s) => s.items)
    .filter((i) => !i.done)
    .slice(0, 3);
  const C = 2 * Math.PI * 42;
  // Ticking here is the same change as ticking in the packing room; it syncs to the account the next time the list opens.
  const tick = (id: string) => {
    const next = M.tick(data, trip.id, id, true);
    if (saveLocal(next)) setData(next);
  };
  return (
    <div className="panel packcard">
      <div className="panel-head">
        <div>
          <p className="label">Packing</p>
          <h2>{trip.name}</h2>
        </div>
      </div>
      <div className="ringrow">
        <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="bg" cx="50" cy="50" r="42" />
          <circle
            className="fg"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - p.percent / 100)}
          />
          <text x="50" y="57" textAnchor="middle">
            {p.percent}%
          </text>
        </svg>
        <div>
          <b className="fd-data">
            {p.done} of {p.total} packed
          </b>
          <p className="label">{left.length ? 'Next up from your list' : 'Everything is packed'}</p>
        </div>
      </div>
      {left.length > 0 && (
        <ul className="todo">
          {left.map((i) => (
            <li key={i.id}>
              <label>
                <input type="checkbox" className="tick" onChange={() => tick(i.id)} />
                <span>{i.text}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => onGo('checklist')}>
        Open the list
      </button>
    </div>
  );
}

export default function TrackerHome(props: Props) {
  const { number, setNumber, date, setDate, busy, data, error, searchRef, onSearch, saved } = props;
  const root = useRef<HTMLElement>(null);
  const [numErr, setNumErr] = useState('');
  const today = ukDate();
  const picks: [number, string][] = [
    [-1, 'Yesterday'],
    [0, 'Today'],
    [1, 'Tomorrow'],
  ];
  const first = !saved.length && loadLocal().trips.length === 0;
  // The banner text and the panels rise in once; the ring fills and the countdown tiles settle after them.
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      withMotion(() => {
        fromAny(gsap, q('.banner h1, .banner p, .lookup'), {
          autoAlpha: 0,
          y: 18,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.08,
        });
        fromAny(gsap, q('.tr-below > *'), {
          autoAlpha: 0,
          y: 22,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.1,
          delay: 0.2,
        });
        fromAny(gsap, q('.countdown > div'), {
          autoAlpha: 0,
          scale: 0.92,
          duration: 0.5,
          ease: 'back.out(1.6)',
          stagger: 0.07,
          delay: 0.45,
        });
        fromAny(gsap, q('.ring .fg'), {
          strokeDashoffset: 2 * Math.PI * 42,
          duration: 1,
          ease: 'power3.out',
          delay: 0.4,
        });
      });
    },
    { scope: root },
  );
  return (
    <section className="tracker" aria-labelledby="tr-h" ref={root}>
      <div className="banner">
        <img src="/img/sky-wing.jpg" alt="" width="2200" height="1650" />
        <h1 id="tr-h">Which flight?</h1>
        <p>Type the flight number from your booking and the day it leaves.</p>
        <div className="banner-space" />
      </div>
      <form
        className="lookup search-card"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!number.trim()) {
            setNumErr('Enter the flight number from your booking, such as BA117.');
            searchRef.current?.focus();
            return;
          }
          setNumErr('');
          onSearch();
        }}
      >
        <div className="lookup-grid">
          <div className="field-wrap">
            <label className={'field' + (numErr ? ' invalid' : '')}>
              <span className="field-label">Flight number</span>
              <input
                ref={searchRef}
                aria-label="Flight number"
                aria-invalid={numErr ? true : undefined}
                aria-describedby={numErr ? 'lf-err' : undefined}
                value={number}
                onChange={(e) => {
                  setNumber(e.target.value.toUpperCase());
                  if (numErr) setNumErr('');
                }}
                placeholder="BA117"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
              />
            </label>
            {numErr && (
              <p className="field-error" id="lf-err">
                <AlertCircle size={16} aria-hidden="true" />
                {numErr}
              </p>
            )}
          </div>
          <label className="field">
            <span className="field-label">Departure date</span>
            <input
              aria-label="Departure date"
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <div className="field qp-field">
            <span className="field-label" id="qp">
              Quick pick
            </span>
            <div className="daychips" role="group" aria-labelledby="qp">
              {picks.map(([by, label]) => {
                const v = shiftDay(today, by);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={date === v}
                    onClick={() => setDate(v)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn btn-primary search-button" disabled={busy} type="submit">
            <Search size={20} aria-hidden="true" />
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="note">
          <Info size={16} aria-hidden="true" />
          <span>
            Full schedules cover yesterday to three days ahead. For later dates Flightdeck shows the
            usual route, and the times appear closer to departure.
          </span>
        </p>
      </form>
      <div className="tr-below">
        {busy && !data && (
          <div role="status" className="panel state">
            <span className="tile">
              <Search size={28} aria-hidden="true" />
            </span>
            <h2>Looking up your flight…</h2>
            <p>Checking the schedule and live sources. This usually takes a few seconds.</p>
          </div>
        )}
        {data && !data.flights.length && (
          <div className="panel state">
            <span className="tile">
              <Search size={28} aria-hidden="true" />
            </span>
            <h2>No flights found</h2>
            <p>
              Nothing matched that flight number and date. Check the number, or try the airline's
              three-letter callsign, such as BAW117. Schedules cover yesterday to three days ahead,
              and a live position shows only while the aircraft is transmitting.
            </p>
          </div>
        )}
        {!busy && !data && !error && first && (
          <div className="panel state tracker-welcome">
            <span className="tile">
              <Plane size={28} aria-hidden="true" />
            </span>
            <h2>Enter a flight number above.</h2>
            <p>
              You get the status, the airport details and the destination weather, each as soon as
              its source reports it.
            </p>
            <ul className="welcome-details">
              <li>
                <Navigation size={16} aria-hidden="true" />
                Flight status
              </li>
              <li>
                <CalendarDays size={16} aria-hidden="true" />
                Airport local times
              </li>
              <li>
                <ListChecks size={16} aria-hidden="true" />
                Packing list
              </li>
            </ul>
            <a className="link-quiet" href="/coverage/">
              About the data
            </a>
          </div>
        )}
        {!first && (
          <>
            <div className="panel panel-pad saved-panel">
              <div className="panel-head">
                <h2>Saved flights</h2>
                <a className="link-quiet" href="#/saved">
                  See all
                </a>
              </div>
              {saved.length ? (
                <SavedCards
                  items={saved.slice(0, 3)}
                  onOpen={props.onOpen}
                  onPack={props.onPack}
                  onRemove={props.onRemove}
                />
              ) : (
                <div className="state inset">
                  <span className="tile">
                    <Bookmark size={24} aria-hidden="true" />
                  </span>
                  <h2>No saved flights yet</h2>
                  <p>
                    Look up a flight and choose Save. You can keep up to 12, and they follow you to
                    every device.
                  </p>
                </div>
              )}
            </div>
            <div className="split">
              <NextFlightPanel saved={saved} now={props.now} onOpen={props.onOpen} />
              <PackingPanel userId={props.userId} onGo={props.onGo} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
