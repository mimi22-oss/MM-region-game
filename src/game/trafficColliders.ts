import {Vector3,type Group} from 'three';
export type TrafficKind='car'|'robot';
export const trafficColliders=new Map<Group,{width:number;depth:number;kind?:TrafficKind}>();
const position=new Vector3();
/** Short swept samples cover the bike's two wheels and body against actor boxes. */
export function hitsTraffic(x:number,z:number,yaw:number,y:number,pointOnly=false,ignoreCarId?:string){
 return trafficContact(x,z,yaw,y,pointOnly,ignoreCarId)!==null;
}
/** Prefer a car contact if a robot and car overlap the same pedestrian. */
export function trafficContact(x:number,z:number,yaw:number,y:number,pointOnly=false,ignoreCarId?:string):TrafficKind|null{
 let contact:TrafficKind|null=null;
 for(const [root,box] of trafficColliders){
  if(ignoreCarId&&root.userData.carId===ignoreCarId)continue;
  root.getWorldPosition(position);
  if(Math.abs(position.y-y)>1.5||Math.hypot(position.x-x,position.z-z)>box.depth+2)continue;
  const a=root.rotation.y,c=Math.cos(a),s=Math.sin(a);
  for(const offset of (pointOnly?[0]:[-.56,0,.56])){
   const dx=x-Math.sin(yaw)*offset-position.x,dz=z-Math.cos(yaw)*offset-position.z;
   const u=c*dx-s*dz,v=s*dx+c*dz;
   if(Math.abs(u)<box.width/2+.25&&Math.abs(v)<box.depth/2+.25){
    const kind=box.kind??(root.userData.carId?'car':'robot');
    if(kind==='car')return kind;contact=kind;
   }
  }
 }
 return contact;
}
