// Builds the CMS seed (php/private/src/Content/seed.json): the content the site shows before anything is published in the
// owner console, and the starting point of the first draft. Sources: content/pages.mjs (existing public pages, converted from HTML
// to the safe Markdown subset), content/site-content.mjs (new pages, home, FAQs, navigation) and the packing-list template.
// Usage: node scripts/seed-content.mjs [--check]   (--check exits 1 if seed.json is out of date)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'php/private/src/Content/seed.json');
const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const config = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const { pages, guideCategories } = await imp('content/pages.mjs');
const site = await imp('content/site-content.mjs');
const { TEMPLATE } = await imp('src/checklistTemplate.ts');

// Settings become placeholders so a change in the console reaches every page that mentions them.
const P = { ownerName: '{{ownerName}}', contactEmail: '{{contactEmail}}', lastReviewed: '{{lastReviewed}}', url: '{{siteUrl}}', siteName: 'Flightdeck' };

const esc = (t) => t.replace(/\\/g, '\\\\').replace(/([*`[\]|])/g, '\\$1');
const keepPlaceholders = (t) => t.replace(/\\\{\\\{|\{\{/g, '{{'); // placeholders pass through untouched

function inline(node) {
  let s = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) { s += esc(n.textContent.replace(/\s+/g, ' ')); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toLowerCase();
    const inner = inline(n);
    if (tag === 'strong' || tag === 'b') s += `**${inner.trim()}**`;
    else if (tag === 'em' || tag === 'i') s += `*${inner.trim()}*`;
    else if (tag === 'code') s += '`' + n.textContent + '`';
    else if (tag === 'a') s += `[${inner.trim()}](${n.hasAttribute('data-fd-cookie-settings') ? '#cookie-settings' : n.getAttribute('href')})`;
    else if (tag === 'br') s += ' ';
    else if (tag === 'span') s += inner;
    else throw new Error(`Unsupported inline <${tag}>`);
  }
  return keepPlaceholders(s);
}

function blocks(container) {
  const outB = [];
  for (const n of container.childNodes) {
    if (n.nodeType === 3) { if (n.textContent.trim()) throw new Error(`Loose text: ${n.textContent.trim().slice(0, 40)}`); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toLowerCase();
    if (tag === 'p') outB.push(inline(n).trim());
    else if (/^h[2-4]$/.test(tag)) outB.push('#'.repeat(Number(tag[1])) + ' ' + inline(n).trim());
    else if (tag === 'ul' || tag === 'ol') outB.push([...n.children].map((li, i) => (tag === 'ul' ? '- ' : `${i + 1}. `) + inline(li).trim()).join('\n'));
    else if (tag === 'table') {
      const rows = [...n.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => inline(c).trim()));
      const width = Math.max(...rows.map((r) => r.length));
      const line = (r) => '| ' + Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ') + ' |';
      outB.push([line(rows[0]), '|' + ' --- |'.repeat(width), ...rows.slice(1).map(line)].join('\n'));
    } else throw new Error(`Unsupported block <${tag}>`);
  }
  return outB.join('\n\n');
}

export const htmlToMarkdown = (html) => blocks(new JSDOM(`<body>${html}</body>`).window.document.body);

const converted = {};
for (const p of pages(P)) {
  let body = p.body;
  if (p.kind === 'contact') body = body.replace(/<form[\s\S]*<\/script>/, ''); // the form is part of the page template
  if (p.kind === 'checklist') body = ''; // the board is generated from the template; the intro is in site-content
  body = body.replace(/\$\{[^}]*\}/g, (m) => { throw new Error(`Unresolved template in ${p.slug}: ${m}`); });
  converted[p.slug] = {
    slug: p.slug, kind: p.kind === 'legal' && p.slug === 'about' ? 'about' : p.kind, title: p.title, description: p.description,
    body: htmlToMarkdown(body).replaceAll("{{ownerName}}, who runs Flightdeck", "{{ownerName}}"), ...(p.category ? { category: p.category } : {}), ...(p.takeaways ? { takeaways: p.takeaways } : {}),
  };
}
// The contact intro without the conditional: an owner email is required in settings.
converted.contact.body = 'You can email [{{contactEmail}}](mailto:{{contactEmail}}) or use the form below. We read every message. Please do not include passwords or payment details.';

const pageList = { ...site.pages, ...converted, ...site.overrides };
for (const [slug, pg] of Object.entries(site.overrides)) pageList[slug] = { ...converted[slug], ...pg };
const seed = {
  version: 1,
  settings: { siteName: config.siteName, siteUrl: config.url, ownerName: config.ownerName, contactEmail: config.contactEmail, lastReviewed: config.lastReviewed, ...site.settings() },
  navigation: site.navigation,
  guideCategories,
  pages: Object.fromEntries(Object.entries(pageList).sort(([a], [b]) => a.localeCompare(b))),
  faqs: site.faqs,
  announcements: [],
  checklistTemplate: TEMPLATE,
};
const json = JSON.stringify(seed, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (cur !== json) { console.error('seed.json is out of date: run node scripts/seed-content.mjs'); process.exit(1); }
  console.log('seed.json is up to date');
} else {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json);
  console.log(`[seed] ${Object.keys(seed.pages).length} pages, ${seed.faqs.length} FAQs -> ${path.relative(root, out)}`);
}
