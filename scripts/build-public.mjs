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
const { pages, guideIndex, guideCategories } = await import(pathToFileURL(path.join(root, 'content/pages.mjs')).href);
const { HEADER_LINKS, FOOTER_GROUPS, FOOTER_BLURB, FOOTER_NOTE } = await import(pathToFileURL(path.join(root, 'src/siteNav.ts')).href);
const footerCss = fs.readFileSync(path.join(root, 'src/siteFooter.css'), 'utf8');
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
const css = fontFaces + footerCss + `
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
.ck-sec{break-inside:avoid;background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:20px 24px 12px;margin:0}.ck-sec h2{margin:0 0 8px;font-size:18px}.ck-sec ul{list-style:none;padding:0;margin:0}.ck-sec li{margin:0;break-inside:avoid;padding:9px 0;display:flex;gap:12px;align-items:center;font-size:14.5px}.ck-sec li:before{content:"";flex:0 0 19px;height:19px;border:1.6px solid #7f9a89;border-radius:5px;background:#fff}.ck-hint{font-size:13px;color:#5d6e64;margin:0 0 8px}
.ad-slot{margin:28px 0;min-height:90px}
.pub-crumbs{display:flex;gap:8px;align-items:center;font-size:13px;color:#5d6e64;margin:0 0 14px}.pub-crumbs a{color:#4d5f55;text-decoration:none;font-weight:600}.pub-crumbs a:hover{color:#244b38;text-decoration:underline}.pub-crumbs span[aria-hidden]{color:#9aa99d}
.pub-tags{display:flex;gap:8px 14px;flex-wrap:wrap;align-items:center;margin:14px 0 0;font-size:13px;color:#5d6e64}.pub-tag{background:#e7efdf;color:#2f5a3a;border-radius:20px;padding:4px 12px;font-weight:700;font-size:12px}
.pub-layout{display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:24px;align-items:start}.pub-layout.no-toc{grid-template-columns:minmax(0,1fr)}.pub-layout .pub-body{order:1}.pub-toc{order:2;position:sticky;top:20px;background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:18px 18px 14px}
.pub-toc p{margin:0 0 10px;font:700 11px Manrope,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#566a5d}.pub-toc ol{list-style:none;margin:0;padding:0;display:grid;gap:2px;counter-reset:t}.pub-toc li{margin:0;counter-increment:t}.pub-toc a{display:flex;gap:10px;padding:7px 8px;border-radius:8px;font-size:13.5px;line-height:1.4;color:#4d5f55;text-decoration:none}.pub-toc a:before{content:counter(t);color:#769070;font-weight:700;min-width:14px}.pub-toc a:hover{background:#edf2e8;color:#244b38}
.sf-in{max-width:1160px;margin:0 auto;padding:0 clamp(18px,4vw,42px)}.sf{margin-top:56px}.pub-body h2{scroll-margin-top:20px}.pub-take{background:#f4f8f1;border:1px solid #dfe9d8;border-radius:12px;padding:18px 22px;margin:0 0 26px}.pub-take-h{margin:0 0 8px;font:700 11px Manrope,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#566a5d}.pub-take ul{margin:0;padding-left:20px}.pub-take li{margin:4px 0}
.pub-related{margin-top:36px}.pub-related>h2{margin:0 0 6px}.pub-sub{color:#5d6e64;margin:0 0 16px;font-size:15px}
.cards a{display:flex;flex-direction:column;gap:6px}.cards em{font-style:normal;font-size:12px;font-weight:700;color:#2f5a3a;background:#e7efdf;border-radius:20px;padding:3px 10px;align-self:flex-start}.cards .cd-meta{font-size:12.5px;color:#5d6e64;margin-top:auto;padding-top:8px}.cards a:hover strong{text-decoration:underline}
.pub-cat{margin:0 0 34px}.pub-cat>h2{margin:0 0 4px}.pub-promo{display:flex;gap:18px 28px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:clamp(20px,3vw,28px)}.pub-promo h2{margin:0 0 6px}.pub-promo p{margin:0;color:#5d6e64;max-width:620px}
.pub-tools{display:flex;gap:12px 16px;flex-wrap:wrap;align-items:center;margin:0 0 18px}.pub-btn.alt{background:#fff;color:#214e3e;border:1px solid #cfdcd2}.pub-stat{font-size:13.5px;color:#5d6e64;margin-left:auto}
.pub-jump{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px;padding:0;list-style:none}.pub-jump li{margin:0}.pub-jump a{display:inline-block;padding:7px 14px;border-radius:20px;background:#fff;border:1px solid #dce5d6;color:#3d5a4b;text-decoration:none;font-size:13px;font-weight:600}.pub-jump a:hover{background:#edf2e8;color:#244b38}
.ck-grid{columns:2 380px;column-gap:20px;margin:0 0 30px}.ck-sec{scroll-margin-top:16px;display:block;margin:0 0 20px!important;break-inside:avoid}.ck-sec h2{display:flex;align-items:center;gap:12px;margin:0 0 4px!important;font-size:18px}.ck-n{display:grid;place-items:center;min-width:28px;height:28px;border-radius:9px;background:#173e34;color:#d6eb9e;font:800 13px Manrope,system-ui,sans-serif}.ck-ct{margin-left:auto;font:600 12px "DM Sans",system-ui,sans-serif;color:#5d6e64;background:#f1f4ee;border-radius:20px;padding:3px 10px}
.ck-sec li{border-bottom:1px solid #f0f3ec}.ck-sec li:last-child{border-bottom:0}.ck-hint{font-size:13px;color:#5d6e64;margin:0 0 10px 40px}
.ck-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:0 0 28px;padding:0;list-style:none}.ck-steps li{background:#fff;border:1px solid #e1e6dc;border-radius:12px;padding:18px;margin:0}.ck-steps b{display:block;color:#133c35;margin-bottom:4px}.ck-steps span{font-size:14px;color:#5d6e64}
@media(max-width:700px){.pub-open{margin-left:0}}
@media(max-width:900px){.pub-layout{grid-template-columns:minmax(0,1fr)}.pub-toc{position:static;order:0}.pub-stat{margin-left:0;width:100%}}

@media print{.ck-grid{columns:2;column-gap:10px}.ck-sec{padding:8px 12px;font-size:10pt}.ck-sec li{padding:2px 0;font-size:10pt}.ck-hint{margin-left:0;font-size:9pt}.ck-ct{display:none}.pub-top,.sf,.pub-crumbs,.pub-toc,.pub-related,.pub-jump,.pub-tools,.cta-box,.noprint,.ad-slot,.fd-cc{display:none!important}body{background:#fff;font-size:12pt}main{max-width:none;padding:0}.pub-body{border:0;padding:0}.ck-grid{display:block}.pub-head{padding:0}.ck-sec{border:1px solid #999}.ck-sec li:before{border-color:#000}h1{font-size:24pt}.lede{font-size:11pt}}
`;

