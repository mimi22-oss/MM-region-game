import { useRef,useState } from 'react';
import { robotLocation,locationCopyText } from '../game/robotLocation';
export function RobotLocationPanel({x,z,yaw}:{x:number;z:number;yaw:number}){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState(''),field=useRef<HTMLTextAreaElement>(null);
 const p=robotLocation(x,z,yaw),text=locationCopyText(x,z,yaw);
 const copy=async()=>{
  try {if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(text);setNotice('Copied');}
  catch {field.current?.focus();field.current?.select();let copied=false;try{copied=document.execCommand('copy')}catch{}setNotice(copied?'Copied':'Select the text below and copy it manually.');}
 };
 return <div className="robot-location-panel">
  <button type="button" className="robot-location-toggle" aria-expanded={open} aria-controls="robot-location-details" onClick={()=>{setOpen(v=>!v);setNotice('')}}>Robot တည်နေရာနှင့် အရပ်မျက်နှာ {open?'-':'+'}</button>
  {open&&<div id="robot-location-details">
   <strong>{p.place.subArea??p.place.label}</strong>
   <dl><dt>Latitude (approx)</dt><dd>{p.latitude.toFixed(7)}</dd><dt>Longitude (approx)</dt><dd>{p.longitude.toFixed(7)}</dd><dt>Robot facing</dt><dd>{p.direction} / {p.bearing.toFixed(1)}&deg;</dd><dt>Scene X / Z (m)</dt><dd>{p.x.toFixed(3)} / {p.z.toFixed(3)}</dd><dt>Local U / V (m)</dt><dd>{p.u.toFixed(3)} / {p.v.toFixed(3)}</dd></dl>
   <p>Robot ရောက်နေသည့် တည်နေရာဖြစ်ပါသည်။ နေရာအတိအကျ ပြင်ဆင်ရန် X/Z သို့မဟုတ် U/V ကို copy ကူးပေးပါ။ Latitude/longitude မှာ ခန့်မှန်းတန်ဖိုးများ ဖြစ်ပါသည်။</p>
   <button type="button" className="robot-copy" onClick={copy}>Copy location + direction</button>
   <span role="status">{notice}</span>
   <textarea ref={field} readOnly value={text} aria-label="Robot coordinates to copy" rows={5} onFocus={e=>e.currentTarget.select()}/>
  </div>}
 </div>;
}
