import {useEffect,useState} from 'react';
import {Megaphone,X} from 'lucide-react';

type Announcement={id:string;message:string;level:'info'|'warning';linkLabel:string;linkHref:string};

/** Announcements the owner published for the app (CMS, where "App" or "Both"). Plain text; the server checks every link. Dismissal is remembered on this device only. */
export default function Announcements(){
 const [items,setItems]=useState<Announcement[]>([]);
 const [hidden,setHidden]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('flightdeck-dismissed')||'[]')}catch{return []}});
 useEffect(()=>{const ac=new AbortController();fetch('/api/site',{signal:ac.signal}).then(r=>r.ok?r.json():null).then(j=>{if(j&&Array.isArray(j.announcements))setItems(j.announcements)}).catch(()=>{});return()=>ac.abort()},[]);
 const dismiss=(id:string)=>{const next=[...hidden,id].slice(-20);setHidden(next);try{localStorage.setItem('flightdeck-dismissed',JSON.stringify(next))}catch{/* private mode: dismissed for this visit only */}};
 return <>{items.filter(a=>!hidden.includes(a.id)).map(a=><div key={a.id} role="status" className={a.level==='warning'?'notice warn app-announce':'notice app-announce'}>
  <Megaphone size={17} aria-hidden="true"/><span>{a.message}{a.linkHref&&a.linkLabel&&<> <a href={a.linkHref} {...(/^https?:/.test(a.linkHref)?{rel:'noopener',target:'_blank'}:{})}>{a.linkLabel}</a></>}</span>
  <button className="icon-button" aria-label="Dismiss announcement" onClick={()=>dismiss(a.id)}><X size={15}/></button>
 </div>)}</>
}
