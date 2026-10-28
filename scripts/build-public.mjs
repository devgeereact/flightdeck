// Public-website assets for the server-rendered pages (php/private/src/Site). Pages themselves are rendered by PHP from CMS content;
// this writes the files they load, with content hashes so they can be cached for a year:
//   site-<hash>.css   fonts + tokens + footer + packing board + site styles
//   site-<hash>.js, lenis-<hash>.js, js/contact-<hash>.js, js/travel-checklist-<hash>.js
//   site-build.json   the file names above and the public GA4 Measurement ID, read by public/site.php
//   robots.txt
// Usage: node scripts/build-public.mjs [--dist dist]
// Public pages request nothing from third parties. The only scripts they load are /consent.js and the files above (our own).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const root = path.resolve(import.meta.dirname, '..');
const dist = path.resolve(arg('dist', path.join(root, 'dist')));
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const rawGa = (process.env.VITE_GA_ID || '').trim();
const gaId = /^G-[A-Z0-9]{6,12}$/.test(rawGa) ? rawGa : '';
if (rawGa && !gaId)
  console.warn(
    '[build-public] VITE_GA_ID is not a valid GA4 Measurement ID (expected G-XXXXXXXXXX); building without analytics.',
  );

const css =
  [
    'src/fonts.css',
    'src/styles/tokens.css',
    'src/siteFooter.css',
    'src/features/checklist/packingBoard.css',
    'src/styles/site.css',
  ]
    .map((f) =>
      read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\n{2,}/g, '\n')
        .trim(),
    )
    .join('\n') + '\n';

fs.mkdirSync(dist, { recursive: true });
const written = [];
const hashed = (dir, base, ext, content) => {
  const name = `${base}-${crypto.createHash('sha256').update(content).digest('hex').slice(0, 10)}.${ext}`;
  const rel = dir ? `${dir}/${name}` : name;
  fs.mkdirSync(path.join(dist, dir || '.'), { recursive: true });
  fs.writeFileSync(path.join(dist, rel), content);
  written.push(rel);
  return '/' + rel;
};
const build = {
  css: hashed('', 'site', 'css', css),
  js: hashed('', 'site', 'js', read('src/site/site.js')),
  contactJs: hashed('js', 'contact', 'js', read('src/site/contact.js')),
  checklistJs: hashed('js', 'travel-checklist', 'js', read('src/site/travel-checklist.js')),
  // Smooth scrolling for the public pages only (never the app or console). site.js starts it unless the visitor prefers reduced motion.
  lenisJs: hashed('', 'lenis', 'js', read('node_modules/lenis/dist/lenis.min.js')),
  gaId,
};
fs.writeFileSync(path.join(dist, 'site-build.json'), JSON.stringify(build) + '\n');
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /app/\n\nSitemap: https://flightdeck.gakinz.com/sitemap.xml\n',
);
written.push('site-build.json', 'robots.txt');

console.log(
  `[build-public] ${written.length} files written to ${path.relative(root, dist) || '.'} · GA ${gaId ? 'on (' + gaId + ')' : 'off'}`,
);
