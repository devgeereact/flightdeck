import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Announcement = {
  id: string;
  message: string;
  level: 'info' | 'warning';
  linkLabel: string;
  linkHref: string;
};

/** Announcements the owner published for the app (CMS, where "App" or "Both"), behind the bell in the top bar. A red dot shows
 *  while there is something not yet dismissed. Plain text; the server checks every link. Dismissal is remembered on this device. */
export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null),
    btn = useRef<HTMLButtonElement>(null);
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('flightdeck-dismissed') || '[]');
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/site', { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.announcements)) setItems(j.announcements);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const dismiss = (id: string) => {
    const next = [...hidden, id].slice(-20);
    setHidden(next);
    try {
      localStorage.setItem('flightdeck-dismissed', JSON.stringify(next));
    } catch {
      /* private mode: dismissed for this visit only */
    }
  };
  const live = items.filter((a) => !hidden.includes(a.id));
  return (
    <div className="rel" ref={box}>
      <button
        ref={btn}
        type="button"
        className="icon-btn"
        aria-label={live.length ? `Announcements (${live.length} new)` : 'Announcements'}
        title="Announcements"
        aria-expanded={open}
        aria-controls="bell-pop"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} aria-hidden="true" />
        {live.length > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="pop bell-pop" id="bell-pop">
          <h3>Announcements</h3>
          {live.length ? (
            live.map((a) => (
              <div key={a.id} className={a.level === 'warning' ? 'ann warn' : 'ann'}>
                <p>
                  {a.message}
                  {a.linkHref && a.linkLabel && (
                    <>
                      {' '}
                      <a
                        href={a.linkHref}
                        {...(/^https?:/.test(a.linkHref)
                          ? { rel: 'noopener', target: '_blank' }
                          : {})}
                      >
                        {a.linkLabel}
                      </a>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className="ann-x"
                  aria-label="Dismiss announcement"
                  onClick={() => dismiss(a.id)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))
          ) : (
            <p className="empty">
              Nothing new. Announcements the owner publishes in the console appear here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
