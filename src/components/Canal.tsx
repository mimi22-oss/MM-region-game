import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
import type { EastWestCanalPlot, WindingCanalPlot } from '../data/types';
import { Block } from './Primitives';
export function Canal(){return <>{[ward.canal,...ward.drains].map((c,i)=><Channel key={i} c={c}/>)}<CrossCanal/></>}
function Channel({c}:{c:typeof ward.canal}){return <group position={[c.x,0,c.z]} rotation={[0,c.rotation,0]}>
 <Block y={0.06} w={c.width+1} h={0.12} d={c.depth} color="#796e52"/>
 <mesh position={[0,0.14,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[c.width,c.depth]}/><meshStandardMaterial color="#4d9395" metalness={0.25} roughness={0.35}/></mesh>

 <Flow depth={c.depth}/>
  {[-1,1].flatMap(side=>{
 const junction=ward.crossCanal.junctionV-c.v;
 return [[-c.depth/2,junction-2],[junction+2,c.depth/2]].map(([a,b],i)=><Block key={`${side}-${i}`} walkable x={side*(c.width/2+0.3)} z={(a+b)/2} y={0.2} w={0.6} h={0.4} d={b-a} color="#9a9778"/>);
 })}
 {c.bridges.map(v=><group key={v}><Block walkable z={v} y={0.16} w={c.width+2} h={0.3} d={5} color="#b7ad95"/>{[-1,1].map(s=><Block key={s} z={v+s*2.5} y={0.65} w={c.width+2} h={0.15} d={0.12} color="#d6cfb9"/>)}</group>)}
 </group>}
function Flow({depth}:{depth:number}){const ref=useRef<Group>(null);useFrame(({clock})=>{if(ref.current)ref.current.position.z=(clock.elapsedTime*1.5)%8});return <group ref={ref} userData={{dynamic:true}}>{Array.from({length:Math.max(1,Math.floor(depth/8)-1)},(_,i)=><mesh key={i} position={[Math.sin(i*2)*0.6,0.17,-depth/2+4+i*8]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[0.7,0.1]}/><meshBasicMaterial color="#a3d2c7" transparent opacity={0.5}/></mesh>)}</group>}
export function EastWestCanal({c}:{c:EastWestCanalPlot}){
 const bridgeZ=-c.u;
 const halfGap=7;
 return <group position={[c.x,0,c.z]} rotation={[0,c.rotation+Math.PI/2,0]}>
  <Block y={0.06} w={c.width+1} h={0.12} d={c.depth} color="#796e52"/>
  <mesh position={[0,0.14,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[c.width,c.depth]}/><meshStandardMaterial color="#4d9395" metalness={0.25} roughness={0.35}/></mesh>
  <Flow depth={c.depth}/>
  {[-1,1].flatMap(side=>[[-c.depth/2+2.5,bridgeZ-halfGap],[bridgeZ+halfGap,c.depth/2]].map(([a,b],i)=><Block key={`${side}-${i}`} walkable x={side*(c.width/2+0.3)} z={(a+b)/2} y={0.2} w={0.6} h={0.4} d={b-a} color="#9a9778"/>))}
  {c.bridges.map((b,i)=>{
   const lz=b.u-c.u;
   return <group key={i}>
    <Block walkable z={lz} y={0.2} w={c.width+2.5} h={0.32} d={b.width} color="#697574"/>
    {[-1,1].map(s=><Block key={s} z={lz+s*(b.width/2-0.3)} y={0.72} w={c.width+2.5} h={0.18} d={0.16} color="#d6cfb9"/>)}
   </group>;
  })}
 </group>;
}
export function PolylineCanal({p}:{p:{depth:number;rotation:number;points:number[][];bridges:{u:number;v:number;width:number;depth:number}[]}}){
 const flow=useRef<Group>(null);
 const segments=p.points.slice(1).map(([u,v],i)=>{const [a,b]=p.points[i];return {a,b,u,v,length:Math.hypot(u-a,v-b)}});
 const total=segments.reduce((sum,s)=>sum+s.length,0);
 useFrame(({clock})=>{flow.current?.children.forEach((child,i)=>{
  let distance=(i*8+clock.elapsedTime*1.5)%total;
  for(const s of segments){if(distance<=s.length){child.position.set(s.a+(s.u-s.a)*distance/s.length,0.18,s.b+(s.v-s.b)*distance/s.length);break}distance-=s.length}
 })});
 return <group rotation={[0,p.rotation,0]}>
 {segments.map((s,i)=><group key={i} position={[(s.a+s.u)/2,0,(s.b+s.v)/2]} rotation={[0,-Math.atan2(s.v-s.b,s.u-s.a),0]}>
  <Block y={0.06} w={s.length} h={0.12} d={p.depth+1} color="#796e52"/>
  <mesh position={[0,0.15,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[s.length,p.depth]}/><meshStandardMaterial color="#4d9395" metalness={0.25} roughness={0.35}/></mesh>
 </group>)}
 {p.points.map(([u,v],i)=><group key={i} position={[u,0,v]}>
  <mesh position={[0,0.121,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[(p.depth+1)/2,24]}/><meshStandardMaterial color="#796e52"/></mesh>
  <mesh position={[0,0.151,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[p.depth/2,24]}/><meshStandardMaterial color="#4d9395" metalness={0.25} roughness={0.35}/></mesh>
 </group>)}
 <group ref={flow} userData={{dynamic:true}}>{Array.from({length:Math.floor(total/8)},(_,i)=><mesh key={i} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[0.16,8]}/><meshBasicMaterial color="#a3d2c7" transparent opacity={0.65}/></mesh>)}</group>
 {p.bridges.map((b,i)=><Block walkable key={i} x={b.u} z={b.v} y={0.32} w={b.width} h={0.3} d={b.depth} color={i===0?'#697574':'#b7ad95'}/>)}
 </group>;
}
function CrossCanal(){return <PolylineCanal p={ward.crossCanal}/>;}
export type { WindingCanalPlot };
