import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
function Block({x=0,y=0,z=0,w,h,d,color}:{x?:number;y?:number;z?:number;w:number;h:number;d:number;color:string}){return <mesh position={[x,y,z]} castShadow receiveShadow><boxGeometry args={[w,h,d]}/><meshStandardMaterial color={color}/></mesh>}
export function Canal(){return <>{[ward.canal,...ward.drains].map((c,i)=><Channel key={i} c={c}/>)}</>}
function Channel({c}:{c:typeof ward.canal}){return <group position={[c.x,0,c.z]} rotation={[0,c.rotation,0]}>
 <Block y={0.06} w={c.width+1} h={0.12} d={c.depth} color="#796e52"/>
 <mesh position={[0,0.14,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[c.width,c.depth]}/><meshStandardMaterial color="#4d9395" metalness={0.25} roughness={0.35}/></mesh>

 <Flow depth={c.depth}/>
 {[-1,1].map(s=><Block key={s} x={s*(c.width/2+0.3)} y={0.2} w={0.6} h={0.4} d={c.depth} color="#9a9778"/>)}
 {c.bridges.map(v=><group key={v}><Block z={v} y={0.16} w={c.width+2} h={0.3} d={5} color="#b7ad95"/>{[-1,1].map(s=><Block key={s} z={v+s*2.5} y={0.65} w={c.width+2} h={0.15} d={0.12} color="#d6cfb9"/>)}</group>)}
 </group>}
function Flow({depth}:{depth:number}){const ref=useRef<Group>(null);useFrame(({clock})=>{if(ref.current)ref.current.position.z=(clock.elapsedTime*1.5)%8});return <group ref={ref}>{Array.from({length:Math.max(1,Math.floor(depth/8)-1)},(_,i)=><mesh key={i} position={[Math.sin(i*2)*0.6,0.17,-depth/2+4+i*8]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[0.7,0.1]}/><meshBasicMaterial color="#a3d2c7" transparent opacity={0.5}/></mesh>)}</group>}export function Monastery(){const m=ward.monastery;return <group position={[m.x,0,m.z]} rotation={[0,m.rotation,0]}>
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
 {ward.yards.map((y,i)=><group key={i} position={[y.x,0,y.z]} rotation={[0,y.rotation,0]}><Block y={0.04} w={y.width} h={0.08} d={y.depth} color="#b7ad83"/>{[-1,1].map(s=><Block key={s} x={s*y.width/2} y={0.3} w={0.15} h={0.6} d={y.depth} color="#bba17d"/>)}</group>)}
 <group position={[f.x,0,f.z]} rotation={[0,f.rotation,0]}><Block y={0.025} w={f.width} h={0.05} d={f.depth} color="#a6a66e"/>{Array.from({length:6},(_,i)=><Block key={i} x={-17+i*3} z={-10} y={0.14} w={1.2} h={0.2} d={14} color="#6f914f"/>)}</group>
 <group position={[p.x,0,p.z]} rotation={[0,p.rotation,0]}><Block y={0.1} w={p.width+3} h={0.2} d={p.depth+3} color="#97825c"/><Block y={0.22} w={p.width} h={0.04} d={p.depth} color="#548f94"/>{[-1,1].map(s=><group key={s}><Block x={s*(p.width/2+0.6)} y={0.45} w={1.2} h={0.8} d={p.depth+2} color="#a18b60"/><Block z={s*(p.depth/2+0.6)} y={0.45} w={p.width+2} h={0.8} d={1.2} color="#a18b60"/></group>)}</group>
 {ward.farmTrees.map(t=><group key={t.id} position={[t.x,0,t.z]}><mesh position={[0,1.7,0]} castShadow><cylinderGeometry args={[0.22,t.radius,3.4,6]}/><meshStandardMaterial color="#795d3b"/></mesh><mesh position={[0,4,0]} castShadow><icosahedronGeometry args={[2.4,1]}/><meshStandardMaterial color="#547b48"/></mesh></group>)}
 </>}



