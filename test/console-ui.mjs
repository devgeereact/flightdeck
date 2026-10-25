// TEST ONLY: serves the owner console harness against a throwaway server (test/lib/harness-server.mjs), so the real console can
// be opened in a browser engine without a Clerk account. Prints an owner URL and stays up.
// Usage: npx vite build -c vite.console-test.config.ts && node test/console-ui.mjs [--port 3994] [--minutes 20]
import path from 'node:path';
import { startHarness } from './lib/harness-server.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const minutes = Number(arg('minutes', 20));
const h = await startHarness({ port: Number(arg('port', 3994)), dist: path.resolve(import.meta.dirname, '../.ui-test-build/console') });
const stop = () => { h.stop(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setTimeout(stop, minutes * 60000);
console.log(`${h.base}/app/console.html?t=${h.token('user_owner', minutes)}`);
