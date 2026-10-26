import {useEffect,useState} from 'react';
import {balloonInput,clearBalloonInput,type BalloonStatus} from '../game/balloonRide';
export function BalloonControls({status,paused,onTopView,onZoom}:{status:BalloonStatus;paused:boolean;onTopView:()=>void;onZoom:(direction:number)=>void}){
 const [vertical,setVertical]=useState(balloonInput.verticalJoystick);
 useEffect(()=>{clearBalloonInput();return clearBalloonInput;},[paused,status.riding]);
 useEffect(()=>{const clear=()=>clearBalloonInput();window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};},[]);
 if(paused||!status.riding)return null;
 return <section className="balloon-controls" aria-label="Balloon မောင်းနှင်မှု" onPointerDown={e=>e.stopPropagation()}>
  <strong>Balloon • အမြင့် {status.altitude} m</strong>
  <span>{status.kmh} km/h · {status.grounded?'မြေပြင်ပေါ်':'လေထဲတွင်'}</span>
  <small>↑ / ↓ အတက်အဆင်း · W A S D / ← → ရွှေ့<br/>Space ရပ် · Shift အရှိန် · V မြင်ကွင်း</small>
  <div className="balloon-buttons">
   {[1,-1].map(lift=><button key={lift} type="button" aria-label={lift>0?'Balloon အပေါ်တက်':'Balloon အောက်ဆင်း'}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);balloonInput.lift=lift;}}
    onPointerUp={()=>{balloonInput.lift=0;}} onPointerCancel={()=>{balloonInput.lift=0;}} onLostPointerCapture={()=>{balloonInput.lift=0;}}
    onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();balloonInput.lift=lift;}}}
    onKeyUp={()=>{balloonInput.lift=0;}} onBlur={()=>{balloonInput.lift=0;}}>{lift>0?'↑ တက်':'↓ ဆင်း'}</button>)}
   <button type="button" onClick={()=>{const next=!vertical;setVertical(next);balloonInput.verticalJoystick=next;balloonInput.lift=0;}} aria-pressed={vertical}>Joystick: {vertical?'အတက်အဆင်း':'နေရာရွှေ့'}</button>
  </div>
  <div className="balloon-buttons"><button type="button" onClick={()=>{balloonInput.toggleView=true;}}>အတွင်း/အပြင်</button><button type="button" onClick={onTopView}>အပေါ်မှကြည့်</button><button type="button" onClick={()=>onZoom(-1)}>− အနီး</button><button type="button" onClick={()=>onZoom(1)}>+ အဝေး</button></div>
  {status.blocked&&<small>ရှေ့တွင် အတားအဆီးရှိသည် — အမြင့်တင်ပြီး ကျော်ပါ။</small>}
  <button type="button" disabled={!status.grounded||status.kmh>2} onClick={()=>{balloonInput.exit=true;}}>Balloon မှဆင်းမည် (E)</button>
  {!status.grounded&&<small>မြေပြင်လွတ်ကို ရွေးပြီး ဖြည်းဖြည်းဆင်းပါ။</small>}
 </section>;
}
