import React, { useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Player, type TeleportTarget } from '../../src/components/Player';
import { CarControls } from '../../src/components/CarControls';
import { carRide, carInput, currentCar, driveableCars, type CarStatus } from '../../src/game/carRide';
import { createMobileInput } from '../../src/game/mobileInput';
import { sceneGround } from '../../src/game/groundSurface';
import { Road } from '../../src/components/Road';
import { ward } from '../../src/data/ward';
import '../../src/style.css';

const car=driveableCars[0], c=Math.cos(car.yaw),s=Math.sin(car.yaw);
function Inspect(){
 useFrame(({scene,camera,clock})=>{
  const car=currentCar()??driveableCars[0],avatar=scene.getObjectByName('player-avatar');
  const model=scene.getObjectByName(`driveable-${car.id}`);
  (window as any).carTest={...car,input:{...carInput},frontAngles:['left','right'].map(side=>model?.getObjectByName(`${side}-front-wheel`)?.rotation.y),steeringWheel:model?.getObjectByName('steering-wheel')?.rotation.z,driving:!!currentCar(),gear:carRide.gear,interior:carRide.interior,feetY:avatar?.position.y,ground:sceneGround(scene,clock.elapsedTime).height(car.x,car.z),camera:camera.position.toArray()};
 });return null;
}
function Fixture(){
 const [status,setStatus]=useState<CarStatus>({driving:false,near:false,gear:0,rpm:850,kmh:0,clutch:false,notice:'',steering:0});
 const [zoom,setZoom]=useState(6),[topDown,setTopDown]=useState(false),[paused,setPaused]=useState(false);
 const [teleport,setTeleport]=useState<TeleportTarget>({x:car.x+c*1.75,z:car.z-s*1.75,yaw:car.yaw,distance:6,seq:1});
 const input=useRef(createMobileInput()),ignore=useCallback(()=>{},[]);
 return <>
  <div style={{position:'fixed',left:12,top:12,zIndex:100}}><button data-action="pause" onClick={()=>setPaused(value=>!value)}>Pause</button><button data-action="teleport" onClick={()=>setTeleport({x:car.x+20,z:car.z+20,seq:Date.now()})}>Teleport</button></div>
  <Canvas style={{width:'100vw',height:'100vh'}} dpr={.5} shadows={false} camera={{far:10000}}>
   <ambientLight intensity={2}/><directionalLight position={[0,100,10]} intensity={2}/><color attach="background" args={['#c6ded8']}/>
   <mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[20000,20000]}/><meshBasicMaterial color="#92a36b"/></mesh>
   {ward.roads.map(road=><Road key={road.id} r={road}/>)}
   <Player character="cartoon" onCarStatus={setStatus} mapOpen={paused} controlsBlocked={paused} mobileInput={input} zoom={zoom} topDown={topDown} teleportTarget={teleport} onMode={ignore} onLock={ignore} onTopDown={setTopDown} onZoom={setZoom} onPosition={ignore}/>
   <Inspect/>
  </Canvas>
  {!paused&&<CarControls status={status}/>}
 </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Fixture/></React.StrictMode>);
