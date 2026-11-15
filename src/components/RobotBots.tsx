import {useTrafficCollider} from './useTrafficCollider';
import {sceneGround} from '../game/groundSurface';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
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
const clear=(x:number,z:number)=>canStand(x,z)&&canStand(x+0.08,z)&&canStand(x-0.08,z)&&canStand(x,z+0.08)&&canStand(x,z-0.08);
const BOT_DETAIL_DIST_SQ = mobileQuality ? 65 * 65 : 100 * 100;
const BOT_GROUND_NEAR_DIST_SQ = 140 * 140;
const BOT_VISIBLE_DIST_SQ = mobileQuality ? 650 * 650 : 1000 * 1000;
function Bot({graph,start,index}:{graph:RouteNode[];start:number;index:number}){
 const root=useRef<Group>(null),wheels=useRef<Group>(null),[detail,setDetail]=useState(false);
 const appearance=useMemo(()=>botAppearance(index),[index]);
 useTrafficCollider(root,.85*appearance.size,.65*appearance.size);
 const state=useRef({x:graph[start].x,y:0,z:graph[start].z,from:start,to:graph[start].links[index%graph[start].links.length],seed:index+1,elapsed:index*0.01,groundTimer:0,grounded:false,travel:0});
 useFrame(({camera,scene,clock},delta)=>{
  const s=state.current,dt=Math.min(delta,0.05),target=graph[s.to];
  const dx=target.x-s.x,dz=target.z-s.z,distSq=dx*dx+dz*dz,travelMax=(1.1+(index%7)*0.13)*dt;
  const distance=distSq>0.0001*0.0001?Math.sqrt(distSq):0;
  const travel=Math.min(distance,travelMax);
  if(distance>0.0001){s.x+=dx/distance*travel;s.z+=dz/distance*travel;if(root.current)root.current.rotation.y=Math.atan2(-dx,-dz);s.travel+=travel}
  if(distance<0.12){s.x=target.x;s.z=target.z;const previous=s.from;s.from=s.to;s.seed=(s.seed*1664525+1013904223)>>>0;s.to=nextRoadNode(graph,s.from,previous,s.seed/4294967296)}
  const cx=camera.position.x-s.x,cy=camera.position.y,cz=camera.position.z-s.z;
  const camDistSq=cx*cx+cy*cy+cz*cz;
  s.groundTimer+=dt;
  if(root.current){
   if(!s.grounded||camDistSq<BOT_GROUND_NEAR_DIST_SQ||s.groundTimer>0.4){
    s.groundTimer=0;
    s.grounded=true;
    const g=sceneGround(scene,clock.elapsedTime),yaw=root.current.rotation.y,w=.305*.95*appearance.size;
    const left=g.height(s.x-Math.cos(yaw)*w,s.z+Math.sin(yaw)*w),right=g.height(s.x+Math.cos(yaw)*w,s.z-Math.sin(yaw)*w);
    s.y=Math.max(left,right,g.height(s.x,s.z))+.012;
   }
   root.current.position.set(s.x,s.y,s.z);
  }
  if(detail&&wheels.current)wheels.current.rotation.x=-s.travel/(0.24*0.95*appearance.size);
  s.elapsed+=dt;if(s.elapsed>0.4){s.elapsed=0;const nearby=camDistSq<BOT_DETAIL_DIST_SQ;if(nearby!==detail)setDetail(nearby);if(root.current)root.current.visible=camDistSq<BOT_VISIBLE_DIST_SQ}
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
export function prepareRobotPatrols(id:string){
 const existing=cachedPatrols.get(id);if(existing)return existing;
 const r=regions.findIndex(r=>r.id===id);if(r<0)return [];
 const region=regions[r],graph=buildRoadGraph(region.roads,clear),starts=graph.map((n,i)=>n.links.length&&n.lane?i:-1).filter(i=>i>=0);
 const count=Math.min(mobileQuality?3:8,starts.length);
 const bots=Array.from({length:count},(_,i)=>({graph,start:starts[Math.floor(i*starts.length/count)],index:r*8+i,key:`${region.id}-${i}`}));
 cachedPatrols.set(id,bots);return bots;
}
export function RobotBots({activeRegions=[]}:{activeRegions?:string[]}){
 const preset=useQualityPreset();
 const bots=useMemo(()=>{
  const all=activeRegions.flatMap(prepareRobotPatrols);
  if(preset.id==='mobile'||preset.id==='low'){
   const out:BotDefinition[]=[];
   const counts=new Map<string,number>();
   for(const b of all){
    const rid=b.key.slice(0,b.key.lastIndexOf('-'));
    const c=counts.get(rid)??0;
    if(c<3){counts.set(rid,c+1);out.push(b);}
   }
   return out;
  }
  return all;
 },[activeRegions,preset.id]);
 return <group name="autonomous-village-robots">{bots.map(b=><Bot key={b.key} graph={b.graph} start={b.start} index={b.index}/>)}</group>;
}