const slugify = (t) => t.toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Give every h2 an id and list them, so long pages get an "On this page" menu.
const withToc = (html) => {
  const toc = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, t) => {
    const text = t.replace(/<[^>]*>/g, '').trim();
    const base = slugify(text) || 'section';
    let id = base; let n = 2;
    while (toc.some((x) => x.id === id)) id = `${base}-${n++}`;
    toc.push({ id, text });
    return `<h2 id="${id}">${t}</h2>`;
  });
  return { html: out, toc };
};
const wordsOf = (html) => html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
const minutesOf = (html) => Math.max(1, Math.round(wordsOf(html) / 200));
const catTitle = (id) => (guideCategories.find((c) => c.id === id) || {}).title || 'Travel guide';

const PLANE = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>';
const LABELS = { legal: 'Legal and help', contact: 'Get in touch', checklist: 'Free tool', guide: 'Travel guide', index: 'Travel guides' };
const externalScripts = new Map();
const shell = ({ slug, title, description, body, kind, updated, category, related, takeaways }) => {
  // Inline scripts become files so the site can run a strict Content-Security-Policy without 'unsafe-inline'.
  body = body.replace(/<script>([\s\S]*?)<\/script>/g, (_m, code) => { const f = `/js/${slug.replace(/[^a-z0-9]+/gi, '-')}.js`; externalScripts.set(f, code.trim() + '\n'); return `<script src="${f}" defer></script>`; });
  const label = LABELS[kind] || 'Flightdeck';
  const ldObj = kind === 'guide'
    ? { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, dateModified: updated || config.lastReviewed, mainEntityOfPage: `${config.url}/${slug}/`, author: { '@type': 'Person', name: config.ownerName || config.siteName }, publisher: { '@type': 'Organization', name: config.siteName, url: config.url } }
    : { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description, url: `${config.url}/${slug}/`, isPartOf: { '@type': 'WebSite', name: config.siteName, url: config.url } };
  const ld = `<script type="application/ld+json">${JSON.stringify(ldObj).replace(/</g, '\\u003c')}</script>`;
  const wrap = kind === 'legal' || kind === 'guide';
  const here = `/${slug}/`;
  const current = (href) => (here === href || (href !== '/' && here.startsWith(href)) ? ' aria-current="page"' : '');
  let main = body; let toc = [];
  if (wrap) ({ html: main, toc } = withToc(body));
  const minutes = minutesOf(body);
  const crumbs = kind === 'guide' ? `<nav class="pub-crumbs" aria-label="Breadcrumb"><a href="/guides/">Guides</a><span aria-hidden="true">›</span><span>${esc(catTitle(category))}</span></nav>` : '';
  const tags = kind === 'guide' ? `<p class="pub-tags"><span class="pub-tag">${esc(catTitle(category))}</span><span>${minutes} min read</span><span>Last reviewed ${esc(updated || config.lastReviewed)}</span></p>` : (updated ? `<p class="meta">Last reviewed ${esc(updated)}</p>` : '');
  const tocHtml = toc.length >= 3 ? `<aside class="pub-toc" aria-label="On this page"><p>On this page</p><ol>${toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></aside>` : '';
  const takeHtml = takeaways && takeaways.length ? `<div class="pub-take"><p class="pub-take-h">Key points</p><ul>${takeaways.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const content = wrap ? `<div class="pub-layout${tocHtml ? '' : ' no-toc'}">${tocHtml}<div class="pub-body">${takeHtml}${main}</div></div>` : body;
  const relatedHtml = related && related.length ? `<section class="pub-related" aria-label="More guides"><h2>More guides</h2><p class="pub-sub">Keep reading.</p>${guideCards(related)}</section>` : '';
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
<header class="pub-top"><div class="pub-in"><a class="pub-brand" href="/"><span class="pub-mark" aria-hidden="true">${PLANE}</span><span>flightdeck<i>.</i></span></a><nav class="pub-nav" aria-label="Main">${HEADER_LINKS.map((l) => `<a href="${l.href}"${current(l.href)}>${esc(l.label)}</a>`).join('')}<a class="pub-open" href="/">Open the app</a></nav></div></header>
<main id="main"><div class="pub-head">${crumbs}<p class="pub-eyebrow">${esc(label)}</p><h1>${esc(title)}</h1><p class="lede">${esc(description)}</p>${tags}</div>
${content}
${slotHtml}
${relatedHtml}
${kind === 'guide' || kind === 'checklist' ? `<section class="cta-box"><h2>${kind === 'checklist' ? 'Keep this list for every trip' : 'Follow your flight in Flightdeck'}</h2><p>${kind === 'checklist' ? 'Create a free account to tick items off on your phone, add your own, keep several trips, and use it offline at the airport.' : 'Live status, gate and baggage belt when reported, outbound or inbound, and a packing checklist you can reuse.'}</p><a class="btn" href="/">Open Flightdeck</a></section>` : ''}
</main>
<footer class="sf" aria-label="Site"><div class="sf-in"><div class="sf-top"><div class="sf-about"><a class="sf-brand" href="/"><span class="sf-mark" aria-hidden="true">${PLANE.replace('width="19" height="19"', 'width="16" height="16"')}</span><span>flightdeck<span class="sf-dot">.</span></span></a><p class="sf-blurb">${esc(FOOTER_BLURB)}</p></div><div class="sf-cols">${FOOTER_GROUPS.map((g) => `<nav class="sf-col" aria-label="${esc(g.title)}"><h2>${esc(g.title)}</h2><ul>${g.links.map((l) => `<li><a href="${l.href}"${current(l.href)}>${esc(l.label)}</a></li>`).join('')}</ul></nav>`).join('')}</div></div><div class="sf-base"><p>© ${new Date().getFullYear()} ${esc(config.siteName)}. All rights reserved.</p><p>${esc(FOOTER_NOTE)}</p></div></div></footer>
<script src="/consent.js" defer></script><script src="/page.js" defer></script></body></html>
`;
};

