import { mobileQuality } from '../game/sceneBudget';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { canStand } from '../game/collision';
import { botAppearance } from '../game/robotAppearance';
import { buildRoadGraph, nextRoadNode, type RouteNode } from '../game/robotRoutes';
import { RobotCharacter } from './RobotCharacter';

const regions=[{id:'myothar',roads:ward.roads},...kalayVillages];
const clear=(x:number,z:number)=>[[0,0],[0.08,0],[-0.08,0],[0,0.08],[0,-0.08]].every(([dx,dz])=>canStand(x+dx,z+dz));
function Bot({graph,start,index}:{graph:RouteNode[];start:number;index:number}){
 const root=useRef<Group>(null),wheels=useRef<Group>(null),[detail,setDetail]=useState(false);
 const appearance=useMemo(()=>botAppearance(index),[index]);
 const state=useRef({x:graph[start].x,z:graph[start].z,from:start,to:graph[start].links[index%graph[start].links.length],seed:index+1,elapsed:index*0.01,travel:0});
 useFrame(({camera},delta)=>{
  const s=state.current,dt=Math.min(delta,0.05),target=graph[s.to];
  const dx=target.x-s.x,dz=target.z-s.z,distance=Math.hypot(dx,dz),travel=Math.min(distance,(1.1+(index%7)*0.13)*dt);
  if(distance>0.0001){s.x+=dx/distance*travel;s.z+=dz/distance*travel;if(root.current)root.current.rotation.y=Math.atan2(-dx,-dz);s.travel+=travel}
  if(distance<0.12){s.x=target.x;s.z=target.z;const previous=s.from;s.from=s.to;s.seed=(s.seed*1664525+1013904223)>>>0;s.to=nextRoadNode(graph,s.from,previous,s.seed/4294967296)}
  if(root.current)root.current.position.set(s.x,0,s.z);
  if(wheels.current)wheels.current.rotation.x=-s.travel/(0.24*0.95*appearance.size);
  s.elapsed+=dt;if(s.elapsed>0.4){s.elapsed=0;const d=Math.hypot(camera.position.x-s.x,camera.position.y,camera.position.z-s.z);const nearby=d<100;if(nearby!==detail)setDetail(nearby);if(root.current)root.current.visible=d<1000}
 });
 return <group ref={root} position={[state.current.x,0,state.current.z]} name={`village-robot-${index}`} userData={{dynamic:true}}>
  {detail?<RobotCharacter wheels={wheels} {...appearance}/>:<group scale={appearance.size*0.95}>
   <mesh position={[0,0.76,0]}><sphereGeometry args={[0.29,8,6]}/><meshStandardMaterial color={appearance.palette.shell}/></mesh>
   <mesh position={[0,1.46,0]} scale={[1,0.85,0.8]}><sphereGeometry args={[0.37,10,8]}/><meshStandardMaterial color={appearance.palette.shell}/></mesh>
   <mesh position={[0,1.44,-0.27]}><boxGeometry args={[0.48,0.28,0.035]}/><meshStandardMaterial color={appearance.palette.panel}/></mesh>
   {[-1,1].map(side=><mesh key={side} position={[side*0.305,0.24,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.24,0.24,0.15,10]}/><meshStandardMaterial color={appearance.palette.accent}/></mesh>)}
  </group>}
 </group>;
}
type BotDefinition={graph:RouteNode[];start:number;index:number;key:string};
const cachedPatrols=new Map<string,BotDefinition[]>();
function patrols(id:string){
 const existing=cachedPatrols.get(id);if(existing)return existing;
 const r=regions.findIndex(r=>r.id===id);if(r<0)return [];
 const region=regions[r],graph=buildRoadGraph(region.roads,clear),starts=graph.map((n,i)=>n.links.length&&n.lane?i:-1).filter(i=>i>=0);
 const count=Math.min(mobileQuality?3:8,starts.length);
 const bots=Array.from({length:count},(_,i)=>({graph,start:starts[Math.floor(i*starts.length/count)],index:r*8+i,key:`${region.id}-${i}`}));
 if(cachedPatrols.size>=2)cachedPatrols.delete(cachedPatrols.keys().next().value!);
 cachedPatrols.set(id,bots);return bots;
}
export function RobotBots({activeRegions=[]}:{activeRegions?:string[]}){
 const bots=useMemo(()=>activeRegions.flatMap(patrols),[activeRegions]);
 return <group name="autonomous-village-robots">{bots.map(b=><Bot key={b.key} graph={b.graph} start={b.start} index={b.index}/>)}</group>;
}
