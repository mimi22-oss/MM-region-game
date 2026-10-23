import { useEffect, useRef } from 'react';
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
 mapOpen,
 topDown,
 zoom,
 teleportTarget,
 onMode,
 onTopDown,
 onZoom,
 onLock,
 onPosition,
}:{
 mapOpen:boolean;
 topDown:boolean;
 zoom:number;
 teleportTarget?:TeleportTarget|null;
 onMode:(v:boolean)=>void;
 onTopDown:(v:boolean)=>void;
 onZoom:(v:number)=>void;
 onLock:(v:boolean)=>void;
 onPosition:(x:number,z:number)=>void;
}){
 const {camera,gl,scene}=useThree();
 const avatar=useRef<Group>(null);
 const state=useRef({
  x:ward.spawn.x,
  z:ward.spawn.z,
  camX:ward.spawn.x,
  camZ:ward.spawn.z,
  yaw:0,
  pitch:-0.12,
  distance:6,
  targetDistance:6,
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
 useEffect(()=>{state.current.keys.clear()},[mapOpen]);
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
  if(!teleportTarget)return;
  const s=state.current;
  s.x=teleportTarget.x;
  s.z=teleportTarget.z;
  s.camX=teleportTarget.x;
  s.camZ=teleportTarget.z;
  if(teleportTarget.yaw!==undefined)s.yaw=teleportTarget.yaw;
  s.pitch=teleportTarget.pitch??-0.16;
  s.first=false;
  s.topDown=false;
  s.panning=false;
  const dist=teleportTarget.distance??10;
  s.distance=dist;
  s.targetDistance=dist;
  onPosition(s.x,s.z);
 },[teleportTarget,onPosition]);
 const target=useRef(new Vector3()); const desired=useRef(new Vector3()); const ray=useRef(new Raycaster());
 useEffect(()=>{
  const s=state.current;
  const clear=()=>{s.keys.clear();s.dragging=false;s.shiftDrag=false;gl.domElement.style.cursor=''};
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
     const walkKeyHeld=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].some(k=>s.keys.has(k));
     if(!walkKeyHeld&&document.pointerLockElement===gl.domElement){
      document.exitPointerLock();
     }
     gl.domElement.style.cursor=s.dragging?'grabbing':'grab';
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
    if(e.code==='KeyR'){
     s.x=ward.spawn.x;s.z=ward.spawn.z;s.camX=ward.spawn.x;s.camZ=ward.spawn.z;
     s.yaw=0;s.pitch=-0.12;s.topDown=false;s.panning=false;s.targetDistance=6;
     onTopDown(false);onZoom(6);
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
    const panScale=Math.max(0.55,s.distance*0.0022);
    const panRight=-e.movementX*panScale;
    const panForward=e.movementY*panScale;
    const edge=ward.size/2-PLAYER_RADIUS;
    s.camX=Math.max(-edge,Math.min(edge,s.camX+(-Math.sin(s.yaw)*panForward+Math.cos(s.yaw)*panRight)));
    s.camZ=Math.max(-edge,Math.min(edge,s.camZ+(-Math.cos(s.yaw)*panForward-Math.sin(s.yaw)*panRight)));
    if(canStand(s.camX,s.camZ)){
     s.x=s.camX;
     s.z=s.camZ;
    }else{
     for(const r of [2,4,7,11,16]){
      let found=false;
      for(let a=0;a<Math.PI*2;a+=Math.PI/4){
       const nx=s.camX+Math.cos(a)*r,nz=s.camZ+Math.sin(a)*r;
       if(canStand(nx,nz)){s.x=nx;s.z=nz;found=true;break;}
      }
      if(found)break;
     }
    }
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
   if(mapOpen)return;
   e.preventDefault();
   if(s.first&&e.deltaY>0){
    s.first=false;onMode(false);
    s.distance=MIN_ZOOM;s.targetDistance=MIN_ZOOM;
   }
   const factor=Math.exp(Math.max(-160,Math.min(160,e.deltaY))*0.0022);
   const raw=e.deltaY>0?Math.max(s.targetDistance+0.8,s.targetDistance*factor):Math.min(s.targetDistance-0.5,s.targetDistance*factor);
   const next=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,raw));
   s.targetDistance=next;
   if(s.topDown){
    s.pitch=SKY_PITCH;
   }else if(e.deltaY>0&&next>8){
    const aerialPitch=-0.12-Math.min(1,(next-8)/200)*(Math.abs(SKY_PITCH)-0.12);
    if(s.pitch>aerialPitch)s.pitch=aerialPitch;
   }else if(e.deltaY<0&&next<80){
    const streetPitch=-0.12-Math.max(0,(next-6)/74)*(Math.abs(SKY_PITCH)-0.12);
    if(s.pitch<streetPitch)s.pitch=streetPitch;
    if(next<=15){s.camX=s.x;s.camZ=s.z;}
   }
   onZoom(next);
  };
  document.addEventListener('pointerlockchange',lock);document.addEventListener('keydown',key);document.addEventListener('keyup',key);document.addEventListener('mousemove',mouse);document.addEventListener('mouseup',up);window.addEventListener('blur',clear);window.addEventListener('wheel',wheel,{passive:false});gl.domElement.addEventListener('mousedown',down);gl.domElement.addEventListener('click',click);
  return ()=>{document.removeEventListener('pointerlockchange',lock);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key);document.removeEventListener('mousemove',mouse);document.removeEventListener('mouseup',up);window.removeEventListener('blur',clear);window.removeEventListener('wheel',wheel);gl.domElement.removeEventListener('mousedown',down);gl.domElement.removeEventListener('click',click);if(document.pointerLockElement===gl.domElement)document.exitPointerLock()};
 },[gl,onLock,onMode,onTopDown,onZoom,mapOpen]);
 useFrame((_,delta)=>{
  const s=state.current;const dt=Math.min(delta,0.05);
  s.distance+=(s.targetDistance-s.distance)*Math.min(1,dt*12);
  let forward=Number(s.keys.has('KeyW')||s.keys.has('ArrowUp'))-Number(s.keys.has('KeyS')||s.keys.has('ArrowDown'));
  let right=Number(s.keys.has('KeyD')||s.keys.has('ArrowRight'))-Number(s.keys.has('KeyA')||s.keys.has('ArrowLeft'));
  const len=Math.hypot(forward,right);if(len){forward/=len;right/=len;}
  const fast=s.keys.has('ShiftLeft')||s.keys.has('ShiftRight');
  const yaw=mapOpen?0:s.yaw;
  if(len>0&&s.distance<=20&&!s.topDown)s.panning=false;
  const aerial=!s.first&&(s.distance>20||s.topDown||s.panning);
  if(aerial&&!mapOpen){
   if(len>0){
    const panSpeed=Math.max(12,s.distance*0.45)*(fast?1.8:1)*dt;
    const edge=ward.size/2-PLAYER_RADIUS;
    s.camX=Math.max(-edge,Math.min(edge,s.camX+(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*panSpeed));
    s.camZ=Math.max(-edge,Math.min(edge,s.camZ+(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*panSpeed));
    if(canStand(s.camX,s.camZ)){s.x=s.camX;s.z=s.camZ;}
   }
  }else{
   const speed=(fast?8:4)*dt;
   move(s,(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed);
   s.camX=s.x;s.camZ=s.z;
  }
  if(avatar.current){avatar.current.position.set(s.x,0,s.z);avatar.current.rotation.y=s.yaw;avatar.current.visible=!s.first;}
  target.current.set(aerial?s.camX:s.x,1.65,aerial?s.camZ:s.z);
  const direction=new Vector3(-Math.sin(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch));
  if(s.first){camera.position.copy(target.current);camera.lookAt(target.current.clone().add(direction));}
  else{
   desired.current.copy(direction).multiplyScalar(-s.distance).add(target.current);desired.current.y=Math.max(0.6,desired.current.y+1.5);
   if(s.distance<=10&&!s.topDown&&s.pitch>-0.85){
    const offset=desired.current.clone().sub(target.current);const distance=offset.length();
    ray.current.set(target.current,offset.normalize());ray.current.far=distance;
    // Ignore the player's own meshes when shortening the chase camera near scenery.
    const isAvatar=(o:Object3D):boolean=>o===avatar.current || (!!o.parent&&isAvatar(o.parent));
    const hit=ray.current.intersectObjects(scene.children,true).find(h=>!isAvatar(h.object));
    if(hit)desired.current.copy(target.current).addScaledVector(offset,Math.max(0.15,hit.distance-0.3));
   }
   camera.position.copy(desired.current);camera.lookAt(target.current);
  }
  s.time+=dt;if(s.time>0.15){s.time=0;onPosition(s.x,s.z);}
 });
 return <group ref={avatar}>
  <mesh position={[0,1,0]} castShadow><capsuleGeometry args={[0.3,0.7,4,8]}/><meshStandardMaterial color="#f3c469"/></mesh>
  <mesh position={[0,1.85,0]} castShadow><sphereGeometry args={[0.25,12,10]}/><meshStandardMaterial color="#bc8c67"/></mesh>
  <mesh position={[0,0.35,0]} castShadow><cylinderGeometry args={[0.28,0.34,0.7,10]}/><meshStandardMaterial color="#285e59"/></mesh>
 </group>;
}
