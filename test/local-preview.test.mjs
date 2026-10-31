import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '..');
async function server(root, privateDir, dist) {
  const sock = net.createServer();
  await new Promise((resolve) => sock.listen(0, '127.0.0.1', resolve));
  const port = sock.address().port;
  await new Promise((resolve) => sock.close(resolve));
  const env = { ...process.env, FLIGHTDECK_PRIVATE: privateDir, FLIGHTDECK_LIVE_PREVIEW: 'on' };
  delete env.FLIGHTDECK_DIST;
  if (dist) env.FLIGHTDECK_DIST = dist;
  const child = spawn('php', ['-S', `127.0.0.1:${port}`, 'php/dev-router.php'], {
    cwd: root,
    env,
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 40; i++) {
    try {
      await fetch(base + '/assets/marker.js');
      return { base, stop: () => child.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  child.kill();
  throw Error('Test PHP server did not start');
}
test('local preview routes keep production and development assets separate; harness overrides are preserved', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-local-build-'));
  const servers = [];
  try {
    for (const dir of [
      'php/private',
      'public',
      'dist/app',
      'dist/assets',
      '.local-live/private',
      '.local-live/dist/app',
      '.local-live/dist/assets',
      'harness/app',
    ])
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.copyFileSync(path.join(repo, 'php/dev-router.php'), path.join(root, 'php/dev-router.php'));
    fs.copyFileSync(path.join(repo, 'public/.htaccess'), path.join(root, 'public/.htaccess'));
    fs.writeFileSync(path.join(root, 'dist/app/index.html'), 'DEVELOPMENT BUILD');
    fs.writeFileSync(path.join(root, 'dist/assets/marker.js'), 'DEVELOPMENT ASSET');
    fs.writeFileSync(path.join(root, '.local-live/dist/app/index.html'), 'LIVE ACCOUNT BUILD');
    fs.writeFileSync(path.join(root, '.local-live/dist/assets/marker.js'), 'LIVE ACCOUNT ASSET');
    fs.writeFileSync(path.join(root, 'harness/app/index.html'), 'ISOLATED TEST BUILD');
    const normal = await server(root, path.join(root, 'php/private'));
    servers.push(normal);
    const redirected = await fetch(normal.base + '/app/?number=BA59', { redirect: 'manual' });
    assert.equal(redirected.status, 302);
    assert.equal(
      redirected.headers.get('location'),
      'https://local.flightdeck.gakinz.com/app/?number=BA59',
    );
    assert.equal(
      await (await fetch(normal.base + '/assets/marker.js')).text(),
      'DEVELOPMENT ASSET',
    );
    const live = await server(root, path.join(root, '.local-live/private'));
    servers.push(live);
    assert.equal(await (await fetch(live.base + '/app/')).text(), 'LIVE ACCOUNT BUILD');
    assert.equal(await (await fetch(live.base + '/assets/marker.js')).text(), 'LIVE ACCOUNT ASSET');
    const harness = await server(root, path.join(root, 'php/private'), path.join(root, 'harness'));
    servers.push(harness);
    assert.equal(await (await fetch(harness.base + '/app/')).text(), 'ISOLATED TEST BUILD');
  } finally {
    servers.forEach((s) => s.stop());
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('when the live-account preview is not running, localhost /app/ serves the normal build instead of redirecting', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-local-off-'));
  let child;
  try {
    for (const dir of ['php/private', 'public', 'dist/app', 'dist/assets', '.local-live/dist/app'])
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.copyFileSync(path.join(repo, 'php/dev-router.php'), path.join(root, 'php/dev-router.php'));
    fs.copyFileSync(path.join(repo, 'public/.htaccess'), path.join(root, 'public/.htaccess'));
    fs.writeFileSync(path.join(root, 'dist/app/index.html'), 'DEVELOPMENT BUILD');
    fs.writeFileSync(path.join(root, 'dist/assets/marker.js'), 'DEVELOPMENT ASSET');
    fs.writeFileSync(path.join(root, '.local-live/dist/app/index.html'), 'OLD LIVE ACCOUNT BUILD');
    const sock = net.createServer();
    await new Promise((resolve) => sock.listen(0, '127.0.0.1', resolve));
    const port = sock.address().port;
    await new Promise((resolve) => sock.close(resolve));
    const env = {
      ...process.env,
      FLIGHTDECK_PRIVATE: path.join(root, 'php/private'),
      FLIGHTDECK_LIVE_PREVIEW: 'off',
    };
    delete env.FLIGHTDECK_DIST;
    child = spawn('php', ['-S', `127.0.0.1:${port}`, 'php/dev-router.php'], {
      cwd: root,
      env,
      stdio: 'ignore',
    });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 40; i++) {
      try {
        await fetch(base + '/assets/marker.js');
        break;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    const r = await fetch(base + '/app/', { redirect: 'manual' });
    assert.equal(r.status, 200);
    assert.equal(await r.text(), 'DEVELOPMENT BUILD');
  } finally {
    child?.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
