type CameraFocus={camX:number;camZ:number;yaw:number};
/** Camera navigation must never write to the avatar's world position. */
export function panCamera(focus:CameraFocus,right:number,forward:number,edge:number){
 focus.camX=Math.max(-edge,Math.min(edge,focus.camX-Math.sin(focus.yaw)*forward+Math.cos(focus.yaw)*right));
 focus.camZ=Math.max(-edge,Math.min(edge,focus.camZ-Math.cos(focus.yaw)*forward-Math.sin(focus.yaw)*right));
}

/** Bound a single update so a discontinuous pointer sample cannot move an entire viewport. */
export function cameraDragGain(dx: number, dy: number, viewportHeight: number): number {
 const length = Math.hypot(dx, dy);
 if (!Number.isFinite(length) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
 return length > 0 ? Math.min(1, viewportHeight * .25 / length) : 0;
}

export function cameraPanMetresPerPixel(distance: number, verticalFov: number, viewportHeight: number): number {
 if (!Number.isFinite(distance) || distance <= 0 || !(verticalFov > 0 && verticalFov < 180) ||
     !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
 const visibleHeight = 2 * distance * Math.tan(verticalFov * Math.PI / 360);
 return visibleHeight * .65 / viewportHeight;
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
