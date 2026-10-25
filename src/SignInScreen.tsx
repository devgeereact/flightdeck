import {useEffect} from 'react';
import {Plane,ArrowLeft} from 'lucide-react';
import {SignInButton,SignUpButton} from '@clerk/react';
import {registerSW} from 'virtual:pwa-register';
import {track,trackOnce,ga} from './track';
import SiteFooter from './SiteFooter';

const FLIGHT_LINK=/^#\/flight\/([A-Z0-9]{3,8})\/(\d{4}-\d{2}-\d{2})$/;
const dayLabel=(d:string)=>{const t=new Date(d+'T12:00:00Z');return Number.isNaN(t.getTime())?d:t.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})};

// What a signed-out visitor sees at /app/. The public website (/) explains the product; this screen only asks them to sign in,
// and says which flight they are about to open when they arrived from a link. After sign-in the same address opens that flight.
export default function SignInScreen(){
 useEffect(()=>{trackOnce('landing_view')},[]);
 // Signed-out visitors have nothing to lose, so a new release is applied as soon as it is ready.
 useEffect(()=>{let t:number|undefined;const update=registerSW({onNeedRefresh:()=>{void update(true)},onRegisteredSW:(_u,r)=>{if(r){r.update().catch(()=>{});t=window.setInterval(()=>{r.update().catch(()=>{})},3600000)}}});return()=>{if(t)clearInterval(t)}},[]);
 const m=location.hash.match(FLIGHT_LINK);
 const target=m?`${m[1]} on ${dayLabel(m[2])}`:location.hash.startsWith('#/checklist')?'your packing list':'';
 return <div className="signin-page">
  <header className="signin-top"><a className="brand" href="/"><span className="brand-mark"><Plane size={22}/></span><span>flightdeck<span className="brand-dot">.</span></span></a><a className="btn btn-secondary" href="/"><ArrowLeft size={16}/>Home</a></header>
  <main id="main" className="signin-main">
   <section className="signin-card" aria-labelledby="signin-h">
    <span className="signin-mark" aria-hidden="true"><Plane size={26}/></span>
    <h1 id="signin-h">{target?`Sign in to see ${target}`:'Sign in to Flightdeck'}</h1>
    <p>Look up flights, save them across your devices and keep your packing list. A free account is needed because every lookup uses a limited allowance from our data providers.</p>
    <div className="signin-actions">
     <SignInButton mode="modal"><button className="btn btn-primary btn-lg">Sign in</button></SignInButton>
     <SignUpButton mode="modal"><button className="btn btn-secondary btn-lg" onClick={()=>{track('cta_click');ga('cta_click',{source:'app_signin'})}}>Create free account</button></SignUpButton>
    </div>
    <p className="signin-note">No account needed for the <a href="/guides/">travel guides</a> or the <a href="/travel-checklist/">printable packing list</a>. See <a href="/how-it-works/">how Flightdeck works</a>.</p>
   </section>
  </main>
  <SiteFooter/>
 </div>
}
