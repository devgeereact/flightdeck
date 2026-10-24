import {useCallback,useEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {DrawSVGPlugin} from 'gsap/DrawSVGPlugin';
import {Activity,Users,Inbox,Gauge,Server,BarChart3,RefreshCw,Mail,Reply,Send,Table2,AlertTriangle,CheckCircle2,CircleSlash,ExternalLink,LineChart} from 'lucide-react';
import {apiFetch} from './api';
import {withMotion} from './motion';
gsap.registerPlugin(useGSAP,DrawSVGPlugin);

type Tab='overview'|'usage'|'costs'|'users'|'enquiries'|'analytics'|'system';
const TABS:{id:Tab;label:string;icon:any}[]=[{id:'overview',label:'Overview',icon:Activity},{id:'usage',label:'Usage',icon:BarChart3},{id:'costs',label:'Costs & limits',icon:Gauge},{id:'users',label:'Users',icon:Users},{id:'enquiries',label:'Enquiries',icon:Inbox},{id:'analytics',label:'Google Analytics',icon:LineChart},{id:'system',label:'System',icon:Server}];
async function get<T=any>(path:string):Promise<T>{const r=await apiFetch(path);const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`Request failed (${r.status})`);return j}
const nf=new Intl.NumberFormat('en-GB');
const when=(ms:number|null|undefined)=>ms?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(ms)):'Never';
const shortDay=(d:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const pct=(v:number|null|undefined)=>v==null?'—':`${v}%`;

function Kpi({label,value,sub,warn}:{label:string;value:string|number;sub?:string;warn?:boolean}){return <div className={warn?'ad-kpi warn':'ad-kpi'}><span>{label}</span><strong>{typeof value==='number'?nf.format(value):value}</strong>{sub&&<small>{sub}</small>}</div>}

// One series, one hue. Thin rounded marks anchored to the baseline, a 2px gap, recessive axes, hover values, and a table view for screen readers.
function Chart({title,values,dates,kind='bars',unit='',wide=false}:{title:string;values:number[];dates:string[];kind?:'bars'|'line';unit?:string;wide?:boolean}){
 const [hover,setHover]=useState<number|null>(null),[table,setTable]=useState(false);
 const W=640,H=150,L=34,R=8,T=10,B=22,n=values.length,max=Math.max(1,...values),iw=W-L-R,ih=H-T-B;
 const total=values.reduce((a,b)=>a+b,0),peakI=values.indexOf(Math.max(...values,0));
 const x=(i:number)=>L+(n<=1?iw/2:i*(iw/(n-1))),slot=iw/Math.max(1,n),bw=Math.max(2,Math.min(26,slot-2));
 const y=(v:number)=>T+ih-(v/max)*ih;
 const bar=(i:number,v:number)=>{const bx=L+i*slot+(slot-bw)/2,by=y(v),h=T+ih-by,r=Math.min(3,bw/2,h);return v>0?`M${bx},${T+ih}V${by+r}Q${bx},${by} ${bx+r},${by}H${bx+bw-r}Q${bx+bw},${by} ${bx+bw},${by+r}V${T+ih}Z`:''};
 return <section className={wide?'panel ad-chart wide':'panel ad-chart'}>
  <div className="ad-chart-head"><div><h2>{title}</h2><p>{nf.format(total)}{unit} in {n} days{total>0&&values[peakI]>0?` · busiest ${shortDay(dates[peakI])} (${nf.format(values[peakI])})`:''}</p></div><button className="text-button" onClick={()=>setTable(t=>!t)} aria-pressed={table}><Table2 size={13}/>{table?'Show chart':'Show as table'}</button></div>
  {table?<div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Date</th><th>{title}</th></tr></thead><tbody>{dates.map((d,i)=><tr key={d}><td>{shortDay(d)}</td><td>{nf.format(values[i])}</td></tr>)}</tbody></table></div>
  :<div className="ad-svg-wrap"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${nf.format(total)} in ${n} days`} onMouseLeave={()=>setHover(null)}>
   <line x1={L} x2={W-R} y1={T+ih} y2={T+ih} stroke="#dbe3d6"/><line x1={L} x2={W-R} y1={T} y2={T} stroke="#eef2ea"/>
   <text x={L-6} y={T+4} textAnchor="end" className="ad-ax">{nf.format(max)}</text><text x={L-6} y={T+ih+4} textAnchor="end" className="ad-ax">0</text>
   {[0,Math.floor((n-1)/2),n-1].filter((v,i,a)=>n>0&&a.indexOf(v)===i).map(i=><text key={i} x={kind==='bars'?L+i*slot+slot/2:x(i)} y={H-5} textAnchor={i===0?'start':i===n-1?'end':'middle'} className="ad-ax">{shortDay(dates[i])}</text>)}
   {kind==='bars'?values.map((v,i)=><path key={i} d={bar(i,v)} fill="#214e3e" opacity={hover===null||hover===i?1:.45}/>)
    :<><polyline fill="none" stroke="#214e3e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}/>{hover!==null&&<circle cx={x(hover)} cy={y(values[hover])} r="4.5" fill="#214e3e" stroke="#fff" strokeWidth="2"/>}</>}
   {values.map((_,i)=><rect key={i} x={kind==='bars'?L+i*slot:x(i)-slot/2} y={T} width={slot} height={ih+B} fill="transparent" onMouseEnter={()=>setHover(i)} onFocus={()=>setHover(i)} tabIndex={-1}/>)}
  </svg>{hover!==null&&<div className="ad-tip" style={{left:`${(kind==='bars'?(L+hover*slot+slot/2):x(hover))/W*100}%`}}><b>{nf.format(values[hover])}</b><span>{shortDay(dates[hover])}</span></div>}</div>}
 </section>
}

function Rank({title,items,empty}:{title:string;items:{key:string;count:number}[];empty:string}){
 const max=Math.max(1,...items.map(i=>i.count));
 return <section className="panel ad-rank"><h3>{title}</h3>{items.length===0?<p className="ad-empty">{empty}</p>:<ul>{items.map(i=><li key={i.key}><span className="ad-rank-k">{i.key}</span><span className="ad-rank-bar"><i style={{width:`${i.count/max*100}%`}}/></span><span className="ad-rank-n">{nf.format(i.count)}</span></li>)}</ul>}</section>
}

function Setup({title,children}:{title:string;children:React.ReactNode}){return <section className="panel ad-setup"><AlertTriangle size={20}/><div><h3>{title}</h3>{children}</div></section>}

export default function Admin({onUnread}:{onUnread:(n:number)=>void}){
 const [tab,setTab]=useState<Tab>('overview'),[days,setDays]=useState(30),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const [replyFor,setReplyFor]=useState<string|null>(null),[replyText,setReplyText]=useState(''),[sending,setSending]=useState(false),[sentNote,setSentNote]=useState('');
 const [ov,setOv]=useState<any>(null),[users,setUsers]=useState<any>(null),[enq,setEnq]=useState<any>(null),[sys,setSys]=useState<any>(null),[ga,setGa]=useState<any>(null);
 const load=useCallback(async()=>{
  setBusy(true);setErr('');
  try{
   if(tab==='overview'||tab==='usage'||tab==='costs'){const d=await get(`/api/admin/overview?days=${days}`);setOv(d);onUnread(d.unread)}
   else if(tab==='users')setUsers(await get('/api/admin/users'));
   else if(tab==='enquiries'){const d=await get('/api/admin/enquiries');setEnq(d);onUnread(d.unread)}
   else if(tab==='system')setSys(await get('/api/admin/system'));
   else if(tab==='analytics')setGa(await get('/api/admin/analytics'));
  }catch(e){setErr((e as Error).message)}finally{setBusy(false)}
 },[tab,days]);
 useEffect(()=>{void load()},[load]);
 async function setStatus(id:string,status:string){
  try{const r=await apiFetch(`/api/admin/enquiries/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const j=await r.json();if(!r.ok)throw Error(j.error);setEnq((e:any)=>({...e,items:e.items.map((x:any)=>x.id===id?{...x,status}:x),unread:j.unread}));onUnread(j.unread)}
  catch(e){setErr((e as Error).message)}
 }
 async function sendReply(id:string){
  setSending(true);setErr('');setSentNote('');
  try{const r=await apiFetch(`/api/admin/enquiries/${id}/reply`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:replyText})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'The reply could not be sent.');
   setEnq((e:any)=>({...e,items:e.items.map((x:any)=>x.id===id?{...x,status:'replied',replies:[...(x.replies||[]),{at:Date.now(),text:replyText}]}:x),unread:j.unread}));onUnread(j.unread);setReplyFor(null);setReplyText('');setSentNote('Reply sent.')}
  catch(e){setErr((e as Error).message)}finally{setSending(false)}
 }
 const t=ov?.overview?.totals,s=ov?.overview?.series,dates=ov?.overview?.dates??[];
 const al=ov?.allowance;
 const root=useRef<HTMLElement>(null);
 // Motion: cards rise in, numbers count up, bars grow from the baseline and lines draw themselves. Skipped when the visitor prefers reduced motion.
 useGSAP(()=>{
  const q=gsap.utils.selector(root);
  withMotion(()=>{
   const tl=gsap.timeline({defaults:{ease:'power3.out'}});
   tl.from(q('.ad-head > *'),{autoAlpha:0,y:14,duration:.5,stagger:.08})
    .from(q('.ad-tabs button'),{autoAlpha:0,y:10,duration:.4,stagger:.04},'<.15')
    .from(q('.ad-kpi'),{autoAlpha:0,y:18,duration:.55,stagger:.07},'<.1')
    .from(q('.ad-body .panel, .ad-enq > li'),{autoAlpha:0,y:22,duration:.6,stagger:.08},'<.1');
   q('.ad-kpi strong').forEach((el:Element)=>{
    const txt=(el.textContent||'').trim();
    if(!/^[\d,]+$/.test(txt))return;
    const target=Number(txt.replace(/,/g,'')),o={v:0};
    if(!target)return;
    gsap.to(o,{v:target,duration:1.1,ease:'power2.out',delay:.35,onUpdate:()=>{el.textContent=nf.format(Math.round(o.v))},onComplete:()=>{el.textContent=nf.format(target)}});
   });
   q('.ad-svg-wrap path').forEach((el:Element,i:number)=>gsap.from(el,{scaleY:0,transformOrigin:'50% 100%',transformBox:'fill-box',duration:.7,ease:'power3.out',delay:.35+Math.min(i,40)*.012}));
   q('.ad-svg-wrap polyline').forEach((el:Element)=>gsap.from(el,{drawSVG:'0%',duration:1.1,ease:'power2.inOut',delay:.35}));
   q('.ad-rank-bar i').forEach((el:Element,i:number)=>gsap.from(el,{scaleX:0,transformOrigin:'0 50%',duration:.7,ease:'power3.out',delay:.4+i*.05}));
   q('.ad-meter i').forEach((el:Element)=>gsap.from(el,{scaleX:0,transformOrigin:'0 50%',duration:.9,ease:'power3.out',delay:.4}));
  });
 },{scope:root,dependencies:[tab,days,!!ov,!!users,!!enq,!!sys,!!ga],revertOnUpdate:true});
 return <section className="ad" aria-label="Owner console" ref={root}>
  <div className="ad-head heading"><div><span className="eyebrow">OWNER CONSOLE</span><h1>How Flightdeck is doing</h1><p>Usage, costs, users, enquiries and analytics in one place.</p></div>
   <div className="ad-tools">{(tab==='overview'||tab==='usage'||tab==='costs')&&<div className="ad-range" role="group" aria-label="Time range">{[7,30,90].map(d=><button key={d} className={days===d?'on':''} aria-pressed={days===d} onClick={()=>setDays(d)}>{d} days</button>)}</div>}
   <button className="icon-button" onClick={()=>void load()} aria-label="Refresh" disabled={busy}><RefreshCw size={15} className={busy?'spin':''}/></button></div></div>
  <div className="ad-tabs" role="tablist">{TABS.map(x=><button key={x.id} role="tab" aria-selected={tab===x.id} className={tab===x.id?'on':''} onClick={()=>setTab(x.id)}><x.icon size={14}/>{x.label}{x.id==='enquiries'&&enq?.unread>0&&<span className="count">{enq.unread}</span>}</button>)}</div>
  {err&&<div role="alert" className="notice error"><AlertTriangle size={16}/>{err}</div>}
  <div className="ad-body" key={tab}>

  {tab==='overview'&&(!ov?<p className="ad-loading">Loading…</p>:<>
   <div className="ad-kpis">
    <Kpi label="SEARCHES" value={t.searches} sub={`${t.found+t.usualRoute} answered · ${t.notFound} not found`}/>
    <Kpi label="SUCCESS RATE" value={pct(t.successRate)} sub={t.errors?`${t.errors} provider errors`:'no provider errors'} warn={t.errors>0}/>
    <Kpi label="ACTIVE USER-DAYS" value={t.activeUserDays} sub={`peak ${t.peakUsers} a day · ${t.searchesPerActiveUserDay??'—'} searches each`}/>
    <Kpi label="PACKING LISTS STARTED" value={t.checklistsCreated} sub={`${t.checklistsCompleted} fully packed`}/>
    <Kpi label="NEW ENQUIRIES" value={t.enquiries} sub={ov.unread?`${ov.unread} unread`:'none unread'} warn={ov.unread>0}/>
    <Kpi label="APP INSTALLS" value={t.pwaInstalls} sub={`${t.landingViews} landing views · ${t.ctaClicks} sign-up clicks`}/>
   </div>
   <Chart title="Searches" values={s.searches} dates={dates}/>
   <Chart title="Signed-in users" values={s.users} dates={dates} kind="line"/>
  </>)}

  {tab==='usage'&&(!ov?<p className="ad-loading">Loading…</p>:<>
   <div className="ad-grid2"><Rank title="Top airlines searched" items={ov.overview.top.airlines} empty="No searches yet."/><Rank title="Top routes" items={ov.overview.top.routes} empty="No routes yet."/></div>
   <div className="ad-grid2"><Rank title="Outbound or inbound" items={ov.overview.top.direction} empty="No data yet."/><Rank title="Flight numbers people could not find" items={ov.overview.top.notFoundNumbers} empty="Nothing missing. Every search found a flight."/></div>
   <div className="ad-kpis">
    <Kpi label="LANDING VIEWS" value={t.landingViews} sub={`${t.ctaClicks} clicked sign up`}/>
    <Kpi label="PACKING LISTS" value={t.checklistsCreated} sub={`${t.checklistsCompleted} completed · ${t.checklistSaves} saved to accounts`}/>
    <Kpi label="COOKIE CHOICES" value={pct(t.consentOptIn)} sub={`${t.consentAccept} accepted · ${t.consentReject} declined`}/>
    <Kpi label="FEEDBACK OPENED" value={t.feedbackOpened} sub={`${t.enquiries} messages sent`}/>
   </div>
   <Chart title="Landing page views" values={s.landingViews} dates={dates}/>
   <Chart title="Packing lists started" values={s.checklistsCreated} dates={dates}/>
  </>)}

  {tab==='costs'&&(!ov?<p className="ad-loading">Loading…</p>:<>
   <section className={al.runsOutBeforeMonthEnd?'panel ad-allow warn':'panel ad-allow'}>
    <div className="ad-allow-top"><div><h3>Flight schedule allowance ({al.month})</h3><p>{al.used} of {al.cap} units used · {al.left} left</p></div>{al.runsOutBeforeMonthEnd?<span className="pill warn"><AlertTriangle size={11}/>RUNS OUT EARLY</span>:<span className="pill ok"><CheckCircle2 size={11}/>ON TRACK</span>}</div>
    <div className="ad-meter" role="progressbar" aria-valuenow={al.used} aria-valuemin={0} aria-valuemax={al.cap} aria-label="Units used this month"><i style={{width:`${Math.min(100,al.cap?al.used/al.cap*100:0)}%`}}/></div>
    <p className="ad-allow-note">{al.perDay>0?`About ${al.perDay} units a day so far. ${al.daysUntilEmpty===null?'':al.runsOutBeforeMonthEnd?`At this pace the allowance runs out in about ${al.daysUntilEmpty} days, before the month ends. Searches fall back to live position and routes only.`:'At this pace it lasts to the end of the month.'}`:'No units used yet this month.'}</p>
   </section>
   <div className="ad-kpis">
    <Kpi label="CACHE HIT RATE" value={pct(t.adbCacheRatio)} sub={`${t.adbCacheHits} answered from memory · ${t.adbUnitsSaved} units saved`}/>
    <Kpi label="PAID LOOKUPS" value={t.adbCalls} sub={`${t.adbUnits} units · ${t.adbErrors} failed`} warn={t.adbErrors>0}/>
    <Kpi label="LIVE POSITION FETCHES" value={t.openskyFetches} sub={`${t.openskyCacheHits} cached · ${t.openskyErrors} failed`} warn={t.openskyErrors>0}/>
    <Kpi label="ROUTE LOOKUPS" value={t.routeLookups} sub={`${t.routeCacheHits} cached`}/>
    <Kpi label="BLOCKED BY LIMITS" value={t.rateLimited} sub="too many requests from one visitor"/>
    <Kpi label="REFUSED (NOT SIGNED IN)" value={t.authDenied} sub="requests without a valid sign-in"/>
   </div>
   <section className="panel"><h3>Average answer time</h3><ul className="ad-lat">{Object.keys(ov.overview.latencyMs).length===0?<li className="ad-empty">No provider calls yet.</li>:Object.entries(ov.overview.latencyMs).map(([k,v])=><li key={k}><span>{k}</span><strong>{v==null?'—':`${nf.format(v as number)} ms`}</strong></li>)}</ul></section>
   <Chart title="Paid units used" values={s.adbUnits} dates={dates} unit=" units" wide/>
   <p className="ad-note">AI usage is not switched on yet, so there is no AI cost to show.</p>
  </>)}

  {tab==='users'&&(!users?<p className="ad-loading">Loading…</p>:!users.configured?<Setup title="Show your user numbers here"><p>This needs your Clerk <b>secret</b> key stored on the server (never in the browser). Add it to the private server config as <code>clerk_secret_key</code>, or ask to have it set up for you. Until then, see your users in the <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer">Clerk dashboard <ExternalLink size={11}/></a>.</p></Setup>
   :users.error?<Setup title="Clerk did not answer"><p>{users.error}</p></Setup>:<>
   <div className="ad-kpis"><Kpi label="ACCOUNTS" value={users.total} sub="all time"/><Kpi label="NEW IN 7 DAYS" value={users.signups7} sub={`${users.signups30} in 30 days`}/><Kpi label="ACTIVE IN 7 DAYS" value={users.active7} sub={users.total?`${Math.round(users.active7/users.total*100)}% of accounts`:''}/><Kpi label="ACTIVE IN 30 DAYS" value={users.active30} sub={users.total?`${Math.round(users.active30/users.total*100)}% of accounts`:''}/></div>
   <section className="panel"><h3>Newest accounts</h3><div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Email</th><th>Joined</th><th>Last active</th></tr></thead><tbody>{users.newest.map((u:any)=><tr key={u.id}><td>{u.email||'—'}</td><td>{when(u.createdAt)}</td><td>{when(u.lastActiveAt)}</td></tr>)}</tbody></table></div><p className="ad-note">Refreshed every five minutes. Checked at {when(users.fetchedAt)}.</p></section></>)}

  {tab==='enquiries'&&(!enq?<p className="ad-loading">Loading…</p>:enq.items.length===0?<section className="panel ad-emptybox"><Inbox size={28}/><h3>No messages yet</h3><p>When someone uses the Feedback button or the contact form, it appears here and is emailed to you if an address is set up.</p></section>:
   <>{sentNote&&<div role="status" className="notice"><CheckCircle2 size={16}/>{sentNote}</div>}<ul className="ad-enq">{enq.items.map((m:any)=><li key={m.id} className={'panel '+(m.status==='new'?'new':'')}>
    <div className="ad-enq-top"><span className="pill">{m.kind.toUpperCase()}</span><strong>{m.name||'Anonymous'}</strong>{m.email&&<a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to Flightdeck')}`}><Mail size={12}/>{m.email}</a>}<time>{when(m.createdAt)}</time><span className={'pill st-'+m.status}>{m.status.toUpperCase()}</span></div>
    <p className="ad-enq-msg">{m.message}</p>
    {(m.replies||[]).map((r:any,i:number)=><div className="ad-reply" key={i}><span><Reply size={12}/>You replied · {when(r.at)}</span><p>{r.text}</p></div>)}
    {replyFor===m.id?<form className="ad-reply-form" onSubmit={e=>{e.preventDefault();void sendReply(m.id)}}>
     <label><span>Your reply to {m.name||m.email}</span><textarea autoFocus rows={5} maxLength={4000} value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Write your reply. It is emailed to the sender, and their answer comes back to your inbox."/></label>
     <div className="ad-enq-act"><button className="cta" type="submit" disabled={sending||replyText.trim().length<2}><Send size={14}/>{sending?'Sending…':'Send reply'}</button><button className="text-button" type="button" onClick={()=>{setReplyFor(null);setReplyText('')}}>Cancel</button><small>{replyText.length}/4000</small></div>
    </form>
    :<div className="ad-enq-act">{m.email?<button className="text-button primary" onClick={()=>{setReplyFor(m.id);setReplyText('');setSentNote('')}}><Reply size={13}/>Reply by email</button>:<small>No email address was given, so this cannot be replied to.</small>}{['new','read','replied','archived'].filter(x=>x!==m.status).map(x=><button key={x} className="text-button" onClick={()=>void setStatus(m.id,x)}>Mark {x}</button>)}{!m.emailed&&<small>Not emailed (no notification address was set)</small>}</div>}
   </li>)}</ul></>)}

  {tab==='analytics'&&(!ga?<p className="ad-loading">Loading…</p>:ga.configured&&ga.error?<Setup title="Google Analytics is connected but not answering"><p>{ga.error}</p></Setup>:ga.configured?<>
   <div className="ad-kpis"><Kpi label="VISITORS, 7 DAYS" value={ga.totals['7'].users} sub={`${ga.totals['7'].sessions} visits · ${ga.totals['7'].pageViews} page views`}/><Kpi label="VISITORS, 28 DAYS" value={ga.totals['28'].users} sub={`${ga.totals['28'].sessions} visits · ${ga.totals['28'].pageViews} page views`}/><Kpi label="PAGES PER VISIT" value={ga.totals['28'].sessions?(ga.totals['28'].pageViews/ga.totals['28'].sessions).toFixed(1):'—'} sub="last 28 days"/></div>
   <Chart title="Visitors per day (Google Analytics)" values={ga.series.map((d:any)=>d.users)} dates={ga.series.map((d:any)=>d.date)} wide/>
   <div className="ad-grid2"><Rank title="Top countries" items={ga.countries} empty="No data yet."/><Rank title="Devices" items={ga.devices} empty="No data yet."/></div>
   <Rank title="Where visits come from" items={ga.channels} empty="No data yet."/>
   <p className="ad-note">Only visitors who accepted analytics appear here, so these numbers are lower than real traffic. Checked at {when(ga.fetchedAt)}; refreshed every 15 minutes.</p></>:<Setup title="Connect Google Analytics"><p>Once you add your Google Analytics 4 Measurement ID to the app and a read-only Google service account to the server, its visitor numbers (countries, devices, traffic sources) will appear here. Until then, open Google Analytics directly.</p><p><a className="cta ghost" href="https://analytics.google.com" target="_blank" rel="noreferrer">Open Google Analytics <ExternalLink size={13}/></a></p></Setup>)}

  {tab==='system'&&(!sys?<p className="ad-loading">Loading…</p>:<section className="panel"><h3>What is switched on</h3><ul className="ad-flags">{([['Sign-in required for lookups',sys.signInEnforced],['Flight schedule data (AeroDataBox)',sys.aerodatabox],['Live aircraft position (OpenSky)',sys.opensky],['User numbers (Clerk secret key)',sys.clerkApi],['Google Analytics numbers',sys.googleAnalyticsApi],['Email notifications for enquiries',sys.emailNotifications],['AI features',sys.ai],['Ads',sys.ads],['Per-visitor rate limits behind Cloudflare',sys.trustCloudflareIp]] as [string,boolean][]).map(([k,v])=><li key={k}>{v?<CheckCircle2 size={16} className="ok"/>:<CircleSlash size={16} className="off"/>}<span>{k}</span><strong>{v?'On':'Off'}</strong></li>)}</ul><p className="ad-note">PHP {sys.phpVersion} · server time {sys.serverTime}</p></section>)}
  </div>
 </section>
}
