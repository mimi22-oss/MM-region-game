import {sceneGround,carGroundPose} from '../game/groundSurface';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { buildTrafficRoutes, trafficPose, carAppearance, type TrafficRoute } from '../game/carTraffic';
import { mobileQuality } from '../game/sceneBudget';
import { Car } from './Car';

const routes=buildTrafficRoutes([...ward.roads,...kalayVillages.flatMap(v=>v.roads)]);
function TrafficCar({route,index,offset}:{route:TrafficRoute;index:number;offset:number}){
 const root=useRef<Group>(null),travel=useRef(offset),appearance=useMemo(()=>carAppearance(index),[index]);
 useFrame(({scene,clock},dt)=>{travel.current+=Math.min(dt,.05)*8;const p=trafficPose(route,travel.current);if(root.current){const ground=sceneGround(scene,clock.elapsedTime),g=carGroundPose(p.x,p.z,p.yaw,appearance.size,(x,z)=>ground.height(x,z));root.current.position.set(p.x,g.y,p.z);root.current.rotation.set(g.pitch,p.yaw,g.roll,'YXZ')}});
 const p=trafficPose(route,offset);
 return <group ref={root} position={[p.x,.12,p.z]} rotation={[0,p.yaw,0]} userData={{dynamic:true}}><Car {...appearance}/></group>;
}
/** Bound car meshes independently of the number of villages. Spawn only near the view. */
export function CarBots(){
 const [fleet,setFleet]=useState<{route:number;slot:number;offset:number}[]>([]),elapsed=useRef(0);
 useFrame(({camera},dt)=>{
  elapsed.current+=dt;if(elapsed.current<1)return;elapsed.current=0;
  const focus=camera.userData.viewFocus??camera.position;
  if(camera.position.y>500){if(fleet.length)setFleet([]);return}
  const candidates=routes.map((r,i)=>{
   const t=Math.max(0,Math.min(r.length,(focus.x-r.x)*r.dx+(focus.z-r.z)*r.dz));
   return {route:i,t,d:Math.hypot(focus.x-r.x-r.dx*t,focus.z-r.z-r.dz*t)};
  }).filter(r=>r.d<250).sort((a,b)=>a.d-b.d).slice(0,mobileQuality?1:2);
  const next=candidates.flatMap(c=>{
   const r=routes[c.route],arc=Math.PI*r.lane;
   return [0,1,2,3].map(slot=>({route:c.route,slot,offset:slot%2===0?Math.max(0,Math.min(r.length,c.t+(slot-1)*60)):r.length+arc+Math.max(0,Math.min(r.length,r.length-c.t+(slot-2)*60))}));
  });
  // Keep moving cars mounted while the same stretch is viewed.
  const same=next.length===fleet.length&&next.every((v,i)=>v.route===fleet[i].route)&&next.every((v,i)=>Math.abs(v.offset-fleet[i].offset)<450);
  if(!same)setFleet(next);
 });
 return <group name="main-road-car-traffic">{fleet.map(c=><TrafficCar key={`${c.route}-${c.slot}-${c.offset}`} route={routes[c.route]} index={c.route*4+c.slot} offset={c.offset}/>)}</group>;
}
