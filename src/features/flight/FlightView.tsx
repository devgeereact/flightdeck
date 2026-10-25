import {useRef,useState,useEffect} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {Plane,ArrowUpRight,Clock,MapPin,RefreshCw,CloudSun,Luggage,Navigation,Check,Radio,Info,Globe,Wind,Bookmark,Compass,Share2,Timer,CalendarPlus} from 'lucide-react';
import type {Airport,Flight,FlightResponse} from '../../types';
import {destinations} from './destinations';
import {apiFetch} from '../../shared/api';
import {summarise} from './summary';
import {countdown} from './countdown';
import {flightIcs} from './ics';
import {withMotion,fromAny} from '../../shared/motion';
import {time,day,airlines,regionName,withHint,weatherLabel,directionText,journeySteps} from './flightFormat';
import {nextTabIndex} from '../../shared/tabKeys';
gsap.registerPlugin(useGSAP);

type Props={flight:Flight;data:FlightResponse;now:Date;busy:boolean;auto:boolean;setAuto:(v:boolean)=>void;changes:string[];onRefresh:()=>void;onSave:()=>void;onShare?:()=>void;shareNote?:string};
type Panel='journey'|'airport'|'weather'|'updates'|'destination';
const PANELS:{id:Panel;label:string;short?:string;icon:any}[]=[{id:'journey',label:'Journey',icon:Clock},{id:'airport',label:'Airport',icon:Luggage},{id:'weather',label:'Weather',icon:CloudSun},{id:'updates',label:'Updates',icon:Radio},{id:'destination',label:'Destination',short:'City',icon:Compass}];
const here=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;

function Detail({label,value}:{label:string;value:string|null}){return <div className="detail"><span>{label}</span><strong>{value||'Not reported'}</strong></div>}
function TimeBlock({label,value,airport}:{label:string;value:string|null;airport:Airport}){return <div><span>{label}</span><strong>{time(value,airport.timezone)}<small>{day(value,airport.timezone)}</small></strong><small>{airport.timezone||'UTC (airport time zone unavailable)'}</small></div>}
function ClockBlock({airport,now}:{airport:Airport;now:Date}){return <div><span>{airport.city||airport.code} local time</span><strong>{time(now.toISOString(),airport.timezone)}</strong><small>{airport.timezone||'UTC'}</small></div>}

function Weather({airport}:{airport:Airport}){
  const [weather,setWeather]=useState<any>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const c=new AbortController();setWeather(null);setFailed(false);
    if(airport.lat===null||airport.lon===null){setFailed(true);return}
    apiFetch(`/api/weather?lat=${airport.lat}&lon=${airport.lon}`,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setWeather(await r.json())}).catch(e=>{if(e.name!=='AbortError')setFailed(true)});
    return()=>c.abort();
  },[airport.code,airport.lat,airport.lon,retry]);
  return <div className="fv-weather">
    <span className="weather-place"><MapPin size={13}/>{airport.city||airport.name}, at the airport</span>
    {weather?<>
      <div className="temperature">{Math.round(weather.temperature_2m)}<span>°C</span><CloudSun size={56} strokeWidth={1}/></div>
      <h3>{weatherLabel(weather.weather_code)}</h3>
      <p><Wind size={15}/>Wind {weather.wind_speed_10m} km/h</p>
      <small>Conditions right now ({weather.time.replace('T',' ')}, airport time). This is not a forecast for when you land.</small>
    </>:<div className="weather-unavailable">{failed?'Weather is not available right now.':'Getting the weather…'}{failed&&<button onClick={()=>setRetry(r=>r+1)}>Try again</button>}</div>}
    <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo <ArrowUpRight size={12}/></a>
  </div>;
}

function Destination({airport}:{airport:Airport}){
  const d=destinations[airport.code];
  return <div className="fv-destination">
    <div className="welcome"><div><span className="eyebrow">Your destination · {airport.country||regionName(airport.countryCode)||airport.city||airport.code}</span><h2>{d?.greeting||`Welcome to ${airport.city||airport.name}.`}</h2><p>{d?.intro||'Your trip starts in the arrivals hall. The local visitor guide is a good place to plan your stay.'}</p><div className="welcome-tags"><span><Globe size={13}/>{d?.language||'Local guide'}</span>{d&&<span>{d.currency}</span>}</div></div>
    <div className="tip"><Info size={20}/><h3>Getting from the airport</h3><p>{d?.tip||'Check the airport\'s own website for transport options, and confirm opening times before you travel.'}</p></div></div>
    <div className="places">{(d?.places||[{name:`Explore ${airport.city||airport.code}`,kind:'Local ideas',description:'The official tourism website lists current attractions and practical visitor information.',url:`https://www.google.com/search?q=${encodeURIComponent(airport.city+' official tourism')}`}]).map((p,i)=><a href={p.url} key={p.name} target="_blank" rel="noreferrer" className="place"><div className="place-body"><span>{p.kind}</span><h3>{p.name}<ArrowUpRight size={18}/></h3><p>{p.description}</p></div></a>)}</div>
    <p className="destination-note">These are hand-picked ideas for the city, not ranked by distance. Check official sources for opening times, tickets and access.</p>
  </div>;
}

