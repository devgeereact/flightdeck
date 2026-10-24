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
.pub-top{background:#fff;border-bottom:1px solid #e5e9e2}.pub-in{max-width:1160px;margin:0 auto;padding:0 clamp(18px,4vw,42px);display:flex;align-items:center;justify-content:space-between;gap:16px}
.pub-top .pub-in{min-height:72px;flex-wrap:wrap;padding-top:10px;padding-bottom:10px}
.pub-brand{display:flex;align-items:center;gap:9px;font:800 23px Manrope,system-ui,sans-serif;letter-spacing:-.05em;text-decoration:none;color:var(--gd)}.pub-brand i{color:#81a356;font-style:normal}.pub-mark{background:#173e34;color:#d6eb9e;display:grid;place-items:center;width:36px;height:36px;border-radius:11px}
.pub-nav{display:flex;gap:4px;flex-wrap:wrap;align-items:center;font-size:13px;font-weight:600}.pub-nav a{text-decoration:none;color:#5d6e64;padding:9px 13px;border-radius:8px}.pub-nav a:hover,.pub-nav a[aria-current]{color:#244b38;background:#edf2e8}
.pub-open{background:var(--g)!important;color:#fff!important;margin-left:8px}.pub-open:hover{background:#1a4033!important}
main{max-width:1160px;margin:0 auto;padding:0 clamp(18px,4vw,42px) 64px}
.pub-head{padding:40px 0 26px}.pub-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#566a5d;font-weight:700;margin:0 0 12px}
h1{font:750 clamp(30px,4vw,40px)/1.1 Manrope,system-ui,sans-serif;letter-spacing:-.035em;color:var(--gd);margin:0 0 12px}
.lede{color:var(--mut);margin:0;font-size:16px;max-width:720px}h2{font:700 21px/1.3 Manrope,system-ui,sans-serif;color:var(--gd);margin:34px 0 10px;letter-spacing:-.02em}h3{font-size:16px;margin:20px 0 6px}
ul,ol{padding-left:22px}li{margin:6px 0}code{background:#eef2ea;padding:1px 6px;border-radius:5px;font-size:.9em}
table{width:100%;border-collapse:collapse;font-size:14px;margin:14px 0 22px;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid #edf1ea}th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5d6e64;background:#f9fbf7}
.meta{font-size:12px;color:#5d6e64;margin:12px 0 0}.pub-body{background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:clamp(20px,4vw,40px)}.pub-body>*{max-width:860px}.pub-body>:first-child{margin-top:0}.pub-body>:last-child{margin-bottom:0}.pub-body>table,.pub-body>.cards{max-width:none}.cta-box{margin:28px 0 8px;background:#193f35;color:#fff;border-radius:12px;padding:clamp(22px,4vw,32px)}.cta-box h2{color:#fff}.cta-box p{color:#c3d2c3;max-width:640px}.cta-box a.btn{background:#d6eb9e;color:#133c35}.cta-box h2{margin-top:0}
.pub-btn,.cta-box a.btn{display:inline-block;background:var(--g);color:#fff;border:0;border-radius:9px;padding:13px 22px;font:600 15px "DM Sans",system-ui,sans-serif;cursor:pointer;text-decoration:none}.pub-btn:disabled{opacity:.6}
.pub-form{background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:clamp(20px,4vw,32px)}.pub-f{display:block;margin-bottom:14px;flex:1}.pub-f span{display:block;font-size:12px;color:#5d6e64;margin-bottom:6px}
.pub-f input,.pub-f textarea{width:100%;font:16px system-ui,sans-serif;border:1px solid #cfdcd2;border-radius:8px;padding:11px 12px;color:var(--ink)}.pub-row{display:flex;gap:12px;flex-wrap:wrap}.pub-kinds{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:15px}.pub-trap{position:absolute;left:-9999px;opacity:0}
.pub-small{font-size:12px;color:#5d6e64}#contact-msg{min-height:1.4em;color:#a34b3a;font-size:14px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;list-style:none;padding:0}.cards li{margin:0}.cards a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;text-decoration:none;height:100%}.cards a:hover{border-color:#b9cdbd}.cards strong{display:block;color:var(--gd);font-size:17px;margin-bottom:6px}.cards span{color:var(--mut);font-size:14px}
.ck-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px;margin:0 0 28px;align-items:start}.ck-sec{break-inside:avoid;background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:22px 24px;margin:0}.ck-sec h2{margin:0 0 8px;font-size:18px}.ck-sec ul{list-style:none;padding:0;margin:0}.ck-sec li{margin:0;break-inside:avoid;padding:5px 0;display:flex;gap:10px;align-items:flex-start;font-size:15px}.ck-sec li:before{content:"";flex:0 0 17px;height:17px;margin-top:4px;border:1.6px solid #7f9a89;border-radius:4px;background:#fff}.ck-hint{font-size:13px;color:#5d6e64;margin:0 0 8px}
.ad-slot{margin:28px 0;min-height:90px}.pub-foot{border-top:1px solid #e1e6da}.pub-foot .pub-in{padding-top:26px;padding-bottom:34px;flex-wrap:wrap;align-items:center;gap:14px 28px}.pub-foot nav{margin-left:auto}.pub-foot p{margin:0;font-size:12px;color:#5d6e64;flex:1 1 240px;max-width:340px;line-height:1.6}.pub-foot nav{display:flex;gap:2px 4px;flex-wrap:wrap;justify-content:flex-end}.pub-foot nav a{color:#5d6e64;text-decoration:none;font-size:12.5px;font-weight:600;padding:7px 11px;border-radius:8px}.pub-foot nav a:hover{background:#edf2e8;color:#244b38}.pub-foot .pub-brand{font-size:19px}@media(max-width:760px){.pub-foot .pub-in{flex-direction:column;align-items:flex-start}.pub-foot p{text-align:left}.pub-foot nav{justify-content:flex-start;margin-left:-11px}.ck-grid{grid-template-columns:1fr}.pub-open{margin-left:0}}
@media print{.pub-top,.pub-foot,.cta-box,.noprint,.ad-slot,.fd-cc{display:none!important}body{background:#fff;font-size:12pt}main{max-width:none;padding:0}.pub-body{border:0;padding:0}.ck-grid{display:block}.pub-head{padding:0}.ck-sec{border:1px solid #999}.ck-sec li:before{border-color:#000}h1{font-size:24pt}.lede{font-size:11pt}}
`;

const nav = [['/travel-checklist/', 'Packing list'], ['/guides/', 'Guides'], ['/about/', 'About'], ['/contact/', 'Contact']];
const footLinks = [['/privacy/', 'Privacy'], ['/cookies/', 'Cookies'], ['/terms/', 'Terms'], ['/about/', 'About'], ['/contact/', 'Contact'], ['/guides/', 'Guides'], ['/travel-checklist/', 'Packing list']];

const PLANE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
const LABELS = { legal: 'Legal and help', contact: 'Get in touch', checklist: 'Free tool', guide: 'Travel guide', index: 'Travel guides' };
const externalScripts = new Map();
const shell = ({ slug, title, description, body, kind, updated }) => {
  // Inline scripts become files so the site can run a strict Content-Security-Policy without 'unsafe-inline'.
  body = body.replace(/<script>([\s\S]*?)<\/script>/g, (_m, code) => { const f = `/js/${slug.replace(/[^a-z0-9]+/gi, '-')}.js`; externalScripts.set(f, code.trim() + '\n'); return `<script src="${f}" defer></script>`; });
  const label = LABELS[kind] || 'Flightdeck';
  const ldObj = kind === 'guide'
    ? { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, dateModified: updated || config.lastReviewed, mainEntityOfPage: `${config.url}/${slug}/`, author: { '@type': 'Person', name: config.ownerName || config.siteName }, publisher: { '@type': 'Organization', name: config.siteName, url: config.url } }
    : { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: `${config.url}/${slug}/`, isPartOf: { '@type': 'WebSite', name: config.siteName, url: config.url } };
  const ld = `<script type="application/ld+json">${JSON.stringify(ldObj).replace(/</g, '\\u003c')}</script>`;
  const wrap = kind === 'legal' || kind === 'guide';
  const slotHtml = kind === 'guide' || kind === 'checklist' ? slotFor(kind) : '';
  const url = `${config.url}/${slug}/`;
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(config.siteName)}</title>
<meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta name="theme-color" content="#133c35">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${kind === 'guide' ? 'article' : 'website'}"><meta property="og:url" content="${esc(url)}"><meta property="og:site_name" content="${esc(config.siteName)}"><meta property="og:image" content="${esc(config.url)}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(config.url)}/og-image.png">
<meta name="fd-ga-id" content="${esc(gaId)}">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
${ld}
<style>${css}</style>${slotHtml ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ads.pubId)}" crossorigin="anonymous"></script>` : ''}</head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="pub-top"><div class="pub-in"><a class="pub-brand" href="/"><span class="pub-mark" aria-hidden="true">${PLANE}</span><span>flightdeck<i>.</i></span></a><nav class="pub-nav" aria-label="Main">${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a class="pub-open" href="/">Open the app</a></nav></div></header>
<main id="main"><div class="pub-head"><p class="pub-eyebrow">${esc(label)}</p><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p>${updated ? `<p class="meta">Last reviewed ${esc(updated)}</p>` : ''}</div>
${wrap ? `<div class="pub-body">${body}</div>` : body}
${slotHtml}
${kind === 'guide' || kind === 'checklist' ? `<section class="cta-box"><h2>${kind === 'checklist' ? 'Keep this list for every trip' : 'Follow your flight in Flightdeck'}</h2><p>${kind === 'checklist' ? 'Create a free account to tick items off on your phone, add your own, keep several trips, and use it offline at the airport.' : 'Live status, gate and baggage belt when reported, outbound or inbound, and a packing checklist you can reuse.'}</p><a class="btn" href="/">Open Flightdeck</a></section>` : ''}
</main>
<footer class="pub-foot"><div class="pub-in"><a class="pub-brand" href="/"><span>flightdeck<i>.</i></span></a><p>© ${new Date().getFullYear()} ${esc(config.siteName)}. Flight details can change. Always follow airline and airport instructions.</p><nav aria-label="Legal and help">${footLinks.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="#" data-fd-cookie-settings>Cookie settings</a></nav></div></footer>
<script src="/consent.js" defer></script><script src="/page.js" defer></script></body></html>
`;
};

// The packing list page is generated from the same template the app uses, so the two can never drift apart.
const checklistBody = `
<p class="noprint">Tick things off on paper, or <a href="/">keep this list in Flightdeck</a> where it saves your ticks, lets you add your own items and reuse it for every trip. The sections run in the order a trip happens. Use <strong>Print</strong> to take it with you.</p>
<p class="noprint"><button class="pub-btn" type="button" data-print>Print this checklist</button></p>
<div class="ck-grid">${TEMPLATE.map((sec) => `<section class="ck-sec"><h2>${esc(sec.title)}</h2>${sec.hint ? `<p class="ck-hint">${esc(sec.hint)}</p>` : ''}<ul>${sec.items.map((i) => `<li>${esc(i.text)}</li>`).join('')}</ul></section>`).join('\n')}</div>
<div class="pub-body"><h2>Making the most of the list</h2>
<ul><li><strong>Start days ahead.</strong> The first section holds the things that take time: visas, insurance, vaccinations.</li><li><strong>Pack by section.</strong> Clothes first, then the bathroom bag, then accessories, so nothing is forgotten halfway through.</li><li><strong>Cross out what you never need</strong> and add what you always forget. A list you have made your own is one you will use again.</li><li><strong>Do the night-before and last-minute lists last.</strong> They are the ones that catch the keys, the phone charger and the back door.</li></ul>
<p>For entry requirements, visas and health advice for your destination, use the official <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>.</p></div>`;

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
write('page.js', "document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[data-print]'))window.print()});\n");
for (const [f, code] of externalScripts) write(f.slice(1), code);
write('404.html', shell({ slug: 'not-found', kind: 'notfound', title: 'Page not found', description: 'That page does not exist or has moved.', body: '<div class="pub-body"><p>Try the <a href="/">Flightdeck app</a>, the <a href="/travel-checklist/">packing list</a> or the <a href="/guides/">travel guides</a>.</p></div>' }).replace('<link rel="canonical"', '<meta name="robots" content="noindex"><link rel="canonical"'));
if (adsOpen) write('ads.txt', `google.com, ${ads.pubId}, DIRECT, f08c47fec0942fa0\n`);

console.log(`[build-public] ${written.length} files written to ${path.relative(root, dist) || '.'} · GA ${gaId ? 'on (' + gaId + ')' : 'off'} · ads ${adsOpen ? 'ON' : 'off'}`);
