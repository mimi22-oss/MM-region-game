import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3, Raycaster, Object3D } from 'three';
import { ward } from '../data/ward';
import { move } from '../game/collision';
export function Player({mapOpen,onMode,onLock,onPosition}:{mapOpen:boolean;onMode:(v:boolean)=>void;onLock:(v:boolean)=>void;onPosition:(x:number,z:number)=>void}){
 const {camera,gl,scene}=useThree();
 const avatar=useRef<Group>(null);
 const state=useRef({x:ward.spawn.x,z:ward.spawn.z,yaw:0,pitch:-0.12,first:false,keys:new Set<string>(),locked:false,time:0});
 useEffect(()=>{state.current.keys.clear()},[mapOpen]);
 const target=useRef(new Vector3()); const desired=useRef(new Vector3()); const ray=useRef(new Raycaster());
 useEffect(()=>{
  const s=state.current;
  const clear=()=>s.keys.clear();
  const lock=()=>{s.locked=document.pointerLockElement===gl.domElement;clear();onLock(s.locked)};
  const key=(e:KeyboardEvent)=>{
   const movement=["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","KeyR"].includes(e.code);
   if(!s.locked&&!mapOpen&&!movement&&e.type!=="keyup")return;
   if(e.target instanceof HTMLElement&&e.target.matches("input,textarea,select"))return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyV','KeyR'].includes(e.code))e.preventDefault();
   if(e.type==='keyup')s.keys.delete(e.code);
   else {s.keys.add(e.code);if(!e.repeat&&e.code==='KeyV'){s.first=!s.first;onMode(s.first)}
    if(e.code==='KeyR'){s.x=ward.spawn.x;s.z=ward.spawn.z;s.yaw=0;s.pitch=-0.12}}
  };
  const mouse=(e:MouseEvent)=>{if(s.locked){s.yaw-=e.movementX*0.002;s.pitch=Math.max(-1.05,Math.min(0.85,s.pitch-e.movementY*0.002))}};
  const click=()=>{if(mapOpen)return;if(document.pointerLockElement!==gl.domElement)gl.domElement.requestPointerLock()?.catch(()=>onLock(false))};
  document.addEventListener('pointerlockchange',lock);document.addEventListener('keydown',key);document.addEventListener('keyup',key);document.addEventListener('mousemove',mouse);window.addEventListener('blur',clear);gl.domElement.addEventListener('click',click);
  return ()=>{document.removeEventListener('pointerlockchange',lock);document.removeEventListener('keydown',key);document.removeEventListener('keyup',key);document.removeEventListener('mousemove',mouse);window.removeEventListener('blur',clear);gl.domElement.removeEventListener('click',click);if(document.pointerLockElement===gl.domElement)document.exitPointerLock()};
 },[gl,onLock,onMode,mapOpen]);
 useFrame((_,delta)=>{
  const s=state.current;const dt=Math.min(delta,0.05);
  let forward=Number(s.keys.has('KeyW')||s.keys.has('ArrowUp'))-Number(s.keys.has('KeyS')||s.keys.has('ArrowDown'));
  let right=Number(s.keys.has('KeyD')||s.keys.has('ArrowRight'))-Number(s.keys.has('KeyA')||s.keys.has('ArrowLeft'));
  const len=Math.hypot(forward,right);if(len){forward/=len;right/=len;}
  const speed=(s.keys.has('ShiftLeft')||s.keys.has('ShiftRight')?8:4)*dt;
  const yaw=mapOpen?0:s.yaw;
  move(s,(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed);
  if(avatar.current){avatar.current.position.set(s.x,0,s.z);avatar.current.rotation.y=s.yaw;avatar.current.visible=!s.first;}
  target.current.set(s.x,1.65,s.z);
  const direction=new Vector3(-Math.sin(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch));
  if(s.first){camera.position.copy(target.current);camera.lookAt(target.current.clone().add(direction));}
  else{
   desired.current.copy(direction).multiplyScalar(-6).add(target.current);desired.current.y+=1.5;
   const offset=desired.current.clone().sub(target.current);const distance=offset.length();
   ray.current.set(target.current,offset.normalize());ray.current.far=distance;
   // Ignore the player's own meshes when shortening the chase camera near scenery.
   const isAvatar=(o:Object3D):boolean=>o===avatar.current || (!!o.parent&&isAvatar(o.parent));
   const hit=ray.current.intersectObjects(scene.children,true).find(h=>!isAvatar(h.object));
   if(hit)desired.current.copy(target.current).addScaledVector(offset,Math.max(0.15,hit.distance-0.3));
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


