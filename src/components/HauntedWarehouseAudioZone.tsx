import {homeBoundaryDistance} from '../game/playerHomeProtection';
import { useEffect,useMemo,useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion,Vector3,type Object3D } from 'three';
import { area5 } from '../data/wards/myothar/area5.ts';
import { sourceIsEdited } from '../game/worldEdits.ts';
import { GHOST_WAREHOUSE_ANCHOR,isGhostNightActive,useGhostDevSettings } from '../game/ghostConfig.ts';
import { periodAtMinute, type TimeMode } from '../game/environmentTime.ts';
import { gameAudio } from '../game/gameAudio.ts';
import { GhostAudioEventScheduler,hauntedGain,DEFAULT_HAUNTED_ZONE_CONFIG,type HauntedZoneConfig } from '../game/audio/GhostAudioEventScheduler.ts';
import { warehouseOccluded, warehouseSoundOrigins,warehouseZoneDistance, type HauntedSoundOrigin } from '../game/audio/warehouseSoundOrigins.ts';
import { GhostSpatialAudioController } from '../game/audio/GhostSpatialAudioController.ts';
import { setWarehouseZoneDiagnostics } from '../game/audio/horrorAudioDiagnostics.ts';

export interface HauntedWarehouseAudioZoneProps {
 enabled:boolean;minute:number;timeMode:TimeMode;soundEnabled:boolean;soundVolume?:number;paused?:boolean;
 seed?:number;config?:HauntedZoneConfig;occlusion?:boolean;
 onDiagnostics?:(value:{sources:number;nodes:number;disposed:boolean;band:string;bedMode?:string;preloaded?:boolean;inZone?:boolean;distanceM?:number})=>void;
}
const APPROACH_PRELOAD_DISTANCE_M = 95;
function buildFallbackOrigin(anchor: { x: number; z: number }, kind: 'warehouse' | 'tree', seedTime: number): HauntedSoundOrigin {
 const angle = (seedTime * 0.7) % (Math.PI * 2);
 const radius = kind === 'tree' ? 14 : 9;
 return {
  id: `warehouse-audio:fallback-${kind}`,
  sourceId: `fallback-${kind}`,
  kind,
  x: anchor.x + Math.cos(angle) * radius,
  y: kind === 'tree' ? 3 : 2.2,
  z: anchor.z + Math.sin(angle) * radius,
 };
}
/**
 * Haunted Warehouse spatial ambience & environmental event zone.
 * Warehouse ambience plays during both day (subtle) and night (intense) independently
 * of Ghost NPC visibility and night-only ghost spawning rules; no per-frame React state writes.
 */
