import {Vector3,type Group} from 'three';
export type TrafficKind='car'|'robot';
export interface TrafficContactActor {
  kind: TrafficKind;
  root: Group;
  x: number;
  z: number;
}
export const trafficColliders=new Map<Group,{width:number;depth:number;kind?:TrafficKind}>();
const position=new Vector3();
/** Short swept samples cover the bike's two wheels and body against actor boxes. */
export function hitsTraffic(x:number,z:number,yaw:number,y:number,pointOnly=false,ignoreCarId?:string){
 return trafficContact(x,z,yaw,y,pointOnly,ignoreCarId)!==null;
}
/** Returns the specific collided actor (preferring car over robot when overlapping). */
export function findTrafficContactActor(
  x:number,
  z:number,
  yaw:number,
  y:number,
  pointOnly=false,
  ignoreCarId?:string,
  extraMargin=0,
):TrafficContactActor|null{
 let hit:TrafficContactActor|null=null;
 for(const [root,box] of trafficColliders){
  if(ignoreCarId&&root.userData.carId===ignoreCarId)continue;
  if(!root.visible)continue;
  root.getWorldPosition(position);
  if(Math.abs(position.y-y)>1.5||Math.hypot(position.x-x,position.z-z)>box.depth+2+extraMargin)continue;
  const a=root.rotation.y,c=Math.cos(a),s=Math.sin(a);
  const pad=0.25+extraMargin;
  for(const offset of (pointOnly?[0]:[-.56,0,.56])){
   const dx=x-Math.sin(yaw)*offset-position.x,dz=z-Math.cos(yaw)*offset-position.z;
   const u=c*dx-s*dz,v=s*dx+c*dz;
   if(Math.abs(u)<box.width/2+pad&&Math.abs(v)<box.depth/2+pad){
    const kind=box.kind??(root.userData.carId?'car':'robot');
    const actor:TrafficContactActor={kind,root,x:position.x,z:position.z};
    if(kind==='car')return actor;
    hit=actor;
   }
  }
 }
 return hit;
}
export interface NearbyBotCollider {
  id: string;
  label: string;
  x: number;
  z: number;
  npcRole?: string;
  isChild: boolean;
  dist: number;
}
/** Looks up the live world XZ position of an active bot collider by name/uuid. */
export function getTrafficColliderPosition(botId:string):{x:number;z:number}|null{
 for(const [root] of trafficColliders){
  if(!root.visible)continue;
  if(root.name===botId||root.uuid===botId){
   root.getWorldPosition(position);
   return {x:position.x,z:position.z};
  }
 }
 return null;
}
/**
 * Lists nearby visible bots sorted by distance from `(x, z)` (excluding `excludeIds`).
 * Used when the player fights a child bot (`boy`/`girl`) so 4–10 nearby bots rush in to defend.
 */
export function listNearbyBotColliders(
  x: number,
  z: number,
  maxRadius = 75,
  excludeIds?: ReadonlySet<string>,
  maxCount = 10,
): NearbyBotCollider[] {
  const results: NearbyBotCollider[] = [];
  for (const [root, box] of trafficColliders) {
    if (!root.visible) continue;
    const kind = box.kind ?? (root.userData.carId ? 'car' : 'robot');
    if (kind !== 'robot') continue;
    const id = root.name || root.uuid;
    if (excludeIds && excludeIds.has(id)) continue;
    root.getWorldPosition(position);
    const dist = Math.hypot(position.x - x, position.z - z);
    if (dist > maxRadius) continue;
    const npcRole = root.userData?.npcRole as string | undefined;
    const lower = id.toLowerCase();
    const isChild =
      npcRole === 'boy' ||
      npcRole === 'girl' ||
      lower.includes('kid') ||
      lower.includes('younger-sister');
    results.push({
      id,
      label: id,
      x: position.x,
      z: position.z,
      npcRole,
      isChild,
      dist,
    });
  }
  // Prefer adult villagers / robots first, then nearest distance
  results.sort((a, b) => {
    if (a.isChild !== b.isChild) return a.isChild ? 1 : -1;
    return a.dist - b.dist;
  });
  return results.slice(0, maxCount);
}
/** Prefer a car contact if a robot and car overlap the same pedestrian. */
export function trafficContact(x:number,z:number,yaw:number,y:number,pointOnly=false,ignoreCarId?:string):TrafficKind|null{
 const actor=findTrafficContactActor(x,z,yaw,y,pointOnly,ignoreCarId);
 return actor?actor.kind:null;
}
