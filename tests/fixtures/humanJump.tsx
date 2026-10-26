import React,{useCallback,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Player,type TeleportTarget} from '../../src/components/Player';
import {MobileControls} from '../../src/components/MobileControls';
import {HomeGate} from '../../src/components/HomeGate';
import {homeGates} from '../../src/game/homeAccess';
import {createMobileInput} from '../../src/game/mobileInput';
import {toWorld} from '../../src/data/ward';
import '../../src/style.css';
const origin=toWorld(0,-80),gate=homeGates.street;
const api=window as any;
function Inspect(){useFrame(({scene})=>{
 const avatar=scene.getObjectByName('player-avatar');if(!avatar)return;
 api.jumpSample={x:avatar.position.x,y:avatar.position.y,z:avatar.position.z};
 api.jumpPeak=Math.max(api.jumpPeak??0,avatar.position.y);
 const knee=avatar.getObjectByName('jump-knee');
 api.jumpKnee=knee?.rotation.x??0;api.jumpMaxKnee=Math.max(api.jumpMaxKnee??0,Math.abs(api.jumpKnee));
});return null;}
function Fixture(){
 const [zoom,setZoom]=useState(6),[topDown,setTopDown]=useState(false),[paused,setPaused]=useState(false);
 const [character,setCharacter]=useState<'cartoon'|'robot'>('cartoon');
 const [teleport,setTeleport]=useState<TeleportTarget>({...origin,yaw:0,distance:6,seq:1});
 const input=useRef(createMobileInput()),ignore=useCallback(()=>{},[]);
 api.jumpInput=input.current;api.jumpPause=setPaused;api.jumpCharacter=setCharacter;
 api.jumpReset=(atGate=false)=>{api.jumpPeak=0;api.jumpMaxKnee=0;setTeleport({...(atGate?{x:gate.x+Math.sin(gate.rotation)*11,z:gate.z+Math.cos(gate.rotation)*11}:origin),yaw:atGate?gate.rotation:0,distance:6,seq:Date.now()});};
 api.jumpGate=gate;
 return <><Canvas style={{width:'100vw',height:'100vh'}} dpr={.6} camera={{far:1000}}>
  <ambientLight intensity={2}/><directionalLight position={[10,20,5]} intensity={2}/><color attach="background" args={['#b8d3e5']}/>
  <mesh rotation={[-Math.PI/2,0,0]} userData={{walkable:true}}><planeGeometry args={[20000,20000]}/><meshStandardMaterial color="#91ad78"/></mesh>
  <group position={[gate.x,0,gate.z]} rotation={[0,gate.rotation,0]}><HomeGate id="street" width={gate.width}/></group>
  <Player character={character} mobileInput={input} controlsBlocked={paused} mapOpen={false} zoom={zoom} topDown={topDown} teleportTarget={teleport} onMode={ignore} onLock={ignore} onTopDown={setTopDown} onZoom={setZoom} onPosition={ignore}/>
  <Inspect/>
 </Canvas><MobileControls input={input} disabled={paused} canJump={character==='cartoon'} onInteract={ignore}/></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
