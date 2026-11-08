#!/usr/bin/env node
// docs:check. Stops the written docs drifting from the code again (Phase 3). It is a text check, not a proof the docs
// are right: it catches (1) an API route the router answers that docs/API.md never mentions, (2) phrases we have
// already found to be false and retired, (3) a repo path in a live doc that no longer exists.
// History files (AUDIT, CHANGELOG, DECISIONS, .agent/HANDOFF) describe the past and are never checked for stale phrases.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

/** Lines that say something was retired, removed or replaced may name the old thing. */
const RETIRED =
  /\b(retired|removed|superseded|archived|git history|no longer|replaced|obsolete)\b/i;

/** Literal routes the PHP router answers: `$route === '/x'`. */
export function routesFromPhp(src) {
  return [...new Set([...src.matchAll(/\$route === '(\/[A-Za-z0-9/-]+)'/g)].map((m) => m[1]))];
}

/** Routes that docs/API.md must mention as `/api<route>` (a longer path is not a match). */
export function missingRoutes(apiMd, routes) {
  return routes.filter(
    (r) =>
      !new RegExp(`/api${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`).test(apiMd),
  );
}

/** Stale phrases in a live document. `rules`: [{re, why}]. A line that says the thing was retired is allowed. */
export function bannedHits(file, text, rules) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (RETIRED.test(line)) return;
    for (const { re, why, files, except } of rules)
      if ((!files || files.includes(file)) && !except?.includes(file) && re.test(line))
        out.push({ file, line: i + 1, message: `${file}:${i + 1}: ${why} (matched ${re})` });
  });
  return out;
}

const REPO_PATH =
  /`((?:docs|scripts|src|php|test|content|public|\.agent|\.github)\/[A-Za-z0-9._/-]*[A-Za-z0-9_])`/g;
const MD_LINK = /\]\(([^)\s]+)\)/g;
/** Paths that are real but not in the repository: private config, build output, server-only folders. */
const NOT_IN_REPO = /^(php\/private\/(config\.php|var)(\/|$)|dist\/|public\/api\/config\.php)/;

