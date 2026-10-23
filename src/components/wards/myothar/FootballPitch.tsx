import { area5 } from '../../../data/wards/myothar/area5';
import { Box } from '../../Primitives';

export function FootballPitch(){
 const p=area5.pitch;
 return <group position={[p.x,0,p.z]} rotation={[0,p.rotation,0]}>
  <Box position={[0,0.04,0]} size={[p.width+8,0.08,p.depth+8]} color="#81925c"/>
  {Array.from({length:8},(_,i)=><Box key={i} position={[0,0.09,-42+i*12]} size={[p.width,0.04,12]} color={i%2?'#668b50':'#719858'}/>)}
  {[-1,1].map(s=><group key={s}>
   <Box position={[s*30,0.13,0]} size={[0.15,0.04,96]} color="#eee9d2"/>
   <Box position={[0,0.13,s*48]} size={[60,0.04,0.15]} color="#eee9d2"/>
   <Box position={[0,0.13,s*32]} size={[36,0.04,0.15]} color="#eee9d2"/>
   {[-1,1].map(t=><Box key={t} position={[t*18,0.13,s*40]} size={[0.15,0.04,16]} color="#eee9d2"/>)}
   {[-1,1].map(t=><Box key={t} position={[t*3.66,1.22,s*48]} size={[0.12,2.44,0.12]} color="#f3f0de"/>)}
   <Box position={[0,2.44,s*48]} size={[7.44,0.12,0.12]} color="#f3f0de"/>
  </group>)}
  <Box position={[0,0.13,0]} size={[60,0.04,0.15]} color="#eee9d2"/>
  <mesh position={[0,0.155,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[9,9.15,64]}/><meshBasicMaterial color="#eee9d2"/></mesh>
 </group>;
}

