import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,ChevronRight,Plus} from 'lucide-react';
import {call,when} from '../api';
import Editor,{type ContentType} from './Editor';
import type {Category} from './forms';

type Item={id:string;label:string;kind:string|null;category:string|null;published:boolean;unpublished:boolean;hasDraft:boolean;updatedAt:string|null;required:boolean};
export type Section='pages'|'guides'|'faqs'|'announcements'|'navigation'|'settings';
const TYPE:Record<Section,ContentType>={pages:'page',guides:'page',faqs:'faq',announcements:'announcement',navigation:'navigation',settings:'settings'};
const INTRO:Record<Section,string>={
 pages:'The pages of the public website. Changes are saved as drafts and go live when you publish.',
 guides:'Travel guides. Each belongs to a section on the guides page.',
 faqs:'Questions and answers on the help page. The first four (by order) also show on the home page.',
 announcements:'A short banner on the website, the app, or both, optionally between two times.',
 navigation:'The links in the website\'s top menu and footer.',
 settings:'Public details used across the website, and the image shown when a link is shared.',
};
const stamp=()=>Date.now().toString(36);
const slugify=(t:string)=>t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);

/** A list of items with their state, and the editor for the one that is open (#/admin/<section>/<id>). */
export default function ContentSection({section,openId,navigate}:{section:Section;openId:string|null;navigate:(id:string|null)=>void}){
 const type=TYPE[section];
 const [items,setItems]=useState<Item[]|null>(null),[categories,setCategories]=useState<Category[]>([]),[err,setErr]=useState('');
 const [creating,setCreating]=useState<{id:string;blank:any}|null>(null),[newSlug,setNewSlug]=useState(''),[newCat,setNewCat]=useState(''),[newErr,setNewErr]=useState('');
 const load=useCallback(async()=>{setErr('');try{const d=await call<{items:Item[];categories:Category[]}>(`/api/admin/content/${type}`);setItems(d.items);setCategories(d.categories)}catch(e){setErr((e as Error).message)}},[type]);
 useEffect(()=>{void load();setCreating(null)},[load,section]);
 const single=section==='navigation'||section==='settings';
 if(single)return <><p className="cn-intro">{INTRO[section]}</p><Editor type={type} id={section==='navigation'?'main':'site'} categories={categories} sections={[]} onChanged={()=>void load()}/></>;
 const list=(items||[]).filter(i=>section==='guides'?i.kind==='guide':section==='pages'?i.kind!=='guide':true).sort((a,b)=>Number(b.id==='home')-Number(a.id==='home'));
 const sections=[...new Set((items||[]).map(i=>i.category).filter(Boolean) as string[])];
 if(creating||openId){
  const id=creating?.id??openId!;
  const known=(items||[]).some(i=>i.id===id);
  return <Editor key={id} type={type} id={id} isNew={!!creating&&!known} blank={creating?.blank} categories={categories} sections={section==='faqs'?[...new Set((items||[]).map(i=>i.category||'').filter(Boolean))]:sections}
   onClose={()=>{setCreating(null);navigate(null);void load()}} onChanged={()=>void load()}/>;
 }
 const startNew=()=>{
  setNewErr('');
  if(section==='faqs'){const id='faq-'+stamp();setCreating({id,blank:{question:'',answer:'',category:'',order:(items?.length||0)+1}});navigate(id);return}
  if(section==='announcements'){const id='ann-'+stamp();setCreating({id,blank:{message:'',level:'info',where:'site',start:'',end:'',linkLabel:'',linkHref:''}});navigate(id);return}
  const s=slugify(newSlug);
  const id=section==='guides'?`guides/${s}`:s;
  if(!s){setNewErr('Type an address, such as my-page.');return}
  if((items||[]).some(i=>i.id===id)){setNewErr('A page with that address already exists.');return}
  if(section==='guides'&&!newCat){setNewErr('Choose a guide section.');return}
  setCreating({id,blank:section==='guides'?{kind:'guide',title:'',description:'',body:'',category:newCat,takeaways:[]}:{kind:'page',title:'',description:'',body:''}});
  navigate(id);
 };
 return <div className="cn-section">
  <p className="cn-intro">{INTRO[section]}</p>
  {err&&<div role="alert" className="notice error"><AlertTriangle size={16}/>{err} <button className="text-button" onClick={()=>void load()}>Try again</button></div>}
  <form className="cn-new" onSubmit={e=>{e.preventDefault();startNew()}}>
   {(section==='pages'||section==='guides')&&<>
    <label><span>New {section==='guides'?'guide':'page'} address</span><span className="cn-slug"><span>/{section==='guides'?'guides/':''}</span><input value={newSlug} onChange={e=>setNewSlug(e.target.value)} placeholder="my-new-page" aria-describedby="cn-new-err"/><span>/</span></span></label>
    {section==='guides'&&<label><span>Section</span><select value={newCat} onChange={e=>setNewCat(e.target.value)}><option value="">Choose…</option>{categories.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
   </>}
   <button className="btn btn-primary" type="submit"><Plus size={15}/>{section==='faqs'?'New question':section==='announcements'?'New announcement':section==='guides'?'New guide':'New page'}</button>
   {newErr&&<p className="cn-err" id="cn-new-err" role="alert">{newErr}</p>}
  </form>
  {!items?<p className="ad-loading" role="status">Loading…</p>:list.length===0?<section className="panel ad-emptybox"><p>{section==='announcements'?'No announcements. Add one when there is something visitors should know, such as paused schedules.':'Nothing here yet.'}</p></section>:
  <ul className="cn-items">{list.map(i=><li key={i.id}><a href={`#/admin/${section}/${encodeURIComponent(i.id)}`} onClick={e=>{e.preventDefault();navigate(i.id)}}>
   <span className="cn-item-main"><strong>{i.label||i.id}</strong><small>{section==='pages'||section==='guides'?`/${i.id==='home'?'':i.id+'/'}`:i.category||''}{i.updatedAt?` · draft saved ${when(i.updatedAt)}`:''}</small></span>
   <span className={'cn-badge '+(!i.published||i.unpublished?'off':i.hasDraft?'draft':'live')}>{!i.published?'Draft only':i.unpublished?'Hidden':i.hasDraft?'Changes not published':'Published'}</span>
   <ChevronRight size={16} aria-hidden="true"/>
  </a></li>)}</ul>}
 </div>
}
