// Runs a command with temp files redirected into the gitignored .local-test/ folder (never touches HOME).
// Usage: node scripts/with-local-test.mjs <command> [args...]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const tmp = path.join(root, '.local-test/tmp');
fs.mkdirSync(tmp, { recursive: true });
const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp },
});
process.exit(r.status ?? 1);
