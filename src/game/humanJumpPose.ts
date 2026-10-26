import {Bone,Skeleton,Float32BufferAttribute,Uint16BufferAttribute,type BufferGeometry} from 'three';

export const JUMP_PREPARE_TIME=.18;
export function createJumpPose(){return {prepare:0,landing:0,vx:0,vz:0};}
export type JumpPose=ReturnType<typeof createJumpPose>;
export function prepareJump(p:JumpPose,vx:number,vz:number){
 if(p.prepare>0||p.landing>0)return false;
 p.prepare=JUMP_PREPARE_TIME;p.vx=vx;p.vz=vz;return true;
}
/** Return true once, only after both knees have bent and extended. */
export function stepJumpPose(p:JumpPose,dt:number){
 if(dt<=0)return false;
 p.landing=Math.max(0,p.landing-dt);
 if(p.prepare<=0)return false;
 p.prepare=Math.max(0,p.prepare-dt);return p.prepare===0;
}
export function jumpKneeBend(p:JumpPose){
 if(p.prepare>0){
  const elapsed=JUMP_PREPARE_TIME-p.prepare;
  const t=elapsed<.12?elapsed/.12:(JUMP_PREPARE_TIME-elapsed)/.06;
  const smooth=Math.max(0,Math.min(1,t));return smooth*smooth*(3-2*smooth);
 }
 return p.landing>0?Math.sin(Math.PI*(1-p.landing/.20))*.5:0;
}
export function jumpLegPose(bend:number,covered=false){
 const angle=Math.max(0,Math.min(1,bend))*(covered?.55:1);
 return {angle,drop:.56*(1-Math.cos(angle))};
}
/** Continuous trouser fabric, weighted around the knee and ankle rather than split shells. */
export function skinJumpLeg(geometry:BufferGeometry){
 const g=geometry.clone(),positions=g.attributes.position,indices:number[]=[],weights:number[]=[];
 for(let i=0;i<positions.count;i++){
  const depth=-positions.getY(i);
  const knee=Math.max(0,Math.min(1,(depth-.24)/.08));
  const ankle=Math.max(0,Math.min(1,(depth-.51)/.05));
  indices.push(0,1,2,0);weights.push(1-knee,knee*(1-ankle),knee*ankle,0);
 }
 g.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));
 g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));return g;
}
export function createJumpLegRig(){
 const hip=new Bone(),knee=new Bone(),ankle=new Bone();
 hip.name='jump-hip';knee.name='jump-knee';ankle.name='jump-ankle';
 knee.position.y=-.28;ankle.position.y=-.28;hip.add(knee);knee.add(ankle);
 hip.updateMatrixWorld(true);
 const skeleton=new Skeleton([hip,knee,ankle]);return {hip,knee,ankle,skeleton};
}
