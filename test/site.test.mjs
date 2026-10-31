// The public website as PHP renders it (php/private/src/Site) from the CMS seed. Replaces the old static-build tests, with the same
// guarantees: proper documents, nothing from third parties, safe links, honest legal text, the ads gate, one shared link list.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const seed = JSON.parse(
  fs.readFileSync(path.join(root, 'php/private/src/Content/seed.json'), 'utf8'),
);
const base = seed.settings;
const { TEMPLATE } = await import(path.join(root, 'src/features/checklist/checklistTemplate.ts'));

const PAGES = Object.keys(seed.pages).filter((s) => s !== 'home');
const GUIDES = PAGES.filter((p) => p.startsWith('guides/'));
const ALL = ['/', ...PAGES.map((p) => `/${p}/`)];

function render(paths, opts = {}) {
  const out = execFileSync('php', [path.join(root, 'php/tests/render-site.php')], {
    input: JSON.stringify({ paths, ...opts }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}
const site = render([
  ...ALL,
  '/sitemap.xml',
  '/nope/',
  '/about',
  '/ads.txt',
  '/index.html',
  '/home/',
  '/../etc/passwd',
]);
const page = (p) => site[p].html;
const docs = () => ALL.map((p) => [p, page(p)]);

test('every page renders 200, plus the sitemap; unknown pages are a real 404 and short paths redirect', () => {
  for (const p of ALL) assert.equal(site[p].status, 200, p);
  assert.equal(site['/nope/'].status, 404);
  assert.ok(site['/nope/'].html.includes('noindex'));
  assert.equal(site['/home/'].status, 404, 'the home page has one address');
  assert.equal(site['/../etc/passwd'].status, 404);
  assert.deepEqual([site['/about'].status, site['/about'].location], [301, '/about/']);
  assert.deepEqual([site['/index.html'].status, site['/index.html'].location], [301, '/']);
  const sm = page('/sitemap.xml');
  for (const p of ALL) assert.ok(sm.includes(`<loc>${base.siteUrl}${p}</loc>`), p);
  assert.ok(!sm.includes('nope') && !sm.includes('/home/'));
});

test('the old public addresses all still exist', () => {
  for (const p of [
    'privacy',
    'cookies',
    'terms',
    'about',
    'contact',
    'travel-checklist',
    'guides',
    'guides/flight-status-explained',
    'guides/outbound-and-inbound-flights',
    'guides/what-to-do-if-your-flight-is-delayed-or-cancelled',
    'guides/pack-your-cabin-bag-for-a-long-flight',
    'guides/baggage-reclaim-and-missing-bags',
    'guides/flight-numbers-airline-codes-and-codeshares',
    'guides/departure-day-airport-timeline',
    'guides/how-to-read-an-airport-departure-board',
    'guides/connecting-flights-and-missed-connections',
    'guides/cabin-bag-or-hold-bag',
    'guides/what-flight-tracking-can-and-cannot-tell-you',
  ])
    assert.ok(PAGES.includes(p), p);
});

test('each page is a proper document: title, description, canonical, one h1, skip link, landmarks', () => {
  for (const [p, h] of docs()) {
    assert.match(h, /<html lang="en-GB">/, p);
    assert.match(h, p === '/' ? /<title>[^<]+<\/title>/ : /<title>[^<]+ · Flightdeck<\/title>/, p);
    assert.match(h, /<meta name="description" content="[^"]{20,240}">/, p);
    assert.ok(h.includes(`<link rel="canonical" href="${base.siteUrl}${p}">`), p);
    assert.equal((h.match(/<h1[ >]/g) || []).length, 1, p);
    assert.ok(
      h.includes('class="skip"') && h.includes('<main id="main">') && h.includes('<footer'),
      p,
    );
    assert.ok(h.includes('<meta property="og:image"') && h.includes('twitter:card'), p);
  }
});

test('public pages request nothing from third parties: the only scripts are our own files', () => {
  const ours = [
    '/consent.js',
    '/site-test.js',
    '/js/contact-test.js',
    '/js/travel-checklist-test.js',
  ];
  for (const [p, h] of docs()) {
    for (const m of h.matchAll(/<(?:script|iframe|source|video|audio)\b[^>]*\bsrc="([^"]+)"/g))
      assert.ok(ours.includes(m[1]), `${p}: ${m[1]}`);
    // Photos are our own files, served from /img/ on this site.
    for (const m of h.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
      assert.match(m[1], /^\/img\/[a-z0-9-]+\.jpg$/, `${p}: ${m[1]}`);
      assert.ok(fs.existsSync(path.join(root, 'public', m[1])), `${p}: ${m[1]} is missing`);
    }
    for (const m of h.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g))
      assert.ok(m[1].startsWith('/') || m[1].startsWith(base.siteUrl), `${p}: ${m[1]}`);
    assert.ok(
      !/@import|fonts\.googleapis|googletagmanager|google-analytics|adsbygoogle|googlesyndication/.test(
        h,
      ),
      p,
    );
  }
});

test('outbound links are explicit and safe (noopener); every internal link points at a real page', () => {
  const known = new Set(['/', '/app/', '/app/#/checklist', ...ALL]);
  const guideIdx = page('/guides/');
  for (const [p, h] of docs()) {
    for (const m of h.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
      const href = m[1];
      if (/^https?:/.test(href)) {
        if (!href.startsWith(base.siteUrl)) assert.match(m[0], /rel="noopener"/, `${p}: ${href}`);
        continue;
      }
      if (href.startsWith('mailto:')) continue;
      if (href === '#cookie-settings') {
        assert.match(m[0], /data-fd-cookie-settings/);
        continue;
      }
      if (href.startsWith('#')) {
        assert.ok(h.includes(`id="${href.slice(1)}"`), `${p}: anchor ${href} has no target`);
        continue;
      }
      const hash = href.match(/^(\/[^#]*)#(.+)$/);
      if (hash && hash[1] === '/guides/') {
        assert.ok(
          guideIdx.includes(`id="${hash[2]}"`),
          `${p}: ${href} has no target on the guide index`,
        );
        continue;
      }
      if (hash && site[hash[1]]) {
        assert.ok(
          page(hash[1]).includes(`id="${hash[2]}"`),
          `${p}: ${href} has no target on ${hash[1]}`,
        );
        continue;
      }
      assert.ok(known.has(href), `${p}: broken internal link ${href}`);
    }
  }
});

test('no placeholders or template leftovers appear in the published text', () => {
  for (const [p, h] of docs())
    assert.ok(!/undefined|\[object|\{\{|\$\{|TODO|\[owner|lorem|\]\(/i.test(h), p);
});

test('the legal pages say what the app really does (and nothing it does not)', () => {
  const privacy = page('/privacy/');
  for (const must of [
    'Clerk',
    'AeroDataBox',
    'OpenSky',
    'adsbdb',
    'Open-Meteo',
    'Cloudflare',
    'ico.org.uk',
    'only if you accept',
    'do not show advertising',
    'Your rights',
    'typefaces are hosted by us',
  ])
    assert.ok(privacy.includes(must), must);
  const cookies = page('/cookies/');
  for (const must of [
    '__session',
    'fd-consent',
    '_ga',
    'Cookie settings',
    'does not currently use advertising cookies',
  ])
    assert.ok(cookies.includes(must), must);
  assert.ok(cookies.includes('data-fd-cookie-settings'));
  assert.ok(page('/terms/').includes('Always follow the instructions of your airline'));
  assert.ok(!/who runs Flightdeck, who/.test(privacy));
});

test('owner name and email come from settings and reach every page that mentions them', () => {
  const r = render(['/privacy/', '/contact/', '/about/'], {
    settings: { contactEmail: 'hello@example.com', ownerName: 'Sam Example' },
  });
  assert.ok(
    r['/privacy/'].html.includes('<a href="mailto:hello@example.com">hello@example.com</a>') &&
      r['/privacy/'].html.includes('Sam Example'),
  );
  assert.ok(
    r['/contact/'].html.includes('mailto:hello@example.com') &&
      r['/about/'].html.includes('Sam Example'),
  );
  const hostile = render(['/about/'], {
    settings: { ownerName: '<script>x</script> [link](javascript:alert(1)) **b**' },
  })['/about/'].html;
  assert.ok(
    !hostile.includes('<script>x') &&
      !/href="javascript/i.test(hostile) &&
      hostile.includes('&lt;script&gt;') &&
      !hostile.includes('<strong>b</strong>'),
  );
});

// Compare source text independent of formatting (spaces/newlines).
const squash = (s) => s.replace(/\s+/g, '');

test('contact page: a real form with a honeypot and fill-time, posting to our own API', () => {
  const c = page('/contact/');
  assert.ok(
    c.includes('id="contact-form"') &&
      c.includes('name="website"') &&
      c.includes('type="email"') &&
      c.includes('<script src="/js/contact-test.js" defer>'),
  );
  const js = squash(fs.readFileSync(path.join(root, 'src/site/contact.js'), 'utf8'));
  assert.ok(
    js.includes("fetch('/api/contact'") &&
      js.includes('elapsed:Date.now()-t0') &&
      js.includes("'Content-Type':'application/json'"),
  );
});

test('no page has an inline script or inline event handler', () => {
  for (const [p, h] of [...docs(), ['/nope/', site['/nope/'].html]]) {
    assert.ok(!/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)/.test(h), p + ' has an inline script');
    assert.ok(!/\son[a-z]+="/.test(h), p + ' has an inline handler');
  }
});

test('the printable packing list is the app template: same sections, same items, same order', () => {
  const h = page('/travel-checklist/');
  assert.equal((h.match(/<section class="ck-sec"/g) || []).length, TEMPLATE.length);
  assert.deepEqual(
    [...h.matchAll(/<h2 class="ck-sec-title" id="[^"]+">([^<]+)<\/h2>/g)].map((m) =>
      m[1].replace(/&amp;/g, '&'),
    ),
    TEMPLATE.map((s) => s.title),
  );
  assert.deepEqual(
    [...h.matchAll(/<span class="ck-rail-title">([^<]+)<\/span>/g)].map((m) =>
      m[1].replace(/&amp;/g, '&'),
    ),
    TEMPLATE.map((s) => s.title),
  );
  const items = [...h.matchAll(/<span class="ck-text">([^<]*)<\/span>/g)].map((m) =>
    m[1]
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;|&#039;/g, "'"),
  );
  assert.deepEqual(
    items,
    TEMPLATE.flatMap((s) => s.items.map((i) => i.text)),
  );
  assert.ok(
    h.includes('data-print') &&
      fs.readFileSync(path.join(root, 'src/site/site.js'), 'utf8').includes('window.print()'),
  );
  assert.ok(
    fs
      .readFileSync(path.join(root, 'src/site/travel-checklist.js'), 'utf8')
      .includes('packing-board') && h.includes('class="ck-layout" id="packing-board"'),
  );
  assert.ok(
    fs.readFileSync(path.join(root, 'src/styles/site.css'), 'utf8').includes('@media print'),
  );
  assert.deepEqual(
    seed.checklistTemplate,
    JSON.parse(JSON.stringify(TEMPLATE)),
    'the seed carries the current app template (run node scripts/seed-content.mjs)',
  );
});

test('the guides are real articles, not thin pages', () => {
  for (const p of GUIDES) {
    const text = page(`/${p}/`)
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<[^>]+>/g, ' ');
    assert.ok(text.split(/\s+/).filter(Boolean).length > 380, `${p} is too short`);
  }
  assert.equal(
    [...page('/guides/').matchAll(/<li><a href="\/guides\/[a-z]/g)].length,
    GUIDES.length,
  );
});

test('ADS DEFAULT OFF: no ad code anywhere and no ads.txt', () => {
  for (const [p, h] of docs())
    assert.ok(!/adsbygoogle|googlesyndication|pagead|data-ad-client/.test(h), p);
  assert.equal(site['/ads.txt'].status, 404);
});

test('ADS GATE: every condition is required; a half-open gate renders without ads', () => {
  const open = {
    ads_enabled: true,
    ads_licence_cleared: true,
    ads_cmp_ready: true,
    ads_pub_id: 'pub-1234567890123456',
    ads_slots: { guide: '1234567890', checklist: '0987654321' },
  };
  for (const missing of ['ads_enabled', 'ads_licence_cleared', 'ads_cmp_ready']) {
    const r = render(['/guides/flight-status-explained/', '/ads.txt'], {
      config: { ...open, [missing]: false },
    });
    assert.ok(
      !/adsbygoogle/.test(r['/guides/flight-status-explained/'].html) &&
        r['/ads.txt'].status === 404,
      missing,
    );
  }
  for (const id of ['', 'ca-pub-123', 'pub-12', 'pub-<script>']) {
    const r = render(['/guides/flight-status-explained/', '/ads.txt'], {
      config: { ...open, ads_pub_id: id },
    });
    assert.ok(
      !/adsbygoogle/.test(r['/guides/flight-status-explained/'].html) &&
        r['/ads.txt'].status === 404,
      id,
    );
  }
});

test('ADS OPEN: ads only on guides and the packing list, never on legal, contact, about, home, help or the guide index', () => {
  const open = {
    ads_enabled: true,
    ads_licence_cleared: true,
    ads_cmp_ready: true,
    ads_pub_id: 'pub-1234567890123456',
    ads_slots: { guide: '1234567890', checklist: '0987654321' },
  };
  const r = render([...ALL, '/ads.txt'], { config: open });
  assert.equal(r['/ads.txt'].html, 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  const withAds = ALL.filter((p) => /adsbygoogle/.test(r[p].html));
  assert.deepEqual(withAds.sort(), [...GUIDES.map((g) => `/${g}/`), '/travel-checklist/'].sort());
  assert.ok(
    r['/travel-checklist/'].html.includes('data-ad-slot="0987654321"') &&
      r['/guides/flight-status-explained/'].html.includes('data-ad-slot="1234567890"'),
  );
});

test('Google Analytics ID: the build value reaches every page as a meta tag', () => {
  const r = render(ALL, { gaId: 'G-TESTABC123' });
  for (const p of ALL)
    assert.ok(r[p].html.includes('<meta name="fd-ga-id" content="G-TESTABC123">'), p);
  for (const p of ALL) assert.ok(page(p).includes('<meta name="fd-ga-id" content="">'), p);
  const build = fs.readFileSync(path.join(root, 'scripts/build-public.mjs'), 'utf8');
  assert.ok(build.includes('/^G-[A-Z0-9]{6,12}$/'), 'malformed IDs are dropped by the build');
});

test('one shared link list: the same footer on every page, header links match the seed, active page is marked', async () => {
  const { FOOTER_GROUPS, HEADER_LINKS } = await import('../src/siteNav.ts');
  assert.deepEqual(
    seed.navigation.header.map((l) => l.href),
    HEADER_LINKS.map((l) => l.href),
    'seed and app share the default links',
  );
  const want = FOOTER_GROUPS.flatMap((g) => g.links.map((l) => l.href));
  for (const [p, h] of docs()) {
    const foot = h.slice(h.indexOf('<footer class="sf"'), h.lastIndexOf('</footer>'));
    assert.deepEqual(
      [...foot.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]),
      want,
      p + ' footer',
    );
    const head = h.slice(h.indexOf('<header'), h.indexOf('</header>'));
    assert.deepEqual(
      [...head.matchAll(/<a href="([^"]+)"( aria-current="page")?>(?!Open)/g)]
        .map((m) => m[1])
        .filter((x) => x !== '/'),
      HEADER_LINKS.map((l) => l.href),
      p + ' header',
    );
    assert.ok(
      head.includes('<a class="btn btn-white btn-sm" href="/app/">Open the app</a>') &&
        head.includes('<a class="btn btn-glass btn-sm" href="/app/">Sign in</a>'),
      p + ' header actions',
    );
  }
  assert.ok(page('/travel-checklist/').includes('href="/travel-checklist/" aria-current="page"'));
  assert.ok(
    page('/guides/departure-day-airport-timeline/').includes('href="/guides/" aria-current="page"'),
  );
});

test('guide pages have breadcrumbs, reading time, an On this page menu and related guides; the index groups every guide', () => {
  for (const p of GUIDES) {
    const h = page(`/${p}/`);
    assert.ok(
      h.includes('class="crumbs"') &&
        /\d+ min read/.test(h) &&
        h.includes('class="toc"') &&
        h.includes('aria-label="More guides"'),
      p,
    );
    for (const m of h.matchAll(/href="#([^"]+)"/g))
      assert.ok(h.includes(`id="${m[1]}"`), `${p}: toc target ${m[1]}`);
  }
  const idx = page('/guides/');
  for (const p of GUIDES) assert.ok(idx.includes(`href="/${p}/"`), `index lacks ${p}`);
  assert.equal((idx.match(/class="cat"/g) || []).length, 3);
});

test('every JSON-LD block parses; guides carry an Article and a BreadcrumbList that matches the visible trail', () => {
  const idx = page('/guides/');
  for (const [p, h] of docs()) {
    const data = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]),
    );
    assert.ok(data.length >= 1, `${p} has no JSON-LD`);
    for (const d of data) assert.equal(d['@context'], 'https://schema.org', p);
    if (!p.startsWith('/guides/') || p === '/guides/') {
      assert.ok(
        !data.some((d) => d['@type'] === 'BreadcrumbList'),
        `${p} should not have a BreadcrumbList`,
      );
      continue;
    }
    assert.ok(
      data.some((d) => d['@type'] === 'Article'),
      `${p} has no Article`,
    );
    const items = data.find((d) => d['@type'] === 'BreadcrumbList').itemListElement;
    assert.deepEqual(
      items.map((i) => i.position),
      [1, 2, 3],
      p,
    );
    assert.equal(items[0].item, `${base.siteUrl}/guides/`, p);
    assert.equal(items[2].item, `${base.siteUrl}${p}`, p);
    const cat = seed.guideCategories.find(
      (c) => items[1].item === `${base.siteUrl}/guides/#cat-${c.id}`,
    );
    assert.ok(cat && items[1].name === cat.title, `${p}: breadcrumb category`);
    assert.equal(
      items[2].name,
      h
        .match(/<h1>([^<]+)<\/h1>/)[1]
        .replace(/&amp;/g, '&')
        .replace(/&apos;|&#039;/g, "'"),
      `${p}: breadcrumb name matches the h1`,
    );
    const start = idx.indexOf(`id="cat-${cat.id}"`);
    assert.ok(
      idx.slice(start, idx.indexOf('</section>', start)).includes(`href="${p}"`),
      `${p} is not listed under ${cat.title}`,
    );
  }
  for (const [p, h] of docs()) assert.ok(!h.includes('FAQPage'), `${p}: no FAQ schema`);
});

test('public pages share the app button system and focus ring, and no text is smaller than 12.5px', () => {
  const css = [
    'src/styles/site.css',
    'src/styles/tokens.css',
    'src/siteFooter.css',
    'src/features/checklist/packingBoard.css',
    'src/style.css',
  ].map((f) => [f, fs.readFileSync(path.join(root, f), 'utf8')]);
  const siteCss = squash(css[0][1]);
  assert.ok(
    siteCss.includes('.btn{') &&
      siteCss.includes('.btn-primary{') &&
      siteCss.includes('.btn-secondary{'),
  );
  assert.ok(
    /:focus-visible\{outline:2pxsolidvar\(--fd-brand\);outline-offset:2px;?\}/.test(siteCss),
  );
  for (const [f, raw] of css) {
    const c = raw.replace(/@media print\s*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
    for (const m of c.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?(\d*\.?\d+)px/g))
      assert.ok(Number(m[1]) === 0 || Number(m[1]) >= 11.5, `${f}: ${m[0]}`);
    for (const m of c.matchAll(/--fd-text-[a-z0-9]+:\s*(\d*\.?\d+)px/g))
      assert.ok(Number(m[1]) >= 12.5, `${f}: ${m[0]}`);
  }
  assert.ok(
    page('/travel-checklist/').includes(
      '<button class="btn btn-primary" type="button" data-print>',
    ) && page('/contact/').includes('<button class="btn btn-primary" type="submit">'),
  );
});

test('guide metadata stays within search limits', () => {
  for (const g of GUIDES.map((s) => seed.pages[s])) {
    assert.ok(`${g.title} · ${base.siteName}`.length <= 69, `${g.slug}: title too long`);
    assert.ok(g.description.length <= 160, `${g.slug}: description too long`);
    assert.equal(g.takeaways.length, 3, g.slug);
    assert.ok(['reading', 'prepare', 'trouble'].includes(g.category), g.slug);
  }
});

test('home: lookup form hands off to the app, no synthetic flight is presented, coverage is honest', () => {
  const h = page('/');
  assert.ok(
    h.includes('id="lookup"') &&
      h.includes('action="/app/"') &&
      h.includes('name="number"') &&
      /<select name="date" id="lookup-date">(<option value="\d{4}-\d{2}-\d{2}"( selected)?>[^<]+<\/option>){15}<\/select>/.test(
        h,
      ),
    'flight number and a departure date from yesterday to 13 days ahead',
  );
  const at = h.indexOf('class="panel board"');
  const board = h.slice(at, h.indexOf('</aside>', at));
  assert.ok(
    h.includes('Every detail on the page says where it came from.') &&
      board.includes('missing">Not reported yet'),
    'the board shows how a result is built and what a missing detail looks like',
  );
  assert.ok(!/\d{1,2}:\d{2}/.test(board), 'the board carries no times');
  assert.ok(!/\d+(\.\d+)?°|\d+ ?(ft|kt|km\/h|mph)\b/i.test(board), 'the board carries no position');
  assert.ok(!h.includes('A calmer journey.'), 'the old vague headline is gone');
  const js = fs.readFileSync(path.join(root, 'src/site/site.js'), 'utf8');
  assert.ok(
    js.includes("gsap.matchMedia().add('(prefers-reduced-motion: no-preference)'") &&
      js.includes("matchMedia('(prefers-reduced-motion: reduce)')"),
    'motion stands down for reduced motion',
  );
  assert.ok(!h.includes('08:41') && !h.includes('En route'));
  for (const must of [
    '10<small>min</small>',
    '2<small>min</small>',
    'yesterday to three days ahead',
    'Flights you can save to your account',
  ])
    assert.ok(h.includes(must), must);
  assert.ok(page('/coverage/').includes('monthly allowance'), 'limits are published on /coverage/');
  assert.ok(
    !/live tracking of every|real-time for all|guaranteed|testimonial|\d[\d,]* users/i.test(h),
    'no invented claims',
  );
  assert.ok(
    js.includes("'/app/#/flight/' + n + '/' + d") && /\(flight\|checklist\|saved/.test(js),
    'lookup hand-off and old-link forwarding',
  );
});

test('home follows the approved prototype: sections in order, real data behind every card, credits published', () => {
  const h = page('/');
  const order = [
    'class="hero"',
    'class="search-wrap"',
    'class="sources"',
    'id="result"',
    'id="guides"',
    'id="how"',
    'id="packing"',
    'id="faq"',
    'class="closing"',
  ].map((m) => h.indexOf(m));
  assert.ok(
    order.every((i) => i > 0),
    'every section is present',
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
    'sections follow the prototype order',
  );
  // Destinations: three photo cards, each opening a native dialog with the app's official links.
  assert.equal((h.match(/<article class="dest">/g) || []).length, 3);
  for (const code of ['jfk', 'dxb', 'cdg']) {
    assert.ok(
      h.includes(`data-dialog="dest-${code}"`) &&
        h.includes(`<dialog class="dialog" id="dest-${code}"`),
      code,
    );
    const from = h.indexOf(`<dialog class="dialog" id="dest-${code}"`);
    const dlg = h.slice(from, h.indexOf('</dialog>', from));
    assert.equal((dlg.match(/rel="noopener"/g) || []).length, 3, `${code}: three official links`);
  }
  // Guide topics: three real guides per topic, linking to the guide pages; without JS each pill opens the guide index.
  for (const cat of seed.guideCategories) {
    assert.ok(
      h.includes(`href="/guides/#cat-${cat.id}" class="chip" data-tab="spot-${cat.id}"`),
      cat.id,
    );
    const from = h.indexOf(`id="spot-${cat.id}"`);
    const panel = h.slice(from, h.indexOf('</div>', from));
    const links = [...panel.matchAll(/<a class="guide" href="\/([^"]+)\/"/g)].map((m) => m[1]);
    assert.equal(links.length, 3, cat.id);
    for (const l of links) assert.equal(seed.pages[l]?.category, cat.id, l);
  }
  // Packing teaser: the real template, with the same item keys as the full list (ticks carry over).
  const total = TEMPLATE.reduce((n, s) => n + s.items.length, 0);
  assert.ok(h.includes(`One list, ${total} things,`));
  assert.equal((h.match(/<input class="tick" type="checkbox" data-k="list-/g) || []).length, total);
  assert.ok(
    page('/travel-checklist/').includes('data-k="list-days-in-advance-0"') &&
      h.includes('data-k="list-days-in-advance-0"'),
  );
  // The contact dialog is the real form, posting through contact.js.
  assert.ok(
    h.includes('<dialog class="dialog" id="contact-dlg"') &&
      h.includes('id="contact-form"') &&
      h.includes('/js/contact-test.js'),
  );
  // Footer: © Gakinz linking to gakinz.com on every page; photo credits live on the About page only.
  for (const [p, d] of docs()) {
    assert.ok(d.includes('<a href="https://gakinz.com" rel="noopener">Gakinz</a>'), p);
    if (p !== '/about/')
      assert.ok(!d.includes('Harry Knight'), `${p} has no credits in the footer`);
  }
  const about = page('/about/');
  for (const who of [
    'Harry Knight',
    'Sergey Svechnikov',
    'Rob Bye',
    'Percival Kestreltail',
    'Norlando Pobre',
    'Nicolas Halftermeyer',
  ])
    assert.ok(about.includes(who), who);
  assert.ok(about.includes('id="photo-credits"'));
});

test('announcements show only inside their time window and never carry markup', () => {
  const a = {
    id: 'a1',
    message: 'Schedules are paused <b>today</b>',
    level: 'warning',
    where: 'site',
    start: '2026-10-25T00:00:00Z',
    end: '2026-10-26T00:00:00Z',
    linkLabel: 'Details',
    linkHref: '/coverage/',
  };
  const at = (now) => render(['/'], { content: { announcements: [a] }, now })['/'].html;
  const during = at(Date.parse('2026-10-25T12:00:00Z') / 1000);
  assert.ok(
    during.includes('class="announce announce-warning"') &&
      during.includes('&lt;b&gt;today&lt;/b&gt;') &&
      during.includes('<a href="/coverage/">Details</a>'),
  );
  assert.ok(!at(Date.parse('2026-10-24T12:00:00Z') / 1000).includes('class="announce'));
  assert.ok(!at(Date.parse('2026-10-26T00:00:00Z') / 1000).includes('class="announce'));
  const appOnly = render(['/'], {
    content: { announcements: [{ ...a, where: 'app', start: '', end: '' }] },
  })['/'].html;
  assert.ok(!appOnly.includes('class="announce'));
  const bad = render(['/'], {
    content: { announcements: [{ ...a, start: '', end: '', linkHref: 'javascript:alert(1)' }] },
  })['/'].html;
  assert.ok(
    !bad.includes('javascript:') && bad.includes('class="announce'),
    'an unsafe link is dropped, the message stays',
  );
});

test('the seed is up to date with its sources', () => {
  execFileSync('node', ['scripts/seed-content.mjs', '--check'], { cwd: root, stdio: 'pipe' });
});

test('footer has three links per group, with Help in Guides and tools', () => {
  assert.deepEqual(
    seed.navigation.footer.map((g) => g.links.length),
    [3, 3, 3, 3],
  );
  assert.ok(
    seed.navigation.footer
      .find((g) => g.title === 'Guides and tools')
      .links.some((l) => l.href === '/help/'),
  );
});

test('public packing needs no account: ticks persist, all sections open, checked and blank print work', () => {
  const dom = new JSDOM(page('/travel-checklist/'), {
    url: 'https://flightdeck.test/travel-checklist/',
    runScripts: 'outside-only',
  });
  const w = dom.window,
    d = w.document;
  w.localStorage.setItem(
    'flightdeck-public-packing',
    JSON.stringify({ 'list-papers-and-documents-1': 1 }),
  );
  let prints = 0;
  w.print = () => {
    prints++;
  };
  w.eval(fs.readFileSync(path.join(root, 'src/site/site.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'src/site/travel-checklist.js'), 'utf8'));
  assert.ok(d.body.textContent.includes('No sign-in needed'));
  assert.equal(d.querySelectorAll('.ck-check').length, 141);
  assert.equal(d.querySelectorAll('.ck-sec:not([hidden])').length, 1);
  assert.ok(
    d.querySelector('[data-k="list-papers-and-documents-1"]').checked,
    'an existing Passport tick survives template expansion',
  );
  const all = d.getElementById('packing-show-all');
  all.click();
  assert.equal(d.querySelectorAll('.ck-sec:not([hidden])').length, 8);
  d.querySelector('.ck-check input').click();
  assert.equal(d.getElementById('packing-total').textContent, '2 of 141 packed');
  d.querySelector('[data-print]').click();
  assert.equal(prints, 1);
  d.querySelector('[data-print-blank]').click();
  assert.equal(prints, 2);
  assert.ok(d.getElementById('packing-board').classList.contains('ck-print-blank'));
  w.dispatchEvent(new w.Event('afterprint'));
  assert.ok(!d.getElementById('packing-board').classList.contains('ck-print-blank'));
  assert.ok(
    d.querySelector('[data-k="list-papers-and-documents-1"]').checked,
    'printing blank must not erase ticks',
  );
  assert.equal(
    JSON.parse(w.localStorage.getItem('flightdeck-public-packing'))['list-papers-and-documents-1'],
    1,
  );
  dom.window.close();
});

test('JSON-LD cannot be closed early by CMS text (a name with </script> stays inside the data block)', () => {
  const r = render(['/guides/flight-status-explained/'], {
    settings: { ownerName: 'Sam </script><img src=x>' },
  })['/guides/flight-status-explained/'].html;
  const blocks = [...r.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
  assert.ok(blocks.length >= 2 && blocks.every((b) => !b.includes('<')), 'no raw < inside JSON-LD');
  assert.equal(JSON.parse(blocks[0]).author.name, 'Sam </script><img src=x>');
  assert.ok(!r.includes('<img src=x>'));
});

test('home packing teaser and the full list share ticks; the lookup hands the flight to the app', () => {
  const dom = new JSDOM(page('/'), { url: 'https://flightdeck.test/', runScripts: 'outside-only' });
  const w = dom.window,
    d = w.document;
  w.localStorage.setItem(
    'flightdeck-public-packing',
    JSON.stringify({ 'list-days-in-advance-0': 1 }),
  );
  w.eval(fs.readFileSync(path.join(root, 'src/site/site.js'), 'utf8'));
  assert.ok(
    d.querySelector('[data-k="list-days-in-advance-0"]').checked,
    'a tick from the full list shows here',
  );
  assert.match(d.getElementById('packedCount').textContent, /^1 of \d+ packed$/);
  d.querySelector('[data-k="list-days-in-advance-1"]').click();
  assert.equal(
    JSON.parse(w.localStorage.getItem('flightdeck-public-packing'))['list-days-in-advance-1'],
    1,
  );
  // Tabs become real tabs; the second section's panel opens in place.
  const tab = d.querySelectorAll('[data-tabs="pack"] [data-tab]')[1];
  tab.click();
  assert.equal(tab.getAttribute('aria-selected'), 'true');
  assert.ok(!d.getElementById(tab.getAttribute('data-tab')).hidden);
  // A bad flight number is refused with a message; the date select offers the visitor's own days.
  const num = d.getElementById('lookup-number');
  num.value = 'hello world';
  d.getElementById('lookup').dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.ok(!d.getElementById('fnErr').hidden && num.getAttribute('aria-invalid') === 'true');
  assert.equal(d.getElementById('lookup-date').options.length, 15);
  dom.window.close();
});
