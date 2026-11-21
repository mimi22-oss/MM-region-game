import {useTrafficCollider} from './useTrafficCollider';
import {sceneGround,carGroundPose} from '../game/groundSurface';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { buildTrafficRoutes, trafficPose, carAppearance, type TrafficRoute } from '../game/carTraffic';
import { mobileQuality } from '../game/sceneBudget';
import { Car } from './Car';
import {
  evaluateCarForwardClearance,
  removeAvoidanceActor,
  stepCarTrafficSpeed,
  upsertAvoidanceActor,
} from '../game/botAvoidance';

import { spatialIndex } from '../game/spatialIndex';
import { myotharCenterRoads, myotharCenterBuildings } from '../data/wards/myothar/center/index.ts';
import {
  getStreamedAllBuildingsForRegion,
  getStreamedChunkVersion,
  getStreamedRoadPlotsForRegion,
  subscribeStreamedChunks,
} from '../game/streamedChunkRegistry';

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

const staticBuildings = [
  ...ward.houses,
  ...myotharCenterBuildings.map(b => ({ x: b.x, z: b.z, width: b.houseWidth || 5.6, depth: b.houseLength || 6.8 })),
  ...kalayVillages.flatMap(v => v.houses),
  ...ward.warehouses,
  ...ward.riceMill.buildings,
];
const staticRoads = [...ward.roads, ...myotharTrafficRoads, ...kalayVillages.flatMap(v => v.roads)];
const staticObstacleLookup = spatialIndex(
  staticBuildings,
  b => ({ x: b.x, z: b.z, radius: Math.hypot(b.width / 2, b.depth / 2) }),
);
const staticIsBlocked = (x: number, z: number, radius: number) =>
  staticObstacleLookup(x, z).some(b => Math.hypot(x - b.x, z - b.z) < (Math.hypot(b.width / 2, b.depth / 2) + radius + 1.2));
const staticRoutes = buildTrafficRoutes(staticRoads, staticIsBlocked);
function TrafficCar({route,index,offset}:{route:TrafficRoute;index:number;offset:number}){
 const root=useRef<Group>(null),travel=useRef(offset),speedRef=useRef(8),appearance=useMemo(()=>carAppearance(index),[index]);
 const carAvoidId = `traffic-car-${route.id}-${index}`;
 const carHalfW = 1.02 * appearance.size;
 const carHalfL = 1.98 * appearance.size;
 const groundCache=useRef<{
  ground:ReturnType<typeof sceneGround>|null;
  heightFn:((x:number,z:number)=>number)|null;
  age:number;
  grounded:boolean;
  pose:{y:number;pitch:number;roll:number};
 }>({ground:null,heightFn:null,age:0,grounded:false,pose:{y:.12,pitch:0,roll:0}});
 useTrafficCollider(root,1.9*appearance.size,3.7*appearance.size,'car');
 useEffect(() => () => removeAvoidanceActor(carAvoidId), [carAvoidId]);
 useFrame(({scene,clock,camera},dt)=>{
  const step=Math.min(dt,.05);
  const obj=root.current;
  if(!obj)return;
  const curPose=trafficPose(route,travel.current);
  const focus=camera.userData.viewFocus??camera.position;
  const dx=curPose.x-focus.x,dz=curPose.z-focus.z,distSq=dx*dx+dz*dz;
  if(distSq>550*550){
   obj.visible=false;
   removeAvoidanceActor(carAvoidId);
   return;
  }
  obj.visible=true;

  // Check forward driving corridor for any person (NPC/player), livestock (cow/buffalo/horse), or car ahead:
  // Brakes smoothly to a COMPLETE STOP and waits until the lane ahead is completely clear!
  const clearance = evaluateCarForwardClearance(
   carAvoidId,
   curPose.x,
   curPose.z,
   curPose.yaw,
   carHalfW,
   carHalfL,
  );
  speedRef.current = stepCarTrafficSpeed(speedRef.current, 8, clearance, step);
  travel.current += step * speedRef.current;

  const p=trafficPose(route,travel.current);
  upsertAvoidanceActor(carAvoidId, 'car', p.x, p.z, p.yaw, Math.max(carHalfW, carHalfL), {
   halfWidth: carHalfW,
   halfLength: carHalfL,
   speed: speedRef.current,
  });

  const cache=groundCache.current;
  cache.age+=step;
  if(!cache.grounded||distSq<110*110||cache.age>=.2){
   const ground=sceneGround(scene,clock.elapsedTime);
   if(cache.ground!==ground||!cache.heightFn){
    cache.ground=ground;
    cache.heightFn=(x:number,z:number)=>ground.height(x,z);
   }
   carGroundPose(p.x,p.z,p.yaw,appearance.size,cache.heightFn,cache.pose);
   cache.age=0;
   cache.grounded=true;
  }
  const g=cache.pose;
  obj.position.set(p.x,g.y,p.z);
  obj.rotation.set(g.pitch,p.yaw,g.roll,'YXZ');
 });
 const p=trafficPose(route,offset);
 return <group ref={root} position={[p.x,.12,p.z]} rotation={[0,p.yaw,0]} userData={{dynamic:true}}><Car {...appearance}/></group>;
}
/** Bound car meshes independently of the number of villages. Spawn only near the view. */
export function CarBots(){
 const chunkVersion = useSyncExternalStore(subscribeStreamedChunks, getStreamedChunkVersion);
 const routes = useMemo(() => {
  const streamedRoads = getStreamedRoadPlotsForRegion('kanbale');
  if (!streamedRoads.length) return staticRoutes;
  const streamedBuildings = getStreamedAllBuildingsForRegion('kanbale');
  const streamedLookup = spatialIndex(
   streamedBuildings,
   b => ({ x: b.x, z: b.z, radius: Math.hypot(b.width / 2, b.depth / 2) }),
  );
  const streamedBlocked = (x: number, z: number, radius: number) =>
   streamedLookup(x, z).some(b => Math.hypot(x - b.x, z - b.z) < (Math.hypot(b.width / 2, b.depth / 2) + radius + 1.2));
  return [...staticRoutes, ...buildTrafficRoutes(streamedRoads, streamedBlocked)];
 }, [chunkVersion]);
 const [fleet,setFleet]=useState<{route:number;slot:number;offset:number}[]>([]),elapsed=useRef(0);
 useEffect(() => () => removeAvoidanceActor('player-focus'), []);
 useFrame(({camera},dt)=>{
  const focus=camera.userData.viewFocus??camera.position;
  if(camera.position.y<=500&&camera.userData.viewFocus){
   upsertAvoidanceActor('player-focus','player',focus.x,focus.z,0,0.48);
  }else{
   removeAvoidanceActor('player-focus');
  }
  elapsed.current+=dt;if(elapsed.current<1)return;elapsed.current=0;
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
 return <group name="main-road-car-traffic">{fleet.map(c=>routes[c.route]?<TrafficCar key={`${routes[c.route].id}-${c.slot}-${c.offset}`} route={routes[c.route]} index={c.route*4+c.slot} offset={c.offset}/>:null)}</group>;
}
