import {savedWorldLayouts,worldEditVersion} from './worldEdits.ts';
import type {Point2} from './worldLayout.ts';
export const PLAYER_HOME_REFERENCE={x:174.891,z:183.666,u:-6.205,v:253.538} as const;
export const HOME_SAFE_ZONE_TAG='player-home';
export const HOME_RETREAT={buffer:5,faceSec:.4,backSec:.6,fadeSec:2,cooldownSec:12,speed:1.8} as const;
export type HomeBoundary={kind:'circle';x:number;z:number;radius:number}|{kind:'polygon';points:readonly Point2[]};
export const TEMPORARY_HOME_BOUNDARY:HomeBoundary={kind:'circle',x:PLAYER_HOME_REFERENCE.x,z:PLAYER_HOME_REFERENCE.z,radius:18};
let temporaryBoundary:HomeBoundary=TEMPORARY_HOME_BOUNDARY;
let revision=-1,cached:HomeBoundary=temporaryBoundary;
/** Temporary fallback tuning only; an authored editor polygon always takes priority. */
export function configureTemporaryHomeRadius(radius=18){
 if(!Number.isFinite(radius)||radius<=0||radius>500)throw new Error('Invalid home safe radius');
 temporaryBoundary={kind:'circle',x:PLAYER_HOME_REFERENCE.x,z:PLAYER_HOME_REFERENCE.z,radius};revision=-1;
}
function segmentDistance(x:number,z:number,a:Point2,b:Point2){const dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz,t=d?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/d)):0;return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);}
export function validHomePolygon(points:readonly Point2[]):boolean{
 if(points.length<3||points.length>256||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z)))return false;
 const ring=points.length>3&&Math.hypot(points[0].x-points.at(-1)!.x,points[0].z-points.at(-1)!.z)<1e-8?points.slice(0,-1):points;
 let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(Math.hypot(b.x-a.x,b.z-a.z)<1e-6)return false;area+=a.x*b.z-b.x*a.z;}
 if(Math.abs(area)<2)return false;
 // Reject crossing edges so an invalid edited ring cannot silently change protection.
 const cross=(a:Point2,b:Point2,c:Point2)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
 for(let i=0;i<ring.length;i++)for(let j=i+2;j<ring.length;j++){
  if(i===0&&j===ring.length-1)continue;
  const a=ring[i],b=ring[(i+1)%ring.length],c=ring[j],d=ring[(j+1)%ring.length];
  if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.max(c.x,d.x)>=Math.min(a.x,b.x)&&Math.max(a.z,b.z)>=Math.min(c.z,d.z)&&Math.max(c.z,d.z)>=Math.min(a.z,b.z))return false;
 }
 return true;
}
/** Signed distance: negative inside, zero on the protected boundary. */
export function homeBoundaryDistance(x:number,z:number,boundary:HomeBoundary=getPlayerHomeBoundary()):number{
 if(boundary.kind==='circle')return Math.hypot(x-boundary.x,z-boundary.z)-boundary.radius;
 let inside=false,nearest=Infinity;const pts=boundary.points;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[j],b=pts[i];nearest=Math.min(nearest,segmentDistance(x,z,a,b));
  if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }
 return inside?-nearest:nearest;
}
export function isPlayerHomeProtected(x:number,z:number,buffer=0,boundary?:HomeBoundary){return homeBoundaryDistance(x,z,boundary)<=buffer+1e-6;}
/** Read the existing saved editor revision once, never traverse layouts in the frame loop. */
export function getPlayerHomeBoundary():HomeBoundary{
 if(revision===worldEditVersion())return cached;
 revision=worldEditVersion();cached=temporaryBoundary;
 for(const layout of savedWorldLayouts())for(const f of layout.features){
  if(f.kind==='block'&&f.metadata?.safeZone===HOME_SAFE_ZONE_TAG&&validHomePolygon(f.points)){
   cached={kind:'polygon',points:f.points.map(p=>({x:p.x,z:p.z}))};return cached;
  }
 }
 return cached;
}
/** Collision-aware backwards retreat. A blocked ghost stands/fades rather than crossing a wall. */
const angles=[0,.35,-.35,.75,-.75,1.2,-1.2];
export function stepHomeRetreat(out:{x:number;z:number},playerX:number,playerZ:number,dt:number,walkCheck:(x:number,z:number)=>boolean,boundary:HomeBoundary=getPlayerHomeBoundary()){
 let dx=out.x-playerX,dz=out.z-playerZ;const length=Math.hypot(dx,dz);
 if(length<1e-6){dx=1;dz=0;}else{dx/=length;dz/=length;}
 const steps=Math.max(1,Math.ceil(HOME_RETREAT.speed*dt/.08)),step=HOME_RETREAT.speed*dt/steps;
 for(let i=0;i<steps;i++){
  const distance=homeBoundaryDistance(out.x,out.z,boundary);
  for(const angle of angles){const c=Math.cos(angle),s=Math.sin(angle),x=out.x+(dx*c-dz*s)*step,z=out.z+(dx*s+dz*c)*step;
   if(homeBoundaryDistance(x,z,boundary)>=distance-1e-6&&walkCheck(x,z)){out.x=x;out.z=z;break;}
  }
 }
}
