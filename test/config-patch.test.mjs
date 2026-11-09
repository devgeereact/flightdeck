// Tests for scripts/lib/config-patch.php: the small PHP program scripts/set-bright-data.sh and scripts/set-anthropic-key.sh run on
// the server to set `brightdata_key`, `brightdata_zone` and `anthropic_key` in the private config.php. It must never print or log
// the secret, must keep a backup, must refuse to leave a file that does not lint, and may only touch the three allowed keys.
// The tests use the exact transport the shell script uses (PHP source base64-encoded into `php -r`), on a temp copy.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const patchSrc = fs.readFileSync(path.join(root, 'scripts/lib/config-patch.php'), 'utf8');
const example = fs.readFileSync(path.join(root, 'php/private/config.example.php'), 'utf8');
const KEY = `bd_TEST_${'a'.repeat(32)}`; // obviously fake, and low-entropy so the secret scan does not mistake it for a real key

function tmpConfig(text = example) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-cfgpatch-'));
  const file = path.join(dir, 'config.php');
  fs.writeFileSync(file, text, { mode: 0o600 });
  return { dir, file };
}

/** Run the patch the way the shell script does: base64 of the PHP (without its opening tag) through `php -r`. */
function run(file, payload) {
  const code = Buffer.from(patchSrc.replace(/^<\?php\s*/, '')).toString('base64');
  return spawnSync('php', ['-r', `eval(base64_decode('${code}'));`, '--', file], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

const load = (file) =>
  JSON.parse(
    execFileSync('php', ['-r', 'echo json_encode(require $argv[1]);', '--', file], {
      encoding: 'utf8',
    }),
  );

test('sets the key and zone in a config that has them empty, and the file still loads', () => {
  const { file } = tmpConfig();
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'serp_api1' });
  assert.equal(r.status, 0, r.stderr);
  const c = load(file);
  assert.equal(c.brightdata_key, KEY);
  assert.equal(c.brightdata_zone, 'serp_api1');
  assert.equal(c.aerodatabox_monthly_units, 360, 'other settings are untouched');
  assert.equal(c.brightdata_daily_cap, 200);
});

test('never prints or logs the secret', () => {
  const { file } = tmpConfig();
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'serp_api1' });
  assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY), 'the key appeared in the output');
  assert.match(r.stdout, /brightdata_key/);
  assert.match(r.stdout, /set/);
});

test('adds the keys when the config does not have them at all', () => {
  const { file } = tmpConfig("<?php\nreturn [\n    'owner_email' => 'a@b.example',\n];\n");
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'z1' });
  assert.equal(r.status, 0, r.stderr);
  const c = load(file);
  assert.equal(c.owner_email, 'a@b.example');
  assert.equal(c.brightdata_key, KEY);
  assert.equal(c.brightdata_zone, 'z1');
});

