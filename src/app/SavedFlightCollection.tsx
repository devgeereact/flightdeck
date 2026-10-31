import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { Bookmark, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { inZone, time } from '../features/flight/flightFormat';
import { fromAny, motionAllowed, withMotion } from '../shared/motion';
import { dayDiff, dayLabel, recallResult, type SavedItem } from './savedFlights';
import { DEST_PHOTO } from './zone';

gsap.registerPlugin(useGSAP, Flip);

type CardProps = {
  items: SavedItem[];
  onOpen: (item: SavedItem) => void;
  onPack: (item: SavedItem) => void;
  onRemove: (index: number) => void;
};
const when = (d: string) => {
  const n = dayDiff(d);
  return n < 0 ? 'Past' : n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
};
const ROUTE = (
  <svg viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden="true">
    <path
      d="M2 16 C 60 -2, 140 -2, 198 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeDasharray="2 4"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** The drawn tile for destinations without a photo: the same blue sky and runway arc everywhere, with the airport code. */
export function CodeTile({ code }: { code: string }) {
  return (
    <span className="code-tile" aria-hidden="true">
      <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path
          d="M-20 190 C 90 60, 250 20, 430 40"
          fill="none"
          stroke="rgb(255 255 255 / 30%)"
          strokeWidth="2"
          strokeDasharray="4 10"
        />
        <path
          d="M-20 230 C 120 110, 270 80, 430 100"
          fill="none"
          stroke="rgb(255 255 255 / 16%)"
          strokeWidth="2"
        />
        <circle cx="360" cy="46" r="10" fill="#ffb618" />
      </svg>
      <b>{code}</b>
    </span>
  );
}

/** Saved flights as a row of equal cards. Route, airline and times come only from the copy Flightdeck last fetched for that
 *  flight on this device; a flight never opened here shows its number and date, nothing more. Removing a card lets the others
 *  slide into place (GSAP Flip), unless the visitor prefers reduced motion. */
export function SavedCards({ items, onOpen, onPack, onRemove }: CardProps) {
  const grid = useRef<HTMLDivElement>(null);
  const flip = useRef<Flip.FlipState | null>(null);
  useLayoutEffect(() => {
    const state = flip.current;
    flip.current = null;
    if (!state || !grid.current || !motionAllowed()) return;
    Flip.from(state, {
      targets: grid.current.querySelectorAll('.saved-flight'),
      duration: 0.5,
      ease: 'power3.inOut',
      scale: true,
    });
  }, [items]);
  return (
    <div className={`cards n${Math.min(items.length, 3)}`} ref={grid}>
      {items.map((item, index) => {
        const f = recallResult(item.number + '|' + item.date)?.data.flights[0];
        const dest = f?.destination.code;
        const photo = dest ? DEST_PHOTO[dest] : undefined;
        const dep = f?.scheduledOut || f?.estimatedOut || null;
        const label = when(item.date);
        return (
          <article
            className="fcard saved-row saved-flight"
            key={item.number + item.date}
            data-flip-id={item.number + item.date}
          >
            <div className="ph">
              {photo ? (
                <img src={photo.src} alt="" loading="lazy" />
              ) : (
                <CodeTile code={dest || item.number} />
              )}
              <span className={'when pill fd-data' + (label === 'Past' ? ' past' : '')}>
                {label}
              </span>
            </div>
            <div className="bd">
              {f ? (
                <div className="rt">
                  <b>{f.origin.code}</b>
                  {ROUTE}
                  <b>{f.destination.code}</b>
                </div>
              ) : (
                <div className="rt">
                  <b>{item.number}</b>
                </div>
              )}
              <div className="meta">
                <span>
                  {f ? (
                    <>
                      <b>{item.number}</b> · {f.airline}
                    </>
                  ) : (
                    'Open it once to see the route'
                  )}
                </span>
                <span className="fd-data" title={item.date}>
                  {dep
                    ? `${inZone(dep, f?.origin.timezone ?? null, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time(dep, f?.origin.timezone ?? null)}`
                    : dayLabel(item.date)}
                </span>
              </div>
              <div className="acts">
                <button
                  type="button"
                  className="btn btn-soft btn-sm saved-open"
                  aria-label={`Open ${item.number}`}
                  onClick={() => onOpen(item)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Make a packing list for ${item.number}`}
                  onClick={() => onPack(item)}
                >
                  <ListChecks size={16} aria-hidden="true" />
                  Pack
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-icon"
                  aria-label={`Remove ${item.number}`}
                  title="Remove flight"
                  onClick={() => {
                    if (grid.current)
                      flip.current = Flip.getState(grid.current.querySelectorAll('.saved-flight'));
                    onRemove(index);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

type Props = CardProps & { signedIn: boolean; onLookup: () => void };
export default function SavedFlights({
  items,
  signedIn,
  onOpen,
  onPack,
  onRemove,
  onLookup,
}: Props) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      withMotion(() => {
        fromAny(gsap, q('.vh > *, .saved-flight, .state'), {
          autoAlpha: 0,
          y: 18,
          duration: 0.55,
          ease: 'power3.out',
          stagger: 0.06,
        });
      });
    },
    { scope: root },
  );
  return (
    <section className="saved-workspace" aria-labelledby="saved-title" ref={root}>
      <div className="vh">
        <div>
          <h1 id="saved-title">Saved flights</h1>
          <p>
            {items.length} of 12 saved ·{' '}
            {signedIn ? 'on every device you sign in to' : 'kept on this browser'}. Open a flight
            for a fresh result.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onLookup}>
          <Plus size={20} aria-hidden="true" />
          Look up a flight
        </button>
      </div>
      {items.length ? (
        <SavedCards items={items} onOpen={onOpen} onPack={onPack} onRemove={onRemove} />
      ) : (
        <div className="panel state">
          <span className="tile">
            <Bookmark size={28} aria-hidden="true" />
          </span>
          <h2>No saved flights yet</h2>
          <p>
            Look up a flight and choose Save. You can keep up to 12, and they follow you to every
            device.
          </p>
        </div>
      )}
    </section>
  );
}
