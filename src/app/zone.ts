// Small display helpers shared by the tracker, the saved cards and the flight view.

/** Short name of an airport's clock at a given instant: GMT, BST, EST, CET… From the time zone database, never from arithmetic.
 *  British English names first (GMT/BST); where that only gives an offset, the US English name when it is a real abbreviation. */
export function zoneAbbr(
  t: string | Date | null | undefined,
  tz: string | null | undefined,
): string {
  if (!t) return '';
  const d = typeof t === 'string' ? new Date(t) : t;
  if (Number.isNaN(d.getTime())) return '';
  const name = (locale: string) => {
    try {
      return (
        new Intl.DateTimeFormat(locale, { timeZone: tz || 'UTC', timeZoneName: 'short' })
          .formatToParts(d)
          .find((p) => p.type === 'timeZoneName')?.value || ''
      );
    } catch {
      return '';
    }
  };
  const gb = name('en-GB');
  if (!/^(GMT|UTC)[+-−]/.test(gb)) return gb || (tz ? '' : 'UTC');
  const us = name('en-US');
  return /^[A-Z]{2,5}$/.test(us) ? us : gb;
}

/** Destinations with a licensed photo in public/img. Every other destination gets the same drawn blue tile, never a stock guess. */
export const DEST_PHOTO: Record<string, { src: string; alt: string }> = {
  JFK: { src: '/img/new-york.jpg', alt: 'The Manhattan skyline across the water' },
  DXB: { src: '/img/dubai.jpg', alt: 'Dubai Marina towers at dusk' },
  CDG: { src: '/img/paris.jpg', alt: 'The Eiffel Tower above the Seine' },
};

/** "2 h 15 m" between two instants, or null when either is missing. */
export function flightTime(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (!a || !b) return null;
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  if (!Number.isFinite(m) || m <= 0) return null;
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m` : `${m} m`;
}