test('keeps a private backup of the previous file and a private file mode', () => {
  const { dir, file } = tmpConfig();
  const before = fs.readFileSync(file, 'utf8');
  run(file, { brightdata_key: KEY, brightdata_zone: 'serp_api1' });
  const backups = fs.readdirSync(dir).filter((f) => f.startsWith('config.php.bak-'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(dir, backups[0]), 'utf8'), before);
  assert.equal(fs.statSync(path.join(dir, backups[0])).mode & 0o777, 0o600);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('is safe to run twice and replaces the old values', () => {
  const { file } = tmpConfig();
  run(file, { brightdata_key: KEY, brightdata_zone: 'old_zone' });
  const r = run(file, { brightdata_key: `${KEY}2`, brightdata_zone: 'new_zone' });
  assert.equal(r.status, 0, r.stderr);
  const c = load(file);
  assert.equal(c.brightdata_zone, 'new_zone');
  assert.equal(c.brightdata_key, `${KEY}2`);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal([...text.matchAll(/'brightdata_key'\s*=>/g)].length, 1, 'the key must appear once');
});

test('refuses values that could break out of the PHP string, and changes nothing', () => {
  const { file } = tmpConfig();
  const before = fs.readFileSync(file, 'utf8');
  for (const bad of [
    "x'; system('id'); //",
    'a b c d e f g h',
    'a"b"c"d"e"f"g',
    '',
    'short',
    'back\\slash_slash',
  ]) {
    const r = run(file, { brightdata_key: bad, brightdata_zone: 'serp_api1' });
    assert.notEqual(r.status, 0, `accepted ${JSON.stringify(bad)}`);
  }
  assert.notEqual(run(file, { brightdata_key: KEY, brightdata_zone: 'bad zone!' }).status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'the file must be unchanged after a refusal');
});

test('only the two Bright Data keys may be set', () => {
  const { file } = tmpConfig();
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'z1', admin_user_ids: 'evil' });
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('if the edited file would not lint, the original is kept', () => {
  // A config that ends without the closing bracket cannot be patched into valid PHP: the program must say so and leave it alone.
  const { file } = tmpConfig("<?php\nreturn [\n    'owner_email' => 'a@b.example',\n");
  const before = fs.readFileSync(file, 'utf8');
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'z1' });
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('scripts/set-bright-data.sh works end to end with a fake ssh and curl, and never echoes the token', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-fakehome-'));
  fs.mkdirSync(path.join(home, 'flightdeck-private'));
  fs.writeFileSync(path.join(home, 'flightdeck-private/config.php'), example, { mode: 0o600 });
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-fakebin-'));
  // The fake ssh drops the host argument and runs the remote command here, with HOME pointing at the fake server home.
  fs.writeFileSync(path.join(bin, 'ssh'), '#!/bin/bash\nshift\nexec bash -c "$1"\n', {
    mode: 0o755,
  });
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/bash\necho \'{"webCheck":true}\'\n', {
    mode: 0o755,
  });
  fs.writeFileSync(path.join(bin, 'sleep'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
  const r = spawnSync('bash', [path.join(root, 'scripts/set-bright-data.sh')], {
    input: `serp_api1\n${KEY}\n`,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.ok(!r.stdout.includes(KEY) && !r.stderr.includes(KEY), 'the token was echoed');
  assert.match(r.stdout, /webCheck:true/);
  const c = load(path.join(home, 'flightdeck-private/config.php'));
  assert.equal(c.brightdata_key, KEY);
  assert.equal(c.brightdata_zone, 'serp_api1');
});

test('scripts/set-bright-data.sh refuses a bad zone before sending anything', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-fakebin-'));
  fs.writeFileSync(path.join(bin, 'ssh'), '#!/bin/bash\necho SSH-WAS-CALLED >&2\nexit 9\n', {
    mode: 0o755,
  });
  const r = spawnSync('bash', [path.join(root, 'scripts/set-bright-data.sh')], {
    input: `bad zone!\n${KEY}\n`,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.notEqual(r.status, 0);
  assert.ok(!r.stderr.includes('SSH-WAS-CALLED'));
});

// The real server config.php (written by a tool on 25 Oct 2026) uses the older `return array ( ... );` style with a few
// short-array values. The first live run of set-bright-data.sh refused it with "could not find the closing ];".
const OLD_STYLE = `<?php
return array (
  'owner_email' => 'a@b.example',
  'aerodatabox_key' => 'x',
  'admin_user_ids' => ['user_one'],
  'clerk_authorized_parties' => ['https://flightdeck.gakinz.com'],
  'home_country_code' => 'GB',
);
`;

test('works on a config in the older array ( ... ); style, adds the keys and keeps the short arrays', () => {
  const { file } = tmpConfig(OLD_STYLE);
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'mcp_serp' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const c = load(file);
  assert.equal(c.brightdata_key, KEY);
  assert.equal(c.brightdata_zone, 'mcp_serp');
  assert.deepEqual(c.admin_user_ids, ['user_one']);
  assert.equal(c.owner_email, 'a@b.example');
  assert.equal(c.home_country_code, 'GB');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /\n {2}'brightdata_key' => /, "new lines use the file's own two-space indent");
  assert.ok(text.trimEnd().endsWith(');'));
});

test('replaces existing Bright Data values in the older style, once', () => {
  const { file } = tmpConfig(
    OLD_STYLE.replace(
      ');\n',
      "  'brightdata_zone' => 'old_zone',\n  'brightdata_key' => '',\n);\n",
    ),
  );
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'mcp_serp' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal([...text.matchAll(/'brightdata_zone'\s*=>/g)].length, 1);
  assert.equal(load(file).brightdata_zone, 'mcp_serp');
});

test('a short-array config with nested ); inside strings is still patched at the real end', () => {
  const { file } = tmpConfig(
    "<?php\nreturn [\n    'note' => 'see foo(); bar);',\n    'owner_email' => 'a@b.example',\n];\n",
  );
  const r = run(file, { brightdata_key: KEY, brightdata_zone: 'z1' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const c = load(file);
  assert.equal(c.note, 'see foo(); bar);');
  assert.equal(c.brightdata_zone, 'z1');
});

// ---- the Anthropic key (ADR-025)
const AKEY = `sk-ant-TEST-${'a'.repeat(32)}_-`; // obviously fake and low-entropy; has the underscore and dash real keys use

test('sets the Anthropic key alone, keeps the other keys, never prints it', () => {
  const { file } = tmpConfig();
  run(file, { brightdata_key: KEY, brightdata_zone: 'serp_api1' });
  const r = run(file, { anthropic_key: AKEY });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes(AKEY) && !r.stderr.includes(AKEY), 'the key appeared in the output');
  assert.match(r.stdout, /anthropic_key/);
  const c = load(file);
  assert.equal(c.anthropic_key, AKEY);
  assert.equal(c.brightdata_key, KEY, 'the Bright Data settings are untouched');
});

test('the example config carries an empty anthropic_key line that the patch replaces in place', () => {
  assert.match(example, /'anthropic_key' => '',/);
  const { file } = tmpConfig();
  run(file, { anthropic_key: AKEY });
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text.match(/'anthropic_key'/g)?.length, 1, 'one line, replaced, not appended');
});

test('refuses an Anthropic key with spaces, quotes, a backslash or a short value, and changes nothing', () => {
  const { file } = tmpConfig();
  const before = fs.readFileSync(file, 'utf8');
  for (const bad of [`${AKEY} x`, `${AKEY}'`, `${AKEY}\\`, 'sk-ant-short', `"${AKEY}"`]) {
    const r = run(file, { anthropic_key: bad });
    assert.notEqual(r.status, 0, `accepted ${JSON.stringify(bad)}`);
  }
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('still refuses any other key, such as the Clerk secret', () => {
  const { file } = tmpConfig();
  const r = run(file, { anthropic_key: AKEY, clerk_secret_key: 'x'.repeat(30) });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /only brightdata_key, brightdata_zone and anthropic_key/);
});

test('scripts/set-anthropic-key.sh works end to end with a fake ssh and curl, on the older config style, and never echoes the key', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-fakehome-'));
  fs.mkdirSync(path.join(home, 'flightdeck-private'));
  fs.writeFileSync(path.join(home, 'flightdeck-private/config.php'), OLD_STYLE, { mode: 0o600 });
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-fakebin-'));
  const argsLog = path.join(bin, 'ssh-args.txt');
  fs.writeFileSync(
    path.join(bin, 'ssh'),
    `#!/bin/bash\nprintf '%s\\n' "$@" > '${argsLog}'\nshift\nexec bash -c "$1"\n`,
    { mode: 0o755 },
  );
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/bash\necho \'{"webFacts":true}\'\n', {
    mode: 0o755,
  });
  fs.writeFileSync(path.join(bin, 'sleep'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
  const r = spawnSync('bash', [path.join(root, 'scripts/set-anthropic-key.sh')], {
    input: `${AKEY}\n`,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.ok(!r.stdout.includes(AKEY) && !r.stderr.includes(AKEY), 'the key was echoed');
  assert.ok(!fs.readFileSync(argsLog, 'utf8').includes(AKEY), 'the key was put on a command line');
  assert.match(r.stdout, /webFacts:true/);
  const c = load(path.join(home, 'flightdeck-private/config.php'));
  assert.equal(c.anthropic_key, AKEY);
  assert.equal(c.owner_email, 'a@b.example', 'the rest of the older-style config is kept');
});

test('scripts/set-anthropic-key.sh refuses a key with a space before sending anything', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-fakebin-'));
  fs.writeFileSync(path.join(bin, 'ssh'), '#!/bin/bash\necho SSH-WAS-CALLED >&2\nexit 9\n', {
    mode: 0o755,
  });
  const r = spawnSync('bash', [path.join(root, 'scripts/set-anthropic-key.sh')], {
    input: `${AKEY} with space\n`,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.notEqual(r.status, 0);
  assert.ok(!r.stderr.includes('SSH-WAS-CALLED'));
});
