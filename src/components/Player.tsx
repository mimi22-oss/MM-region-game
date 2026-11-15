import {getPlayerDeathState,findProtectedRespawn,completePlayerRespawn,stepPlayerRespawnGrace} from '../game/playerDeath';
import {PLAYER_ON_FOOT_SPEED} from '../game/ghostPersonalities';
import {PassengerBalloon} from './PassengerBalloon';
import {balloonRide,balloonInput,BALLOON_DECK,BALLOON_LAUNCH,clearBalloonInput,resetBalloon,balloonFlightFloor,balloonLanding,stepBalloon,balloonExitSpot,type BalloonStatus} from '../game/balloonRide';
import {createJumpPose,prepareJump,stepJumpPose,jumpKneeBend} from '../game/humanJumpPose';
import {createHumanJump,rememberJumpMomentum,startHumanJump,stepHumanJump,steerHumanJump} from '../game/humanJump';
import {walkWithContacts,createWalkingRecoil,stepWalkingRecoil} from '../game/walkingCollision';
import {useAppearance} from '../game/appearanceStore';
import {shouldUseGlbCharacter} from '../game/characterRenderer';
import {isIntroHighAltitude,isIntroOwningCamera} from '../game/IntroStateMachine';
import {
  getSpecialActionState,
  isWaitingMotionId,
  playSpecialAction,
  stopSpecialAction,
} from '../game/specialActions';
import {isPlayerHomeProtected} from '../game/playerHomeProtection';
import { clearGhostEncounterInteraction,clearGhostThreat,getGhostEncounterInteraction } from '../game/ghostConfig';
import {
  getSubscriptionShopState,
  tryCenterClickSubscriptionBillboard,
  tryTapSubscriptionBillboard,
  wasBillboardClickRecentlyConsumed,
} from '../game/subscriptionShop';
import {
 beginEnteringVehicle,
 completeVehicleBoarding,
 getCarBoardingTarget,
 getVehicleWaitingState,
 interruptVehicleWaiting,
 isVehicleWaitingActiveState,
 isVehicleWaitingPickupLocked,
 resetVehicleWaiting,
 stepVehicleWaiting,
} from '../game/vehicleWaiting';
import {rideLife,hitRide,hitActor,hitWalkingContact,isWalkingRecoil,actorFallProgress,tickRideLife} from '../game/rideLife';
import {hitsTraffic,trafficContact} from '../game/trafficColliders';
import {motorcycleData} from '../data/motorcycle';
import {resetMobileInput} from '../game/mobileInput';
import { sceneGround,motorcycleGroundPose,carGroundPose } from '../game/groundSurface';
import { carRide, carInput, currentCar, nearbyCar, enterCar, parkCar, carExitSpot, shiftCar, selectAutomaticRange, stepCar, carFootprintClear, clearCarInput, driveableCars, type CarStatus, type CarGear, type DriveableCar } from '../game/carRide';
import { canSummonCar, getSummonParkingWorldSpot, stepCarSummon, updateSummonStand, carSummonState } from '../game/carSummon';
import { ParkedCars } from './Car';
import { DRIVER_EYE } from '../game/carCabin';
import { motorcycleRide,tryMount,parkMotorcycle,dismountSpot,stepMotorcycle,type RideStatus } from '../game/motorcycleRide';
import { MotorcycleModel,ParkedMotorcycle } from './Motorcycle';
import { updateHomeAccess } from '../game/homeAccess';
import { panCamera, findTeleportSpot } from '../game/cameraNavigation';
import { createCameraObstructionQuery } from '../game/cameraObstruction';
import { avatarHeading } from '../game/avatarHeading';
import { RobotCharacter } from './RobotCharacter';
import { CartoonCharacter } from './CartoonCharacter';
import type { CharacterKind } from './CharacterPicker';
import { useEffect, useMemo, useRef, useState, memo, type RefObject } from 'react';
const balloonFloorCache = new Map<string, number>();
import type { MobileInput } from '../game/mobileInput';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3, Raycaster, Euler } from 'three';
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

