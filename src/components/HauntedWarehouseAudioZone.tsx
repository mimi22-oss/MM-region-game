import {homeBoundaryDistance} from '../game/playerHomeProtection';
import { useEffect,useMemo,useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion,Vector3,type Object3D } from 'three';
import { area5 } from '../data/wards/myothar/area5.ts';
import { sourceIsEdited } from '../game/worldEdits.ts';
import { GHOST_WAREHOUSE_ANCHOR,isGhostNightActive,useGhostDevSettings } from '../game/ghostConfig.ts';
import type { TimeMode } from '../game/environmentTime.ts';
import { gameAudio } from '../game/gameAudio.ts';
import { GhostAudioEventScheduler,hauntedGain,DEFAULT_HAUNTED_ZONE_CONFIG,type HauntedZoneConfig } from '../game/audio/GhostAudioEventScheduler.ts';
import { warehouseSoundOrigins,warehouseZoneDistance } from '../game/audio/warehouseSoundOrigins.ts';
import { GhostSpatialAudioController } from '../game/audio/GhostSpatialAudioController.ts';

export interface HauntedWarehouseAudioZoneProps {
 enabled:boolean;minute:number;timeMode:TimeMode;soundEnabled:boolean;
 seed?:number;config?:HauntedZoneConfig;occlusion?:boolean;onDiagnostics?:(value:{sources:number;nodes:number;disposed:boolean;band:string})=>void;
}
/** Always available before the ghost GLB is visible/loaded. No per-frame React state writes. */
export function HauntedWarehouseAudioZone({enabled,minute,timeMode,soundEnabled,seed=3514936176,config=DEFAULT_HAUNTED_ZONE_CONFIG,occlusion=false,onDiagnostics}:HauntedWarehouseAudioZoneProps){
 const dev=useGhostDevSettings();
 const active=enabled&&soundEnabled&&isGhostNightActive(minute,{timeMode,forceActive:dev.forceActive});
 const scheduler=useMemo(()=>new GhostAudioEventScheduler(seed,config),[seed,config]);
 const spatial=useRef<GhostSpatialAudioController|null>(null);
 const scratch=useMemo(()=>({position:new Vector3(),forward:new Vector3(),up:new Vector3(),rotation:new Quaternion(),player:new Vector3()}),[]);
 const player=useRef<Object3D|null>(null),elapsed=useRef(0),bedActive=useRef(false);
 useEffect(()=>{
  const detach=gameAudio.attach();
  const buildings=area5.warehouses.filter(w=>!sourceIsEdited(w.id));
  spatial.current=new GhostSpatialAudioController(warehouseSoundOrigins(buildings,area5.trees,GHOST_WAREHOUSE_ANCHOR,sourceIsEdited),buildings,occlusion,id=>!sourceIsEdited(id));
  return()=>{spatial.current?.dispose();spatial.current=null;detach();};
 },[occlusion]);
 useFrame(({camera,scene},dt)=>{
  const controller=spatial.current;if(!controller)return;
  // Camera listener is independent of lazy ghost asset loading.
  camera.getWorldPosition(scratch.position);camera.getWorldQuaternion(scratch.rotation);
  scratch.forward.set(0,0,-1).applyQuaternion(scratch.rotation);scratch.up.set(0,1,0).applyQuaternion(scratch.rotation);
  controller.listener(scratch.position.x,scratch.position.y,scratch.position.z,scratch.forward.x,scratch.forward.y,scratch.forward.z,scratch.up.x,scratch.up.y,scratch.up.z);
  elapsed.current+=Math.min(dt,.25);
  if(elapsed.current<.1)return;
  const step=elapsed.current;elapsed.current=0;
  if(!player.current?.parent)player.current=scene.getObjectByName('player-avatar')??null;
  if(player.current)player.current.getWorldPosition(scratch.player);else scratch.player.copy(scratch.position);
  const distance=warehouseZoneDistance(scratch.player.x,scratch.player.z,GHOST_WAREHOUSE_ANCHOR,controller.buildings);
  const running=active&&!document.hidden&&gameAudio.context?.state==='running';
  controller.update(scratch.position.x,scratch.position.y,scratch.position.z,distance,running&&distance<=config.distances[0]+config.hysteresis,config.distances[0]);
  if(!running||distance>config.distances[0]+config.hysteresis)bedActive.current=false;
  else if(distance<=config.distances[0])bedActive.current=true;
  const homeDist=homeBoundaryDistance(scratch.player.x,scratch.player.z);
  const homeIntensity=homeDist<=0?0:Math.max(.1,Math.min(1,homeDist/20));
  controller.updateBed(running&&bedActive.current&&homeIntensity>0,(.1+.9*hauntedGain(distance,config.distances[0]))*homeIntensity,step);
  const event=scheduler.tick(step,distance,running&&homeIntensity>0,controller.voices,controller.encounterBusy);
  if(event){const origin=scheduler.chooseOrigin(controller.origins.filter(p=>p.kind===event.kind&&!sourceIsEdited(p.sourceId)&&Math.hypot(p.x-scratch.player.x,p.z-scratch.player.z)<=65));
   if(origin)controller.play(origin,event.preset,hauntedGain(distance,config.distances[0])*homeIntensity*(controller.encounterBusy?.4:1),scheduler.variation());
  }
  onDiagnostics?.({...controller.bedDiagnostics,band:scheduler.band});
 });
 useEffect(()=>{if(!active){spatial.current?.stop();spatial.current?.updateBed(false,0,0);bedActive.current=false;}},[active]);
 return null;
}
