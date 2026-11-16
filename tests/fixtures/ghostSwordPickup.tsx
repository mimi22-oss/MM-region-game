import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Box3,Group,Vector3} from 'three';
import {CartoonCharacter,type CharacterMotion} from '../../src/components/CartoonCharacter';
import {RobotCharacter} from '../../src/components/RobotCharacter';
import {HeldGhostSword} from '../../src/components/HeldGhostSword';
import {ThreeGhostsMissionScene} from '../../src/components/ThreeGhostsMissionScene';
import {HUMAN_PRESETS} from '../../src/data/appearance';
import {setCharacterRendererMode} from '../../src/game/characterRenderer';
import {GHOST_IDS,getThreeGhostsProgress,markGhostEncounter} from '../../src/game/missions/threeGhostsMission';
import {registerGhostRuntime} from '../../src/game/missions/ghostRuntimeRegistry';
import {swordGuardClear} from '../../src/game/missions/ghostGuardCoordinator';
import {findSwordHand} from '../../src/game/missions/ghostSwordAttachment';
import {area5} from '../../src/data/wards/myothar/area5';
const api=window as any,field=area5.pitch;
api.swordTest={progress:getThreeGhostsProgress,unlock(){GHOST_IDS.forEach(markGhostEncounter);},guardClear:swordGuardClear,
 nearbyGhosts(){GHOST_IDS.forEach(id=>registerGhostRuntime(id).report(field.x+1,field.z,true,'chase'));}};
function Fixture(){const [kind,setKind]=useState('boy'),[showScene,setShowScene]=useState(true),avatar=useRef<Group>(null),wheels=useRef<Group>(null);
 const motion=useRef<CharacterMotion>({speed:2,distance:0}),{camera,scene}=useThree();
 api.swordTest.kind=(value:string)=>{setCharacterRendererMode(value==='code'?'code':'glb');setKind(value);};
 api.swordTest.scene=setShowScene;
 api.swordTest.place=(distance:number)=>{avatar.current!.position.set(field.x+distance,0,field.z);};
 api.swordTest.inspect=()=>{
  const player=avatar.current!,hand=findSwordHand(player),held=player.getObjectByName('player-held-ghost-sword');
  const sword=scene.getObjectByName('ghost-mission-sword');const v=new Vector3();
  player.getWorldPosition(v);
  return {kind,progress:getThreeGhostsProgress(),hand:hand?.name,held:!!held,attached:held?.parent===hand,
   player:{x:v.x,z:v.z},heldPosition:held?.getWorldPosition(new Vector3()),handPosition:hand?.getWorldPosition(new Vector3()),
   bladeBounds:held?new Box3().setFromObject(held):null,pickupVisible:sword?.visible};
 };
 useFrame((_,dt)=>{motion.current.distance+=dt*motion.current.speed;camera.lookAt(field.x,1,field.z);});
 return <><color attach="background" args={['#263443']}/><ambientLight intensity={2}/><directionalLight position={[2,5,-2]} intensity={2}/>
 <group ref={avatar} name="player-avatar" position={[field.x+5,0,field.z]}>
 {kind==='robot'?<RobotCharacter wheels={wheels}/>:<CartoonCharacter appearance={kind==='girl'?HUMAN_PRESETS.girl:HUMAN_PRESETS.boy} motion={motion}/>}
 <HeldGhostSword avatar={avatar}/></group>
 {showScene&&<ThreeGhostsMissionScene/>}</>;
}
createRoot(document.getElementById('root')!).render(<Canvas dpr={1} shadows={false} style={{width:640,height:480}} camera={{position:[field.x+2,2,field.z-3],fov:45}}><Fixture/></Canvas>);
