// Drift guard (Phase 5): the anonymous event names the server accepts must be the ones the app really sends. Before, two accepted names
// (`cta_click`, `signup_started`) were never sent and one summed name (`checklist_save`) was not even countable, so their console tiles
// were always 0 and misleading. Reads source as text on purpose.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir) =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(`${dir}/${e.name}`)
        : /\.(ts|tsx|js)$/.test(e.name)
          ? [`${dir}/${e.name}`]
          : [],
    );

const admin = read('php/private/src/Admin.php');
const accepted = [...admin.match(/const EVENTS = \[([^\]]*)\]/)[1].matchAll(/'([a-z_]+)'/g)].map(
  (m) => m[1],
);

const sent = new Set();
for (const f of walk('src'))
  for (const m of read(f).matchAll(/\btrack(?:Once)?\(\s*'([a-z_]+)'\s*\)/g)) sent.add(m[1]);
// public/consent.js reports the visitor's cookie choice itself.
for (const m of read('public/consent.js').matchAll(/'(consent_(?:accept|reject))'/g))
  sent.add(m[1]);

test('every event name the server accepts is sent by the app', () => {
  const never = accepted.filter((n) => !sent.has(n));
  assert.deepEqual(never, [], `accepted but never sent: ${never.join(', ')}`);
});

test('every event name the app sends is accepted by the server', () => {
  const rejected = [...sent].filter((n) => !accepted.includes(n));
  assert.deepEqual(rejected, [], `sent but refused by the server: ${rejected.join(', ')}`);
});

test('the overview does not sum a counter that nothing ever counts', () => {
  const summed = [...admin.matchAll(/self::sum\(\$days, '([a-z_]+)'\)/g)].map((m) => m[1]);
  // Counted either through /api/event (the accepted names) or by the server itself with Metrics::count(...).
  const counted = new Set(accepted);
  const phpFiles = fs
    .readdirSync(path.join(root, 'php/private/src'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.php'));
  for (const f of phpFiles) {
    // the whole argument, so `Metrics::count($x ? 'a' : 'b')` counts both names
    for (const call of read(`php/private/src/${f}`).matchAll(/Metrics::count\(([^;]*)\);/g))
      for (const m of call[1].matchAll(/'([a-z_]+)'/g)) counted.add(m[1]);
  }
  const never = summed.filter((n) => !counted.has(n));
  assert.deepEqual(never, [], `summed but never counted: ${never.join(', ')}`);
});
