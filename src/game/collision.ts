import { parkedCars } from '../data/cars.ts';
import { spatialIndex } from './spatialIndex.ts';
import { ward } from '../data/ward.ts';
import { kalayVillages } from '../data/villages/index.ts';
export const PLAYER_RADIUS = 0.4;
const villageHouses=kalayVillages.flatMap(v=>v.houses);
const villageTrees=kalayVillages.flatMap(v=>[...v.trees,...v.largeTrees,...v.farmTrees]);
const nearbyBuildings=spatialIndex([...ward.houses,...ward.warehouses,...ward.riceMill.buildings,...villageHouses],h=>({x:h.x,z:h.z,radius:Math.hypot(h.width/2+0.6,h.depth/2+2.6)+PLAYER_RADIUS}));
const nearbyTrees=spatialIndex([...ward.trees,...ward.farmTrees,...ward.largeTrees,...villageTrees],t=>({x:t.x,z:t.z,radius:t.radius+PLAYER_RADIUS}));
const mountainObstacles=[...ward.mountains,...ward.weipula.peaks];
const polylineCanals=[ward.crossCanal,...kalayVillages.flatMap(vl=>vl.connectingCanal?[vl.connectingCanal]:[])];
export function canStand(x:number,z:number):boolean {
 const c=Math.cos(ward.canal.rotation),s=Math.sin(ward.canal.rotation);
 const u=x*c-z*s,v=x*s+z*c;
 for(const water of [ward.canal,...ward.drains]){
  const centerV=water.x*s+water.z*c,localV=v-centerV;
  if(Math.abs(u-water.u)<water.width/2+PLAYER_RADIUS&&Math.abs(localV)<water.depth/2+PLAYER_RADIUS&&!water.bridges.some(b=>Math.abs(localV-b)<2.5-PLAYER_RADIUS))return false;
 }
 for(const poly of polylineCanals){
  const onBridge=poly.bridges.some(b=>Math.abs(u-b.u)<b.width/2-PLAYER_RADIUS&&Math.abs(v-b.v)<b.depth/2-PLAYER_RADIUS);
  if(!onBridge)for(let i=1;i<poly.points.length;i++){
   const [a,b]=poly.points[i-1],[d,e]=poly.points[i],du=d-a,dv=e-b;
   const t=Math.max(0,Math.min(1,((u-a)*du+(v-b)*dv)/(du*du+dv*dv)));
   if(Math.hypot(u-a-t*du,v-b-t*dv)<poly.depth/2+PLAYER_RADIUS)return false;
  }
 }
 for(const village of kalayVillages){
  const ew=village.canal;
  if(ew&&u>=ew.uMin-PLAYER_RADIUS&&u<=ew.uMax+PLAYER_RADIUS&&Math.abs(v-ew.v)<ew.width/2+PLAYER_RADIUS){
   const onEwBridge=ew.bridges.some(b=>Math.abs(u-b.u)<b.width/2-PLAYER_RADIUS);
   if(!onEwBridge)return false;
  }
  if(village.ponds){
   for(const p of village.ponds){
    const dx=x-p.x,dz=z-p.z;
    const lx=dx*c-dz*s,lz=dx*s+dz*c;
    if(Math.abs(lx)<p.width/2+PLAYER_RADIUS&&Math.abs(lz)<p.depth/2+PLAYER_RADIUS)return false;
   }
  }
 }
 const pond=ward.pond,px=x-pond.x,pz=z-pond.z;
 if(Math.abs(px*c-pz*s)<pond.width/2+PLAYER_RADIUS&&Math.abs(px*s+pz*c)<pond.depth/2+PLAYER_RADIUS)return false;
 const m=ward.monastery,dx=x-m.x,dz=z-m.z;
 const mu=dx*c-dz*s,mv=dx*s+dz*c;
 for(const b of m.buildings)if(Math.abs(mu-b.u)<b.width/2+PLAYER_RADIUS&&Math.abs(mv-b.v)<b.depth/2+PLAYER_RADIUS)return false;
 for(const p of m.stupas)if(Math.hypot(mu-p.u,mv-p.v)<p.radius+PLAYER_RADIUS)return false;
 if(mountainObstacles.some(m=>Math.hypot(x-m.x,z-m.z)<m.radius+PLAYER_RADIUS))return false;
 for(const car of parkedCars){const dx=x-car.x,dz=z-car.z,c=Math.cos(car.rotation),s=Math.sin(car.rotation);if(Math.abs(dx*c-dz*s)<car.width*car.size/2+PLAYER_RADIUS&&Math.abs(dx*s+dz*c)<car.depth*car.size/2+PLAYER_RADIUS)return false}
 const edge=ward.size/2-PLAYER_RADIUS;
 if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>edge||Math.abs(z)>edge)return false;
 for(const h of nearbyBuildings(x,z)){
  const dx=x-h.x,dz=z-h.z,c=Math.cos(h.rotation),s=Math.sin(h.rotation);
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  const nx=Math.max(-h.width/2-0.6,Math.min(lx,h.width/2+0.6));
  const nz=Math.max(-h.depth/2-0.6,Math.min(lz,h.depth/2+2.6));
  if(Math.hypot(lx-nx,lz-nz)<PLAYER_RADIUS)return false;
 }
 return !nearbyTrees(x,z).some(t=>Math.hypot(x-t.x,z-t.z)<t.radius+PLAYER_RADIUS);
}
export function move(position:{x:number;z:number},dx:number,dz:number){
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.15));
 for(let i=0;i<steps;i++){
  if(canStand(position.x+dx/steps,position.z))position.x+=dx/steps;
  if(canStand(position.x,position.z+dz/steps))position.z+=dz/steps;
 }
}
