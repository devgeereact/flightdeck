import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Shown when the browser does not offer its own install prompt. Plain steps for the browsers people actually use.
const BROWSERS = [
  {
    id: 'ios',
    label: 'iPhone · Safari',
    steps: [
      'Open flightdeck.gakinz.com/app/ in Safari.',
      'Tap the Share button at the bottom of the screen.',
      'Scroll and tap Add to Home Screen, then Add.',
    ],
  },
  {
    id: 'android',
    label: 'Android · Chrome',
    steps: ['Open the app in Chrome.', 'Tap the three-dot menu.', 'Tap Install app, then Install.'],
  },
  {
    id: 'desktop',
    label: 'Desktop · Chrome or Edge',
    steps: [
      'Open the app in Chrome or Edge.',
      'Select the install icon at the right of the address bar.',
      'Select Install. Flightdeck opens in its own window.',
    ],
  },
  {
    id: 'mac',
    label: 'Mac · Safari',
    steps: ['Open the app in Safari.', 'Choose File, then Add to Dock.'],
  },
  {
    id: 'firefox',
    label: 'Firefox',
    steps: ['Firefox does not install web apps. Use another browser, or bookmark this page.'],
  },
];
const guess = () => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'mac';
  if (/Chrome\/|Edg\//.test(ua) && !/Mobile/.test(ua)) return 'desktop';
  return 'ios';
};

export default function InstallHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [b, setB] = useState(guess);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  const current = BROWSERS.find((x) => x.id === b) || BROWSERS[0];
  return (
    <dialog
      ref={ref}
      className="dialog install-help"
      aria-labelledby="ih-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="dialog-head">
        <div>
          <h2 id="ih-title">Install Flightdeck</h2>
          <p className="label">
            It opens like an app and keeps your packing list available without a connection.
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => ref.current?.close()}
          aria-label="Close"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="chips ih-browsers" role="group" aria-label="Your browser">
        {BROWSERS.map((x) => (
          <button
            key={x.id}
            type="button"
            className="chip"
            aria-pressed={x.id === b}
            onClick={() => setB(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <ol className="steps-list" aria-live="polite">
        {current.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="dialog-foot">
        <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>
          Done
        </button>
      </div>
    </dialog>
  );
}
