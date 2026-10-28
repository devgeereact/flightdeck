import gsap from 'gsap';

// Runs an animation only when the browser can say whether the visitor prefers reduced motion, and only when they do not.
// (Older browsers and the test environment have no matchMedia; they simply get no animation.)
export const withMotion = (fn: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    fn();
  });
};

// gsap.from() on an empty selection logs a console warning. Animate only when something matched.
export const fromAny = (
  host: { from: (t: any, v: any, p?: any) => unknown },
  targets: Element[],
  vars: object,
  position?: string | number,
) => {
  if (targets.length) host.from(targets, vars, position);
};
