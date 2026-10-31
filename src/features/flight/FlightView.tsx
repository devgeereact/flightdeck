import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  ArrowUpRight,
  Bookmark,
  CalendarPlus,
  Clock,
  CloudSun,
  Compass,
  Info,
  Luggage,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  Radio,
  RefreshCw,
  Share2,
  Timer,
  Wind,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CodeTile } from '../../app/SavedFlightCollection';
import { DEST_PHOTO, flightTime, zoneAbbr } from '../../app/zone';
import { apiFetch } from '../../shared/api';
import { fromAny, withMotion } from '../../shared/motion';
import { nextTabIndex } from '../../shared/tabKeys';
import type { Airport, Flight, FlightResponse } from '../../types';
import { countdown } from './countdown';
import { destinations } from './destinations';
import {
  airlines,
  day,
  directionText,
  inZone,
  journeySteps,
  regionName,
  time,
  weatherLabel,
  withHint,
} from './flightFormat';
import { flightIcs } from './ics';
import { summarise } from './summary';

gsap.registerPlugin(useGSAP);

type Props = {
  flight: Flight;
  data: FlightResponse;
  now: Date;
  busy: boolean;
  auto: boolean;
  setAuto: (v: boolean) => void;
  changes: string[];
  onRefresh: () => void;
  onSave: () => void;
  saved?: boolean;
  offline?: boolean;
  onShare?: () => void;
  legPicker?: ReactNode;
};
type Panel = 'journey' | 'airport' | 'weather' | 'updates' | 'destination';
const PANELS: { id: Panel; label: string; icon: typeof Clock }[] = [
  { id: 'journey', label: 'Journey', icon: Clock },
  { id: 'airport', label: 'Airport', icon: Luggage },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'updates', label: 'Updates', icon: Radio },
  { id: 'destination', label: 'Destination', icon: Compass },
];
const here = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const NR = 'Not reported yet';

// The illustrative route: one fixed curve from origin to destination. The plane sits at the provider's progress figure along it
// (at the start until the flight leaves). It is a diagram, never a position: the label says so, and the position panel is separate.
const P0 = [10, 80],
  P1 = [120, 0],
  P2 = [280, 0],
  P3 = [390, 80];
function onCurve(t: number) {
  const u = 1 - t;
  const at = (i: number) =>
    u * u * u * P0[i] + 3 * u * u * t * P1[i] + 3 * u * t * t * P2[i] + t * t * t * P3[i];
  const d = (i: number) =>
    3 * u * u * (P1[i] - P0[i]) + 6 * u * t * (P2[i] - P1[i]) + 3 * t * t * (P3[i] - P2[i]);
  return { x: at(0), y: at(1), a: (Math.atan2(d(1), d(0)) * 180) / Math.PI };
}
function RouteArc({ progress, label }: { progress: number; label: string | null }) {
  const p = onCurve(progress);
  return (
    <svg
      className="route-map"
      viewBox="0 0 400 90"
      role="img"
      aria-label="Illustrative route diagram, not live aircraft tracking"
    >
      <path className="base" d="M10 80 C 120 0, 280 0, 390 80" />
      <path
        className="done"
        d="M10 80 C 120 0, 280 0, 390 80"
        pathLength={1}
        strokeDasharray={`${progress} 1`}
      />
      <circle cx="10" cy="80" r="6" fill="#1866ff" />
      <circle cx="390" cy="80" r="6" fill="#fff" stroke="#1866ff" strokeWidth="2.5" />
      {label && (
        <text className="dur" x="200" y="46">
          {label}
        </text>
      )}
      <g className="plane" data-p={progress} transform={`translate(${p.x} ${p.y}) rotate(${p.a})`}>
        <circle r="15" fill="#1866ff" />
        <path
          transform="rotate(45) translate(-9 -9) scale(.75)"
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
          fill="#fff"
        />
      </g>
    </svg>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <b className={value ? 'fd-data' : 'nr'}>{value || NR}</b>
    </div>
  );
}
// One clock on the summary: the time in the airport's own zone with its short name, or "Not reported yet".
function TimeCell({
  label,
  value,
  tz,
}: {
  label: string;
  value: string | null;
  tz: string | null;
}) {
  const t = value ? time(value, tz) : null;
  return (
    <div>
      <dt>{label}</dt>
      {t && t !== 'Not available' ? (
        <dd>
          {t}
          <small>{zoneAbbr(value, tz) || (tz ? '' : 'UTC')}</small>
        </dd>
      ) : (
        <dd className="nr">{NR}</dd>
      )}
    </div>
  );
}
function Clock24({ airport, now }: { airport: Airport; now: Date }) {
  return (
    <span className="clock fd-data">
      {time(now.toISOString(), airport.timezone)} {zoneAbbr(now, airport.timezone)}
    </span>
  );
}

