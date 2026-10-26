import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { Box } from './Primitives';

/** Both roof halves share the exact ridge and eave coordinates; no floating cap. */
export function ImportedGableRoof({width, depth, eaveY, rise, overhang=.3, color, wallColor}: {
  width:number; depth:number; eaveY:number; rise:number; overhang?:number; color:string; wallColor:string;
}) {
  const run=width/2+overhang;
  const angle=Math.atan2(rise,run);
  const slope=Math.hypot(run,rise);
  const gables=useMemo(()=>{
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute([
      -width/2,eaveY,-depth/2, 0,eaveY+rise,-depth/2, width/2,eaveY,-depth/2,
      -width/2,eaveY,depth/2, width/2,eaveY,depth/2, 0,eaveY+rise,depth/2,
    ],3));
    geometry.computeVertexNormals();
    return geometry;
  },[width,depth,eaveY,rise]);
  return <group name="fitted-gable-roof">
    {[-1,1].map(side=><group key={side} position={[side*run/2,eaveY+rise/2,0]} rotation={[0,0,-side*angle]}>
      <Box position={[0,0,0]} size={[slope,.14,depth+2*overhang]} color={color}/>
    </group>)}
    <Box position={[0,eaveY+rise+.04,0]} size={[.28,.12,depth+2*overhang+.04]} color={color}/>
    <mesh geometry={gables}><meshStandardMaterial color={wallColor} roughness={.9}/></mesh>
  </group>;
}
