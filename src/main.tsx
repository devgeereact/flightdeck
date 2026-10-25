import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Plane,ArrowUpRight,ArrowRight,Search,RefreshCw,Navigation,CalendarDays,Info,ChevronRight,Bookmark,Download,AlertCircle,ListChecks,ShieldCheck} from 'lucide-react';
import type {Flight,FlightResponse} from './types';
import {apiFetch,setTokenGetter} from './api';
import {getOwner as checklistOwner,clearLocal as clearChecklist} from './checklistStore';
import {track,ga,gaPageview} from './track';
import Feedback from './Feedback';
import SiteFooter from './SiteFooter';
import FlightView from './FlightView';
import {time,ukDate} from './flightFormat';
import {registerSW} from 'virtual:pwa-register';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {ClerkProvider,Show,SignInButton,SignUpButton,UserButton,useAuth,useUser} from '@clerk/react';
import './style.css';
const today=()=>ukDate();
const CLERK_KEY=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string|undefined;
// Calendar days are counted against the UK date, so "Today" means today in the UK.
const ymdUTC=(d:string)=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10));
const dayDiff=(d:string)=>Math.round((ymdUTC(d)-ymdUTC(today()))/86400000);
const dayLabel=(d:string)=>{const n=dayDiff(d);return n===0?'Today':n===1?'Tomorrow':n===-1?'Yesterday':new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'))};
// The last few results, kept on this device only so a flight can still be read without a connection. Always shown as "last fetched at", never as live.
const LAST_KEY='flightdeck-last-results';
function rememberResult(key:string,data:FlightResponse){try{const all=JSON.parse(localStorage.getItem(LAST_KEY)||'{}');all[key]={at:Date.now(),data};const keep=Object.keys(all).sort((a,b)=>all[b].at-all[a].at).slice(0,6);localStorage.setItem(LAST_KEY,JSON.stringify(Object.fromEntries(keep.map(k=>[k,all[k]]))))}catch{/* storage full or blocked: nothing to keep */}}
function recallResult(key:string):{at:number;data:FlightResponse}|null{try{return JSON.parse(localStorage.getItem(LAST_KEY)||'{}')[key]||null}catch{return null}}
// A flight can be opened from a link: #/flight/BA59/2026-10-25
const FLIGHT_LINK=/^#\/flight\/([A-Z0-9]{3,8})\/(\d{4}-\d{2}-\d{2})$/;
const localZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
function TokenBridge(){const {getToken}=useAuth();useEffect(()=>{setTokenGetter(()=>getToken());return()=>setTokenGetter(null)},[getToken]);return null}
type SavedItem={number:string;date:string};
const sameItem=(a:SavedItem,b:SavedItem)=>a.number===b.number&&a.date===b.date;
const cleanSaved=(v:unknown):SavedItem[]=>Array.isArray(v)?v.filter((x:any)=>x&&typeof x.number==='string'&&typeof x.date==='string').map((x:any)=>({number:x.number,date:x.date})).slice(0,12):[];
function SignedInName(){const {user}=useUser();const name=user?.firstName||user?.fullName||user?.username||user?.primaryEmailAddress?.emailAddress?.split('@')[0]||'';return name?<span className="user-name" title={user?.primaryEmailAddress?.emailAddress||name}>{name}</span>:null}
function AuthBar(){return <div className="auth-bar"><Show when="signed-out"><SignInButton mode="modal"><button className="text-button">Sign in</button></SignInButton><SignUpButton mode="modal"><button className="text-button primary">Create account</button></SignUpButton></Show><Show when="signed-in"><SignedInName/><UserButton/></Show></div>}
// Keeps the saved-flights list in the signed-in user's Clerk profile (unsafeMetadata, editable only by that user) so it follows them across devices.
function SavedSync({saved,setSaved,setSignedIn,setUserId}:{saved:SavedItem[];setSaved:(v:SavedItem[])=>void;setSignedIn:(v:boolean)=>void;setUserId:(v:string|null)=>void}){
 const {isLoaded,isSignedIn,user}=useUser();const hydrated=useRef<string|null>(null);
 const owner=(v?:string)=>{try{if(v===undefined)return localStorage.getItem('flightdeck-saved-owner');if(v)localStorage.setItem('flightdeck-saved-owner',v);else localStorage.removeItem('flightdeck-saved-owner')}catch{}return null};
 useEffect(()=>{if(!isLoaded)return;setSignedIn(!!isSignedIn);setUserId(user?.id??null);
  // Signed out (including after the page reload that signing out causes) while this device still holds an account's list: wipe it, so the next person on a shared device does not see it.
  if(!isSignedIn||!user){hydrated.current=null;if(owner()){setSaved([]);owner('')}return}
  if(hydrated.current===user.id)return;hydrated.current=user.id;
  const cloud=cleanSaved(user.unsafeMetadata?.savedFlights);const mine=owner()===user.id||!owner()?saved:[];const merged=[...cloud,...mine.filter(l=>!cloud.some(c=>sameItem(c,l)))].slice(0,12);owner(user.id);setSaved(merged)},[isLoaded,isSignedIn,user?.id]);
 useEffect(()=>{if(!isLoaded||!isSignedIn||!user||hydrated.current!==user.id)return;const cloud=cleanSaved(user.unsafeMetadata?.savedFlights);
  if(JSON.stringify(cloud)===JSON.stringify(saved))return;const t=setTimeout(()=>{user.update({unsafeMetadata:{...user.unsafeMetadata,savedFlights:saved}}).catch(()=>{})},600);return()=>clearTimeout(t)},[saved,isLoaded,isSignedIn,user?.id]);
 return null}
const ROUTES=['overview','saved','checklist','admin'];
const readRoute=()=>{const h=location.hash.replace(/^#\/?/,'');return ROUTES.includes(h)?h:'overview'};
// Smooth scrolling for the signed-in app. Lenis sits on top of normal scrolling, so keyboard, find-in-page and anchors keep working, and it switches itself off for people who prefer reduced motion.
let lenis:Lenis|null=null;
const toTop=()=>{if(lenis)lenis.scrollTo(0,{immediate:true});else window.scrollTo(0,0)};
// Tiny hash router: #/checklist etc. Works with the static host (no server rewrites) and with the browser back button.
function useHashRoute():[string,(r:string)=>void]{const [r,setR]=useState(readRoute);useEffect(()=>{const f=()=>{setR(readRoute());toTop();gaPageview()};window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);return [r,(n:string)=>{const next=n==='overview'?'':'/'+n;if(location.hash.replace(/^#/,'')!==next)location.hash=next;else setR(readRoute())}]}
const ChecklistView=lazy(()=>import('./Checklist'));
const AdminView=lazy(()=>import('./Admin'));
const Landing=lazy(()=>import('./Landing'));
// Signed-out visitors get the landing page; signed-in users get the dashboard. Without a Clerk key the app is open (no accounts).
// Signing out reloads onto the landing page, where the dashboard (and its own clean-up) is not mounted. Anything an account left on this
// device is wiped here so the next person on a shared computer does not see it. A guest's own list (no owner mark) is left alone.
function SignedOutCleanup(){useEffect(()=>{try{if(localStorage.getItem('flightdeck-saved-owner')){localStorage.removeItem('flightdeck-saved');localStorage.removeItem('flightdeck-saved-owner')}}catch{}try{localStorage.removeItem(LAST_KEY)}catch{}if(checklistOwner())clearChecklist()},[]);return null}
function Gate(){const {isLoaded,isSignedIn}=useAuth();const [slow,setSlow]=useState(false);
 useEffect(()=>{if(isLoaded)return;const t=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(t)},[isLoaded]);
 if(!isLoaded)return <div className="boot" role="status" aria-label="Loading">{slow&&<div className="boot-msg"><Plane size={26}/><h2>Sign-in could not load</h2><p>Flightdeck could not reach its sign-in service. Check your connection, then reload the page.</p><button className="cta" onClick={()=>location.reload()}>Reload</button></div>}</div>;
 return isSignedIn?<Dashboard/>:<><SignedOutCleanup/><Suspense fallback={<div className="boot" role="status" aria-label="Loading"/>}><Landing/></Suspense></>}
function Dashboard(){
 const [number,setNumber]=useState(''),[date,setDate]=useState(today),[live,setLive]=useState(true),[data,setData]=useState<FlightResponse|null>(null),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tab,setTab]=useHashRoute(),[online,setOnline]=useState(navigator.onLine),[now,setNow]=useState(new Date()),[auto,setAuto]=useState(false),[changes,setChanges]=useState<string[]>([]),[saved,setSaved]=useState<SavedItem[]>(()=>{try{return JSON.parse(localStorage.getItem('flightdeck-saved')||'[]')}catch{return []}}),[install,setInstall]=useState<any>(null),[needRefresh,setNeedRefresh]=useState(false),[userId,setUserId]=useState<string|null>(null),[packFor,setPackFor]=useState<SavedItem|null>(null),[me,setMe]=useState<{isAdmin:boolean;unread:number|null}>({isAdmin:false,unread:null}),[signedIn,setSignedIn]=useState(false);
 const updateRef=useRef<((reload?:boolean)=>Promise<void>)|null>(null);
 const [stale,setStale]=useState(''),[shareNote,setShareNote]=useState(''),[installHelp,setInstallHelp]=useState(false);
 const searchRef=useRef<HTMLInputElement>(null),request=useRef<AbortController|null>(null),version=useRef(0),previous=useRef<Flight|null>(null),active=useRef<{number:string;date:string}|null>(null);
 const flight=data?.flights[selected];
useEffect(()=>{if(!CLERK_KEY||!userId){setMe({isAdmin:false,unread:null});return}let live=true;apiFetch('/api/me').then(r=>r.ok?r.json():null).then(j=>{if(live&&j)setMe({isAdmin:!!j.isAdmin,unread:j.unread??null})}).catch(()=>{});return()=>{live=false}},[userId]);
 useEffect(()=>{if(typeof ResizeObserver==='undefined')return;const l=new Lenis({autoRaf:true,lerp:.12,allowNestedScroll:true});lenis=l;return()=>{l.destroy();if(lenis===l)lenis=null}},[]);
 useEffect(()=>{const f=()=>{track('pwa_install');ga('pwa_install')};window.addEventListener('appinstalled',f);return()=>window.removeEventListener('appinstalled',f)},[]);
 useEffect(()=>{updateRef.current=registerSW({onNeedRefresh:()=>setNeedRefresh(true),onRegisteredSW:(_url,r)=>{if(r)setInterval(()=>{r.update().catch(()=>{})},3600000)}});},[]);
 useEffect(()=>{fetch('/api/config').then(r=>r.json()).then(d=>setLive(!!d.liveAvailable)).catch(()=>{});const a=()=>setOnline(true),b=()=>setOnline(false),i=(e:Event)=>{e.preventDefault();setInstall(e)};window.addEventListener('online',a);window.addEventListener('offline',b);window.addEventListener('beforeinstallprompt',i);const timer=setInterval(()=>setNow(new Date()),1000);return()=>{clearInterval(timer);request.current?.abort();window.removeEventListener('online',a);window.removeEventListener('offline',b);window.removeEventListener('beforeinstallprompt',i)}},[]);
 async function load(n=number,d=date,refresh=false){
  request.current?.abort();const controller=new AbortController();request.current=controller;const id=++version.current;setBusy(true);setError('');setStale('');if(!refresh){setData(null);setChanges([]);previous.current=null;active.current=null;setAuto(false)}
  try{const r=await apiFetch(`/api/flights?number=${encodeURIComponent(n)}&date=${d}&mode=live`,{signal:controller.signal});const result=await r.json();if(!r.ok)throw Error(result.error||'Flightdeck could not get this flight. Please try again.');if(version.current!==id)return;
   const p=previous.current;const next:Flight|undefined=p?result.flights.find((f:Flight)=>f.id===p.id):result.flights[0];if(refresh&&p&&next){const updates:string[]=[];for(const [key,label] of [['status','Status'],['gateOut','Departure gate'],['gateIn','Arrival gate'],['baggage','Baggage belt'],['estimatedIn','Estimated arrival']] as const){if(p[key]!==next[key])updates.push(`${label} updated at ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`)}if(updates.length)setChanges(old=>[...updates,...old].slice(0,8))}
   ga('flight_search',{result:result.flights.length?'ok':'fail'});setData(result);rememberResult(n+'|'+d,result);try{if(!refresh||location.hash.startsWith('#/flight/'))history.replaceState(null,'',`#/flight/${n}/${d}`)}catch{/* old browsers: no link, still works */}setSelected(Math.max(0,next?result.flights.findIndex((f:Flight)=>f.id===next.id):0));previous.current=next||null;active.current={number:n,date:d};
  }catch(e){if((e as Error).name!=='AbortError'&&version.current===id){const kept=recallResult(n+'|'+d);if(kept&&(!navigator.onLine||(e as Error).name==='TypeError')){setData(kept.data);setStale(`You're offline. This is what Flightdeck last fetched at ${new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short',timeZone:localZone()}).format(new Date(kept.at))}, so it may be out of date.`)}else setError((e as Error).message)}}finally{if(version.current===id)setBusy(false)}
 }
 useEffect(()=>{if(!auto||!online)return;const timer=setInterval(()=>{const a=active.current;if(a)void load(a.number,a.date,true)},60000);return()=>clearInterval(timer)},[auto,online]);
 function save(){if(!active.current)return;ga('flight_saved');const a=active.current;const items=[a,...saved.filter(s=>s.number!==a.number||s.date!==a.date)].slice(0,6);setSaved(items);try{localStorage.setItem('flightdeck-saved',JSON.stringify(items))}catch{setError('Your browser could not save this flight.')}}
 const refresh=()=>{const a=active.current;if(a)void load(a.number,a.date,true)};
 useEffect(()=>{const m=location.hash.match(FLIGHT_LINK);if(m){setNumber(m[1]);setDate(m[2]);void load(m[1],m[2])}},[]);
 async function share(){const a=active.current;if(!a)return;const url=`${location.origin}/#/flight/${a.number}/${a.date}`;
  try{if(navigator.share){await navigator.share({title:`${a.number} on Flightdeck`,url});return}await navigator.clipboard.writeText(url);setShareNote('Link copied');setTimeout(()=>setShareNote(''),3000)}
  catch(e){if((e as Error).name!=='AbortError'){setShareNote('Copy this link: '+url)}}}
 return <div className="app">{CLERK_KEY&&<TokenBridge/>}{CLERK_KEY&&<SavedSync saved={saved} setSaved={items=>{setSaved(items);try{localStorage.setItem('flightdeck-saved',JSON.stringify(items))}catch{}}} setSignedIn={setSignedIn} setUserId={setUserId}/>}<aside className="sidebar"><a className="brand" href="#"><span className="brand-mark"><Plane size={23}/></span>flightdeck<span className="brand-dot">.</span></a><div className="nav-label">YOUR TRAVEL SPACE</div><button className={tab==='overview'?'nav active':'nav'} onClick={()=>{setTab('overview');searchRef.current?.focus()}}><Navigation size={18}/>Flight tracker<ChevronRight size={15}/></button><button className={tab==='saved'?'nav active':'nav'} onClick={()=>setTab('saved')}><Bookmark size={18}/>Saved flights <span className="count">{saved.length}</span></button><button className={tab==='checklist'?'nav active':'nav'} onClick={()=>setTab('checklist')}><ListChecks size={18}/>Packing list</button>{me.isAdmin&&<button className={tab==='admin'?'nav active':'nav'} onClick={()=>setTab('admin')}><ShieldCheck size={18}/>Owner console{!!me.unread&&<span className="count">{me.unread}</span>}</button>}<div className="side-bottom"><div className="little-plane"><Plane size={26}/></div><h3>Track it, then pack for it.</h3><p>Check your flight and the weather, then tick off your packing list.</p><button className="install" onClick={async()=>{if(install){await install.prompt();setInstall(null)}else{setInstallHelp(true)}}}><Download size={15}/>Install app</button><div className="connection"><span className={online?'dot':'dot offline'}/>{online?'Connected':'Offline · updates paused'}</div></div></aside>
 <main><header className="topbar"><span>{({overview:'FLIGHT TRACKER',saved:'SAVED FLIGHTS',checklist:'PACKING LIST',admin:'OWNER CONSOLE'} as Record<string,string>)[tab]}</span><div><Feedback/>{CLERK_KEY?<AuthBar/>:<span className="avatar">FD</span>}</div></header><nav className="mobile-nav" aria-label="Main navigation"><button onClick={()=>setTab('overview')}><Navigation size={15}/>Flight tracker</button><button onClick={()=>setTab('saved')}><Bookmark size={15}/>Saved flights ({saved.length})</button><button onClick={()=>setTab('checklist')}><ListChecks size={15}/>Packing list</button>{me.isAdmin&&<button onClick={()=>setTab('admin')}><ShieldCheck size={15}/>Owner{!!me.unread&&` (${me.unread})`}</button>}</nav>
 {(tab==='overview'||tab==='saved')&&<>{tab==='overview'&&data&&<h1 className="sr-only">Flight tracker</h1>}{(tab==='saved'||!data)&&<section className="heading"><div><div className="eyebrow">FLIGHT TRACKER</div><h1>Where are you flying?</h1><p>Enter a flight number and date to see its status, gates and where it is now.</p></div><span className="date-badge"><CalendarDays size={16}/>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(now)}</span></section>}
 <form className="search-card" onSubmit={e=>{e.preventDefault();setTab('overview');void load()}}><label><span>FLIGHT NUMBER</span><div><Plane size={18}/><input ref={searchRef} aria-label="Flight number" value={number} onChange={e=>setNumber(e.target.value.toUpperCase())} placeholder="e.g. BA117" required maxLength={12}/></div></label><label><span>DEPARTURE DATE</span><div><CalendarDays size={18}/><input aria-label="Departure date" type="date" value={date} required onChange={e=>setDate(e.target.value)}/></div></label><button className="search-button" disabled={busy}><Search size={17}/>{busy?'Searching…':'Track flight'}<ArrowRight size={17}/></button></form></>}
 {needRefresh&&<div role="status" className="notice"><RefreshCw size={17}/><span><strong>A new version is ready.</strong> Reload to update.</span><button className="text-button" onClick={()=>void updateRef.current?.(true)}>Reload</button></div>}
 {!online&&<div className="notice error"><AlertCircle size={17}/>You're offline. What you've already loaded may be out of date. Updates restart when you're back online.</div>}
 {stale&&<div role="status" className="notice"><AlertCircle size={17}/><span>{stale}</span></div>}
 {error&&<div role="alert" className="notice error"><AlertCircle size={18}/>{error}<button onClick={refresh}>Try again</button></div>}
 {tab==='admin'?(me.isAdmin?<Suspense fallback={<div role="status" className="panel empty">Loading the owner console…</div>}><AdminView onUnread={(n:number)=>setMe(m=>({...m,unread:n}))}/></Suspense>:<div className="panel empty"><ShieldCheck size={30}/><h2>This area is for the site owner</h2><p>You are signed in, but this account does not have owner access.</p></div>):tab==='checklist'?<Suspense fallback={<div role="status" className="panel empty">Loading your packing list…</div>}><ChecklistView saved={saved} signedIn={signedIn} userId={userId} request={packFor} onRequestDone={()=>setPackFor(null)} onTrack={(n:string,d:string)=>{setNumber(n);setDate(d);setTab('overview');void load(n,d)}}/></Suspense>:tab==='saved'?<section className="panel saved"><h2>Saved flights</h2><p>{signedIn?'Saved to your account, so they follow you to other devices.':'Saved on this browser. Sign in to keep them across devices.'} Opening a flight fetches a fresh result.</p>{!saved.length?<p>No saved flights yet. Track a flight, then choose Save flight.</p>:saved.map((s,i)=><div className="saved-row" key={s.number+s.date}><button onClick={()=>{setNumber(s.number);setDate(s.date);setTab('overview');void load(s.number,s.date)}}><Plane size={18}/><strong>{s.number}</strong><span className="saved-day" title={s.date}>{dayLabel(s.date)}</span>{dayDiff(s.date)<0&&<span className="pill">PAST</span>}<ArrowUpRight size={16}/></button><button aria-label={`Make a packing list for ${s.number}`} onClick={()=>{setPackFor({number:s.number,date:s.date});setTab('checklist')}}><ListChecks size={14}/>Packing list</button><button aria-label={`Remove ${s.number}`} onClick={()=>{const items=saved.filter((_,j)=>j!==i);setSaved(items);localStorage.setItem('flightdeck-saved',JSON.stringify(items))}}>Remove</button></div>)}</section>:<>
 {data?.notes?.length?<div role="status" className="notice"><Info size={17}/><span>{data.notes.join(' ')}</span></div>:null}
 {!live&&<div className="notice error"><AlertCircle size={17}/>Live flight data is not configured on this server yet.</div>}
 {busy&&!data&&<div role="status" className="panel empty">Looking up your flight…</div>}
 {!busy&&!data&&!error&&<div className="panel empty"><Plane size={30}/><h2>Track a flight</h2><p>Enter a flight number such as BA117 or LH400 and the departure date, then choose Track flight. Times, gates and the aircraft's position appear here when the airline and data providers report them.</p></div>}
 {data&&!data.flights.length&&<div className="panel empty"><Search size={30}/><h2>No flights found</h2><p>Nothing matched that flight number and date. Check the number, or try the airline's three-letter callsign, such as BAW117. Schedules cover yesterday to three days ahead, and a live position shows only while the aircraft is transmitting.</p></div>}
 {data&&data.flights.length>1&&<label className="flight-picker">Choose a leg <select onChange={e=>{const i=Number(e.target.value);setSelected(i);previous.current=data.flights[i]}} value={selected}>{data.flights.map((f,i)=><option value={i} key={f.id}>{f.number} · {f.origin.code} → {f.destination.code} · {time(f.scheduledOut,f.origin.timezone)}</option>)}</select></label>}
 {flight&&data&&<FlightView flight={flight} data={data} now={now} busy={busy} auto={auto} setAuto={setAuto} changes={changes} onRefresh={refresh} onSave={save} onShare={()=>void share()} shareNote={shareNote}/>}
 </>}
 {installHelp&&<InstallHelp onClose={()=>setInstallHelp(false)}/>}
 <div className="sf-gap"/>
 <SiteFooter inApp/></main></div>
}
// Shown when the browser does not offer its own install prompt. Plain steps for the browsers people actually use.
function InstallHelp({onClose}:{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;if(d&&!d.open)d.showModal?.();return()=>{if(d?.open)d.close()}},[]);
 return <dialog ref={ref} className="fb-dialog install-help" aria-labelledby="ih-title" onClose={onClose} onClick={e=>{if(e.target===ref.current)ref.current?.close()}}>
  <div className="fb-head"><h2 id="ih-title">Install Flightdeck</h2><button className="fb-close" onClick={()=>ref.current?.close()} aria-label="Close">×</button></div>
  <div className="ih-body"><p>Installing puts Flightdeck on your home screen or dock, opens it in its own window and keeps your packing list available without a connection.</p>
   <ul><li><strong>iPhone or iPad (Safari):</strong> tap the Share button, then Add to Home Screen.</li><li><strong>Android (Chrome):</strong> open the menu (three dots), then Install app or Add to Home screen.</li><li><strong>Chrome or Edge on a computer:</strong> click the install icon at the right of the address bar, or open the menu and choose Install Flightdeck.</li><li><strong>Safari on a Mac:</strong> choose File, then Add to Dock.</li><li><strong>Firefox:</strong> Firefox does not install web apps. Use another browser, or bookmark this page.</li></ul>
   <button className="cta" onClick={()=>ref.current?.close()}>Got it</button></div>
 </dialog>}
const app=CLERK_KEY?<Gate/>:<Dashboard/>;createRoot(document.getElementById('root')!).render(<React.StrictMode>{CLERK_KEY?<ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/" appearance={{variables:{colorPrimary:'#214e3e',borderRadius:'8px',fontFamily:'DM Sans, sans-serif'}}}>{app}</ClerkProvider>:app}</React.StrictMode>);
