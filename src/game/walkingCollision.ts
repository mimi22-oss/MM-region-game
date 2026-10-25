export type WalkingContact='car'|'robot'|'obstacle'|null;
export const WALKING_RECOIL_DISTANCE=3.2; // About five normal footsteps.
export const WALKING_RECOIL_DURATION=1.6;
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
/** Stop at the first swept contact, including an actor moving into a standing person. */
export function walkWithContacts(position:{x:number;z:number},dx:number,dz:number,clear:(x:number,z:number)=>boolean,actorAt:(x:number,z:number)=>'car'|'robot'|null):WalkingContact{
 const touching=actorAt(position.x,position.z);if(touching)return touching;
 if(Math.hypot(dx,dz)<1e-8)return null;
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
 for(let i=0;i<steps;i++){
  const x=position.x+dx/steps,z=position.z+dz/steps,actor=actorAt(x,z);
  if(actor)return actor;
  if(!clear(x,z))return 'obstacle';
  position.x=x;position.z=z;
 }
 return null;
}
