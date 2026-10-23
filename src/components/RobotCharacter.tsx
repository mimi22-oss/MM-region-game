import { useMemo, type RefObject } from 'react';
import { Group, Shape } from 'three';

import { playerPalette, type RobotPalette } from '../game/robotAppearance';
function Ball({position,scale,color}:{position:[number,number,number];scale:[number,number,number];color:string}){return <mesh position={position} scale={scale} castShadow><sphereGeometry args={[1,20,14]}/><meshStandardMaterial color={color} roughness={0.35} metalness={0.12}/></mesh>}

/** Reference-inspired mint robot. Front faces -Z, matching the player heading. */
export function RobotCharacter({wheels,palette=playerPalette,size=1}:{wheels:RefObject<Group|null>;palette?:RobotPalette;size?:number}){
 const {shell:mint,panel:dark,accent:orange,rubber,trim}=palette;
 const smile=useMemo(()=>{const s=new Shape();s.moveTo(-0.105,0.025);s.quadraticCurveTo(0,-0.015,0.105,0.025);s.quadraticCurveTo(0,-0.105,-0.105,0.025);return s},[]);
 return <group scale={0.95*size} name="robot-character">
  <group ref={wheels} position={[0,0.24,0]}>
   {[-1,1].map(side=><group key={side} position={[side*0.305,0,0]} rotation={[0,0,Math.PI/2]}>
    <mesh castShadow><cylinderGeometry args={[0.24,0.24,0.15,24]}/><meshStandardMaterial color={rubber} roughness={0.9}/></mesh>
    {[-1,1].map(s=><mesh key={s} position={[0,s*0.078,0]}><cylinderGeometry args={[0.19,0.19,0.018,24]}/><meshStandardMaterial color={orange} roughness={0.4} metalness={0.25}/></mesh>)}
    <mesh position={[0,-side*0.092,0]}><cylinderGeometry args={[0.083,0.083,0.025,20]}/><meshStandardMaterial color={orange} metalness={0.3} roughness={0.4}/></mesh>
    {Array.from({length:12},(_,i)=><mesh key={i} position={[Math.cos(i*Math.PI/6)*0.239,0,Math.sin(i*Math.PI/6)*0.239]} rotation={[0,-i*Math.PI/6,0]}><boxGeometry args={[0.018,0.15,0.025]}/><meshStandardMaterial color="#77717c"/></mesh>)}
   </group>)}
  </group>
  <mesh position={[0,0.28,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[0.065,0.065,0.62,12]}/><meshStandardMaterial color={dark}/></mesh>
  <Ball position={[0,0.76,0]} scale={[0.285,0.41,0.235]} color={mint}/>
  <mesh position={[0,1.12,0]}><cylinderGeometry args={[0.19,0.18,0.08,24]}/><meshStandardMaterial color={orange}/></mesh>
  <mesh position={[0,1.2,0]}><cylinderGeometry args={[0.12,0.12,0.12,16]}/><meshStandardMaterial color={dark}/></mesh>
  <Ball position={[0,1.47,0]} scale={[0.37,0.32,0.29]} color={mint}/>
  <Ball position={[0,1.44,-0.235]} scale={[0.306,0.217,0.105]} color={dark}/>
  {[-1,1].map(side=><group key={side}>
   <mesh position={[side*0.14,1.46,-0.337]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.066,0.066,0.018,24]}/><meshStandardMaterial color={orange}/></mesh>
   <Ball position={[side*0.14,1.46,-0.351]} scale={[0.049,0.061,0.02]} color="#fffdf1"/>
   <Ball position={[side*0.14,1.46,-0.372]} scale={[0.024,0.032,0.009]} color="#101018"/>
   <Ball position={[side*0.14-0.007,1.472,-0.381]} scale={[0.006,0.008,0.003]} color="#ffffff"/>
   <mesh position={[side*0.37,1.46,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[0.124,0.124,0.09,24]}/><meshStandardMaterial color={orange}/></mesh>
   <mesh position={[side*0.419,1.46,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.075,0.075,0.012,20]}/><meshStandardMaterial color={dark}/></mesh>
   <Ball position={[side*0.285,0.94,0]} scale={[0.075,0.09,0.09]} color={rubber}/>
   <mesh position={[side*0.32,0.81,0]} rotation={[0,0,side*0.16]} castShadow><cylinderGeometry args={[0.032,0.032,0.22,10]}/><meshStandardMaterial color={orange}/></mesh>
   <mesh position={[side*0.34,0.69,0]}><cylinderGeometry args={[0.033,0.033,0.09,10]}/><meshStandardMaterial color={dark}/></mesh>
   <Ball position={[side*0.34,0.6,-0.01]} scale={[0.07,0.085,0.075]} color={mint}/>
  </group>)}
  <mesh position={[0,1.345,-0.335]} rotation={[0,Math.PI,0]}><shapeGeometry args={[smile]}/><meshStandardMaterial color="#fffdf1"/></mesh>
  <Ball position={[0,0.79,-0.225]} scale={[0.143,0.18,0.032]} color="#536c70"/>
  <Ball position={[0,0.79,-0.247]} scale={[0.128,0.16,0.019]} color={trim}/>
  {[-1,1].map(side=><Ball key={side} position={[side*0.045,0.74,-0.268]} scale={[0.022,0.025,0.012]} color={orange}/>)}
  <Ball position={[0,0.84,-0.268]} scale={[0.012,0.012,0.008]} color="#fffdf1"/>
  <mesh position={[0,1.025,-0.19]}><boxGeometry args={[0.065,0.028,0.025]}/><meshStandardMaterial color={orange}/></mesh>
  <mesh position={[-0.22,1.84,0.06]} rotation={[0,0,-0.12]}><cylinderGeometry args={[0.009,0.009,0.27,8]}/><meshStandardMaterial color={dark}/></mesh>
  <Ball position={[-0.204,1.98,0.06]} scale={[0.032,0.032,0.032]} color={orange}/>
 </group>;
}
