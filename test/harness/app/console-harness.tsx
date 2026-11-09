// TEST ONLY (never in the production build): mounts the real owner console with a locally signed test token taken from
// ?t=..., against a throwaway server started by test/console-ui.mjs. Lets the console be checked in a real browser engine.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ConsoleShell from '../../../src/console/ConsoleShell';
import { setTokenGetter } from '../../../src/shared/api';
import '../../../src/styles/tokens.css';
import '../../../src/style.css';

const t = new URLSearchParams(location.search).get('t');
setTokenGetter(async () => t);

// Like the real parent in src/main.tsx: a NEW callback on every render, and it stores the count as a NEW object each time. A
// parent that did nothing here hid a request loop in the shell (each answer re-rendered the parent and restarted the fetch).
function Parent() {
  const [, setMe] = useState({ unread: 0 });
  return (
    <main id="main" style={{ marginLeft: 0, width: '100%' }}>
      <ConsoleShell onUnread={(n: number) => setMe((m) => ({ ...m, unread: n }))} />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Parent />);
