import {useEffect,useRef} from 'react';
import {gameAudio} from '../game/gameAudio';
import {useHorrorMix} from '../game/horrorMix';
import {AmbientAudio} from '../game/ambientAudio';
import type {TimePeriod} from '../game/environmentTime';
import { acquireSharedHorrorMixer, releaseSharedHorrorMixer } from '../game/audio/HorrorAudioMixer';
import { setAudioSettingsDiagnostics, notifyHorrorAudioDiagnosticsChanged } from '../game/audio/horrorAudioDiagnostics';

export function EnvironmentAudio({period,volume,enabled,active}:{period:TimePeriod;volume:number;enabled:boolean;active:boolean}){
 const mix=useHorrorMix();
 const engine=useRef<AmbientAudio|null>(null),mixerRef=useRef<ReturnType<typeof acquireSharedHorrorMixer>|null>(null),settings=useRef({period,volume,enabled,active});
 settings.current={period,volume,enabled,active};
 useEffect(()=>{
  const detach=gameAudio.attach();
  mixerRef.current=acquireSharedHorrorMixer();
  const detachResume=gameAudio.onResume(()=>{
   const value=settings.current;
   if(engine.current&&value.enabled&&value.active&&!document.hidden){
    void engine.current.configure(value.period,1,true);
   }
   notifyHorrorAudioDiagnosticsChanged();
  });
  const activate=(event:Event)=>{
   if(!event.isTrusted)return;
   gameAudio.unlock();
   const value=settings.current;
   if(!value.enabled||!value.active||document.hidden||!gameAudio.context)return;
   try{engine.current??=new AmbientAudio();void engine.current.configure(value.period,1,true);}catch{/* Audio may be unavailable; the game remains playable. */}
   notifyHorrorAudioDiagnosticsChanged();
  };
  document.addEventListener('pointerdown',activate,{passive:true});document.addEventListener('pointerup',activate,{passive:true});document.addEventListener('touchend',activate,{passive:true});document.addEventListener('click',activate,{passive:true});document.addEventListener('keydown',activate,{passive:true});
  return ()=>{detach();detachResume();mixerRef.current=null;releaseSharedHorrorMixer();document.removeEventListener('pointerdown',activate);document.removeEventListener('pointerup',activate);document.removeEventListener('touchend',activate);document.removeEventListener('click',activate);document.removeEventListener('keydown',activate);engine.current?.dispose();engine.current=null;};
 },[]);
 useEffect(()=>{
  const isAudioEnabled=enabled&&volume>0;
  setAudioSettingsDiagnostics(enabled,volume);
  mixerRef.current?.setMuted(!isAudioEnabled);
  gameAudio.setLevels({master:volume,...mix});
  gameAudio.setActive(isAudioEnabled&&active);
  if(isAudioEnabled&&active&&!document.hidden&&gameAudio.context&&!engine.current){
   try{engine.current=new AmbientAudio();}catch{}
  }
  void engine.current?.configure(period,1,isAudioEnabled&&active&&!document.hidden);
  notifyHorrorAudioDiagnosticsChanged();
 },[period,volume,enabled,active,mix]);
 return null;
}
