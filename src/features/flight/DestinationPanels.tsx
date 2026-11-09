import {
  ArrowUpRight,
  CloudSun,
  Compass,
  DoorClosed,
  Droplets,
  Globe,
  Luggage,
  MapPin,
  PlaneLanding,
  PlaneTakeoff,
  Thermometer,
  Users,
  Wind,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CodeTile } from '../../app/SavedFlightCollection';
import { DEST_PHOTO, zoneAbbr } from '../../app/zone';
import { apiFetch } from '../../shared/api';
import type { Airport, Flight } from '../../types';
import { destinations } from './destinations';
import { regionName, time, weatherLabel } from './flightFormat';
import { gatePlace, gateTile, type KeyTime, keyTimes } from './keyTimes';

const NR = 'Not reported yet';

/** GET a JSON endpoint once per key; null while loading, 'failed' on any error. Aborts when the key changes. */
function useJson<T>(url: string | null, key: string): T | null | 'failed' {
  const [state, setState] = useState<T | null | 'failed'>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key names the request; url is derived from it
  useEffect(() => {
    if (!url) {
      setState('failed');
      return;
    }
    const c = new AbortController();
    setState(null);
    apiFetch(url, { signal: c.signal })
      .then(async (r) => {
        if (!r.ok) throw Error(String(r.status));
        setState((await r.json()) as T);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setState('failed');
      });
    return () => c.abort();
  }, [key]);
  return state;
}

// ---------------------------------------------------------------- gates and key times

const kindClass = (k: KeyTime['kind']) =>
  k === 'Actual' || k === 'Reported'
    ? 'badge ok'
    : k === 'Estimated'
      ? 'badge blue'
      : k === 'Scheduled'
        ? 'badge plain'
        : k === 'Typical'
          ? 'badge violet plain'
          : 'badge warn';

function TimeTile({ k }: { k: KeyTime }) {
  const t = k.t ? time(k.t, k.tz) : null;
  return (
    <div className={'kt-tile' + (t ? '' : ' empty')}>
      <span className="kt-label">{k.label}</span>
      {t && t !== 'Not available' ? (
        <b className="fd-data">
          {t}
          <small>{zoneAbbr(k.t, k.tz) || (k.tz ? '' : 'UTC')}</small>
        </b>
      ) : (
        <b className="nr">{NR}</b>
      )}
      <span className="kt-foot">
        <small className={kindClass(k.kind)}>{k.kind}</small>
        <span>{k.note}</span>
      </span>
    </div>
  );
}

function PlaceTile({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  note: string;
  icon: typeof DoorClosed;
}) {
  return (
    <div className={'kt-tile kt-place' + (value ? '' : ' empty')}>
      <span className="kt-label">
        <Icon size={16} aria-hidden="true" />
        {label}
      </span>
      <b className={value ? 'fd-data' : 'nr'}>{value || NR}</b>
      <span className="kt-foot">
        <span>{note}</span>
      </span>
    </div>
  );
}