// The packing list page is generated from the same template the app uses, so the two can never drift apart.
const totalItems = TEMPLATE.reduce((n, sec) => n + sec.items.length, 0);
const secId = (sec) => 'list-' + slugify(sec.title);
const checklistBody = `
<div class="pub-tools noprint"><button class="pub-btn" type="button" data-print>Print this list</button><a class="pub-btn alt" href="/#/checklist">Keep it in Flightdeck</a><span class="pub-stat">${TEMPLATE.length} sections · ${totalItems} items</span></div>
<nav class="noprint" aria-label="Jump to a section"><ul class="pub-jump">${TEMPLATE.map((sec) => `<li><a href="#${secId(sec)}">${esc(sec.title)}</a></li>`).join('')}</ul></nav>
<div class="ck-grid">${TEMPLATE.map((sec, i) => `<section class="ck-sec" id="${secId(sec)}" aria-labelledby="${secId(sec)}-h"><h2 id="${secId(sec)}-h"><span class="ck-n" aria-hidden="true">${i + 1}</span>${esc(sec.title)}<span class="ck-ct">${sec.items.length} items</span></h2>${sec.hint ? `<p class="ck-hint">${esc(sec.hint)}</p>` : ''}<ul>${sec.items.map((it) => `<li>${esc(it.text)}</li>`).join('')}</ul></section>`).join('\n')}</div>
<h2 class="noprint">How to use it</h2>
<ol class="ck-steps noprint"><li><b>1. Start days ahead</b><span>The first section holds the things that take time: visas, insurance and vaccinations.</span></li><li><b>2. Pack by section</b><span>Clothes, then the bathroom bag, then accessories, so nothing is forgotten halfway through.</span></li><li><b>3. Make it yours</b><span>Cross out what you never need and add what you always forget. In Flightdeck your edits are saved for every trip.</span></li><li><b>4. Finish with the last lists</b><span>The night-before and last-minute sections catch the keys, the charger and the back door.</span></li></ol>
<div class="pub-body noprint"><p>For entry requirements, visas and health advice for your destination, use the official <a href="https://www.gov.uk/foreign-travel-advice" rel="noopener">GOV.UK foreign travel advice</a>. Planning the day itself? Read the <a href="/guides/departure-day-airport-timeline/">departure day timeline</a> and the guide to <a href="/guides/pack-your-cabin-bag-for-a-long-flight/">packing your cabin bag</a>.</p></div>`;

