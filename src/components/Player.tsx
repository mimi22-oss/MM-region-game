import {rideLife,hitRide,tickRideLife} from '../game/rideLife';
import {hitsTraffic} from '../game/trafficColliders';
import {motorcycleData} from '../data/motorcycle';
import {resetMobileInput} from '../game/mobileInput';
import { sceneGround,motorcycleGroundPose } from '../game/groundSurface';
import { motorcycleRide,tryMount,parkMotorcycle,dismountSpot,stepMotorcycle,type RideStatus } from '../game/motorcycleRide';
import { MotorcycleModel,ParkedMotorcycle } from './Motorcycle';
import { updateHomeAccess } from '../game/homeAccess';
import { panCamera, findTeleportSpot } from '../game/cameraNavigation';
import { avatarHeading } from '../game/avatarHeading';
import { RobotCharacter } from './RobotCharacter';
import { CartoonCharacter } from './CartoonCharacter';
import type { CharacterKind } from './CharacterPicker';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MobileInput } from '../game/mobileInput';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3, Raycaster, Object3D } from 'three';
import { ward } from '../data/ward';
import { canStand, move, PLAYER_RADIUS } from '../game/collision';

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 3600;
export const SKY_PITCH = -Math.PI / 2 + 0.001;

export type TeleportTarget = {
 x:number;
 z:number;
 yaw?:number;
 pitch?:number;
 distance?:number;
 seq:number;
};

