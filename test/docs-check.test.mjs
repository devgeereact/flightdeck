// Tests for scripts/docs-check.mjs (Phase 3): the checker that stops the written docs drifting from the code again.
// The last test runs the checker on this repository, so `pnpm test` fails the day a doc and the code disagree.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bannedHits,
  checkRepo,
  deadPathHits,
  missingRoutes,
  routesFromPhp,
} from '../scripts/docs-check.mjs';

test('routesFromPhp reads the literal routes the router answers', () => {
  const php = `
    if ($route === '/admin/overview') {}
    case $route === '/flights':
    elseif ($route === '/admin/content/faq-order' && $method === 'POST') {}
    $x = 'not a route';
  `;
  assert.deepEqual(routesFromPhp(php).sort(), [
    '/admin/content/faq-order',
    '/admin/overview',
    '/flights',
  ]);
});

test('missingRoutes names every route the API doc does not mention', () => {
  const md = 'GET /api/flights ... GET /api/admin/overview';
  assert.deepEqual(missingRoutes(md, ['/flights', '/me', '/admin/overview', '/admin/users']), [
    '/me',
    '/admin/users',
  ]);
});

test('missingRoutes does not count a longer path as a match for a shorter one', () => {
  assert.deepEqual(missingRoutes('GET /api/admin/enquiries/{id}', ['/admin/enquiries']), []); // prefix text is enough: documented together
  assert.deepEqual(missingRoutes('GET /api/me-too', ['/me']), ['/me']);
});

test('bannedHits finds a stale phrase with its file and line number', () => {
  const hits = bannedHits(
    'docs/API.md',
    'one\nGuest endpoints, no authentication implemented.\nthree',
    [{ re: /Guest endpoints, no authentication/i, why: 'sign-in exists' }],
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
  assert.match(hits[0].message, /docs\/API\.md:2/);
  assert.match(hits[0].message, /sign-in exists/);
});

test('bannedHits ignores a line that says the thing was retired', () => {
  const hits = bannedHits(
    'docs/INDEX.md',
    'Retired on 1 Nov 2026: VERIFICATION.md and docs/history/',
    [{ re: /VERIFICATION\.md/, why: 'dead file' }],
  );
  assert.deepEqual(hits, []);
});

test('deadPathHits flags a repo path that does not exist and skips retired, URL and placeholder paths', () => {
  const exists = (p) => p === 'docs/API.md';
  const md = [
    'See `docs/API.md` and `docs/GONE.md`.',
    'Link [ok](API.md) and [bad](NOPE.md) and [web](https://example.com/x.md) and [top](#section).',
    'Retired: `docs/OLD.md` is in git history.',
    'Placeholder `docs/<name>.md` and glob `docs/*.md`.',
  ].join('\n');
  const hits = deadPathHits('docs/INDEX.md', md, exists)
    .map((h) => h.path)
    .sort();
  assert.deepEqual(hits, ['docs/GONE.md', 'docs/NOPE.md']);
});

test('deadPathHits skips site-absolute links such as [text](/path/)', () => {
  assert.deepEqual(
    deadPathHits('docs/CMS.md', 'Write `[text](/path/)` for a link.', () => false),
    [],
  );
});

test('a rule with a files list only applies to those files', () => {
  const rules = [{ re: /development instance/i, why: 'x', files: ['docs/INTEGRATIONS.md'] }];
  assert.equal(bannedHits('docs/INTEGRATIONS.md', 'a development instance', rules).length, 1);
  assert.equal(bannedHits('docs/LOCAL-LIVE-LOGIN.md', 'a development instance', rules).length, 0);
});

test('this repository: docs, comments and code agree (pnpm docs:check)', () => {
  const problems = checkRepo();
  assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
});
