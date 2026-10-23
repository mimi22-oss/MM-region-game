type CameraFocus={camX:number;camZ:number;yaw:number};
/** Camera navigation must never write to the avatar's world position. */
export function panCamera(focus:CameraFocus,right:number,forward:number,edge:number){
 focus.camX=Math.max(-edge,Math.min(edge,focus.camX-Math.sin(focus.yaw)*forward+Math.cos(focus.yaw)*right));
 focus.camZ=Math.max(-edge,Math.min(edge,focus.camZ-Math.cos(focus.yaw)*forward-Math.sin(focus.yaw)*right));
}

/** Search only a small neighborhood; blocked destinations never move the avatar. */
export function findTeleportSpot(x:number,z:number,canStand:(x:number,z:number)=>boolean){
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;
 if(canStand(x,z))return {x,z};
 for(const radius of [2,4,8,12,20,30])for(let i=0;i<24;i++){
  const a=i*Math.PI/12,nx=x+Math.cos(a)*radius,nz=z+Math.sin(a)*radius;
  if(canStand(nx,nz))return {x:nx,z:nz};
 }
 return null;
}
