// End to end through the real PHP router (Phase 5 safety net): the routes that had no HTTP-level test. Router behaviour (404, 405, 429,
// 503), who may call what (401 anonymous, 403 signed-in non-owner), and the account, packing-list, event and contact routes.
// Three throwaway servers, each on its own empty private folder with a test signing key, so no real data, keys or network are used:
//   A  normal, a high rate limit        B  no Clerk issuer (must fail closed)        C  a tight rate limit
// Tokens are signed here and verified by the server exactly as Clerk tokens are.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const ISS = 'https://clerk.test.example';
const b64u = (b) => Buffer.from(b).toString('base64url');
const key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const servers = [];

function token(sub) {
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ iss: ISS, sub, exp: now + 600, nbf: now - 5, iat: now }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key.privateKey);
  return `${head}.${body}.${b64u(sig)}`;
}

async function start(port, env) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `fd-api-${port}-`));
  fs.cpSync(path.join(root, 'php/private/src'), path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'var/cache'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'var/enquiries'), { recursive: true });
  const jwk = {
    ...key.publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  for (const f of ['clerk-jwks', 'clerk-jwks-stale'])
    fs.writeFileSync(
      path.join(tmp, `var/cache/${f}.json`),
      JSON.stringify({ expires: Date.now() + 86400000, data: [jwk] }),
    );
  const proc = spawn('php', ['-S', `127.0.0.1:${port}`, 'php/dev-router.php'], {
    cwd: root,
    env: { PATH: process.env.PATH, FLIGHTDECK_PRIVATE: tmp, ...env },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/config`)).status < 500) break;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  const s = { base, tmp, stop: () => proc.kill() };
  servers.push(s);
  return s;
}

async function call(server, method, p, { auth, body, headers = {} } = {}) {
  const h = { ...headers };
  if (auth) h.Authorization = `Bearer ${auth}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(server.base + p, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: r.status, json, text, headers: r.headers };
}

let A;
let B;
let C;
const OWNER = () => token('user_owner');
const OTHER = () => token('user_other');
const ENQUIRY_ID = '20261101000000-abc123';

before(async () => {
  const base = { CLERK_ISSUER: ISS, FLIGHTDECK_ADMIN_IDS: 'user_owner' };
  [A, B, C] = await Promise.all([
    start(3997, { ...base, FLIGHTDECK_RATE_PER_MINUTE: '100000' }),
    start(3998, { FLIGHTDECK_ADMIN_IDS: 'user_owner', FLIGHTDECK_RATE_PER_MINUTE: '100000' }),
    start(3999, { ...base, FLIGHTDECK_RATE_PER_MINUTE: '2' }),
  ]);
  fs.writeFileSync(
    path.join(A.tmp, `var/enquiries/${ENQUIRY_ID}.json`),
    JSON.stringify({
      id: ENQUIRY_ID,
      kind: 'feedback',
      status: 'new',
      createdAt: Date.now(),
      name: 'Test Person',
      email: 'test@example.com',
      message: 'TEST DATA: exists only in this throwaway server.',
      emailed: false,
    }),
  );
});

after(() => {
  for (const s of servers) {
    s.stop();
    fs.rmSync(s.tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------- the router

// If a route is removed from the router, this list fails: it is the contract the app and the docs rely on.
const EXPECTED_ROUTES = [
  ['GET', '/api/config'],
  ['GET', '/api/site'],
  ['POST', '/api/event'],
  ['POST', '/api/contact'],
  ['GET', '/api/flights?number=BA117&date=2026-11-09&mode=demo'],
  ['GET', '/api/weather?lat=51.5&lon=-0.1'],
  ['GET', '/api/place?city=Paris&country=France'],
  ['GET', '/api/web-check?number=BA117&date=2026-11-09'],
  ['GET', '/api/me'],
  ['GET', '/api/checklist'],
  ['GET', '/api/admin/overview'],
  ['GET', '/api/admin/users'],
  ['GET', '/api/admin/enquiries'],
  ['PATCH', `/api/admin/enquiries/${ENQUIRY_ID}`],
  ['POST', `/api/admin/enquiries/${ENQUIRY_ID}/reply`],
  ['GET', '/api/admin/system'],
  ['GET', '/api/admin/analytics'],
  ['GET', '/api/admin/content/page'],
  ['GET', '/api/admin/media'],
  ['GET', '/api/admin/health'],
  ['GET', '/api/admin/audit'],
];

test('router: every route in the contract exists (none answers "Unknown endpoint")', async () => {
  for (const [method, p] of EXPECTED_ROUTES) {
    // The public write routes are probed as "from another site": still routed (a 403, never a 404) without using up a sender's allowance.
    const publicWrite = p === '/api/event' || p === '/api/contact';
    const r = await call(A, method, p, {
      auth: OWNER(),
      body: method === 'GET' ? undefined : {},
      headers: publicWrite ? { 'Sec-Fetch-Site': 'cross-site' } : {},
    });
    assert.ok(
      !(r.status === 404 && r.json?.error === 'Unknown endpoint'),
      `${method} ${p} is no longer routed`,
    );
  }
});

test('router: an unknown path is a JSON 404', async () => {
  const r = await call(A, 'GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json?.error, 'Unknown endpoint');
  const admin = await call(A, 'GET', '/api/admin/nope', { auth: OWNER() });
  assert.equal(admin.status, 404);
});

test('router: a wrong method is a 405 that says which methods are allowed', async () => {
  const cases = [
    ['POST', '/api/config', ['GET', 'HEAD']],
    ['GET', '/api/event', ['POST']],
    ['GET', '/api/contact', ['POST']],
    ['DELETE', '/api/me', ['GET', 'HEAD']],
    ['GET', `/api/admin/enquiries/${ENQUIRY_ID}`, ['PATCH']],
    ['GET', `/api/admin/enquiries/${ENQUIRY_ID}/reply`, ['POST']],
  ];
  for (const [method, p, allowed] of cases) {
    const r = await call(A, method, p, { auth: OWNER() });
    assert.equal(r.status, 405, `${method} ${p}`);
    const allow = (r.headers.get('allow') || '').split(/,\s*/);
    for (const m of allowed)
      assert.ok(allow.includes(m), `${method} ${p}: Allow lacks ${m} (${allow})`);
  }
  const checklistAllow = (
    await call(A, 'POST', '/api/checklist', { auth: OWNER(), body: {} })
  ).headers.get('allow');
  assert.match(checklistAllow || '', /PUT/);
  assert.match(checklistAllow || '', /DELETE/);
});

test('router: past the per-minute limit a visitor gets a 429 (server C allows 2)', async () => {
  const seen = [];
  for (let i = 0; i < 4; i++) seen.push((await call(C, 'GET', '/api/weather?lat=1&lon=1')).status);
  assert.deepEqual(seen.slice(0, 2), [401, 401], 'the first two reach the sign-in check');
  assert.ok(
    seen.slice(2).every((s) => s === 429),
    `later requests must be 429, got ${seen}`,
  );
  // cheap routes have their own, larger bucket and are not starved by the strict one
  assert.equal((await call(C, 'GET', '/api/config')).status, 200);
});

test('router: with no valid Clerk issuer every protected route fails closed with 503 (server B)', async () => {
  for (const p of [
    '/api/flights?number=BA117&date=2026-11-09&mode=demo',
    '/api/weather?lat=1&lon=1',
    '/api/place?city=Paris&country=France',
    '/api/web-check?number=BA117&date=2026-11-09',
    '/api/checklist',
    '/api/admin/overview',
    '/api/admin/system',
    '/api/admin/enquiries',
  ]) {
    const r = await call(B, 'GET', p, { auth: OWNER() });
    assert.equal(r.status, 503, `${p} must not open when sign-in is not configured`);
  }
  const cfg = await call(B, 'GET', '/api/config');
  assert.equal(cfg.status, 200);
  assert.equal(cfg.json?.signInRequired, true, 'the app must still be told sign-in is required');
  assert.equal((await call(B, 'GET', '/api/site')).status, 200, 'public routes keep working');
});

test('router: with no valid issuer /api/me answers "nobody", even for a real owner token', async () => {
  const r = await call(B, 'GET', '/api/me', { auth: OWNER() });
  assert.equal(r.status, 200);
  assert.equal(r.json?.signedIn, false);
  assert.equal(
    r.json?.isAdmin,
    false,
    'a token must never make anyone the owner while sign-in is not configured',
  );
});

// ---------------------------------------------------------------------------------------------- who may call what

test('signed-in routes: anonymous visitors get 401', async () => {
  for (const p of [
    '/api/flights?number=BA117&date=2026-11-09&mode=demo',
    '/api/weather?lat=51.5&lon=-0.1',
    '/api/place?city=Paris&country=France',
    '/api/web-check?number=BA117&date=2026-11-09',
    '/api/me',
    '/api/checklist',
  ]) {
    assert.equal((await call(A, 'GET', p)).status, 401, p);
  }
});

test('owner routes: anonymous 401, signed-in non-owner 403, owner allowed', async () => {
  const routes = [
    ['GET', '/api/admin/overview'],
    ['GET', '/api/admin/users'],
    ['GET', '/api/admin/enquiries'],
    ['GET', '/api/admin/system'],
    ['GET', '/api/admin/analytics'],
    ['PATCH', `/api/admin/enquiries/${ENQUIRY_ID}`],
    ['POST', `/api/admin/enquiries/${ENQUIRY_ID}/reply`],
  ];
  for (const [method, p] of routes) {
    const body = method === 'GET' ? undefined : {};
    assert.equal((await call(A, method, p, { body })).status, 401, `anonymous ${method} ${p}`);
    assert.equal(
      (await call(A, method, p, { auth: OTHER(), body })).status,
      403,
      `non-owner ${method} ${p}`,
    );
    const owner = await call(A, method, p, { auth: OWNER(), body });
    assert.ok(
      owner.status !== 401 && owner.status !== 403,
      `owner ${method} ${p} got ${owner.status}`,
    );
  }
});

test('owner routes: what the owner gets back', async () => {
  const overview = await call(A, 'GET', '/api/admin/overview', { auth: OWNER() });
  assert.equal(overview.status, 200);
  assert.ok(overview.json?.overview && overview.json?.allowance, 'overview and allowance');
  assert.equal(overview.json.allowance.web.enabled, false, 'web links are off on this server');
  assert.equal(overview.json.allowance.web.cap, 150);
  const totals = overview.json.overview.totals;
  assert.ok(!('ctaClicks' in totals) && !('checklistSaves' in totals), 'dead totals are gone');

  const system = await call(A, 'GET', '/api/admin/system', { auth: OWNER() });
  assert.equal(system.json?.signInEnforced, true);
  assert.equal(system.json?.webCheck, false);
  assert.ok(!('ai' in system.json) && !('ads' in system.json), 'no dead flags');

  const users = await call(A, 'GET', '/api/admin/users', { auth: OWNER() });
  assert.equal(users.status, 200);
  assert.equal(users.json?.configured, false, 'no Clerk secret key on this server');

  const list = await call(A, 'GET', '/api/admin/enquiries', { auth: OWNER() });
  assert.equal(list.status, 200);
  assert.ok(JSON.stringify(list.json).includes(ENQUIRY_ID));
});

test('enquiry changes: a valid status is saved, junk is refused with 422', async () => {
  const p = `/api/admin/enquiries/${ENQUIRY_ID}`;
  const ok = await call(A, 'PATCH', p, { auth: OWNER(), body: { status: 'read' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json?.ok, true);
  assert.equal(
    (await call(A, 'PATCH', p, { auth: OWNER(), body: { status: 'nonsense' } })).status,
    422,
  );
  assert.equal((await call(A, 'PATCH', p, { auth: OWNER(), body: {} })).status, 422);
  const reply = await call(A, 'POST', `${p}/reply`, { auth: OWNER(), body: {} });
  assert.equal(reply.status, 422, 'a reply with no message is refused');
});

test('/api/me: says who you are and whether you own the site', async () => {
  const owner = await call(A, 'GET', '/api/me', { auth: OWNER() });
  assert.equal(owner.status, 200);
  assert.equal(owner.json?.signedIn, true);
  assert.equal(owner.json?.isAdmin, true);
  assert.equal(typeof owner.json?.unread, 'number');
  const other = await call(A, 'GET', '/api/me', { auth: OTHER() });
  assert.equal(other.json?.isAdmin, false);
  assert.equal(other.json?.unread, null, 'only the owner sees the unread count');
});

test('/api/web-check: off without Bright Data settings, and bad input is refused', async () => {
  const off = await call(A, 'GET', '/api/web-check?number=BA117&date=2026-11-09', {
    auth: OWNER(),
  });
  assert.equal(off.status, 200);
  assert.equal(off.json?.status, 'off');
  const bad = await call(A, 'GET', '/api/web-check?number=%3Cscript%3E&date=nope', {
    auth: OWNER(),
  });
  assert.ok(bad.status >= 400 && bad.status < 500, `expected a 4xx, got ${bad.status}`);
});

// ---------------------------------------------------------------------------------------------- packing list sync

test('/api/checklist: save, conflict, validation and delete, per user', async () => {
  const auth = token('user_checklist');
  const fresh = await call(A, 'GET', '/api/checklist', { auth });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.json?.rev, 0);
  assert.ok(fresh.json?.limits?.bytes > 0 && fresh.json?.limits?.trips > 0);

  const saved = await call(A, 'PUT', '/api/checklist', {
    auth,
    body: { baseRev: 0, data: { v: 1 } },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json?.rev, 1);

  const stale = await call(A, 'PUT', '/api/checklist', {
    auth,
    body: { baseRev: 0, data: { v: 1 } },
  });
  assert.equal(stale.status, 409, 'a stale baseRev is a conflict');
  assert.equal(stale.json?.error, 'conflict');
  assert.equal(stale.json?.rev, 1, 'the conflict answer carries the current revision');

  assert.equal(
    (await call(A, 'PUT', '/api/checklist', { auth, body: { baseRev: 1, data: { v: 2 } } })).status,
    422,
    'wrong document version',
  );
  assert.equal(
    (await call(A, 'PUT', '/api/checklist', { auth, body: { baseRev: -1, data: { v: 1 } } }))
      .status,
    422,
    'negative baseRev',
  );
  const tooBig = await call(A, 'PUT', '/api/checklist', {
    auth,
    body: { baseRev: 1, data: { v: 1, pad: 'x'.repeat(400000) } },
  });
  assert.ok(
    [413, 422].includes(tooBig.status),
    `an oversized document is refused, got ${tooBig.status}`,
  );

  // another account never sees it
  const other = await call(A, 'GET', '/api/checklist', { auth: token('user_checklist_two') });
  assert.equal(other.json?.rev, 0);

  const del = await call(A, 'DELETE', '/api/checklist', { auth });
  assert.equal(del.status, 200);
  assert.equal(del.json?.deleted, true);
  assert.equal(
    (await call(A, 'GET', '/api/checklist', { auth })).json?.rev,
    0,
    'deleted means gone',
  );
});

// ---------------------------------------------------------------------------------------------- counters and the contact form

test('/api/event: only the whitelisted anonymous counters are accepted', async () => {
  const ok = await call(A, 'POST', '/api/event', { body: { name: 'landing_view' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json?.ok, true);
  for (const name of ['cta_click', 'signup_started', 'made_up', '']) {
    assert.equal(
      (await call(A, 'POST', '/api/event', { body: { name } })).status,
      422,
      `"${name}" must be refused`,
    );
  }
  assert.equal((await call(A, 'POST', '/api/event', { body: {} })).status, 422);
});

test('/api/event and /api/contact: requests from another site are refused', async () => {
  for (const [p, body] of [
    ['/api/event', { name: 'landing_view' }],
    ['/api/contact', { kind: 'feedback', message: 'hello there', elapsed: 9000 }],
  ]) {
    const viaHeader = await call(A, 'POST', p, {
      body,
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    assert.equal(viaHeader.status, 403, `${p} with Sec-Fetch-Site: cross-site`);
    const viaOrigin = await call(A, 'POST', p, {
      body,
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(viaOrigin.status, 403, `${p} with a foreign Origin`);
  }
});

test('/api/contact: stores a real message, ignores bots, refuses bad input, then limits the sender', async () => {
  const dir = path.join(A.tmp, 'var/enquiries');
  const stored = () =>
    fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== `${ENQUIRY_ID}.json`);
  assert.equal(stored().length, 0);

  // 1: a real message
  const good = await call(A, 'POST', '/api/contact', {
    body: {
      kind: 'contact',
      message: 'Hello, a real question about my flight.',
      name: 'Sam',
      email: 'sam@example.com',
      elapsed: 9000,
      website: '',
    },
  });
  assert.equal(good.status, 200);
  assert.equal(good.json?.ok, true);
  assert.equal(stored().length, 1, 'the message is stored for the console');

  // 2: the honeypot looks like success to a bot and stores nothing
  const bot = await call(A, 'POST', '/api/contact', {
    body: {
      kind: 'contact',
      message: 'Buy cheap pills now',
      email: 'bot@example.com',
      elapsed: 9000,
      website: 'http://spam.example',
    },
  });
  assert.equal(bot.status, 200);
  assert.equal(stored().length, 1, 'a honeypot hit must not be stored');

  // 3: bad input is refused with a reason
  const short = await call(A, 'POST', '/api/contact', {
    body: { kind: 'feedback', message: 'hi', elapsed: 9000 },
  });
  assert.equal(short.status, 422);
  assert.ok(short.json?.error, 'a refusal says why');

  // 4: three messages an hour per sender; the fourth is told to wait
  const fourth = await call(A, 'POST', '/api/contact', {
    body: { kind: 'feedback', message: 'another message please', elapsed: 9000 },
  });
  assert.equal(fourth.status, 429);
});

test('/api/contact: rules that do not use up the sender allowance are checked on a fresh server', async () => {
  // Server C's per-minute bucket does not apply to /contact (a general route), and its sender allowance is untouched.
  const cases = [
    [
      { kind: 'contact', message: 'No email address given here', elapsed: 9000 },
      422,
      'contact needs an email',
    ],
    [{ kind: 'nonsense', message: 'A fine long message', elapsed: 9000 }, 422, 'unknown kind'],
  ];
  for (const [body, status, why] of cases) {
    const r = await call(C, 'POST', '/api/contact', { body });
    assert.equal(r.status, status, why);
  }
  // a form filled in faster than a person can is told so (a 429 with its own message, not the sender limit)
  const quick = await call(C, 'POST', '/api/contact', {
    body: { kind: 'feedback', message: 'A fine long message', elapsed: 100 },
  });
  assert.equal(quick.status, 429);
  assert.match(quick.json?.error || '', /very quick/i);
});
