import { DoubleSide } from 'three';
import { estatePanels,estatePalms } from '../data/farmEstate';
import { angle,toWorld } from '../data/ward';
import { HomeGate } from './HomeGate';
import { homeGates } from '../game/homeAccess';
import { Box } from './Primitives';
function ArecaPalm({x,z,index}:{x:number;z:number;index:number}){
 const height=9+(index%4)*.7;
 return <group position={[x,0,z]} name="areca-palm">
  <mesh position={[0,height/2,0]}><cylinderGeometry args={[.12,.22,height,6]}/><meshStandardMaterial color="#a29376"/></mesh>
  <mesh position={[0,height+.3,0]}><cylinderGeometry args={[.18,.16,1.1,6]}/><meshStandardMaterial color="#6f9c44"/></mesh>
  {Array.from({length:7},(_,i)=><group key={i} position={[0,height+.7,0]} rotation={[0,i*Math.PI*2/7,0]}>
   <mesh position={[0,-.25,1.1]} rotation={[.25,0,0]} scale={[.38,.13,1.6]}><octahedronGeometry args={[1,0]}/><meshStandardMaterial color={i%2?'#4c873f':'#639b45'}/></mesh>
  </group>)}
  <mesh position={[.18,height-.3,0]} scale={[.22,.38,.2]}><icosahedronGeometry args={[1,0]}/><meshStandardMaterial color="#bf8b42"/></mesh>
 </group>;
}
export function FarmEstate(){const gate=homeGates.street;return <group name="farmhouse-whole-estate">
 {estatePanels.map((p,i)=>{const w=toWorld(p.u,p.v),base=p.raised?.9:0;return <group key={i} position={[w.x,base,w.z]} rotation={[0,angle+(p.alongU?0:Math.PI/2),0]}>
  {[-1,1].map(side=><Box key={side} position={[side*p.length/2,1.1,0]} size={[.09,2.2,.09]} color="#718889"/>)}
  {[.18,2.05].map(y=><Box key={y} position={[0,y,0]} size={[p.length,.05,.05]} color="#789296"/>)}
  <mesh position={[0,1.1,0]}><planeGeometry args={[p.length,1.8,Math.ceil(p.length/.35),6]}/><meshBasicMaterial color="#698b8c" side={DoubleSide} wireframe/></mesh>
 </group>})}
 <group position={[gate.x,0,gate.z]} rotation={[0,gate.rotation,0]}><HomeGate id="street" width={gate.width}/></group>
 {estatePalms.map((p,i)=><ArecaPalm key={p.id} x={p.x} z={p.z} index={i}/>)}
 </group>}
