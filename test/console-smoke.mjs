// Owner console in a test browser (jsdom) against the real PHP API on a throwaway server: the CMS flows an owner uses, and the
// refusal a non-owner sees. No Clerk account, real data or provider keys are involved. Run: pnpm test:console
import { JSDOM } from 'jsdom';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { startHarness } from './lib/harness-server.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  -> ' + extra));
  if (!ok) failed++;
};

execFileSync(
  'pnpm',
  ['exec', 'vite', 'build', '--config', 'vite.console-smoke.config.ts', '--logLevel', 'error'],
  { cwd: root, stdio: 'inherit' },
);
const code = fs.readFileSync(path.join(root, '.local-test/build/console-smoke/console.js'), 'utf8');
const h = await startHarness({ port: 3993 });
process.on('exit', () => h.stop());

function boot(sub, hash) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: `${h.base}/app/console.html?t=${h.token(sub)}${hash}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.fetch = (input, init) => fetch(new URL(String(input), h.base), { ...init, signal: undefined });
  w.scrollTo = () => {};
  w.confirm = () => true;
  const errors = [];
  w.addEventListener('error', (e) => errors.push(String(e.message)));
  w.console.error = (...a) => errors.push(a.join(' ').slice(0, 200));
  w.eval(code);
  const d = w.document;
  const until = async (fn, ms = 4000) => {
    for (let t = 0; t < ms; t += 50) {
      const v = fn();
      if (v) return v;
      await sleep(50);
    }
    return null;
  };
  const button = (label) =>
    [...d.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(label));
  const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const type = (el, value) => {
    const proto =
      el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  const field = (label) =>
    [...d.querySelectorAll('.cn-field')]
      .find((f) => f.querySelector('label')?.textContent.startsWith(label))
      ?.querySelector('input,textarea,select');
  return { w, d, errors, until, button, click, type, field, text: () => d.body.textContent };
}
const page = async (p) => (await fetch(h.base + p)).text();

// ---------------------------------------------------------------- owner: pages
let c = boot('user_owner', '#/admin/pages');
check(
  'C1 the pages list loads with the live pages and their state',
  !!(await c.until(() => c.text().includes('About Flightdeck') && c.text().includes('Published'))),
  c.text().slice(0, 300),
);
check(
  'C2 the console navigation marks the current section',
  c.d.querySelector('.cn-nav a[aria-current="page"]')?.textContent.includes('Pages'),
);
c.click(
  [...c.d.querySelectorAll('.cn-items a')].find((a) => a.textContent.includes('About Flightdeck')),
);
check(
  'C3 opening a page shows its editor with the current text',
  !!(await c.until(() => c.field('Title')?.value === 'About Flightdeck')),
);
c.type(c.field('Title'), 'x');
c.click(c.button('Save draft'));
check(
  "C4 a bad field shows the server's error next to it and is marked invalid",
  !!(await c.until(() =>
    c.d.querySelector('.cn-field.invalid .cn-err')?.textContent.includes('at least 3'),
  )) && c.field('Title').getAttribute('aria-invalid') === 'true',
);
c.type(c.field('Title'), 'About Flightdeck (edited in test)');
c.click(c.button('Save draft'));
check(
  'C5 saving a draft confirms it is not live yet',
  !!(await c.until(() =>
    c.text().includes('Draft saved. It is not on the site until you publish.'),
  )),
);
check(
  'C6 the live page is unchanged by a draft',
  !(await page('/about/')).includes('edited in test'),
);
c.click(c.button('Preview'));
const frame = await c.until(() => c.d.querySelector('.cn-preview iframe'));
check(
  'C7 preview renders the draft with the real site renderer, sandboxed',
  !!frame &&
    frame.getAttribute('sandbox') === '' &&
    (frame.getAttribute('srcdoc') || '').includes('About Flightdeck (edited in test)'),
);
c.click(c.button('Close'));
c.click(c.button('Publish'));
check(
  'C8 publishing confirms and the public page shows the change',
  !!(await c.until(() => c.text().includes('Published. The site shows it now.'))) &&
    (await page('/about/')).includes('About Flightdeck (edited in test)'),
);
c.click(c.button('History'));
const restore = await c.until(() =>
  [...c.d.querySelectorAll('.cn-history button')]
    .filter((b) => b.textContent.includes('Restore'))
    .pop(),
);
check(
  'C9 history lists the save and the publish',
  !!restore &&
    c.d.querySelector('.cn-history').textContent.includes('Published') &&
    c.d.querySelector('.cn-history').textContent.includes('Draft saved'),
);
c.click(restore);
check(
  'C10 restoring puts an earlier version in the draft without changing the site',
  !!(await c.until(() => c.text().includes('That version is now the draft'))) &&
    (await page('/about/')).includes('edited in test'),
);
check('C11 no script errors while editing', c.errors.length === 0, c.errors.join(' | '));

// ---------------------------------------------------------------- owner: a new FAQ, published
c = boot('user_owner', '#/admin/faqs');
await c.until(() => c.button('New question'));
c.click(c.button('New question'));
await c.until(() => c.field('Question'));
c.type(c.field('Question'), 'Is this question from the console test?');
c.type(c.field('Answer'), 'Yes, it was written and published through the console.');
c.type(c.field('Section on the help page'), 'Testing');
c.click(c.button('Publish'));
check(
  'C12 a new FAQ can be written and published from the console, and appears on the help page',
  !!(await c.until(() => c.text().includes('Published. The site shows it now.'))) &&
    (await page('/help/')).includes('Is this question from the console test?'),
);

// ---------------------------------------------------------------- owner: inbox
c = boot('user_owner', '#/admin/inbox');
await c.until(() => c.text().includes('TEST DATA'));
c.click(
  [...c.d.querySelectorAll('.ad-enq-act button')].find((b) => b.textContent.trim() === 'Resolve'),
);
check(
  'C13 an enquiry can be resolved and moves to the Resolved filter',
  !!(await c.until(() => c.text().includes('Marked as resolved.'))) &&
    /Resolved\s*1/.test(c.d.querySelector('.cn-filters').textContent),
);

// ---------------------------------------------------------------- owner: operations and audit
c = boot('user_owner', '#/admin/health');
check(
  'C14 provider health shows real state only ("No calls yet")',
  !!(await c.until(() => c.text().includes('No calls yet'))),
);
c = boot('user_owner', '#/admin/audit');
check(
  'C15 the audit log lists the console changes',
  !!(await c.until(
    () => c.text().includes('content page about publish') && c.text().includes('You'),
  )),
);

// ---------------------------------------------------------------- not the owner
c = boot('user_other', '#/admin/pages');
check(
  'C16 a signed-in user who is not the owner is refused by the server',
  !!(await c.until(() => c.text().includes('This area is for the site owner.'))),
);

console.log(failed ? `\n${failed} FAILED` : '\nAll console checks passed');
process.exit(failed ? 1 : 0);
