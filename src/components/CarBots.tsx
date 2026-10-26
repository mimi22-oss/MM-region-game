import {useTrafficCollider} from './useTrafficCollider';
import {sceneGround,carGroundPose} from '../game/groundSurface';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { buildTrafficRoutes, trafficPose, carAppearance, type TrafficRoute } from '../game/carTraffic';
import { mobileQuality } from '../game/sceneBudget';
import { Car } from './Car';

import { spatialIndex } from '../game/spatialIndex';
import { myotharCenterRoads, myotharCenterBuildings } from '../data/wards/myothar/center/index.ts';

// Extract Myothar Center road segments for traffic routes
const myotharTrafficRoads = myotharCenterRoads.flatMap(r => {
  const isMain = r.ref === 'NH41' || r.width >= 5.0;
  const segs = [];
  for (let i = 0; i < r.worldPoints.length - 1; i++) {
    const p1 = r.worldPoints[i], p2 = r.worldPoints[i + 1];
    const dx = p2[0] - p1[0], dz = p2[1] - p1[1];
    const len = Math.hypot(dx, dz);
    if (len < 1.0) continue;
    segs.push({
      id: `${r.id}-seg-${i}`,
      x: (p1[0] + p2[0]) / 2,
      z: (p1[1] + p2[1]) / 2,
      width: len,
      depth: r.width,
      rotation: -Math.atan2(dz, dx),
      main: isMain,
    });
  }
  return segs;
});

// All buildings to protect from car bot collisions
const buildingObstacles = spatialIndex(
  [
    ...ward.houses,
    ...myotharCenterBuildings.map(b => ({ x: b.x, z: b.z, width: b.houseWidth || 5.6, depth: b.houseLength || 6.8 })),
    ...kalayVillages.flatMap(v => v.houses),
    ...ward.warehouses,
    ...ward.riceMill.buildings,
  ],
  b => ({ x: b.x, z: b.z, radius: Math.hypot(b.width / 2, b.depth / 2) })
);

const isBlocked = (x: number, z: number, radius: number) => {
  return buildingObstacles(x, z).some(b => Math.hypot(x - b.x, z - b.z) < (Math.hypot(b.width / 2, b.depth / 2) + radius + 1.2));
};

const routes = buildTrafficRoutes(
  [...ward.roads, ...myotharTrafficRoads, ...kalayVillages.flatMap(v => v.roads)],
  isBlocked
);
function TrafficCar({route,index,offset}:{route:TrafficRoute;index:number;offset:number}){
 const root=useRef<Group>(null),travel=useRef(offset),appearance=useMemo(()=>carAppearance(index),[index]);
 useTrafficCollider(root,1.9*appearance.size,3.7*appearance.size,'car');
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
