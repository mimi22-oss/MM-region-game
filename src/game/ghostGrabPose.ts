import {Bone,Vector3,type Object3D} from 'three';
import {buildNormalizedBoneMap} from '../animation/retargeting/SkeletonAnalyzer.ts';
import {createLimbFitter} from './characterRig.ts';
/** No neck-grab clip is shipped. Pose the ghost's own two arm chains toward the player's neck. */
export function createGhostGrabPose(root:Object3D){
 const bones=buildNormalizedBoneMap(root),arms:Array<{fit:ReturnType<typeof createLimbFitter>;side:number}>=[];
 for(const side of ['Left','Right']){
  const upper=bones.get(`mixamorig${side}Arm`),lower=bones.get(`mixamorig${side}ForeArm`),hand=bones.get(`mixamorig${side}Hand`);
  if(upper instanceof Bone&&lower instanceof Bone&&hand instanceof Bone)arms.push({fit:createLimbFitter(upper,lower,hand),side:side==='Left'?-1:1});
 }
 const target=new Vector3(),pole=new Vector3();
 return {supported:arms.length===2,update(x:number,y:number,z:number,yaw:number){
  root.updateWorldMatrix(true,true);
  for(const arm of arms){target.set(x+Math.cos(yaw)*arm.side*.09,y,z-Math.sin(yaw)*arm.side*.09);pole.set(Math.cos(yaw)*arm.side,.25,-Math.sin(yaw)*arm.side);arm.fit(target,pole);}
 }};
}
