import {Vector3,type Group} from 'three';
export const trafficColliders=new Map<Group,{width:number;depth:number}>();
const position=new Vector3();
/** Short swept samples cover the bike's two wheels and body against actor boxes. */
export function hitsTraffic(x:number,z:number,yaw:number,y:number,pointOnly=false){
 for(const [root,box] of trafficColliders){
  root.getWorldPosition(position);
  if(Math.abs(position.y-y)>1.5||Math.hypot(position.x-x,position.z-z)>box.depth+2)continue;
  const a=root.rotation.y,c=Math.cos(a),s=Math.sin(a);
  for(const offset of (pointOnly?[0]:[-.56,0,.56])){
   const dx=x-Math.sin(yaw)*offset-position.x,dz=z-Math.cos(yaw)*offset-position.z;
   const u=c*dx-s*dz,v=s*dx+c*dz;
   if(Math.abs(u)<box.width/2+.25&&Math.abs(v)<box.depth/2+.25)return true;
  }
 }
 return false;
}
