import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,History} from 'lucide-react';
import {call,when} from './api';

type Entry={at:string;by:string;action:string};

/** What changed, when, and by whom (a short fingerprint of the account, never the account id). Newest first. */
export default function AuditView(){
 const [items,setItems]=useState<Entry[]>([]),[you,setYou]=useState(''),[err,setErr]=useState(''),[loaded,setLoaded]=useState(false),[more,setMore]=useState(true);
 const load=useCallback(async(offset:number)=>{setErr('');try{const d=await call<{entries:Entry[];you:string}>(`/api/admin/audit?offset=${offset}`);setYou(d.you);setItems(x=>offset?[...x,...d.entries]:d.entries);setMore(d.entries.length===100)}catch(e){setErr((e as Error).message)}finally{setLoaded(true)}},[]);
 useEffect(()=>{void load(0)},[load]);
 if(!loaded)return <p className="ad-loading" role="status">Loading…</p>;
 return <section className="panel">
  <div className="cn-panel-head"><h2>Audit log</h2></div>
  <p className="ad-note">Every content change, publish, restore, upload and enquiry action in the console. To undo a content change, open the item and restore an earlier version from its history.</p>
  {err&&<div role="alert" className="notice error"><AlertTriangle size={16}/>{err}</div>}
  {items.length===0?<div className="ad-emptybox"><History size={26}/><p>Nothing has been changed in the console yet.</p></div>:
  <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>
   {items.map((e,i)=><tr key={i}><td>{when(e.at)}</td><td>{e.by===you?'You':<code>{e.by}</code>}</td><td>{e.action}</td></tr>)}
  </tbody></table></div>}
  {more&&items.length>0&&<button className="btn btn-secondary" onClick={()=>void load(items.length)}>Show older</button>}
 </section>
}
