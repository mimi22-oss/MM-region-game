import { ward } from '../data/ward';
import { Block } from './Primitives';
import { FarmTrees } from './Tree';
import { Field } from './Field';
import { sourceIsEdited } from '../game/worldEdits';
export function Monastery(){const m=ward.monastery;return <group position={[m.x,0,m.z]} rotation={[0,m.rotation,0]}>
 <Block y={0.02} w={m.width} h={0.04} d={m.depth} color="#b9b08a"/>
 <Block z={-18} y={0.06} w={80} h={0.04} d={23} color="#a7a279"/>
 {m.buildings.map(b=><group key={b.id} position={[b.u,0,b.v]}>
 <Block y={0.35} w={b.width+2} h={0.7} d={b.depth+2} color="#d2c6a3"/>
 <Block y={3.6} w={b.width} h={6} d={b.depth} color={b.color}/>
 {[-1,1].map(s=><mesh key={s} position={[s*b.width/4,7.2,0]} rotation={[0,0,-s*Math.atan2(2,b.width/2)]} castShadow><boxGeometry args={[Math.hypot(b.width/2,2)+1.5,0.22,b.depth+2]}/><meshStandardMaterial color={b.roof}/></mesh>)}
 <Block y={2} z={-b.depth/2-0.06} w={2.4} h={3} d={0.15} color="#5c4b38"/>
 {[-0.32,0.32].map(s=><Block key={s} x={s*b.width} y={3.5} z={-b.depth/2-0.1} w={2.5} h={1.6} d={0.2} color="#75918b"/>)}
 </group>)}
 {m.stupas.map((p,i)=><group key={i} position={[p.u,0,p.v]}>
 <Block y={0.3} w={p.radius*2} h={0.6} d={p.radius*2} color="#eee2b8"/>
 {[0,1,2].map(n=><mesh key={n} position={[0,0.8+n*0.55,0]} castShadow><cylinderGeometry args={[p.radius*(0.85-n*0.15),p.radius*(1-n*0.15),0.55,24]}/><meshStandardMaterial color="#d9b555" metalness={0.45} roughness={0.35}/></mesh>)}
 <mesh position={[0,2.2,0]} castShadow><sphereGeometry args={[p.radius*0.6,24,16,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#e2b83e" metalness={0.55} roughness={0.3}/></mesh>
 <mesh position={[0,p.radius*1.5+2.2,0]} castShadow><coneGeometry args={[p.radius*0.4,p.radius*1.8,24]}/><meshStandardMaterial color="#edc856" metalness={0.5} roughness={0.3}/></mesh>
 </group>)}
 </group>}



export function OpenGround(){const p=ward.openGround;return <group position={[p.x,0,p.z]} rotation={[0,p.rotation,0]}><Block y={0.025} w={p.width} h={0.05} d={p.depth} color="#b8ac83"/>{[-1,1].map(side=><Block key={side} x={side*p.width/2} y={0.07} w={0.3} h={0.04} d={p.depth} color="#c9bf96"/>)}</group>}

export function Gardens(){const f=ward.farm,p=ward.pond,l=ward.frontLot,n=ward.farmNorthLand;return <>
 <group position={[n.x,0,n.z]} rotation={[0,n.rotation,0]}><Block y={0.025} w={n.width} h={0.05} d={n.depth} color="#b1b77c"/>{[-1,1].map(s=><Block key={s} x={s*n.width/2} y={0.08} w={0.25} h={0.1} d={n.depth} color="#d8c68b"/>)}</group>
 <group position={[l.x,0,l.z]} rotation={[0,l.rotation,0]}><Block y={0.015} w={l.width} h={0.03} d={l.depth} color="#c1b590"/></group>
 {ward.sideLots.map((l,i)=><group key={`empty${i}`} position={[l.x,0,l.z]} rotation={[0,l.rotation,0]}><Block y={0.02} w={l.width} h={0.04} d={l.depth} color="#c1b590"/>{[-1,1].map(s=><Block key={s} z={s*l.depth/2} y={0.05} w={l.width} h={0.06} d={0.15} color="#d8c68b"/>)}</group>)}
 {ward.yards.map((y,i)=><group key={i} position={[y.x,0,y.z]} rotation={[0,y.rotation,0]}><Block y={0.04} w={y.width} h={0.08} d={y.depth} color="#b7ad83"/></group>)}
 <group position={[f.x,0,f.z]} rotation={[0,f.rotation,0]}><Block y={0.025} w={f.width} h={0.05} d={f.depth} color="#a6a66e"/>{Array.from({length:6},(_,i)=><Block key={i} x={-17+i*3} z={-10} y={0.14} w={1.2} h={0.2} d={14} color="#6f914f"/>)}</group>
 <group position={[p.x,0,p.z]} rotation={[0,p.rotation,0]}><Block y={0.1} w={p.width+3} h={0.2} d={p.depth+3} color="#97825c"/><Block y={0.22} w={p.width} h={0.04} d={p.depth} color="#548f94"/>{[-1,1].map(s=><group key={s}><Block x={s*(p.width/2+0.6)} y={0.45} w={1.2} h={0.8} d={p.depth+2} color="#a18b60"/><Block z={s*(p.depth/2+0.6)} y={0.45} w={p.width+2} h={0.8} d={1.2} color="#a18b60"/></group>)}</group>
 <FarmTrees/>
 </>}





export function RiceMill(){const m=ward.riceMill;return <>
 {[m.yard,...m.paths].map((p,i)=><group key={i} position={[p.x,0,p.z]} rotation={[0,p.rotation,0]}><Block y={0.07} w={p.width} h={0.12} d={p.depth} color={i?'#b8a386':'#c6b996'}/></group>)}
 {m.fields.map((f,i)=><Field key={i} f={f} bunded/>)}
 {m.buildings.filter(b => !sourceIsEdited(b.id)).map((b,i)=><group key={b.id} position={[b.x,0,b.z]} rotation={[0,b.rotation,0]}>
  <Block y={0.15} w={b.width+2} h={0.3} d={b.depth+2} color="#b4a48b"/>
  <Block y={4.2} w={b.width} h={8.4} d={b.depth} color={b.color}/>
  {[-1,1].map(side=><mesh key={side} position={[side*b.width/4,9.8,0]} rotation={[0,0,-side*Math.atan2(2.8,b.width/2)]} castShadow><boxGeometry args={[Math.hypot(b.width/2,2.8)+1.4,0.25,b.depth+2]}/><meshStandardMaterial color={b.roof}/></mesh>)}
  <Block x={b.width/2+0.08} y={2.8} w={0.15} h={5.6} d={8} color="#54625b"/>
  {[-1,1].map(side=><Block key={side} x={side*b.width/2} y={6.8} w={0.2} h={1.2} d={b.depth-6} color="#748d87"/>)}
  {i===0&&<><Block y={11.5} w={5} h={1.2} d={24} color="#a28c66"/><Block x={b.width/2+2} z={10} y={5.4} w={3} h={10.8} d={3} color="#84908b"/></>}
 </group>)}
 </>}