export function HauntedWarehouseAudioZone({enabled,minute,timeMode,soundEnabled,soundVolume=1,paused=false,seed=3514936176,config=DEFAULT_HAUNTED_ZONE_CONFIG,occlusion=false,onDiagnostics}:HauntedWarehouseAudioZoneProps){
 const dev=useGhostDevSettings();
 const nightActive=isGhostNightActive(minute,{timeMode,forceActive:dev.forceActive});
 const period=timeMode==='auto'?periodAtMinute(minute):timeMode;
 const ambienceAllowed=enabled&&soundEnabled&&soundVolume>0&&!paused;
 const eventsAllowed=ambienceAllowed&&nightActive;
 const scheduler=useMemo(()=>new GhostAudioEventScheduler(seed,config),[seed,config]);
 const spatial=useRef<GhostSpatialAudioController|null>(null);
 const scratch=useMemo(()=>({position:new Vector3(),forward:new Vector3(),up:new Vector3(),rotation:new Quaternion(),player:new Vector3()}),[]);
 const player=useRef<Object3D|null>(null),elapsed=useRef(0),bedActive=useRef(false),clockSec=useRef(0);
 useEffect(()=>{
  const detach=gameAudio.attach();
  const buildings=area5.warehouses.filter(w=>!sourceIsEdited(w.id));
  spatial.current=new GhostSpatialAudioController(warehouseSoundOrigins(buildings,area5.trees,GHOST_WAREHOUSE_ANCHOR,sourceIsEdited),buildings,occlusion,id=>!sourceIsEdited(id));
  return()=>{
   spatial.current?.dispose();
   spatial.current=null;
   setWarehouseZoneDiagnostics({band:'outside',inZone:false,preloaded:false,distanceM:null,period,bedMode:'inactive',sources:0,nodes:0,disposed:true});
   detach();
  };
 },[occlusion]);
 useFrame(({camera,scene},dt)=>{
  const controller=spatial.current;if(!controller)return;
  // Camera listener is independent of lazy ghost asset loading.
  camera.getWorldPosition(scratch.position);camera.getWorldQuaternion(scratch.rotation);
  scratch.forward.set(0,0,-1).applyQuaternion(scratch.rotation);scratch.up.set(0,1,0).applyQuaternion(scratch.rotation);
  controller.listener(scratch.position.x,scratch.position.y,scratch.position.z,scratch.forward.x,scratch.forward.y,scratch.forward.z,scratch.up.x,scratch.up.y,scratch.up.z);
  elapsed.current+=Math.min(dt,.25);
  if(elapsed.current<.1)return;
  const step=elapsed.current;elapsed.current=0;clockSec.current+=step;
  if(!player.current?.parent)player.current=scene.getObjectByName('player-avatar')??null;
  if(player.current)player.current.getWorldPosition(scratch.player);else scratch.player.copy(scratch.position);
  const distance=warehouseZoneDistance(scratch.player.x,scratch.player.z,GHOST_WAREHOUSE_ANCHOR,controller.buildings);

  // Preload ambience stems proactively as player approaches warehouse (independent of Ghost visibility or unlock state).
  if(ambienceAllowed&&distance<=APPROACH_PRELOAD_DISTANCE_M){
   controller.preloadAmbience();
  }
  if(eventsAllowed&&distance<=config.distances[0]+config.hysteresis){
   controller.preloadEnvironmentEvents();
  }

  const audioRunning=!document.hidden&&gameAudio.context?.state==='running';
  const ambienceRunning=ambienceAllowed&&audioRunning;
  const eventsRunning=eventsAllowed&&audioRunning;

  controller.update(scratch.position.x,scratch.position.y,scratch.position.z,distance,eventsRunning&&distance<=config.distances[0]+config.hysteresis,config.distances[0]);
  if(!ambienceRunning||distance>config.distances[0]+config.hysteresis)bedActive.current=false;
  else if(distance<=config.distances[0])bedActive.current=true;

  const homeDist=homeBoundaryDistance(scratch.player.x,scratch.player.z);
  const homeIntensity=homeDist<=0?0:Math.max(.1,Math.min(1,homeDist/20));
  const zoneGain=(.18+.82*hauntedGain(distance,config.distances[0]))*homeIntensity;
  controller.updateBed(ambienceRunning&&bedActive.current&&homeIntensity>0,zoneGain,step,nightActive);

  const event=scheduler.tick(step,distance,eventsRunning&&homeIntensity>0,controller.voices,controller.encounterBusy);
  if(event){
   const candidates=controller.origins.filter(p=>p.kind===event.kind&&!sourceIsEdited(p.sourceId)&&Math.hypot(p.x-scratch.player.x,p.z-scratch.player.z)<=65);
   const origin=scheduler.chooseOrigin(candidates)??buildFallbackOrigin(GHOST_WAREHOUSE_ANCHOR,event.kind,clockSec.current);
   const occluded=occlusion&&scratch.player.y<6&&warehouseOccluded(scratch.position.x,scratch.position.z,origin.x,origin.z,controller.buildings);
   controller.play(origin,event.preset,hauntedGain(distance,config.distances[0])*homeIntensity*(controller.encounterBusy?.4:1),scheduler.variation(),occluded);
  }

  const bedDiag=controller.bedDiagnostics;
  const diagBand=bedActive.current&&scheduler.band==='outside'?'ambience':scheduler.band;
  setWarehouseZoneDiagnostics({
   band:diagBand,
   inZone:bedActive.current,
   preloaded:controller.ambiencePreloaded,
   distanceM:Number.isFinite(distance)?Math.round(distance*10)/10:null,
   period,
   bedMode:bedDiag.bedMode,
   sources:bedDiag.sources,
   nodes:bedDiag.nodes,
   disposed:bedDiag.disposed,
  });
  onDiagnostics?.({...bedDiag,band:scheduler.band,preloaded:controller.ambiencePreloaded,inZone:bedActive.current,distanceM:distance});
 });
 useEffect(()=>{
  if(!eventsAllowed)spatial.current?.stop();
  if(!ambienceAllowed){
   spatial.current?.stop();
   spatial.current?.updateBed(false,0,0.2,nightActive);
   bedActive.current=false;
  }
 },[ambienceAllowed,eventsAllowed,nightActive]);
 return null;
}
