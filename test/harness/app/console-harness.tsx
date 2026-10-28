// TEST ONLY (never in the production build): mounts the real owner console with a locally signed test token taken from
// ?t=..., against a throwaway server started by test/console-ui.mjs. Lets the console be checked in a real browser engine.
import { createRoot } from 'react-dom/client';
import ConsoleShell from '../../../src/console/ConsoleShell';
import { setTokenGetter } from '../../../src/shared/api';
import '../../../src/styles/tokens.css';
import '../../../src/style.css';

const t = new URLSearchParams(location.search).get('t');
setTokenGetter(async () => t);
createRoot(document.getElementById('root')!).render(
  <main id="main" style={{ marginLeft: 0, width: '100%' }}>
    <ConsoleShell onUnread={() => {}} />
  </main>,
);