const guideCards = (list, pill = true) => `<ul class="cards">${list.map((g) => `<li><a href="/${g.slug}/">${pill ? `<em>${esc(catTitle(g.category))}</em>` : ''}<strong>${esc(g.title)}</strong><span>${esc(g.description)}</span><span class="cd-meta">${minutesOf(g.body)} min read · Read the guide →</span></a></li>`).join('')}</ul>`;

fs.mkdirSync(dist, { recursive: true });
const written = [];
const write = (rel, content) => { const f = path.join(dist, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); written.push(rel); };

const all = pages(config).map((p) => (p.kind === 'checklist' ? { ...p, body: checklistBody } : p));
const guides = all.filter((p) => p.kind === 'guide');
const relatedFor = (g) => [...guides.filter((x) => x !== g && x.category === g.category), ...guides.filter((x) => x !== g && x.category !== g.category)].slice(0, 3);
for (const p of all) write(`${p.slug}/index.html`, shell({ ...p, updated: p.kind === 'guide' || p.kind === 'legal' ? config.lastReviewed : '', related: p.kind === 'guide' ? relatedFor(p) : undefined }));
const indexBody = `<p class="pub-sub" style="margin-top:0">${guides.length} short guides, written in plain English and checked against what airlines and airports actually publish. None of them is legal advice, and where rules matter we link to the official source.</p>
${guideCategories.map((c) => { const list = guides.filter((g) => g.category === c.id); return list.length ? `<section class="pub-cat" aria-labelledby="cat-${c.id}"><h2 id="cat-${c.id}">${esc(c.title)}</h2><p class="pub-sub">${esc(c.blurb)}</p>${guideCards(list, false)}</section>` : ''; }).join('\n')}
<section class="pub-promo" aria-label="Packing list"><div><h2>Need a packing list?</h2><p>A free printable list of ${totalItems} items in ${TEMPLATE.length} sections, built from a real paper packing list. Print it, or keep a reusable copy in Flightdeck.</p></div><a class="pub-btn" href="/travel-checklist/">Open the packing list</a></section>`;
write('guides/index.html', shell({ ...guideIndex, kind: 'index', body: indexBody }));

const urls = ['/', '/travel-checklist/', '/guides/', ...guides.map((g) => `/${g.slug}/`), '/about/', '/contact/', '/privacy/', '/cookies/', '/terms/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${config.url}${u}</loc><lastmod>${config.lastReviewed}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${config.url}/sitemap.xml\n`);
write('page.js', "document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[data-print]'))window.print()});\n");
for (const [f, code] of externalScripts) write(f.slice(1), code);
write('404.html', shell({ slug: 'not-found', kind: 'notfound', title: 'Page not found', description: 'That page does not exist or has moved.', body: '<div class="pub-body"><p>Try the <a href="/">Flightdeck app</a>, the <a href="/travel-checklist/">packing list</a> or the <a href="/guides/">travel guides</a>.</p></div>' }).replace('<link rel="canonical"', '<meta name="robots" content="noindex"><link rel="canonical"'));
if (adsOpen) write('ads.txt', `google.com, ${ads.pubId}, DIRECT, f08c47fec0942fa0\n`);

console.log(`[build-public] ${written.length} files written to ${path.relative(root, dist) || '.'} · GA ${gaId ? 'on (' + gaId + ')' : 'off'} · ads ${adsOpen ? 'ON' : 'off'}`);
