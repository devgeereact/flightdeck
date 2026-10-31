// End to end through the real PHP router: who may use the CMS, and what a publish really changes on the public site.
// Runs against a throwaway private folder (a copy of php/private/src, empty var/) with a test signing key, so no real data, keys or
// network are involved. Tokens are signed here and verified by the server exactly as Clerk tokens are.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 3995;
const BASE = `http://127.0.0.1:${PORT}`;
const ISS = 'https://clerk.test.example';
let tmp;
let server;
let key;

const b64u = (b) => Buffer.from(b).toString('base64url');
function token(sub, { exp = Math.floor(Date.now() / 1000) + 600, iss = ISS, signer = key } = {}) {
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' }));
  const body = b64u(
    JSON.stringify({
      iss,
      sub,
      exp,
      nbf: Math.floor(Date.now() / 1000) - 5,
      iat: Math.floor(Date.now() / 1000),
    }),
  );
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), signer.privateKey);
  return `${head}.${body}.${b64u(sig)}`;
}
const OWNER = () => token('user_owner');
const OTHER = () => token('user_other');

async function api(method, p, { auth, body, raw, type } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (type) headers['Content-Type'] = type;
  const r = await fetch(BASE + p, {
    method,
    headers,
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: 'manual',
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: r.status, json, text };
}
const page = async (p) => (await fetch(BASE + p)).text();

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-cms-'));
  fs.cpSync(path.join(root, 'php/private/src'), path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'var/cache'), { recursive: true });
  key = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...key.publicKey.export({ format: 'jwk' }),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  const cached = JSON.stringify({ expires: Date.now() + 3600000, data: [jwk] });
  fs.writeFileSync(path.join(tmp, 'var/cache/clerk-jwks.json'), cached);
  fs.writeFileSync(path.join(tmp, 'var/cache/clerk-jwks-stale.json'), cached);
  const env = {
    PATH: process.env.PATH,
    FLIGHTDECK_PRIVATE: tmp,
    CLERK_ISSUER: ISS,
    FLIGHTDECK_ADMIN_IDS: 'user_owner',
    FLIGHTDECK_RATE_PER_MINUTE: '100000',
    FLIGHTDECK_NO_CSP: '1',
  };
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, 'php/dev-router.php'], {
    cwd: root,
    env,
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`${BASE}/api/config`)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('test server did not start');
});
after(() => {
  server?.kill();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

const CMS_ROUTES = [
  ['GET', '/api/admin/content/page'],
  ['GET', '/api/admin/content/page/about'],
  ['PUT', '/api/admin/content/page/about', { baseRev: 0, data: {} }],
  ['POST', '/api/admin/content/page/about', { action: 'publish' }],
  ['DELETE', '/api/admin/content/faq/free'],
  ['POST', '/api/admin/content/faq-order', { ids: [] }],
  ['POST', '/api/admin/preview', { type: 'page', id: 'about', data: {} }],
  ['GET', '/api/admin/media'],
  ['GET', '/api/admin/health'],
  ['GET', '/api/admin/audit'],
  ['GET', '/api/admin/content/settings/site'],
];

test('anonymous visitors get 401 on every CMS route', async () => {
  for (const [m, p, body] of CMS_ROUTES)
    assert.equal((await api(m, p, { body })).status, 401, `${m} ${p}`);
});

test('a signed-in user who is not the owner gets 403 on every CMS route, and nothing changes', async () => {
  for (const [m, p, body] of CMS_ROUTES)
    assert.equal((await api(m, p, { auth: OTHER(), body })).status, 403, `${m} ${p}`);
  assert.ok(!fs.existsSync(path.join(tmp, 'var/content/published.json')), 'no publish happened');
});

test('forged, expired and wrong-issuer tokens are refused', async () => {
  const forger = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  for (const t of [
    token('user_owner', { signer: forger }),
    token('user_owner', { exp: Math.floor(Date.now() / 1000) - 60 }),
    token('user_owner', { iss: 'https://evil.example' }),
    'not.a.token',
  ]) {
    assert.equal((await api('GET', '/api/admin/content/page', { auth: t })).status, 401);
  }
});

test('owner: a draft is not live until it is published; publish changes the public page; history and audit record it', async () => {
  const before = await page('/about/');
  const cur = (await api('GET', '/api/admin/content/page/about', { auth: OWNER() })).json;
  assert.ok(cur.published && cur.draft === null);
  const data = {
    ...cur.published,
    body: cur.published.body + '\n\nA brand new closing paragraph for this test.',
  };
  const saved = await api('PUT', '/api/admin/content/page/about', {
    auth: OWNER(),
    body: { baseRev: 0, data },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.draft.rev, 1);
  assert.equal(await page('/about/'), before, 'a saved draft does not change the live page');
  const conflict = await api('PUT', '/api/admin/content/page/about', {
    auth: OWNER(),
    body: { baseRev: 0, data },
  });
  assert.equal(conflict.status, 409, 'a stale editor cannot overwrite a newer draft');
  const pre = await api('POST', '/api/admin/preview', {
    auth: OWNER(),
    body: { type: 'page', id: 'about', data },
  });
  assert.ok(
    pre.json.html.includes('A brand new closing paragraph') && pre.json.html.includes('noindex'),
  );
  assert.equal(
    (
      await api('POST', '/api/admin/content/page/about', {
        auth: OWNER(),
        body: { action: 'publish' },
      })
    ).status,
    200,
  );
  assert.ok((await page('/about/')).includes('A brand new closing paragraph for this test.'));
  const after1 = (await api('GET', '/api/admin/content/page/about', { auth: OWNER() })).json;
  assert.equal(after1.draft, null);
  assert.deepEqual(
    after1.revisions.slice(0, 2).map((r) => r.action),
    ['publish', 'save'],
  );
  const audit = (await api('GET', '/api/admin/audit', { auth: OWNER() })).json;
  assert.ok(
    audit.entries.some((e) => e.action === 'content page about publish') &&
      audit.entries.every((e) => /^[0-9a-f]{10}$/.test(e.by)),
  );
  assert.ok(
    !JSON.stringify(audit).includes('user_owner'),
    'the audit log stores a hash, not the user id',
  );
});

test('owner: restore puts an old version into the draft; publishing it brings the old text back', async () => {
  const revs = (await api('GET', '/api/admin/content/page/about', { auth: OWNER() })).json
    .revisions;
  const r = await api('POST', '/api/admin/content/page/about', {
    auth: OWNER(),
    body: { action: 'restore', revision: revs[revs.length - 1].name },
  });
  assert.equal(r.status, 200);
  assert.ok(
    (await page('/about/')).includes('A brand new closing paragraph'),
    'restore alone changes nothing live',
  );
  await api('POST', '/api/admin/content/page/about', {
    auth: OWNER(),
    body: { action: 'publish' },
  });
  const firstSave = (
    await api('GET', `/api/admin/content/page/about?revision=${revs[revs.length - 1].name}`, {
      auth: OWNER(),
    })
  ).json.data;
  assert.ok(
    firstSave.body.includes('A brand new closing paragraph'),
    'the oldest revision is the first save',
  );
  assert.equal(
    (
      await api('POST', '/api/admin/content/page/about', {
        auth: OWNER(),
        body: { action: 'restore', revision: '../../etc/passwd' },
      })
    ).status,
    404,
  );
});

test('validation: bad fields come back as field errors; unknown fields are dropped; the address of an existing page cannot change', async () => {
  const cur = (await api('GET', '/api/admin/content/page/terms', { auth: OWNER() })).json.published;
  const bad = await api('PUT', '/api/admin/content/page/terms', {
    auth: OWNER(),
    body: { baseRev: 0, data: { ...cur, title: 'x', description: 'short' } },
  });
  assert.equal(bad.status, 422);
  assert.ok(bad.json.errors.title && bad.json.errors.description);
  const ok = await api('PUT', '/api/admin/content/page/terms', {
    auth: OWNER(),
    body: {
      baseRev: 0,
      data: { ...cur, slug: 'hijack', kind: 'home', evil: '<script>', unpublished: true },
    },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(
    [
      ok.json.draft.data.slug,
      ok.json.draft.data.kind,
      'evil' in ok.json.draft.data,
      'unpublished' in ok.json.draft.data,
    ],
    ['terms', cur.kind, false, false],
  );
  assert.equal(
    (
      await api('POST', '/api/admin/content/page/terms', {
        auth: OWNER(),
        body: { action: 'discard' },
      })
    ).status,
    200,
  );
});

test('editors cannot publish executable HTML: script, handlers and javascript: links render as harmless text', async () => {
  const cur = (await api('GET', '/api/admin/content/page/accessibility', { auth: OWNER() })).json
    .published;
  const evil =
    '<script>alert(1)</script> <img src=x onerror=alert(2)> [click](javascript:alert(3)) <iframe src="https://evil.example"></iframe>';
  await api('PUT', '/api/admin/content/page/accessibility', {
    auth: OWNER(),
    body: { baseRev: 0, data: { ...cur, body: cur.body + '\n\n' + evil } },
  });
  await api('POST', '/api/admin/content/page/accessibility', {
    auth: OWNER(),
    body: { action: 'publish' },
  });
  const h = await page('/accessibility/');
  assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!/<script>alert|<img src=x|<iframe|href="javascript/i.test(h));
});

test('pages: create, publish, unpublish and delete a new page; required pages cannot be removed; reserved addresses are refused', async () => {
  const data = {
    kind: 'page',
    title: 'Test page',
    description: 'A page created by the automated test suite.',
    body: 'Hello from the **test** page. It has enough words.',
  };
  assert.equal(
    (await api('PUT', '/api/admin/content/page/app', { auth: OWNER(), body: { baseRev: 0, data } }))
      .status,
    422,
  );
  assert.equal(
    (
      await api('PUT', '/api/admin/content/page/Bad_Slug', {
        auth: OWNER(),
        body: { baseRev: 0, data },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await api('PUT', '/api/admin/content/page/test-page', {
        auth: OWNER(),
        body: { baseRev: 0, data },
      })
    ).status,
    200,
  );
  assert.equal((await fetch(`${BASE}/test-page/`)).status, 404, 'not live before publishing');
  assert.equal(
    (
      await api('POST', '/api/admin/content/page/test-page', {
        auth: OWNER(),
        body: { action: 'publish' },
      })
    ).status,
    200,
  );
  const live = await page('/test-page/');
  assert.ok(live.includes('<h1>Test page</h1>') && live.includes('<strong>test</strong>'));
  assert.ok((await page('/sitemap.xml')).includes('/test-page/'));
  assert.equal(
    (
      await api('POST', '/api/admin/content/page/test-page', {
        auth: OWNER(),
        body: { action: 'unpublish' },
      })
    ).status,
    200,
  );
  assert.equal((await fetch(`${BASE}/test-page/`)).status, 404);
  assert.equal(
    (await api('DELETE', '/api/admin/content/page/test-page', { auth: OWNER() })).status,
    200,
  );
  assert.equal(
    (await api('DELETE', '/api/admin/content/page/privacy', { auth: OWNER() })).status,
    422,
  );
  assert.equal(
    (
      await api('POST', '/api/admin/content/page/privacy', {
        auth: OWNER(),
        body: { action: 'unpublish' },
      })
    ).status,
    422,
  );
  assert.equal((await fetch(`${BASE}/privacy/`)).status, 200);
});

test('FAQs, announcements and settings reach the site and the app', async () => {
  const faq = {
    question: 'Does the test suite work?',
    answer: 'Yes, this answer was published by a test.',
    category: 'Testing',
    order: 1,
  };
  await api('PUT', '/api/admin/content/faq/test-faq', {
    auth: OWNER(),
    body: { baseRev: 0, data: faq },
  });
  await api('POST', '/api/admin/content/faq/test-faq', {
    auth: OWNER(),
    body: { action: 'publish' },
  });
  assert.ok((await page('/help/')).includes('Does the test suite work?'));

  const ann = {
    message: 'Scheduled maintenance tonight.',
    level: 'warning',
    where: 'both',
    start: '',
    end: '',
    linkLabel: 'More',
    linkHref: '/coverage/',
  };
  await api('PUT', '/api/admin/content/announcement/maint', {
    auth: OWNER(),
    body: { baseRev: 0, data: ann },
  });
  await api('POST', '/api/admin/content/announcement/maint', {
    auth: OWNER(),
    body: { action: 'publish' },
  });
  assert.ok((await page('/')).includes('Scheduled maintenance tonight.'));
  const pub = await api('GET', '/api/site');
  assert.equal(pub.status, 200);
  assert.deepEqual(
    pub.json.announcements.map((a) => a.id),
    ['maint'],
  );
  assert.ok(
    !JSON.stringify(pub.json).includes('contactEmail'),
    '/api/site returns only the public fields it lists',
  );
  assert.ok(
    Array.isArray(pub.json.faqs) && pub.json.faqs.length > 0,
    '/api/site lists the published FAQ for the app',
  );
  assert.ok(
    pub.json.faqs.every((f) => Object.keys(f).sort().join() === 'answer,id,question'),
    'each FAQ carries only id, question and answer',
  );
  const badAnn = await api('PUT', '/api/admin/content/announcement/bad', {
    auth: OWNER(),
    body: {
      baseRev: 0,
      data: {
        ...ann,
        linkHref: 'javascript:alert(1)',
        start: '2026-10-26T00:00:00Z',
        end: '2026-10-25T00:00:00Z',
      },
    },
  });
  assert.equal(badAnn.status, 422);
  assert.ok(badAnn.json.errors['link.href'] && badAnn.json.errors.end);

  const s = (await api('GET', '/api/admin/content/settings/site', { auth: OWNER() })).json
    .published;
  const wrong = await api('PUT', '/api/admin/content/settings/site', {
    auth: OWNER(),
    body: { baseRev: 0, data: { ...s, contactEmail: 'not-an-email' } },
  });
  assert.equal(wrong.status, 422);
  await api('PUT', '/api/admin/content/settings/site', {
    auth: OWNER(),
    body: {
      baseRev: 0,
      data: { ...s, contactEmail: 'help@example.com', siteUrl: 'https://evil.example' },
    },
  });
  await api('POST', '/api/admin/content/settings/site', {
    auth: OWNER(),
    body: { action: 'publish' },
  });
  const contact = await page('/contact/');
  assert.ok(
    contact.includes('mailto:help@example.com') &&
      contact.includes('<link rel="canonical" href="https://flightdeck.gakinz.com/contact/">'),
    'the site address cannot be changed from the console',
  );
});

test('navigation: links are validated; a published menu replaces the site menu', async () => {
  const nav = (await api('GET', '/api/admin/content/navigation/main', { auth: OWNER() })).json
    .published;
  const bad = await api('PUT', '/api/admin/content/navigation/main', {
    auth: OWNER(),
    body: { baseRev: 0, data: { ...nav, header: [{ label: 'X', href: 'javascript:alert(1)' }] } },
  });
  assert.equal(bad.status, 422);
  await api('PUT', '/api/admin/content/navigation/main', {
    auth: OWNER(),
    body: {
      baseRev: 0,
      data: { ...nav, header: [...nav.header, { label: 'About', href: '/about/' }] },
    },
  });
  await api('POST', '/api/admin/content/navigation/main', {
    auth: OWNER(),
    body: { action: 'publish' },
  });
  const head = (await page('/guides/')).split('</header>')[0];
  assert.ok(head.includes('<a href="/about/">About</a>'));
});

test('operations: health and cache show real state only; media lists uploads and refuses non-images', async () => {
  const h = (await api('GET', '/api/admin/health', { auth: OWNER() })).json;
  assert.deepEqual(Object.keys(h.providers).sort(), [
    'adsbdb',
    'aerodatabox',
    'openmeteo',
    'opensky',
  ]);
  for (const p of Object.values(h.providers))
    assert.equal(p.lastOk, null, 'nothing was called, so nothing is claimed');
  assert.ok(typeof h.cache.files === 'number' && 'allowance' in h);
  assert.equal(
    (
      await api('POST', '/api/admin/media', {
        auth: OWNER(),
        raw: '<svg onload="alert(1)"/>',
        type: 'image/svg+xml',
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await api('POST', '/api/admin/media', {
        auth: OWNER(),
        raw: 'GIF89a not really',
        type: 'image/png',
      })
    ).status,
    415,
  );
  assert.equal((await fetch(`${BASE}/media/${'0'.repeat(64)}.png`)).status, 404);
  assert.equal((await fetch(`${BASE}/media/../config.php`)).status, 404);
});

test('FAQ move up / move down: one request saves the new order as drafts; publishing puts it live', async () => {
  const list = await api('GET', '/api/admin/content/faq', { auth: OWNER() });
  const ids = list.json.items.map((i) => i.id);
  assert.ok(ids.length >= 3);
  const moved = [ids[1], ids[0], ...ids.slice(2)];
  const bad = await api('POST', '/api/admin/content/faq-order', {
    auth: OWNER(),
    body: { ids: moved.slice(1) },
  });
  assert.equal(bad.status, 422, 'a list that leaves a question out is refused');
  const r = await api('POST', '/api/admin/content/faq-order', {
    auth: OWNER(),
    body: { ids: moved },
  });
  assert.equal(r.status, 200);
  assert.ok(r.json.changed >= 2, 'questions whose position changed got drafts');
  const after = await api('GET', '/api/admin/content/faq', { auth: OWNER() });
  const byId = Object.fromEntries(after.json.items.map((i) => [i.id, i]));
  moved.forEach((id, k) => assert.equal(byId[id].order, k + 1, `${id} order`));
  for (const i of after.json.items.filter((x) => x.hasDraft))
    await api('POST', `/api/admin/content/faq/${i.id}`, {
      auth: OWNER(),
      body: { action: 'publish' },
    });
  const pub = await api('GET', '/api/site');
  assert.deepEqual(
    pub.json.faqs.map((f) => f.id).slice(0, 2),
    moved.filter((id) => pub.json.faqs.some((f) => f.id === id)).slice(0, 2),
    'the public FAQ follows the new order',
  );
});

test('Site settings: maintenance switch shows a 503 "back soon" page on public pages only; a console Measurement ID reaches the pages', async () => {
  const get = async () =>
    (await api('GET', '/api/admin/content/settings/site', { auth: OWNER() })).json;
  const save = async (data) => {
    const cur = await get();
    return api('PUT', '/api/admin/content/settings/site', {
      auth: OWNER(),
      body: {
        baseRev: cur.draft?.rev ?? 0,
        data: { ...(cur.draft?.data ?? cur.published), ...data },
      },
    });
  };
  const publish = () =>
    api('POST', '/api/admin/content/settings/site', { auth: OWNER(), body: { action: 'publish' } });
  const bad = await save({ gaId: 'UA-12345' });
  assert.equal(bad.status, 422, 'an old-style or malformed ID is refused');
  assert.ok(bad.json.errors.gaId);
  assert.equal(
    (await save({ gaId: 'g-test12345', maintenance: true, maintenanceMessage: 'Back by 9am.' }))
      .status,
    200,
  );
  await publish();
  const home = await fetch(BASE + '/');
  const html = await home.text();
  assert.equal(home.status, 503, 'public pages answer 503 during maintenance');
  assert.ok(
    html.includes('Back soon') && html.includes('Back by 9am.') && html.includes('noindex'),
  );
  assert.ok(
    html.includes('<meta name="fd-ga-id" content="G-TEST12345">'),
    'the console ID is used, upper-cased',
  );
  assert.equal((await api('GET', '/api/site')).status, 200, 'the app API keeps working');
  assert.equal(
    (await api('GET', '/api/admin/content/page', { auth: OWNER() })).status,
    200,
    'the console keeps working',
  );
  assert.equal((await save({ maintenance: false, gaId: '' })).status, 200);
  await publish();
  const back = await fetch(BASE + '/help/');
  assert.equal(back.status, 200, 'switching it off restores the site');
});
