// Guards for the deploy gate (Phase 2): the shape of the workflows, the pinned actions and the post-deploy smoke list.
// These read the files as text on purpose: a workflow that merely "looks right" in review has already failed us once
// (deploy ran without the UI and console tests). Run with `pnpm test`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const ci = read('.github/workflows/ci.yml');
const deploy = read('.github/workflows/deploy.yml');
const release = JSON.parse(read('release.json'));
const pkg = JSON.parse(read('package.json'));

/** Every `uses:` line of a workflow. */
const uses = (yml) => [...yml.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)].map((m) => m[1]);

test('every third-party action in CI and Deploy is pinned to a full commit SHA', () => {
  for (const [name, yml] of [
    ['ci.yml', ci],
    ['deploy.yml', deploy],
  ]) {
    for (const u of uses(yml)) {
      if (u.startsWith('./')) continue; // a reusable workflow in this repository
      assert.match(u, /@[0-9a-f]{40}$/, `${name}: ${u} is not pinned by SHA`);
    }
  }
});

test('Deploy runs the CI checks first and the deploy job needs them', () => {
  assert.match(
    deploy,
    /^\s{2}check:\s*\n\s+uses:\s*\.\/\.github\/workflows\/ci\.yml\s*$/m,
    'Deploy has no check job calling ci.yml',
  );
  assert.match(
    deploy,
    /^\s{2}deploy:\s*\n(?:\s{4}.*\n)*?\s{4}needs:\s*check\s*$/m,
    'the deploy job does not need check',
  );
});

test('CI can be called by Deploy and still runs on pull requests', () => {
  assert.match(ci, /^\s{2}workflow_call:/m, 'ci.yml has no workflow_call');
  assert.match(ci, /^\s{2}pull_request:/m, 'ci.yml no longer runs on pull requests');
});

test('a pull request can never deploy: CI has no deploy job, no secrets and no push trigger', () => {
  assert.doesNotMatch(ci, /^\s{2}deploy:/m);
  assert.doesNotMatch(ci, /\$\{\{\s*secrets\./);
  // A push to main runs through Deploy (check, then deploy). A second CI run on the same push would only waste minutes.
  assert.doesNotMatch(ci, /^\s{2}push:/m);
});

test('a manual run deploys only from main', () => {
  assert.match(
    deploy,
    /^\s{2}deploy:\s*\n(?:\s{4}.*\n)*?\s{4}if:\s*github\.ref == 'refs\/heads\/main'\s*$/m,
  );
});

test('docs-only pushes still do not deploy', () => {
  const push = deploy.match(/^\s{2}push:\n((?:\s{4}.*\n)+)/m)?.[1] ?? '';
  assert.match(push, /branches:\s*\[main\]/);
  assert.match(push, /paths-ignore:.*docs\/\*\*.*\*\*\/\*\.md.*\.agent\/\*\*/);
});

test('CI and Deploy use the PHP version the server runs (8.4)', () => {
  assert.match(
    ci,
    /setup-php@[0-9a-f]{40}[\s\S]*?php-version:\s*"8\.4"/,
    'ci.yml does not set up PHP 8.4',
  );
  assert.match(deploy, /setup-php@[0-9a-f]{40}[\s\S]*?php-version:\s*"8\.4"/);
});

test('the typechecker runs once per gate, not twice', () => {
  const check = pkg.scripts.check;
  const build = pkg.scripts.build;
  assert.match(build, /tsc --noEmit/);
  assert.doesNotMatch(
    check,
    /typecheck/,
    '`pnpm check` runs tsc through `typecheck` and again through `build`',
  );
});

test('post-deploy smoke checks catch a broken sign-in, not just a dead site', () => {
  const by = (p) => release.smoke.find((s) => s.path.startsWith(p));
  assert.equal(
    by('/api/weather')?.status,
    401,
    'anonymous /api/weather must answer 401 (503 means no valid Clerk issuer)',
  );
  assert.match(by('/api/config')?.contains ?? '', /"signInRequired":true/);
  assert.ok(by('/')?.contains, '/ has no content check');
  assert.ok(by('/app/')?.contains, '/app/ has no content check');
  assert.match(by('/sitemap.xml')?.contains ?? '', /<urlset/);
});

test('the console smoke test does not use the live-account preview port (3993)', () => {
  assert.doesNotMatch(read('test/console-smoke.mjs'), /port:\s*3993/);
});

test('a real release with nothing to upload still runs the live smoke checks before it exits', () => {
  // Found live on 8 Nov 2026: the Phase 2 deploy printed "Nothing to upload" and exited before the smoke checks, so the new checks never ran.
  const script = read('scripts/release.mjs');
  const i = script.indexOf('if (!total) {');
  assert.ok(i > 0, 'the nothing-to-upload branch is gone; update this test');
  const branch = script.slice(i, script.indexOf('\n}\n', i));
  assert.match(
    branch,
    /if \(go\)/,
    'only a real release (--go) runs the checks; a dry run stays offline',
  );
  assert.match(
    branch,
    /await smoke\(\)/,
    'the smoke checks must run even though nothing was uploaded',
  );
  assert.match(branch, /fail\(/, 'an unhealthy site must fail the release');
});