/** Two equal rows of four: the departure side, then the arrival side. */
export function KeyTimesPanel({ flight }: { flight: Flight }) {
  const k = keyTimes(flight);
  const by = (key: string) => k.find((x) => x.key === key) as KeyTime;
  const out = gatePlace(flight.terminalOut, flight.gateOut, flight.terminalOutHint);
  const inn = gatePlace(flight.terminalIn, flight.gateIn, flight.terminalInHint);
  const outTile = gateTile('out', flight);
  const inTile = gateTile('in', flight);
  const typical = k.some((x) => x.kind === 'Typical');
  return (
    <section className="panel keytimes" aria-labelledby="kt-h">
      <div className="kt-head">
        <h2 id="kt-h">Gates and key times</h2>
        <p>Each time is in the airport's own local time.</p>
      </div>
      <div className="kt-row">
        <span className="kt-side">
          <PlaneTakeoff size={16} aria-hidden="true" />
          <span className="sr-only">Departure from </span>
          {flight.origin.code}
        </span>
        <PlaceTile label={outTile.label} value={out} icon={DoorClosed} note={outTile.note} />
        <TimeTile k={by('boarding')} />
        <TimeTile k={by('gateclose')} />
        <TimeTile k={by('takeoff')} />
      </div>
      <div className="kt-row">
        <span className="kt-side">
          <PlaneLanding size={16} aria-hidden="true" />
          <span className="sr-only">Arrival at </span>
          {flight.destination.code}
        </span>
        <TimeTile k={by('landing')} />
        <TimeTile k={by('gatein')} />
        <PlaceTile label={inTile.label} value={inn} icon={DoorClosed} note={inTile.note} />
        <PlaceTile
          label="Baggage belt"
          value={flight.baggage ? `Belt ${flight.baggage}` : null}
          icon={Luggage}
          note={
            flight.baggage
              ? 'Belts can change: check the hall screens'
              : 'Usually shown after landing'
          }
        />
      </div>
      {typical && (
        <p className="kt-note">
          <b>Typical</b> times are worked out from the departure time, because airlines rarely
          publish boarding and gate-closing times. Your boarding pass and the airport screens are
          the final word.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- weather at the destination

type WeatherData = {
  temperature_2m: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  weather_code: number;
  wind_speed_10m: number;
  time?: string;
  timezone?: string | null;
  hourly?: { time: string; t: number | null; code: number | null; rain: number | null }[];
  daily?: {
    date: string;
    code: number | null;
    max: number | null;
    min: number | null;
    rain: number | null;
  }[];
};

/** "2026-11-01T14" for an instant in a zone, to match Open-Meteo's local hourly times. */
function localHour(iso: string, tz: string | null | undefined): string | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const v = (t: string) => p.find((x) => x.type === t)?.value;
    return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}`;
  } catch {
    return null;
  }
}
const dayName = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const deg = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(n)}°`);

export function WeatherCard({ airport, arrival }: { airport: Airport; arrival: string | null }) {
  const place = airport.city || airport.name || airport.code;
  const has = airport.lat !== null && airport.lon !== null;
  const w = useJson<WeatherData>(
    has ? `/api/weather?lat=${airport.lat}&lon=${airport.lon}` : null,
    `${airport.code}:${airport.lat}:${airport.lon}`,
  );
  if (w === null || w === 'failed')
    return (
      <section className="panel side-card wxcard" aria-labelledby="wx-h">
        <h2 id="wx-h" className="side-h">
          <CloudSun size={18} aria-hidden="true" />
          Weather in {place}
        </h2>
        <p className="muted">
          {w === 'failed'
            ? 'The weather is not available right now. Try again later.'
            : 'Getting the weather…'}
        </p>
      </section>
    );
  const at = arrival ? localHour(arrival, w.timezone || airport.timezone) : null;
  const landHour = at ? w.hourly?.find((h) => h.time.startsWith(at)) : undefined;
  const fromDay = at ? at.slice(0, 10) : (w.daily?.[0]?.date ?? '');
  const days = (w.daily || []).filter((d) => d.date >= fromDay).slice(0, 4);
  return (
    <section className="panel side-card wxcard" aria-labelledby="wx-h">
      <h2 id="wx-h" className="side-h">
        <CloudSun size={18} aria-hidden="true" />
        Weather in {place}
      </h2>
      <div className="wx-now">
        <div className="wx-temp fd-data">
          {Math.round(w.temperature_2m)}
          <span>°C</span>
        </div>
        <div>
          <b>{weatherLabel(w.weather_code)}</b>
          <span className="muted">
            Now
            {w.apparent_temperature != null &&
              `, feels like ${Math.round(w.apparent_temperature)}°`}
          </span>
        </div>
      </div>
      <dl className="wx-facts">
        <div>
          <dt>
            <Wind size={14} aria-hidden="true" />
            Wind
          </dt>
          <dd className="fd-data">{Math.round(w.wind_speed_10m)} km/h</dd>
        </div>
        <div>
          <dt>
            <Droplets size={14} aria-hidden="true" />
            Humidity
          </dt>
          <dd className="fd-data">
            {w.relative_humidity_2m != null ? `${w.relative_humidity_2m}%` : '–'}
          </dd>
        </div>
        <div>
          <dt>
            <Thermometer size={14} aria-hidden="true" />
            Today
          </dt>
          <dd className="fd-data">
            {deg(w.daily?.[0]?.min)} / {deg(w.daily?.[0]?.max)}
          </dd>
        </div>
      </dl>
      {arrival && (
        <div className="wx-land">
          <PlaneLanding size={18} aria-hidden="true" />
          {landHour && landHour.t != null ? (
            <p>
              <b>When you land, around {time(arrival, airport.timezone)}:</b>{' '}
              {Math.round(landHour.t)}°C,{' '}
              {landHour.code != null
                ? weatherLabel(landHour.code).toLowerCase()
                : 'conditions not forecast'}
              {landHour.rain != null ? `, ${landHour.rain}% chance of rain` : ''}.
            </p>
          ) : (
            <p>
              <b>When you land:</b> the forecast covers the next 7 days, so it appears closer to the
              date.
            </p>
          )}
        </div>
      )}
      {days.length > 0 && (
        <ul className="wx-days" aria-label="Forecast from your arrival day">
          {days.map((d) => (
            <li key={d.date}>
              <span>{dayName(d.date)}</span>
              <b className="fd-data">{deg(d.max)}</b>
              <small className="fd-data">{deg(d.min)}</small>
              <small>{d.code != null ? weatherLabel(d.code) : '–'}</small>
            </li>
          ))}
        </ul>
      )}
      <p className="side-src">
        Forecast from{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        , for the airport area.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- discover the destination

type PlaceData = {
  title: string;
  summary: string;
  image: string | null;
  url: string;
  source: string;
  licence: string;
  sections: { label: string; url: string }[];
};

export function DiscoverCard({ airport }: { airport: Airport }) {
  const curated = destinations[airport.code];
  const photo = DEST_PHOTO[airport.code];
  const city = airport.city || airport.name || airport.code;
  const country = airport.country || regionName(airport.countryCode) || '';
  const wiki = useJson<PlaceData>(
    airport.city
      ? `/api/place?city=${encodeURIComponent(airport.city)}&country=${encodeURIComponent(country)}`
      : null,
    `${airport.city}|${country}`,
  );
  const w = wiki && wiki !== 'failed' ? wiki : null;
  const img = photo
    ? { src: photo.src, alt: photo.alt }
    : w?.image
      ? { src: w.image, alt: `${w.title}` }
      : null;
  // A picture that fails to load (a bad URL, a blocked host) must never show the browser's broken-image icon: fall back to the airport tile.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImg = img && failedSrc !== img.src;
  return (
    <section className="panel side-card discover" aria-labelledby="disc-h">
      <div className="disc-ph">
        {showImg ? (
          <img src={img.src} alt={img.alt} loading="lazy" onError={() => setFailedSrc(img.src)} />
        ) : (
          <CodeTile code={airport.code} />
        )}
      </div>
      <h2 id="disc-h" className="side-h">
        <Compass size={18} aria-hidden="true" />
        Discover {city}
      </h2>
      <p className="label">
        <MapPin size={14} aria-hidden="true" />
        {[airport.name, country].filter(Boolean).join(' · ')}
      </p>
      {curated ? (
        <>
          <p className="disc-text">{curated.intro}</p>
          <dl className="disc-facts">
            <div>
              <dt>
                <Globe size={14} aria-hidden="true" />
                Currency
              </dt>
              <dd>{curated.currency}</dd>
            </div>
            <div>
              <dt>
                <Users size={14} aria-hidden="true" />
                Language
              </dt>
              <dd>{curated.language}</dd>
            </div>
          </dl>
          <ul className="disc-links">
            {curated.places.slice(0, 3).map((p) => (
              <li key={p.name}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  <span>
                    <b>{p.name}</b>
                    <small>{p.kind}</small>
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="side-src">
            <b>From the airport.</b> {curated.tip}
          </p>
        </>
      ) : w ? (
        <>
          <p className="disc-text">{w.summary}</p>
          {w.sections.length > 0 && (
            <ul className="disc-chips" aria-label={`${w.source} travel guide sections`}>
              {w.sections.map((s) => (
                <li key={s.label}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="side-src">
            From{' '}
            <a href={w.url} target="_blank" rel="noreferrer">
              {w.source}
            </a>{' '}
            ({w.licence}). Check official sources for opening times and entry rules.
          </p>
        </>
      ) : (
        <p className="disc-text muted">
          {wiki === null
            ? 'Finding a travel guide…'
            : `No travel guide found for ${city}. The local tourism website is the best place to plan your stay.`}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- latest from the web (Bright Data, off unless configured)

type WebData = {
  status: 'ok' | 'off' | 'cap' | 'error';
  results?: { title: string; snippet: string; url: string; site: string }[];
  fetchedAt?: string;
};

export function WebCheckCard({ flight }: { flight: Flight }) {
  const date = (flight.scheduledOut || flight.estimatedOut || '').slice(0, 10);
  // Only worth a search while the gate is still missing.
  const want = !flight.gateOut && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const q = `number=${encodeURIComponent(flight.number)}&date=${date}&from=${flight.origin.code}&to=${flight.destination.code}`;
  const r = useJson<WebData>(want ? `/api/web-check?${q}` : null, want ? q : 'none');
  if (!r || r === 'failed' || r.status !== 'ok' || !r.results?.length) return null;
  return (
    <section className="panel side-card webcheck" aria-labelledby="web-h">
      <h2 id="web-h" className="side-h">
        <Globe size={18} aria-hidden="true" />
        Latest from the web
      </h2>
      <ul className="disc-links">
        {r.results.map((x) => (
          <li key={x.url}>
            <a href={x.url} target="_blank" rel="noreferrer">
              <span>
                <b>{x.title}</b>
                <small>
                  {x.site}
                  {x.snippet ? ` · ${x.snippet}` : ''}
                </small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <p className="side-src">
        Search results
        {r.fetchedAt
          ? ` from ${time(r.fetchedAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}`
          : ''}
        , not checked by Flightdeck. Pages can show other dates, so confirm with the airline or
        airport.
      </p>
    </section>
  );
}
