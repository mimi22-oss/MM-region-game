import {useRef,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {Group} from 'three';
import type {RobotAppearance} from '../data/appearance';
import type {CharacterMotion} from './CartoonCharacter';

export function RobotHand({style,color,accent}:{style:RobotAppearance['hands'];color:string;accent:string}){
 return <group name={`robot-hand-${style}`}>
  <mesh scale={[.07,.06,.065]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color={color}/></mesh>
  {style==='rounded'?null:style==='claw'?[-1,1].map(side=><group key={side} position={[side*.055,-.045,0]} rotation={[0,0,-side*.25]}><mesh><boxGeometry args={[.022,.10,.03]}/><meshStandardMaterial color={accent}/></mesh><mesh position={[-side*.015,-.05,0]}><boxGeometry args={[.05,.018,.03]}/><meshStandardMaterial color={accent}/></mesh></group>):[-1,0,1].map(i=><mesh key={i} position={[i*.035,-.075,-.02]} rotation={[.30,0,0]}><boxGeometry args={[.022,.09,.03]}/><meshStandardMaterial color={accent}/></mesh>)}
 </group>;
}

export function RobotLegs({style,color,accent,motion}:{style:RobotAppearance['legs'];color:string;accent:string;motion?:RefObject<CharacterMotion>}){
 const feet=useRef<(Group|null)[]>([]);
 useFrame(()=>{feet.current.forEach((foot,i)=>{if(foot){const phase=(motion?.current.distance??0)*6+i*Math.PI,active=Math.min(1,Math.abs(motion?.current.speed??0));foot.position.z=Math.sin(phase)*.10*active;foot.position.y=Math.max(0,Math.sin(phase))*.06*active;}});});
 return <group name={`robot-legs-${style}`}>
  {[-1,1].map((side,i)=>style==='feet'?<group key={side} ref={node=>{feet.current[i]=node;}}>
   <mesh position={[side*.16,.28,0]}><cylinderGeometry args={[.052,.06,.26,10]}/><meshStandardMaterial color={accent}/></mesh>
   <mesh position={[side*.16,.075,-.065]}><boxGeometry args={[.17,.15,.30]}/><meshStandardMaterial color={color}/></mesh>
   <mesh position={[side*.16,.015,-.065]}><boxGeometry args={[.18,.03,.31]}/><meshStandardMaterial color="#34333c"/></mesh>
  </group>:<group key={side} position={[side*.27,.18,0]}>
   <mesh><boxGeometry args={[.19,.36,.67]}/><meshStandardMaterial color="#34333c"/></mesh>
   {[-.21,0,.21].map(z=><mesh key={z} position={[side*.102,0,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.125,.125,.025,12]}/><meshStandardMaterial color={accent}/></mesh>)}
   {[-.26,-.13,0,.13,.26].map(z=><mesh key={z} position={[0,.185,z]}><boxGeometry args={[.20,.018,.045]}/><meshStandardMaterial color={color}/></mesh>)}
  </group>)}
 </group>;
}
