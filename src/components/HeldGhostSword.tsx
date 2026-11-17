import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {createPortal,useFrame,useThree} from '@react-three/fiber';
import {Group,Vector3,type Object3D} from 'three';
import {useThreeGhostsMission} from '../game/missions/threeGhostsMission';
import {belongsToAvatar,findSwordHand,swordGripRotation} from '../game/missions/ghostSwordAttachment';
import {getPlayerDeathState} from '../game/playerDeath';
import {currentCar} from '../game/carRide';
import {balloonRide} from '../game/balloonRide';
import {motorcycleRide} from '../game/motorcycleRide';
import {GhostSwordModel} from './GhostSwordModel';
import {registerCombatWeapon} from '../game/combat/combatRuntime';

import {SwordCombatVFX} from './combat/SwordCombatVFX';
import {requestSwordAttack} from '../game/combat/combatInput';
import {combatGrip} from '../game/combat/SwordPose';

export function HeldGhostSword({avatar}:{avatar:RefObject<Group|null>}){
  const progress=useThreeGhostsMission();
  const scene=useThree(state=>state.scene);
  const equipped=progress.equippedWeapon==='ghost-sword';
  useEffect(()=>{
    if(!equipped)return;
    const attack=(e:KeyboardEvent)=>{
      if(e.code!=='KeyF'||e.repeat||e.altKey||e.ctrlKey||e.metaKey||
         (e.target instanceof HTMLElement && (e.target.isContentEditable||e.target.closest('input,textarea,select'))))return;
      e.preventDefault();
      requestSwordAttack(e.shiftKey?'Heavy_Slash':'attack');
    };
    window.addEventListener('keydown',attack);
    return ()=>window.removeEventListener('keydown',attack);
  },[equipped]);
  return <>{equipped&&<EquippedSword avatar={avatar}/>}
    {progress.swordCollected&&createPortal(<SwordCombatVFX/>,scene)}</>;
}
function EquippedSword({avatar}:{avatar:RefObject<Group|null>}){
  const [hand,setHand]=useState<Object3D|null>(null),lastCheck=useRef(-Infinity);
  useFrame(({clock})=>{
    if(clock.elapsedTime-lastCheck.current<.25)return;
    lastCheck.current=clock.elapsedTime;
    const root=avatar.current;
    if(!root){if(hand)setHand(null);return;}
    if(hand&&belongsToAvatar(hand,root))return;
    const next=findSwordHand(root);
    if(next!==hand)setHand(next);
  });
  return hand&&avatar.current?createPortal(<SwordGrip hand={hand} avatar={avatar.current}/>,hand):null;
}
function SwordGrip({hand,avatar}:{hand:Object3D;avatar:Object3D}){
  const root=useRef<Group>(null),scale=useRef(new Vector3());
  useLayoutEffect(()=>{const weapon=root.current;if(!weapon)return;
    const grip=combatGrip(hand);
    weapon.quaternion.copy(grip?.rotation??swordGripRotation(hand,avatar));
    if(grip)weapon.position.copy(grip.position);},[hand,avatar]);
  useLayoutEffect(()=>root.current?registerCombatWeapon(root.current,avatar):undefined,[hand,avatar]);
  useFrame(()=>{
    const weapon=root.current;if(!weapon)return;
    weapon.visible=!currentCar()&&!balloonRide.riding&&!motorcycleRide.riding&&getPlayerDeathState().phase==='alive';
    if(!weapon.visible)return;
    // Mixamo bones may inherit a centimetre-unit scale; keep the blade at 0.95 world metres.
    hand.getWorldScale(scale.current);
    weapon.scale.set(1/Math.max(Math.abs(scale.current.x),.0001),1/Math.max(Math.abs(scale.current.y),.0001),1/Math.max(Math.abs(scale.current.z),.0001));
  });
  return <group ref={root} name="player-held-ghost-sword"><group position={[0,-.025,-.015]}>
    <GhostSwordModel held/>
    {/* Calibrated from knife.glb's blade bounds after the 0.95m grip normalization. */}
    <group name="sword-blade-base" position={[0,-.133,0]}/><group name="sword-blade-tip" position={[0,-.779,0]}/>
  </group></group>;
}
