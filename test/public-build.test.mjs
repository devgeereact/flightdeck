import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const { TEMPLATE } = await import(path.join(root, 'src/checklistTemplate.ts'));

function build({ config = base, env = {} } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-pub-'));
  const dist = path.join(tmp, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>app</title>');
  const cfg = path.join(tmp, 'site.json');
  fs.writeFileSync(cfg, JSON.stringify(config));
  const out = execFileSync('node', ['scripts/build-public.mjs', '--dist', dist, '--config', cfg], { cwd: root, env: { ...process.env, VITE_GA_ID: '', ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const files = (d = dist, acc = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? files(path.join(d, f.name), acc) : acc.push(path.relative(dist, path.join(d, f.name))); return acc; };
  const read = (rel) => fs.readFileSync(path.join(dist, rel), 'utf8');
  return { dist, files: files(), read, out, exists: (rel) => fs.existsSync(path.join(dist, rel)) };
}
const PAGES = ['privacy', 'cookies', 'terms', 'about', 'contact', 'travel-checklist', 'guides', 'guides/flight-status-explained', 'guides/outbound-and-inbound-flights', 'guides/what-to-do-if-your-flight-is-delayed-or-cancelled', 'guides/pack-your-cabin-bag-for-a-long-flight', 'guides/baggage-reclaim-and-missing-bags', 'guides/flight-numbers-airline-codes-and-codeshares', 'guides/departure-day-airport-timeline', 'guides/how-to-read-an-airport-departure-board', 'guides/connecting-flights-and-missed-connections', 'guides/cabin-bag-or-hold-bag', 'guides/what-flight-tracking-can-and-cannot-tell-you'];
const html = (b) => PAGES.map((p) => [p, b.read(p + '/index.html')]);

test('the app and the public pages load no third-party fonts or styles: fonts are served from our own /fonts/', () => {
  for (const f of ['src/style.css', 'src/fonts.css']) assert.ok(!/https?:\/\//.test(fs.readFileSync(path.join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), f);
  for (const f of ['public/fonts/dm-sans-latin.woff2', 'public/fonts/manrope-latin.woff2', 'public/fonts/dm-sans-latin-ext.woff2', 'public/fonts/manrope-latin-ext.woff2']) assert.equal(fs.readFileSync(path.join(root, f)).subarray(0, 4).toString(), 'wOF2', f);
  assert.ok(fs.existsSync(path.join(root, 'public/fonts/LICENSE.txt')));
  const b = build();
  assert.ok(b.read('privacy/index.html').includes("url('/fonts/dm-sans-latin.woff2')"));
});

test('every public page is generated, plus sitemap and robots; the app shell is left alone', () => {
  const b = build();
  for (const p of PAGES) assert.ok(b.exists(p + '/index.html'), p);
  assert.ok(b.exists('sitemap.xml') && b.exists('robots.txt'));
  assert.equal(b.read('index.html'), '<!doctype html><title>app</title>');
  const sm = b.read('sitemap.xml');
  for (const p of PAGES.filter((x) => x !== 'guides')) assert.ok(sm.includes(`${base.url}/${p}/`), p);
  assert.ok(sm.includes(`${base.url}/guides/`) && sm.includes(`<loc>${base.url}/</loc>`));
  const robots = b.read('robots.txt');
  assert.ok(robots.includes('Disallow: /api/') && robots.includes(`Sitemap: ${base.url}/sitemap.xml`));
});

test('each page is a proper document: title, description, canonical, one h1, skip link, landmarks', () => {
  const b = build();
  for (const [p, h] of html(b)) {
    assert.match(h, /<html lang="en-GB">/, p);
    assert.match(h, /<title>[^<]+ · Flightdeck<\/title>/, p);
    assert.match(h, /<meta name="description" content="[^"]{20,200}">/, p);
    assert.ok(h.includes(`<link rel="canonical" href="${base.url}/${p}/">`), p);
    assert.equal((h.match(/<h1>/g) || []).length, 1, p);
    assert.ok(h.includes('class="skip"') && h.includes('<main id="main">') && h.includes('<footer'), p);
  }
});

test('public pages request nothing from third parties: the only scripts are our own files', () => {
  const b = build();
  for (const [p, h] of html(b)) {
    for (const m of h.matchAll(/<(?:script|img|iframe|source|video|audio)\b[^>]*\bsrc="([^"]+)"/g)) assert.ok(['/consent.js', '/page.js', '/js/contact.js', '/js/travel-checklist.js'].includes(m[1]), `${p}: ${m[1]}`);
    for (const m of h.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) assert.ok(m[1].startsWith('/') || m[1].startsWith(base.url), `${p}: ${m[1]}`);
    assert.ok(!/@import|fonts\.googleapis|googletagmanager|google-analytics|adsbygoogle|googlesyndication/.test(h), p);
  }
});

test('outbound links are explicit and safe (noopener); every internal link points at a real page', () => {
  const b = build();
  const known = new Set(['/', '/#/checklist', '/icon.svg', '#', ...PAGES.map((p) => `/${p}/`)]);
  const guideIdx = b.read('guides/index.html');
  for (const [p, h] of html(b)) {
    for (const m of h.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/g)) {
      const href = m[1];
      if (/^https?:/.test(href)) { if (!href.startsWith(base.url)) assert.match(m[0], /rel="noopener"/, `${p}: ${href}`); continue; }
      if (href.startsWith('mailto:')) continue;
      if (href.startsWith('#')) { if (href.length > 1) assert.ok(h.includes(`id="${href.slice(1)}"`), `${p}: anchor ${href} has no target`); continue; }
      const hash = href.match(/^(\/[^#]*)#(.+)$/);
      if (hash && hash[1] === '/guides/') { assert.ok(guideIdx.includes(`id="${hash[2]}"`), `${p}: ${href} has no target on the guide index`); continue; }
      assert.ok(known.has(href), `${p}: broken internal link ${href}`);
    }
  }
});

test('no placeholders or template leftovers appear in the published text', () => {
  const b = build();
  for (const [p, h] of html(b)) assert.ok(!/undefined|\[object|\{\{|\$\{|TODO|\[owner|lorem/i.test(h), p);
});

test('the legal pages say what the app really does (and nothing it does not)', () => {
  const b = build();
  const privacy = b.read('privacy/index.html');
  for (const must of ['Clerk', 'AeroDataBox', 'OpenSky', 'adsbdb', 'Open-Meteo', 'Cloudflare', 'ico.org.uk', 'only if you accept', 'do not show advertising', 'Your rights', 'typefaces are hosted by us']) assert.ok(privacy.includes(must), must);
  const cookies = b.read('cookies/index.html');
  for (const must of ['__session', 'fd-consent', '_ga', 'Cookie settings', 'does not currently use advertising cookies']) assert.ok(cookies.includes(must), must);
  assert.ok(cookies.includes('data-fd-cookie-settings'));
  assert.ok(b.read('terms/index.html').includes('Always follow the instructions of your airline'));
});

test('without an owner email the contact route is the form; with one the email is shown and linked', () => {
  assert.ok(!build({ config: { ...base, contactEmail: '', ownerName: '' } }).read('privacy/index.html').includes('mailto:'));
  const withMail = build({ config: { ...base, contactEmail: 'hello@example.com', ownerName: 'Sam Example' } });
  assert.ok(withMail.read('privacy/index.html').includes('<a href="mailto:hello@example.com">hello@example.com</a>') && withMail.read('privacy/index.html').includes('Sam Example'));
  assert.ok(withMail.read('contact/index.html').includes('mailto:hello@example.com'));
});

test('contact page: a real form with a honeypot and fill-time, posting to our own API', () => {
  const b = build();
  const c = b.read('contact/index.html');
  assert.ok(c.includes('id="contact-form"') && c.includes('name="website"') && c.includes('type="email"') && c.includes('<script src="/js/contact.js" defer>'));
  const js = b.read('js/contact.js');
  assert.ok(js.includes("fetch('/api/contact'") && js.includes('elapsed:Date.now()-t0'));
});

test('no page has an inline script or inline event handler, and a noindex 404 page exists', () => {
  const b = build();
  for (const f of ['contact/index.html', 'privacy/index.html', 'travel-checklist/index.html', 'guides/index.html', '404.html']) {
    const h = b.read(f);
    assert.ok(!/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)/.test(h), f + ' has an inline script');
    assert.ok(!/\son[a-z]+="/.test(h), f + ' has an inline handler');
  }
  assert.ok(b.read('404.html').includes('noindex') && !b.read('sitemap.xml').includes('404'));
});

test('the printable packing list is the app template: same sections, same items, same order', () => {
  const b = build();
  const h = b.read('travel-checklist/index.html');
  assert.equal((h.match(/<section class="ck-sec"/g) || []).length, TEMPLATE.length);
  assert.deepEqual([...h.matchAll(/<h2 class="ck-sec-title" id="[^"]+">([^<]+)<\/h2>/g)].map((m) => m[1]), TEMPLATE.map((s) => s.title));
  assert.deepEqual([...h.matchAll(/<span class="ck-rail-title">([^<]+)<\/span>/g)].map((m) => m[1]), TEMPLATE.map((s) => s.title), 'the rail lists the same sections in the same order');
  const items = [...h.matchAll(/<span class="ck-text">([^<]*)<\/span>/g)].map((m) => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
  const expected = TEMPLATE.flatMap((s) => s.items.map((i) => i.text));
  assert.deepEqual(items.slice(0, expected.length), expected);
  assert.ok(h.includes('data-print') && b.read('page.js').includes('window.print()') && h.includes('@media print'));
  assert.ok(b.read('js/travel-checklist.js').includes('packing-board') && h.includes('class="ck-layout" id="packing-board"') && h.includes('.ck-rail-item') && h.includes('input[type=checkbox]') === false, 'same board classes as the app');
});

test('the guides are real articles, not thin pages', () => {
  const b = build();
  for (const p of PAGES.filter((x) => x.startsWith('guides/'))) {
    const text = b.read(p + '/index.html').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    assert.ok(text.split(/\s+/).filter(Boolean).length > 380, `${p} is too short`);
  }
  assert.equal([...b.read('guides/index.html').matchAll(/<li><a href="\/guides\/[a-z]/g)].length, PAGES.filter((x) => x.startsWith('guides/')).length);
});

test('ADS DEFAULT OFF: the default build contains no ad code, no ads.txt, nothing from Google ads', () => {
  const b = build();
  for (const f of b.files) assert.ok(!/adsbygoogle|googlesyndication|pagead|data-ad-client/.test(b.read(f)), f);
  assert.ok(!b.exists('ads.txt'));
  assert.match(b.out, /ads off/);
});

test('ADS GATE: every condition is required, and a half-open gate builds without ads', () => {
  const slots = { guide: '1234567890', checklist: '0987654321' };
  const open = { enabled: true, licenceCleared: true, cmpReady: true, pubId: 'pub-1234567890123456', slots };
  for (const missing of ['enabled', 'licenceCleared', 'cmpReady']) {
    const b = build({ config: { ...base, ads: { ...open, [missing]: false } } });
    assert.ok(!b.files.some((f) => /adsbygoogle|googlesyndication/.test(b.read(f))), missing);
    assert.ok(!b.exists('ads.txt'), missing);
  }
  for (const pubId of ['', 'ca-pub-123', 'pub-12', 'pub-<script>']) {
    const b = build({ config: { ...base, ads: { ...open, pubId } } });
    assert.ok(!b.exists('ads.txt') && !b.files.some((f) => /adsbygoogle/.test(b.read(f))), pubId);
  }
});

test('ADS OPEN: ads only on guides and the packing list, never on legal, contact, about, the guide index or the app', () => {
  const slots = { guide: '1234567890', checklist: '0987654321' };
  const b = build({ config: { ...base, ads: { enabled: true, licenceCleared: true, cmpReady: true, pubId: 'pub-1234567890123456', slots } } });
  assert.equal(b.read('ads.txt'), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
  const withAds = PAGES.filter((p) => /adsbygoogle/.test(b.read(p + '/index.html')));
  assert.deepEqual(withAds.sort(), [...PAGES.filter((x) => x.startsWith('guides/')), 'travel-checklist'].sort());
  assert.equal(b.read('index.html'), '<!doctype html><title>app</title>');
  assert.ok(b.read('travel-checklist/index.html').includes('data-ad-slot="0987654321"'));
  assert.ok(b.read('guides/flight-status-explained/index.html').includes('data-ad-slot="1234567890"'));
  assert.ok(!b.read('privacy/index.html').includes('googlesyndication'));
});

test('Google Analytics ID: injected as a meta tag on every page when valid, ignored when malformed', () => {
  const on = build({ env: { VITE_GA_ID: 'G-TESTABC123' } });
  for (const [p, h] of html(on)) assert.ok(h.includes('<meta name="fd-ga-id" content="G-TESTABC123">'), p);
  assert.match(on.out, /GA on/);
  for (const bad of ['UA-1234', 'G-"><script>', 'g-abc']) {
    const b = build({ env: { VITE_GA_ID: bad } });
    for (const [p, h] of html(b)) assert.ok(h.includes('<meta name="fd-ga-id" content="">'), `${p} ${bad}`);
  }
});

test('one shared link list: the same footer on every page, header links match, active page is marked', async () => {
  const { FOOTER_GROUPS, HEADER_LINKS } = await import('../src/siteNav.ts');
  const b = build();
  const want = FOOTER_GROUPS.flatMap((g) => g.links.map((l) => l.href));
  for (const [p, h] of html(b)) {
    const foot = h.slice(h.indexOf('<footer class="sf"'), h.lastIndexOf('</footer>'));
    assert.deepEqual([...foot.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]).filter((x) => x !== '#'), want, p + ' footer');
    assert.ok(!foot.includes('data-fd-cookie-settings'), p + ' footer has no cookie settings link');
    const sizes = [...foot.matchAll(/<ul>([\s\S]*?)<\/ul>/g)].map((m) => (m[1].match(/<li>/g) || []).length);
    assert.ok(sizes.length === FOOTER_GROUPS.length && new Set(sizes).size === 1, p + ' footer menus are not equal length');
    const head = h.slice(h.indexOf('<header'), h.indexOf('</header>'));
    assert.deepEqual([...head.matchAll(/<a href="([^"]+)"( aria-current="page")?>(?!Open)/g)].map((m) => m[1]).filter((x) => x !== '/'), HEADER_LINKS.map((l) => l.href), p + ' header');
  }
  assert.ok(b.read('travel-checklist/index.html').includes('href="/travel-checklist/" aria-current="page"'));
  assert.ok(b.read('guides/departure-day-airport-timeline/index.html').includes('href="/guides/" aria-current="page"'));
});

test('guide pages have breadcrumbs, reading time, an On this page menu and related guides; the index groups every guide', () => {
  const b = build();
  for (const p of PAGES.filter((x) => x.startsWith('guides/'))) {
    const h = b.read(p + '/index.html');
    assert.ok(h.includes('class="pub-crumbs"') && /\d+ min read/.test(h) && h.includes('class="pub-toc"') && h.includes('aria-label="More guides"'), p);
    for (const m of h.matchAll(/href="#([^"]+)"/g)) assert.ok(h.includes(`id="${m[1]}"`) || m[1] === '', `${p}: toc target ${m[1]}`);
  }
  const idx = b.read('guides/index.html');
  for (const p of PAGES.filter((x) => x.startsWith('guides/'))) assert.ok(idx.includes(`href="/${p}/"`), `index lacks ${p}`);
  assert.equal((idx.match(/class="pub-cat"/g) || []).length, 3);
});

test('every JSON-LD block parses; guides carry an Article and a BreadcrumbList that matches the visible trail', async () => {
  const { guideCategories } = await import('../content/pages.mjs');
  const b = build();
  const idx = b.read('guides/index.html');
  for (const [p, h] of html(b)) {
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(blocks.length >= 1, `${p} has no JSON-LD`);
    const data = blocks.map((x) => { try { return JSON.parse(x); } catch (e) { return assert.fail(`${p}: invalid JSON-LD (${e.message})`); } });
    for (const d of data) assert.equal(d['@context'], 'https://schema.org', p);
    if (!p.startsWith('guides/')) { assert.ok(!data.some((d) => d['@type'] === 'BreadcrumbList'), `${p} should not have a BreadcrumbList`); continue; }
    assert.ok(data.some((d) => d['@type'] === 'Article'), `${p} has no Article`);
    const crumbs = data.find((d) => d['@type'] === 'BreadcrumbList');
    assert.ok(crumbs, `${p} has no BreadcrumbList`);
    const items = crumbs.itemListElement;
    assert.deepEqual(items.map((i) => i.position), [1, 2, 3], p);
    assert.equal(items[0].item, `${base.url}/guides/`, p);
    assert.equal(items[2].item, `${base.url}/${p}/`, p);
    const cat = guideCategories.find((c) => items[1].item === `${base.url}/guides/#cat-${c.id}`);
    assert.ok(cat && items[1].name === cat.title, `${p}: breadcrumb category`);
    assert.equal(items[2].name, h.match(/<h1>([^<]+)<\/h1>/)[1].replace(/&amp;/g, '&'), `${p}: breadcrumb name matches the h1`);
    assert.ok(h.includes(`<a href="/guides/#cat-${cat.id}">`), `${p}: visible breadcrumb links to its category`);
    const start = idx.indexOf(`id="cat-${cat.id}"`);
    assert.ok(idx.slice(start, idx.indexOf('</section>', start)).includes(`href="/${p}/"`), `${p} is not listed under ${cat.title} on the index`);
  }
  assert.ok(!b.files.some((f) => b.read(f).includes('FAQPage')), 'no FAQ schema without visible questions and answers');
});

test('public pages share the app button system and focus ring, and no text is smaller than 12.5px', () => {
  const b = build();
  for (const [p, h] of html(b)) {
    const css = h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
    assert.ok(css.includes('.btn{') && css.includes('.btn-primary{') && css.includes('.btn-secondary{'), p + ' button system');
    assert.ok(css.includes(':focus-visible{outline:2px solid #214e3e;outline-offset:2px}'), p + ' focus ring');
    assert.ok(!/pub-btn|pub-open/.test(h), p + ' still uses an old button class');
    for (const m of css.matchAll(/font(?:-size)?:(?:\d{3} )?(\d*\.?\d+)px/g)) assert.ok(Number(m[1]) >= 12.5, `${p}: ${m[0]}`);
    const head = h.slice(h.indexOf('<header'), h.indexOf('</header>'));
    assert.ok(head.includes('<a class="btn btn-primary" href="/">Open the app</a>'), p + ' header action');
  }
  assert.ok(b.read('travel-checklist/index.html').includes('<button class="btn btn-primary" type="button" data-print>') && b.read('contact/index.html').includes('<button class="btn btn-primary" type="submit">'));
  for (const f of ['src/style.css', 'src/siteFooter.css', 'src/packingBoard.css']) {
    const css = fs.readFileSync(path.join(root, f), 'utf8').replace(/@media print\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '');
    for (const m of css.matchAll(/font(?:-size)?:(?:\d{3} )?(\d*\.?\d+)px/g)) assert.ok(Number(m[1]) === 0 || Number(m[1]) >= 12.5, `${f}: ${m[0]}`);
    assert.ok(!css.includes('#92b678'), `${f} still has the faint focus outline`);
  }
});

test('guide metadata stays within search limits', async () => {
  const { pages } = await import('../content/pages.mjs');
  for (const g of pages(base).filter((x) => x.kind === 'guide')) {
    assert.ok(`${g.title} · ${base.siteName}`.length <= 69, `${g.slug}: title too long`);
    assert.ok(g.description.length <= 160, `${g.slug}: description too long`);
    assert.equal(g.takeaways.length, 3, g.slug);
    assert.ok(['reading', 'prepare', 'trouble'].includes(g.category), g.slug);
  }
});
