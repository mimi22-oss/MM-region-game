import {WarehouseAmbientBed} from './WarehouseAmbientBed.ts';
import { gameAudio } from '../gameAudio.ts';
import { acquireProceduralHorrorSynth,releaseProceduralHorrorSynth } from './ProceduralHorrorSynth.ts';
import { hauntedGain } from './GhostAudioEventScheduler.ts';
import { warehouseOccluded,type HauntedSoundOrigin,type WarehouseGeometry } from './warehouseSoundOrigins.ts';
import type { HorrorPreset } from '../ghostAudio.ts';
/** Owns only static zone emitters; the NPC retains its animation-driven audio ownership. */
export class GhostSpatialAudioController {
 private synth=acquireProceduralHorrorSynth();
 private owners=new Set<string>();
 private disposed=false;
 private bed:WarehouseAmbientBed|null=null;
 private silentTime=0;
 private detachPause=gameAudio.onPause(()=>{this.bed?.dispose();this.bed=null;this.owners.clear();});
 readonly origins:readonly HauntedSoundOrigin[];
 readonly buildings:readonly WarehouseGeometry[];
 readonly occlusion:boolean;
 readonly sourceEnabled:(id:string)=>boolean;
 constructor(origins:readonly HauntedSoundOrigin[],buildings:readonly WarehouseGeometry[],occlusion=false,sourceEnabled:(id:string)=>boolean=()=>true){this.origins=origins;this.buildings=buildings;this.occlusion=occlusion;this.sourceEnabled=sourceEnabled;}
 updateBed(active:boolean,level:number,dt:number){
  if(this.disposed)return;
  if(active&&gameAudio.context?.state==='running'){
   this.bed??=new WarehouseAmbientBed();this.bed.setLevel(level);this.silentTime=0;
  }else{this.bed?.setLevel(0);this.silentTime+=dt;if(this.silentTime>2.5){this.bed?.dispose();this.bed=null;}}
 }
 get bedDiagnostics(){return this.bed?.diagnostics??{sources:0,nodes:0,disposed:true};}
 get voices(){return this.synth.activeVoiceCount('warehouse-audio:');}
 get encounterBusy(){return this.synth.encounterBusy;}
 play(origin:HauntedSoundOrigin,preset:HorrorPreset,gain:number,variation?:{pitch:number;volume:number}){
  if(this.disposed||this.voices>=4)return;
  if(!this.owners.has(origin.id)&&this.owners.size>=4){
   for(const id of this.owners)if(!this.synth.hasVoice(id)){this.synth.release(id);this.owners.delete(id);break;}
   if(this.owners.size>=4)return;
  }
  this.synth.position(origin.id,origin.x,origin.y,origin.z,true,gain);
  this.owners.add(origin.id);this.synth.play(preset,.85*(variation?.volume??1),origin.id,variation?.pitch??1);
 }
 update(x:number,y:number,z:number,distance:number,active:boolean,radius=60){
  const gain=hauntedGain(distance,radius);
  for(const origin of this.origins)if(this.owners.has(origin.id))
   this.synth.position(origin.id,origin.x,origin.y,origin.z,active&&this.sourceEnabled(origin.sourceId),gain,
    this.occlusion&&y<6&&warehouseOccluded(x,z,origin.x,origin.z,this.buildings));
 }
 listener(x:number,y:number,z:number,fx:number,fy:number,fz:number,ux:number,uy:number,uz:number){gameAudio.listener(x,y,z,fx,fy,fz,ux,uy,uz);}
 stop(){for(const id of this.owners)this.synth.stop(id);}
 dispose(){if(this.disposed)return;this.disposed=true;this.detachPause();this.bed?.dispose();this.bed=null;for(const id of this.owners)this.synth.release(id);this.owners.clear();releaseProceduralHorrorSynth();}
}