export const Player = memo(function Player({
 character='robot',
 speedLimit=20,braking=false,accelerating=false,controlsBlocked=false,loading=false,deferGlb=false,dismountRequest=0,onRideStatus,
 onCarStatus,
 onBalloonStatus,
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
 initialSave,
 onSaveSnapshot,
}:{
 character?:CharacterKind;
 speedLimit?:number;braking?:boolean;accelerating?:boolean;controlsBlocked?:boolean;dismountRequest?:number;onRideStatus?:(s:RideStatus)=>void;
 loading?:boolean;
 deferGlb?:boolean;
 onCarStatus?:(status:CarStatus)=>void;
 onBalloonStatus?:(status:BalloonStatus)=>void;
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
 initialSave?:import('../game/gameSave').GameSaveData|null;
 onSaveSnapshot?:(snap:{x:number;z:number;yaw:number;pitch:number;zoom:number;topDown:boolean;first:boolean})=>void;
}){
 const appearance=useAppearance();
 const {camera,gl,scene}=useThree();
 const avatar=useRef<Group>(null);
 const wheels=useRef<Group>(null);
 const [riding,setRiding]=useState(false);
 const rideNotice=useRef(''),fallYaw=useRef(0);
 const pickupAnchor=useRef<{requestId:number;x:number;z:number}|null>(null);
 const ghostGrabFallSeq=useRef(0),ghostFallOwned=useRef<number|null>(null);
 const walkingRecoil=useRef(createWalkingRecoil(0));
 const jump=useRef(createHumanJump());
 const jumpPose=useRef(createJumpPose());
 const characterMotion=useRef({speed:0,distance:0,stepLift:0,leftFoot:0,rightFoot:0,airborne:false,jumpBend:0,jumpVelocity:0});
 const initX=initialSave?.x??ward.spawn.x;
 const initZ=initialSave?.z??ward.spawn.z;
 const initYaw=initialSave?.yaw??ward.spawnYaw;
 const initPitch=initialSave?.pitch??-0.12;
 const initZoom=initialSave?.zoom??ward.spawnZoom;
 const initTopDown=initialSave?.topDown??false;
 const initFirst=initialSave?.first??false;

 const state=useRef({
  x:initX,
  z:initZ,
  camX:initX,
  camZ:initZ,
  yaw:initYaw,
  bodyYaw:initYaw,
  mobileSession:-1,
  autoHeadingSession:-1,
  autoHeadingYaw:initYaw,
  pitch:initPitch,
  distance:initZoom,
  targetDistance:initZoom,
  first:initFirst,
  topDown:initTopDown,
  dragging:false,
  shiftDrag:false,
  panning:false,
  dragMoved:0,
  jumpRequested:false,
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
 useEffect(()=>{clearBalloonInput();if(!jump.current.airborne)jumpPose.current=createJumpPose();if(!jump.current.airborne){jump.current.vx=0;jump.current.vz=0;}state.current.jumpRequested=false;if(mobileInput?.current)mobileInput.current.jump=false;state.current.keys.clear();motorcycleRide.speed=0;const car=currentCar();if(car)car.speed=0;clearCarInput();},[mapOpen,controlsBlocked]);
 useEffect(()=>{
  const j=jump.current,s=state.current;
  if(balloonRide.riding&&character!=='cartoon'){resetBalloon();s.x=BALLOON_LAUNCH.x+3.1;s.z=BALLOON_LAUNCH.z;}
  if(j.airborne){s.x=j.safeX;s.z=j.safeZ;}
  jump.current=createHumanJump();jumpPose.current=createJumpPose();s.jumpRequested=false;
 },[character]);
 useEffect(()=>()=>{resetVehicleWaiting(false);parkCar();resetBalloon();},[]);
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
  interruptVehicleWaiting();
  if(balloonRide.riding)resetBalloon();
  if(currentCar())parkCar();
  const s=state.current;
  jump.current=createHumanJump();jumpPose.current=createJumpPose();s.jumpRequested=false;
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
   interruptVehicleWaiting();
   if(balloonRide.riding)resetBalloon();
   if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
   if(currentCar())parkCar();
   jump.current=createHumanJump();jumpPose.current=createJumpPose();s.jumpRequested=false;
   s.x=spot.x;s.z=spot.z;
  }
  s.camX=s.x;s.camZ=s.z;s.panning=false;s.first=false;s.topDown=false;
  s.pitch=-.16;s.distance=10;s.targetDistance=10;s.keys.clear();
  onMode(false);onTopDown(false);onZoom(10);onPosition(s.x,s.z,s.bodyYaw);onNavigationResult?.(true);
 },[navigationRequest,onNavigationResult,onMode,onTopDown,onZoom,onPosition]);
 const target=useRef(new Vector3()); const desired=useRef(new Vector3()); const ray=useRef(new Raycaster());
 const tmpEuler=useRef(new Euler(0,0,0,'YXZ'));
 const tmpVecA=useRef(new Vector3());
 const tmpVecB=useRef(new Vector3());
 const viewFocusScratch=useRef({x:ward.spawn.x,z:ward.spawn.z});
 const cameraObstruction=useMemo(createCameraObstructionQuery,[]);
 useEffect(()=>{
  if(teleportMode&&document.pointerLockElement===gl.domElement)document.exitPointerLock();
 },[teleportMode,gl]);
 useEffect(()=>{
  if(controlsBlocked||mapOpen){
   state.current.keys.clear();
   state.current.dragging=false;
   state.current.shiftDrag=false;
   gl.domElement.style.cursor='';
   if(document.pointerLockElement===gl.domElement)document.exitPointerLock();
  }
 },[controlsBlocked,mapOpen,gl]);
 useEffect(()=>{
  const s=state.current;
  const clear=()=>{clearBalloonInput();balloonRide.vx=0;balloonRide.vz=0;balloonRide.vy=0;if(!jump.current.airborne)jumpPose.current=createJumpPose();if(!jump.current.airborne){jump.current.vx=0;jump.current.vz=0;}s.jumpRequested=false;if(mobileInput?.current)mobileInput.current.jump=false;motorcycleRide.speed=0;const car=currentCar();if(car)car.speed=0;clearCarInput();s.keys.clear();s.dragging=false;s.shiftDrag=false;gl.domElement.style.cursor=''};
  const lock=()=>{s.locked=document.pointerLockElement===gl.domElement;clear();onLock(s.locked)};
  const key=(e:KeyboardEvent)=>{
   if(controlsBlocked)return;
   const carKey=!!currentCar()&&['KeyC','KeyP','Space','KeyE','KeyN','Digit0','Digit1','Digit2','Digit3','Digit4','KeyV'].includes(e.code);
   const balloonKey=balloonRide.riding&&['KeyE','KeyV','PageUp','PageDown'].includes(e.code);
   const movement=balloonKey||e.code==='Space'||carKey||["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyR","KeyT","KeyM"].includes(e.code);
   if(!s.locked&&!mapOpen&&!movement&&e.type!=="keyup")return;
   if(e.target instanceof HTMLElement&&(e.target.closest("input,textarea,select,[contenteditable=true]")||(e.code==='Space'&&e.target.closest("button"))))return;
   if(balloonKey||carKey||e.code==='Space')e.preventDefault();
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
    if(balloonRide.riding&&e.code==='KeyE'){if(!e.repeat)balloonInput.exit=true;return;}
    if(!balloonRide.riding&&e.code==='Space'&&!e.repeat&&!mapOpen&&!motorcycleRide.riding&&!currentCar())s.jumpRequested=true;
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
     if(!balloonRide.riding&&!motorcycleRide.riding&&!currentCar()){
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
      s.pitch=-0.12;s.targetDistance=balloonRide.riding?24:6;s.panning=false;s.camX=s.x;s.camZ=s.z;onZoom(s.targetDistance);
     }
     onTopDown(nextTop);
    }
    if(!e.repeat&&e.code==='KeyM'&&!balloonRide.riding&&!motorcycleRide.riding&&!currentCar()&&rideLife.crashTime<=0){
     motorcycleRide.x=s.x+Math.cos(s.yaw)*1.5;
     motorcycleRide.z=s.z+Math.sin(s.yaw)*1.5;
     motorcycleRide.yaw=s.yaw;
     motorcycleRide.speed=0;
     motorcycleRide.mustLeave=false;
     rideNotice.current='Motorcycle summoned nearby';
    }
    if(e.code==='KeyR'&&rideLife.crashTime<=0){
     if(balloonRide.riding)resetBalloon();
     if(currentCar())parkCar();
     if(motorcycleRide.riding){parkMotorcycle();setRiding(false);}
     jump.current=createHumanJump();jumpPose.current=createJumpPose();s.jumpRequested=false;
     s.x=ward.spawn.x;s.z=ward.spawn.z;s.camX=ward.spawn.x;s.camZ=ward.spawn.z;
     s.yaw=ward.spawnYaw;s.bodyYaw=ward.spawnYaw;s.pitch=-0.12;s.topDown=false;s.panning=false;s.targetDistance=ward.spawnZoom;
     onTopDown(false);onZoom(ward.spawnZoom);onPosition(s.x,s.z,s.bodyYaw);
     onSaveSnapshot?.({x:s.x,z:s.z,yaw:s.bodyYaw,pitch:s.pitch,zoom:s.targetDistance,topDown:false,first:false});
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
   if(mapOpen||controlsBlocked||teleportDragging||e.button!==0||(e.target instanceof HTMLElement&&e.target.closest('.teleport-confirm-card,.location-actions,.action-menu-popover')))return;
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
   if(wasBillboardClickRecentlyConsumed()||getSubscriptionShopState().isOpen)return;
   if(document.pointerLockElement===gl.domElement){
    tryCenterClickSubscriptionBillboard();
    return;
   }
   if(tryTapSubscriptionBillboard(e.clientX,e.clientY,'billboard-click'))return;
   gl.domElement.requestPointerLock()?.catch(()=>onLock(false));
  };
  const wheel=(e:WheelEvent)=>{
   if(mapOpen||controlsBlocked||(e.target instanceof HTMLElement&&e.target.closest('.settings-menu,.action-menu-popover,.ride-controls,.car-controls,.guide-dialog-modal,.teleport-confirm-card')))return;
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
  const introOwnsCamera=isIntroOwningCamera();
  const introHighAlt=introOwnsCamera&&isIntroHighAltitude();
  const s=state.current;const dt=loading?0:Math.min(delta,0.05);
  if(introOwnsCamera){s.keys.clear();s.panning=false;s.dragging=false;}
  const ground=sceneGround(scene,clock.elapsedTime);
  const height=(x:number,z:number)=>ground.height(x,z);
  const clear=(x:number,z:number)=>canStand(x,z)&&height(x,z)-height(motorcycleRide.riding?motorcycleRide.x:s.x,motorcycleRide.riding?motorcycleRide.z:s.z)<.5;
  const life=getPlayerDeathState();
  stepPlayerRespawnGrace(mapOpen||controlsBlocked?0:dt);
  if(life.phase==='respawning'){
   const spot=findProtectedRespawn(clear)??(clear(ward.spawn.x,ward.spawn.z)?ward.spawn:null);
   if(spot){
    interruptVehicleWaiting();parkCar();parkMotorcycle();if(balloonRide.riding)resetBalloon();setRiding(false);
    Object.assign(s,{x:spot.x,z:spot.z,camX:spot.x,camZ:spot.z,bodyYaw:ward.spawnYaw,yaw:ward.spawnYaw,panning:false,first:false,topDown:false,pitch:-.12,distance:6,targetDistance:6});
    jump.current=createHumanJump();jumpPose.current=createJumpPose();s.jumpRequested=false;s.keys.clear();
    clearGhostEncounterInteraction();clearGhostThreat();stopSpecialAction(true);ghostFallOwned.current=null;
    if(mobileInput?.current)resetMobileInput(mobileInput.current);onMode(false);onTopDown(false);onZoom(6);completePlayerRespawn();
   }
  }
  if(life.phase==='dead'){s.keys.clear();s.jumpRequested=false;if(mobileInput?.current)resetMobileInput(mobileInput.current);return;}
  if(tickRideLife(mapOpen||controlsBlocked?0:dt)){
   interruptVehicleWaiting();
   if(balloonRide.riding)resetBalloon();
   jump.current=createHumanJump();jumpPose.current=createJumpPose();s.jumpRequested=false;
   parkCar();clearCarInput();
   parkMotorcycle();setRiding(false);
   Object.assign(motorcycleRide,{x:motorcycleData.x,z:motorcycleData.z,yaw:motorcycleData.rotation,mustLeave:false,distance:0});
   Object.assign(s,{x:ward.spawn.x,z:ward.spawn.z,camX:ward.spawn.x,camZ:ward.spawn.z,yaw:ward.spawnYaw,bodyYaw:ward.spawnYaw,panning:false,first:false,topDown:false,pitch:-.12,distance:ward.spawnZoom,targetDistance:ward.spawnZoom});
   s.keys.clear();if(mobileInput?.current)resetMobileInput(mobileInput.current);
   onMode(false);onTopDown(false);onZoom(ward.spawnZoom);rideNotice.current='';
  }
  const waitBefore=getVehicleWaitingState();
  updateHomeAccess(balloonRide.riding?Infinity:s.x,balloonRide.riding?Infinity:s.z,dt);
  stepCarSummon(dt,height,s.x,s.z,!!currentCar()||balloonRide.riding,motorcycleRide.riding,waitBefore.state==='ENTERING_VEHICLE');
  const glbCapable=character==='cartoon'&&shouldUseGlbCharacter(appearance.human.preset);
  const waitingSnapshot=stepVehicleWaiting(dt,{
   playAnimation:glbCapable,
   driving:!!currentCar(),
   balloonRiding:balloonRide.riding,
   motorcycleRiding:motorcycleRide.riding,
   crashed:rideLife.crashTime>0||isWalkingRecoil(),
   airborne:jump.current.airborne||jumpPose.current.prepare>0,
  });
  const pickupLocked=isVehicleWaitingPickupLocked(waitingSnapshot.state);
  const enteringVehicle=waitingSnapshot.state==='ENTERING_VEHICLE';
  if(pickupLocked){
   if(!pickupAnchor.current||pickupAnchor.current.requestId!==waitingSnapshot.requestId){
    pickupAnchor.current={requestId:waitingSnapshot.requestId,x:s.x,z:s.z};
   }
  }else if(pickupAnchor.current&&waitingSnapshot.state==='IDLE'){
   pickupAnchor.current=null;
  }
  let oldX=s.x,oldZ=s.z;
  const touch=mobileInput?.current;
  if(touch?.stopRequested){
   touch.stopRequested=false;motorcycleRide.speed=0;
   balloonRide.autoCruise=false;balloonRide.autoReturn=false;balloonRide.vx=0;balloonRide.vz=0;balloonRide.vy=0;balloonRide.cruiseVx=0;balloonRide.cruiseVz=0;
   balloonInput.stopCruise=true;
  }
  const currentGhostFallAction=getSpecialActionState();
  if(currentGhostFallAction.activeActionId!=='fall'||currentGhostFallAction.generation!==ghostFallOwned.current)ghostFallOwned.current=null;
  if(isPlayerHomeProtected(s.x,s.z)){
   clearGhostEncounterInteraction();clearGhostThreat();
   if(ghostFallOwned.current!==null&&currentGhostFallAction.activeActionId==='fall')stopSpecialAction(true);
   ghostFallOwned.current=null;
  }
  const ghostInteraction=getGhostEncounterInteraction();
  const ghostGrabbedOnFoot=ghostInteraction.active&&!balloonRide.riding&&!motorcycleRide.riding&&!currentCar();
  const wantsJump=!pickupLocked&&!enteringVehicle&&!ghostGrabbedOnFoot&&(s.jumpRequested||!!touch?.jump);s.jumpRequested=false;if(touch)touch.jump=false;
  if(touch){
   if(touch.panX||touch.panY){panView(touch.panX,touch.panY);touch.panX=0;touch.panY=0;}
   if(touch.zoomFactor!==1){applyZoom(s.targetDistance*touch.zoomFactor);touch.zoomFactor=1;}
   if(touch.lookX||touch.lookY){s.yaw-=touch.lookX*0.004;s.pitch=Math.max(-1.35,Math.min(0.6,s.pitch-touch.lookY*0.004));if(s.topDown){s.topDown=false;onTopDown(false)}touch.lookX=0;touch.lookY=0;}
   if(touch.active&&!balloonRide.riding&&s.mobileSession!==touch.session){s.mobileSession=touch.session;s.first=false;s.panning=false;s.camX=s.x;s.camZ=s.z;onMode(false)}
  }
  s.distance+=(s.targetDistance-s.distance)*Math.min(1,dt*12);
  let forward=Number(s.keys.has('KeyW')||s.keys.has('ArrowUp'))-Number(s.keys.has('KeyS')||s.keys.has('ArrowDown'));
  let right=Number(s.keys.has('KeyD')||s.keys.has('ArrowRight'))-Number(s.keys.has('KeyA')||s.keys.has('ArrowLeft'));
  if(touch?.active){forward=touch.forward;right=touch.right;}
  if(controlsBlocked||introOwnsCamera||mapOpen||rideLife.crashTime>0||enteringVehicle||ghostGrabbedOnFoot){forward=0;right=0;}
  const aerial=!balloonRide.riding&&!currentCar()&&!touch?.active&&!s.first&&(s.distance>20||s.topDown||s.panning);
  if(pickupLocked&&!aerial){forward=0;right=0;}
  if(ghostGrabbedOnFoot){
   const gx=ghostInteraction.ghostX-s.x,gz=ghostInteraction.ghostZ-s.z;
   if(Math.hypot(gx,gz)>0.05){
    const faceGhostYaw=Math.atan2(-gx,-gz);
    const yawDiff=Math.atan2(Math.sin(faceGhostYaw-s.bodyYaw),Math.cos(faceGhostYaw-s.bodyYaw));
    s.bodyYaw+=yawDiff*Math.min(1,dt*10);
   }
   if(ghostInteraction.phase==='player-fall'&&ghostInteraction.seq!==ghostGrabFallSeq.current){
    ghostGrabFallSeq.current=ghostInteraction.seq;
    fallYaw.current=s.bodyYaw;
    if(glbCapable&&character==='cartoon'){if(playSpecialAction('fall',{loop:false,force:true}))ghostFallOwned.current=getSpecialActionState().generation;}
   }
  }
  const len=Math.hypot(forward,right);if(len){forward/=len;right/=len;}
  const fast=s.keys.has('ShiftLeft')||s.keys.has('ShiftRight')||!!touch?.sprint;
  const mobileScale=touch?.active?touch.moveScale:1;
  if(touch?.autoDirection&&s.autoHeadingSession!==touch.session){s.autoHeadingSession=touch.session;s.autoHeadingYaw=s.yaw;}
  const yaw=mapOpen?0:touch?.autoDirection?s.autoHeadingYaw:s.yaw;
  if(len>0&&s.distance<=20&&!s.topDown)s.panning=false;
  if(wantsJump&&!introOwnsCamera&&!balloonRide.riding&&character==='cartoon'&&!currentCar()&&!motorcycleRide.riding&&!mapOpen&&!controlsBlocked&&!loading&&rideLife.crashTime<=0&&(s.distance>20||s.topDown||s.panning)){
   s.first=false;s.topDown=false;s.panning=false;s.pitch=-.12;s.distance=6;s.targetDistance=6;
   onMode(false);onTopDown(false);onZoom(6);
  }
  const ride=motorcycleRide;
  if(carInput.exit&&currentCar()&&rideLife.crashTime<=0){
   carInput.exit=false;
   const car=currentCar()!,spot=carExitSpot((x,z)=>clear(x,z)&&!hitsTraffic(x,z,car.yaw,height(x,z),true,car.id));
   if(spot){parkCar();s.x=spot.x;s.z=spot.z;s.camX=s.x;s.camZ=s.z;s.first=false;s.panning=false;s.pitch=-.16;s.targetDistance=6;s.keys.clear();if(touch)resetMobileInput(touch);onMode(false);onZoom(6);}
  }
  const balloon=balloonRide;
  if(!balloon.riding){balloon.y=height(balloon.x,balloon.z);balloon.grounded=true;}
  const balloonDistance=Math.hypot(s.x-balloon.x,s.z-balloon.z);
  if(balloon.mustLeave&&balloonDistance>5)balloon.mustLeave=false;
  const nearBalloon=character==='cartoon'&&!currentCar()&&!ride.riding&&!balloon.riding&&!balloon.mustLeave&&!jump.current.airborne&&jumpPose.current.prepare===0&&balloonDistance<3.6;
  if(nearBalloon&&!aerial&&!mapOpen&&!controlsBlocked&&!loading&&rideLife.crashTime<=0){
   balloon.nearTime+=dt;
   if(balloon.nearTime>.55){
    balloon.riding=true;balloon.nearTime=0;balloon.vx=0;balloon.vz=0;balloon.vy=0;
    jump.current=createHumanJump();jumpPose.current=createJumpPose();
    s.x=balloon.x;s.z=balloon.z;oldX=s.x;oldZ=s.z;s.camX=s.x;s.camZ=s.z;s.bodyYaw=balloon.yaw;s.yaw=balloon.yaw;
    s.first=false;s.topDown=false;s.panning=false;s.pitch=-.16;s.distance=24;s.targetDistance=24;s.keys.clear();
    if(touch)resetMobileInput(touch);clearBalloonInput();onMode(false);onTopDown(false);onZoom(24);
   }
  }else if(!balloon.riding)balloon.nearTime=0;
  const boardCarTarget=(targetCar:DriveableCar)=>{
   carSummonState.status='idle';
   enterCar(targetCar);
   completeVehicleBoarding();
   s.x=targetCar.x;s.z=targetCar.z;s.camX=s.x;s.camZ=s.z;s.yaw=targetCar.yaw;s.bodyYaw=s.yaw;s.first=true;s.topDown=false;s.panning=false;s.pitch=-.04;s.targetDistance=8;s.keys.clear();
   if(touch)resetMobileInput(touch);
   onMode(true);onTopDown(false);onZoom(8);oldX=s.x;oldZ=s.z;
  };
  const nearCar=!balloon.riding&&!nearBalloon&&!jump.current.airborne&&jumpPose.current.prepare===0&&!wantsJump&&rideLife.crashTime<=0&&!ride.riding&&!currentCar()&&!aerial&&!controlsBlocked&&!mapOpen&&!loading&&!pickupLocked&&!enteringVehicle?nearbyCar(s.x,s.z,clear):undefined;
  if(nearCar){
   carRide.nearTime=carRide.nearId===nearCar.id?carRide.nearTime+dt:0;carRide.nearId=nearCar.id;
   if(carRide.nearTime>.65)boardCarTarget(nearCar);
  }else{carRide.nearId=null;carRide.nearTime=0;}
  ride.cooldown=Math.max(0,ride.cooldown-dt);
  const near=Math.hypot(s.x-ride.x,s.z-ride.z)<1.8;
  if(ride.mustLeave&&Math.hypot(s.x-ride.x,s.z-ride.z)>2.3)ride.mustLeave=false;
  if(!balloon.riding&&!nearBalloon&&!jump.current.airborne&&jumpPose.current.prepare===0&&!wantsJump&&rideLife.crashTime<=0&&!currentCar()&&!nearCar&&!ride.riding&&!ride.mustLeave&&near&&!aerial&&!controlsBlocked&&!mapOpen&&!loading){
   ride.nearTime+=dt;
   if(ride.nearTime>.65&&tryMount(s.x,s.z,canStand)){
    setRiding(true);rideNotice.current='';s.x=ride.x;s.z=ride.z;s.bodyYaw=ride.yaw;s.yaw=ride.yaw;s.panning=false;
    oldX=s.x;oldZ=s.z;s.targetDistance=5;onZoom(5);
   }
  }else if(!ride.riding)ride.nearTime=0;
  if(balloon.riding){
   const paused=mapOpen||controlsBlocked||loading||rideLife.crashTime>0;
   if(balloonInput.toggleView){balloonInput.toggleView=false;if(!paused){s.first=!s.first;s.topDown=false;s.panning=false;onMode(s.first);onTopDown(false);}}
   if(s.keys.has('KeyR')||s.keys.has('KeyH')){s.keys.delete('KeyR');s.keys.delete('KeyH');if(!paused)balloonInput.toggleAutoReturn=true;}
   if(touch?.autoDirection&&(s.keys.has('Space')||balloonInput.stopCruise||balloonInput.toggleAutoReturn))resetMobileInput(touch);
   let lift=balloonInput.lift+Number(s.keys.has('ArrowUp')||s.keys.has('PageUp'))-Number(s.keys.has('ArrowDown')||s.keys.has('PageDown'));
   let flightForward=Number(s.keys.has('KeyW'))-Number(s.keys.has('KeyS'));
   let flightRight=Number(s.keys.has('KeyD')||s.keys.has('ArrowRight'))-Number(s.keys.has('KeyA')||s.keys.has('ArrowLeft'));
   if(touch?.active){flightRight=touch.right;flightForward=touch.forward;}
   const landClear=(x:number,z:number)=>canStand(x,z)&&!hitsTraffic(x,z,0,height(x,z),true);
   balloonFloorCache.clear();
   const floorCache=balloonFloorCache;
   const flightFloor=(x:number,z:number)=>{
    const key=x+','+z,cached=floorCache.get(key);if(cached!==undefined)return cached;
    const floor=balloonFlightFloor(x,z,height,landClear,(ax,az)=>canStand(ax,az,0,true));
    floorCache.set(key,floor);return floor;
   };
   if(Math.abs(flightRight)>0.01||Math.abs(balloonInput.steer)>0.01||Math.abs(flightForward)>0.01){balloon.autoCruise=true;}
   if(s.keys.has('Space')||balloonInput.stopCruise||balloon.grounded){balloon.autoCruise=false;}
   if(!paused)stepBalloon(balloon,dt,{forward:flightForward+balloonInput.forward,right:flightRight,steer:balloonInput.steer,lift,yaw,speedScale:mobileScale,fast,brake:s.keys.has('Space'),stop:balloonInput.stopCruise,autoCruise:balloon.autoCruise,toggleAutoReturn:balloonInput.toggleAutoReturn},height,flightFloor,ward.size/2-6);
   balloonInput.toggleAutoReturn=false;
   balloonInput.stopCruise=false;
   s.x=balloon.x;s.z=balloon.z;s.bodyYaw=balloon.yaw;s.camX=s.x;s.camZ=s.z;
   if(balloonInput.exit){
    balloonInput.exit=false;
    const spot=!paused&&balloonLanding(balloon.x,balloon.z,height,landClear)?balloonExitSpot(balloon,height,landClear):null;
    if(spot){
     balloon.riding=false;balloon.mustLeave=true;balloon.vx=0;balloon.vz=0;balloon.vy=0;clearBalloonInput();
     s.x=spot.x;s.z=spot.z;s.camX=s.x;s.camZ=s.z;s.first=false;s.topDown=false;s.panning=false;s.pitch=-.12;s.targetDistance=6;
     s.keys.clear();if(touch)resetMobileInput(touch);onMode(false);onTopDown(false);onZoom(6);oldX=s.x;oldZ=s.z;
    }
   }
  }else if(currentCar()){
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
   stepMotorcycle(dt,throttle,steer,isBrk,paused||rideLife.crashTime>0,trafficClear,isBoosting,mobileScale);
   s.x=ride.x;s.z=ride.z;s.bodyYaw=ride.yaw;
   if(!paused){s.camX=s.x;s.camZ=s.z;}
  }else if(isWalkingRecoil()){
   if(!mapOpen&&!controlsBlocked&&!loading)stepWalkingRecoil(walkingRecoil.current,s,dt,clear,(x,z)=>trafficContact(x,z,s.bodyYaw,height(x,z),true));
   s.bodyYaw=walkingRecoil.current.yaw;s.camX=s.x;s.camZ=s.z;
  }else if(aerial&&!mapOpen&&!jump.current.airborne&&jumpPose.current.prepare===0){
   if(len>0){
    const panSpeed=Math.max(12,s.distance*0.45)*(fast?1.8:1)*dt;
    const edge=ward.size/2-PLAYER_RADIUS;
    panCamera(s,right*panSpeed,forward*panSpeed,edge);
   }
  }else if(pickupLocked&&pickupAnchor.current){
   s.x=pickupAnchor.current.x;
   s.z=pickupAnchor.current.z;
   const lookSpot=getSummonParkingWorldSpot();
   const lx=lookSpot.x-s.x,lz=lookSpot.z-s.z;
   if(Math.hypot(lx,lz)>0.05){
    const targetWaitYaw=Math.atan2(-lx,-lz);
    const yawDiff=Math.atan2(Math.sin(targetWaitYaw-s.bodyYaw),Math.cos(targetWaitYaw-s.bodyYaw));
    s.bodyYaw+=yawDiff*Math.min(1,dt*6);
   }
   s.camX=s.x;s.camZ=s.z;
  }else if(enteringVehicle){
   const targetCar=driveableCars[0];
   if(targetCar&&!mapOpen&&!controlsBlocked&&!loading&&rideLife.crashTime<=0){
    const door=getCarBoardingTarget(targetCar,s.x,s.z);
    const ddx=door.x-s.x,ddz=door.z-s.z,distToDoor=Math.hypot(ddx,ddz);
    const stepDist=distToDoor>1e-4?Math.min(distToDoor,4.5*dt):0;
    if(stepDist>0){
     walkWithContacts(s,(ddx/distToDoor)*stepDist,(ddz/distToDoor)*stepDist,clear,(x,z)=>trafficContact(x,z,s.bodyYaw,height(x,z),true),treeBlocks);
    }
    const arrivedDoor=nearbyCar(s.x,s.z,clear)??(distToDoor<=0.45?targetCar:undefined);
    if(arrivedDoor)boardCarTarget(arrivedDoor);
   }
   s.camX=s.x;s.camZ=s.z;
  }else{
   const speed=fast?PLAYER_ON_FOOT_SPEED.run:touch?.active?Math.min(PLAYER_ON_FOOT_SPEED.run,PLAYER_ON_FOOT_SPEED.walk*mobileScale):PLAYER_ON_FOOT_SPEED.walk;
   const vx=(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,vz=(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed;
   const mx=vx*dt,mz=vz*dt;
   if(!mapOpen&&!controlsBlocked&&!loading&&rideLife.crashTime<=0){
    const j=jump.current;
    const pose=jumpPose.current;
    if(character==='cartoon'&&wantsJump&&!j.airborne){
     const momentum=Math.hypot(j.vx,j.vz),direction=Math.hypot(vx,vz);
     prepareJump(pose,direction&&momentum<2?vx/direction*2:j.vx,direction&&momentum<2?vz/direction*2:j.vz);
    }
    if(stepJumpPose(pose,dt)){
     j.vx=pose.vx;j.vz=pose.vz;startHumanJump(j,s,height(s.x,s.z),pose.vx,pose.vz);
    }
    let contact:ReturnType<typeof walkWithContacts>=null;
    if(j.airborne){
     steerHumanJump(j,vx,vz,dt);
     stepHumanJump(j,s,dt,height,(x,z,y)=>{
      const actor=trafficContact(x,z,s.bodyYaw,y,true);
      if(actor){contact=actor;return false;}
      if(treeBlocks(x,z)){contact='tree';return false;}
      // Absolute feet height stays ballistic while crossing slopes, drains and roads.
      return canStand(x,z,Math.max(0,y-height(x,z)),true)&&y>=height(x,z)-.08;
     },canStand);
     if(!j.airborne)pose.landing=.20;
    }else{
     contact=walkWithContacts(s,mx,mz,clear,(x,z)=>trafficContact(x,z,s.bodyYaw,height(x,z),true),treeBlocks);
     if(character==='cartoon')rememberJumpMomentum(j,dt?(s.x-oldX)/dt:0,dt?(s.z-oldZ)/dt:0,dt);
    }
    if((!contact||contact==='obstacle')&&rideLife.crashTime<=0)rideLife.contact=false;
    if(hitWalkingContact(contact)){
     if(j.airborne){s.x=j.safeX;s.z=j.safeZ;}jump.current=createHumanJump();jumpPose.current=createJumpPose();
     fallYaw.current=Math.hypot(mx,mz)>.0001?Math.atan2(-mx,-mz):s.bodyYaw;
     if(contact!=='car'){walkingRecoil.current=createWalkingRecoil(fallYaw.current);s.bodyYaw=fallYaw.current;}
     s.keys.clear();if(touch)resetMobileInput(touch);s.first=false;s.topDown=false;s.panning=false;s.targetDistance=6;onMode(false);onTopDown(false);onZoom(6);
    }
   }
   s.camX=s.x;s.camZ=s.z;
  }
  const dx=s.x-oldX,dz=s.z-oldZ;
  const travelled=Math.hypot(dx,dz);
  const activeSpecialId=getSpecialActionState().activeActionId;
  if(activeSpecialId!==null){
   const isWaitingClip=isWaitingMotionId(activeSpecialId);
   const isGhostFall=activeSpecialId==='fall'&&ghostGrabbedOnFoot&&ghostInteraction.phase==='player-fall';
   const baseConflict=
    !glbCapable||
    balloon.riding||
    !!currentCar()||
    ride.riding||
    isWalkingRecoil()||
    rideLife.crashTime>0||
    jump.current.airborne||
    jumpPose.current.prepare>0;
   const cantDance=isWaitingClip
    ? baseConflict||!isVehicleWaitingActiveState(waitingSnapshot.state)||travelled>0.05
    : isGhostFall
    ? baseConflict
    : baseConflict||pickupLocked||enteringVehicle||(!aerial&&(len>0.01||wantsJump))||travelled>0.015;
   if(cantDance)stopSpecialAction();
  }
  characterMotion.current.airborne=jump.current.airborne;
  characterMotion.current.jumpVelocity=jump.current.vy;
  characterMotion.current.jumpBend=jumpKneeBend(jumpPose.current);
  characterMotion.current.speed=balloon.riding?0:dt>0?travelled/dt:0;
  characterMotion.current.distance+=balloon.riding?0:isWalkingRecoil()?-travelled:travelled;
  updateSummonStand(dt,s.x,s.z,travelled>0.02,!!currentCar()||balloon.riding,ride.riding);
  if(!balloon.riding&&!currentCar()&&!ride.riding&&!isWalkingRecoil()&&(!aerial||mapOpen))s.bodyYaw=avatarHeading(s.bodyYaw,dx,dz);
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
  const groundY=balloon.riding?balloon.y+BALLOON_DECK:car?car.groundY:ride.riding?bikePose.y:jump.current.airborne?jump.current.y+.012:Math.max(center,left,rightHeight)+.012;
  characterMotion.current.leftFoot=(left-groundY+.012)/bodyScale;
  characterMotion.current.rightFoot=(rightHeight-groundY+.012)/bodyScale;
  characterMotion.current.stepLift=Math.min(.32,Math.abs(height(s.x-sn*.4,s.z-c*.4)-center)+.04);
  if(jump.current.airborne||balloon.riding){characterMotion.current.leftFoot=0;characterMotion.current.rightFoot=0;characterMotion.current.stepLift=0;}
  const ghostProceduralFall=ghostGrabbedOnFoot&&ghostInteraction.phase==='player-fall'&&(!glbCapable||character!=='cartoon')?ghostInteraction.fallProgress:0;
  const fall=!car?Math.max(actorFallProgress(),ghostProceduralFall):0;
  const isBlinking=!car&&rideLife.damage>0&&rideLife.invulnerable>0&&Math.floor(clock.elapsedTime*12)%2===0;
  if(avatar.current){avatar.current.position.set(s.x,groundY+fall*(ride.riding?.18:.28*bodyScale),s.z);avatar.current.rotation.set(ride.riding?bikePose.pitch:fall*Math.PI/2,fall&&!ride.riding?fallYaw.current:s.bodyYaw,ride.riding?fall*1.42:0,'YXZ');avatar.current.visible=!car&&!s.first&&!isBlinking&&!introHighAlt;}
  camera.userData.playerOccupied=!!(car||balloon.riding||ride.riding);
  target.current.set(aerial?s.camX:s.x,(aerial?height(s.camX,s.camZ):groundY)+1.65*(car||ride.riding?1:bodyScale),aerial?s.camZ:s.z);
  if(car&&s.first){
   tmpEuler.current.set(car.pitch,car.yaw,car.roll,'YXZ');
   target.current.set(DRIVER_EYE[0]*car.size,DRIVER_EYE[1]*car.size,DRIVER_EYE[2]*car.size).applyEuler(tmpEuler.current).add(tmpVecA.current.set(car.x,car.groundY,car.z));
  }
  if(!introOwnsCamera){
   viewFocusScratch.current.x=target.current.x;viewFocusScratch.current.z=target.current.z;
   camera.userData.viewFocus=viewFocusScratch.current;
   const viewPitch=s.pitch+(car&&s.first?car.pitch:0);
   const direction=tmpVecA.current.set(-Math.sin(s.yaw)*Math.cos(viewPitch),Math.sin(viewPitch),-Math.cos(s.yaw)*Math.cos(viewPitch));
   if(s.first){camera.position.copy(target.current);camera.lookAt(tmpVecB.current.copy(target.current).add(direction));}
   else{
    desired.current.copy(direction).multiplyScalar(-s.distance).add(target.current);desired.current.y=Math.max(0.6,desired.current.y+1.5);
    if(s.distance<=10&&!s.topDown&&s.pitch>-0.85){
     const offset=tmpVecB.current.copy(desired.current).sub(target.current);const distance=offset.length();
     if(distance>1e-5){
      ray.current.set(target.current,offset.multiplyScalar(1/distance));ray.current.far=distance;
      const hit=cameraObstruction(ray.current,scene,avatar.current,!!balloon.riding,car?.id??null);
      if(hit)desired.current.copy(target.current).addScaledVector(offset,Math.max(0.15,hit.distance-0.3));
     }
    }
    camera.position.copy(desired.current);camera.lookAt(target.current);
   }
  }
  s.time+=dt;if(s.time>0.08){s.time=0;onBalloonStatus?.({riding:balloon.riding,near:nearBalloon,altitude:Math.max(0,Math.round(balloon.y-height(balloon.x,balloon.z))),kmh:Math.round(Math.hypot(balloon.vx,balloon.vz)*3.6),grounded:balloon.grounded,blocked:balloon.blocked,autoCruise:balloon.autoCruise,autoReturn:balloon.autoReturn,returnDist:balloon.returnDist});onCarStatus?.({transmission:car?.transmission,automaticRange:carRide.automaticRange,driving:!!car,near:!!nearCar,kmh:Math.round(Math.abs(car?.speed??0)*3.6),gear:carRide.gear,rpm:Math.round(carRide.rpm/100)*100,clutch:car?.transmission!=='automatic'&&(carInput.clutch||s.keys.has('KeyC')),notice:carRide.notice,steering:Math.round((car?.steering??0)*100)/100,first:s.first,canSummon:canSummonCar(s.x,s.z,!!car||balloon.riding,ride.riding),summonStatus:carSummonState.status,lives:rideLife.lives});onRideStatus?.({riding:ride.riding,near:!balloon.riding&&!car&&near&&!ride.mustLeave,kmh:Math.round(ride.speed*3.6),notice:rideNotice.current,lives:rideLife.lives,crashed:rideLife.crashTime>0,impactMode:rideLife.mode,damage:rideLife.damage});onPosition(s.x,s.z,s.bodyYaw);onSaveSnapshot?.({x:s.x,z:s.z,yaw:s.bodyYaw,pitch:s.pitch,zoom:s.targetDistance,topDown:s.topDown,first:s.first});onViewPosition?.(target.current.x,target.current.z);}
 },-1);
 return <><PassengerBalloon/><ParkedCars/><ParkedMotorcycle/><group ref={avatar} name="player-avatar">{riding?<><group rotation={[0,Math.PI,0]}><MotorcycleModel riding/></group><group position={[0,.10,.26]}><CartoonCharacter appearance={appearance.human} motion={characterMotion} deferGlb={deferGlb} riding/></group></>:character==='cartoon'?<CartoonCharacter appearance={appearance.human} motion={characterMotion} deferGlb={deferGlb}/>:<RobotCharacter wheels={wheels} appearance={appearance.robot} motion={characterMotion}/>}</group></>;

});
