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
    const t0 = a.text();
    check('A1 no data-source choice is shown and nothing says sample/demo', !a.w.document.querySelector('select') && !/Sample|DATA SOURCE|demo/i.test(t0));
    check('A2 flight number box starts empty', val(a, 'input[aria-label="Flight number"]') === '');
    check('A3 shows the "Track a flight" prompt, no flight preloaded', t0.includes('Track a flight') && !a.w.document.querySelector('.flight-card'));
    await search(a, FLIGHT); await sleep(7500);
    const t = a.text(), d = a.w.document;
    const found = !!d.querySelector('.flight-card') && t.includes(FLIGHT), none = t.includes('No flights found');
    check(`B1 search for ${FLIGHT} gives a flight card or an honest "not found"`, found || none, t.slice(300, 500));
    if (found) {
      check('B2 direction is stated (outbound/inbound/domestic/international)', !!d.querySelector('.direction') && /Outbound|Inbound|Domestic|International|Probably/.test(d.querySelector('.direction').textContent), d.querySelector('.direction')?.textContent);
      const rows = [...d.querySelectorAll('.timeline-row')].map(r => ({label: r.querySelector('strong').textContent, kind: r.querySelector('small').textContent, time: r.lastElementChild.textContent}));
      check('B3 timeline has 5 steps', rows.length === 5 && rows.map(r => r.label).join() === 'Boarding,Gate out,Take-off,Touchdown,Gate in', JSON.stringify(rows));
      check('B4 timeline never claims "Actual" without a time, and every time has a kind', rows.every(r => (r.kind !== 'Actual' || r.time !== '—') && r.kind.length > 0), JSON.stringify(rows));
      check('B5 a step with no time shows a dash, not "Not available"', rows.every(r => r.time === '—' || /\d\d:\d\d/.test(r.time)), JSON.stringify(rows));
      check('B6 provider attribution is shown', /Flight schedule data by AeroDataBox|Live aircraft positions from The OpenSky Network/.test(t));
    }
    check('B7 no runtime errors', a.errors.length === 0, a.errors.join(' | '));
    a.w.close();
    // Usual-route fallback: a date far beyond the schedule window still says what the flight normally flies
    const far = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
    const f = await boot(); await sleep(2000);
    f.w.document.querySelector('input[aria-label="Departure date"]');
    Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(f.w.document.querySelector('input[aria-label="Departure date"]'), far);
    f.w.document.querySelector('input[aria-label="Departure date"]').dispatchEvent(new f.w.Event('input', {bubbles: true}));
    await search(f, 'BA59'); await sleep(6000);
    const tf = f.text();
    check('B8 far-future date: usual route + outbound shown, no invented times', tf.includes('LHR') && tf.includes('CPT') && /Outbound from London/.test(tf) && tf.includes('not published yet'), tf.slice(300, 700));
    f.w.close();
  } else console.log('SKIPPED A/B: no live provider keys configured locally');
  const c = await boot({config: {liveAvailable: false, provider: 'x'}}); await sleep(2000);
  check('C1 no live providers: says so plainly', c.text().includes('not configured on this server'));
  c.w.close();
} finally { stop(); }
console.log(failed ? `\n${failed} FAILED` : '\nAll UI smoke checks passed');
process.exit(failed ? 1 : 0);
