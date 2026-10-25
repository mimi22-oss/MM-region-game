export type WalkingContact='car'|'robot'|'tree'|'obstacle'|null;
export const WALKING_RECOIL_DISTANCE=.64; // About one normal footstep.
export const WALKING_RECOIL_DURATION=.5;
export function createWalkingRecoil(yaw:number){return {yaw,elapsed:0,finished:false,escapedRobot:false};}
/** Retreat upright, sweeping the path so the impact cannot push someone through a wall. */
export function stepWalkingRecoil(recoil:ReturnType<typeof createWalkingRecoil>,position:{x:number;z:number},dt:number,clear:(x:number,z:number)=>boolean,actorAt:(x:number,z:number)=>'car'|'robot'|null){
 if(recoil.finished||dt<=0)return;
 const elapsed=Math.min(WALKING_RECOIL_DURATION,recoil.elapsed+dt);
 const distance=(elapsed-recoil.elapsed)*WALKING_RECOIL_DISTANCE/WALKING_RECOIL_DURATION;
 recoil.elapsed=elapsed;
 const steps=Math.max(1,Math.ceil(distance/.08)),dx=Math.sin(recoil.yaw)*distance/steps,dz=Math.cos(recoil.yaw)*distance/steps;
 // A moving robot may already overlap the person. Allow retreat out of that initial contact.
 if(actorAt(position.x,position.z)!=='robot')recoil.escapedRobot=true;
 for(let i=0;i<steps;i++){
  const x=position.x+dx,z=position.z+dz,actor=actorAt(x,z);
  if(!clear(x,z)||actor==='car'||(actor==='robot'&&recoil.escapedRobot)){recoil.finished=true;return;}
  if(actor===null)recoil.escapedRobot=true;
  position.x=x;position.z=z;
 }
 if(elapsed>=WALKING_RECOIL_DURATION)recoil.finished=true;
}
/** Stop at actors/trees; slide along ordinary scenery, including when an actor approaches a standing person. */
export function walkWithContacts(position:{x:number;z:number},dx:number,dz:number,clear:(x:number,z:number)=>boolean,actorAt:(x:number,z:number)=>'car'|'robot'|null,treeAt:(x:number,z:number)=>boolean=()=>false):WalkingContact{
 const touching=actorAt(position.x,position.z);if(touching)return touching;
 if(Math.hypot(dx,dz)<1e-8)return null;
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
 let blocked=false;
 for(let i=0;i<steps;i++){
  const x=position.x+dx/steps,z=position.z+dz/steps,actor=actorAt(x,z);
  if(actor)return actor;
  if(!clear(x,z)){
   if(treeAt(x,z))return 'tree';
   blocked=true;
   // Ordinary scenery blocks movement but still allows sliding along its edge.
   for(const axis of ['x','z'] as const){
    const ax=axis==='x'?position.x+dx/steps:position.x,az=axis==='z'?position.z+dz/steps:position.z;
    if(ax===position.x&&az===position.z)continue;
    const nextActor=actorAt(ax,az);if(nextActor)return nextActor;
    if(clear(ax,az)){position.x=ax;position.z=az;}
    else if(treeAt(ax,az))return 'tree';
   }
   continue;
  }
  position.x=x;position.z=z;
 }
 return blocked?'obstacle':null;
}
