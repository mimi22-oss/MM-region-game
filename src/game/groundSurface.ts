import { Box3, Euler, Mesh, Object3D, Raycaster, Vector3 } from 'three';

/** Semantic surfaces only: roofs, railings, plants and water cannot lift the player. */
export class GroundSurface {
 private cells=new Map<string,Mesh[]>();
 private bounds=new WeakMap<Mesh,Box3>();
 private ray=new Raycaster(new Vector3(),new Vector3(0,-1,0),0,20000);
 refresh(root:Object3D){
  this.cells.clear();
  root.traverse(o=>{
   if(!(o instanceof Mesh)||!o.userData.walkable)return;
   let b=this.bounds.get(o);
   if(!b){o.updateWorldMatrix(true,false);b=new Box3().setFromObject(o);this.bounds.set(o,b);}
   if(b.isEmpty())return;
   for(let x=Math.floor(b.min.x/64);x<=Math.floor(b.max.x/64);x++)
    for(let z=Math.floor(b.min.z/64);z<=Math.floor(b.max.z/64);z++){
     const key=x+','+z,items=this.cells.get(key)||[];items.push(o);this.cells.set(key,items);
    }
  });
 }
 height(x:number,z:number){
  this.ray.ray.origin.set(x,10000,z);
  const hits=this.ray.intersectObjects(this.cells.get(Math.floor(x/64)+','+Math.floor(z/64))||[],false);
  return Math.max(0,hits[0]?.point.y??0);
 }
}

const scenes=new WeakMap<Object3D,{surface:GroundSurface;time:number}>();
/** All actors share one index; adding bots does not add scene traversals. */
export function sceneGround(scene:Object3D,time:number){
 let entry=scenes.get(scene);
 if(!entry){entry={surface:new GroundSurface(),time:-Infinity};scenes.set(scene,entry);}
 if(time-entry.time>.5){entry.surface.refresh(scene);entry.time=time;}
 return entry.surface;
}

export function carGroundPose(x:number,z:number,yaw:number,size:number,height:(x:number,z:number)=>number){
 const c=Math.cos(yaw),s=Math.sin(yaw),w=.79*size,l=1.04*size,r=.43*size;
 const contacts=[[-w,-l],[w,-l],[-w,l],[w,l]].map(([u,v])=>({u,v,h:height(x+c*u+s*v,z-s*u+c*v)}));
 const pitch=Math.atan2((contacts[0].h+contacts[1].h-contacts[2].h-contacts[3].h)/2,2*l);
 const roll=Math.atan2((contacts[1].h+contacts[3].h-contacts[0].h-contacts[2].h)/2,2*w);
 const rotation=new Euler(pitch,yaw,roll,'YXZ');
 const y=Math.max(...contacts.map(p=>p.h+r-new Vector3(p.u,r,p.v).applyEuler(rotation).y))+.012;
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