function Weather({ airport, now }: { airport: Airport; now: Date }) {
  const [weather, setWeather] = useState<any>(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setWeather(null);
    setFailed(false);
    if (airport.lat === null || airport.lon === null) {
      setFailed(true);
      return;
    }
    apiFetch(`/api/weather?lat=${airport.lat}&lon=${airport.lon}`, { signal: c.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        setWeather(await r.json());
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setFailed(true);
      });
    return () => c.abort();
  }, [airport.code, airport.lat, airport.lon, retry]);
  const place = airport.city || airport.name;
  if (!weather)
    return (
      <div className="state compact fv-weather">
        <span className="tile">
          <CloudSun size={24} aria-hidden="true" />
        </span>
        <h2>{failed ? 'Weather is not available right now.' : 'Getting the weather…'}</h2>
        <p>
          {place}, at the airport. From{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          .
        </p>
        {failed && (
          <div className="acts">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRetry((r) => r + 1)}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className="wx fv-weather">
      <div className="wxmain">
        <span className="wx-place">
          <MapPin size={16} aria-hidden="true" />
          {place} · {airport.name}
        </span>
        <div className="t fd-data">
          {Math.round(weather.temperature_2m)}
          <span>°C</span>
        </div>
        <p>{weatherLabel(weather.weather_code)} right now.</p>
        <small>
          From{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          . This is the weather around the airport now, not a forecast for when you land.
        </small>
      </div>
      <div className="grid2 wx-stats">
        <div className="stat">
          <span>
            <Wind size={16} aria-hidden="true" />
            Wind
          </span>
          <b className="fd-data">{weather.wind_speed_10m} km/h</b>
        </div>
        <div className="stat">
          <span>
            <CloudSun size={16} aria-hidden="true" />
            Conditions
          </span>
          <b>{weatherLabel(weather.weather_code)}</b>
        </div>
        <div className="stat">
          <span>
            <Timer size={16} aria-hidden="true" />
            Observed
          </span>
          <b className="fd-data">{String(weather.time || '').slice(11, 16) || NR}</b>
        </div>
        <div className="stat">
          <span>
            <Clock size={16} aria-hidden="true" />
            Local time
          </span>
          <b className="fd-data">{time(now.toISOString(), airport.timezone)}</b>
        </div>
      </div>
    </div>
  );
}

function Destination({ airport }: { airport: Airport }) {
  const d = destinations[airport.code];
  const photo = DEST_PHOTO[airport.code];
  const places = d?.places || [
    {
      name: `Explore ${airport.city || airport.code}`,
      kind: 'Local ideas',
      description:
        'The official tourism website lists current attractions and practical visitor information.',
      url: `https://www.google.com/search?q=${encodeURIComponent(airport.city + ' official tourism')}`,
    },
  ];
  return (
    <div className="destpanel fv-destination">
      <div className="ph">
        {photo ? (
          <img src={photo.src} alt={photo.alt} loading="lazy" />
        ) : (
          <CodeTile code={airport.code} />
        )}
      </div>
      <div>
        <p className="label">
          {airport.code} · {airport.name} ·{' '}
          {airport.country || regionName(airport.countryCode) || airport.city}
        </p>
        <h3>{d?.greeting || `Welcome to ${airport.city || airport.name}.`}</h3>
        <p className="muted">
          {d?.intro ||
            'Your trip starts in the arrivals hall. The local visitor guide is a good place to plan your stay.'}
        </p>
        {d && (
          <div className="grid2 dest-stats">
            <div className="stat">
              <span>Currency</span>
              <b>{d.currency}</b>
            </div>
            <div className="stat">
              <span>Language</span>
              <b>{d.language}</b>
            </div>
          </div>
        )}
        <p className="dest-tip">
          <b>Getting from the airport. </b>
          {d?.tip ||
            "Check the airport's own website for transport options, and confirm opening times before you travel."}
        </p>
        <ul className="places">
          {places.map((p) => (
            <li key={p.name}>
              <a href={p.url} target="_blank" rel="noreferrer">
                <span>
                  <b>{p.name}</b>
                  <small>
                    {p.kind} · {p.description}
                  </small>
                </span>
                <ArrowUpRight size={20} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="destination-note">
          These are hand-picked ideas for the city, not ranked by distance. Check official sources
          for opening times, tickets and access.
        </p>
      </div>
    </div>
  );
}

const badgeFor = (kind: string) =>
  /^(Actual|Done|Open now|Reported|Belt reported)/.test(kind)
    ? 'badge ok'
    : kind === 'Estimated'
      ? 'badge blue'
      : kind === 'Scheduled'
        ? 'badge plain'
        : 'badge warn';

export default function FlightView({
  flight,
  data,
  now,
  busy,
  auto,
  setAuto,
  changes,
  onRefresh,
  onSave,
  saved = false,
  offline = false,
  onShare,
  legPicker,
}: Props) {
  const [panel, setPanel] = useState<Panel>('journey');
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Arrow keys, Home and End move between the tabs; only the selected tab is in the Tab order.
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const j = nextTabIndex(e.key, i, PANELS.length);
    if (j === null) return;
    e.preventDefault();
    setPanel(PANELS[j].id);
    tabRefs.current[j]?.focus();
  };
  const steps = journeySteps(flight);
  const o = flight.origin,
    d = flight.destination;
  const flightDate = (flight.scheduledOut || flight.estimatedOut || '').slice(0, 10);
  // Calendar file from the times on screen; offered only when both ends have a time.
  const ics = flightIcs(flight, `${location.origin}/app/#/flight/${flight.number}/${flightDate}`);
  const addToCalendar = () => {
    if (!ics) return;
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flight.number}-${(flight.scheduledOut || '').slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const delayed = flight.delayMinutes != null && flight.delayMinutes > 0;
  const statusClass = flight.cancelled
    ? 'badge danger'
    : flight.diverted || delayed
      ? 'badge warn'
      : flight.providerStatus === 'Arrived'
        ? 'badge ok'
        : 'badge blue';
  const progressText =
    flight.progress !== null
      ? `${flight.progress}% of the way${flight.progressBasis === 'position' ? ' (from live position)' : flight.progressBasis === 'times' ? ' (from flight times)' : ''}`
      : flight.usualRouteOnly
        ? 'Schedule not published yet'
        : flight.providerStatus &&
            ['Expected', 'CheckIn', 'Boarding', 'GateClosed'].includes(flight.providerStatus)
          ? 'Not departed yet'
          : 'Progress not available';
  const punctuality = flight.cancelled
    ? 'Cancelled'
    : flight.diverted
      ? 'Diverted'
      : flight.delayMinutes === null
        ? 'Punctuality not reported'
        : flight.delayMinutes === 0 && flight.liveUpdates === false
          ? 'Schedule only, no live status yet'
          : flight.delayMinutes > 0
            ? `${flight.delayMinutes} min late leaving`
            : flight.delayMinutes < 0
              ? `${Math.abs(flight.delayMinutes)} min early leaving`
              : 'On time';
  const arcAt = Math.max(
    0,
    Math.min(1, flight.providerStatus === 'Arrived' ? 1 : (flight.progress ?? 0) / 100),
  );
  const cd = countdown(flight, now.getTime());
  const longDate = inZone(flight.scheduledOut || flight.estimatedOut, o.timezone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const place = (a: Airport, t: string | null, hint?: string) =>
    [
      a.city,
      a.name && a.name !== a.city ? a.name : null,
      t ? `T${t}` : hint ? `usually T${hint}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || a.code;
  // The header and panels rise in when a flight appears, the route draws itself, and the plane moves to its point on the curve.
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      withMotion(() => {
        fromAny(gsap, q('.fhead, .flight-card, .position, .tabs-row'), {
          autoAlpha: 0,
          y: 20,
          duration: 0.55,
          ease: 'power3.out',
          stagger: 0.08,
        });
        const done = q('.route-map .done')[0];
        const plane = q('.route-map .plane')[0];
        if (done && plane) {
          const end = arcAt;
          const s = { t: 0 };
          gsap.to(s, {
            t: end,
            duration: 1.1,
            ease: 'power3.out',
            delay: 0.25,
            onUpdate: () => {
              const p = onCurve(s.t);
              done.setAttribute('stroke-dasharray', `${s.t} 1`);
              plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${p.a})`);
            },
          });
          fromAny(gsap, q('.route-map .base'), {
            strokeDashoffset: 60,
            duration: 1.2,
            ease: 'power2.out',
          });
        }
      });
    },
    { scope: root, dependencies: [flight.id] },
  );
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      withMotion(() => {
        fromAny(gsap, q('.fv-body > * > *'), {
          autoAlpha: 0,
          y: 10,
          duration: 0.35,
          ease: 'power3.out',
          stagger: 0.03,
          clearProps: 'all',
        });
      });
    },
    { scope: root, dependencies: [panel, flight.id] },
  );
  const notes: string[] = [];
  if (flight.distanceRemainingKm != null)
    notes.push(
      `About ${flight.distanceRemainingKm.toLocaleString('en-GB')} km to go in a straight line.`,
    );
  if (flight.etaEstimate)
    notes.push(
      `Estimated arrival ${time(flight.etaEstimate, d.timezone)} ${d.timezone ? `${d.city || d.code} time` : 'UTC'}. Worked out from speed, so it is not an airline time.`,
    );
  if (flight.routeSource)
    notes.push(
      `The route is the usual one for this callsign (${flight.routeSource}). Today's can differ.`,
    );
  if (data.mode === 'live' && flight.dataSource === 'AeroDataBox' && !flight.liveUpdates)
    notes.push(
      "These times are the airline's schedule. Live updates are not available for this flight or airport.",
    );
  return (
    <div className="fv" ref={root}>
      <div className="fhead fv-bar">
        <div>
          <h1>
            <span className="fd-data">{flight.number}</span>
            <span className={statusClass}>{flight.status}</span>
            {offline && <span className="badge violet plain">Offline copy</span>}
          </h1>
          <p>
            {[flight.airline, longDate, flight.aircraft].filter(Boolean).join(' · ')}
            {cd && (
              <>
                {' · '}
                <span className="fv-countdown">{cd}</span>
              </>
            )}
          </p>
        </div>
        <div className="acts">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Refresh flight"
          >
            <RefreshCw size={20} className={busy ? 'spin' : ''} aria-hidden="true" />
            Refresh
          </button>
          <button
            type="button"
            className={saved ? 'btn btn-ghost' : 'btn btn-primary'}
            aria-pressed={saved}
            onClick={onSave}
          >
            <Bookmark size={20} aria-hidden="true" />
            {saved ? 'Saved' : 'Save'}
          </button>
          {onShare && (
            <button type="button" className="btn btn-ghost" onClick={onShare}>
              <Share2 size={20} aria-hidden="true" />
              Share
            </button>
          )}
          {ics && (
            <button type="button" className="btn btn-ghost" onClick={addToCalendar}>
              <CalendarPlus size={20} aria-hidden="true" />
              Add to calendar
            </button>
          )}
        </div>
      </div>
      {legPicker}
      <section className="panel summary flight-card" aria-label="Flight summary">
        <div className="route">
          <div className="ap">
            <b className="fd-data">{o.code}</b>
            <span>{place(o, flight.terminalOut, flight.terminalOutHint)}</span>
          </div>
          <div className="route-mid">
            <RouteArc
              progress={arcAt}
              label={flightTime(flight.scheduledOut, flight.scheduledIn)}
            />
            <span className="route-note">Illustrative route, not live tracking</span>
          </div>
          <div className="ap to">
            <b className="fd-data">{d.code}</b>
            <span>{place(d, flight.terminalIn, flight.terminalInHint)}</span>
          </div>
        </div>
        {flight.usualRouteOnly ? (
          <p className="note boxed">
            <Info size={16} aria-hidden="true" />
            <span>
              There are no times for this date yet. Full schedules cover yesterday to three days
              ahead, so this shows the usual route. Times, terminals and gates appear closer to
              departure.
            </span>
          </p>
        ) : (
          <div className="times">
            <div className="tbox">
              <h2>
                <PlaneTakeoff size={16} aria-hidden="true" />
                Departure ·{' '}
                {o.timezone ? `${o.city || o.code} time` : 'UTC (airport time zone unavailable)'}
              </h2>
              <dl className="fd-data">
                <TimeCell label="Scheduled" value={flight.scheduledOut} tz={o.timezone} />
                <TimeCell label="Estimated" value={flight.estimatedOut} tz={o.timezone} />
                <TimeCell label="Actual" value={flight.actualOut} tz={o.timezone} />
              </dl>
            </div>
            <div className="tbox">
              <h2>
                <PlaneLanding size={16} aria-hidden="true" />
                Arrival ·{' '}
                {d.timezone ? `${d.city || d.code} time` : 'UTC (airport time zone unavailable)'}
              </h2>
              <dl className="fd-data">
                <TimeCell label="Scheduled" value={flight.scheduledIn} tz={d.timezone} />
                <TimeCell label="Estimated" value={flight.estimatedIn} tz={d.timezone} />
                <TimeCell label="Actual" value={flight.actualIn} tz={d.timezone} />
              </dl>
            </div>
          </div>
        )}
        <div className="fv-facts">
          {flight.direction && (
            <p className={'direction ' + flight.direction.type}>
              <span className="badge blue plain">
                {flight.direction.type === 'overseas'
                  ? 'International'
                  : flight.direction.type[0].toUpperCase() + flight.direction.type.slice(1)}
              </span>
              {directionText(flight.direction)}
            </p>
          )}
          <p className="in-short">{summarise(flight).join(' ')}</p>
          <div className="route-progress" aria-hidden="true">
            <div style={{ width: `${Math.max(0, Math.min(100, flight.progress || 0))}%` }} />
          </div>
          <p className="progress-meta">
            <span>{progressText}</span>
            <span>{punctuality}</span>
          </p>
          {notes.map((n) => (
            <p className="progress-meta" key={n}>
              <span>{n}</span>
            </p>
          ))}
        </div>
        <div className="fetched">
          <span className="fd-data">
            Fetched {time(data.fetchedAt, here())} your time · {data.source}
          </span>
          <span className="auto">
            <span id="auto-l">Refresh automatically</span>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={auto}
              aria-labelledby="auto-l"
              title="Checks again every minute while this page is open"
              onClick={() => setAuto(!auto)}
            />
          </span>
        </div>
      </section>
      <section className="panel position" aria-label="Aircraft position">
        <span className="tile">
          <Radio size={20} aria-hidden="true" />
        </span>
        {flight.position ? (
          <div>
            <b>
              Aircraft position: {flight.position.lat.toFixed(3)}°, {flight.position.lon.toFixed(3)}
              °
            </b>
            <p>
              {[
                flight.onGround ? 'On the ground' : 'In the air',
                flight.altitudeM != null && `${flight.altitudeM.toLocaleString('en-GB')} m up`,
                flight.speedKmh != null && `${flight.speedKmh} km/h`,
                flight.headingDeg != null && `heading ${flight.headingDeg}°`,
              ]
                .filter(Boolean)
                .join(', ')}
              . Reported at {time(flight.position.time, here())} your time, from the OpenSky
              Network. The route drawing above is only a diagram and does not show this position.
            </p>
          </div>
        ) : (
          <div>
            <b>Aircraft position: not transmitting yet</b>
            <p>
              Position appears once the aircraft is airborne and in range of OpenSky Network
              receivers. Over oceans there is often no position. Flightdeck does not guess where the
              aircraft is.
            </p>
          </div>
        )}
      </section>
      <div className="tabs-row">
        <div className="tabs fv-tablist" role="tablist" aria-label="Flight details">
          {PANELS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={'fv-t-' + p.id}
              aria-selected={panel === p.id}
              aria-controls="fv-panel"
              tabIndex={panel === p.id ? 0 : -1}
              onClick={() => setPanel(p.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <p.icon size={16} aria-hidden="true" />
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <section
        className="panel tabpanel fv-body"
        id="fv-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={'fv-t-' + panel}
      >
        {panel === 'journey' && (
          <ol className="journey timeline">
            {steps.map((step) => (
              <li className={'timeline-row' + (step.done ? ' done' : '')} key={step.key}>
                <i aria-hidden="true" />
                <div>
                  <strong>{step.label}</strong>
                  <span className="step-note">{step.note}</span>
                </div>
                <small className={badgeFor(step.kind)}>{step.kind}</small>
                <span className="step-time fd-data">
                  {step.t ? `${time(step.t, step.tz)}${step.tz ? '' : ' UTC'}` : '—'}
                  {step.t && <small className="step-day">{day(step.t, step.tz)}</small>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {panel === 'airport' && (
          <div className="fv-airport">
            <div className="grid2">
              <div>
                <div className="aphead">
                  <h3>
                    {o.city || o.name} {o.code}
                  </h3>
                  <Clock24 airport={o} now={now} />
                </div>
                <div className="kv">
                  <Detail
                    label="Departure terminal"
                    value={withHint(flight.terminalOut, flight.terminalOutHint)}
                  />
                  <Detail label="Departure gate" value={flight.gateOut} />
                  <Detail label="Aircraft type" value={flight.aircraft} />
                </div>
              </div>
              <div>
                <div className="aphead">
                  <h3>
                    {d.city || d.name} {d.code}
                  </h3>
                  <Clock24 airport={d} now={now} />
                </div>
                <div className="kv">
                  <Detail
                    label="Arrival terminal"
                    value={withHint(flight.terminalIn, flight.terminalInHint)}
                  />
                  <Detail label="Arrival gate" value={flight.gateIn} />
                  <Detail label="Baggage belt" value={flight.baggage} />
                </div>
              </div>
            </div>
            <p className="note">
              <Info size={16} aria-hidden="true" />
              <span>
                {flight.baggage ? 'Belts can change, so check the airport screens. ' : ''}
                Airports often assign gates and belts late, and some never publish them. Flightdeck
                shows them as soon as they are reported. Always follow the screens at the airport.
                {flight.registration ? ` Aircraft registration ${flight.registration}.` : ''}
              </span>
            </p>
            <a
              className="btn btn-ghost btn-sm official-link"
              href={
                airlines[flight.number.slice(0, 2)] ||
                `https://www.google.com/search?q=${encodeURIComponent(flight.airline + ' official flight status')}`
              }
              target="_blank"
              rel="noreferrer"
            >
              {airlines[flight.number.slice(0, 2)]
                ? "Check the airline's flight status"
                : "Find the airline's official status page"}
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        )}
        {panel === 'weather' && <Weather airport={d} now={now} />}
        {panel === 'updates' && (
          <div className="fv-updates">
            <div aria-live="polite">
              {changes.length ? (
                <ul className="upd">
                  {changes.map((c, i) => (
                    <li key={i}>
                      <span className="dot" aria-hidden="true" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  {auto
                    ? 'Watching for changes while this page is open. Changes to the status, gates, belt and arrival time appear here.'
                    : 'Switch on Refresh automatically above (every minute), or use Refresh, to see changes here.'}
                </p>
              )}
            </div>
            <div className="sources">
              <small>
                {data.source}. Fetched{' '}
                {new Intl.DateTimeFormat('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                }).format(new Date(data.fetchedAt))}
                {data.cached ? `, kept for up to ${data.refreshSeconds} seconds` : ''}.{' '}
                {data.mode === 'live'
                  ? 'Provider data can lag behind what is really happening.'
                  : ''}
              </small>
              {data.sources?.includes('AeroDataBox') && (
                <small>
                  Schedule data from{' '}
                  <a href="https://aerodatabox.com/" target="_blank" rel="noreferrer">
                    AeroDataBox
                  </a>
                  .
                </small>
              )}
              {data.sources?.includes('OpenSky Network') && (
                <small>
                  Live aircraft positions from{' '}
                  <a href="https://opensky-network.org/" target="_blank" rel="noreferrer">
                    The OpenSky Network
                  </a>
                  .
                </small>
              )}
              {data.sources?.includes('adsbdb routes') && (
                <small>
                  Routes from{' '}
                  <a href="https://www.adsbdb.com/" target="_blank" rel="noreferrer">
                    adsbdb
                  </a>
                  .
                </small>
              )}
            </div>
          </div>
        )}
        {panel === 'destination' && <Destination airport={d} />}
      </section>
    </div>
  );
}
