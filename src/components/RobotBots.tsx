import {useTrafficCollider} from './useTrafficCollider';
import {sceneGround} from '../game/groundSurface';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { canStand } from '../game/collision';
import { botAppearance } from '../game/robotAppearance';
import { buildRoadGraph, nextRoadNode, type RouteNode } from '../game/robotRoutes';
import { getBotCombatReaction, getBotFightingState } from '../game/botFighting';
import { getSampledBotGlbPose } from '../game/botGlbMotionPlayer';
import { RobotCharacter } from './RobotCharacter';
import {
  getStreamedChunkVersion,
  getStreamedRoadPlotsForRegion,
  subscribeStreamedChunks,
} from '../game/streamedChunkRegistry';

const regions=[{id:'myothar',roads:ward.roads},...kalayVillages];
const clear=(x:number,z:number)=>canStand(x,z)&&canStand(x+0.08,z)&&canStand(x-0.08,z)&&canStand(x,z+0.08)&&canStand(x,z-0.08);
const BOT_DETAIL_DIST_SQ = mobileQuality ? 65 * 65 : 100 * 100;
const BOT_GROUND_NEAR_DIST_SQ = 140 * 140;
const BOT_VISIBLE_DIST_SQ = mobileQuality ? 650 * 650 : 1000 * 1000;
function Bot({graph,start,index}:{graph:RouteNode[];start:number;index:number}){
 const root=useRef<Group>(null),wheels=useRef<Group>(null),[detail,setDetail]=useState(false);
 const appearance=useMemo(()=>botAppearance(index),[index]);
 useTrafficCollider(root,.85*appearance.size,.65*appearance.size);
 const initialNode=graph[start];
 const initialLink=initialNode?.links[index%Math.max(1,initialNode.links.length)]??start;
 const state=useRef({graph,x:initialNode?.x??0,y:0,z:initialNode?.z??0,from:start,to:initialLink,seed:index+1,elapsed:index*0.01,groundTimer:0,grounded:false,travel:0});
 useFrame(({camera,scene,clock},delta)=>{
  const s=state.current;
  if(s.graph!==graph){
   const node=graph[start];
   if(!node)return;
   s.graph=graph;s.x=node.x;s.z=node.z;s.from=start;
   s.to=node.links[index%Math.max(1,node.links.length)]??start;
   s.grounded=false;
  }
  const dt=Math.min(delta,0.05),target=graph[s.to];
  if(!target)return;
  const botName=`village-robot-${index}`;
  const reaction=getBotCombatReaction(botName);
  const inCombat=Boolean(reaction&&(reaction.engaged||reaction.hitTime>0||reaction.knockoutTime>0||reaction.attackMove!==null||reaction.celebrateTime>0));
  if(!inCombat){
   const dx=target.x-s.x,dz=target.z-s.z,distSq=dx*dx+dz*dz,travelMax=(1.1+(index%7)*0.13)*dt;
   const distance=distSq>0.0001*0.0001?Math.sqrt(distSq):0;
   const travel=Math.min(distance,travelMax);
   if(distance>0.0001){s.x+=dx/distance*travel;s.z+=dz/distance*travel;if(root.current)root.current.rotation.y=Math.atan2(-dx,-dz);s.travel+=travel}
   if(distance<0.12){s.x=target.x;s.z=target.z;const previous=s.from;s.from=s.to;s.seed=(s.seed*1664525+1013904223)>>>0;s.to=nextRoadNode(graph,s.from,previous,s.seed/4294967296)}
  }else if(root.current&&reaction){
   if(reaction.hasWorldPos){
    s.x=reaction.worldX;
    s.z=reaction.worldZ;
    if(reaction.chasing)s.travel+=reaction.chaseSpeed*dt;
   }
   // RobotCharacter faces -Z, so add Math.PI to yaw (+Z facing)
   const fight=getBotFightingState();
   const useGlb=fight.active&&(fight.targetBotId===botName||reaction.celebrateTime>0);
   const glb=useGlb?getSampledBotGlbPose():null;
   if(reaction.chasing){
    root.current.rotation.y=reaction.chaseYaw+Math.PI;
    root.current.rotation.x=-0.12;
    root.current.rotation.z=0;
   }else{
    root.current.rotation.y=reaction.facePlayerYaw+Math.PI+(glb&&glb.valid?-glb.torsoYaw*0.6:0);
    const hitT=reaction.hitTime>0?Math.sin((reaction.hitTime/Math.max(0.05,reaction.hitDuration))*Math.PI):0;
    const atkPulse=reaction.attackMove&&!glb?Math.sin((reaction.attackElapsed/Math.max(0.08,reaction.attackDuration))*Math.PI):0;
    root.current.rotation.x=reaction.knockoutTime>0?0.72:glb&&glb.valid?-glb.torsoPitch*0.65:hitT*0.38*reaction.hitStrength-atkPulse*0.32;
    root.current.rotation.z=glb&&glb.valid?glb.torsoRoll*0.55:0;
   }
  }
  if(!inCombat&&root.current){root.current.rotation.x=0;root.current.rotation.z=0;}
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
const cachedPatrols=new Map<string,{roadSig:string;rev:number;bots:BotDefinition[]}>();
export function prepareRobotPatrols(id:string){
 const r=regions.findIndex(r=>r.id===id);if(r<0)return [];
 const region=regions[r] as (typeof regions[number] & { streamed?: boolean });
 const isStreamed = Boolean(region.streamed);
 const roads = isStreamed ? getStreamedRoadPlotsForRegion(id) : region.roads;
 const roadSig = isStreamed ? roads.map(rd=>rd.id).sort().join('|') : 'static';
 const existing=cachedPatrols.get(id);
 if(existing && existing.roadSig===roadSig)return existing.bots;
 const rev = (existing?.rev ?? 0) + 1;
 if(!roads.length){cachedPatrols.set(id,{roadSig,rev,bots:[]});return [];}
 const graph=buildRoadGraph(roads,clear),starts=graph.map((n,i)=>n.links.length&&n.lane?i:-1).filter(i=>i>=0);
 const count=Math.min(mobileQuality?3:8,starts.length);
 const bots=Array.from({length:count},(_,i)=>({graph,start:starts[Math.floor(i*starts.length/count)],index:r*8+i,key:isStreamed?`${region.id}-${rev}-${i}`:`${region.id}-${i}`}));
 cachedPatrols.set(id,{roadSig,rev,bots});return bots;
}
export function RobotBots({activeRegions=[]}:{activeRegions?:string[]}){
 const preset=useQualityPreset();
 const chunkVersion = useSyncExternalStore(subscribeStreamedChunks, getStreamedChunkVersion);
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
 },[activeRegions,preset.id,chunkVersion]);
 return <group name="autonomous-village-robots">{bots.map(b=><Bot key={b.key} graph={b.graph} start={b.start} index={b.index}/>)}</group>;
}
