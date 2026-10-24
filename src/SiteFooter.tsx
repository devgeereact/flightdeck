import {Plane} from 'lucide-react';
import {FOOTER_GROUPS,FOOTER_BLURB,FOOTER_NOTE} from './siteNav';
import './siteFooter.css';

// `inApp`: inside the signed-in app the tracker and packing list point at the app's own screens; everywhere else they use public addresses.
export default function SiteFooter({inApp=false}:{inApp?:boolean}){
 const year=new Date().getFullYear();
 return <footer className="sf" aria-label="Site">
  <div className="sf-top">
   <div className="sf-about">
    <a className="sf-brand" href={inApp?'#/':'/'}><span className="sf-mark" aria-hidden="true"><Plane size={16}/></span><span>flightdeck<span className="sf-dot">.</span></span></a>
    <p className="sf-blurb">{FOOTER_BLURB}</p>
   </div>
   <div className="sf-cols">
    {FOOTER_GROUPS.map(g=><nav className="sf-col" key={g.title} aria-label={g.title}>
     <h2>{g.title}</h2>
     <ul>{g.links.map(l=><li key={l.label}><a href={inApp&&l.appHref?l.appHref:l.href}>{l.label}</a></li>)}</ul>
    </nav>)}
   </div>
  </div>
  <div className="sf-base"><p>© {year} Flightdeck. All rights reserved.</p><p>{FOOTER_NOTE}</p></div>
 </footer>
}
