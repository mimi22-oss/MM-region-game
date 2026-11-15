import {useHorrorMix,setHorrorMix} from '../game/horrorMix';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ENVIRONMENT_STORAGE_KEY,TIME_PERIODS,environmentMinute,periodAtMinute,savedEnvironmentPreferences,type EnvironmentPreferences,type TimeMode} from '../game/environmentTime';
import {FestivalSettings} from '../festivals/FestivalSettings';
import {
 isGhostDevUiAvailable,
 setGhostDevForceActive,
 useGhostDevSettings,
} from '../game/ghostConfig';

export function useEnvironmentTime(){
 const [preferences,setPreferences]=useState(savedEnvironmentPreferences);
 const [now,setNow]=useState(()=>new Date());
 const modeRef=useRef(preferences.mode);
 modeRef.current=preferences.mode;
 useEffect(()=>{
  const refresh=()=>setNow(new Date());
  const timer=setInterval(()=>{if(!document.hidden&&modeRef.current==='auto')refresh();},15000);
  window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return ()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 useEffect(()=>{try{localStorage.setItem(ENVIRONMENT_STORAGE_KEY,JSON.stringify(preferences));}catch{}},[preferences]);
 const choose=useCallback((mode:TimeMode)=>{setNow(new Date());setPreferences(p=>({...p,mode}));},[]);
 const cycle=useCallback(()=>{setNow(new Date());setPreferences(p=>{
  const current=periodAtMinute(environmentMinute(p.mode));
  return {...p,mode:TIME_PERIODS[(TIME_PERIODS.findIndex(t=>t.id===current)+1)%4].id};
 });},[]);
 const minute=environmentMinute(preferences.mode,now),period=periodAtMinute(minute);
 return {preferences,setPreferences,choose,cycle,now,minute,period};
}
export function EnvironmentSettings({value,onChange,onChoose,now,period}:{
 value:EnvironmentPreferences;onChange:(value:EnvironmentPreferences)=>void;onChoose:(mode:TimeMode)=>void;
 now:Date;period:ReturnType<typeof periodAtMinute>;
}){
 const mix=useHorrorMix();
 const current=TIME_PERIODS.find(p=>p.id===period)!;
 const ghostDev=useGhostDevSettings();
 const showGhostDev=isGhostDevUiAvailable();
 return <section className="time-controls environment-settings" aria-label="အချိန်နှင့် ပတ်ဝန်းကျင်">
  <div className="time-header"><span className="time-title">အချိန်နှင့် ပတ်ဝန်းကျင်</span><span className="time-status-pill">{current.icon} {current.label}</span></div>
  <button type="button" className={`time-btn${value.mode==='auto'?' time-btn-active':''}`} aria-pressed={value.mode==='auto'} onClick={()=>onChoose('auto')}>🕒 Auto · Device Local Time</button>
  <p className="environment-clock">{now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · {Intl.DateTimeFormat().resolvedOptions().timeZone}<br/>Device နာရီအတိုင်း ပြောင်းမည်။ အောက်တွင်ရွေးလျှင် Manual ဖြစ်မည်။</p>
  <div className="environment-periods">{TIME_PERIODS.map(p=><button key={p.id} type="button" data-period={p.id} className={`time-btn${value.mode===p.id?' time-btn-active':''}`} aria-pressed={value.mode===p.id} onClick={()=>onChoose(p.id)}><span>{p.icon} {p.label}</span><small>{p.range}</small></button>)}</div>
  <label className="environment-sound"><input type="checkbox" checked={value.sound} onChange={e=>onChange({...value,sound:e.target.checked})}/> ပတ်ဝန်းကျင်အသံ</label>
  <label className="environment-volume">အသံအတိုးအကျယ် Master <output>{Math.round(value.volume*100)}%</output><input aria-label="ပတ်ဝန်းကျင်အသံ အတိုးအကျယ်" type="range" min="0" max="100" step="5" value={Math.round(value.volume*100)} onChange={e=>onChange({...value,volume:Number(e.target.value)/100})}/></label>
  {(['ghost','ambience'] as const).map(channel=><label key={channel} className="environment-volume">{channel==='ghost'?'Ghost':'Ambience'} <output>{Math.round(mix[channel]*100)}%</output><input aria-label={`${channel} volume`} type="range" min="0" max="100" step="5" value={Math.round(mix[channel]*100)} onChange={e=>setHorrorMix(channel,Number(e.target.value)/100)}/></label>)}
  <FestivalSettings now={now}/>
  {showGhostDev && (
   <label className="environment-sound" style={{ marginTop: '6px' }}>
    <input
     type="checkbox"
     checked={ghostDev.forceActive}
     onChange={e => setGhostDevForceActive(e.target.checked)}
    />{' '}
    Dev · ညသရဲ စမ်းသပ်ရန် (Warehouse)
   </label>
  )}
  <small style={{ display: 'block', marginTop: '6px' }}>ဂိမ်းထဲကို နှိပ်ပြီးနောက် အသံစပါမည်။ N နှိပ်၍ Manual အချိန်ပြောင်းနိုင်သည်။</small>
 </section>;
}
