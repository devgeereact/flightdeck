// Local UI smoke test: builds the real app, serves it with the PHP dev router and drives it in jsdom.
// Run: pnpm test:ui   (local only: it uses your .env provider keys and may spend 2 AeroDataBox units)

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { FOOTER_GROUPS } from '../src/siteNav.ts';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 3997,
  BASE = `http://127.0.0.1:${PORT}/`;
const FLIGHT = process.env.UI_TEST_FLIGHT || 'LH400';
const LIVE = process.env.UI_TEST_LIVE === '1'; // set to also run the checks against the real flight providers (spends provider units)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
// A fixed, provider-free flight so these checks give the same answer at any hour. BA59 does fly LHR to CPT, but nothing here depends on today's real data.
const iso = (h, m = 0, d = 0) => new Date(Date.UTC(2026, 9, 25 + d, h, m)).toISOString();
const airport = (code, name, city, country, countryCode, timezone, lat, lon) => ({
  code,
  name,
  city,
  country,
  countryCode,
  timezone,
  lat,
  lon,
});
const LHR = airport(
  'LHR',
  'London Heathrow',
  'London',
  'United Kingdom',
  'GB',
  'Europe/London',
  51.47,
  -0.45,
);
const CPT = airport(
  'CPT',
  'Cape Town International',
  'Cape Town',
  'South Africa',
  'ZA',
  'Africa/Johannesburg',
  -33.97,
  18.6,
);
const baseFlight = {
  id: 'ba59-fixture',
  number: 'BA59',
  airline: 'British Airways',
  status: 'Scheduled',
  cancelled: false,
  diverted: false,
  origin: LHR,
  destination: CPT,
  scheduledOut: iso(21, 20),
  estimatedOut: iso(21, 20),
  actualOut: null,
  scheduledIn: iso(10, 10, 1),
  estimatedIn: iso(10, 10, 1),
  actualIn: null,
  takeoff: null,
  landing: null,
  boarding: null,
  gateOut: null,
  gateIn: null,
  terminalOut: '5',
  terminalIn: null,
  baggage: '2',
  aircraft: 'Boeing 777',
  registration: null,
  progress: null,
  delayMinutes: 0,
  position: null,
  providerStatus: 'Expected',
  liveUpdates: true,
  dataSource: 'AeroDataBox',
  direction: { type: 'outbound', basis: 'route', home: 'GB', place: 'London' },
};
const fixtureFlights = (date) => {
  const far = (new Date(date + 'T00:00:00Z') - Date.now()) / 86400000 > 4;
  const f = far
    ? {
        ...baseFlight,
        usualRouteOnly: true,
        scheduledOut: null,
        estimatedOut: null,
        scheduledIn: null,
        estimatedIn: null,
        baggage: null,
        terminalOut: null,
        liveUpdates: false,
        delayMinutes: null,
      }
    : baseFlight;
  return {
    mode: 'live',
    flights: [f],
    fetchedAt: new Date().toISOString(),
    cached: false,
    source: 'AeroDataBox · OpenSky Network',
    sources: ['AeroDataBox', 'OpenSky Network'],
    refreshSeconds: 60,
    notes: far
      ? ["No schedule is published for this date yet, so this is the flight's usual route only."]
      : [],
  };
};
const check = (name, ok, extra = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + extra));
  if (!ok) failed++;
};

execFileSync(
  'pnpm',
  ['exec', 'vite', 'build', '--config', 'vite.ui-test.config.ts', '--logLevel', 'error'],
  { cwd: root, stdio: 'inherit' },
);
const code = fs.readFileSync(path.join(root, '.local-test/build/app.js'), 'utf8');

// provider keys come from .env into the server's environment only; nothing is printed
const env = {
  ...process.env,
  FLIGHTDECK_PRIVATE: path.join(root, 'php/private'),
  FLIGHTDECK_AUTH: 'off',
}; // jsdom has no Clerk session
try {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_]+)=(.*)$/);
    if (m && !(m[1] in env)) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch {}
