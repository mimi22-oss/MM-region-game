import { Box3, Euler, Mesh, Object3D, Raycaster, Vector3, type Intersection } from 'three';
import { mountainHeight } from './mountainTerrain.ts';
import { ward, angle } from '../data/ward.ts';

const mountainPeaks = [...ward.mountains, ...ward.weipula.peaks];
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);
const emptyMeshes: Mesh[] = [];
const poseEuler = new Euler(0, 0, 0, 'YXZ');
const poseVec = new Vector3();

/** Semantic surfaces only: roofs, railings, plants and water cannot lift the player. */
export class GroundSurface {
 private cells=new Map<string,Mesh[]>();
 private ray=new Raycaster(new Vector3(),new Vector3(0,-1,0),0,20000);
 private hits:Intersection[]=[];
 private box=new Box3();
 refresh(...roots:Object3D[]){
  this.cells.clear();
  for(const root of roots){
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{
   if(!(o instanceof Mesh)||!o.userData.walkable)return;
   const b=this.box.setFromObject(o);
   if(b.isEmpty())return;
   for(let x=Math.floor(b.min.x/64);x<=Math.floor(b.max.x/64);x++)
    for(let z=Math.floor(b.min.z/64);z<=Math.floor(b.max.z/64);z++){
     const key=x+','+z,items=this.cells.get(key)||[];items.push(o);this.cells.set(key,items);
    }
  });
  }
 }
 height(x:number,z:number,maxY?:number){
  this.ray.ray.origin.set(x,maxY!==undefined?maxY:10000,z);
  const hits=this.hits;
  hits.length=0;
  this.ray.intersectObjects(this.cells.get(Math.floor(x/64)+','+Math.floor(z/64))||emptyMeshes,false,hits);
  if (hits.length > 0) return Math.max(0, hits[0].point.y);
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  if (v > 4100 || u < -410) {
    const mh = mountainHeight(u, v, mountainPeaks);
    if (mh > 0) return mh;
  }
  return 0;
 }
}

type GroundEntry={surface:GroundSurface;time:number;regions?:Map<string,Object3D>};
const scenes=new WeakMap<Object3D,GroundEntry>();
const groundWorlds=new WeakMap<Object3D,Object3D>();
function groundEntry(scene:Object3D){
 let entry=scenes.get(scene);
 if(!entry){entry={surface:new GroundSurface(),time:-Infinity};scenes.set(scene,entry);}
 return entry;
}
/** Physics keeps every prepared road/deck even when its visual region is detached.
 * Portal actors also use this same world index, rather than their local render host. */
export function registerGroundRegion(scene:Object3D,id:string,root:Object3D){
 const entry=groundEntry(scene);
 entry.regions??=new Map();
 const previous=entry.regions.get(id);
 if(previous===root)return;
 if(previous)groundWorlds.delete(previous);
 entry.regions.set(id,root);
 groundWorlds.set(root,scene);
 entry.surface.refresh(...entry.regions.values());
}
/** Refreshes a persistent pooled ground container (e.g. Fixed Object Pool school halls) after slot reassignment. */
export function refreshGroundRegion(scene:Object3D,id:string,root:Object3D){
 const entry=groundEntry(scene);
 entry.regions??=new Map();
 entry.regions.set(id,root);
 groundWorlds.set(root,scene);
 entry.surface.refresh(...entry.regions.values());
}
export function releaseGroundRegions(scene:Object3D){
 const entry=scenes.get(scene);
 for(const root of entry?.regions?.values()??[])groundWorlds.delete(root);
 scenes.delete(scene);
}
/** A disposed region must not remain reachable through the physics index. */
export function releaseGroundRegion(scene:Object3D,id:string){
 const entry=scenes.get(scene),root=entry?.regions?.get(id);
 if(!entry?.regions||!root)return;
 groundWorlds.delete(root);
 entry.regions.delete(id);
 entry.surface.refresh(...entry.regions.values());
}
/** All actors share one index; adding bots does not add scene traversals. */
export function sceneGround(scene:Object3D,time:number){
 const world=groundWorlds.get(scene)??scene,entry=groundEntry(world);
 if(!entry.regions&&time-entry.time>.5){entry.surface.refresh(world);entry.time=time;}
 return entry.surface;
}

export function carGroundPose(
 x:number,
 z:number,
 yaw:number,
 size:number,
 height:(x:number,z:number)=>number,
 out?:{y:number;pitch:number;roll:number}
){
 const c=Math.cos(yaw),s=Math.sin(yaw),w=.79*size,l=1.04*size,r=.43*size;
 const h0=height(x-c*w-s*l,z+s*w-c*l);
 const h1=height(x+c*w-s*l,z-s*w-c*l);
 const h2=height(x-c*w+s*l,z+s*w+c*l);
 const h3=height(x+c*w+s*l,z-s*w+c*l);
 const pitch=Math.atan2((h0+h1-h2-h3)/2,2*l);
 const roll=Math.atan2((h1+h3-h0-h2)/2,2*w);
 poseEuler.set(pitch,yaw,roll,'YXZ');
 poseVec.set(-w,r,-l).applyEuler(poseEuler);
 const y0=h0+r-poseVec.y;
 poseVec.set(w,r,-l).applyEuler(poseEuler);
 const y1=h1+r-poseVec.y;
 poseVec.set(-w,r,l).applyEuler(poseEuler);
 const y2=h2+r-poseVec.y;
 poseVec.set(w,r,l).applyEuler(poseEuler);
 const y3=h3+r-poseVec.y;
 const y=Math.max(y0,y1,y2,y3)+.012;
 if(out){out.y=y;out.pitch=pitch;out.roll=roll;return out;}
 return {y,pitch,roll};
}

/** Forward is -Z. Both tire contact patches determine pitch and axle height. */
export function motorcycleGroundPose(x:number,z:number,yaw:number,height:(x:number,z:number)=>number){
 const dx=-Math.sin(yaw)*.635,dz=-Math.cos(yaw)*.635;
 const front=height(x+dx,z+dz),rear=height(x-dx,z-dz);
 const pitch=Math.atan2(front-rear,1.27);
 // Raise for the rigid wheelbase on sharp steps; never average a tire below a deck.
 const y=Math.max(front-Math.sin(pitch)*.635,rear+Math.sin(pitch)*.635)+.286*(1-Math.cos(pitch))+.012;
 return {y,pitch};
}
