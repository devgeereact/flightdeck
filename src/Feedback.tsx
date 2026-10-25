import {useEffect,useRef,useState} from 'react';
import {MessageSquare,X,Send,Check} from 'lucide-react';
import {track,ga} from './track';

type Kind='feedback'|'bug'|'contact';
const LABEL:Record<Kind,string>={feedback:'Share feedback',bug:'Report a problem',contact:'Ask a question'};
export default function Feedback({defaultEmail=''}:{defaultEmail?:string}){
 const dlg=useRef<HTMLDialogElement>(null),openedAt=useRef(0);
 const [kind,setKind]=useState<Kind>('feedback'),[message,setMessage]=useState(''),[email,setEmail]=useState(defaultEmail),[name,setName]=useState(''),[trap,setTrap]=useState('');
 const [state,setState]=useState<'idle'|'sending'|'sent'>('idle'),[error,setError]=useState('');
 useEffect(()=>{setEmail(e=>e||defaultEmail)},[defaultEmail]);
 const open=()=>{openedAt.current=Date.now();setState('idle');setError('');dlg.current?.showModal();track('feedback_opened')};
 const close=()=>dlg.current?.close();
 async function send(e:React.FormEvent){
  e.preventDefault();setError('');setState('sending');
  try{
   const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,message,email,name,website:trap,elapsed:Date.now()-openedAt.current})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(j.error||'Your message could not be sent. Please try again.');
   setState('sent');setMessage('');ga('feedback_sent',{source:kind});
  }catch(err){setState('idle');setError((err as Error).message)}
 }
 return <>
  <button className="fb-btn" onClick={open} aria-haspopup="dialog"><MessageSquare size={15}/>Feedback</button>
  <dialog ref={dlg} className="fb-dialog" aria-labelledby="fb-title" onClick={e=>{if(e.target===dlg.current)close()}}>
   <div className="fb-head"><h2 id="fb-title">{LABEL[kind]}</h2><button className="fb-close" onClick={close} aria-label="Close"><X size={18}/></button></div>
   {state==='sent'?<div className="fb-done" role="status"><Check size={26}/><h3>Thank you</h3><p>Your message has been sent. We read everything.</p><button className="cta" onClick={close}>Close</button></div>
   :<form onSubmit={send}>
    <div className="fb-kinds" role="radiogroup" aria-label="What is this about?">{(['feedback','bug','contact'] as Kind[]).map(k=><button type="button" key={k} role="radio" aria-checked={kind===k} className={kind===k?'fb-kind on':'fb-kind'} onClick={()=>setKind(k)}>{k==='feedback'?'Feedback':k==='bug'?'A problem':'A question'}</button>)}</div>
    <label className="fb-f"><span>YOUR MESSAGE</span><textarea required minLength={5} maxLength={4000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder={kind==='bug'?'What happened, and what did you expect?':kind==='contact'?'How can we help?':'What would make Flightdeck better for you?'}/></label>
    <div className="fb-row">
     <label className="fb-f"><span>NAME (OPTIONAL)</span><input value={name} maxLength={80} onChange={e=>setName(e.target.value)} autoComplete="name"/></label>
     <label className="fb-f"><span>EMAIL{kind==='contact'?'':' (OPTIONAL, FOR A REPLY)'}</span><input type="email" required={kind==='contact'} value={email} maxLength={254} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    </div>
    <input className="fb-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={trap} onChange={e=>setTrap(e.target.value)}/>
    {error&&<p role="alert" className="fb-error">{error}</p>}
    <div className="fb-foot"><small>We only use your details to reply. See our privacy information.</small><button className="cta" disabled={state==='sending'} type="submit"><Send size={15}/>{state==='sending'?'Sending…':'Send'}</button></div>
   </form>}
  </dialog>
 </>
}
