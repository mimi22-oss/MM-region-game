import {useEffect,useRef} from 'react';
import {gameAudio} from '../game/gameAudio';
import {useHorrorMix} from '../game/horrorMix';
import {AmbientAudio} from '../game/ambientAudio';
import type {TimePeriod} from '../game/environmentTime';

export function EnvironmentAudio({period,volume,enabled,active}:{period:TimePeriod;volume:number;enabled:boolean;active:boolean}){
 const mix=useHorrorMix();
 const engine=useRef<AmbientAudio|null>(null),settings=useRef({period,volume,enabled,active});
 settings.current={period,volume,enabled,active};
 useEffect(()=>{
  const detach=gameAudio.attach();
  const activate=(event:Event)=>{
   if(!event.isTrusted)return;
   gameAudio.unlock();
   const value=settings.current;
   if(!value.enabled||!value.active||document.hidden||!gameAudio.context)return;
   try{engine.current??=new AmbientAudio();void engine.current.configure(value.period,1,true);}catch{/* Audio may be unavailable; the game remains playable. */}
  };
  document.addEventListener('pointerdown',activate);document.addEventListener('pointerup',activate);document.addEventListener('keydown',activate);
  return ()=>{detach();document.removeEventListener('pointerdown',activate);document.removeEventListener('pointerup',activate);document.removeEventListener('keydown',activate);engine.current?.dispose();engine.current=null;};
 },[]);
 useEffect(()=>{gameAudio.setLevels({master:volume,...mix});gameAudio.setActive(enabled&&active);void engine.current?.configure(period,1,enabled&&active&&!document.hidden);},[period,volume,enabled,active,mix]);
 return null;
}
