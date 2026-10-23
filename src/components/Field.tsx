import { ward } from '../data/ward';
import { Box, Block } from './Primitives';
type FieldData=(typeof ward.fields)[number];
export function Field({f,bunded=false}:{f:FieldData;bunded?:boolean}){
 if(bunded)return <group  position={[f.x,0,f.z]} rotation={[0,f.rotation,0]}>
  <Block y={0.06} w={f.width} h={0.1} d={f.depth} color={f.color}/>
  {[-1,1].map(side=><group key={side}><Block x={side*f.width/2} y={0.2} w={0.7} h={0.4} d={f.depth} color="#b4aa76"/><Block z={side*f.depth/2} y={0.2} w={f.width} h={0.4} d={0.7} color="#b4aa76"/></group>)}
  {Array.from({length:Math.max(1,Math.ceil((f.width-4)/3))},(_,n)=><Block key={n} x={-f.width/2+3+n*3} y={0.22} w={0.4} h={0.2} d={f.depth-2} color="#a0b75c"/>)}
 </group>;
 return <group  position={[f.x,0,f.z]} rotation={[0,f.rotation,0]}>
 <Box position={[0,0.02,0]} size={[f.width,0.04,f.depth]} color={f.color}/>
 {Array.from({length:12},(_,n)=><Box key={n} position={[-f.width/2+n*5,0.055,0]} size={[0.3,0.04,f.depth]} color="#7e8b50"/>)}
 </group>;
}
export function Fields(){return <>{ward.fields.map((f,i)=><Field key={i} f={f}/>)}{[...ward.westernFields,...ward.southernFields].map(f=><Field key={f.id} f={f} bunded/>)}</>}

