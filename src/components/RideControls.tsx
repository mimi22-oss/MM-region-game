import type { RideStatus } from '../game/motorcycleRide';
export function RideControls({status,limit,onLimit,onBrake,onDismount}:{status:RideStatus;limit:number;onLimit:(n:number)=>void;onBrake:(b:boolean)=>void;onDismount:()=>void}){
 if(!status.riding&&!status.near)return null;
 return <section className="ride-controls" aria-label="ဆိုင်ကယ် မောင်းနှင်မှု" onPointerDown={e=>e.stopPropagation()}>
  {!status.riding?<p role="status">ဆိုင်ကယ်နား ရပ်လိုက်လျှင် တက်စီးပါမည်…</p>:<>
   <div className="ride-heading"><strong>{status.kmh<0?'နောက်ဆုတ် · R':'ဆိုင်ကယ်'}</strong><output aria-label="လက်ရှိအရှိန်">{Math.abs(status.kmh)} <small>km/h</small></output></div>
   <label htmlFor="ride-speed">အမြင့်ဆုံးအရှိန် <b>{limit} km/h</b></label>
   <input id="ride-speed" type="range" min="5" max="40" step="5" value={limit} onChange={e=>onLimit(Number(e.target.value))}/>
   <div className="ride-buttons">
    <button type="button" className="ride-brake" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);onBrake(true)}} onPointerUp={()=>onBrake(false)} onPointerCancel={()=>onBrake(false)} onLostPointerCapture={()=>onBrake(false)} onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter')onBrake(true)}} onKeyUp={()=>onBrake(false)} onBlur={()=>onBrake(false)}>ဘရိတ်</button>
    <button type="button" onClick={onDismount}>ဆိုင်ကယ်မှဆင်းရန်</button>
   </div>
   <p>W / ↑ မောင်း · S / ↓ အရှိန်လျှော့ / နောက်ဆုတ်<br/>A D / ← → ကွေ့ · Mobile: အောက်ဆွဲလျှင် နောက်ဆုတ်</p>
   {status.notice&&<p role="status">{status.notice}</p>}
  </>}
 </section>;
}
