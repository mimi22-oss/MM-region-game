import { area5 } from '../../../data/wards/myothar/area5';
import { Box } from '../../Primitives';
import { sourceIsEdited } from '../../../game/worldEdits';

export function Warehouses(){
 return <>{area5.warehouses.filter(w => !sourceIsEdited(w.id)).map(w=><group key={w.id} position={[w.x,0,w.z]} rotation={[0,w.rotation,0]}>
  <Box position={[0,0.15,0]} size={[w.width+3,0.3,w.depth+3]} color="#baa98d"/>
  <Box position={[0,3.5,0]} size={[w.width,7,w.depth]} color={w.color}/>
  {[-1,1].map(side=><mesh key={side} position={[side*w.width/4,7.8,0]} rotation={[0,0,-side*Math.atan2(1.6,w.width/2)]} castShadow><boxGeometry args={[Math.hypot(w.width/2,1.6)+1,0.22,w.depth+1.8]}/><meshStandardMaterial color={w.roof}/></mesh>)}
  {[-1,1].map(side=><group key={side}><Box position={[side*(w.width/2+0.04),2.4,0]} size={[0.12,4.8,8]} color="#526564"/>{[-10,10].map(z=><Box key={z} position={[side*(w.width/2+0.1),5,z]} size={[0.15,1.1,3]} color="#90b8bd"/>)}</group>)}
 </group>)}</>;
}

