import { useRef,useState } from 'react';
import { robotLocation,locationCopyText } from '../game/robotLocation';
const BURMESE_DIRECTIONS: Record<string, string> = {'North':'မြောက်','North-East':'အရှေ့မြောက်','East':'အရှေ့','South-East':'အရှေ့တောင်','South':'တောင်','South-West':'အနောက်တောင်','West':'အနောက်','North-West':'အနောက်မြောက်'};
export function RobotLocationPanel({x,z,yaw,characterLabel='ရိုဘော့'}:{x:number;z:number;yaw:number;characterLabel?:string}){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState(''),field=useRef<HTMLTextAreaElement>(null);
 const p=robotLocation(x,z,yaw),text=locationCopyText(x,z,yaw).replaceAll('Robot',characterLabel);
 const copy=async()=>{
  try {if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');await navigator.clipboard.writeText(text);setNotice('ကူးယူပြီးပါပြီ');}
  catch {field.current?.focus();field.current?.select();let copied=false;try{copied=document.execCommand('copy')}catch{}setNotice(copied?'ကူးယူပြီးပါပြီ':'အောက်ပါ စာသားများကို ရွေးချယ်ပြီး မိမိကိုယ်တိုင် ကူးယူပါ။');}
 };
 return <div className="robot-location-panel">
  <button type="button" className="robot-location-toggle" aria-expanded={open} aria-controls="robot-location-details" onClick={()=>{setOpen(v=>!v);setNotice('')}}>{characterLabel} တည်နေရာနှင့် အရပ်မျက်နှာ {open?'-':'+'}</button>
  {open&&<div id="robot-location-details">
   <strong>{p.place.subArea??p.place.label}</strong>
   <dl><dt>လတ္တီတွဒ် (ခန့်မှန်း)</dt><dd>{p.latitude.toFixed(7)}</dd><dt>လောင်ဂျီတွဒ် (ခန့်မှန်း)</dt><dd>{p.longitude.toFixed(7)}</dd><dt>မျက်နှာမူရာအရပ်</dt><dd>{BURMESE_DIRECTIONS[p.direction] ?? p.direction} / {p.bearing.toFixed(1)}&deg;</dd><dt>Scene X / Z (မီတာ)</dt><dd>{p.x.toFixed(3)} / {p.z.toFixed(3)}</dd><dt>Local U / V (မီတာ)</dt><dd>{p.u.toFixed(3)} / {p.v.toFixed(3)}</dd></dl>
   <p>{characterLabel} ရောက်နေသည့် တည်နေရာဖြစ်ပါသည်။ နေရာအတိအကျ ပြင်ဆင်ရန် X/Z သို့မဟုတ် U/V ကို copy ကူးပေးပါ။ Latitude/longitude မှာ ခန့်မှန်းတန်ဖိုးများ ဖြစ်ပါသည်။</p>
   <button type="button" className="robot-copy" onClick={copy}>တည်နေရာနှင့် မျက်နှာမူရာကို ကူးယူမည်</button>
   <span role="status">{notice}</span>
   <textarea ref={field} readOnly value={text} aria-label="ကူးယူရန် ဇာတ်ကောင် တည်နေရာ အချက်အလက်များ" rows={5} onFocus={e=>e.currentTarget.select()}/>
  </div>}
 </div>;
}
