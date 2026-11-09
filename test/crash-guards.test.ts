// Found in the live check after the Phase 5 deploy (9 Nov 2026): the owner console crashed with "Cannot read properties of undefined
// (reading 'totals')" and the app's catch-all screen then said "Sign-in could not load", which sent the owner looking at the wrong thing.
// Two guards: the console must check the overview answer before drawing it, and the catch-all screen must not blame sign-in.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppBoundary from '../src/app/AppBoundary';
import AuthLoading from '../src/app/AuthLoading';
import { hasOverview } from '../src/console/guards';

test('hasOverview accepts the real overview answer and nothing else', () => {
  assert.equal(
    hasOverview({ overview: { totals: { searches: 1 }, series: {} }, allowance: {}, unread: 0 }),
    true,
  );
  for (const bad of [
    null,
    undefined,
    {},
    [],
    'x',
    0,
    { overview: null },
    { overview: {} },
    { error: 'Too many requests.' },
    { overview: { series: {} } },
  ]) {
    assert.equal(hasOverview(bad), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test('the sign-in failure screen is unchanged: it names sign-in and offers a retry', () => {
  const html = renderToStaticMarkup(createElement(AuthLoading, { failed: true }));
  assert.match(html, /Sign-in could not load/);
  assert.match(html, /Try again/);
});

test('the catch-all screen for an app error does not blame sign-in, and still offers a way out', () => {
  const html = renderToStaticMarkup(createElement(AuthLoading, { failed: true, kind: 'app' }));
  assert.doesNotMatch(html, /sign-in/i);
  assert.match(html, /Something went wrong/);
  assert.match(html, /Try again/);
  assert.match(html, /Back to the website/);
});

test('AppBoundary shows the app-error screen, not the sign-in one, after a crash', () => {
  const b = new AppBoundary({ children: null });
  b.state = { failed: true };
  const html = renderToStaticMarkup(b.render() as never);
  assert.match(html, /Something went wrong/);
  assert.doesNotMatch(html, /Sign-in could not load/);
});
