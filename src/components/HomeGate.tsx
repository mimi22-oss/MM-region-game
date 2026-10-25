import { useRef } from 'react';
import { useRegionFrame as useFrame } from './RegionActivity';
import { Group } from 'three';
import { homeAccess, homeGuidance, type HomeGate as GateId } from '../game/homeAccess';
export function HomeGate({id,width,height=1.8,color='#2563a6'}:{id:GateId;width:number;height?:number;color?:string}){
 const left=useRef<Group>(null),right=useRef<Group>(null);
 useFrame(()=>{const a=homeAccess.open[id]*Math.PI/2;if(left.current)left.current.rotation.y=a;if(right.current)right.current.rotation.y=-a});
 return <group userData={{dynamic:true}} name={`owner-only-${id}`}>
  {[-1,1].map(side=><group key={side} ref={side<0?left:right} position={[side*width/2,0,0]}>
   <mesh position={[-side*width/4,height/2+.1,0]} castShadow><boxGeometry args={[width/2-.015,height,.08]}/><meshStandardMaterial color={color} roughness={.4}/></mesh>
   <mesh position={[-side*(width/2-.15),height*.5, .06]}><sphereGeometry args={[.065,8,6]}/><meshStandardMaterial color="#f5cb55"/></mesh>
  </group>)}
 </group>;
}
export function HomeDirections(){
 const root=useRef<Group>(null);
 useFrame(()=>{if(root.current)root.current.visible=!!homeGuidance(homeAccess.x,homeAccess.z)});
 return <group ref={root} visible={false} userData={{dynamic:true}} name="home-entrance-directions">
  {[5.7,6.3,6.9].map(z=><group key={z} position={[0,.3,z]}>
   {[-1,1].map(side=><mesh key={side} position={[side*.16,0,0]} rotation={[0,-side*.7,0]}><boxGeometry args={[.08,.025,.48]}/><meshBasicMaterial color="#a6ffd9"/></mesh>)}
  </group>)}
 </group>;
}
