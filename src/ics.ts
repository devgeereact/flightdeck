// A calendar file (.ics) for one flight. Times are written in UTC, so every calendar app shows them in the reader's own time zone.
import type {Flight} from './types';

const stamp=(iso:string)=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
// RFC 5545 text: escape backslash, semicolon, comma and line breaks.
const text=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
// Lines longer than 75 octets are folded with CRLF + space.
const fold=(line:string)=>{const out:string[]=[];let rest=line;while(rest.length>73){out.push(rest.slice(0,73));rest=' '+rest.slice(73)}out.push(rest);return out.join('\r\n')};

/** null when the departure or arrival time is not known: a calendar entry with a guessed time would mislead. */
export function flightIcs(f:Flight,link:string,nowMs=Date.now()):string|null{
  const dep=f.estimatedOut??f.scheduledOut,arr=f.estimatedIn??f.scheduledIn;
  if(!dep||!arr||f.cancelled||f.usualRouteOnly)return null;
  const place=(a:Flight['origin'])=>`${a.city||a.name} (${a.code})`;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Flightdeck//Flight//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${f.number}-${dep.slice(0,10)}@flightdeck.gakinz.com`,`DTSTAMP:${stamp(new Date(nowMs).toISOString())}`,`DTSTART:${stamp(dep)}`,`DTEND:${stamp(arr)}`,
    `SUMMARY:${text(`${f.number} ${place(f.origin)} to ${place(f.destination)}`)}`,
    `LOCATION:${text(f.origin.name||f.origin.code)}`,
    `DESCRIPTION:${text(`${f.airline} ${f.number}. Times as reported when you saved this${f.terminalOut?`; departure terminal ${f.terminalOut}`:''}. Times and gates can change, so check the airline and the airport screens. ${link}`)}`,
    `URL:${link}`,'END:VEVENT','END:VCALENDAR'];
  return lines.map(fold).join('\r\n')+'\r\n';
}
