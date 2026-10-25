import {walkWithContacts,createWalkingRecoil,stepWalkingRecoil} from '../game/walkingCollision';
import {useAppearance} from '../game/appearanceStore';
import {rideLife,hitRide,hitActor,hitWalkingContact,isWalkingRecoil,actorFallProgress,tickRideLife} from '../game/rideLife';
import {hitsTraffic,trafficContact} from '../game/trafficColliders';
import {motorcycleData} from '../data/motorcycle';
import {resetMobileInput} from '../game/mobileInput';
import { sceneGround,motorcycleGroundPose,carGroundPose } from '../game/groundSurface';
import { carRide, carInput, currentCar, nearbyCar, enterCar, parkCar, carExitSpot, shiftCar, selectAutomaticRange, stepCar, carFootprintClear, clearCarInput, type CarStatus, type CarGear } from '../game/carRide';
import { canSummonCar, stepCarSummon, updateSummonStand, carSummonState } from '../game/carSummon';
import { ParkedCars } from './Car';
import { DRIVER_EYE } from '../game/carCabin';
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
import { Group, Vector3, Raycaster, Object3D, Euler } from 'three';
import { ward, angle } from '../data/ward';
import { canStand, treeBlocks, PLAYER_RADIUS } from '../game/collision';

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
 speedLimit=20,braking=false,accelerating=false,controlsBlocked=false,loading=false,dismountRequest=0,onRideStatus,
 onCarStatus,
 navigationRequest,
 onNavigationResult,
 mobileInput,
 mapOpen,
 topDown,
 zoom,
 teleportTarget,
 teleportMode=false,
 teleportDragging=false,
 onMode,
 onTopDown,
 onZoom,
 onLock,
 onViewPosition,
 onPosition,
}:{
 character?:CharacterKind;
 speedLimit?:number;braking?:boolean;accelerating?:boolean;controlsBlocked?:boolean;dismountRequest?:number;onRideStatus?:(s:RideStatus)=>void;
 loading?:boolean;
 onCarStatus?:(status:CarStatus)=>void;
 navigationRequest?:{action:"locate"|"teleport";seq:number}|null;
 onNavigationResult?:(success:boolean)=>void;
 mobileInput?:RefObject<MobileInput>;
 mapOpen:boolean;
 topDown:boolean;
 zoom:number;
 teleportTarget?:TeleportTarget|null;
 teleportMode?:boolean;
 teleportDragging?:boolean;
 onMode:(v:boolean)=>void;
 onTopDown:(v:boolean)=>void;
 onZoom:(v:number)=>void;
 onLock:(v:boolean)=>void;
 onViewPosition?:(x:number,z:number)=>void;
 onPosition:(x:number,z:number,yaw?:number)=>void;
}){
 const appearance=useAppearance();
 const {camera,gl,scene}=useThree();
 const avatar=useRef<Group>(null);
 const wheels=useRef<Group>(null);
 const [riding,setRiding]=useState(false);
 const rideNotice=useRef(''),fallYaw=useRef(0);
 const walkingRecoil=useRef(createWalkingRecoil(0));
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
 useEffect(()=>{state.current.keys.clear();motorcycleRide.speed=0;const car=currentCar();if(car)car.speed=0;clearCarInput();},[mapOpen,controlsBlocked]);
 useEffect(()=>()=>{parkCar();},[]);
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
  if(currentCar())parkCar();
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
  if(motorcycleRide.riding){
   motorcycleRide.x=s.x;
   motorcycleRide.z=s.z;
   motorcycleRide.yaw=s.yaw;
   motorcycleRide.speed=0;
  }else{
   const v=s.x*Math.sin(angle)+s.z*Math.cos(angle);
   if(v>4100){
    motorcycleRide.x=s.x+Math.cos(s.yaw)*1.6;
    motorcycleRide.z=s.z+Math.sin(s.yaw)*1.6;
    motorcycleRide.yaw=s.yaw;
    motorcycleRide.speed=0;
    motorcycleRide.mustLeave=false;
   }
  }
  onPosition(s.x,s.z,s.bodyYaw);
 },[teleportTarget,onPosition]);
 useEffect(()=>{
  if(!navigationRequest||rideLife.crashTime>0)return;
  const s=state.current;
  if(navigationRequest.action==='teleport'){
   const spot=findTeleportSpot(s.camX,s.camZ,canStand);
   if(!spot){onNavigationResult?.(false);return}
   if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
   if(currentCar())parkCar();
   s.x=spot.x;s.z=spot.z;
  }
  s.camX=s.x;s.camZ=s.z;s.panning=false;s.first=false;s.topDown=false;
  s.pitch=-.16;s.distance=10;s.targetDistance=10;s.keys.clear();
  onMode(false);onTopDown(false);onZoom(10);onPosition(s.x,s.z,s.bodyYaw);onNavigationResult?.(true);
 },[navigationRequest,onNavigationResult,onMode,onTopDown,onZoom,onPosition]);
 const target=useRef(new Vector3()); const desired=useRef(new Vector3()); const ray=useRef(new Raycaster());
 useEffect(()=>{
  if(teleportMode&&document.pointerLockElement===gl.domElement)document.exitPointerLock();
 },[teleportMode,gl]);
 useEffect(()=>{
  const s=state.current;
  const clear=()=>{motorcycleRide.speed=0;const car=currentCar();if(car)car.speed=0;clearCarInput();s.keys.clear();s.dragging=false;s.shiftDrag=false;gl.domElement.style.cursor=''};
  const lock=()=>{s.locked=document.pointerLockElement===gl.domElement;clear();onLock(s.locked)};
  const key=(e:KeyboardEvent)=>{
   if(controlsBlocked)return;
   const carKey=!!currentCar()&&['KeyC','KeyP','Space','KeyE','KeyN','Digit0','Digit1','Digit2','Digit3','Digit4','KeyV'].includes(e.code);
   const movement=carKey||["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyR","KeyT","KeyM"].includes(e.code);
   if(!s.locked&&!mapOpen&&!movement&&e.type!=="keyup")return;
   if(e.target instanceof HTMLElement&&e.target.matches("input,textarea,select"))return;
   if(carKey)e.preventDefault();
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyV','KeyR','KeyT','KeyM'].includes(e.code))e.preventDefault();
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
    if(currentCar()&&!mapOpen){
     if(!e.repeat&&e.code==='KeyP'&&currentCar()?.transmission==='automatic'){selectAutomaticRange('P',s.keys.has('Space')||s.keys.has('KeyS')||carInput.brake);return;}
     if(!e.repeat&&(e.code==='KeyR'||e.code==='KeyN'||/^Digit[0-4]$/.test(e.code))){
      const gear=(e.code==='KeyR'?-1:e.code==='KeyN'?0:Number(e.code.slice(-1))) as CarGear;
      shiftCar(gear,s.keys.has('KeyC')||carInput.clutch,s.keys.has('Space')||s.keys.has('KeyS')||carInput.brake);return;
     }
     if(e.code==='KeyE'){if(!e.repeat)carInput.exit=true;return;}
     if(e.code==='KeyR')return;
    }
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){
     if(!motorcycleRide.riding&&!currentCar()){
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
    if(!e.repeat&&e.code==='KeyM'&&!motorcycleRide.riding&&!currentCar()&&rideLife.crashTime<=0){
     motorcycleRide.x=s.x+Math.cos(s.yaw)*1.5;
     motorcycleRide.z=s.z+Math.sin(s.yaw)*1.5;
     motorcycleRide.yaw=s.yaw;
     motorcycleRide.speed=0;
     motorcycleRide.mustLeave=false;
     rideNotice.current='Motorcycle summoned nearby';
    }
    if(e.code==='KeyR'&&rideLife.crashTime<=0){
     if(currentCar())parkCar();
     if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
     s.x=ward.spawn.x;s.z=ward.spawn.z;s.camX=ward.spawn.x;s.camZ=ward.spawn.z;
     s.yaw=ward.spawnYaw;s.bodyYaw=ward.spawnYaw;s.pitch=-0.12;s.topDown=false;s.panning=false;s.targetDistance=ward.spawnZoom;
     onTopDown(false);onZoom(ward.spawnZoom);onPosition(s.x,s.z,s.bodyYaw);
    }
   }
  };
  const mouse=(e:MouseEvent)=>{
   if(controlsBlocked||teleportDragging)return;
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
   if(mapOpen||controlsBlocked||teleportDragging||e.button!==0||(e.target instanceof HTMLElement&&e.target.closest('.teleport-confirm-card,.location-actions')))return;
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
   if(teleportMode||mapOpen||controlsBlocked||s.dragMoved>5||e.shiftKey||s.keys.has('ShiftLeft')||s.keys.has('ShiftRight'))return;
   if(document.pointerLockElement!==gl.domElement)gl.domElement.requestPointerLock()?.catch(()=>onLock(false));
  };
  const wheel=(e:WheelEvent)=>{
   if(mapOpen||controlsBlocked||(e.target instanceof HTMLElement&&e.target.closest('.settings-menu,.ride-controls,.car-controls,.guide-dialog-modal,.teleport-confirm-card')))return;
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
 },[gl,onLock,onMode,onTopDown,onZoom,mapOpen,controlsBlocked,teleportMode,teleportDragging]);
 useFrame(({clock},delta)=>{
  const s=state.current;const dt=loading?0:Math.min(delta,0.05);
  const ground=sceneGround(scene,clock.elapsedTime);
  const height=(x:number,z:number)=>ground.height(x,z);
  const clear=(x:number,z:number)=>canStand(x,z)&&height(x,z)-height(motorcycleRide.riding?motorcycleRide.x:s.x,motorcycleRide.riding?motorcycleRide.z:s.z)<.5;
  if(tickRideLife(mapOpen||controlsBlocked?0:dt)){
   parkCar();clearCarInput();
   parkMotorcycle();setRiding(false);
   Object.assign(motorcycleRide,{x:motorcycleData.x,z:motorcycleData.z,yaw:motorcycleData.rotation,mustLeave:false,distance:0});
   Object.assign(s,{x:ward.spawn.x,z:ward.spawn.z,camX:ward.spawn.x,camZ:ward.spawn.z,yaw:ward.spawnYaw,bodyYaw:ward.spawnYaw,panning:false,first:false,topDown:false,pitch:-.12,distance:ward.spawnZoom,targetDistance:ward.spawnZoom});
   s.keys.clear();if(mobileInput?.current)resetMobileInput(mobileInput.current);
   onMode(false);onTopDown(false);onZoom(ward.spawnZoom);rideNotice.current='';
  }
  updateHomeAccess(s.x,s.z,dt);stepCarSummon(dt,height,s.x,s.z,!!currentCar(),motorcycleRide.riding);
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
  const aerial=!currentCar()&&!touch?.active&&!s.first&&(s.distance>20||s.topDown||s.panning);
  const ride=motorcycleRide;
  if(carInput.exit&&currentCar()&&rideLife.crashTime<=0){
   carInput.exit=false;
   const car=currentCar()!,spot=carExitSpot((x,z)=>clear(x,z)&&!hitsTraffic(x,z,car.yaw,height(x,z),true,car.id));
   if(spot){parkCar();s.x=spot.x;s.z=spot.z;s.camX=s.x;s.camZ=s.z;s.first=false;s.panning=false;s.pitch=-.16;s.targetDistance=6;s.keys.clear();if(touch)resetMobileInput(touch);onMode(false);onZoom(6);}
  }
  const nearCar=rideLife.crashTime<=0&&!ride.riding&&!currentCar()&&!aerial&&!controlsBlocked&&!mapOpen&&!loading?nearbyCar(s.x,s.z,clear):undefined;
  if(nearCar){
   carRide.nearTime=carRide.nearId===nearCar.id?carRide.nearTime+dt:0;carRide.nearId=nearCar.id;
   if(carRide.nearTime>.65){carSummonState.status='idle';enterCar(nearCar);s.x=nearCar.x;s.z=nearCar.z;s.camX=s.x;s.camZ=s.z;s.yaw=nearCar.yaw;s.bodyYaw=s.yaw;s.first=true;s.topDown=false;s.panning=false;s.pitch=-.04;s.targetDistance=8;s.keys.clear();if(touch)resetMobileInput(touch);onMode(true);onTopDown(false);onZoom(8);oldX=s.x;oldZ=s.z;}
  }else{carRide.nearId=null;carRide.nearTime=0;}
  ride.cooldown=Math.max(0,ride.cooldown-dt);
  const near=Math.hypot(s.x-ride.x,s.z-ride.z)<1.8;
  if(ride.mustLeave&&Math.hypot(s.x-ride.x,s.z-ride.z)>2.3)ride.mustLeave=false;
  if(rideLife.crashTime<=0&&!currentCar()&&!nearCar&&!ride.riding&&!ride.mustLeave&&near&&!aerial&&!controlsBlocked&&!mapOpen&&!loading){
   ride.nearTime+=dt;
   if(ride.nearTime>.65&&tryMount(s.x,s.z,canStand)){
    setRiding(true);rideNotice.current='';s.x=ride.x;s.z=ride.z;s.bodyYaw=ride.yaw;s.yaw=ride.yaw;s.panning=false;
    oldX=s.x;oldZ=s.z;s.targetDistance=5;onZoom(5);
   }
  }else if(!ride.riding)ride.nearTime=0;
  if(currentCar()){
   const car=currentCar()!,paused=mapOpen||controlsBlocked||loading||rideLife.crashTime>0;
   const carClear=(x:number,z:number)=>canStand(x,z)&&!hitsTraffic(x,z,car.yaw,car.groundY,true,car.id);
   const impact=stepCar(dt,carInput.throttle?1:Math.max(0,forward),carInput.steer||right,carInput.brake||s.keys.has('Space')||forward<-.1,carInput.clutch||s.keys.has('KeyC'),paused,carClear);
   const actorContact=!paused&&!carFootprintClear(car,car.x,car.z,car.yaw,(x,z)=>!hitsTraffic(x,z,car.yaw,car.groundY,true,car.id));
   if(!paused){
    if(!impact.blocked&&!actorContact)rideLife.contact=false;
    if((actorContact||(impact.blocked&&impact.speed>.05))&&hitActor('car')){car.speed=0;clearCarInput();s.keys.clear();if(touch)resetMobileInput(touch);}
   }
   const pose=carGroundPose(car.x,car.z,car.yaw,car.size,height);car.groundY=pose.y;car.pitch=pose.pitch;car.roll=pose.roll;
   s.x=car.x;s.z=car.z;s.bodyYaw=car.yaw;s.camX=s.x;s.camZ=s.z;
   if(!paused&&Math.abs(car.speed)>.1)s.yaw+=Math.atan2(Math.sin(car.yaw-s.yaw),Math.cos(car.yaw-s.yaw))*Math.min(1,dt*5);
  }else if(ride.riding){
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
  }else if(isWalkingRecoil()){
   if(!mapOpen&&!controlsBlocked&&!loading)stepWalkingRecoil(walkingRecoil.current,s,dt,clear,(x,z)=>trafficContact(x,z,s.bodyYaw,height(x,z),true));
   s.bodyYaw=walkingRecoil.current.yaw;s.camX=s.x;s.camZ=s.z;
  }else   if(aerial&&!mapOpen){
   if(len>0){
    const panSpeed=Math.max(12,s.distance*0.45)*(fast?1.8:1)*dt;
    const edge=ward.size/2-PLAYER_RADIUS;
    panCamera(s,right*panSpeed,forward*panSpeed,edge);
   }
  }else{
   const speed=(fast?9.5:touch?.active?5.5:4)*dt;
   const mx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,mz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
   if(!mapOpen&&!controlsBlocked&&!loading){
    const contact=walkWithContacts(s,mx,mz,clear,(x,z)=>trafficContact(x,z,s.bodyYaw,height(x,z),true),treeBlocks);
    if((!contact||contact==='obstacle')&&rideLife.crashTime<=0)rideLife.contact=false;
    if(hitWalkingContact(contact)){
     fallYaw.current=Math.hypot(mx,mz)>.0001?Math.atan2(-mx,-mz):s.bodyYaw;
     if(contact!=='car'){walkingRecoil.current=createWalkingRecoil(fallYaw.current);s.bodyYaw=fallYaw.current;}
     s.keys.clear();if(touch)resetMobileInput(touch);s.first=false;s.topDown=false;s.panning=false;s.targetDistance=6;onMode(false);onTopDown(false);onZoom(6);
    }
   }
   s.camX=s.x;s.camZ=s.z;
  }
  const dx=s.x-oldX,dz=s.z-oldZ;
  const travelled=Math.hypot(dx,dz);
  characterMotion.current.speed=dt>0?travelled/dt:0;
  characterMotion.current.distance+=isWalkingRecoil()?-travelled:travelled;
  updateSummonStand(dt,s.x,s.z,travelled>0.02,!!currentCar(),ride.riding);
  if(!currentCar()&&!ride.riding&&!isWalkingRecoil()&&(!aerial||mapOpen))s.bodyYaw=avatarHeading(s.bodyYaw,dx,dz);
  if(wheels.current&&(!aerial||mapOpen)){
   const travel=-Math.sin(s.bodyYaw)*dx-Math.cos(s.bodyYaw)*dz;
   wheels.current.rotation.x-=Math.hypot(dx,dz)*(travel<0?-1:1)/(0.24*0.95);
  }
  const bikePose=motorcycleGroundPose(ride.x,ride.z,ride.yaw,height);
  ride.groundY=bikePose.y;ride.pitch=bikePose.pitch;
  const center=height(s.x,s.z),c=Math.cos(s.bodyYaw),sn=Math.sin(s.bodyYaw);
  const bodyScale=character==='cartoon'?appearance.human.height:appearance.robot.size;
  const footWidth=(character==='cartoon'?.104:appearance.robot.legs==='wheels'?.305*.95:appearance.robot.legs==='tracks'?.27*.95:.16*.95)*bodyScale;
  const left=height(s.x-footWidth*c,s.z+footWidth*sn),rightHeight=height(s.x+footWidth*c,s.z-footWidth*sn);
  const car=currentCar();
  carRide.interior=s.first;
  const groundY=car?car.groundY:ride.riding?bikePose.y:Math.max(center,left,rightHeight)+.012;
  characterMotion.current.leftFoot=(left-groundY+.012)/bodyScale;
  characterMotion.current.rightFoot=(rightHeight-groundY+.012)/bodyScale;
  characterMotion.current.stepLift=Math.min(.32,Math.abs(height(s.x-sn*.4,s.z-c*.4)-center)+.04);
  const fall=!car?actorFallProgress():0;
  const isBlinking=!car&&rideLife.damage>0&&rideLife.invulnerable>0&&Math.floor(clock.elapsedTime*12)%2===0;
  if(avatar.current){avatar.current.position.set(s.x,groundY+fall*(ride.riding?.18:.28*bodyScale),s.z);avatar.current.rotation.set(ride.riding?bikePose.pitch:fall*Math.PI/2,fall&&!ride.riding?fallYaw.current:s.bodyYaw,ride.riding?fall*1.42:0,'YXZ');avatar.current.visible=!car&&!s.first&&!isBlinking;}
  target.current.set(aerial?s.camX:s.x,(aerial?height(s.camX,s.camZ):groundY)+1.65*(car||ride.riding?1:bodyScale),aerial?s.camZ:s.z);
  if(car&&s.first)target.current.set(DRIVER_EYE[0]*car.size,DRIVER_EYE[1]*car.size,DRIVER_EYE[2]*car.size).applyEuler(new Euler(car.pitch,car.yaw,car.roll,'YXZ')).add(new Vector3(car.x,car.groundY,car.z));
  camera.userData.viewFocus={x:target.current.x,z:target.current.z};
  const viewPitch=s.pitch+(car&&s.first?car.pitch:0);
  const direction=new Vector3(-Math.sin(s.yaw)*Math.cos(viewPitch),Math.sin(viewPitch),-Math.cos(s.yaw)*Math.cos(viewPitch));
  if(s.first){camera.position.copy(target.current);camera.lookAt(target.current.clone().add(direction));}
  else{
   desired.current.copy(direction).multiplyScalar(-s.distance).add(target.current);desired.current.y=Math.max(0.6,desired.current.y+1.5);
   if(s.distance<=10&&!s.topDown&&s.pitch>-0.85){
    const offset=desired.current.clone().sub(target.current);const distance=offset.length();
    ray.current.set(target.current,offset.normalize());ray.current.far=distance;
    // Ignore the player's own meshes when shortening the chase camera near scenery.
    const isAvatar=(o:Object3D):boolean=>o===avatar.current || (!!car&&o.userData.carId===car.id) || (!!o.parent&&isAvatar(o.parent));
    const isHidden=(o:Object3D):boolean=>!o.visible|| (!!o.parent&&isHidden(o.parent));
    const hit=ray.current.intersectObjects(scene.children,true).find(h=>!isAvatar(h.object)&&!isHidden(h.object));
    if(hit)desired.current.copy(target.current).addScaledVector(offset,Math.max(0.15,hit.distance-0.3));
   }
   camera.position.copy(desired.current);camera.lookAt(target.current);
  }
  s.time+=dt;if(s.time>0.08){s.time=0;onCarStatus?.({transmission:car?.transmission,automaticRange:carRide.automaticRange,driving:!!car,near:!!nearCar,kmh:Math.round(Math.abs(car?.speed??0)*3.6),gear:carRide.gear,rpm:Math.round(carRide.rpm/100)*100,clutch:car?.transmission!=='automatic'&&(carInput.clutch||s.keys.has('KeyC')),notice:carRide.notice,steering:Math.round((car?.steering??0)*100)/100,first:s.first,canSummon:canSummonCar(s.x,s.z,!!car,ride.riding),summonStatus:carSummonState.status});onRideStatus?.({riding:ride.riding,near:!car&&near&&!ride.mustLeave,kmh:Math.round(ride.speed*3.6),notice:rideNotice.current,lives:rideLife.lives,crashed:rideLife.crashTime>0,impactMode:rideLife.mode,damage:rideLife.damage});onPosition(s.x,s.z,s.bodyYaw);onViewPosition?.(target.current.x,target.current.z);}
 },-1);
 return <><ParkedCars/><ParkedMotorcycle/><group ref={avatar} name="player-avatar">{riding?<><group rotation={[0,Math.PI,0]}><MotorcycleModel riding/></group><group position={[0,.10,.26]}><CartoonCharacter appearance={appearance.human} motion={characterMotion} riding/></group></>:character==='cartoon'?<CartoonCharacter appearance={appearance.human} motion={characterMotion}/>:<RobotCharacter wheels={wheels} appearance={appearance.robot} motion={characterMotion}/>}</group></>;

}
