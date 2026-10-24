// Renders the public pages (privacy, cookies, terms, about, contact, printable packing list, guides) to static HTML next to the app,
// plus sitemap.xml, robots.txt and (only when the ads gate is fully open) ads.txt.
// Usage: node scripts/build-public.mjs [--dist dist] [--config site.config.json]
// Public pages use the self-hosted fonts and request nothing from third parties. The ONLY script they load is /consent.js (our own).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
const root = path.resolve(import.meta.dirname, '..');
const dist = path.resolve(arg('dist', path.join(root, 'dist')));
const config = JSON.parse(fs.readFileSync(path.resolve(arg('config', path.join(root, 'site.config.json'))), 'utf8'));
const { pages, guideIndex } = await import(pathToFileURL(path.join(root, 'content/pages.mjs')).href);
const { TEMPLATE } = await import(pathToFileURL(path.join(root, 'src/checklistTemplate.ts')).href);

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rawGa = (process.env.VITE_GA_ID || '').trim();
const gaId = /^G-[A-Z0-9]{6,12}$/.test(rawGa) ? rawGa : '';
if (rawGa && !gaId) console.warn('[build-public] VITE_GA_ID is not a valid GA4 Measurement ID (expected G-XXXXXXXXXX); building without analytics.');
const ads = config.ads || {};
// Ads need EVERY condition: switched on, the data licences cleared by the owner, a Google-certified consent tool in place, and a publisher id.
const adsOpen = !!(ads.enabled && ads.licenceCleared && ads.cmpReady && /^pub-\d{10,20}$/.test(ads.pubId || ''));
if (ads.enabled && !adsOpen) console.warn('[build-public] ads.enabled is true but the gate is not fully open (licenceCleared, cmpReady and a valid pubId are all required). Building WITHOUT ads.');

const slotFor = (kind) => {
  if (!adsOpen) return '';
  const slot = (ads.slots || {})[kind === 'checklist' ? 'checklist' : 'guide'];
  if (!/^\d{6,20}$/.test(slot || '')) return '';
  return `<aside class="ad-slot" aria-label="Advertisement"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ads.pubId)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></aside>`;
};

