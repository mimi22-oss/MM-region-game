import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import {Group,Vector3} from 'three';
import {GhostNpc} from '../../src/components/GhostNpc';
import GhostDevMap from '../../src/components/GhostDevMap';
import {ThreeGhostsMissionScene} from '../../src/components/ThreeGhostsMissionScene';
import {getGhostRuntime} from '../../src/game/missions/ghostRuntimeRegistry';
import {GHOST_IDS,getThreeGhostsProgress,markGhostEncounter} from '../../src/game/missions/threeGhostsMission';
import {getGuardGhost} from '../../src/game/missions/ghostGuardCoordinator';
import {area5} from '../../src/data/wards/myothar/area5';
import {isGhostPointWalkable,isGhostSegmentWalkable,buildDefaultWarehouseEnvironment} from '../../src/data/ghostWarehouseWaypoints';
import {hasWarehouseLineOfSight} from '../../src/game/ghostAi';
const api=window as any,env=buildDefaultWarehouseEnvironment();let player:Group|null=null;
api.missionRuntime={progress:getThreeGhostsProgress,encounter:markGhostEncounter,guard:getGuardGhost,field:area5.pitch,
 place(x:number,z:number){player?.position.set(x-10,0,z);player?.updateWorldMatrix(true,true);},
 approach(id:string,distance:number){
  const g=api.__GHOST_NPC__.getSnapshot(id);
  for(let i=0;i<64;i++){const a=i*Math.PI/32,x=g.x+Math.cos(a)*distance,z=g.z+Math.sin(a)*distance;
   if(isGhostPointWalkable(x,z)&&isGhostSegmentWalkable(g.x,g.z,x,z,.25)&&hasWarehouseLineOfSight(g.x,g.z,x,z,env.obstacleBoxes)){
    api.missionRuntime.place(x,z);api.__GHOST_NPC__.forceState('CHASING',id);return {x,z};
   }
  }throw Error('No traversable approach');
 }};
function Inspect(){const {scene,camera}=useThree();camera.userData.playerOccupied=false;const scratch=new Vector3();
 api.missionRuntime.inspect=()=>GHOST_IDS.map(id=>{const obj=scene.getObjectByName(`night-ghost-${id}`);obj?.getWorldPosition(scratch);return {id,runtime:getGhostRuntime(id),root:obj?{x:scratch.x,z:scratch.z,visible:obj.visible}:null};});
 api.missionRuntime.hideRoot=(id:string)=>{const root=scene.getObjectByName(`night-ghost-${id}`)!;root.position.set(999,0,999);root.visible=false;};return null;
}
function Fixture(){const [selected,setSelected]=useState<string|null>(null),[mounted,setMounted]=useState(true),[paused,setPaused]=useState(false);
 api.missionRuntime.select=setSelected;api.missionRuntime.mount=setMounted;api.missionRuntime.pause=setPaused;
 return <><GhostDevMap/><Canvas dpr={1} shadows={false} style={{width:640,height:400}} camera={{position:[35,5,50]}}>
 <ambientLight intensity={2}/><group position={[10,0,0]}><group name="player-avatar" ref={g=>{player=g;}} position={[25,0,36]}/></group>
 {mounted&&GHOST_IDS.map((id,i)=><GhostNpc key={id} ghostId={id} zoneId="warehouse-row" initialSeed={101+i}
  enabled={selected===null||selected===id} paused={paused} minute={1260} timeMode="night" soundEnabled={false}/>)}
 <ThreeGhostsMissionScene/><Inspect/></Canvas></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
