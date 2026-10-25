import {apiFetch} from '../api';

/** A failed console request: the server's message, its status, and per-field errors when a form did not validate. */
export class ApiError extends Error{
 constructor(message:string,readonly status:number,readonly errors:Record<string,string>|null){super(message)}
}

/** JSON in, JSON out, with the signed-in user's token. `raw` sends a file body as it is (image uploads). */
export async function call<T=any>(path:string,opts:{method?:string;body?:unknown;raw?:Blob;signal?:AbortSignal}={}):Promise<T>{
 const init:RequestInit={method:opts.method||'GET',signal:opts.signal};
 if(opts.raw){init.body=opts.raw;init.headers={'Content-Type':opts.raw.type}}
 else if(opts.body!==undefined){init.body=JSON.stringify(opts.body);init.headers={'Content-Type':'application/json'}}
 const r=await apiFetch(path,init);
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new ApiError(j.error||`Request failed (${r.status})`,r.status,j.errors||null);
 return j as T;
}

export const nf=new Intl.NumberFormat('en-GB');
/** UK date and time, or "Never". Accepts ms or an ISO string. */
export const when=(v:number|string|null|undefined)=>{if(!v)return 'Never';const d=new Date(v);return Number.isNaN(d.getTime())?'Never':new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(d)};
