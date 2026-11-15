import {
 AnimationClip,
 AnimationMixer,
 Bone,
 Box3,
 Group,
 Matrix4,
 Mesh,
 type Object3D,
 Quaternion,
 SkinnedMesh,
 Vector3,
} from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {AnimationController,type MotionPlayOptions} from '../animation/core/AnimationController.ts';
import {createLimbFitter} from './characterRig.ts';
import {driverGrip} from './carCabin.ts';
import {createGlbEyeBlink,type GlbEyePreset} from './glbEyeBlink.ts';

export interface GlbHumanOptions {
 castShadow?: boolean;
 preset?: GlbEyePreset;
}

export const BOY_CLIPS=['idle','walk','run','jump','sit','motorcycle_idle','motorcycle_ride'] as const;
export type BoyClip=typeof BOY_CLIPS[number];

type Motion={
 speed:number;
 distance:number;
 airborne?:boolean;
 jumpBend?:number;
 jumpVelocity?:number;
 leftFoot?:number;
 rightFoot?:number;
};
type Driving={
 wheelAngle:number;
 interior:boolean;
 brake:boolean;
 clutch:boolean;
 throttle:boolean;
};

const FINGER_NAMES=['Index','Middle','Ring','Pinky'] as const;
const FINGER_CASCADE=[0.9,1.0,1.08,1.16] as const;

function lerp(a:number,b:number,t:number){
 return a+(b-a)*t;
}
function clamp(v:number,min:number,max:number){
 return Math.max(min,Math.min(max,v));
}
function damp(current:number,target:number,lambda:number,dt:number){
 return lerp(current,target,1-Math.exp(-lambda*dt));
}

export function selectBoyClip(motion:Motion,riding=false,driving=false):BoyClip{
 if(driving)return 'sit';
 if(riding)return Math.abs(motion.speed)>.15?'motorcycle_ride':'motorcycle_idle';
 if(motion.airborne||(motion.jumpBend??0)>.01)return 'jump';
 const speed=Math.abs(motion.speed);
 if(speed>5.8)return 'run';
 if(speed>.1)return 'walk';
 return 'idle';
}

/**
 * Pure TypeScript biomechanical Mixamo animation controller for boy.glb and girl.glb.
 * Synthesizes smooth, multi-joint human motion (Idle, Walk, Run, Jump, Sit, Motorcycle Idle/Ride)
 * across 52 Mixamo bones including 3-segment spine counter-rotation, pelvic 6-DOF sway,
 * asymmetric multi-harmonic leg gait, phase-delayed forearm follow-through, and palm-centered vehicle grip IK.
 */
