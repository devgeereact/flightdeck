import gsap from 'gsap';

// Runs an animation only when the browser can say whether the visitor prefers reduced motion, and only when they do not.
// (Older browsers and the test environment have no matchMedia; they simply get no animation.)
export const withMotion=(fn:()=>void)=>{
  if(typeof window==='undefined'||typeof window.matchMedia!=='function')return;
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{fn()});
};
