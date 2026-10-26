import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {CanvasTexture,Group,Mesh,Vector2,Vector3,Quaternion,DoubleSide} from 'three';
import {radiusAt} from '../game/fireBalloonModel';
import {balloonRide,BALLOON_LAUNCH} from '../game/balloonRide';
import {homeGates} from '../game/homeAccess';
import {CandleInHolder} from './Candle';
function Beam({a,b}:{a:[number,number,number];b:[number,number,number]}){
 const pose=useMemo(()=>{const from=new Vector3(...a),to=new Vector3(...b),delta=to.clone().sub(from);return {position:from.add(to).multiplyScalar(.5),rotation:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.clone().normalize()),length:delta.length()};},[a,b]);
 return <mesh position={pose.position} quaternion={pose.rotation}><cylinderGeometry args={[.045,.045,pose.length,6]}/><meshStandardMaterial color="#715130"/></mesh>;
}
function Sign({text}:{text:string}){
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const c=canvas.getContext('2d')!;
 c.fillStyle='rgba(22,44,49,.9)';c.beginPath();c.roundRect(0,0,768,160,28);c.fill();c.fillStyle='#fff3b6';c.textAlign='center';c.textBaseline='middle';c.font='bold 38px Myanmar Text, sans-serif';c.fillText(text,384,80);return new CanvasTexture(canvas);},[text]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 return <sprite scale={[5.6,1.17,1]} raycast={()=>{}}><spriteMaterial map={texture} depthWrite={false} transparent toneMapped={false}/></sprite>;
}
/** One passenger balloon, independent of decorative sky swarms and streamed regions. */
export function PassengerBalloon(){
 const root=useRef<Group>(null),marker=useRef<Group>(null),ring=useRef<Mesh>(null),homeArrow=useRef<Group>(null);
 const profile=useMemo(()=>Array.from({length:81},(_,i)=>{const y=1.5+i/80*3.54;return new Vector2(radiusAt(y)*3.4,y*3.4);}),[]);
 useFrame(({clock})=>{
  const b=balloonRide,t=clock.elapsedTime;
  if(root.current){root.current.position.set(b.x,b.y,b.z);root.current.rotation.y=b.yaw;}
  if(marker.current){marker.current.position.set(b.x,b.y+.04,b.z);marker.current.visible=!b.riding;}
  if(ring.current)ring.current.scale.setScalar(1+Math.sin(t*2.4)*.055);
  if(homeArrow.current){homeArrow.current.rotation.y=Math.atan2(b.x-homeGates.street.x,b.z-homeGates.street.z);homeArrow.current.position.y=.18+Math.sin(t*2)*.08;}
 });
 return <>
  <group ref={root} name="passenger-balloon" userData={{dynamic:true,passengerBalloon:true}}>
   <mesh castShadow><latheGeometry args={[profile,48]}/><meshStandardMaterial color="#f1a02e" emissive="#d77a16" emissiveIntensity={.15} side={DoubleSide}/></mesh>
   {[2.1,3.3,4.35].map(y=><mesh key={y} position={[0,y*3.4,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[radiusAt(y)*3.4+.025,.065,6,48]}/><meshStandardMaterial color="#8b3925"/></mesh>)}
   <mesh position={[0,.13,0]} castShadow receiveShadow><boxGeometry args={[2.7,.26,2.35]}/><meshStandardMaterial color="#a5783d"/></mesh>
   {[-1,1].map(side=><group key={side}>
    <mesh position={[side*1.28,.75,0]}><boxGeometry args={[.12,1.0,2.35]}/><meshStandardMaterial color="#b28247"/></mesh>
    <mesh position={[0,.75,side*1.1]}><boxGeometry args={[2.5,1.0,.12]}/><meshStandardMaterial color="#be9051"/></mesh>
    <mesh position={[side*1.28,1.28,0]}><boxGeometry args={[.17,.13,2.5]}/><meshStandardMaterial color="#714c29"/></mesh>
    <mesh position={[0,1.28,side*1.1]}><boxGeometry args={[2.7,.13,.17]}/><meshStandardMaterial color="#714c29"/></mesh>
    {[.42,.64,.86,1.08].map(y=><group key={y}>
     <mesh position={[side*1.35,y,0]}><boxGeometry args={[.018,.035,2.3]}/><meshStandardMaterial color="#805b30"/></mesh>
     <mesh position={[0,y,side*1.17]}><boxGeometry args={[2.6,.035,.018]}/><meshStandardMaterial color="#805b30"/></mesh>
    </group>)}
   </group>)}
   {[-1,1].flatMap(x=>[-1,1].map(z=><Beam key={x+','+z} a={[x*1.2,1.25,z*1.03]} b={[x*1.04,5.2,z*.88]}/>))}
   <Beam a={[-1.1,3.35,0]} b={[1.1,3.35,0]}/><Beam a={[0,3.35,-.9]} b={[0,3.35,.9]}/>
   <mesh position={[0,3.35,0]}><boxGeometry args={[1.3,.12,.9]}/><meshStandardMaterial color="#343535" metalness={.6} roughness={.4}/></mesh>
   <CandleInHolder position={[0,3.42,0]} scale={.65} flameScale={2.4} hasLight={false} lit/>
  </group>
  <group ref={marker} name="balloon-boarding-marker" userData={{dynamic:true}}>
   <mesh ref={ring} raycast={()=>{}} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[3.1,3.3,48]}/><meshBasicMaterial color="#ffca55" transparent opacity={.8} side={DoubleSide} depthWrite={false}/></mesh>
   <group position={[0,2.8,2.3]}><Sign text="Balloon စီးရန် အနားကပ်ပါ"/></group>
  </group>
  <group position={[homeGates.street.x,0,homeGates.street.z]} name="home-balloon-directions" userData={{dynamic:true}}>
   <group position={[0,3.6,0]}><Sign text="Balloon • ဘောလုံးကွင်း"/></group>
   <group ref={homeArrow}>{[0,.6,1.2].map(z=><mesh key={z} position={[0,.12,z]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[.25,.45,3]}/><meshBasicMaterial color="#ffc647"/></mesh>)}</group>
  </group>
  <mesh position={[BALLOON_LAUNCH.x,.015,BALLOON_LAUNCH.z]} rotation={[-Math.PI/2,0,0]} name="balloon-launch-pad"><ringGeometry args={[3.6,3.7,48]}/><meshBasicMaterial color="#ead7a0" transparent opacity={.6} depthWrite={false}/></mesh>
 </>;
}
