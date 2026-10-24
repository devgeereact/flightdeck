// Small helpers for showing a flight. Plain functions, no React, so the tests and the views can share them.
import type {Flight} from './types';

export const time=(t:string|null,tz:string|null)=>t?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:tz||'UTC'}).format(new Date(t)):'Not available';
export const day=(t:string|null,tz:string|null)=>t?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:tz||'UTC'}).format(new Date(t)):'';
export const airlines:Record<string,string>={BA:'https://www.britishairways.com/travel/flightstatus/public/en_gb',EK:'https://www.emirates.com/english/manage-booking/flight-status/',AF:'https://www.airfrance.com/flight-status'};
export const regionName=(code?:string|null)=>{try{return code?new Intl.DisplayNames(['en-GB'],{type:'region'}).of(code)||code:''}catch{return code||''}};
export const withHint=(value:string|null,hint?:string)=>value||(hint?`${hint} (usual, not confirmed)`:null);
export const weatherLabel=(n:number)=>n===0?'Clear sky':n<=3?'Partly cloudy':n<=48?'Foggy':n<=67?'Rain':n<=77?'Snow':n<=82?'Rain showers':'Stormy';

export const directionText=(d:NonNullable<Flight['direction']>)=>{
  const home=regionName(d.home)||d.home;
  if(d.basis==='number')return d.type==='outbound'?`Probably leaving ${home}. Judged from the flight number, so the route is not confirmed.`:`Probably arriving in ${home}. Judged from the flight number, so the route is not confirmed.`;
  return d.type==='outbound'?`Leaving ${d.place}`:d.type==='inbound'?`Arriving in ${d.place}`:d.type==='domestic'?`Domestic, within ${home}`:`International, not to or from ${home}`;
};

// Best known time for an event: what happened, else the current estimate, else the plan.
export const pick=(actual:string|null,estimate:string|null|undefined,scheduled:string|null):{t:string|null;kind:string}=>actual?{t:actual,kind:'Actual'}:estimate?{t:estimate,kind:'Estimated'}:scheduled?{t:scheduled,kind:'Scheduled'}:{t:null,kind:'Not reported'};

// How far through its day the airline says the flight is. Higher is later.
const STAGE:Record<string,number>={Expected:0,CheckIn:1,Boarding:2,GateClosed:3,Departed:4,EnRoute:5,Approaching:6,Arrived:7};

export type Step={key:string;label:string;note:string;t:string|null;tz:string|null;kind:string;done:boolean};

// The journey in the order it happens: check-in, boarding, leaving the gate, take-off, landing, reaching the gate, bags.
export function journeySteps(f:Flight):Step[]{
  const st=f.providerStatus?STAGE[f.providerStatus]:undefined;
  const o=f.origin.timezone,d=f.destination.timezone;
  const at=(key:string,label:string,note:string,p:{t:string|null;kind:string},tz:string|null,done:boolean):Step=>({key,label,note,t:p.t,tz,kind:p.kind,done});
  return [
    {key:'checkin',label:'Check-in',note:'Bag drop and security',t:null,tz:o,kind:st===undefined?'Not reported':st===1?'Open now':st>1?'Done':'Not reported yet',done:st!==undefined&&st>1},
    at('boarding','Boarding','Called to the aircraft',f.boarding?{t:f.boarding,kind:'Reported by the airline'}:{t:null,kind:'Not reported'},o,!!f.boarding||(st!==undefined&&st>2)),
    at('gateout','Leaves the gate','Pushes back from the stand (gate out)',pick(f.actualOut,f.estimatedOut,f.scheduledOut),o,!!f.actualOut||(st!==undefined&&st>=4)),
    at('takeoff','Take-off','Wheels leave the runway',pick(f.takeoff,f.estimatedTakeoff,null),o,!!f.takeoff||(st!==undefined&&st>=4)),
    at('landing','Landing','Wheels touch down',pick(f.landing,f.estimatedLanding,null),d,!!f.landing||st===7),
    at('gatein','Reaches the gate','Parks at the arrival stand (gate in)',pick(f.actualIn,f.estimatedIn,f.scheduledIn),d,!!f.actualIn||st===7),
    {key:'bags',label:'Bags on the belt',note:f.baggage?`Belt ${f.baggage}`:'Belt not assigned yet',t:null,tz:d,kind:f.baggage?'Belt reported':'Not reported yet',done:st===7&&!!f.baggage},
  ];
}
