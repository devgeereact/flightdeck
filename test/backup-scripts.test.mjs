// Tests for the two owner-run backup scripts (found needed by the 8 Nov 2026 restore drill: the server's nightly backup cron entry
// had disappeared and no backup had been made since 1 Nov). Both are run here with a fake ssh/scp/crontab, so nothing touches a server.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const exe = (file, body) => fs.writeFileSync(file, body, { mode: 0o755 });

/** A fake server home plus fake `ssh` (runs the remote command here) and `crontab` (a file). */
function fakeServer(initialCrontab, { withScript = true } = {}) {
  const home = tmp('fd-srv-');
  if (withScript) exe(path.join(home, 'flightdeck-backup.sh'), '#!/bin/bash\nexit 0\n');
  const bin = tmp('fd-bin-');
  const store = path.join(home, 'crontab.store');
  if (initialCrontab !== null) fs.writeFileSync(store, initialCrontab);
  exe(path.join(bin, 'ssh'), '#!/bin/bash\nshift\nexec "$@"\n');
  exe(
    path.join(bin, 'crontab'),
    `#!/bin/bash\nif [ "$1" = "-l" ]; then [ -f "${store}" ] && cat "${store}" || { echo "no crontab for user" >&2; exit 1; }; else cp "$1" "${store}"; fi\n`,
  );
  return { home, bin, store };
}

const OTHER =
  '0,5,10 * * * * /usr/local/bin/php $HOME/other-project/cron.php >> $HOME/other.log 2>&1\n';

test('install-backup-cron.sh adds the nightly line, keeps the other jobs and keeps a copy of the old crontab', () => {
  const s = fakeServer(OTHER);
  const r = spawnSync('bash', [path.join(root, 'scripts/install-backup-cron.sh')], {
    encoding: 'utf8',
    env: { ...process.env, HOME: s.home, PATH: `${s.bin}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const after = fs.readFileSync(s.store, 'utf8');
  assert.ok(after.includes(OTHER.trim()), 'the other project job must survive');
  assert.equal([...after.matchAll(/flightdeck-backup\.sh/g)].length, 1);
  assert.match(after, /^23 2 \* \* \* /m);
  const hist = path.join(s.home, 'backups/_crontab-history');
  const saved = fs.readdirSync(hist);
  assert.equal(saved.length, 1);
  assert.equal(fs.readFileSync(path.join(hist, saved[0]), 'utf8'), OTHER);
});

test('install-backup-cron.sh is safe to run twice', () => {
  const s = fakeServer(OTHER);
  const env = { ...process.env, HOME: s.home, PATH: `${s.bin}:${process.env.PATH}` };
  const run = () =>
    spawnSync('bash', [path.join(root, 'scripts/install-backup-cron.sh')], {
      encoding: 'utf8',
      env,
    });
  assert.equal(run().status, 0);
  const once = fs.readFileSync(s.store, 'utf8');
  const second = run();
  assert.equal(second.status, 0);
  assert.match(second.stdout, /already/i);
  assert.equal(fs.readFileSync(s.store, 'utf8'), once);
});

test('install-backup-cron.sh works when the server has no crontab yet', () => {
  const s = fakeServer(null);
  const r = spawnSync('bash', [path.join(root, 'scripts/install-backup-cron.sh')], {
    encoding: 'utf8',
    env: { ...process.env, HOME: s.home, PATH: `${s.bin}:${process.env.PATH}` },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(fs.readFileSync(s.store, 'utf8'), /flightdeck-backup\.sh/);
});

test('install-backup-cron.sh refuses, and changes nothing, if the backup script is not on the server', () => {
  const s = fakeServer(OTHER, { withScript: false });
  const r = spawnSync('bash', [path.join(root, 'scripts/install-backup-cron.sh')], {
    encoding: 'utf8',
    env: { ...process.env, HOME: s.home, PATH: `${s.bin}:${process.env.PATH}` },
  });
  assert.notEqual(r.status, 0);
  assert.equal(fs.readFileSync(s.store, 'utf8'), OTHER);
});

test('pull-server-backup.sh copies the newest backup, checks it and keeps it private', () => {
  const srv = tmp('fd-srv-');
  fs.mkdirSync(path.join(srv, 'backups/flightdeck'), { recursive: true });
  // a real, tiny, valid tarball for the newest; an older one that must not be chosen
  const mk = (name) => {
    const d = tmp('fd-tar-');
    fs.mkdirSync(path.join(d, 'var'));
    fs.writeFileSync(path.join(d, 'var/x.json'), '{}');
    spawnSync('tar', ['-czf', path.join(srv, 'backups/flightdeck', name), '-C', d, 'var']);
  };
  mk('flightdeck-var-20261030.tar.gz');
  mk('flightdeck-var-20261101.tar.gz');
  const bin = tmp('fd-bin-');
  // A real ssh lands in the server home folder, so the fake does too.
  exe(path.join(bin, 'ssh'), '#!/bin/bash\nshift\ncd "$HOME"\nexec bash -c "$1"\n');
  exe(
    path.join(bin, 'scp'),
    '#!/bin/bash\nsrc="${@: -2:1}"; dst="${@: -1}"; src="${src#*:}"; cp "' +
      srv +
      '/$src" "$dst"\n',
  );
  const dest = tmp('fd-dest-');
  const r = spawnSync('bash', [path.join(root, 'scripts/pull-server-backup.sh')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: srv,
      FLIGHTDECK_BACKUP_DIR: dest,
      PATH: `${bin}:${process.env.PATH}`,
    },
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.deepEqual(fs.readdirSync(dest), ['flightdeck-var-20261101.tar.gz']);
  assert.equal(fs.statSync(path.join(dest, 'flightdeck-var-20261101.tar.gz')).mode & 0o777, 0o600);
  assert.match(r.stdout, /20261101/);
});
