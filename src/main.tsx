import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Plane,ArrowUpRight,ArrowRight,Search,RefreshCw,Navigation,CalendarDays,Info,ChevronRight,Bookmark,Download,AlertCircle,ListChecks,ShieldCheck} from 'lucide-react';
import type {Flight,FlightResponse} from './types';
import {apiFetch,readableError} from './shared/api';
import {track,ga,gaPageview} from './shared/track';
import Feedback from './app/Feedback';
import SavedFlights from './app/SavedFlightCollection';
import AuthLoading from './app/AuthLoading';
import AppBoundary from './app/AppBoundary';
import SiteFooter from './SiteFooter';
import Announcements from './app/Announcements';
import InstallHelp from './app/InstallHelp';
import {AuthBar,SavedSync,SignedOutCleanup,TokenBridge} from './app/auth';
import {rememberResult,recallResult,type SavedItem} from './app/savedFlights';
import FlightView from './features/flight/FlightView';
import {time,ukDate} from './features/flight/flightFormat';
import {smoothScrollAllowed} from './shared/smoothScroll';
import {registerSW} from 'virtual:pwa-register';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {ClerkProvider,useAuth} from '@clerk/react';
import './styles/tokens.css';
import './style.css';
import './styles/workspace.css';
const today=()=>ukDate();
const CLERK_KEY=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string|undefined;
// A flight can be opened from a link: #/flight/BA59/2026-10-25
const FLIGHT_LINK=/^#\/flight\/([A-Z0-9]{3,8})\/(\d{4}-\d{2}-\d{2})$/;
const localZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const ROUTES=['overview','saved','checklist','admin'];
// The owner console has its own sections under #/admin/<section>/..., so only the first part picks the screen.
const readRoute=()=>{const h=location.hash.replace(/^#\/?/,'').split('/')[0];return ROUTES.includes(h)?h:'overview'};
// Smooth scrolling for the signed-in app. Lenis sits on top of normal scrolling, so keyboard, find-in-page and anchors keep working. It is never started for people who prefer reduced motion (see smoothScroll.ts).
let lenis:Lenis|null=null;
const toTop=()=>{if(lenis)lenis.scrollTo(0,{immediate:true});else window.scrollTo(0,0)};
// Tiny hash router: #/checklist etc. Works with the static host (no server rewrites) and with the browser back button.
function useHashRoute():[string,(r:string)=>void]{const [r,setR]=useState(readRoute);useEffect(()=>{const f=()=>{setR(readRoute());toTop();gaPageview()};window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);return [r,(n:string)=>{const next=n==='overview'?'':'/'+n;if(location.hash.replace(/^#/,'')!==next)location.hash=next;else setR(readRoute())}]}
const ChecklistView=lazy(()=>import('./features/checklist/Checklist'));
const AdminView=lazy(()=>import('./console/ConsoleShell'));
const SignInScreen=lazy(()=>import('./app/SignInScreen'));
// Signed-out visitors get the landing page; signed-in users get the dashboard. Without a Clerk key the app is open (no accounts).
function Gate(){const {isLoaded,isSignedIn}=useAuth();const [slow,setSlow]=useState(false);
 useEffect(()=>{if(isLoaded)return;const t=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(t)},[isLoaded]);
 if(!isLoaded)return <AuthLoading failed={slow}/>;
 return isSignedIn?<Dashboard/>:<><SignedOutCleanup/><Suspense fallback={<AuthLoading/>}><SignInScreen/></Suspense></>}
function Dashboard(){
 const [number,setNumber]=useState(''),[date,setDate]=useState(today),[live,setLive]=useState(true),[data,setData]=useState<FlightResponse|null>(null),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[tab,setTab]=useHashRoute(),[online,setOnline]=useState(navigator.onLine),[now,setNow]=useState(new Date()),[auto,setAuto]=useState(false),[changes,setChanges]=useState<string[]>([]),[saved,setSaved]=useState<SavedItem[]>(()=>{try{return JSON.parse(localStorage.getItem('flightdeck-saved')||'[]')}catch{return []}}),[install,setInstall]=useState<any>(null),[needRefresh,setNeedRefresh]=useState(false),[userId,setUserId]=useState<string|null>(null),[packFor,setPackFor]=useState<SavedItem|null>(null),[me,setMe]=useState<{isAdmin:boolean;unread:number|null}>({isAdmin:false,unread:null}),[signedIn,setSignedIn]=useState(false);
 const updateRef=useRef<((reload?:boolean)=>Promise<void>)|null>(null);
 const [stale,setStale]=useState(''),[shareNote,setShareNote]=useState(''),[installHelp,setInstallHelp]=useState(false);
 const searchRef=useRef<HTMLInputElement>(null),request=useRef<AbortController|null>(null),version=useRef(0),previous=useRef<Flight|null>(null),active=useRef<{number:string;date:string}|null>(null);
 const flight=data?.flights[selected];
useEffect(()=>{if(!CLERK_KEY||!userId){setMe({isAdmin:false,unread:null});return}let live=true;apiFetch('/api/me').then(r=>r.ok?r.json():null).then(j=>{if(live&&j)setMe({isAdmin:!!j.isAdmin,unread:j.unread??null})}).catch(()=>{});return()=>{live=false}},[userId]);
 useEffect(()=>{if(!smoothScrollAllowed())return;const l=new Lenis({autoRaf:true,lerp:.12,allowNestedScroll:true});lenis=l;return()=>{l.destroy();if(lenis===l)lenis=null}},[]);
 useEffect(()=>{const f=()=>{track('pwa_install');ga('pwa_install')};window.addEventListener('appinstalled',f);return()=>window.removeEventListener('appinstalled',f)},[]);
 useEffect(()=>{updateRef.current=registerSW({onNeedRefresh:()=>setNeedRefresh(true),onRegisteredSW:(_url,r)=>{if(r)setInterval(()=>{r.update().catch(()=>{})},3600000)}});},[]);
 useEffect(()=>{fetch('/api/config').then(r=>r.json()).then(d=>setLive(!!d.liveAvailable)).catch(()=>{});const a=()=>setOnline(true),b=()=>setOnline(false),i=(e:Event)=>{e.preventDefault();setInstall(e)};window.addEventListener('online',a);window.addEventListener('offline',b);window.addEventListener('beforeinstallprompt',i);const timer=setInterval(()=>setNow(new Date()),1000);return()=>{clearInterval(timer);request.current?.abort();window.removeEventListener('online',a);window.removeEventListener('offline',b);window.removeEventListener('beforeinstallprompt',i)}},[]);
 async function load(n=number,d=date,refresh=false){
  request.current?.abort();const controller=new AbortController();request.current=controller;const id=++version.current;setBusy(true);setError('');setStale('');if(!refresh){setData(null);setChanges([]);previous.current=null;active.current=null;setAuto(false)}
  try{const r=await apiFetch(`/api/flights?number=${encodeURIComponent(n)}&date=${d}&mode=live`,{signal:controller.signal});const result=await r.json();if(!r.ok)throw Error(result.error||'Flightdeck could not get this flight. Please try again.');if(version.current!==id)return;
   const p=previous.current;const next:Flight|undefined=p?result.flights.find((f:Flight)=>f.id===p.id):result.flights[0];if(refresh&&p&&next){const updates:string[]=[];for(const [key,label] of [['status','Status'],['gateOut','Departure gate'],['gateIn','Arrival gate'],['baggage','Baggage belt'],['estimatedIn','Estimated arrival']] as const){if(p[key]!==next[key])updates.push(`${label} updated at ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`)}if(updates.length)setChanges(old=>[...updates,...old].slice(0,8))}
   ga('flight_search',{result:result.flights.length?'ok':'fail'});setData(result);rememberResult(n+'|'+d,result);try{if(!refresh||location.hash.startsWith('#/flight/'))history.replaceState(null,'',`#/flight/${n}/${d}`)}catch{/* old browsers: no link, still works */}setSelected(Math.max(0,next?result.flights.findIndex((f:Flight)=>f.id===next.id):0));previous.current=next||null;active.current={number:n,date:d};
  }catch(e){if((e as Error).name!=='AbortError'&&version.current===id){const kept=recallResult(n+'|'+d);if(kept&&(!navigator.onLine||(e as Error).name==='TypeError')){setData(kept.data);setStale(`You're offline. This is what Flightdeck last fetched at ${new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short',timeZone:localZone()}).format(new Date(kept.at))}, so it may be out of date.`)}else setError(readableError(e))}}finally{if(version.current===id)setBusy(false)}
 }
 useEffect(()=>{if(!auto||!online)return;const timer=setInterval(()=>{const a=active.current;if(a)void load(a.number,a.date,true)},60000);return()=>clearInterval(timer)},[auto,online]);
 function save(){if(!active.current)return;ga('flight_saved');const a=active.current;const items=[a,...saved.filter(s=>s.number!==a.number||s.date!==a.date)].slice(0,6);setSaved(items);try{localStorage.setItem('flightdeck-saved',JSON.stringify(items))}catch{setError('Your browser could not save this flight.')}}
 const refresh=()=>{const a=active.current;if(a)void load(a.number,a.date,true)};
 useEffect(()=>{const m=location.hash.match(FLIGHT_LINK);if(m){setNumber(m[1]);setDate(m[2]);void load(m[1],m[2])}},[]);
 async function share(){const a=active.current;if(!a)return;const url=`${location.origin}/app/#/flight/${a.number}/${a.date}`;
  try{if(navigator.share){await navigator.share({title:`${a.number} on Flightdeck`,url});return}await navigator.clipboard.writeText(url);setShareNote('Link copied');setTimeout(()=>setShareNote(''),3000)}
  catch(e){if((e as Error).name!=='AbortError'){setShareNote('Copy this link: '+url)}}}
 // One list drives both menus: the sidebar (full labels, icon-only between 701 and 1000px) and the phone row (short labels).
 const navItems:{id:string;icon:typeof Plane;label:string;short:string;count:number|null}[]=[{id:'overview',icon:Navigation,label:'Flight tracker',short:'Tracker',count:null},{id:'saved',icon:Bookmark,label:'Saved flights',short:'Saved',count:saved.length},{id:'checklist',icon:ListChecks,label:'Packing list',short:'Packing list',count:null},...(me.isAdmin?[{id:'admin',icon:ShieldCheck,label:'Owner console',short:'Console',count:me.unread||null}]:[])];
 const navName=(n:typeof navItems[number])=>n.count==null?n.label:n.id==='admin'?`${n.label} (${n.count} unread)`:`${n.label} (${n.count})`;
 const skipToMain=(e:React.MouseEvent)=>{e.preventDefault();const m=document.getElementById('main');m?.focus();m?.scrollIntoView?.()};
 return <div className="app"><a className="skip-link" href="#main" onClick={skipToMain}>Skip to content</a>{CLERK_KEY&&<TokenBridge/>}{CLERK_KEY&&<SavedSync saved={saved} setSaved={items=>{setSaved(items);try{localStorage.setItem('flightdeck-saved',JSON.stringify(items))}catch{}}} setSignedIn={setSignedIn} setUserId={setUserId}/>}<aside className="sidebar"><a className="brand" href="#" aria-label="Flightdeck home"><span className="brand-mark"><Plane size={23}/></span>flightdeck<span className="brand-dot">.</span></a><div className="nav-label">Your travel space</div><nav className="side-nav" aria-label="Main">{navItems.map(n=><button key={n.id} className={'nav nav-'+n.id+(tab===n.id?' active':'')} aria-current={tab===n.id?'page':undefined} aria-label={navName(n)} title={navName(n)} onClick={()=>{setTab(n.id);if(n.id==='overview')searchRef.current?.focus()}}><n.icon size={18} aria-hidden="true"/><span className="nav-text">{n.label}</span>{n.count!=null&&<span className="count">{n.count}</span>}{n.id==='overview'&&<ChevronRight size={15} className="nav-chev" aria-hidden="true"/>}</button>)}</nav><div className="side-bottom"><div className="little-plane"><Plane size={26}/></div><h3>Track it, then pack for it.</h3><p>Check your flight and the weather, then tick off your packing list.</p><button className="btn btn-secondary install" onClick={async()=>{if(install){await install.prompt();setInstall(null)}else{setInstallHelp(true)}}}><Download size={15}/>Install app</button><div className="connection"><span className={online?'dot':'dot offline'}/>{online?'Connected':'Offline · updates paused'}</div></div></aside>
 <main id="main" tabIndex={-1}><header className="topbar"><span className="topbar-location"><span className="topbar-home">Workspace</span><ChevronRight size={14}/>{({overview:'Flight tracker',saved:'Saved flights',checklist:'Packing list',admin:'Owner console'} as Record<string,string>)[tab]}</span><div><Feedback/>{CLERK_KEY?<AuthBar/>:<span className="avatar">FD</span>}</div></header><nav className="mobile-nav" aria-label="Main">{navItems.map(n=><button key={n.id} className={tab===n.id?'on':undefined} aria-current={tab===n.id?'page':undefined} onClick={()=>setTab(n.id)}><n.icon size={15} aria-hidden="true"/>{n.short}{n.count!=null&&<> <span className="count">{n.count}</span></>}</button>)}</nav>
 {(tab==='overview'||tab==='saved')&&<>{tab==='overview'&&data&&<h1 className="sr-only">Flight tracker</h1>}{(tab==='saved'||!data)&&<section className="heading"><div><p className="workspace-eyebrow">{tab==='saved'?'SAVED FLIGHTS':'FLIGHT TRACKER'}</p><h1>{tab==='saved'?'Your saved flights':'Which flight?'}</h1><p>{tab==='saved'?'Flights you saved, each with its own packing list.':'Enter a flight number and the departure date.'}</p></div><span className="date-badge"><CalendarDays size={16}/>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}).format(now)}</span></section>}
 <form className="search-card" onSubmit={e=>{e.preventDefault();setTab('overview');void load()}}><label><span>Flight number</span><div><Plane size={18}/><input ref={searchRef} aria-label="Flight number" value={number} onChange={e=>setNumber(e.target.value.toUpperCase())} placeholder="e.g. BA117" required maxLength={12}/></div></label><label><span>Departure date</span><div><CalendarDays size={18}/><input aria-label="Departure date" type="date" value={date} required onChange={e=>setDate(e.target.value)}/></div></label><button className="btn btn-primary search-button" disabled={busy}><Search size={17}/>{busy?'Searching…':'Track flight'}<ArrowRight size={17}/></button></form></>}
 <Announcements/>{needRefresh&&<div role="status" className="notice"><RefreshCw size={17}/><span><strong>A new version is ready.</strong> Reload to update.</span><button className="text-button" onClick={()=>void updateRef.current?.(true)}>Reload</button></div>}
 {!online&&<div className="notice error"><AlertCircle size={17}/>You're offline. What you've already loaded may be out of date. Updates restart when you're back online.</div>}
 {stale&&<div role="status" className="notice"><AlertCircle size={17}/><span>{stale}</span></div>}
 {error&&<div role="alert" className="notice error"><AlertCircle size={18}/>{error}<button onClick={refresh}>Try again</button></div>}
 {tab==='admin'?(me.isAdmin?<Suspense fallback={<div role="status" className="panel empty">Loading the owner console…</div>}><AdminView onUnread={(n:number)=>setMe(m=>({...m,unread:n}))}/></Suspense>:<div className="panel empty"><ShieldCheck size={30}/><h2>This area is for the site owner</h2><p>You are signed in, but this account does not have owner access.</p></div>):tab==='checklist'?<Suspense fallback={<div role="status" className="panel empty">Loading your packing list…</div>}><ChecklistView saved={saved} signedIn={signedIn} userId={userId} request={packFor} onRequestDone={()=>setPackFor(null)} onTrack={(n:string,d:string)=>{setNumber(n);setDate(d);setTab('overview');void load(n,d)}}/></Suspense>:tab==='saved'?<SavedFlights items={saved} signedIn={signedIn} onOpen={s=>{setNumber(s.number);setDate(s.date);setTab('overview');void load(s.number,s.date)}} onPack={s=>{setPackFor(s);setTab('checklist')}} onRemove={index=>{const items=saved.filter((_,j)=>j!==index);setSaved(items);try{localStorage.setItem('flightdeck-saved',JSON.stringify(items))}catch{setError('Your browser could not update saved flights.')}}}/>:<>
 {data?.notes?.length?<div role="status" className="notice"><Info size={17}/><span>{data.notes.join(' ')}</span></div>:null}
 {!live&&<div className="notice error"><AlertCircle size={17}/>Live flight data is not configured on this server yet.</div>}
 {busy&&!data&&<div role="status" className="panel empty">Looking up your flight…</div>}
 {!busy&&!data&&!error&&<div className="panel empty tracker-welcome"><span className="welcome-icon"><Plane size={30}/></span><p className="workspace-eyebrow">NOTHING LOOKED UP YET</p><h2>Enter a flight number above.</h2><p>You get the status, the airport details and the destination weather, each as soon as its source reports it.</p><div className="welcome-details"><span><Navigation size={16}/>Flight status</span><span><CalendarDays size={16}/>Airport local times</span><span><ListChecks size={16}/>Packing list</span></div><a className="text-button" href="/coverage/">About the data <ArrowUpRight size={14}/></a></div>}
 {data&&!data.flights.length&&<div className="panel empty"><Search size={30}/><h2>No flights found</h2><p>Nothing matched that flight number and date. Check the number, or try the airline's three-letter callsign, such as BAW117. Schedules cover yesterday to three days ahead, and a live position shows only while the aircraft is transmitting.</p></div>}
 {data&&data.flights.length>1&&<label className="flight-picker">Choose a leg <select onChange={e=>{const i=Number(e.target.value);setSelected(i);previous.current=data.flights[i]}} value={selected}>{data.flights.map((f,i)=><option value={i} key={f.id}>{f.number} · {f.origin.code} → {f.destination.code} · {time(f.scheduledOut,f.origin.timezone)}</option>)}</select></label>}
 {flight&&data&&<FlightView flight={flight} data={data} now={now} busy={busy} auto={auto} setAuto={setAuto} changes={changes} onRefresh={refresh} onSave={save} onShare={()=>void share()} shareNote={shareNote}/>}
 </>}
 {installHelp&&<InstallHelp onClose={()=>setInstallHelp(false)}/>}
 <div className="sf-gap"/>
 <SiteFooter inApp/></main></div>
}
const app=CLERK_KEY?<Gate/>:<Dashboard/>;createRoot(document.getElementById('root')!).render(<AppBoundary><React.StrictMode>{CLERK_KEY?<ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/" appearance={{variables:{colorPrimary:'#214e3e',borderRadius:'8px',fontFamily:'DM Sans, sans-serif'}}}>{app}</ClerkProvider>:app}</React.StrictMode></AppBoundary>);
