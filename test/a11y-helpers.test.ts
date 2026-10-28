import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothScrollAllowed } from '../src/shared/smoothScroll';
import { nextTabIndex } from '../src/shared/tabKeys';

const media = (reduce: boolean) => (q: string) => ({
  matches: reduce && q === '(prefers-reduced-motion: reduce)',
});
class RO {}

test('smooth scrolling never runs for people who prefer reduced motion', () => {
  assert.equal(smoothScrollAllowed({ ResizeObserver: RO, matchMedia: media(true) }), false);
});

test('smooth scrolling runs when motion is fine and the browser supports it', () => {
  assert.equal(smoothScrollAllowed({ ResizeObserver: RO, matchMedia: media(false) }), true);
  assert.equal(
    smoothScrollAllowed({ ResizeObserver: RO }),
    true,
    'no matchMedia: no stated preference',
  );
});

test('smooth scrolling is off where the browser lacks ResizeObserver, or there is no window', () => {
  assert.equal(smoothScrollAllowed({ matchMedia: media(false) }), false);
  assert.equal(smoothScrollAllowed(undefined), false);
});

test('tab keys: arrows wrap around, Home and End jump, other keys are ignored', () => {
  assert.equal(nextTabIndex('ArrowRight', 0, 5), 1);
  assert.equal(nextTabIndex('ArrowRight', 4, 5), 0);
  assert.equal(nextTabIndex('ArrowLeft', 0, 5), 4);
  assert.equal(nextTabIndex('ArrowLeft', 3, 5), 2);
  assert.equal(nextTabIndex('Home', 3, 5), 0);
  assert.equal(nextTabIndex('End', 1, 5), 4);
  assert.equal(nextTabIndex('Enter', 1, 5), null);
  assert.equal(nextTabIndex('ArrowRight', 0, 0), null);
});
