// Whether the signed-in app may switch on Lenis smooth scrolling.
// Never for people who ask the system for reduced motion, and never where the browser lacks what Lenis needs (ResizeObserver).
type Env = { ResizeObserver?: unknown; matchMedia?: (query: string) => { matches: boolean } };
export function smoothScrollAllowed(
  env: Env | undefined = typeof window === 'undefined' ? undefined : (window as unknown as Env),
): boolean {
  if (!env || typeof env.ResizeObserver === 'undefined') return false;
  if (
    typeof env.matchMedia === 'function' &&
    env.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return false;
  return true;
}
