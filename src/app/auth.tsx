import {useEffect,useRef} from 'react';
import {Show,SignInButton,SignUpButton,UserButton,useAuth,useUser} from '@clerk/react';
import {setTokenGetter} from '../shared/api';
import {getOwner as checklistOwner,clearLocal as clearChecklist} from '../features/checklist/checklistStore';
import {LAST_KEY,cleanSaved,sameItem,type SavedItem} from './savedFlights';

// Clerk glue for the app: hands the session token to API calls, shows the account controls, keeps saved flights in the user's
// profile, and clears an account's data from a shared device after sign-out.
export function TokenBridge(){const {getToken}=useAuth();useEffect(()=>{setTokenGetter(()=>getToken());return()=>setTokenGetter(null)},[getToken]);return null}
export function SignedInName(){const {user}=useUser();const name=user?.firstName||user?.fullName||user?.username||user?.primaryEmailAddress?.emailAddress?.split('@')[0]||'';return name?<span className="user-name" title={user?.primaryEmailAddress?.emailAddress||name}>{name}</span>:null}
export function AuthBar(){return <div className="auth-bar"><Show when="signed-out"><SignInButton mode="modal"><button className="btn btn-secondary">Sign in</button></SignInButton><SignUpButton mode="modal"><button className="btn btn-primary">Create account</button></SignUpButton></Show><Show when="signed-in"><SignedInName/><UserButton/></Show></div>}
// Keeps the saved-flights list in the signed-in user's Clerk profile (unsafeMetadata, editable only by that user) so it follows them across devices.
export function SavedSync({saved,setSaved,setSignedIn,setUserId}:{saved:SavedItem[];setSaved:(v:SavedItem[])=>void;setSignedIn:(v:boolean)=>void;setUserId:(v:string|null)=>void}){
 const {isLoaded,isSignedIn,user}=useUser();const hydrated=useRef<string|null>(null);
 const owner=(v?:string)=>{try{if(v===undefined)return localStorage.getItem('flightdeck-saved-owner');if(v)localStorage.setItem('flightdeck-saved-owner',v);else localStorage.removeItem('flightdeck-saved-owner')}catch{}return null};
 useEffect(()=>{if(!isLoaded)return;setSignedIn(!!isSignedIn);setUserId(user?.id??null);
  // Signed out (including after the page reload that signing out causes) while this device still holds an account's list: wipe it, so the next person on a shared device does not see it.
  if(!isSignedIn||!user){hydrated.current=null;if(owner()){setSaved([]);owner('')}return}
  if(hydrated.current===user.id)return;hydrated.current=user.id;
  const cloud=cleanSaved(user.unsafeMetadata?.savedFlights);const mine=owner()===user.id||!owner()?saved:[];const merged=[...cloud,...mine.filter(l=>!cloud.some(c=>sameItem(c,l)))].slice(0,12);owner(user.id);setSaved(merged)},[isLoaded,isSignedIn,user?.id]);
 useEffect(()=>{if(!isLoaded||!isSignedIn||!user||hydrated.current!==user.id)return;const cloud=cleanSaved(user.unsafeMetadata?.savedFlights);
  if(JSON.stringify(cloud)===JSON.stringify(saved))return;const t=setTimeout(()=>{user.update({unsafeMetadata:{...user.unsafeMetadata,savedFlights:saved}}).catch(()=>{})},600);return()=>clearTimeout(t)},[saved,isLoaded,isSignedIn,user?.id]);
 return null}
export // Signing out reloads onto the landing page, where the dashboard (and its own clean-up) is not mounted. Anything an account left on this
// device is wiped here so the next person on a shared computer does not see it. A guest's own list (no owner mark) is left alone.
function SignedOutCleanup(){useEffect(()=>{try{if(localStorage.getItem('flightdeck-saved-owner')){localStorage.removeItem('flightdeck-saved');localStorage.removeItem('flightdeck-saved-owner')}}catch{}try{localStorage.removeItem(LAST_KEY)}catch{}if(checklistOwner())clearChecklist()},[]);return null}
