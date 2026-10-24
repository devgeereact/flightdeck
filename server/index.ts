import 'dotenv/config';
import express from 'express';
import {demoFlight,matchStates,normalizeNumber,stateToFlight,validSearch} from './flight.ts';
import type {FlightResponse} from '../src/types.ts';
const app=express();app.disable('x-powered-by');
const weatherCache=new Map<string,{expires:number;data:any}>();
const rate=new Map<string,{count:number;reset:number}>();
app.use('/api',(req,res,next)=>{const now=Date.now(),key=req.ip||'local';let r=rate.get(key);if(!r||r.reset<now){r={count:0,reset:now+60000};rate.set(key,r)}if(++r.count>30){res.status(429).json({error:'Too many requests. Please wait a minute.'});return}next()});
const credentials=()=>({id:process.env.OPENSKY_CLIENT_ID||process.env.clientId,secret:process.env.OPENSKY_CLIENT_SECRET||process.env.clientSecret});
const configured=()=>{const c=credentials();return !!(c.id&&c.secret)};
class OpenSkyError extends Error{}
let token:{value:string;expires:number}|null=null;
async function openskyToken(){if(token&&token.expires>Date.now())return token.value;const c=credentials();const r=await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:c.id!,client_secret:c.secret!}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new OpenSkyError('OpenSky rejected the API credentials.');const d=await r.json() as {access_token?:string;expires_in?:number};if(!d.access_token)throw new OpenSkyError('OpenSky rejected the API credentials.');token={value:d.access_token,expires:Date.now()+Math.max(0,(d.expires_in??300)-30)*1000};return token.value}
// One global state snapshot costs OpenSky credits, so share it across searches for SNAPSHOT_MS.
const SNAPSHOT_MS=120000;
let snapshot:{expires:number;fetchedAt:number;states:unknown[]}|null=null,inflight:Promise<{expires:number;fetchedAt:number;states:unknown[]}>|null=null;
async function loadSnapshot(){const r=await fetch('https://opensky-network.org/api/states/all',{headers:{authorization:`Bearer ${await openskyToken()}`},signal:AbortSignal.timeout(20000)});if(r.status===401){token=null;throw new OpenSkyError('OpenSky rejected the API credentials.')}if(r.status===429)throw new OpenSkyError('OpenSky credit limit reached. Try again later.');if(!r.ok)throw new OpenSkyError('OpenSky is temporarily unavailable.');const d=await r.json() as {states?:unknown[]|null};const now=Date.now();return {expires:now+SNAPSHOT_MS,fetchedAt:now,states:Array.isArray(d.states)?d.states:[]}}
async function openskyStates(){if(snapshot&&snapshot.expires>Date.now())return {...snapshot,cached:true};inflight??=loadSnapshot().finally(()=>{inflight=null});snapshot=await inflight;return {...snapshot,cached:false}}
app.get('/api/config',(_req,res)=>res.json({liveAvailable:configured(),provider:'OpenSky Network'}));
app.get('/api/flights',async(req,res)=>{
 const number=normalizeNumber(String(req.query.number||'')),date=String(req.query.date||''),demo=req.query.mode==='demo';
 if(!validSearch(number,date)){res.status(400).json({error:'Enter a flight number such as BA117 and a valid departure date.'});return}
 if(demo){const flight=demoFlight(number,date);res.json({mode:'demo',flights:flight?[flight]:[],fetchedAt:new Date().toISOString(),cached:false,source:'Illustrative sample — not an operational flight',refreshSeconds:60});return}
 if(!configured()){res.status(503).json({error:'Live flights need OpenSky API credentials on the server. Sample mode is available now.'});return}
 try{
  // OpenSky reports live positions only: match by callsign; the selected date is not used to filter.
  const {states,cached,fetchedAt}=await openskyStates();
  const flights=matchStates(states,number).slice(0,20).map(s=>stateToFlight(s,number));
  const data:FlightResponse={mode:'live',flights,fetchedAt:new Date(fetchedAt).toISOString(),cached,source:'OpenSky Network — live aircraft position only; the date is not used',refreshSeconds:SNAPSHOT_MS/1000};
  res.json(data);
 }catch(e){res.status(502).json({error:e instanceof OpenSkyError?e.message:'Unable to retrieve flight data.'})}
});
app.get('/api/weather',async(req,res)=>{const lat=Number(req.query.lat),lon=Number(req.query.lon);if(!req.query.lat||!req.query.lon||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){res.status(400).json({error:'Valid airport coordinates are required.'});return}const key=`${lat.toFixed(2)},${lon.toFixed(2)}`;const hit=weatherCache.get(key);if(hit&&hit.expires>Date.now()){res.json(hit.data);return}try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const d=await r.json();if(!d.current)throw Error();const data={...d.current,timezone:d.timezone,source:'Open-Meteo',fetchedAt:new Date().toISOString()};if(weatherCache.size>500)weatherCache.clear();weatherCache.set(key,{expires:Date.now()+600000,data});res.json(data)}catch{res.status(502).json({error:'Weather is temporarily unavailable.'})}});
app.use(express.static('dist'));
app.get('/{*path}',(req,res)=>{if(req.path.startsWith('/api/')){res.status(404).json({error:'Unknown endpoint'});return}res.sendFile('index.html',{root:'dist'})});
const server=app.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log('Flightdeck API: http://127.0.0.1:'+String(process.env.PORT||3001)));
process.on('SIGTERM',()=>server.close());
