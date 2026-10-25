// "Leaves in 2 h 15 min" style labels, worked out only from times the providers reported. No time, no label.
import type {Flight} from './types';

const AIR=new Set(['Departed','EnRoute','Approaching']);

/** 2 h 15 min, 45 min, 1 day 3 h. Rounds to the nearest minute; under a minute reads "under a minute". */
export function duration(ms:number):string{
  const m=Math.round(Math.abs(ms)/60000);
  if(m<1)return 'under a minute';
  const d=Math.floor(m/1440),h=Math.floor((m%1440)/60),min=m%60;
  if(d>0)return h?`${d} day${d>1?'s':''} ${h} h`:`${d} day${d>1?'s':''}`;
  if(h>0)return min?`${h} h ${min} min`:`${h} h`;
  return `${min} min`;
}

/** One short line about where the flight is in time, or null when the times needed are not reported. */
export function countdown(f:Flight,nowMs:number):string|null{
  if(f.cancelled||f.usualRouteOnly)return null;
  const st=f.providerStatus;
  const dep=f.actualOut??f.estimatedOut??f.scheduledOut;
  const arr=f.actualIn??f.estimatedIn??f.scheduledIn;
  const t=(s:string|null|undefined)=>s?new Date(s).getTime():NaN;
  if(st==='Arrived'||f.actualIn){const a=t(f.actualIn??f.landing);return isNaN(a)?'Arrived':`Arrived ${duration(nowMs-a)} ago`}
  if((st&&AIR.has(st))||f.actualOut||f.takeoff){const a=t(arr);if(isNaN(a))return 'In the air';return a>nowMs?`Due at the gate in ${duration(a-nowMs)}`:`Due at the gate ${duration(nowMs-a)} ago`}
  const d=t(dep);
  if(isNaN(d))return null;
  return d>nowMs?`Leaves in ${duration(d-nowMs)}`:`Was due to leave ${duration(nowMs-d)} ago`;
}
