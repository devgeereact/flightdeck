import {useCallback,useEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {DrawSVGPlugin} from 'gsap/DrawSVGPlugin';
import {Activity,AlertTriangle,BarChart3,BookOpen,FileText,Gauge,HeartPulse,History,Inbox as InboxIcon,LineChart,ListTree,Megaphone,MessageCircleQuestion,RefreshCw,Server,Settings,Users} from 'lucide-react';
import {call,nf} from './api';
import {withMotion,fromAny} from '../shared/motion';
import {Analytics,Costs,Overview,SystemView,Usage,UsersView} from './Ops';
import Inbox from './Inbox';
import HealthView from './HealthView';
import AuditView from './AuditView';
import ContentSection,{type Section as ContentSectionId} from './content/ContentSection';
import '../styles/console.css';
gsap.registerPlugin(useGSAP,DrawSVGPlugin);

type Id=ContentSectionId|'inbox'|'overview'|'usage'|'costs'|'health'|'users'|'analytics'|'system'|'audit';
const GROUPS:{title:string;items:{id:Id;label:string;icon:typeof Activity}[]}[]=[
 {title:'Content',items:[{id:'pages',label:'Pages',icon:FileText},{id:'guides',label:'Guides',icon:BookOpen},{id:'faqs',label:'Help and FAQ',icon:MessageCircleQuestion},{id:'announcements',label:'Announcements',icon:Megaphone},{id:'navigation',label:'Menus',icon:ListTree}]},
 {title:'Inbox',items:[{id:'inbox',label:'Enquiries',icon:InboxIcon}]},
 {title:'Operations',items:[{id:'overview',label:'Overview',icon:Activity},{id:'usage',label:'Usage',icon:BarChart3},{id:'costs',label:'Costs and limits',icon:Gauge},{id:'health',label:'Provider health',icon:HeartPulse}]},
 {title:'People',items:[{id:'users',label:'Users',icon:Users},{id:'analytics',label:'Google Analytics',icon:LineChart}]},
 {title:'Settings',items:[{id:'settings',label:'Site settings',icon:Settings},{id:'system',label:'System',icon:Server},{id:'audit',label:'Audit log',icon:History}]},
];
const ALL=GROUPS.flatMap(g=>g.items);
const CONTENT:Id[]=['pages','guides','faqs','announcements','navigation','settings'];
const TITLES:Partial<Record<Id,[string,string]>>={overview:['How Flightdeck is doing','Searches, users and enquiries.'],usage:['Usage','What people look up and use.'],costs:['Costs and limits','Provider allowances and how much is used.'],health:['Provider health','When each data source last answered, and the cache.'],users:['Users','Accounts, from Clerk.'],analytics:['Google Analytics','Only visitors who accepted analytics.'],system:['System','What is switched on.'],audit:['Audit log','Every change made in the console.'],inbox:['Enquiries and feedback','Messages from the contact form and the Feedback button.']};

/** #/admin/<section>/<id> -> [section, id]. */
const parse=():[Id,string|null]=>{const p=location.hash.replace(/^#\/?admin\/?/,'').split('/');const s=p[0] as Id;return [ALL.some(x=>x.id===s)?s:'overview',p[1]?decodeURIComponent(p.slice(1).join('/')):null]};

/** The owner console. Every request is checked on the server (verified sign-in plus the owner's user id); this screen only shows it. */
export default function ConsoleShell({onUnread}:{onUnread:(n:number)=>void}){
 const [[section,openId],setRoute]=useState<[Id,string|null]>(parse);
 const [days,setDays]=useState(30),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[unread,setUnread]=useState<number|null>(null);
 const [ov,setOv]=useState<any>(null),[users,setUsers]=useState<any>(null),[sys,setSys]=useState<any>(null),[ga,setGa]=useState<any>(null);
 useEffect(()=>{const f=()=>setRoute(parse());window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);
 const go=(s:Id,id:string|null=null)=>{const h=`#/admin/${s}${id?'/'+encodeURIComponent(id):''}`;if(location.hash!==h)location.hash=h;else setRoute([s,id])};
 const noteUnread=useCallback((n:number)=>{setUnread(n);onUnread(n)},[onUnread]);
 const load=useCallback(async()=>{
  if(CONTENT.includes(section)||['inbox','health','audit'].includes(section))return;
  setBusy(true);setErr('');
  try{
   if(section==='overview'||section==='usage'||section==='costs'){const d=await call(`/api/admin/overview?days=${days}`);setOv(d);noteUnread(d.unread)}
   else if(section==='users')setUsers(await call('/api/admin/users'));
   else if(section==='system')setSys(await call('/api/admin/system'));
   else if(section==='analytics')setGa(await call('/api/admin/analytics'));
  }catch(e){setErr((e as Error).message)}finally{setBusy(false)}
 },[section,days,noteUnread]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(unread===null)call('/api/admin/overview?days=1').then(d=>noteUnread(d.unread)).catch(()=>{})},[unread,noteUnread]);
 const root=useRef<HTMLElement>(null);
 // Motion on the operations screens only: cards rise in, numbers count up, bars grow. Skipped for people who prefer reduced motion.
 useGSAP(()=>{
  if(CONTENT.includes(section))return;
  const q=gsap.utils.selector(root);
  withMotion(()=>{
   const tl=gsap.timeline({defaults:{ease:'power3.out'}});
   fromAny(tl,q('.ad-kpi'),{autoAlpha:0,y:18,duration:.55,stagger:.07});
   fromAny(tl,q('.cn-main .panel, .ad-enq > li'),{autoAlpha:0,y:22,duration:.6,stagger:.08},'<.1');
   q('.ad-kpi strong').forEach((el:Element)=>{const txt=(el.textContent||'').trim();if(!/^[\d,]+$/.test(txt))return;const target=Number(txt.replace(/,/g,'')),o={v:0};if(!target)return;gsap.to(o,{v:target,duration:1.1,ease:'power2.out',delay:.35,onUpdate:()=>{el.textContent=nf.format(Math.round(o.v))},onComplete:()=>{el.textContent=nf.format(target)}})});
   q('.ad-svg-wrap path').forEach((el:Element,i:number)=>gsap.from(el,{scaleY:0,transformOrigin:'50% 100%',transformBox:'fill-box',duration:.7,ease:'power3.out',delay:.35+Math.min(i,40)*.012}));
   q('.ad-svg-wrap polyline').forEach((el:Element)=>gsap.from(el,{drawSVG:'0%',duration:1.1,ease:'power2.inOut',delay:.35}));
   q('.ad-rank-bar i').forEach((el:Element,i:number)=>gsap.from(el,{scaleX:0,transformOrigin:'0 50%',duration:.7,ease:'power3.out',delay:.4+i*.05}));
   q('.ad-meter i').forEach((el:Element)=>gsap.from(el,{scaleX:0,transformOrigin:'0 50%',duration:.9,ease:'power3.out',delay:.4}));
  });
 },{scope:root,dependencies:[section,days,!!ov,!!users,!!sys,!!ga],revertOnUpdate:true});
 const cur=ALL.find(x=>x.id===section)!;
 const [h1,lede]=TITLES[section]??[cur.label,''];
 const loading=<p className="ad-loading" role="status">Loading…</p>;
 return <section className="ad cn" aria-label="Owner console" ref={root}>
  <div className="ad-head heading"><div><span className="eyebrow">Owner console</span><h1>{h1}</h1>{lede&&<p>{lede}</p>}</div>
   {!CONTENT.includes(section)&&!['inbox','health','audit'].includes(section)&&<div className="ad-tools">{(section==='overview'||section==='usage'||section==='costs')&&<div className="ad-range" role="group" aria-label="Time range">{[7,30,90].map(d=><button key={d} className={days===d?'on':''} aria-pressed={days===d} onClick={()=>setDays(d)}>{d} days</button>)}</div>}
   <button className="icon-button" onClick={()=>void load()} aria-label="Refresh" title="Refresh" disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/></button></div>}
  </div>
  <div className="cn-layout">
   <nav className="cn-nav" aria-label="Owner console sections">{GROUPS.map(g=><div key={g.title} className="cn-group"><h2>{g.title}</h2><ul>{g.items.map(x=><li key={x.id}><a href={`#/admin/${x.id}`} aria-current={section===x.id?'page':undefined} onClick={e=>{e.preventDefault();go(x.id)}}><x.icon size={15} aria-hidden="true"/><span>{x.label}</span>{x.id==='inbox'&&!!unread&&<span className="count" aria-label={`${unread} unread`}>{unread}</span>}</a></li>)}</ul></div>)}</nav>
   <div className="cn-main" id="cn-main">
    {err&&<div role="alert" className="notice error"><AlertTriangle size={16}/>{err}</div>}
    {CONTENT.includes(section)&&<ContentSection key={section} section={section as ContentSectionId} openId={openId} navigate={id=>go(section,id)}/>}
    {section==='inbox'&&<Inbox onUnread={noteUnread}/>}
    {section==='health'&&<HealthView/>}
    {section==='audit'&&<AuditView/>}
    {section==='overview'&&(ov?<Overview ov={ov}/>:loading)}
    {section==='usage'&&(ov?<Usage ov={ov}/>:loading)}
    {section==='costs'&&(ov?<Costs ov={ov}/>:loading)}
    {section==='users'&&(users?<UsersView users={users}/>:loading)}
    {section==='analytics'&&(ga?<Analytics ga={ga}/>:loading)}
    {section==='system'&&(sys?<SystemView sys={sys}/>:loading)}
   </div>
  </div>
 </section>
}