const fontFaces = fs.readFileSync(path.join(root, 'src/fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const css = fontFaces + `
:root{--g:#214e3e;--gd:#133c35;--ink:#2d4b3d;--mut:#5f7367;--bg:#f6f7f4;--line:#dce5d6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--g)}a:hover{color:var(--gd)}.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:#fff;padding:8px 12px;z-index:9}
.pub-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;max-width:880px;margin:0 auto;padding:20px 20px 8px}
.pub-brand{font:800 22px Manrope,system-ui,sans-serif;letter-spacing:-.04em;text-decoration:none;color:var(--gd)}.pub-brand i{color:#81a356;font-style:normal}
.pub-nav{display:flex;gap:6px 18px;flex-wrap:wrap;font-size:14px}.pub-nav a{text-decoration:none;color:var(--mut)}.pub-nav a:hover{color:var(--g);text-decoration:underline}
.pub-open{background:var(--g);color:#fff!important;padding:9px 16px;border-radius:9px;font-weight:600}.pub-open:hover{background:#1a4033}
main{max-width:760px;margin:0 auto;padding:12px 20px 56px}h1{font:800 clamp(30px,5vw,44px)/1.1 Manrope,system-ui,sans-serif;letter-spacing:-.035em;color:var(--gd);margin:22px 0 10px}
.lede{color:var(--mut);margin:0 0 28px;font-size:17px}h2{font:700 21px/1.3 Manrope,system-ui,sans-serif;color:var(--gd);margin:34px 0 10px;letter-spacing:-.02em}h3{font-size:16px;margin:20px 0 6px}
ul,ol{padding-left:22px}li{margin:6px 0}code{background:#eef2ea;padding:1px 6px;border-radius:5px;font-size:.9em}
table{width:100%;border-collapse:collapse;font-size:14px;margin:14px 0 22px;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid #edf1ea}th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a8c7d;background:#f9fbf7}
.meta{font-size:13px;color:#7a8c7d;margin:-4px 0 24px}.cta-box{margin:40px 0 8px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px}.cta-box h2{margin-top:0}
.pub-btn,.cta-box a.btn{display:inline-block;background:var(--g);color:#fff;border:0;border-radius:9px;padding:13px 22px;font:600 15px "DM Sans",system-ui,sans-serif;cursor:pointer;text-decoration:none}.pub-btn:disabled{opacity:.6}
.pub-form{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px}.pub-f{display:block;margin-bottom:14px;flex:1}.pub-f span{display:block;font-size:12px;color:#7a8c7d;margin-bottom:6px}
.pub-f input,.pub-f textarea{width:100%;font:16px system-ui,sans-serif;border:1px solid #cfdcd2;border-radius:8px;padding:11px 12px;color:var(--ink)}.pub-row{display:flex;gap:12px;flex-wrap:wrap}.pub-kinds{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:15px}.pub-trap{position:absolute;left:-9999px;opacity:0}
.pub-small{font-size:12px;color:#7a8c7d}#contact-msg{min-height:1.4em;color:#a34b3a;font-size:14px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;list-style:none;padding:0}.cards li{margin:0}.cards a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;text-decoration:none;height:100%}.cards a:hover{border-color:#b9cdbd}.cards strong{display:block;color:var(--gd);font-size:17px;margin-bottom:6px}.cards span{color:var(--mut);font-size:14px}
.cl-sec{break-inside:avoid;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin:14px 0}.cl-sec h2{margin:0 0 8px;font-size:18px}.cl-sec ul{list-style:none;padding:0;margin:0;columns:2 250px;column-gap:28px}.cl-sec li{margin:0;break-inside:avoid;padding:5px 0;display:flex;gap:10px;align-items:flex-start;font-size:15px}.cl-sec li:before{content:"";flex:0 0 17px;height:17px;margin-top:4px;border:1.6px solid #7f9a89;border-radius:4px;background:#fff}.cl-hint{font-size:13px;color:#7a8c7d;margin:0 0 8px}
.ad-slot{margin:28px 0;min-height:90px}.pub-foot{max-width:880px;margin:0 auto;padding:24px 20px 40px;border-top:1px solid var(--line);font-size:13px;color:#7a8c7d}.pub-foot nav{display:flex;gap:6px 18px;flex-wrap:wrap}.pub-foot a{color:#7a8c7d}
@media print{.pub-top,.pub-foot,.cta-box,.noprint,.ad-slot,.fd-cc{display:none!important}body{background:#fff;font-size:12pt}main{max-width:none;padding:0}.cl-sec{border:1px solid #999}.cl-sec li:before{border-color:#000}h1{font-size:24pt}.lede{font-size:11pt}}
`;

const nav = [['/travel-checklist/', 'Packing list'], ['/guides/', 'Guides'], ['/about/', 'About'], ['/contact/', 'Contact']];
const footLinks = [['/privacy/', 'Privacy'], ['/cookies/', 'Cookies'], ['/terms/', 'Terms'], ['/about/', 'About'], ['/contact/', 'Contact'], ['/guides/', 'Guides'], ['/travel-checklist/', 'Packing list']];

const shell = ({ slug, title, description, body, kind, updated }) => {
  const slotHtml = kind === 'guide' || kind === 'checklist' ? slotFor(kind) : '';
  const url = `${config.url}/${slug}/`;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(config.siteName)}</title>
<meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta name="theme-color" content="#133c35">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${kind === 'guide' ? 'article' : 'website'}"><meta property="og:url" content="${esc(url)}"><meta property="og:site_name" content="${esc(config.siteName)}">
<meta name="fd-ga-id" content="${esc(gaId)}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>${css}</style>${slotHtml ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ads.pubId)}" crossorigin="anonymous"></script>` : ''}</head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="pub-top"><a class="pub-brand" href="/">flightdeck<i>.</i></a><nav class="pub-nav" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a class="pub-open" href="/">Open the app</a></nav></header>
<main id="main"><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p>${updated ? `<p class="meta">Last reviewed ${esc(updated)}</p>` : ''}
${body}
${slotHtml}
${kind === 'guide' || kind === 'checklist' ? `<section class="cta-box"><h2>${kind === 'checklist' ? 'Keep this list for every trip' : 'Follow your flight in Flightdeck'}</h2><p>${kind === 'checklist' ? 'Create a free account to tick items off on your phone, add your own, keep several trips, and use it offline at the airport.' : 'Live status, gate and baggage belt when reported, outbound or inbound, and a packing checklist you can reuse.'}</p><a class="btn" href="/">Open Flightdeck</a></section>` : ''}
</main>
<footer class="pub-foot"><nav aria-label="Legal and help">${footLinks.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="#" data-fd-cookie-settings>Cookie settings</a></nav><p>© ${new Date().getFullYear()} ${esc(config.siteName)}. Flight details can change. Always follow airline and airport instructions.</p></footer>
<script src="/consent.js" defer></script></body></html>
`;
};

// The packing list page is generated from the same template the app uses, so the two can never drift apart.
const checklistBody = `
<p class="noprint">Tick things off on paper, or <a href="/">keep this list in Flightdeck</a> where it saves your ticks, lets you add your own items and reuse it for every trip. The sections run in the order a trip happens. Use <strong>Print</strong> to take it with you.</p>
<p class="noprint"><button class="pub-btn" type="button" onclick="window.print()">Print this checklist</button></p>
${TEMPLATE.map((sec) => `<section class="cl-sec"><h2>${esc(sec.title)}</h2>${sec.hint ? `<p class="cl-hint">${esc(sec.hint)}</p>` : ''}<ul>${sec.items.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul></section>`).join('\n')}
<h2>Making the most of the list</h2>
<ul><li><strong>Start days ahead.</strong> The first section holds the things that take time: visas, insurance, vaccinations.</li><li><strong>Pack by section.</strong> Clothes first, then the bathroom bag, then accessories, so nothing is forgotten halfway through.</li><li><strong>Cross out what you never need</strong> and add what you always forget. A list you have made your own is one you will use again.</li><li><strong>Do the night-before and last-minute lists last.</strong> They are the ones that catch the keys, the phone charger and the back door.</li></ul>
<p>For entry requirements, visas and health advice for your destination, use the official <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>.</p>`;

const guideCards = (list) => `<ul class="cards">${list.map((g) => `<li><a href="/${g.slug}/"><strong>${esc(g.title)}</strong><span>${esc(g.description)}</span></a></li>`).join('')}</ul>`;

fs.mkdirSync(dist, { recursive: true });
const written = [];
const write = (rel, content) => { const f = path.join(dist, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); written.push(rel); };

const all = pages(config).map((p) => (p.kind === 'checklist' ? { ...p, body: checklistBody } : p));
const guides = all.filter((p) => p.kind === 'guide');
for (const p of all) write(`${p.slug}/index.html`, shell({ ...p, updated: p.kind === 'guide' || p.kind === 'legal' ? config.lastReviewed : '' }));
write('guides/index.html', shell({ ...guideIndex, kind: 'index', body: guideCards(guides) + '<p>Looking for a packing list? Use the <a href="/travel-checklist/">printable travel checklist</a>.</p>' }));

const urls = ['/', '/travel-checklist/', '/guides/', ...guides.map((g) => `/${g.slug}/`), '/about/', '/contact/', '/privacy/', '/cookies/', '/terms/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${config.url}${u}</loc><lastmod>${config.lastReviewed}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${config.url}/sitemap.xml\n`);
if (adsOpen) write('ads.txt', `google.com, ${ads.pubId}, DIRECT, f08c47fec0942fa0\n`);

console.log(`[build-public] ${written.length} files written to ${path.relative(root, dist) || '.'} · GA ${gaId ? 'on (' + gaId + ')' : 'off'} · ads ${adsOpen ? 'ON' : 'off'}`);
