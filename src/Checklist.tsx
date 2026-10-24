import {useEffect,useRef,useState} from 'react';
import {Plus,Printer,RotateCcw,Pencil,X,Trash2,Plane,Eye,EyeOff,Check,ListChecks,Link2} from 'lucide-react';
import * as M from './checklistModel';
import {TEMPLATE} from './checklistTemplate';
import {loadLocal,saveLocal,getOwner,setOwner,clearLocal} from './checklistStore';
import {syncOnce,httpApi} from './checklistSync';
import {apiFetch} from './api';
import {track} from './track';

type Saved={number:string;date:string};
type Props={saved:Saved[];signedIn:boolean;userId:string|null;request:Saved|null;onRequestDone:()=>void;onTrack:(n:string,d:string)=>void};
const shortDate=(d:string)=>{const t=new Date(d+'T12:00:00');return isNaN(+t)?d:new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(t)};
const tripNameFor=(f:Saved)=>`${f.number} · ${shortDate(f.date)}`;

function Ring({percent,size=64}:{percent:number;size?:number}){
 const r=size/2-6,c=2*Math.PI*r;
 return <svg className="cl-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${percent}% packed`}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e3eadf" strokeWidth="6"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#214e3e" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-percent/100)} transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dashoffset .4s ease'}}/><text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="cl-ring-text">{percent}%</text></svg>
}