export function createGlbHuman(source:Group,options?:GlbHumanOptions){
 const initialCastShadow=options?.castShadow??true;
 const object=clone(source) as Group,placement=new Group(),root=new Group();
 placement.add(object);root.add(placement);
 object.updateMatrixWorld(true);
 const bounds=new Box3().setFromObject(object),size=bounds.getSize(new Vector3());
 const scale=1.8/size.y;
 object.scale.multiplyScalar(scale);
 object.position.set(-(bounds.min.x+bounds.max.x)*scale/2,-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*scale/2);
 object.updateMatrixWorld(true);
 const eyeBlink=createGlbEyeBlink(object,options?.preset);
 // Supplied GLBs face +Z. Gameplay, vehicle seats and the camera use -Z.
 placement.rotation.y=Math.PI;
 root.updateMatrixWorld(true);

 const bone=(name:string)=>{
  const value=object.getObjectByName(`mixamorig${name}`);
  if(!(value instanceof Bone))throw new Error(`Missing GLB character bone: ${name}`);
  return value;
 };
 const optionalBone=(name:string)=>{
  const value=object.getObjectByName(`mixamorig${name}`);
  return value instanceof Bone?value:null;
 };

 const hips=bone('Hips');
 const spine=optionalBone('Spine');
 const spine1=optionalBone('Spine1');
 const spine2=optionalBone('Spine2');
 const spineSegments=[spine,spine1,spine2].filter((b):b is Bone=>b!==null);
 const neck=optionalBone('Neck');
 const head=bone('Head');

 const rest=new Map<Bone,Quaternion>();
 const restList:{bone:Bone;q:Quaternion}[]=[];
 const meshes:Mesh[]=[];
 object.traverse(child=>{
  if(child instanceof Bone){const q=child.quaternion.clone();rest.set(child,q);restList.push({bone:child,q});}
  if(child instanceof Mesh){child.castShadow=initialCastShadow;child.receiveShadow=true;meshes.push(child);}
  if(child instanceof SkinnedMesh)child.frustumCulled=false;
 });

 const worldQuatMap=new Map<Object3D,Quaternion>();
 const getWorldQuatRef=(obj:Object3D):Quaternion=>{
  let q=worldQuatMap.get(obj);
  if(!q){q=new Quaternion();worldQuatMap.set(obj,q);}
  return q;
 };
 const hipsAncestors:{obj:Object3D;wq:Quaternion;pwq:Quaternion}[]=[];
 {
  const chain:Object3D[]=[];
  let cur:Object3D|null=hips.parent;
  while(cur&&cur!==root){chain.push(cur);cur=cur.parent;}
  chain.reverse();
  for(const node of chain){
   hipsAncestors.push({obj:node,wq:getWorldQuatRef(node),pwq:getWorldQuatRef(node.parent??root)});
  }
 }
 // Collect intermediate ancestor path from any tracked bone up to root for fast world-quaternion propagation
 const ensureParentQuatRef=(obj:Object3D|null)=>getWorldQuatRef(obj??root);

 const point=new Vector3(),target=new Vector3(),pole=new Vector3(),gripWorld=new Vector3(),wristWorld=new Vector3(),gripCenterA=new Vector3(),gripCenterB=new Vector3(),axis=new Vector3(),rotation=new Quaternion(),parentRotation=new Quaternion(),invParentRotation=new Quaternion(),rootRotation=new Quaternion(),fingerWQ1=new Quaternion(),fingerWQ2=new Quaternion();
 const handU=new Vector3(),handV=new Vector3(),handW=new Vector3(),desU=new Vector3(),desV=new Vector3(),desW=new Vector3(),tempVec=new Vector3();
 const curBasis=new Matrix4(),desBasis=new Matrix4(),basisDelta=new Quaternion();
 const hipHeight=hips.getWorldPosition(point).y;
 const hipsRestZ=point.z;

 const limbs=(['Left','Right'] as const).map(side=>{
  const s=side==='Left'?-1:1;
  const shoulder=optionalBone(`${side}Shoulder`);
  const arm=bone(`${side}Arm`),forearm=bone(`${side}ForeArm`),hand=bone(`${side}Hand`);
  const thigh=bone(`${side}UpLeg`),shin=bone(`${side}Leg`),foot=bone(`${side}Foot`);
  const toe=optionalBone(`${side}ToeBase`);
  const index1=optionalBone(`${side}HandIndex1`);
  const mid1=optionalBone(`${side}HandMiddle1`);
  const mid2=optionalBone(`${side}HandMiddle2`);
  const pinky1=optionalBone(`${side}HandPinky1`);

  // Measure bind-pose arm angle from straight down and total upper+lower arm reach
  arm.getWorldPosition(point);
  forearm.getWorldPosition(gripCenterA);
  hand.getWorldPosition(target);
  const armReach=point.distanceTo(gripCenterA)+gripCenterA.distanceTo(target);
  const restDownAngle=Math.atan2(Math.abs(target.x-point.x),Math.max(.001,point.y-target.y));
  const neutralAdduction=Math.max(0,restDownAngle-.13);

  // Precompute local-space hand anatomical basis axes so standing/walking curlHand avoids matrix reads
  let hasHandBasis=false;
  const localFlexAxis=new Vector3(0,0,-s);
  const localThumbOpposeAxis=new Vector3(0,1,0);
  const localThumbTuckAxis=new Vector3(-s,0,0);
  if(mid1&&index1&&pinky1){
   hand.getWorldPosition(gripCenterA);
   mid1.getWorldPosition(gripCenterB);
   handU.subVectors(gripCenterB,gripCenterA).normalize();
   pinky1.getWorldPosition(gripCenterA);
   index1.getWorldPosition(gripCenterB);
   handV.subVectors(gripCenterB,gripCenterA);
   handV.addScaledVector(handU,-handV.dot(handU)).normalize();
   handW.crossVectors(handV,handU).normalize();
   hand.getWorldQuaternion(invParentRotation).invert();
   localFlexAxis.copy(handV).multiplyScalar(s).applyQuaternion(invParentRotation).normalize();
   localThumbOpposeAxis.copy(handW).applyQuaternion(invParentRotation).normalize();
   localThumbTuckAxis.copy(handU).multiplyScalar(-s).applyQuaternion(invParentRotation).normalize();
   hasHandBasis=true;
  }

  const fingers=FINGER_NAMES.map((fname,fIdx)=>({
   cascade:FINGER_CASCADE[fIdx],
   joints:[1,2,3].map(j=>optionalBone(`${side}Hand${fname}${j}`)).filter((b):b is Bone=>b!==null),
  }));
  const thumb=[1,2,3].map(j=>optionalBone(`${side}HandThumb${j}`)).filter((b):b is Bone=>b!==null);

  return {
   side:s,
   shoulder,
   arm,
   forearm,
   hand,
   index1,
   mid1,
   mid2,
   pinky1,
   thigh,
   shin,
   foot,
   toe,
   armReach,
   neutralAdduction,
   hasHandBasis,
   localFlexAxis,
   localThumbOpposeAxis,
   localThumbTuckAxis,
   fingers,
   thumb,
   fitArm:createLimbFitter(arm,forearm,hand),
   fitLeg:createLimbFitter(thigh,shin,foot),
  };
 });

 const avgArmReach=(limbs[0].armReach+limbs[1].armReach)*.5;
 // Characters with shorter stylized arms (like boy.glb) lean slightly more from hips+spine to reach comfortably
 const shortArmFactor=Math.max(0,.415-avgArmReach);

 let currentClip:BoyClip='idle';
 let idleClock=0;
 let gaitPhase=0;
 let lastDistance:number|null=null;
 let smoothSpeed=0;
 let moveWeight=0;
 let runWeight=0;
 let jumpWeight=0;
 let smoothJumpBend=0;
 let smoothAirborne=0;
 let smoothVy=0;

 // Single shared AnimationMixer & AnimationController for shared special action clips
 const hipsRestPos=hips.position.clone();
 const mixer=new AnimationMixer(object);
 const procQuats=restList.map(()=>new Quaternion());
 const procPlacementPos=new Vector3();
 const animController=new AnimationController(mixer,object);
 let onSpecialStoppedCb:(()=>void)|null=null;

 function setSpecialClip(
  clip:AnimationClip|null,
  opts?:MotionPlayOptions,
 ){
  animController.play(clip,opts);
 }

 function rotateAxis(b:Bone|null,ax:number,ay:number,az:number,angle:number){
  if(!b||Math.abs(angle)<1e-6)return;
  root.getWorldQuaternion(rootRotation);
  axis.set(ax,ay,az).normalize().applyQuaternion(rootRotation);
  b.parent!.getWorldQuaternion(parentRotation);
  axis.applyQuaternion(parentRotation.invert());
  rotation.setFromAxisAngle(axis,angle);
  b.quaternion.premultiply(rotation);
  b.updateWorldMatrix(false,true);
 }

 function rotateAxisWithParentQuat(b:Bone|null,parentWQ:Quaternion,ax:number,ay:number,az:number,angle:number){
  if(!b||Math.abs(angle)<1e-6)return;
  axis.set(ax,ay,az).normalize().applyQuaternion(rootRotation);
  invParentRotation.copy(parentWQ).invert();
  axis.applyQuaternion(invParentRotation);
  rotation.setFromAxisAngle(axis,angle);
  b.quaternion.premultiply(rotation);
 }

 function rotateWorldAxisWithParentQuat(b:Bone|null,parentWQ:Quaternion,worldAxis:Vector3,angle:number){
  if(!b||Math.abs(angle)<1e-6)return;
  invParentRotation.copy(parentWQ).invert();
  axis.copy(worldAxis).applyQuaternion(invParentRotation);
  rotation.setFromAxisAngle(axis,angle);
  b.quaternion.premultiply(rotation);
 }

 function rotateWorldAxis(b:Bone|null,worldAxis:Vector3,angle:number){
  if(!b||Math.abs(angle)<1e-6)return;
  b.parent!.getWorldQuaternion(parentRotation);
  axis.copy(worldAxis).normalize().applyQuaternion(parentRotation.invert());
  rotation.setFromAxisAngle(axis,angle);
  b.quaternion.premultiply(rotation);
  b.updateWorldMatrix(false,true);
 }

 function curlHandFast(limb:typeof limbs[number],handWQ:Quaternion,curlAmount:number){
  const s=limb.side;
  if(limb.hasHandBasis){
   const flexWorld=gripCenterA.copy(limb.localFlexAxis).applyQuaternion(handWQ).normalize();
   for(let fi=0;fi<limb.fingers.length;fi++){
    const f=limb.fingers[fi];
    const angle=curlAmount*f.cascade;
    let curPWQ=handWQ;
    for(let ji=0;ji<f.joints.length;ji++){
     const joint=f.joints[ji];
     rotateWorldAxisWithParentQuat(joint,curPWQ,flexWorld,angle);
     const nextQ=ji%2===0?fingerWQ1:fingerWQ2;
     nextQ.multiplyQuaternions(curPWQ,joint.quaternion);
     curPWQ=nextQ;
    }
   }
   const opposeWorld=gripCenterB.copy(limb.localThumbOpposeAxis).applyQuaternion(handWQ).normalize();
   const tuckWorld=tempVec.copy(limb.localThumbTuckAxis).applyQuaternion(handWQ).normalize();
   let curThumbPWQ=handWQ;
   for(let ji=0;ji<limb.thumb.length;ji++){
    const joint=limb.thumb[ji];
    rotateWorldAxisWithParentQuat(joint,curThumbPWQ,opposeWorld,curlAmount*.42);
    rotateWorldAxisWithParentQuat(joint,curThumbPWQ,tuckWorld,curlAmount*.62);
    const nextQ=ji%2===0?fingerWQ1:fingerWQ2;
    nextQ.multiplyQuaternions(curThumbPWQ,joint.quaternion);
    curThumbPWQ=nextQ;
   }
   return;
  }
  for(let fi=0;fi<limb.fingers.length;fi++){
   const f=limb.fingers[fi];
   const angle=-s*curlAmount*f.cascade;
   let curPWQ=handWQ;
   for(let ji=0;ji<f.joints.length;ji++){
    const joint=f.joints[ji];
    rotateAxisWithParentQuat(joint,curPWQ,0,0,1,angle);
    const nextQ=ji%2===0?fingerWQ1:fingerWQ2;
    nextQ.multiplyQuaternions(curPWQ,joint.quaternion);
    curPWQ=nextQ;
   }
  }
 }

 function fit(fitter:ReturnType<typeof createLimbFitter>,x:number,y:number,z:number,px:number,py:number,pz:number){
  target.set(x,y,z).applyMatrix4(root.matrixWorld);
  pole.set(px,py,pz).transformDirection(root.matrixWorld);
  fitter(target,pole);
 }

 function curlHand(limb:typeof limbs[number],curlAmount:number){
  const s=limb.side;
  if(limb.mid1&&limb.index1&&limb.pinky1){
   limb.hand.getWorldPosition(gripCenterA);
   limb.mid1.getWorldPosition(gripCenterB);
   handU.subVectors(gripCenterB,gripCenterA).normalize();
   limb.pinky1.getWorldPosition(gripCenterA);
   limb.index1.getWorldPosition(gripCenterB);
   handV.subVectors(gripCenterB,gripCenterA);
   handV.addScaledVector(handU,-handV.dot(handU)).normalize();
   // Pinky->Index crossed with Hand->Middle bends forward into the palm when scaled by side
   handW.crossVectors(handV,handU).normalize();
   const fingerFlexAxis=gripCenterA.copy(handV).multiplyScalar(s);
   for(const f of limb.fingers){
    const angle=curlAmount*f.cascade;
    for(const joint of f.joints)rotateWorldAxis(joint,fingerFlexAxis,angle);
   }
   const thumbOpposeAxis=gripCenterB.copy(handW);
   const thumbTuckAxis=gripCenterA.copy(handU).multiplyScalar(-s);
   for(const joint of limb.thumb){
    rotateWorldAxis(joint,thumbOpposeAxis,curlAmount*.42);
    rotateWorldAxis(joint,thumbTuckAxis,curlAmount*.62);
   }
   return;
  }
  for(const f of limb.fingers){
   const angle=-s*curlAmount*f.cascade;
   for(const joint of f.joints)rotateAxis(joint,0,0,1,angle);
  }
 }

 /**
  * Aligns the hand's anatomical basis (wrist->knuckles forward, pinky->index inward) in world space
  * so any character rig (T-pose or A-pose) lays its palm flat on the grip and curls fingers around it.
  */
 function orientHandOnGrip(limb:typeof limbs[number],fwdX:number,fwdY:number,fwdZ:number,inwardX:number,inwardY:number,inwardZ:number){
  if(!limb.mid1||!limb.index1||!limb.pinky1)return;
  limb.hand.getWorldPosition(gripCenterA);
  limb.mid1.getWorldPosition(gripCenterB);
  handU.subVectors(gripCenterB,gripCenterA).normalize();
  limb.pinky1.getWorldPosition(gripCenterA);
  limb.index1.getWorldPosition(gripCenterB);
  handV.subVectors(gripCenterB,gripCenterA);
  handV.addScaledVector(handU,-handV.dot(handU)).normalize();
  handW.crossVectors(handU,handV).normalize();
  curBasis.makeBasis(handU,handV,handW);

  desU.set(fwdX,fwdY,fwdZ).transformDirection(root.matrixWorld).normalize();
  desV.set(inwardX,inwardY,inwardZ).transformDirection(root.matrixWorld);
  desV.addScaledVector(desU,-desV.dot(desU)).normalize();
  desW.crossVectors(desU,desV).normalize();
  desBasis.makeBasis(desU,desV,desW);

  desBasis.multiply(curBasis.invert());
  basisDelta.setFromRotationMatrix(desBasis);
  limb.hand.getWorldQuaternion(rotation);
  limb.hand.parent!.getWorldQuaternion(parentRotation);
  limb.hand.quaternion.copy(parentRotation.invert().multiply(basisDelta.multiply(rotation)));
  limb.hand.updateWorldMatrix(false,true);
 }

 /**
  * Solves two-bone arm IK + anatomical palm orientation + finger curl so the hollow of the hand
  * wraps directly around the handlebar or steering wheel grip coordinate in root space.
  */
 function fitPalmToGrip(
  limb:typeof limbs[number],
  gx:number,
  gy:number,
  gz:number,
  px:number,
  py:number,
  pz:number,
  fwdX:number,
  fwdY:number,
  fwdZ:number,
  inwardX:number,
  inwardY:number,
  inwardZ:number,
  fingerCurl:number,
 ){
  const s=limb.side;
  gripWorld.set(gx,gy,gz).applyMatrix4(root.matrixWorld);
  pole.set(px,py,pz).transformDirection(root.matrixWorld).normalize();
  wristWorld.set(gx-s*.006,gy+.028,gz+.088).applyMatrix4(root.matrixWorld);

  const armRestQ=rest.get(limb.arm)!;
  const foreRestQ=rest.get(limb.forearm)!;
  const handRestQ=rest.get(limb.hand)!;

  for(let iter=0;iter<3;iter++){
   limb.arm.quaternion.copy(armRestQ);
   limb.forearm.quaternion.copy(foreRestQ);
   limb.hand.quaternion.copy(handRestQ);
   for(const f of limb.fingers)for(const joint of f.joints)joint.quaternion.copy(rest.get(joint)!);
   for(const joint of limb.thumb)joint.quaternion.copy(rest.get(joint)!);
   limb.arm.updateWorldMatrix(true,true);

   rotateAxis(limb.arm,0,0,1,-s*limb.neutralAdduction);
   limb.fitArm(wristWorld,pole);
   orientHandOnGrip(limb,fwdX,fwdY,fwdZ,inwardX,inwardY,inwardZ);
   curlHand(limb,fingerCurl);

   if(!limb.mid1||!limb.mid2)break;
   limb.mid1.getWorldPosition(gripCenterA);
   limb.mid2.getWorldPosition(gripCenterB);
   gripCenterA.add(gripCenterB).multiplyScalar(.5);
   limb.hand.getWorldPosition(gripCenterB);
   wristWorld.copy(gripWorld).add(gripCenterB).sub(gripCenterA);
  }
 }

 function update(motion:Motion,riding=false,driving?:Driving,delta?:number){
  for(let i=0;i<restList.length;i++)restList[i].bone.quaternion.copy(restList[i].q);
  hips.position.copy(hipsRestPos);

  currentClip=selectBoyClip(motion,riding,!!driving);
  const seated=riding||!!driving;
  const rawSpeed=seated?0:motion.speed;
  const absSpeed=Math.abs(rawSpeed);
  const rawBend=seated?0:clamp(motion.jumpBend??0,0,1);
  const rawAirborne=!seated&&motion.airborne?1:0;
  const rawJump=Math.max(rawAirborne,rawBend>.01?1:0);
  const specialStepDt=delta!==undefined&&delta>0?Math.min(delta,.06):0;
  if(animController.stepBlend(seated,absSpeed>.35||rawJump>.5,specialStepDt)){
   onSpecialStoppedCb?.();
  }
  const targetMove=seated||rawAirborne>.5?0:clamp((absSpeed-.05)/.75,0,1);
  const targetRun=clamp((absSpeed-4.3)/3.2,0,1);

  if(delta!==undefined&&delta>0){
   const dt=Math.min(delta,.06);
   idleClock+=dt;
   eyeBlink.step(dt);
   smoothSpeed=damp(smoothSpeed,rawSpeed,12,dt);
   moveWeight=damp(moveWeight,targetMove,10,dt);
   runWeight=damp(runWeight,targetRun,8,dt);
   jumpWeight=damp(jumpWeight,rawJump,14,dt);
   smoothJumpBend=damp(smoothJumpBend,rawBend,16,dt);
   smoothAirborne=damp(smoothAirborne,rawAirborne,14,dt);
   smoothVy=damp(smoothVy,motion.jumpVelocity??0,12,dt);

   if(lastDistance!==null){
    const dDist=motion.distance-lastDistance;
    const stepScale=lerp(4.0,2.75,runWeight);
    gaitPhase+=dDist*stepScale;
   }else{
    const direction=rawSpeed<0?-1:1;
    const stepScale=lerp(4.0,2.75,runWeight);
    gaitPhase+=direction*Math.abs(smoothSpeed)*stepScale*dt;
   }
   lastDistance=motion.distance;
  }else{
   smoothSpeed=rawSpeed;
   moveWeight=targetMove;
   runWeight=targetRun;
   jumpWeight=rawJump;
   smoothJumpBend=rawBend;
   smoothAirborne=rawAirborne;
   smoothVy=motion.jumpVelocity??0;
   gaitPhase=motion.distance*lerp(4.2,2.85,runWeight);
   lastDistance=motion.distance;
  }

  // Subtle multi-harmonic idle breathing & contraposto weight shift
  const breath=Math.sin(idleClock*2.1)+.25*Math.sin(idleClock*4.2);
  const idleShift=Math.sin(idleClock*.95);
  const idleWeight=clamp(1-moveWeight-jumpWeight,0,1);

  // Locomotion pelvis bounce, lateral sway, and 3D rotation
  const walkBounce=.015*Math.cos(2*gaitPhase-.35)-.011;
  const runBounce=.038*Math.cos(2*gaitPhase-.45)-.034;
  const locoBounce=lerp(walkBounce,runBounce,runWeight)*moveWeight;
  const locoSwayX=lerp(.016,.011,runWeight)*Math.cos(gaitPhase)*moveWeight;
  const idleBob=-.0035*(1-Math.sin(idleClock*2.1))*idleWeight;
  const idleSwayX=.005*idleShift*idleWeight;

  const motoVib=riding&&Math.abs(motion.speed)>.15?Math.sin(idleClock*18+.8*motion.distance)*.003:0;
  const crouchDrop=-smoothJumpBend*.13*(1-smoothAirborne*.5);
  // In root space (offset [0, 0.10, 0.26] in Player.tsx), the motorcycle seat cushion top is at
  // y = 0.695 (z = -0.209..+0.516, passenger strap at +0.210). Placing Hips bone at y = 0.855
  // (avatar y = 0.955) and z = +0.065 (avatar z = +0.325) seats buttocks squarely on the black cushion.
  const seatY=riding?.855-hipHeight+motoVib:.707-hipHeight;
  const seatZ=riding?-hipsRestZ+.065:driving?-shortArmFactor*.4:0;

  placement.position.set(
   seated?0:locoSwayX+idleSwayX,
   seated?seatY:locoBounce+idleBob+crouchDrop,
   seated?seatZ:0,
  );
  head.scale.setScalar(driving?.interior?.001:1);

  // 1. Pelvis (Hips) 3D orientation
  const hipYaw=seated?0:lerp(.068,.125,runWeight)*Math.sin(gaitPhase)*moveWeight+.015*Math.cos(idleClock*.95)*idleWeight;
  const hipRoll=seated?0:lerp(.042,.068,runWeight)*Math.cos(gaitPhase)*moveWeight+.012*idleShift*idleWeight;
  const hipPitch=riding?.22+shortArmFactor*.6:driving?0:lerp(.015,.065,runWeight)*moveWeight-.08*smoothAirborne;

  // 2. Three-segment Spine (Spine, Spine1, Spine2) counter-rotation, forward lean & breathing
  let totalSpinePitch=0;
  let totalSpineYaw=0;
  let totalSpineRoll=0;
  if(driving){
   totalSpinePitch=-.02+shortArmFactor*.8+.01*breath;
  }else if(riding){
   const baseRideLean=Math.abs(motion.speed)>.15?.50:.46;
   totalSpinePitch=baseRideLean+shortArmFactor*2.6+.008*breath;
  }else{
   const locoLean=lerp(.045,.23,runWeight)+lerp(.01,.025,runWeight)*Math.sin(2*gaitPhase);
   const jumpLean=.16*smoothJumpBend-.06*smoothAirborne*clamp(smoothVy/5,-1,1);
   const idleBreathPitch=-.016*breath*idleWeight;
   totalSpinePitch=locoLean*moveWeight+jumpLean*jumpWeight+idleBreathPitch;
   totalSpineYaw=-lerp(.095,.19,runWeight)*Math.sin(gaitPhase)*moveWeight-.015*Math.cos(idleClock*.95)*idleWeight;
   totalSpineRoll=-lerp(.038,.062,runWeight)*Math.cos(gaitPhase)*moveWeight-.01*idleShift*idleWeight;
  }

  // 3. Neck & Head stabilization + natural micro-gaze
  const headCounterPitch=driving?.02:riding?(hipPitch+totalSpinePitch)*.85:totalSpinePitch*.68-.012*breath*idleWeight;
  const headCounterYaw=-totalSpineYaw*.65+.028*Math.sin(idleClock*.55)*idleWeight;
  const headCounterRoll=-totalSpineRoll*.7;

  const vyFactor=clamp(smoothVy/5.5,-1,1);

  if(seated){
   // Seated vehicle IK path reads bone world matrices for exact steering/handlebar grip placement
   root.updateWorldMatrix(true,true);
   rotateAxis(hips,0,1,0,hipYaw);
   rotateAxis(hips,0,0,1,hipRoll);
   rotateAxis(hips,1,0,0,-hipPitch);
   const segCount=Math.max(1,spineSegments.length);
   for(let i=0;i<spineSegments.length;i++){
    const seg=spineSegments[i];
    rotateAxis(seg,1,0,0,-totalSpinePitch/segCount);
    rotateAxis(seg,0,1,0,totalSpineYaw/segCount);
    rotateAxis(seg,0,0,1,totalSpineRoll/segCount);
   }
   rotateAxis(neck,1,0,0,headCounterPitch*.52);
   rotateAxis(neck,0,1,0,headCounterYaw*.5);
   rotateAxis(neck,0,0,1,headCounterRoll*.5);
   rotateAxis(head,1,0,0,headCounterPitch*.44);
   rotateAxis(head,0,1,0,headCounterYaw*.5);
   rotateAxis(head,0,0,1,headCounterRoll*.5);

   for(let li=0;li<limbs.length;li++){
    const limb=limbs[li];
    const s=limb.side;
    const fingerCurl=riding?.98:.82;
    if(driving){
     const x=(s<0?.12:driving.brake?.28:.43)-.28;
     fit(limb.fitLeg,x/.8,.29,-.70,0,0,-1);
     rotateAxis(limb.foot,1,0,0,.12);
     rotateAxis(limb.shoulder,0,0,1,-s*.05);
     driverGrip(s,driving.wheelAngle,point);
     fitPalmToGrip(limb,point.x,point.y,point.z-.025,s*.45,-.55,.50,0,-.2,-1,-s,0,0,fingerCurl);
    }else{
     fit(limb.fitLeg,s*.21,.255,-.205,s*.45,.04,-1);
     rotateAxis(limb.foot,1,0,0,.03);
     rotateAxis(limb.shoulder,0,0,1,-s*(.08+shortArmFactor*1.2));
     rotateAxis(limb.shoulder,0,1,0,s*(.24+shortArmFactor*2.6));
     fitPalmToGrip(limb,s*.270,.834,-.514,s*.45,-.65,.45,0,-.44,-1,-s,0,0,fingerCurl);
    }
   }
   return;
  }

  // Fast pure-quaternion standing/walk/run/jump path (zero recursive updateWorldMatrix calls)
  root.getWorldQuaternion(rootRotation);
  getWorldQuatRef(root).copy(rootRotation);
  for(let i=0;i<hipsAncestors.length;i++){
   const step=hipsAncestors[i];
   step.wq.multiplyQuaternions(step.pwq,step.obj.quaternion);
  }

  const hipsPWQ=ensureParentQuatRef(hips.parent);
  rotateAxisWithParentQuat(hips,hipsPWQ,0,1,0,hipYaw);
  rotateAxisWithParentQuat(hips,hipsPWQ,0,0,1,hipRoll);
  rotateAxisWithParentQuat(hips,hipsPWQ,1,0,0,-hipPitch);
  getWorldQuatRef(hips).multiplyQuaternions(hipsPWQ,hips.quaternion);

  const segCount=Math.max(1,spineSegments.length);
  for(let i=0;i<spineSegments.length;i++){
   const seg=spineSegments[i];
   const pwq=ensureParentQuatRef(seg.parent);
   rotateAxisWithParentQuat(seg,pwq,1,0,0,-totalSpinePitch/segCount);
   rotateAxisWithParentQuat(seg,pwq,0,1,0,totalSpineYaw/segCount);
   rotateAxisWithParentQuat(seg,pwq,0,0,1,totalSpineRoll/segCount);
   getWorldQuatRef(seg).multiplyQuaternions(pwq,seg.quaternion);
  }

  if(neck){
   const neckPWQ=ensureParentQuatRef(neck.parent);
   rotateAxisWithParentQuat(neck,neckPWQ,1,0,0,headCounterPitch*.52);
   rotateAxisWithParentQuat(neck,neckPWQ,0,1,0,headCounterYaw*.5);
   rotateAxisWithParentQuat(neck,neckPWQ,0,0,1,headCounterRoll*.5);
   getWorldQuatRef(neck).multiplyQuaternions(neckPWQ,neck.quaternion);
  }
  const headPWQ=ensureParentQuatRef(head.parent);
  rotateAxisWithParentQuat(head,headPWQ,1,0,0,headCounterPitch*.44);
  rotateAxisWithParentQuat(head,headPWQ,0,1,0,headCounterYaw*.5);
  rotateAxisWithParentQuat(head,headPWQ,0,0,1,headCounterRoll*.5);
  getWorldQuatRef(head).multiplyQuaternions(headPWQ,head.quaternion);

  for(let li=0;li<limbs.length;li++){
   const limb=limbs[li];
   const s=limb.side;
   const legPhase=gaitPhase+(s<0?0:Math.PI);
   const armPhase=gaitPhase+(s<0?Math.PI:0);
   const fingerCurl=lerp(.28,lerp(.32,.62,runWeight),moveWeight)+.12*jumpWeight;

   // --- LEGS ---
   const sinP=Math.sin(legPhase),cos2P=Math.cos(2*legPhase);
   const walkThigh=.44*sinP-.06*cos2P-.03;
   const runThigh=.78*sinP-.15*cos2P+.10;
   const locoThigh=lerp(walkThigh,runThigh,runWeight)*moveWeight;

   const swingClear=Math.max(0,Math.cos(legPhase-.28));
   const stanceAbsorb=Math.max(0,Math.sin(legPhase-.35));
   const walkKnee=swingClear*swingClear*.66+stanceAbsorb*.10+.04;
   const runKnee=swingClear*swingClear*1.32+stanceAbsorb*.22+.16;
   const locoKnee=lerp(walkKnee,runKnee,runWeight)*moveWeight;

   const heelStrike=Math.max(0,Math.sin(legPhase-.1))*lerp(.20,.28,runWeight);
   const pushOff=Math.max(0,-Math.sin(legPhase+.2))*lerp(.25,.40,runWeight);
   const locoAnkle=(heelStrike-pushOff+.22*swingClear*swingClear)*moveWeight;
   const locoToe=Math.max(0,-Math.sin(legPhase+.1))*lerp(.24,.38,runWeight)*moveWeight;

   const airAsym=s*.12*smoothAirborne;
   const airTuck=smoothAirborne*(.68+.18*vyFactor+airAsym);
   const jumpThigh=smoothJumpBend*.66*(1-smoothAirborne)+airTuck;
   const jumpKnee=smoothJumpBend*1.32*(1-smoothAirborne)+smoothAirborne*(1.18-.22*vyFactor+s*.15);
   const jumpAnkle=smoothJumpBend*.52*(1-smoothAirborne)-smoothAirborne*(.24-.15*vyFactor);

   const idleKnee=(.035+s*.015*idleShift)*idleWeight;
   const idleThigh=.5*idleKnee;
   const idleAnkle=.5*idleKnee;

   const thighPitch=locoThigh+jumpThigh+idleThigh;
   const kneeBend=locoKnee+jumpKnee+idleKnee;
   const anklePitch=locoAnkle+jumpAnkle+idleAnkle;

   const thighPWQ=ensureParentQuatRef(limb.thigh.parent);
   rotateAxisWithParentQuat(limb.thigh,thighPWQ,1,0,0,thighPitch);
   rotateAxisWithParentQuat(limb.thigh,thighPWQ,0,0,1,-hipRoll*.6);
   getWorldQuatRef(limb.thigh).multiplyQuaternions(thighPWQ,limb.thigh.quaternion);

   const shinPWQ=ensureParentQuatRef(limb.shin.parent);
   rotateAxisWithParentQuat(limb.shin,shinPWQ,1,0,0,-kneeBend);
   getWorldQuatRef(limb.shin).multiplyQuaternions(shinPWQ,limb.shin.quaternion);

   const footPWQ=ensureParentQuatRef(limb.foot.parent);
   rotateAxisWithParentQuat(limb.foot,footPWQ,1,0,0,anklePitch);
   getWorldQuatRef(limb.foot).multiplyQuaternions(footPWQ,limb.foot.quaternion);

   if(limb.toe){
    const toePWQ=ensureParentQuatRef(limb.toe.parent);
    rotateAxisWithParentQuat(limb.toe,toePWQ,1,0,0,locoToe);
   }

   // --- ARMS ---
   const sinArm=Math.sin(armPhase),cos2Arm=Math.cos(2*armPhase);
   const delayedSin=Math.sin(armPhase-.32);

   if(limb.shoulder){
    const shoulderDrop=-s*(.055-.008*breath*idleWeight);
    const shoulderYaw=-s*lerp(.04,.085,runWeight)*sinArm*moveWeight;
    const shoulderPWQ=ensureParentQuatRef(limb.shoulder.parent);
    rotateAxisWithParentQuat(limb.shoulder,shoulderPWQ,0,0,1,shoulderDrop);
    rotateAxisWithParentQuat(limb.shoulder,shoulderPWQ,0,1,0,shoulderYaw);
    getWorldQuatRef(limb.shoulder).multiplyQuaternions(shoulderPWQ,limb.shoulder.quaternion);
   }

   const jumpArmSpread=.24*smoothAirborne+.08*smoothJumpBend;
   const runArmFlare=lerp(0,.08,runWeight)*moveWeight;
   const breathFlare=.012*(1+breath)*idleWeight;
   const adduction=Math.max(0,limb.neutralAdduction-jumpArmSpread-runArmFlare-breathFlare);

   const walkArmPitch=.34*sinArm-.04*cos2Arm+.02;
   const runArmPitch=.60*sinArm-.10*cos2Arm-.10;
   const locoArmPitch=lerp(walkArmPitch,runArmPitch,runWeight)*moveWeight;
   const jumpArmPitch=-.32*smoothJumpBend*(1-smoothAirborne)+smoothAirborne*(.72+.28*vyFactor);
   const idleArmPitch=(.03+.012*Math.cos(idleClock*2.1))*idleWeight;

   const armPWQ=ensureParentQuatRef(limb.arm.parent);
   rotateAxisWithParentQuat(limb.arm,armPWQ,0,0,1,-s*adduction);
   rotateAxisWithParentQuat(limb.arm,armPWQ,1,0,0,locoArmPitch+jumpArmPitch+idleArmPitch);
   getWorldQuatRef(limb.arm).multiplyQuaternions(armPWQ,limb.arm.quaternion);

   const walkElbow=.24+.22*Math.max(0,delayedSin);
   const runElbow=1.26+.30*delayedSin;
   const locoElbow=lerp(walkElbow,runElbow,runWeight)*moveWeight;
   const jumpElbow=(.42*smoothJumpBend+.55*smoothAirborne)*jumpWeight;
   const idleElbow=(.18+.015*breath)*idleWeight;
   const crossBody=-s*(lerp(.08,.26,runWeight)*moveWeight+.07*idleWeight);

   const forePWQ=ensureParentQuatRef(limb.forearm.parent);
   rotateAxisWithParentQuat(limb.forearm,forePWQ,0,1,0,crossBody);
   rotateAxisWithParentQuat(limb.forearm,forePWQ,1,0,0,locoElbow+jumpElbow+idleElbow);
   const forearmWQ=getWorldQuatRef(limb.forearm).multiplyQuaternions(forePWQ,limb.forearm.quaternion);

   const handWQ=getWorldQuatRef(limb.hand).multiplyQuaternions(forearmWQ,limb.hand.quaternion);
   curlHandFast(limb,handWQ,fingerCurl);
  }

  animController.applyPose(
   specialStepDt,
   restList,
   procQuats,
   procPlacementPos,
   hips,
   hipsRestPos,
   placement,
  );
 }

 function setCastShadow(enabled:boolean){
  for(let i=0;i<meshes.length;i++)meshes[i].castShadow=enabled;
 }

 function dispose(){
  animController.dispose();
  eyeBlink.dispose();
  // Geometry and textures remain owned by the shared GLTF cache.
  object.traverse(child=>{if(child instanceof SkinnedMesh)child.skeleton.dispose();});
 }
 return {
  root,
  object,
  update,
  dispose,
  setCastShadow,
  setSpecialClip,
  setSpecialLoop(loop:boolean){animController.setLoop(loop);},
  setSpecialSpeed(speed:number){animController.setSpeed(speed);},
  onSpecialFinished(listener:(()=>void)|null){animController.onFinished(listener);},
  onSpecialStopped(listener:(()=>void)|null){onSpecialStoppedCb=listener;},
  specialBlend:()=>animController.blend,
  specialClipName:()=>animController.currentClipName,
  clip:()=>currentClip,
  blink:eyeBlink.value,
 };
}
