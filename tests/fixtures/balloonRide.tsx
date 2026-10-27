import React,{useCallback,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {Player} from '../../src/components/Player';
import {MobileControls} from '../../src/components/MobileControls';
import {BalloonControls} from '../../src/components/BalloonControls';
import {CandleAnimation} from '../../src/components/Candle';
import {balloonRide,balloonInput,BALLOON_LAUNCH,emptyBalloonStatus} from '../../src/game/balloonRide';
import {createMobileInput} from '../../src/game/mobileInput';
import '../../src/style.css';
const api=window as any;
function Inspect({paused}:{paused:boolean}){useFrame(({scene,camera})=>{
 const avatar=scene.getObjectByName('player-avatar');
 api.balloonSample={paused,...balloonRide,avatar:avatar?.position.toArray(),visible:avatar?.visible,camera:camera.position.toArray(),vertical:balloonInput.verticalJoystick};
});return null;}
function Fixture(){
 const [zoom,setZoom]=useState(6),[topDown,setTopDown]=useState(false),[paused,setPaused]=useState(false),[status,setStatus]=useState(emptyBalloonStatus);
 const input=useRef(createMobileInput()),ignore=useCallback(()=>{},[]);
 const teleport=useRef({x:BALLOON_LAUNCH.x+3.2,z:BALLOON_LAUNCH.z,yaw:BALLOON_LAUNCH.yaw,distance:6,seq:1});
 api.balloonPause=setPaused;api.balloonMobileInput=input.current;
 return <><Canvas style={{width:'100vw',height:'100vh'}} dpr={.6} camera={{far:10000}}>
  <ambientLight intensity={2}/><directionalLight position={[10,30,5]} intensity={2}/><color attach="background" args={['#b8d3e5']}/>
  <mesh rotation={[-Math.PI/2,0,0]} userData={{walkable:true}}><planeGeometry args={[20000,20000]}/><meshStandardMaterial color="#91ad78"/></mesh>
  <CandleAnimation/>
  <Player character="cartoon" onBalloonStatus={setStatus} mobileInput={input} controlsBlocked={paused} mapOpen={false} zoom={zoom} topDown={topDown} teleportTarget={teleport.current} onMode={ignore} onLock={ignore} onTopDown={setTopDown} onZoom={setZoom} onPosition={ignore}/>
  <Inspect paused={paused}/>
 </Canvas><MobileControls input={input} disabled={paused} flying={status.riding} onInteract={ignore}/>
 <BalloonControls status={status} paused={paused} onTopView={()=>setTopDown(v=>!v)} onZoom={d=>setZoom(v=>v*(d>0?1.4:1/1.4))}/></>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