const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, 'php/dev-router.php'], {
  cwd: root,
  env,
  stdio: 'ignore',
});
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 20; i++) {
  try {
    if ((await fetch(BASE + 'api/config')).ok) break;
  } catch {}
  await sleep(250);
}
const cfg = await (await fetch(BASE + 'api/config')).json();

async function boot({ config, storedMode, hash = '', storage = {}, fixtures = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: BASE + hash,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  if (storedMode) w.localStorage.setItem('flightdeck-mode', storedMode);
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  w.fetch = async (input, init) => {
    const u = new URL(String(input), BASE);
    if (fixtures && u.pathname === '/api/config')
      return new Response(JSON.stringify({ liveAvailable: true, provider: 'fixture' }), {
        headers: { 'content-type': 'application/json' },
      });
    if (fixtures && u.pathname === '/api/flights')
      return new Response(JSON.stringify(fixtureFlights(u.searchParams.get('date'))), {
        headers: { 'content-type': 'application/json' },
      });
    if (fixtures && u.pathname === '/api/weather')
      return new Response(
        JSON.stringify({
          temperature_2m: 15.2,
          weather_code: 2,
          wind_speed_10m: 14.9,
          time: '2026-10-25T01:30',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    if (config && u.pathname === '/api/config')
      return new Response(JSON.stringify(config), {
        headers: { 'content-type': 'application/json' },
      });
    return fetch(u, { ...init, signal: undefined }); // jsdom's AbortSignal is not Node's
  };
  const errors = [];
  w.addEventListener('error', (e) => errors.push(String(e.message)));
  w.console.error = (...a) => errors.push(a.join(' ').slice(0, 200));
  w.eval(code);
  return { w, errors, text: () => w.document.body.textContent };
}
const val = (app, sel) => app.w.document.querySelector(sel).value;
async function search(app, number) {
  const { w } = app,
    d = w.document,
    input = d.querySelector('input[aria-label="Flight number"]');
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(input, number);
  input.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(100);
  d.querySelector('form.search-card').dispatchEvent(
    new w.Event('submit', { bubbles: true, cancelable: true }),
  );
}

try {
  {
    // flight search, with fixed provider data (see the fixtures above)
    const a = await boot({ fixtures: true });
    await sleep(1500);
    const t0 = a.text();
    check(
      'A1 no data-source choice is shown and nothing says sample/demo',
      !a.w.document.querySelector('select') && !/Sample|DATA SOURCE|demo/i.test(t0),
    );
    {
      // app shell: skip link, one marked current page in each menu, every sidebar button named for its icon-only state
      const d0 = a.w.document,
        skip = d0.querySelector('a.skip-link'),
        main = d0.querySelector('main#main');
      check(
        'S1 a "Skip to content" link leads to the main content',
        !!skip &&
          skip.textContent === 'Skip to content' &&
          skip.getAttribute('href') === '#main' &&
          !!main &&
          main.getAttribute('tabindex') === '-1',
      );
      if (skip && main) {
        skip.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(50);
      }
      check(
        'S2 using the skip link moves focus to the main content and keeps the current page',
        d0.activeElement === main && a.w.location.hash === '',
        a.w.location.hash,
      );
      const side = [...d0.querySelectorAll('.sidebar nav[aria-label="Main"] button')],
        phone = [...d0.querySelectorAll('nav.mobile-nav[aria-label="Main"] button')];
      const current = (list) => list.filter((b) => b.getAttribute('aria-current') === 'page');
      check(
        'N1 the sidebar menu is a nav with the tracker marked as the current page',
        side.length === 3 &&
          current(side).length === 1 &&
          current(side)[0].getAttribute('aria-label') === 'Flight tracker',
        side.map((b) => b.outerHTML.slice(0, 120)).join(' | '),
      );
      check(
        'N2 every sidebar button keeps its name (aria-label and title) for the icon-only width',
        side.every(
          (b) =>
            b.getAttribute('aria-label') &&
            b.getAttribute('title') === b.getAttribute('aria-label'),
        ) && side[1].getAttribute('aria-label') === 'Saved flights (0)',
      );
      check(
        'N3 the phone menu uses short labels and marks the current page',
        phone.map((b) => b.textContent).join('|') === 'Tracker|Saved 0|Packing list' &&
          current(phone).length === 1 &&
          current(phone)[0].textContent === 'Tracker',
        phone.map((b) => b.textContent).join('|'),
      );
      const radios = [
        ...d0.querySelectorAll('.fb-dialog fieldset.fb-kinds input[type="radio"][name="fb-kind"]'),
      ];
      check(
        'F1 the feedback "kind" choice is three real radio buttons, each with a label, one checked',
        radios.length === 3 &&
          radios.every(
            (r) => r.closest('label') && r.closest('label').textContent.trim().length > 0,
          ) &&
          radios.filter((r) => r.checked).length === 1 &&
          d0.querySelector('.fb-dialog fieldset legend')?.textContent === 'What is this about?' &&
          !d0.querySelector('.fb-dialog [role="radio"]'),
      );
      const bug = radios.find((r) => r.value === 'bug');
      if (bug) {
        bug.click();
        await sleep(100);
      }
      check(
        'F2 choosing a radio changes the form (title becomes "Report a problem"), and the privacy text links to the privacy page',
        d0.querySelector('#fb-title')?.textContent === 'Report a problem' &&
          !!d0.querySelector('.fb-foot a[href="/privacy/"]'),
      );
    }
    check('A2 flight number box starts empty', val(a, 'input[aria-label="Flight number"]') === '');
    check(
      'A3 shows the empty-state prompt, no flight preloaded',
      t0.includes('Enter a flight number above.') && !a.w.document.querySelector('.flight-card'),
    );
    await search(a, 'BA59');
    await sleep(1500);
    const t = a.text(),
      d = a.w.document;
    const found = !!d.querySelector('.flight-card') && t.includes('BA59'),
      none = t.includes('No flights found');
    check('B1 searching a flight gives a flight card', found, t.slice(300, 500));
    if (found) {
      check(
        'B2 direction is stated (outbound/inbound/domestic/international)',
        !!d.querySelector('.direction') &&
          /Leaving|Arriving|Domestic|International|Probably/.test(
            d.querySelector('.direction').textContent,
          ),
        d.querySelector('.direction')?.textContent,
      );
      const rows = [...d.querySelectorAll('.timeline-row')].map((r) => ({
        label: r.querySelector('strong').textContent,
        kind: r.querySelector('small').textContent,
        time: r.lastElementChild.textContent,
      }));
      check(
        'B3 the journey runs in order: check-in, boarding, leaves the gate, take-off, landing, reaches the gate, bags',
        rows.length === 7 &&
          rows.map((r) => r.label).join() ===
            'Check-in,Boarding,Leaves the gate,Take-off,Landing,Reaches the gate,Bags on the belt',
        JSON.stringify(rows),
      );
      check(
        'B4 timeline never claims "Actual" without a time, and every time has a kind',
        rows.every((r) => (r.kind !== 'Actual' || r.time !== '—') && r.kind.length > 0),
        JSON.stringify(rows),
      );
      check(
        'B5 a step with no time shows a dash, not "Not available"',
        rows.every((r) => r.time === '—' || /\d\d:\d\d/.test(r.time)),
        JSON.stringify(rows),
      );
      [...d.querySelectorAll('.fv-tablist button')]
        .find((b) => b.textContent === 'Updates')
        .dispatchEvent(new a.w.MouseEvent('click', { bubbles: true }));
      await sleep(300);
      check(
        'B6 provider attribution is shown (Updates tab)',
        /Schedule data from AeroDataBox|Live aircraft positions from The OpenSky Network/.test(
          a.text(),
        ),
      );
    }
    const tabClick = async (name) => {
      [...d.querySelectorAll('.fv-tablist button')]
        .find((b) => b.textContent === name)
        .dispatchEvent(new a.w.MouseEvent('click', { bubbles: true }));
      await sleep(300);
    };
    check(
      'B9 once a flight shows there is still exactly one h1 (hidden), and the search stays visible',
      d.querySelectorAll('h1').length === 1 &&
        !!d.querySelector('input[aria-label="Flight number"]'),
    );
    await tabClick('Airport');
    check(
      'B10 Airport tab shows the terminal and the baggage belt',
      /Departure terminal5/.test(a.text()) && /Baggage belt2/.test(a.text()),
      a.text().slice(0, 300),
    );
    await tabClick('Weather');
    check(
      'B11 Weather tab shows the destination weather in plain words',
      /Cape Town/.test(a.text()) && /15°C/.test(a.text()) && /Partly cloudy/.test(a.text()),
    );
    {
      // flight detail tabs: five tabs, roving tabindex, arrow/Home/End keys, focusable panel
      const tabs = () => [...d.querySelectorAll('.fv-tablist [role="tab"]')];
      const sel = () => tabs().find((b) => b.getAttribute('aria-selected') === 'true');
      const key = async (k) => {
        sel().dispatchEvent(
          new a.w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
        );
        await sleep(150);
      };
      const roving = () =>
        tabs().filter((b) => b.getAttribute('tabindex') === '0').length === 1 &&
        tabs().filter((b) => b.getAttribute('tabindex') === '-1').length === 4 &&
        sel().getAttribute('tabindex') === '0';
      check(
        'T1 the flight details have five tabs with short labels and a roving tabindex',
        tabs()
          .map((b) => b.textContent)
          .join('|') === 'Journey|Airport|Weather|Updates|Destination' &&
          roving() &&
          sel().textContent === 'Weather',
        tabs()
          .map((b) => `${b.textContent}:${b.getAttribute('tabindex')}`)
          .join(' '),
      );
      await key('ArrowRight');
      const afterRight = sel()?.textContent,
        focusRight = d.activeElement === sel();
      await key('End');
      const afterEnd = sel()?.textContent;
      await key('Home');
      const afterHome = sel()?.textContent;
      await key('ArrowLeft');
      check(
        'T2 Right, End, Home and Left (wrapping) move the selection and the focus, keeping one tab in the Tab order',
        afterRight === 'Updates' &&
          focusRight &&
          afterEnd === 'Destination' &&
          afterHome === 'Journey' &&
          sel()?.textContent === 'Destination' &&
          d.activeElement === sel() &&
          roving(),
        [afterRight, focusRight, afterEnd, afterHome, sel()?.textContent].join(','),
      );
      check(
        'T3 the tab panel can take focus and is labelled by the selected tab',
        d.querySelector('#fv-panel')?.getAttribute('tabindex') === '0' &&
          d.querySelector('#fv-panel')?.getAttribute('aria-labelledby') === sel()?.id,
      );
    }
    check(
      'B12 the in-app footer has the shared link groups (siteNav.ts), app screens as in-app links, and no cookie settings',
      (() => {
        const cols = [...d.querySelectorAll('footer.sf .sf-col')];
        const want = FOOTER_GROUPS.map((g) => g.links.map((l) => l.appHref || l.href));
        return (
          cols.length === FOOTER_GROUPS.length &&
          cols.every(
            (c, i) =>
              JSON.stringify([...c.querySelectorAll('a')].map((a) => a.getAttribute('href'))) ===
              JSON.stringify(want[i]),
          ) &&
          !d.querySelector('[data-fd-cookie-settings]') &&
          [...d.querySelectorAll('footer.sf a')].some(
            (x) => x.getAttribute('href') === '#/checklist',
          )
        );
      })(),
    );
    check(
      'B13 a countdown is shown from the reported times',
      /Leaves in|Was due to leave/.test(a.text()),
      a.text().slice(0, 200),
    );
    check(
      'B14 the address becomes a shareable flight link',
      /^#\/flight\/BA59\/\d{4}-\d{2}-\d{2}$/.test(a.w.location.hash),
      a.w.location.hash,
    );
    check(
      'B15 Share and Add to calendar are offered when the times are known',
      [...d.querySelectorAll('.fv-bar button')].some((b) => b.textContent.trim() === 'Share') &&
        [...d.querySelectorAll('.fv-bar button')].some(
          (b) => b.textContent.trim() === 'Add to calendar',
        ),
    );
    // offline: the network fails, so the last copy is shown and clearly marked as such
    Object.defineProperty(a.w.navigator, 'onLine', { get: () => false, configurable: true });
    const realFetch = a.w.fetch;
    a.w.fetch = async (input, init) => {
      if (String(input).includes('/api/flights')) throw new TypeError('Failed to fetch');
      return realFetch(input, init);
    };
    await search(a, 'BA59');
    await sleep(800);
    check(
      'B16 offline: the last result stays readable and says when it was fetched',
      !!d.querySelector('.flight-card') &&
        /You're offline\. This is what Flightdeck last fetched at/.test(a.text()),
      a.text().slice(0, 300),
    );
    // the service worker's own failure text must never reach the page: a flight with no saved copy gets a plain sentence
    Object.defineProperty(a.w.navigator, 'onLine', { get: () => true, configurable: true });
    a.w.fetch = async (input, init) => {
      if (String(input).includes('/api/flights'))
        throw new TypeError(
          'FetchEvent.respondWith received an error: no-response: no-response :: [{"url":"https://local.flightdeck.gakinz.com/api/flights","error":{}}]',
        );
      return realFetch(input, init);
    };
    await search(a, 'LH400');
    await sleep(800);
    check(
      'B16b a failed request reads as a plain sentence, not the service worker text',
      /Flightdeck could not be reached/.test(a.text()) && !/FetchEvent|no-response/.test(a.text()),
      a.text().slice(0, 300),
    );
    a.w.fetch = realFetch;
    Object.defineProperty(a.w.navigator, 'onLine', { get: () => true, configurable: true });
    check('B7 no runtime errors', a.errors.length === 0, a.errors.join(' | '));
    a.w.close();
    // Usual-route fallback: a date far beyond the schedule window still says what the flight normally flies
    const far = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
    const f = await boot({ fixtures: true });
    await sleep(1500);
    f.w.document.querySelector('input[aria-label="Departure date"]');
    Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(
      f.w.document.querySelector('input[aria-label="Departure date"]'),
      far,
    );
    f.w.document
      .querySelector('input[aria-label="Departure date"]')
      .dispatchEvent(new f.w.Event('input', { bubbles: true }));
    await search(f, 'BA59');
    await sleep(1500);
    const tf = f.text();
    check(
      'B8 far-future date: usual route + outbound shown, no invented times',
      tf.includes('LHR') &&
        tf.includes('CPT') &&
        /Leaving London/.test(tf) &&
        tf.includes('not published yet'),
      tf.slice(300, 700),
    );
    f.w.close();
    const link = await boot({
      fixtures: true,
      hash: '#/flight/BA59/' + new Date().toISOString().slice(0, 10),
    });
    await sleep(1800);
    check(
      'B17 opening a flight link shows that flight without searching',
      !!link.w.document.querySelector('.flight-card') && link.text().includes('BA59'),
      link.text().slice(0, 200),
    );
    link.w.close();
    const ukToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const sv = await boot({
      fixtures: true,
      hash: '#/saved',
      storage: {
        'flightdeck-saved': JSON.stringify([
          { number: 'BA59', date: ukToday },
          { number: 'LH400', date: '2026-01-02' },
        ]),
      },
    });
    await sleep(1500);
    check(
      'B18 saved flights say Today for the UK date and mark old ones as past',
      sv.text().includes('Today') &&
        [...sv.w.document.querySelectorAll('.saved-row .pill')].some(
          (p) => p.textContent === 'Past',
        ),
      sv.text().slice(0, 300),
    );
    check(
      'N4 on the saved flights page that menu item is the current page',
      sv.w.document
        .querySelector('.sidebar nav [aria-current="page"]')
        ?.getAttribute('aria-label') === 'Saved flights (2)' &&
        sv.w.document.querySelector('nav.mobile-nav [aria-current="page"]')?.textContent ===
          'Saved 2',
    );
    const ib = [...sv.w.document.querySelectorAll('button')].find((b) =>
      b.textContent.includes('Install app'),
    );
    ib.dispatchEvent(new sv.w.MouseEvent('click', { bubbles: true }));
    await sleep(300);
    check(
      'B19 Install app without a browser prompt opens written help instead of a pop-up',
      sv.text().includes('Install Flightdeck') && sv.text().includes('Add to Home Screen'),
    );
    sv.w.document.querySelector('button[aria-label="Remove LH400"]').click();
    await sleep(150);
    check(
      'B20 removing a saved card updates the collection and browser storage',
      sv.w.document.querySelectorAll('.saved-flight').length === 1 &&
        JSON.parse(sv.w.localStorage.getItem('flightdeck-saved')).length === 1,
    );
    sv.w.document.querySelector('.saved-open').click();
    await sleep(800);
    check(
      'B21 opening a saved card fetches and displays the flight',
      !!sv.w.document.querySelector('.flight-card') && sv.text().includes('BA59'),
    );
    sv.w.close();
    const pack = await boot({
      fixtures: true,
      hash: '#/saved',
      storage: { 'flightdeck-saved': JSON.stringify([{ number: 'BA59', date: ukToday }]) },
    });
    await sleep(300);
    pack.w.document.querySelector('button[aria-label="Make a packing list for BA59"]').click();
    await sleep(800);
    check(
      'B22 a saved card creates a linked packing list',
      !!pack.w.document.querySelector('.ck-top') &&
        pack.text().includes('Check this flight') &&
        pack.w.document.querySelectorAll('h1').length === 1,
    );
    pack.w.close();
  }
  if (LIVE && cfg.liveAvailable) {
    // optional: the same journey against the real providers. Run with UI_TEST_LIVE=1; it spends a few provider units.
    const l = await boot();
    await sleep(2500);
    await search(l, FLIGHT);
    await sleep(7500);
    check(
      `L1 live: ${FLIGHT} gives a flight card or an honest "not found"`,
      !!l.w.document.querySelector('.flight-card') || l.text().includes('No flights found'),
      l.text().slice(300, 500),
    );
    l.w.close();
  }

  // ---- Travel checklist (no Clerk, so it runs as a guest with the list on this device) ----
  {
    const click = (w, el) =>
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    const setVal = (w, el, v) => {
      Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
    };
    const byText = (d, sel, t) =>
      [...d.querySelectorAll(sel)].find((e) => {
        const x = (
          e.querySelector && e.querySelector('.ck-sec-title')
            ? e.querySelector('.ck-sec-title').textContent
            : e.textContent
        ).trim();
        return x === t || x.startsWith(t);
      });
    const k = await boot({ hash: '#/checklist' });
    await sleep(1500);
    const d = k.w.document;
    check(
      'K1 checklist route shows the first-time screen, not the flight search',
      k.text().includes('Pack once. Reuse it every trip.') && !d.querySelector('.search-card'),
    );
    setVal(k.w, d.querySelector('.ck-start input'), 'Cape Town in October');
    d.querySelector('.ck-start').dispatchEvent(
      new k.w.Event('submit', { bubbles: true, cancelable: true }),
    );
    await sleep(600);
    check(
      'K2 starting makes a trip with all 8 sections and 141 items unticked, one section open at a time',
      d.querySelectorAll('.ck-panels .ck-sec').length === 8 &&
        d.querySelectorAll('.ck-check').length === 141 &&
        k.text().includes('0 of 141 packed') &&
        d.querySelectorAll('.ck-panels .ck-sec:not([hidden])').length === 1,
      k.text().slice(300, 600),
    );
    check(
      'K2b trips are plain buttons with aria-pressed (no tabs without a tab panel)',
      !d.querySelector('.ck-tabs[role="tablist"], .ck-tab[role="tab"]') &&
        d.querySelector('.ck-tabs .ck-tab')?.getAttribute('aria-pressed') === 'true' &&
        d.querySelector('.sidebar nav [aria-current="page"]')?.getAttribute('aria-label') ===
          'Packing list',
    );
    check(
      'K3 sections run in trip order, ending with the night before and last minute',
      [...d.querySelectorAll('.ck-rail-title')].map((e) => e.textContent).join('|') ===
        'Days in advance|Clothes and accessories|Bathroom bag|Accessories|Papers and documents|Mostly work related|The night before|Last minute',
    );
    const passport = byText(d, '.ck-check', 'Passport');
    click(k.w, passport.querySelector('input'));
    await sleep(400);
    check(
      'K4 ticking Passport updates the count and keeps it on the device',
      k.text().includes('1 of 141 packed') &&
        Object.values(
          JSON.parse(k.w.localStorage.getItem('flightdeck-checklist')).trips[0].marks,
        ).filter((v) => v > 0).length === 1,
    );
    const saved = k.w.localStorage.getItem('flightdeck-checklist');
    const k2 = await boot({ hash: '#/checklist', storage: { 'flightdeck-checklist': saved } });
    await sleep(1500);
    const d2 = k2.w.document;
    check(
      'K5 after a reload the trip, its name and the tick are still there',
      k2.text().includes('1 of 141 packed') &&
        d2.querySelector('.ck-name').value === 'Cape Town in October' &&
        byText(d2, '.ck-check', 'Passport').querySelector('input').checked,
    );
    byText(d2, '.ck-sec', 'Last minute')
      .querySelector('.ck-sec-foot .text-button')
      .dispatchEvent(new k2.w.MouseEvent('click', { bubbles: true }));
    await sleep(300);
    setVal(k2.w, d2.querySelector('.ck-add input'), 'Travel pillow');
    d2.querySelector('.ck-add').dispatchEvent(
      new k2.w.Event('submit', { bubbles: true, cancelable: true }),
    );
    await sleep(400);
    check(
      'K6 adding your own item puts it in that section and the total grows',
      !!byText(d2, '.ck-check', 'Travel pillow') && k2.text().includes('1 of 142 packed'),
    );
    click(k2.w, byText(d2, 'button', 'Edit list'));
    await sleep(300);
    const x = d2.querySelector('button[aria-label="Hide Watch"]');
    click(k2.w, x);
    await sleep(300);
    check(
      'K7 hiding an item removes it from the total, and Restore all brings it back',
      k2.text().includes('of 141 packed') && k2.text().includes('1 item hidden'),
    );
    click(k2.w, byText(d2, 'button', 'Restore all'));
    await sleep(300);
    check(
      'K8 restore works',
      k2.text().includes('of 142 packed') && !k2.text().includes('item hidden'),
    );
    click(k2.w, byText(d2, 'button', 'Done editing'));
    await sleep(200);
    click(k2.w, byText(d2, 'button', 'Reset ticks'));
    await sleep(200);
    check(
      'K9 reset asks first, then unticks everything for the next trip',
      k2.text().includes('Yes, untick everything'),
    );
    click(k2.w, byText(d2, 'button', 'Yes, untick everything'));
    await sleep(300);
    check(
      'K10 after reset nothing is ticked but the list and the added item remain',
      k2.text().includes('0 of 142 packed') && !!byText(d2, '.ck-check', 'Travel pillow'),
    );
    click(k2.w, byText(d2, 'button', 'Still to pack'));
    await sleep(300);
    check(
      'K11 "Still to pack" filter keeps the list visible and no runtime errors occurred',
      d2.querySelectorAll('.ck-check').length === 142 &&
        k.errors.length === 0 &&
        k2.errors.length === 0,
      k.errors.concat(k2.errors).join(' | '),
    );
    k.w.close();
    k2.w.close();
    const tampered = await boot({
      hash: '#/checklist',
      storage: { 'flightdeck-checklist': '{"trips":"nope","tpl":7,"rev":"x"}' },
    });
    await sleep(1200);
    check(
      'K12 a corrupted saved list never crashes the page',
      tampered.text().includes('Pack once. Reuse it every trip.') && tampered.errors.length === 0,
    );
    tampered.w.close();
  }
  const c = await boot({ config: { liveAvailable: false, provider: 'x' } });
  await sleep(2000);
  check(
    'C1 no live providers: says so plainly',
    c.text().includes('not configured on this server'),
  );
  c.w.close();
} finally {
  stop();
}
console.log(failed ? `\n${failed} FAILED` : '\nAll UI smoke checks passed');
process.exit(failed ? 1 : 0);
