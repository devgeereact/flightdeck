// What we know about a trip's flight, boiled down to the few facts the packing suggestions need. Pure functions, no network.
import type { Flight } from '../../types';

export type TripContext = {
  dir: 'outbound' | 'inbound' | 'domestic' | 'overseas' | null;
  intl: boolean | null; // departure and arrival countries differ (null when either is unknown)
  dest: string;
  destName: string;
  lat: number | null;
  lon: number | null;
  tempC: number | null;
  rain: boolean | null;
  km: number | null;
  at: number; // at = when the weather was last read
};

const rad = (d: number) => (d * Math.PI) / 180;
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const dp = rad(b.lat - a.lat),
    dl = rad(b.lon - a.lon);
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dl / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** WMO weather codes (Open-Meteo): drizzle, rain, freezing rain, showers and thunderstorms count as rain. */
export const isRainy = (code: number | null | undefined) =>
  code != null && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95);

export function contextFromFlight(
  f: Flight,
  weather: { temperature_2m?: number; weather_code?: number } | null,
  now = Date.now(),
): TripContext | null {
  const d = f.destination;
  if (!d || d.code === '—') return null;
  const o = f.origin;
  const known = (c?: string | null) => (typeof c === 'string' && c.length === 2 ? c : null);
  const oc = known(o?.countryCode),
    dc = known(d.countryCode);
  const hasXY = (a: any) => a && typeof a.lat === 'number' && typeof a.lon === 'number';
  return {
    dir: f.direction?.type ?? null,
    intl: oc && dc ? oc !== dc : null,
    dest: d.code,
    destName: d.city || d.name || d.code,
    lat: hasXY(d) ? d.lat : null,
    lon: hasXY(d) ? d.lon : null,
    tempC:
      weather && typeof weather.temperature_2m === 'number'
        ? Math.round(weather.temperature_2m)
        : null,
    rain: weather && weather.weather_code != null ? isRainy(weather.weather_code) : null,
    km: hasXY(o) && hasXY(d) ? Math.round(haversineKm(o as any, d as any)) : null,
    at: now,
  };
}

export const weatherStale = (c: TripContext, now = Date.now()) => now - c.at > 6 * 3600 * 1000;
