// TEST ONLY: a throwaway Flightdeck server for console tests. Copies php/private/src into a temporary private folder (so no real
// data, keys or .env are used), installs a test signing key as the Clerk key set, and starts the real PHP router.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const ISS = 'https://clerk.test.example';
const b64u = (b) => Buffer.from(b).toString('base64url');

export async function startHarness({ port, dist, enquiry = true }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-harness-'));
  fs.cpSync(path.join(root, 'php/private/src'), path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'var/cache'), { recursive: true });
  const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...key.publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  for (const f of ['clerk-jwks', 'clerk-jwks-stale']) fs.writeFileSync(path.join(tmp, `var/cache/${f}.json`), JSON.stringify({ expires: Date.now() + 86400000, data: [jwk] }));
  if (enquiry) { // one clearly labelled sample message, in the throwaway folder only
    fs.mkdirSync(path.join(tmp, 'var/enquiries'), { recursive: true });
    const id = new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-abc123';
    fs.writeFileSync(path.join(tmp, `var/enquiries/${id}.json`), JSON.stringify({ id, kind: 'feedback', status: 'new', createdAt: Date.now(), name: 'Test Person', email: 'test@example.com', message: 'TEST DATA: this message exists only in the local console harness.', emailed: false }));
  }
  const env = { PATH: process.env.PATH, FLIGHTDECK_PRIVATE: tmp, CLERK_ISSUER: ISS, FLIGHTDECK_ADMIN_IDS: 'user_owner', FLIGHTDECK_RATE_PER_MINUTE: '100000', ...(dist ? { FLIGHTDECK_DIST: dist } : {}) };
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, 'php/dev-router.php'], { cwd: root, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`${base}/api/config`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 150)); }
  const token = (sub, minutes = 30) => {
    const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' }));
    const body = b64u(JSON.stringify({ iss: ISS, sub, exp: Math.floor(Date.now() / 1000) + minutes * 60, nbf: Math.floor(Date.now() / 1000) - 5 }));
    return `${head}.${body}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key.privateKey))}`;
  };
  const stop = () => { server.kill(); fs.rmSync(tmp, { recursive: true, force: true }); };
  return { base, token, stop, tmp };
}
