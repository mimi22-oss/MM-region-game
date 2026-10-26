import {useEffect,useRef} from 'react';
import {AmbientAudio} from '../game/ambientAudio';
import type {TimePeriod} from '../game/environmentTime';

export function EnvironmentAudio({period,volume,enabled,active}:{period:TimePeriod;volume:number;enabled:boolean;active:boolean}){
 const engine=useRef<AmbientAudio|null>(null),settings=useRef({period,volume,enabled,active});
 settings.current={period,volume,enabled,active};
 useEffect(()=>{
  const activate=()=>{
   const value=settings.current;
   if(!value.enabled||!value.active||document.hidden||typeof AudioContext==='undefined')return;
   try{engine.current??=new AmbientAudio();void engine.current.configure(value.period,value.volume,true);}catch{/* Audio may be unavailable; the game remains playable. */}
  };
  document.addEventListener('pointerdown',activate);document.addEventListener('pointerup',activate);document.addEventListener('keydown',activate);
  return ()=>{document.removeEventListener('pointerdown',activate);document.removeEventListener('pointerup',activate);document.removeEventListener('keydown',activate);engine.current?.dispose();engine.current=null;};
 },[]);
 useEffect(()=>{void engine.current?.configure(period,volume,enabled&&active&&!document.hidden);},[period,volume,enabled,active]);
 return null;
}