/** Repo paths named in a live document that do not exist. `exists(repoRelativePath)`. */
export function deadPathHits(file, text, exists) {
  const out = [];
  const dir = path.posix.dirname(file);
  const seen = new Set();
  text.split('\n').forEach((line, i) => {
    if (RETIRED.test(line)) return;
    const found = [];
    for (const m of line.matchAll(REPO_PATH)) found.push(m[1]);
    for (const m of line.matchAll(MD_LINK)) {
      const target = m[1].split('#')[0];
      if (!target || target.startsWith('/') || /^(https?:|mailto:|tel:|#)/.test(m[1])) continue; // site-absolute links are not repo paths
      found.push(path.posix.normalize(path.posix.join(dir, target)));
    }
    for (const p of found) {
      if (/[<>{}*]/.test(p) || NOT_IN_REPO.test(p) || seen.has(`${i}:${p}`)) continue;
      seen.add(`${i}:${p}`);
      if (!exists(p.replace(/\/$/, '')))
        out.push({
          file,
          line: i + 1,
          path: p,
          message: `${file}:${i + 1}: \`${p}\` does not exist`,
        });
    }
  });
  return out;
}

/** Phrases that were true once and are now false. Add a rule when a doc is found lying; never remove one to pass. */
export const STALE_PHRASES = [
  {
    re: /Guest endpoints, no authentication/i,
    why: 'sign-in exists: protected routes need a Clerk token',
  },
  { re: /not released/i, why: 'the site, CMS and console are live' },
  { re: /Clerk[^|\n]*\|\s*NOT IMPLEMENTED/, why: 'Clerk sign-in is implemented and live' },
  { re: /Hosting target not configured/i, why: 'the app is deployed on cPanel behind Cloudflare' },
  {
    re: /Google Fonts[^\n]*CSS import/i,
    why: 'fonts are self-hosted (public/fonts); no Google Fonts request',
  },
  {
    re: /Clerk workspace, development instance/i,
    why: 'the live Clerk instance is production (pk_live)',
    files: ['docs/INTEGRATIONS.md'],
  },
  { re: /Guest access is the current model/i, why: 'flight look-ups need a signed-in user' },
  {
    re: /Three curated demo destinations/i,
    why: 'Discover works for any city (Wikivoyage/Wikipedia)',
  },
  { re: /Live lookup is callsign-based/i, why: 'AeroDataBox gives schedules, gates and dates' },
  {
    re: /\bads\\?\.txt\b|adsbygoogle|ads gate|ad slots?\b/i,
    why: 'the ads path was removed (Phase 4); only docs/MONETISATION.md may explain that',
    except: ['docs/MONETISATION.md'],
  },
];

/** Dead references in code comments and config (not in docs): the old Node server folder. */
export const DEAD_CODE_REFS = [
  {
    re: /\bserver\/flight(\.test)?\.ts\b/,
    why: 'the Node server was archived (ADR-018); there is no server/ folder',
  },
  { re: /!!\*\*\/server/, why: 'there is no server/ folder to ignore' },
  // The ads path was removed in Phase 4 (personal, non-commercial app). None of it may come back by accident.
  {
    re: /adsbygoogle|googlesyndication|ads_(enabled|licence_cleared|cmp_ready|pub_id|slots)|\bads\\?\.txt\b|\bad-slot\b|AdSense|"ads"\s*:\s*\{/,
    why: 'the ads path was removed (Phase 4); the app is personal and non-commercial',
  },
  {
    re: /<b>Adverts<\/b>|\['Adverts'/,
    why: 'the console no longer has an Adverts row (Phase 4)',
  },
];

const HISTORY = new Set(['docs/AUDIT.md', 'docs/CHANGELOG.md', 'docs/DECISIONS.md']);

function liveDocs() {
  const docs = readdirSync(path.join(root, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/${f}`)
    .filter((f) => !HISTORY.has(f));
  return [...docs, 'AGENTS.md', 'README.md'].filter((f) => existsSync(path.join(root, f)));
}

function walk(dir, ext, out = []) {
  for (const e of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'vendor' || e.name === 'var' || e.name === 'node_modules') continue;
      walk(rel, ext, out);
    } else if (ext.some((x) => e.name.endsWith(x))) out.push(rel);
  }
  return out;
}

export function checkRepo() {
  const read = (f) => readFileSync(path.join(root, f), 'utf8');
  const exists = (p) => existsSync(path.join(root, p));
  const problems = [];

  const routes = [
    ...routesFromPhp(read('php/private/src/App.php')),
    ...routesFromPhp(read('php/private/src/Cms.php')),
  ];
  // Routes matched by pattern rather than a literal string in the router; they must still be documented.
  const patterned = [
    '/admin/enquiries/{id}',
    '/admin/enquiries/{id}/reply',
    '/admin/content/{type}',
    '/admin/content/{type}/{id}',
  ];
  for (const r of missingRoutes(read('docs/API.md'), [...new Set([...routes, ...patterned])]))
    problems.push(`docs/API.md: the router answers /api${r} but the API doc never mentions it`);

  for (const f of liveDocs()) {
    const text = read(f);
    for (const h of bannedHits(f, text, STALE_PHRASES)) problems.push(h.message);
    for (const h of deadPathHits(f, text, exists)) problems.push(h.message);
  }

  const codeFiles = [
    ...walk('php/private/src', ['.php', '.json']),
    'php/tests/run.php',
    ...walk('scripts', ['.mjs', '.sh']).filter((f) => f !== 'scripts/docs-check.mjs'),
    ...walk('src', ['.ts', '.tsx', '.js', '.css']),
    ...walk('content', ['.mjs', '.json']),
    'public/.htaccess',
    'public/consent.js',
    'site.config.json',
    'biome.json',
  ].filter(exists);
  for (const f of codeFiles)
    for (const h of bannedHits(f, read(f), DEAD_CODE_REFS)) problems.push(h.message);

  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = checkRepo();
  if (problems.length) {
    console.error(
      `docs:check found ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n  ${problems.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log('docs:check passed: routes documented, no stale phrases, no dead paths.');
}
