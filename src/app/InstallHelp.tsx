import { useEffect, useRef } from 'react';

// Shown when the browser does not offer its own install prompt. Plain steps for the browsers people actually use.
export default function InstallHelp({ onClose }: { onClose: () => void }) {
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
      className="fb-dialog install-help"
      aria-labelledby="ih-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="fb-head">
        <h2 id="ih-title">Install Flightdeck</h2>
        <button className="fb-close" onClick={() => ref.current?.close()} aria-label="Close">
          ×
        </button>
      </div>
      <div className="ih-body">
        <p>
          Installing puts Flightdeck on your home screen or dock, opens it in its own window and
          keeps your packing list available without a connection.
        </p>
        <ul>
          <li>
            <strong>iPhone or iPad (Safari):</strong> tap the Share button, then Add to Home Screen.
          </li>
          <li>
            <strong>Android (Chrome):</strong> open the menu (three dots), then Install app or Add
            to Home screen.
          </li>
          <li>
            <strong>Chrome or Edge on a computer:</strong> click the install icon at the right of
            the address bar, or open the menu and choose Install Flightdeck.
          </li>
          <li>
            <strong>Safari on a Mac:</strong> choose File, then Add to Dock.
          </li>
          <li>
            <strong>Firefox:</strong> Firefox does not install web apps. Use another browser, or
            bookmark this page.
          </li>
        </ul>
        <button className="btn btn-primary" onClick={() => ref.current?.close()}>
          Got it
        </button>
      </div>
    </dialog>
  );
}
