// Local UI smoke test: builds the real app, serves it with the PHP dev router and drives it in jsdom.
// Run: pnpm test:ui   (local only: it uses your .env provider keys and may spend 2 AeroDataBox units)
import {JSDOM} from 'jsdom';
import {spawn, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 3997, BASE = `http://127.0.0.1:${PORT}/`;
const FLIGHT = process.env.UI_TEST_FLIGHT || 'LH400';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + extra)); if (!ok) failed++; };

execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.ui-test.config.ts', '--logLevel', 'error'], {cwd: root, stdio: 'inherit'});
const code = fs.readFileSync(path.join(root, '.ui-test-build/app.js'), 'utf8');

// provider keys come from .env into the server's environment only; nothing is printed
const env = {...process.env, FLIGHTDECK_PRIVATE: path.join(root, 'php/private')};
try {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_]+)=(.*)$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}
const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, 'php/dev-router.php'], {cwd: root, env, stdio: 'ignore'});
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 20; i++) { try { if ((await fetch(BASE + 'api/config')).ok) break; } catch {} await sleep(250); }
const cfg = await (await fetch(BASE + 'api/config')).json();

async function boot({config, storedMode} = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: BASE, runScripts: 'outside-only', pretendToBeVisual: true});
  const w = dom.window;
  if (storedMode) w.localStorage.setItem('flightdeck-mode', storedMode);
  w.fetch = async (input, init) => {
    const u = new URL(String(input), BASE);
    if (config && u.pathname === '/api/config') return new Response(JSON.stringify(config), {headers: {'content-type': 'application/json'}});
    return fetch(u, {...init, signal: undefined}); // jsdom's AbortSignal is not Node's
  };
  const errors = [];
  w.addEventListener('error', e => errors.push(String(e.message)));
  w.console.error = (...a) => errors.push(a.join(' ').slice(0, 200));
  w.eval(code);
  return {w, errors, text: () => w.document.body.textContent};
}
const val = (app, sel) => app.w.document.querySelector(sel).value;
async function search(app, number) {
  const {w} = app, d = w.document, input = d.querySelector('input[aria-label="Flight number"]');
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, number);
  input.dispatchEvent(new w.Event('input', {bubbles: true}));
  await sleep(100);
  d.querySelector('form.search-card').dispatchEvent(new w.Event('submit', {bubbles: true, cancelable: true}));
}

try {
  if (cfg.liveAvailable) {
    const a = await boot(); await sleep(2500);
    check('A1 live available: opens on live data, not the demo', val(a, 'select[aria-label="Data source"]') === 'live', val(a, 'select[aria-label="Data source"]'));
    check('A2 live available: flight number box starts empty', val(a, 'input[aria-label="Flight number"]') === '');
    check('A3 live available: no sample flight preloaded', !a.text().includes('Sample flight preview') && !a.text().includes('Boeing 777-300ER'));
    check('A4 live available: shows the "Track a live flight" prompt', a.text().includes('Track a live flight'));
    await search(a, FLIGHT); await sleep(7000);
    const t = a.text();
    const found = t.includes('Your flight') && t.includes(FLIGHT), none = t.includes('No flights found');
    check(`B1 live search for ${FLIGHT} gives a flight card or an honest "not found"`, found || none, t.slice(300, 500));
    check('B2 live result is never labelled sample', !t.includes('Sample flight preview') && !t.includes('of journey · illustrative'));
    if (found) check('B3 provider attribution is shown', /Flight schedule data by AeroDataBox|Live aircraft positions from The OpenSky Network/.test(t));
    check('B4 no runtime errors', a.errors.length === 0, a.errors.join(' | '));
    a.w.close();
  } else console.log('SKIPPED A/B: no live provider keys configured locally');
  const c = await boot({config: {liveAvailable: false, provider: 'x'}}); await sleep(2500);
  check('C1 no live providers: falls back to the sample flight', val(c, 'select[aria-label="Data source"]') === 'demo' && c.text().includes('Sample flight preview'));
  c.w.close();
  const d = await boot({storedMode: 'demo'}); await sleep(2500);
  check('D1 a remembered "Sample flights" choice is respected', val(d, 'select[aria-label="Data source"]') === 'demo' && d.text().includes('Sample flight preview'));
  d.w.close();
} finally { stop(); }
console.log(failed ? `\n${failed} FAILED` : '\nAll UI smoke checks passed');
process.exit(failed ? 1 : 0);
