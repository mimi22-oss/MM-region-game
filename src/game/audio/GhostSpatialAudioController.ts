import { gameAudio } from '../gameAudio.ts';
import { acquireProceduralHorrorSynth,releaseProceduralHorrorSynth } from './ProceduralHorrorSynth.ts';
import { hauntedGain, horrorPresetToAssetId } from './GhostAudioEventScheduler.ts';
import { acquireSharedHorrorMixer, releaseSharedHorrorMixer, type HorrorAudioMixer } from './HorrorAudioMixer.ts';
import { warehouseOccluded,type HauntedSoundOrigin,type WarehouseGeometry } from './warehouseSoundOrigins.ts';
import type { HorrorPreset } from '../ghostAudio.ts';
/** Owns only static zone emitters; the NPC retains its animation-driven audio ownership. */
export class GhostSpatialAudioController {
 private synth=acquireProceduralHorrorSynth();
 private mixer:HorrorAudioMixer=acquireSharedHorrorMixer();
 private owners=new Set<string>();
 private disposed=false;
 private preloadedAmbience=false;
 private preloadedEnv=false;
 private detachPause=gameAudio.onPause(()=>{this.owners.clear();});
 readonly origins:readonly HauntedSoundOrigin[];
 readonly buildings:readonly WarehouseGeometry[];
 readonly occlusion:boolean;
 readonly sourceEnabled:(id:string)=>boolean;
 constructor(origins:readonly HauntedSoundOrigin[],buildings:readonly WarehouseGeometry[],occlusion=false,sourceEnabled:(id:string)=>boolean=()=>true){this.origins=origins;this.buildings=buildings;this.occlusion=occlusion;this.sourceEnabled=sourceEnabled;}
 preloadAmbience(){
  if(this.disposed||this.preloadedAmbience)return false;
  this.preloadedAmbience=true;
  void this.mixer.loader.preload(['warehouse-drone','eerie-wind']);
  return true;
 }
 preloadEnvironmentEvents(){
  if(this.disposed||this.preloadedEnv)return false;
  this.preloadedEnv=true;
  void this.mixer.loader.preload(['rusted-door-creak','wood-cracks','distant-footsteps']);
  return true;
 }
 get ambiencePreloaded(){return this.preloadedAmbience;}
 updateBed(active:boolean,level:number,dt:number,isNight=true){
  if(this.disposed)return;
  this.mixer.updateWarehouseAmbience({active,level,isNight,dt});
 }
 get bedDiagnostics(){return this.mixer.getBedDiagnostics();}
 get voices(){return this.mixer.activeVoiceCountForPrefix('warehouse-audio:');}
 get encounterBusy(){return this.mixer.encounterBusy;}
 play(origin:HauntedSoundOrigin,preset:HorrorPreset,gain:number,variation?:{pitch:number;volume:number},occluded=false){
  if(this.disposed||this.voices>=4)return;
  if(!this.owners.has(origin.id)&&this.owners.size>=4){
   for(const id of this.owners)if(!this.mixer.hasActiveVoice(id)){this.mixer.releaseOwner(id);this.owners.delete(id);break;}
   if(this.owners.size>=4)return;
  }
  this.mixer.positionOwner(origin.id,origin.x,origin.y,origin.z,true,gain,occluded);
  this.owners.add(origin.id);
  this.mixer.playCue({
   assetId:horrorPresetToAssetId(preset)??undefined,
   fallbackPreset:preset,
   bus:'horrorEvents',
   owner:origin.id,
   position:{x:origin.x,y:origin.y,z:origin.z},
   volume:.85*(variation?.volume??1)*Math.max(0,Math.min(1,gain)),
   pitch:variation?.pitch??1,
   occluded,
  });
 }
 update(x:number,y:number,z:number,distance:number,active:boolean,radius=60){
  const gain=hauntedGain(distance,radius);
  for(const origin of this.origins)if(this.owners.has(origin.id))
   this.mixer.positionOwner(origin.id,origin.x,origin.y,origin.z,active&&this.sourceEnabled(origin.sourceId),gain,
    this.occlusion&&y<6&&warehouseOccluded(x,z,origin.x,origin.z,this.buildings));
 }
 listener(x:number,y:number,z:number,fx:number,fy:number,fz:number,ux:number,uy:number,uz:number){gameAudio.listener(x,y,z,fx,fy,fz,ux,uy,uz);}
 stop(){for(const id of this.owners)this.mixer.stopOwner(id);}
 dispose(){if(this.disposed)return;this.disposed=true;this.detachPause();for(const id of this.owners)this.mixer.releaseOwner(id);this.owners.clear();releaseSharedHorrorMixer();releaseProceduralHorrorSynth();}
}
