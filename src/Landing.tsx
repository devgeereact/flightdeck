import {useEffect,useRef} from 'react';
import {Plane,ArrowRight,Check} from 'lucide-react';
import {SignInButton,SignUpButton} from '@clerk/react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {SplitText} from 'gsap/SplitText';
import {MotionPathPlugin} from 'gsap/MotionPathPlugin';
import {DrawSVGPlugin} from 'gsap/DrawSVGPlugin';
import {track,trackOnce,ga} from './track';
import {HEADER_LINKS,FOOTER_GROUPS,FOOTER_NOTE} from './siteNav';
const LEGAL_LINKS=FOOTER_GROUPS.flatMap(g=>g.links).filter(l=>['Privacy','Cookies','Terms','Contact us'].includes(l.label));
gsap.registerPlugin(useGSAP,SplitText,MotionPathPlugin,DrawSVGPlugin);

// One calm hero: headline, two actions, and an illustrative flight drawn in the app's own look.
// Everything on the right is an ILLUSTRATION (it says so); no real flight data is claimed here.
const STAGES:[number,string][]=[[0,'Boarding'],[0.06,'Departed'],[0.12,'En route'],[0.88,'Landing soon']];

export default function Landing(){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{trackOnce('landing_view')},[]);
 useGSAP(()=>{
  const q=gsap.utils.selector(root);
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const stage=q('.chip-status')[0] as HTMLElement,togo=q('.chip-togo')[0] as HTMLElement;
   const prog={v:0};
   const intro=gsap.timeline({defaults:{ease:'power3.out'}});
   intro.from(q('.land-nav .brand'),{autoAlpha:0,x:-14,duration:.6}).from(q('.land-menu > *'),{autoAlpha:0,y:-12,duration:.5,stagger:.06},'<.1').from(q('.land-bottom > *, .land-bottom nav a'),{autoAlpha:0,y:12,duration:.5,stagger:.05},0.5)
    .from(q('.eyebrow'),{autoAlpha:0,y:14,duration:.5},'<.1')
    .from(q('.hero-sub,.hero-cta,.hero-points li'),{autoAlpha:0,y:22,duration:.65,stagger:.09},'>-.1')
    .from(q('.hero-panel'),{autoAlpha:0,scale:.94,y:24,duration:.9},'<.1')
    .from(q('.route-base'),{autoAlpha:0,duration:.9},'<.3')
    .from(q('.chip'),{autoAlpha:0,scale:.6,y:16,duration:.6,ease:'back.out(1.8)',stagger:.12},'>-.6');
   // Headline: words rise out of their lines once the fonts are ready (so the split is measured correctly).
   const title=q('.hero-title')[0] as HTMLElement;
   gsap.set(title,{autoAlpha:0});
   document.fonts.ready.then(()=>{
    SplitText.create(title,{type:'words',mask:'words',autoSplit:true,onSplit:self=>{gsap.set(title,{autoAlpha:1});return gsap.from(self.words,{yPercent:115,duration:.9,ease:'power4.out',stagger:.07,delay:.15})}});
   });
   // The flight: the plane flies the arc, the solid line follows it, the status chip tells the story. Then it starts over.
   const routeBase=q('.route-base')[0] as unknown as SVGPathElement;
   const fly=gsap.timeline({repeat:-1,repeatDelay:1.6,delay:1.9});
   fly.fromTo(q('.route-live'),{drawSVG:'0%'},{drawSVG:'100%',duration:8,ease:'power1.inOut'},0)
    .to(q('.plane'),{duration:8,ease:'power1.inOut',motionPath:{path:routeBase,align:routeBase,alignOrigin:[.5,.5],autoRotate:90}},0)
    .to(prog,{v:1,duration:8,ease:'power1.inOut',onUpdate:()=>{let label=STAGES[0][1];for(const [at,t] of STAGES)if(prog.v>=at)label=t;if(stage.textContent!==label)stage.textContent=label;const km=Math.max(0,Math.round(5540*(1-prog.v)));const txt=prog.v<.06?'Ready for departure':km===0?'Arrived':`${km.toLocaleString('en-GB')} km to go`;if(togo.textContent!==txt)togo.textContent=txt}},0)
    .set(q('.plane'),{autoAlpha:0},8).set(q('.plane'),{autoAlpha:1},9.6);
   // Calls to action lean a few pixels toward the pointer (only where there is a real pointer), and the tick marks pop in one by one.
   if(window.matchMedia('(hover: hover)').matches){
    q('.cta').forEach((btn:Element)=>{
     const el=btn as HTMLElement,qx=gsap.quickTo(el,'x',{duration:.5,ease:'power3.out'}),qy=gsap.quickTo(el,'y',{duration:.5,ease:'power3.out'});
     const mv=(e:PointerEvent)=>{const r=el.getBoundingClientRect();qx((e.clientX-(r.left+r.width/2))*.18);qy((e.clientY-(r.top+r.height/2))*.28)},lv=()=>{qx(0);qy(0)};
     el.addEventListener('pointermove',mv);el.addEventListener('pointerleave',lv);
    });
   }
   gsap.from(q('.hero-points svg'),{scale:0,rotation:-90,duration:.5,ease:'back.out(2.4)',stagger:.12,delay:1.1,transformOrigin:'50% 50%'});
   // Chips drift gently; the panel leans a few pixels toward the pointer on devices that have one.
   q('.chip').forEach((el:Element,i:number)=>gsap.to(el,{y:`+=${i%2?9:-9}`,duration:'random(2.4,3.6)',ease:'sine.inOut',yoyo:true,repeat:-1,delay:i*.2+2}));
   const panel=q('.hero-panel')[0] as HTMLElement;
   if(window.matchMedia('(hover: hover)').matches){
    const rx=gsap.quickTo(panel,'rotationY',{duration:.8,ease:'power3.out'}),ry=gsap.quickTo(panel,'rotationX',{duration:.8,ease:'power3.out'});
    const move=(e:PointerEvent)=>{rx((e.clientX/window.innerWidth-.5)*6);ry(-(e.clientY/window.innerHeight-.5)*5)};
    window.addEventListener('pointermove',move);
    return()=>window.removeEventListener('pointermove',move);
   }
  });
 },{scope:root});
 return <div className="landing" ref={root}>
  <header className="land-nav"><a className="brand" href="/"><span className="brand-mark"><Plane size={23}/></span>flightdeck<span className="brand-dot">.</span></a><nav className="land-menu" aria-label="Main">{HEADER_LINKS.map(l=><a key={l.label} href={l.href}>{l.label}</a>)}<SignInButton mode="modal"><button className="land-signin">Sign in</button></SignInButton></nav></header>
  <section className="hero" aria-labelledby="hero-title">
   <div className="hero-copy">
    <span className="eyebrow">YOUR JOURNEY, IN VIEW</span>
    <h1 className="hero-title" id="hero-title">Know your flight before the airport does.</h1>
    <p className="hero-sub">Live status, gates, baggage belts and where the aircraft is right now, together in one calm place. Free to use.</p>
    <div className="hero-cta">
     <SignUpButton mode="modal"><button className="cta" onClick={()=>{track('cta_click');ga('cta_click',{source:'hero'})}}>Create free account<ArrowRight size={17}/></button></SignUpButton>
     <SignInButton mode="modal"><button className="cta ghost">Sign in</button></SignInButton>
    </div>
    <ul className="hero-points"><li><Check size={15}/>Outbound or inbound, clearly labelled</li><li><Check size={15}/>Real gate, terminal and baggage belt when reported</li><li><Check size={15}/>Position straight from the aircraft</li></ul>
   </div>
   <div className="hero-visual" aria-hidden="true">
    <div className="hero-panel">
     <svg viewBox="0 0 560 420" className="hero-map" role="img">
      <defs><pattern id="hero-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.2" fill="#a9bfb5" opacity=".55"/></pattern></defs>
      <rect width="560" height="420" fill="url(#hero-dots)"/>
      <path d="m20 120 58-30 74 12 22 34 52 5 34 46-12 44-48 5-26 50-46 10-17-34-37-25-24-60z M372 70l62 16 48 48 84 10 38 30v120l-62-18-46 21-48-41-28-76-40-38z" fill="#cfddd4" opacity=".75"/>
      <path className="route-base" d="M92 300 Q290 10 478 178" fill="none" stroke="#9db7a6" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round"/>
      <path className="route-live" d="M92 300 Q290 10 478 178" fill="none" stroke="#214e3e" strokeWidth="3.5" strokeLinecap="round"/>
      <circle cx="92" cy="300" r="7" fill="#214e3e"/><circle cx="478" cy="178" r="7" fill="#214e3e"/>
      <text x="74" y="334" className="hero-code">LHR</text><text x="456" y="212" className="hero-code">JFK</text>
      <g className="plane"><path d="m0-16 4.5 11.5 12.5 5.5v3.5L3.5 1.5 2.3 11.5l4.7 3.5v2.3l-7-2.3-7 2.3V15l4.7-3.5-1.2-10L-17 4.5V1l12.5-5.5z" fill="#214e3e"/></g>
     </svg>
     <div className="chip chip-dir"><span className="pill">OUTBOUND</span>London (LHR)</div>
     <div className="chip chip-status-wrap"><span className="dot"/><span className="chip-status">Boarding</span></div>
     <div className="chip chip-togo-wrap"><Plane size={14}/><span className="chip-togo">Ready for departure</span></div>
     <div className="chip chip-term"><small>TERMINAL</small><strong>5</strong></div>
     <span className="hero-caption">Illustration, not a real flight</span>
    </div>
   </div>
  </section>
  <footer className="land-bottom"><span>© {new Date().getFullYear()} Flightdeck</span><nav aria-label="Legal">{LEGAL_LINKS.map(l=><a key={l.label} href={l.href}>{l.label}</a>)}</nav><span className="land-note">{FOOTER_NOTE}</span></footer>
 </div>
}
