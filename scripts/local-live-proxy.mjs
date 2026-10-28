// Fixed loopback HTTPS proxy. If started by sudo, relinquishes root immediately after binding port 443.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = 'local.flightdeck.gakinz.com';
const elevated = process.getuid?.() === 0;
const uid = Number(process.env.SUDO_UID),
  gid = Number(process.env.SUDO_GID);
if (elevated && (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(gid) || gid < 0))
  throw Error('Start this proxy through the normal-user launcher, not a root shell.');
const server = https.createServer(
  {
    cert: fs.readFileSync(path.join(root, '.local-live/cert.pem')),
    key: fs.readFileSync(path.join(root, '.local-live/key.pem')),
  },
  (req, res) => {
    if (req.headers.host !== host) {
      res.writeHead(421);
      res.end('Use the configured local Flightdeck address.');
      return;
    }
    const headers = { ...req.headers, host };
    for (const name of ['forwarded', 'x-forwarded-for', 'cf-connecting-ip', 'connection'])
      delete headers[name];
    const upstream = http.request(
      { hostname: '127.0.0.1', port: 3993, path: req.url, method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode || 502, { ...up.headers, 'cache-control': 'no-store' });
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(503);
      res.end('Local Flightdeck is starting. Reload in a moment.');
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  },
);
server.on('error', (err) => {
  if (err.code === 'EACCES' && !elevated) {
    process.exit(77);
    return;
  }
  console.error(
    `Local HTTPS could not start (${err.code || 'unknown'}). Port 443 must be available.`,
  );
  process.exit(1);
});
server.listen(443, '127.0.0.1', () => {
  if (elevated) {
    process.setgroups([]);
    process.setgid(gid);
    process.setuid(uid);
  }
  console.log(
    `Local preview with live Clerk accounts: https://${host}/app/\nThis uses your real account; checklist files stay local. Ctrl+C stops the preview.`,
  );
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