type SyncState='local'|'syncing'|'synced'|'offline'|'error';
export default function Checklist({saved,signedIn,userId,request,onRequestDone,onTrack}:Props){
 // A list left on this device by a different account is never shown to this one.
 const [data,setData]=useState<M.ChecklistData>(()=>{const owner=getOwner();if(userId&&owner&&owner!==userId){clearLocal();return M.emptyData()}return loadLocal()});
 const [sync,setSync]=useState<SyncState>('local');
 const syncing=useRef(false),again=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const dataRef=useRef(data);
 const [msg,setMsg]=useState('');
 const [edit,setEdit]=useState(false);
 const [onlyLeft,setOnlyLeft]=useState(false);
 const [newName,setNewName]=useState('');
 const [adding,setAdding]=useState<string|null>(null);
 const [addText,setAddText]=useState('');
 const [confirmReset,setConfirmReset]=useState(false);

 // One place every change goes through: apply, check it still fits, keep it on this device straight away (works offline).
 const commit=(fn:(d:M.ChecklistData)=>M.ChecklistData)=>{
  const prev=dataRef.current;const next=fn(prev);if(next===prev)return;
  if(next.trips.some(t=>!prev.trips.some(p=>p.id===t.id)))track('checklist_created');
  const p=next.trips.find(t=>t.id===next.active);if(p){const pr=M.progress(M.view(next,p.id));if(pr.total>0&&pr.done===pr.total){try{const k='fd-done-'+p.id;if(!localStorage.getItem(k)){localStorage.setItem(k,'1');track('checklist_completed')}}catch{}}}
  if(!M.fits(next)){setMsg('Your checklist is full. Remove a trip or some of your own items first.');return}
  dataRef.current=next;setData(next);setMsg('');
  if(!saveLocal(next))setMsg('Your browser could not save this. Changes will be lost when you close the page.');
  scheduleSync();
 };

 // Reconcile with the account copy: pull, merge, push. Failures never lose anything; the list stays on this device and retries later.
 const runSync=async()=>{
  if(!userId)return;
  if(syncing.current){again.current=true;return}
  syncing.current=true;setSync('syncing');
  try{
   const res=await syncOnce(dataRef.current,httpApi(apiFetch));
   const final={...M.merge(dataRef.current,res),rev:res.rev};
   dataRef.current=final;setData(final);saveLocal(final);setOwner(userId);setSync('synced');
  }catch{setSync(navigator.onLine?'error':'offline')}
  finally{syncing.current=false;if(again.current){again.current=false;void runSync()}}
 };
 function scheduleSync(){if(!userId)return;if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{void runSync()},900)}
 useEffect(()=>{
  if(!userId)return;
  void runSync();
  const online=()=>{void runSync()};
  window.addEventListener('online',online);
  return()=>{window.removeEventListener('online',online);if(timer.current)clearTimeout(timer.current)};
 },[userId]);

 // "Make a checklist for this flight" from the saved-flights list.
 useEffect(()=>{
  if(!request)return;
  const existing=dataRef.current.trips.find(t=>t.flight&&t.flight.number===request.number&&t.flight.date===request.date);
  commit(d=>existing?{...d,active:existing.id}:M.addTrip(d,tripNameFor(request),request));
  onRequestDone();
 },[request]);

 const trip=data.trips.find(t=>t.id===data.active)||null;
 const sections=M.view(data,trip?.id??null);
 const prog=M.progress(sections);
 const hiddenTotal=sections.reduce((n,s)=>n+s.hiddenCount,0);

 if(!trip)return <section className="panel cl-empty">
  <ListChecks size={34}/>
  <h2>Pack once. Reuse it every trip.</h2>
  <p>Start from a ready-made list of {M.view(M.emptyData(),null).reduce((n,s)=>n+s.items.length,0)} things people forget, in the order a trip actually happens: days before, clothes, bathroom bag, documents, the night before and last minute. Tick things off, add your own, hide what you never need. Your list is kept for next time{signedIn?' and follows you across your devices':' on this device (sign in to keep it across devices)'}.</p>
  <form className="cl-start" onSubmit={e=>{e.preventDefault();commit(d=>M.addTrip(d,newName||'My next trip'));setNewName('')}}>
   <label><span>NAME THIS TRIP</span><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Cape Town in October" maxLength={M.LIMITS.name} aria-label="Trip name"/></label>
   <button className="cta" type="submit"><Plus size={16}/>Start my checklist</button>
  </form>
  {saved.length>0&&<div className="cl-quick"><span>Or start from a saved flight:</span>{saved.slice(0,4).map(s=><button key={s.number+s.date} className="text-button" onClick={()=>commit(d=>M.addTrip(d,tripNameFor(s),s))}><Plane size={13}/>{tripNameFor(s)}</button>)}</div>}
  {msg&&<p role="alert" className="cl-msg">{msg}</p>}
 </section>;

 const flightLabel=trip.flight?tripNameFor(trip.flight):'';
 return <section className="cl" aria-label="Travel checklist">
  <div className="cl-top panel">
   <div className="cl-tripbar" role="tablist" aria-label="Your trips">
    {data.trips.map(t=><button key={t.id} role="tab" aria-selected={t.id===trip.id} className={t.id===trip.id?'cl-tab active':'cl-tab'} onClick={()=>{commit(d=>({...d,active:t.id}));setConfirmReset(false)}}>{t.name}</button>)}
    {data.trips.length<M.LIMITS.trips&&<button className="cl-tab add" onClick={()=>commit(d=>M.addTrip(d,'My next trip'))} aria-label="Add a trip"><Plus size={14}/>New trip</button>}
   </div>
   <div className="cl-head">
    <Ring percent={prog.percent}/>
    <div className="cl-title">
     <input className="cl-name" aria-label="Trip name" value={trip.name} maxLength={M.LIMITS.name} onChange={e=>commit(d=>M.renameTrip(d,trip.id,e.target.value||' '))} onBlur={e=>{if(!e.target.value.trim())commit(d=>M.renameTrip(d,trip.id,'My next trip'))}}/>
     <p aria-live="polite">{prog.done} of {prog.total} packed{prog.total>0&&prog.done===prog.total?' · all done, safe travels!':''}</p>
     <div className="cl-flight">
      {trip.flight?<><span className="pill"><Plane size={10}/> {flightLabel}</span><button className="text-button" onClick={()=>onTrack(trip.flight!.number,trip.flight!.date)}>Check this flight</button><button className="text-button" onClick={()=>commit(d=>M.linkFlight(d,trip.id,undefined))} aria-label="Unlink flight"><X size={12}/></button></>
       :saved.length>0?<label className="cl-link"><Link2 size={13}/><select aria-label="Link a saved flight" value="" onChange={e=>{const s=saved.find(x=>x.number+'|'+x.date===e.target.value);if(s)commit(d=>M.linkFlight(d,trip.id,s))}}><option value="">Link a saved flight…</option>{saved.map(s=><option key={s.number+s.date} value={s.number+'|'+s.date}>{tripNameFor(s)}</option>)}</select></label>
       :<span className="cl-hint">Save a flight to link it to this trip.</span>}
     </div>
    </div>
    <div className="cl-actions">
     <button className={onlyLeft?'text-button primary':'text-button'} onClick={()=>setOnlyLeft(v=>!v)} aria-pressed={onlyLeft}>{onlyLeft?<Eye size={13}/>:<EyeOff size={13}/>}Still to pack</button>
     <button className={edit?'text-button primary':'text-button'} onClick={()=>setEdit(v=>!v)} aria-pressed={edit}><Pencil size={13}/>{edit?'Done editing':'Edit list'}</button>
     {confirmReset?<><button className="text-button danger" onClick={()=>{commit(d=>M.resetTicks(d,trip.id));setConfirmReset(false)}}>Yes, untick everything</button><button className="text-button" onClick={()=>setConfirmReset(false)}>Cancel</button></>
      :<button className="text-button" onClick={()=>setConfirmReset(true)} disabled={prog.done===0}><RotateCcw size={13}/>Reset ticks</button>}
     <button className="text-button" onClick={()=>window.print()}><Printer size={13}/>Print</button>
     <button className="text-button danger" onClick={()=>{if(confirm(`Delete the trip “${trip.name}”? Your list items are kept.`))commit(d=>M.removeTrip(d,trip.id))}} aria-label="Delete this trip"><Trash2 size={13}/></button>
    </div>
   </div>
   {msg&&<p role="alert" className="cl-msg">{msg}</p>}
  </div>

  {sections.map(sec=>{
   const items=onlyLeft?sec.items.filter(i=>!i.done):sec.items;
   if(!edit&&sec.items.length===0)return null;
   return <details key={sec.id} className="panel cl-sec" open={sec.doneCount<sec.items.length||edit}>
    <summary><span className="cl-sec-title">{sec.title}</span><span className="cl-sec-count" aria-label={`${sec.doneCount} of ${sec.items.length} packed`}>{sec.doneCount}/{sec.items.length}</span><span className="cl-bar" aria-hidden="true"><i style={{width:`${sec.items.length?sec.doneCount/sec.items.length*100:0}%`}}/></span>{sec.doneCount===sec.items.length&&sec.items.length>0&&<Check size={15} className="cl-sec-done"/>}</summary>
    {sec.hint&&<p className="cl-sec-hint">{sec.hint}</p>}
    <ul className="cl-list">
     {items.map(it=><li key={it.id} className={it.done?'done':''}>
      {edit?<>
       <input className="cl-edit" aria-label={`Rename ${it.text}`} defaultValue={it.text} maxLength={M.LIMITS.label} onBlur={e=>{if(e.target.value.trim()&&e.target.value!==it.text)commit(d=>M.renameItem(d,it.id,e.target.value))}} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}}/>
       <button className="cl-x" aria-label={`${it.custom?'Delete':'Hide'} ${it.text}`} onClick={()=>commit(d=>M.removeItem(d,it.id))}><X size={14}/></button>
      </>:<label className="cl-check"><input type="checkbox" checked={it.done} onChange={e=>commit(d=>M.tick(d,trip.id,it.id,e.target.checked))}/><span className="cl-box" aria-hidden="true"><Check size={13} strokeWidth={3}/></span><span className="cl-text">{it.text}</span></label>}
     </li>)}
     {onlyLeft&&items.length===0&&sec.items.length>0&&<li className="cl-allset"><Check size={14}/>Everything here is packed</li>}
    </ul>
    <div className="cl-sec-foot">
     {adding===sec.id?<form onSubmit={e=>{e.preventDefault();commit(d=>M.addItem(d,sec.id,addText));setAddText('');setAdding(null)}} className="cl-add"><input autoFocus aria-label={`New item in ${sec.title}`} value={addText} onChange={e=>setAddText(e.target.value)} placeholder="Add your own item" maxLength={M.LIMITS.label}/><button className="text-button primary" type="submit">Add</button><button className="text-button" type="button" onClick={()=>{setAdding(null);setAddText('')}}>Cancel</button></form>
      :<button className="text-button" onClick={()=>{setAdding(sec.id);setAddText('')}}><Plus size={13}/>Add item</button>}
     {edit&&(sec.items.length>0?<button className="text-button" onClick={()=>commit(d=>M.hideSection(d,sec.id))}>Hide whole section</button>:TEMPLATE.some(t=>t.id===sec.id)&&<button className="text-button" onClick={()=>commit(d=>M.showSection(d,sec.id))}>Show section again</button>)}
    </div>
   </details>})}

  {(hiddenTotal>0)&&<p className="cl-restore">{hiddenTotal} item{hiddenTotal>1?'s':''} hidden from your list. <button className="text-button" onClick={()=>commit(d=>M.restoreAll(d))}>Restore all</button></p>}
  <p className="cl-note" aria-live="polite">{!signedIn?'Your list is kept on this device only. Sign in to keep it across devices. It works without a connection.':sync==='syncing'?'Saving to your account…':sync==='synced'?'Saved to your account and on this device. It works without a connection.':sync==='offline'?'You are offline. Your changes are saved on this device and will sync when you are back online.':sync==='error'?'Could not reach your account just now. Your changes are safe on this device and will sync later.':'Saved on this device.'}</p>
 </section>
}
