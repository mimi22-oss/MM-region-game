import { mobileQuality } from '../game/sceneBudget';
import { angle, ward } from '../data/ward';
type TreeData={id:string;x:number;z:number;radius:number};
type TreeProps={t:TreeData;i?:number;variant?:'large'|'canopy'|'farm'};
export function Tree({t,i=0,variant='large'}:TreeProps){
 if(variant==='farm')return <group key={t.id} position={[t.x,0,t.z]}><mesh position={[0,5.75,0]} castShadow><cylinderGeometry args={[0.3,t.radius,11.5,8]}/><meshStandardMaterial color="#795d3b"/></mesh><mesh position={[0,14,0]} castShadow><icosahedronGeometry args={[3.6,mobileQuality?0:2]}/><meshStandardMaterial color="#547b48"/></mesh></group>;
 if(variant==='canopy')return <group key={t.id} position={[t.x,0,t.z]} scale={[1,17.6/14.095,1]}>
 <mesh position={[0,4,0]} castShadow><cylinderGeometry args={[0.32,t.radius,8,8]}/><meshStandardMaterial color="#796043"/></mesh>
 <group rotation={[0,angle,0]}><mesh position={[(i<32?1:-1)*4.5,8,0]} rotation={[0,0,-(i<32?1:-1)*Math.atan2(9,4)]} castShadow><cylinderGeometry args={[0.18,0.35,Math.hypot(9,4),7]}/><meshStandardMaterial color="#796043"/></mesh></group> <mesh position={[(i<32?1:-1)*9*Math.cos(angle),10,-(i<32?1:-1)*9*Math.sin(angle)]} scale={[1,0.65,1]} castShadow><icosahedronGeometry args={[6.3,mobileQuality?0:2]}/><meshStandardMaterial color={i%2?'#497954':'#628850'}/></mesh>
 <mesh position={[(i<32?1:-1)*4*Math.cos(angle),9.3,-(i<32?1:-1)*4*Math.sin(angle)]} scale={[1,0.7,1]} castShadow><icosahedronGeometry args={[5.8,1]}/><meshStandardMaterial color="#759555"/></mesh>
 </group>;
 return <group key={t.id} position={[t.x,0,t.z]} scale={[1,17.6/18.2,1]}>
  <mesh position={[0,5.5,0]} castShadow><cylinderGeometry args={[0.55,t.radius,11,10]}/><meshStandardMaterial color="#71543b" roughness={1}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*1.8,10,0]} rotation={[0,0,-side*0.8]} castShadow><cylinderGeometry args={[0.2,0.45,5,7]}/><meshStandardMaterial color="#71543b"/></mesh>)}
  <mesh position={[0,13,0]} scale={[1,0.8,1]} castShadow><icosahedronGeometry args={[6.5,mobileQuality?0:2]}/><meshStandardMaterial color={i%2?'#486e40':'#567e47'} roughness={1}/></mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*3.5,11.6,1]} castShadow><icosahedronGeometry args={[3.8,1]}/><meshStandardMaterial color="#62874b" roughness={1}/></mesh>)}
 </group>;
}
export function Trees(){return <>{ward.largeTrees.map((t,i)=><Tree key={t.id} t={t} i={i}/>)}{ward.trees.map((t,i)=><Tree key={t.id} t={t} i={i} variant="canopy"/>)}</>}
export function FarmTrees(){return <>{ward.farmTrees.map(t=><Tree key={t.id} t={t} variant="farm"/>)}</>}