export function Player({
 character='robot',
 speedLimit=20,braking=false,accelerating=false,controlsBlocked=false,dismountRequest=0,onRideStatus,
 navigationRequest,
 onNavigationResult,
 mobileInput,
 mapOpen,
 topDown,
 zoom,
 teleportTarget,
 onMode,
 onTopDown,
 onZoom,
 onLock,
 onViewPosition,
 onPosition,
}:{
 character?:CharacterKind;
 speedLimit?:number;braking?:boolean;accelerating?:boolean;controlsBlocked?:boolean;dismountRequest?:number;onRideStatus?:(s:RideStatus)=>void;
 navigationRequest?:{action:"locate"|"teleport";seq:number}|null;
 onNavigationResult?:(success:boolean)=>void;
 mobileInput?:RefObject<MobileInput>;
 mapOpen:boolean;
 topDown:boolean;
 zoom:number;
 teleportTarget?:TeleportTarget|null;
 onMode:(v:boolean)=>void;
 onTopDown:(v:boolean)=>void;
 onZoom:(v:number)=>void;
 onLock:(v:boolean)=>void;
 onViewPosition?:(x:number,z:number)=>void;
 onPosition:(x:number,z:number,yaw?:number)=>void;
}){
 const {camera,gl,scene}=useThree();
 const avatar=useRef<Group>(null);
 const wheels=useRef<Group>(null);
 const [riding,setRiding]=useState(false);
 const rideNotice=useRef('');
 const characterMotion=useRef({speed:0,distance:0,stepLift:0,leftFoot:0,rightFoot:0});

 const state=useRef({
  x:ward.spawn.x,
  z:ward.spawn.z,
  camX:ward.spawn.x,
  camZ:ward.spawn.z,
  yaw:ward.spawnYaw,
  bodyYaw:ward.spawnYaw,
  mobileSession:-1,
  pitch:-0.12,
  distance:ward.spawnZoom,
  targetDistance:ward.spawnZoom,
  first:false,
  topDown:false,
  dragging:false,
  shiftDrag:false,
  panning:false,
  dragMoved:0,
  keys:new Set<string>(),
  locked:false,
  time:0,
 });
 const panView=(dx:number,dy:number)=>{
  const s=state.current;
  s.panning=true;
  if(s.first){s.first=false;onMode(false)}
    const panScale=Math.max(0.55,s.distance*0.0022);
    const panRight=-dx*panScale;
    const panForward=dy*panScale;
    const edge=ward.size/2-PLAYER_RADIUS;
    panCamera(s,panRight,panForward,edge);
 };
 const applyZoom=(raw:number)=>{
  const s=state.current,previous=s.targetDistance;
  const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,raw));
  if(s.first){s.first=false;onMode(false)}
   s.targetDistance=next;
   if(s.topDown){
    s.pitch=SKY_PITCH;
   }else if(next>previous&&next>8){
    const aerialPitch=-0.12-Math.min(1,(next-8)/200)*(Math.abs(SKY_PITCH)-0.12);
    if(s.pitch>aerialPitch)s.pitch=aerialPitch;
   }else if(next<previous&&next<80){
    const streetPitch=-0.12-Math.max(0,(next-6)/74)*(Math.abs(SKY_PITCH)-0.12);
    if(s.pitch<streetPitch)s.pitch=streetPitch;
   }
   onZoom(next);
 };
 useEffect(()=>{state.current.keys.clear();motorcycleRide.speed=0},[mapOpen,controlsBlocked]);
 useEffect(()=>{motorcycleRide.maxKmh=speedLimit},[speedLimit]);
 useEffect(()=>{
  if(!dismountRequest||!motorcycleRide.riding||rideLife.crashTime>0)return;
  const spot=dismountSpot(canStand);
  if(!spot){rideNotice.current='No clear space to get off. Move to an open area.';return;}
  parkMotorcycle();setRiding(false);rideNotice.current='';
  const s=state.current;s.x=spot.x;s.z=spot.z;s.camX=s.x;s.camZ=s.z;s.keys.clear();
 },[dismountRequest]);
 useEffect(()=>{
  const s=state.current;
  s.targetDistance=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom));
 },[zoom]);
 useEffect(()=>{
  const s=state.current;
  if(s.topDown===topDown)return;
  s.topDown=topDown;
  if(topDown){
   s.first=false;
   s.pitch=SKY_PITCH;
  }else if(s.pitch<=-1.48){
   s.pitch=-0.12;
   s.camX=s.x;
   s.camZ=s.z;
  }
 },[topDown]);
 useEffect(()=>{
  if(!teleportTarget||rideLife.crashTime>0)return;
  if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
  const s=state.current;
  s.x=teleportTarget.x;
  s.z=teleportTarget.z;
  s.camX=teleportTarget.x;
  s.camZ=teleportTarget.z;
  if(teleportTarget.yaw!==undefined)s.yaw=teleportTarget.yaw;
  s.bodyYaw=s.yaw;
  s.pitch=teleportTarget.pitch??-0.16;
  s.first=false;
  s.topDown=false;
  s.panning=false;
  const dist=teleportTarget.distance??10;
  s.distance=dist;
  s.targetDistance=dist;
  onPosition(s.x,s.z,s.bodyYaw);
 },[teleportTarget,onPosition]);
 useEffect(()=>{
  if(!navigationRequest||rideLife.crashTime>0)return;
  const s=state.current;
  if(navigationRequest.action==='teleport'){
   const spot=findTeleportSpot(s.camX,s.camZ,canStand);
   if(!spot){onNavigationResult?.(false);return}
   if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
   s.x=spot.x;s.z=spot.z;
  }
  s.camX=s.x;s.camZ=s.z;s.panning=false;s.first=false;s.topDown=false;
  s.pitch=-.16;s.distance=10;s.targetDistance=10;s.keys.clear();
  onMode(false);onTopDown(false);onZoom(10);onPosition(s.x,s.z,s.bodyYaw);onNavigationResult?.(true);
 },[navigationRequest,onNavigationResult,onMode,onTopDown,onZoom,onPosition]);
 const target=useRef(new Vector3()); const desired=useRef(new Vector3()); const ray=useRef(new Raycaster());
 useEffect(()=>{
  const s=state.current;
  const clear=()=>{motorcycleRide.speed=0;s.keys.clear();s.dragging=false;s.shiftDrag=false;gl.domElement.style.cursor=''};
  const lock=()=>{s.locked=document.pointerLockElement===gl.domElement;clear();onLock(s.locked)};
  const key=(e:KeyboardEvent)=>{
   const movement=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyR","KeyT"].includes(e.code);
   if(!s.locked&&!mapOpen&&!movement&&e.type!=="keyup")return;
   if(e.target instanceof HTMLElement&&e.target.matches("input,textarea,select"))return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyV','KeyR','KeyT'].includes(e.code))e.preventDefault();
   if(e.type==='keyup'){
    s.keys.delete(e.code);
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){
     const shiftStillHeld=s.keys.has('ShiftLeft')||s.keys.has('ShiftRight');
     if(!shiftStillHeld){
      s.shiftDrag=false;
      gl.domElement.style.cursor='';
     }
    }
   }else{
    s.keys.add(e.code);
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){
     if(!motorcycleRide.riding){
      const walkKeyHeld=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].some(k=>s.keys.has(k));
      if(!walkKeyHeld&&document.pointerLockElement===gl.domElement){
       document.exitPointerLock();
      }
      gl.domElement.style.cursor=s.dragging?'grabbing':'grab';
     }
    }
    if(!e.repeat&&e.code==='KeyV'){
     s.first=!s.first;
     if(s.first){s.topDown=false;s.panning=false;onTopDown(false);}
     onMode(s.first);
    }
    if(!e.repeat&&e.code==='KeyT'){
     const nextTop=!s.topDown;
     s.topDown=nextTop;
     if(nextTop){
      s.first=false;onMode(false);
      s.pitch=SKY_PITCH;
      if(s.targetDistance<80){s.targetDistance=260;onZoom(260);}
     }else{
      s.pitch=-0.12;s.targetDistance=6;s.panning=false;s.camX=s.x;s.camZ=s.z;onZoom(6);
     }
     onTopDown(nextTop);
    }
    if(e.code==='KeyR'&&rideLife.crashTime<=0){
     if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
     s.x=ward.spawn.x;s.z=ward.spawn.z;s.camX=ward.spawn.x;s.camZ=ward.spawn.z;
     s.yaw=ward.spawnYaw;s.bodyYaw=ward.spawnYaw;s.pitch=-0.12;s.topDown=false;s.panning=false;s.targetDistance=ward.spawnZoom;
     onTopDown(false);onZoom(ward.spawnZoom);onPosition(s.x,s.z,s.bodyYaw);
    }
   }
  };
  const mouse=(e:MouseEvent)=>{
   if(!s.locked&&!s.dragging)return;
   if(s.dragging)s.dragMoved+=Math.hypot(e.movementX,e.movementY);
   const isShiftDrag=s.dragging&&(s.shiftDrag||e.shiftKey||s.keys.has('ShiftLeft')||s.keys.has('ShiftRight'));
   if(isShiftDrag){
    s.shiftDrag=true;
    s.panning=true;
    gl.domElement.style.cursor='grabbing';
    panView(e.movementX,e.movementY);
    return;
   }
   s.yaw-=e.movementX*0.002;
   const maxPitch=!s.first&&s.targetDistance>10?-0.08:0.85;
   s.pitch=Math.max(SKY_PITCH,Math.min(maxPitch,s.pitch-e.movementY*0.002));
   if(s.pitch<=-1.55&&!s.topDown){s.topDown=true;onTopDown(true);}
   else if(s.pitch>-1.45&&s.topDown){s.topDown=false;onTopDown(false);}
  };
  const down=(e:MouseEvent)=>{
   if(mapOpen||e.button!==0)return;
   s.dragging=true;
   s.dragMoved=0;
   s.shiftDrag=e.shiftKey||s.keys.has('ShiftLeft')||s.keys.has('ShiftRight');
   if(s.shiftDrag){
    if(document.pointerLockElement===gl.domElement)document.exitPointerLock();
    gl.domElement.style.cursor='grabbing';
   }
  };
  const up=()=>{
   s.dragging=false;
   s.shiftDrag=false;
   const shiftHeld=s.keys.has('ShiftLeft')||s.keys.has('ShiftRight');
   gl.domElement.style.cursor=shiftHeld?'grab':'';
  };
  const click=(e:MouseEvent)=>{
   if(mapOpen||s.dragMoved>5||e.shiftKey||s.keys.has('ShiftLeft')||s.keys.has('ShiftRight'))return;
   if(document.pointerLockElement!==gl.domElement)gl.domElement.requestPointerLock()?.catch(()=>onLock(false));
  };
  const wheel=(e:WheelEvent)=>{
   if(mapOpen||(e.target instanceof HTMLElement&&e.target.closest('.settings-menu,.ride-controls')))return;
   e.preventDefault();
   if(s.first&&e.deltaY>0){
    s.first=false;onMode(false);
    s.distance=MIN_ZOOM;s.targetDistance=MIN_ZOOM;
   }
   const factor=Math.exp(Math.max(-160,Math.min(160,e.deltaY))*0.0022);
   const raw=e.deltaY>0?Math.max(s.targetDistance+0.8,s.targetDistance*factor):Math.min(s.targetDistance-0.5,s.targetDistance*factor);
   const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,raw));
   applyZoom(next);
  };
  document.addEventListener('pointerlockchange',lock);document.addEventListener('keydown',key);document.addEventListener('keyup',key);document.addEventListener('mousemove',mouse);document.addEventListener('mouseup',up);window.addEventListener('blur',clear);window.addEventListener('wheel',wheel,{passive:false});gl.domElement.addEventListener('mousedown',down);gl.domElement.addEventListener('click',click);
  return ()=>{document.removeEventListener('pointerlockchange',lock);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key);document.removeEventListener('mousemove',mouse);document.removeEventListener('mouseup',up);window.removeEventListener('blur',clear);window.removeEventListener('wheel',wheel);gl.domElement.removeEventListener('mousedown',down);gl.domElement.removeEventListener('click',click);if(document.pointerLockElement===gl.domElement)document.exitPointerLock()};
 },[gl,onLock,onMode,onTopDown,onZoom,mapOpen]);
 useFrame(({clock},delta)=>{
  const s=state.current;const dt=Math.min(delta,0.05);
  const ground=sceneGround(scene,clock.elapsedTime);
  const height=(x:number,z:number)=>ground.height(x,z);
  const clear=(x:number,z:number)=>canStand(x,z)&&height(x,z)-height(motorcycleRide.riding?motorcycleRide.x:s.x,motorcycleRide.riding?motorcycleRide.z:s.z)<.5;
  if(tickRideLife(dt)){
   parkMotorcycle();setRiding(false);
   Object.assign(motorcycleRide,{x:motorcycleData.x,z:motorcycleData.z,yaw:motorcycleData.rotation,mustLeave:false,distance:0});
   Object.assign(s,{x:ward.spawn.x,z:ward.spawn.z,camX:ward.spawn.x,camZ:ward.spawn.z,yaw:ward.spawnYaw,bodyYaw:ward.spawnYaw,panning:false,first:false,topDown:false,pitch:-.12,distance:ward.spawnZoom,targetDistance:ward.spawnZoom});
   s.keys.clear();if(mobileInput?.current)resetMobileInput(mobileInput.current);
   onMode(false);onTopDown(false);onZoom(ward.spawnZoom);rideNotice.current='';
  }
  updateHomeAccess(s.x,s.z,dt);
  let oldX=s.x,oldZ=s.z;
  const touch=mobileInput?.current;
  if(touch){
   if(touch.panX||touch.panY){panView(touch.panX,touch.panY);touch.panX=0;touch.panY=0;}
   if(touch.zoomFactor!==1){applyZoom(s.targetDistance*touch.zoomFactor);touch.zoomFactor=1;}
   if(touch.lookX||touch.lookY){s.yaw-=touch.lookX*0.004;s.pitch=Math.max(-1.35,Math.min(0.6,s.pitch-touch.lookY*0.004));if(s.topDown){s.topDown=false;onTopDown(false)}touch.lookX=0;touch.lookY=0;}
   if(touch.active&&s.mobileSession!==touch.session){s.mobileSession=touch.session;s.first=false;s.panning=false;s.camX=s.x;s.camZ=s.z;onMode(false)}
  }
  s.distance+=(s.targetDistance-s.distance)*Math.min(1,dt*12);
  let forward=Number(s.keys.has('KeyW')||s.keys.has('ArrowUp'))-Number(s.keys.has('KeyS')||s.keys.has('ArrowDown'));
  let right=Number(s.keys.has('KeyD')||s.keys.has('ArrowRight'))-Number(s.keys.has('KeyA')||s.keys.has('ArrowLeft'));
  if(touch?.active){forward=touch.forward;right=touch.right;}
  if(controlsBlocked||mapOpen||rideLife.crashTime>0){forward=0;right=0;}
  const len=Math.hypot(forward,right);if(len){forward/=len;right/=len;}
  const fast=s.keys.has('ShiftLeft')||s.keys.has('ShiftRight')||!!touch?.sprint;
  const yaw=mapOpen?0:s.yaw;
  if(len>0&&s.distance<=20&&!s.topDown)s.panning=false;
  const aerial=!touch?.active&&!s.first&&(s.distance>20||s.topDown||s.panning);
  const ride=motorcycleRide;
  ride.cooldown=Math.max(0,ride.cooldown-dt);
  const near=character==='cartoon'&&Math.hypot(s.x-ride.x,s.z-ride.z)<1.6;
  if(ride.mustLeave&&Math.hypot(s.x-ride.x,s.z-ride.z)>2.3)ride.mustLeave=false;
  if(!ride.riding&&!ride.mustLeave&&near&&!aerial&&!controlsBlocked&&!mapOpen){
   ride.nearTime+=dt;
   if(ride.nearTime>.65&&tryMount(s.x,s.z,canStand)){
    setRiding(true);rideNotice.current='';s.x=ride.x;s.z=ride.z;s.bodyYaw=ride.yaw;s.yaw=ride.yaw;s.panning=false;
    oldX=s.x;oldZ=s.z;s.targetDistance=5;onZoom(5);
   }
  }else if(!ride.riding)ride.nearTime=0;
  if(ride.riding){
   const isShift=s.keys.has('ShiftLeft')||s.keys.has('ShiftRight')||!!touch?.sprint;
   const isBtnAcc=accelerating||ride.accelerating;
   const isBoosting=isShift||isBtnAcc;
   const isBrk=braking||ride.braking||s.keys.has('Space');
   let steer=right,throttle=forward;
   if(touch?.active){
    const tx=-Math.sin(yaw)*forward+Math.cos(yaw)*right,tz=-Math.cos(yaw)*forward-Math.sin(yaw)*right;
    const targetYaw=Math.atan2(-tx,-tz),error=Math.atan2(Math.sin(targetYaw-ride.yaw),Math.cos(targetYaw-ride.yaw));
    steer=-Math.max(-1,Math.min(1,error*2));
    if(forward<-.35&&!isBoosting){
     throttle=-1;
    }else if(isBoosting||len>.15||forward>.1){
     throttle=1;
    }else{
     throttle=0;
    }
   }else{
    if(isBoosting||forward>.1){
     throttle=1;
    }else if(forward<-.35){
     throttle=-1;
    }else{
     throttle=0;
    }
   }
   const paused=aerial||mapOpen||controlsBlocked;
   const crash=()=>{if(hitRide()){ride.speed=0;ride.accelerating=false;ride.braking=false;s.keys.clear();if(touch)resetMobileInput(touch);}};
   const touching=hitsTraffic(ride.x,ride.z,ride.yaw,height(ride.x,ride.z));
   if(!touching)rideLife.contact=false;
   if(!paused&&touching)crash();
   const trafficClear=(x:number,z:number)=>{
    if(!paused&&hitsTraffic(x,z,ride.yaw,height(x,z),true))crash();
    return rideLife.crashTime<=0&&clear(x,z);
   };
   stepMotorcycle(dt,throttle,steer,isBrk,paused||rideLife.crashTime>0,trafficClear,isBoosting);
   s.x=ride.x;s.z=ride.z;s.bodyYaw=ride.yaw;
   if(!paused){s.camX=s.x;s.camZ=s.z;}
  }else   if(aerial&&!mapOpen){
   if(len>0){
    const panSpeed=Math.max(12,s.distance*0.45)*(fast?1.8:1)*dt;
    const edge=ward.size/2-PLAYER_RADIUS;
    panCamera(s,right*panSpeed,forward*panSpeed,edge);
   }
  }else{
   const speed=(fast?8:touch?.active?5.5:4)*dt;
   move(s,(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed,clear);
   s.camX=s.x;s.camZ=s.z;
  }
  const dx=s.x-oldX,dz=s.z-oldZ;
  const travelled=Math.hypot(dx,dz);
  characterMotion.current.speed=dt>0?travelled/dt:0;
  characterMotion.current.distance+=travelled;
  if(!ride.riding&&(!aerial||mapOpen))s.bodyYaw=avatarHeading(s.bodyYaw,dx,dz);
  if(wheels.current&&(!aerial||mapOpen)){
   const travel=-Math.sin(s.bodyYaw)*dx-Math.cos(s.bodyYaw)*dz;
   wheels.current.rotation.x-=Math.hypot(dx,dz)*(travel<0?-1:1)/(0.24*0.95);
  }
  const bikePose=motorcycleGroundPose(ride.x,ride.z,ride.yaw,height);
  ride.groundY=bikePose.y;ride.pitch=bikePose.pitch;
  const center=height(s.x,s.z),c=Math.cos(s.bodyYaw),sn=Math.sin(s.bodyYaw);
  const left=height(s.x-.104*c,s.z+.104*sn),rightHeight=height(s.x+.104*c,s.z-.104*sn);
  const groundY=ride.riding?bikePose.y:Math.max(center,left,rightHeight)+.012;
  characterMotion.current.leftFoot=left-groundY+.012;
  characterMotion.current.rightFoot=rightHeight-groundY+.012;
  characterMotion.current.stepLift=Math.min(.32,Math.abs(height(s.x-sn*.4,s.z-c*.4)-center)+.04);
  const fall=ride.riding&&rideLife.crashTime>0?Math.min(1,(2-rideLife.crashTime)/.35,rideLife.lives>0?rideLife.crashTime/.4:1):0;
  const isBlinking=ride.riding&&rideLife.invulnerable>0&&Math.floor(clock.elapsedTime*12)%2===0;
  if(avatar.current){avatar.current.position.set(s.x,groundY+fall*.18,s.z);avatar.current.rotation.set(ride.riding?bikePose.pitch:0,s.bodyYaw,fall*1.42,'YXZ');avatar.current.visible=!s.first&&!isBlinking;}
  target.current.set(aerial?s.camX:s.x,(aerial?height(s.camX,s.camZ):groundY)+1.65,aerial?s.camZ:s.z);
  camera.userData.viewFocus={x:target.current.x,z:target.current.z};
  const direction=new Vector3(-Math.sin(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch));
  if(s.first){camera.position.copy(target.current);camera.lookAt(target.current.clone().add(direction));}
  else{
   desired.current.copy(direction).multiplyScalar(-s.distance).add(target.current);desired.current.y=Math.max(0.6,desired.current.y+1.5);
   if(s.distance<=10&&!s.topDown&&s.pitch>-0.85){
    const offset=desired.current.clone().sub(target.current);const distance=offset.length();
    ray.current.set(target.current,offset.normalize());ray.current.far=distance;
    // Ignore the player's own meshes when shortening the chase camera near scenery.
    const isAvatar=(o:Object3D):boolean=>o===avatar.current || (!!o.parent&&isAvatar(o.parent));
    const isHidden=(o:Object3D):boolean=>!o.visible|| (!!o.parent&&isHidden(o.parent));
    const hit=ray.current.intersectObjects(scene.children,true).find(h=>!isAvatar(h.object)&&!isHidden(h.object));
    if(hit)desired.current.copy(target.current).addScaledVector(offset,Math.max(0.15,hit.distance-0.3));
   }
   camera.position.copy(desired.current);camera.lookAt(target.current);
  }
  s.time+=dt;if(s.time>0.08){s.time=0;onRideStatus?.({riding:ride.riding,near:near&&!ride.mustLeave,kmh:Math.round(ride.speed*3.6),notice:rideNotice.current,lives:rideLife.lives,crashed:rideLife.crashTime>0});onPosition(s.x,s.z,s.bodyYaw);onViewPosition?.(target.current.x,target.current.z);}
 });
 return <><ParkedMotorcycle/><group ref={avatar} name="player-avatar">{riding?<><group rotation={[0,Math.PI,0]}><MotorcycleModel riding/></group><group position={[0,.10,.26]}><CartoonCharacter motion={characterMotion} riding/></group></>:character==='cartoon'?<CartoonCharacter motion={characterMotion}/>:<RobotCharacter wheels={wheels}/>}</group></>;

}
