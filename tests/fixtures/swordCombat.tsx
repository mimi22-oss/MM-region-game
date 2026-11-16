import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Group,Vector3} from 'three';
import {CartoonCharacter,type CharacterMotion} from '../../src/components/CartoonCharacter';
import {HeldGhostSword} from '../../src/components/HeldGhostSword';
import {ThreeGhostsMissionScene,requestThreeGhostsAction} from '../../src/components/ThreeGhostsMissionScene';
import {GhostNpc} from '../../src/components/GhostNpc';
import {HUMAN_PRESETS} from '../../src/data/appearance';
import {setCharacterRendererMode} from '../../src/game/characterRenderer';
import {playerCombat,combatEffects} from '../../src/game/combat/combatRuntime';
import {ghostCombatReaction} from '../../src/game/combat/GhostCombatReactions';
import {getGuardGhost,swordGuardClear} from '../../src/game/missions/ghostGuardCoordinator';
import {GHOST_IDS,markGhostEncounter,getThreeGhostsProgress,damageMissionGhost} from '../../src/game/missions/threeGhostsMission';
import {getGhostRuntime} from '../../src/game/missions/ghostRuntimeRegistry';
import {area5} from '../../src/data/wards/myothar/area5';
import {findSwordHand} from '../../src/game/missions/ghostSwordAttachment';
import {getPlayerDeathState} from '../../src/game/playerDeath';
const api=window as any,field=area5.pitch;
api.combatTest={frames:[],transitions:[],unlock(){GHOST_IDS.forEach(markGhostEncounter);},attack:requestThreeGhostsAction,
 guard(id:typeof GHOST_IDS[number],x:number,z:number,mode='return'){Object.assign(getGuardGhost(id),{x,z,mode,timer:100,initialized:true});},
 far(){GHOST_IDS.forEach((id,i)=>api.combatTest.guard(id,field.x+45+i*10,field.z+35));},
 hp:getThreeGhostsProgress,trimHp(id:string){damageMissionGhost(id,getThreeGhostsProgress().hp[id as typeof GHOST_IDS[number]]-10);},clear:swordGuardClear,field};
function Fixture(){const [kind,setKind]=useState('boy'),[mounted,setMounted]=useState(true),[npcs,setNpcs]=useState(true),avatar=useRef<Group>(null),motion=useRef<CharacterMotion>({speed:0,distance:0});
 const {scene,camera,gl}=useThree();camera.userData.playerOccupied=false;
 api.combatTest.kind=(value:string)=>{setCharacterRendererMode(value==='canolia'?'canolia':'glb');setKind(value);};
 api.combatTest.mount=setMounted;api.combatTest.npcs=setNpcs;
 api.combatTest.place=(x:number,z:number)=>avatar.current?.position.set(x,0,z);
 api.combatTest.speed=(speed:number)=>{motion.current.speed=speed;};
 api.combatTest.inspect=()=>{
  const root=avatar.current,hand=root?findSwordHand(root):null,weapon=root?.getObjectByName('player-held-ghost-sword');
  return {kind,state:{phase:playerCombat.phase,clip:playerCombat.clip,sequence:playerCombat.sequence,normalized:playerCombat.normalized,capable:playerCombat.capable,ready:playerCombat.weaponReady,busy:playerCombat.actionActive,locked:playerCombat.movementLocked},
   hand:hand?.name,swords:root?(()=>{let n=0;root.traverse(o=>{if(o.name==='player-held-ghost-sword')n++;});return n;})():0,
   player:root?.getWorldPosition(new Vector3()),base:weapon?.getObjectByName('sword-blade-base')?.getWorldPosition(new Vector3()),tip:weapon?.getObjectByName('sword-blade-tip')?.getWorldPosition(new Vector3()),
   progress:getThreeGhostsProgress(),death:getPlayerDeathState(),trailHead:combatEffects.trailHead,impactHead:combatEffects.impactHead,
   trails:combatEffects.trail.filter(t=>combatEffects.time-t.at<.3).map(t=>({base:t.base,tip:t.tip,seq:t.sequence})),
   ghosts:GHOST_IDS.map(id=>({id,runtime:getGhostRuntime(id),visible:scene.getObjectByName(`night-ghost-${id}`)?.visible,reaction:ghostCombatReaction(id)})),
   renders:{calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures},rigCount:root?.children.filter(c=>c.name.startsWith('glb-')||c.name==='blender-character').length};
 };
 useFrame((_,dt)=>{
  const p=getThreeGhostsProgress();playerCombat.context(p.swordCollected,true,!!api.combatTest.paused,getPlayerDeathState().phase!=='alive');
  motion.current.distance+=dt*motion.current.speed;
 },-1);
 useFrame((_,dt)=>{if(api.combatTest.closeup){
    camera.position.set(field.x+1.55,1.45,field.z-2.45);
    camera.lookAt(field.x,1.0,field.z-.18);
  }else{camera.lookAt(field.x,1.25,field.z-.5);}
  if(api.combatTest.freezeClip===playerCombat.clip&&playerCombat.phase==='ACTIVE'){
    api.combatTest.paused=true;api.combatTest.freezeClip='';
  }
  const combo=api.combatTest.comboProbe;
  if(combo&&playerCombat.actionActive&&combo.last!==playerCombat.sequence){
    combo.last=playerCombat.sequence;combo.seen.push(playerCombat.clip);
  }
  if(combo&&combo.seen.length<6&&combo.buffered!==playerCombat.sequence&&playerCombat.normalized>=.5&&playerCombat.normalized<=.96){
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',code:'KeyF'}));combo.buffered=playerCombat.sequence;
  }
  if(playerCombat.phase==='ACTIVE')api.combatTest.lastActive=api.combatTest.inspect();if(api.combatTest.frames.length<2000)api.combatTest.frames.push({dt,calls:gl.info.render.calls,triangles:gl.info.render.triangles});});
 return <><color attach="background" args={['#263443']}/><ambientLight intensity={1.5}/><directionalLight position={[5,8,3]} intensity={2}/>
 {mounted&&<group ref={avatar} name="player-avatar" position={[field.x+5,0,field.z]}><CartoonCharacter combat appearance={kind==='girl'?HUMAN_PRESETS.girl:HUMAN_PRESETS.boy} motion={motion}/><HeldGhostSword avatar={avatar}/></group>}
 {npcs&&GHOST_IDS.map((id,i)=><GhostNpc key={id} ghostId={id} zoneId="warehouse-row" enabled initialSeed={101+i} minute={1260} timeMode="night" soundEnabled={false}/>)}
 <ThreeGhostsMissionScene/>
 </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Canvas shadows={false} dpr={1} style={{width:640,height:480}} camera={{position:[field.x+4,3,field.z+5],fov:55}}><Fixture/></Canvas></React.StrictMode>);
