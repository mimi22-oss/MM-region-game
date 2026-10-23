import { ward } from '../data/ward';
import { Box } from './Primitives';
export type RoadData=(typeof ward.roads)[number];
export function Road({r}:{r:RoadData}){return <group key={r.id} position={[r.x,0,r.z]} rotation={[0,r.rotation,0]}>
 <Box position={[0,0.04,0]} size={[r.width+1.6,0.08,r.depth]} color="#c5b18d"/>
 <Box position={[0,0.09,0]} size={[r.width,0.06,r.depth]} color={r.main?'#697574':'#b9a887'}/>
 {r.main&&Array.from({length:96},(_,n)=><Box key={n} position={[0,0.13,n*8-380]} size={[0.15,0.02,3]} color="#e9d9a2"/>)}
 </group>}
