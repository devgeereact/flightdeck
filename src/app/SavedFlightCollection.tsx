import { ArrowUpRight, Bookmark, CalendarDays, ListChecks, Plane, Trash2 } from 'lucide-react';
import { dayDiff, dayLabel, type SavedItem } from './savedFlights';

type Props = {
  items: SavedItem[];
  signedIn: boolean;
  onOpen: (item: SavedItem) => void;
  onPack: (item: SavedItem) => void;
  onRemove: (index: number) => void;
};
export default function SavedFlights({ items, signedIn, onOpen, onPack, onRemove }: Props) {
  return (
    <section className="saved-workspace" aria-labelledby="saved-title">
      <div className="section-heading">
        <div>
          <p className="workspace-eyebrow">YOUR FLIGHT COLLECTION</p>
          <h2 id="saved-title">
            Saved flights <span>{items.length}/6</span>
          </h2>
        </div>
        <p>
          {signedIn
            ? 'Synced to your account across devices.'
            : 'Kept on this browser. Sign in to sync across devices.'}{' '}
          Open a flight for a fresh result.
        </p>
      </div>
      {items.length ? (
        <div className="saved-grid">
          {items.map((item, index) => (
            <article className="saved-row saved-flight" key={item.number + item.date}>
              <div className="saved-flight-top">
                <span className="saved-flight-icon">
                  <Plane size={22} />
                </span>
                <span className="pill">{dayDiff(item.date) < 0 ? 'Past' : 'Saved flight'}</span>
              </div>
              <button className="saved-open" onClick={() => onOpen(item)}>
                <strong>{item.number}</strong>
                <span className="saved-day" title={item.date}>
                  <CalendarDays size={15} />
                  {dayLabel(item.date)}
                </span>
                <span className="saved-open-label">
                  Open flight <ArrowUpRight size={17} />
                </span>
              </button>
              <div className="saved-flight-actions">
                <button
                  className="text-button"
                  aria-label={`Make a packing list for ${item.number}`}
                  onClick={() => onPack(item)}
                >
                  <ListChecks size={15} />
                  Packing list
                </button>
                <button
                  className="icon-button"
                  aria-label={`Remove ${item.number}`}
                  title="Remove flight"
                  onClick={() => onRemove(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel collection-empty">
          <Bookmark size={32} />
          <h3>Your next journey belongs here.</h3>
          <p>
            No saved flights yet. Track a flight, then choose Save flight. Keep up to six flights
            close at hand.
          </p>
        </div>
      )}
    </section>
  );
}