export default function FlightView({flight,data,now,busy,auto,setAuto,changes,onRefresh,onSave,onShare,shareNote}:Props){
  const [panel,setPanel]=useState<Panel>('journey');
  const root=useRef<HTMLDivElement>(null);
  const tabRefs=useRef<(HTMLButtonElement|null)[]>([]);
  // Arrow keys, Home and End move between the tabs; only the selected tab is in the Tab order.
  const onTabKey=(e:React.KeyboardEvent,i:number)=>{const j=nextTabIndex(e.key,i,PANELS.length);if(j===null)return;e.preventDefault();setPanel(PANELS[j].id);tabRefs.current[j]?.focus()};
  const steps=journeySteps(flight);
  // Calendar file from the times on screen; offered only when both ends have a time.
  const ics=flightIcs(flight,`${location.origin}/app/#/flight/${flight.number}/${(flight.scheduledOut||flight.estimatedOut||'').slice(0,10)}`);
  const addToCalendar=()=>{if(!ics)return;const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${flight.number}-${(flight.scheduledOut||'').slice(0,10)}.ics`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  const delayed=flight.cancelled||(flight.delayMinutes!=null&&flight.delayMinutes>0);
  const progressText=flight.progress!==null
    ?`${flight.progress}% of the way${flight.progressBasis==='position'?' (from live position)':flight.progressBasis==='times'?' (from flight times)':flight.progressBasis==='status'?'':''}`
    :flight.usualRouteOnly?'Schedule not published yet':flight.providerStatus&&['Expected','CheckIn','Boarding','GateClosed'].includes(flight.providerStatus)?'Not departed yet':'Progress not available';
  const punctuality=flight.cancelled?'Cancelled':flight.diverted?'Diverted':flight.delayMinutes===null?'Punctuality not reported':flight.delayMinutes===0&&flight.liveUpdates===false?'Schedule only, no live status yet':flight.delayMinutes>0?`${flight.delayMinutes} min late leaving`:flight.delayMinutes<0?`${Math.abs(flight.delayMinutes)} min early leaving`:'On time';
  // Cards rise in when a flight appears; the progress bar and the journey steps fill in after them.
  useGSAP(()=>{
    const q=gsap.utils.selector(root);
    withMotion(()=>{
      fromAny(gsap,q('.fv-top > *, .fv-tabs'),{autoAlpha:0,y:20,duration:.55,ease:'power3.out',stagger:.09});
      fromAny(gsap,q('.route-progress > div'),{scaleX:0,transformOrigin:'0 50%',duration:1,ease:'power2.out',delay:.3});
    });
  },{scope:root,dependencies:[flight.id]});
  useGSAP(()=>{
    const q=gsap.utils.selector(root);
    withMotion(()=>{fromAny(gsap,q('.fv-body > *'),{autoAlpha:0,y:12,duration:.4,ease:'power2.out',stagger:.05})});
  },{scope:root,dependencies:[panel,flight.id]});
  return <div className="fv" ref={root}>
    <div className="fv-bar"><div className="fv-title"><h2>Your flight</h2>{countdown(flight,now.getTime())&&<span className="fv-countdown"><Timer size={14}/>{countdown(flight,now.getTime())}</span>}</div><div>{shareNote&&<span className="fv-share-note" role="status">{shareNote}</span>}{ics&&<button className="btn btn-secondary" onClick={addToCalendar}><CalendarPlus size={15}/>Add to calendar</button>}{onShare&&<button className="btn btn-secondary" onClick={onShare}><Share2 size={15}/>Share</button>}<span className="updated">Updated {time(data.fetchedAt,here())} your time</span><button className="icon-button" aria-label="Refresh flight" title="Refresh flight" onClick={onRefresh} disabled={busy}><RefreshCw size={16} className={busy?'spin':''}/></button><button className="btn btn-primary" onClick={onSave}><Bookmark size={15}/>Save flight</button></div></div>
    <div className="fv-top">
      <section className="panel flight-card">
        <div className="flight-header"><div className="airline-icon"><Plane size={21}/></div><div><h3>{flight.airline}</h3><span>{flight.number} · {flight.aircraft||'Aircraft not reported'}</span></div><span className={'status '+(delayed?'delayed':'')}><span className="dot"/>{flight.status}</span></div>
        <p className="in-short">{summarise(flight).join(' ')}</p>
        {flight.direction&&<div className={'direction '+flight.direction.type}><span className="pill">{flight.direction.type==='overseas'?'International':flight.direction.type[0].toUpperCase()+flight.direction.type.slice(1)}</span>{directionText(flight.direction)}</div>}
        <div className="route"><div><span className="muted">From</span><h2>{flight.origin.code}</h2><h3>{flight.origin.city||flight.origin.name}</h3></div><div className="route-middle"><Plane size={24}/><span>{flight.origin.code} to {flight.destination.code}</span></div><div><span className="muted">To</span><h2>{flight.destination.code}</h2><h3>{flight.destination.city||flight.destination.name}</h3></div></div>
        {flight.usualRouteOnly
          ?<div className="times"><p className="muted-copy">There are no times for this date yet. They usually appear a few days before departure.</p></div>
          :<div className="times"><TimeBlock label="Leaves the gate (planned)" value={flight.scheduledOut} airport={flight.origin}/><TimeBlock label="Reaches the gate (planned)" value={flight.scheduledIn} airport={flight.destination}/></div>}
        <div className="route-progress"><div style={{width:`${Math.max(0,Math.min(100,flight.progress||0))}%`}}/></div>
        <div className="progress-meta"><span>{progressText}</span><span>{punctuality}</span></div>
        {(flight.distanceRemainingKm!=null||flight.etaEstimate)&&<div className="progress-meta"><span>{flight.distanceRemainingKm!=null?`About ${flight.distanceRemainingKm.toLocaleString('en-GB')} km to go in a straight line`:''}</span><span>{flight.etaEstimate?`Estimated arrival ${time(flight.etaEstimate,flight.destination.timezone)} ${flight.destination.timezone?`${flight.destination.city||flight.destination.code} time`:'UTC'}. Worked out from speed, so it is not an airline time.`:''}</span></div>}
        {flight.routeSource&&<div className="progress-meta"><span>The route is the usual one for this callsign ({flight.routeSource}). Today's can differ.</span></div>}
        {data.mode==='live'&&flight.dataSource==='AeroDataBox'&&!flight.liveUpdates&&<div className="progress-meta"><span>These times are the airline's schedule. Live updates are not available for this flight or airport.</span></div>}
      </section>
      <section className="map-card">
        <div className="map-caption"><span><Navigation size={14}/>Journey overview</span><span className="pill">Diagram</span></div>
        <svg className="route-map" viewBox="0 0 460 280" aria-label="Illustrative route diagram, not live aircraft tracking" role="img"><defs><pattern id="grid" width="23" height="23" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#a9bfb5" opacity=".5"/></pattern></defs><rect width="460" height="280" fill="url(#grid)"/><path d="m0 58 44-24 57 9 17 25 39 4 26 35-9 34-36 4-20 37-35 8-13-26-28-19-18-46z M291 35l47 12 20 37 64 8 38 23v91l-47-14-35 16-36-31-21-57-31-29z" fill="#cfddd4"/><path d="M87 174 Q220 18 373 134" fill="none" stroke="#729988" strokeWidth="1.5" strokeDasharray="4 5"/><path d="M87 174 Q148 98 211 100" fill="none" stroke="#214f40" strokeWidth="2.5"/><circle cx="87" cy="174" r="5" fill="#214f40"/><circle cx="373" cy="134" r="5" fill="#214f40"/><text x="70" y="202">{flight.origin.code}</text><text x="355" y="160">{flight.destination.code}</text><g transform="translate(211 100) rotate(65)"><path d="m0-14 4 10 11 5v3L3 1 2 10l4 3v2l-6-2-6 2v-2l4-3-1-9-12 3V1l11-5z" fill="#214f40"/></g></svg>
        <div className="position-note"><Radio size={17}/>{flight.position
          ?<div><strong>Live position: {flight.position.lat.toFixed(3)}°, {flight.position.lon.toFixed(3)}°</strong><span>{[flight.onGround?'On the ground':'In the air',flight.altitudeM!=null&&`${flight.altitudeM.toLocaleString('en-GB')} m up`,flight.speedKmh!=null&&`${flight.speedKmh} km/h`,flight.headingDeg!=null&&`heading ${flight.headingDeg}°`].filter(Boolean).join(', ')}. Reported at {time(flight.position.time,here())}.<span className="pn-diagram"> The drawing above is only a diagram and does not show this position.</span></span></div>
          :<div><strong>No live position</strong><span><span className="pn-diagram">The drawing is only a diagram. </span>Flightdeck does not guess where the aircraft is.</span></div>}</div>
        <div className="local-clocks"><ClockBlock airport={flight.origin} now={now}/><ClockBlock airport={flight.destination} now={now}/></div>
      </section>
    </div>
    <section className="panel fv-tabs">
      <div className="fv-tablist" role="tablist" aria-label="Flight details">{PANELS.map((p,i)=><button key={p.id} ref={el=>{tabRefs.current[i]=el}} role="tab" aria-label={p.label} id={'fv-t-'+p.id} aria-selected={panel===p.id} aria-controls="fv-panel" tabIndex={panel===p.id?0:-1} className={panel===p.id?'on':''} onClick={()=>setPanel(p.id)} onKeyDown={e=>onTabKey(e,i)}><p.icon size={15} aria-hidden="true"/><span className="tab-label" data-short={p.short}>{p.label}</span></button>)}</div>
      <div className="fv-body" id="fv-panel" role="tabpanel" tabIndex={0} aria-labelledby={'fv-t-'+panel}>
        {panel==='journey'&&<ol className="timeline">{steps.map((step,i)=><li className="timeline-row" key={step.key}><span className={step.done?'timeline-dot filled':'timeline-dot'}>{step.done?<Check size={10}/>:i+1}</span><div><strong>{step.label}</strong><small>{step.kind}</small><em className="step-note">{step.note}</em></div><span>{step.t?`${time(step.t,step.tz)}${step.tz?'':' UTC'}`:'—'}{step.t&&<small className="step-day">{day(step.t,step.tz)}</small>}</span></li>)}</ol>}
        {panel==='airport'&&<div className="fv-airport">
          <div className="gate-strip"><Detail label="Departure terminal" value={withHint(flight.terminalOut,flight.terminalOutHint)}/><Detail label="Departure gate" value={flight.gateOut}/><Detail label="Arrival terminal" value={withHint(flight.terminalIn,flight.terminalInHint)}/><Detail label="Arrival gate" value={flight.gateIn}/></div>
          <div className="fv-bags"><div className="baggage"><span>Baggage belt</span><strong>{flight.baggage||'Not assigned yet'}</strong><p>{flight.baggage?'Belts can change, so check the airport screens.':'No belt has been reported. Check the arrival screens after you land.'}</p></div><div className="mini-details"><Detail label="Aircraft type" value={flight.aircraft}/><Detail label="Registration" value={flight.registration}/></div></div>
          <a className="official-link" href={airlines[flight.number.slice(0,2)]||`https://www.google.com/search?q=${encodeURIComponent(flight.airline+' official flight status')}`} target="_blank" rel="noreferrer">{airlines[flight.number.slice(0,2)]?'Check the airline\'s flight status':'Find the airline\'s official status page'}<ArrowUpRight size={16}/></a>
        </div>}
        {panel==='weather'&&<Weather airport={flight.destination}/>}
        {panel==='updates'&&<div className="fv-updates"><label className="toggle"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>Check again every minute</label>
          <div aria-live="polite">{changes.length?changes.map((c,i)=><p key={i}><span className="dot"/>{c}</p>):<p className="muted-copy">{auto?'Watching for changes while this page is open.':'Switch on the minute check, or use the refresh button, to see changes here.'}</p>}</div>
          <small>{data.source}. Fetched {new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(data.fetchedAt))}{data.cached?`, kept for up to ${data.refreshSeconds} seconds`:''}. {data.mode==='live'?'Provider data can lag behind what is really happening.':''}</small>
          {data.sources?.includes('AeroDataBox')&&<small>Schedule data from <a href="https://aerodatabox.com/" target="_blank" rel="noreferrer">AeroDataBox</a>.</small>}
          {data.sources?.includes('OpenSky Network')&&<small>Live aircraft positions from <a href="https://opensky-network.org/" target="_blank" rel="noreferrer">The OpenSky Network</a>.</small>}
          {data.sources?.includes('adsbdb routes')&&<small>Routes from <a href="https://www.adsbdb.com/" target="_blank" rel="noreferrer">adsbdb</a>.</small>}</div>}
        {panel==='destination'&&<Destination airport={flight.destination}/>}
      </div>
    </section>
  </div>;
}
