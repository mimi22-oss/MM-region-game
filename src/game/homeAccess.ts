import { farmhouse, ward } from '../data/ward.ts';
export const PLAYER_OWNER='player-robot';
export const homeOwnership:Record<string,string>={[farmhouse.id]:PLAYER_OWNER};
export function ownsHome(houseId:string,actor=PLAYER_OWNER){return homeOwnership[houseId]===actor}
export function localPoint(x:number,z:number,cx:number,cz:number,rotation:number){const dx=x-cx,dz=z-cz,c=Math.cos(rotation),s=Math.sin(rotation);return {x:dx*c-dz*s,z:dx*s+dz*c}}
function worldPoint(x:number,z:number,cx:number,cz:number,rotation:number){return {x:cx+x*Math.cos(rotation)+z*Math.sin(rotation),z:cz-x*Math.sin(rotation)+z*Math.cos(rotation)}}
const lot=ward.frontLot;
export const homeGates={
 street:{...worldPoint(0,lot.width/2,lot.x,lot.z,lot.rotation+Math.PI/2),rotation:lot.rotation+Math.PI/2,width:3.4},
 yard:{...worldPoint(0,7.5,farmhouse.x,farmhouse.z,farmhouse.rotation),rotation:farmhouse.rotation,width:3.4},
 door:{...worldPoint(0,5,farmhouse.x,farmhouse.z,farmhouse.rotation),rotation:farmhouse.rotation,width:2.4},
};
export type HomeGate=keyof typeof homeGates;
export const homeAccess={x:Infinity,z:Infinity,open:{street:0,yard:0,door:0},hold:{street:0,yard:0,door:0},wait:{street:0,yard:0,door:0},anchorX:Infinity,anchorZ:Infinity};
export function updateHomeAccess(x:number,z:number,dt:number,actor=PLAYER_OWNER){
 const moved=Math.hypot(x-homeAccess.anchorX,z-homeAccess.anchorZ)>.08;
 if(moved){homeAccess.anchorX=x;homeAccess.anchorZ=z;}
 homeAccess.x=x;homeAccess.z=z;
 for(const id of Object.keys(homeGates) as HomeGate[]){
  const g=homeGates[id],near=ownsHome(farmhouse.id,actor)&&Math.hypot(x-g.x,z-g.z)<(id==='door'?3.5:5);
  homeAccess.wait[id]=near&&!moved?Math.min(3,homeAccess.wait[id]+dt):0;
  const unlocked=homeAccess.wait[id]>=3||(homeAccess.hold[id]>0&&homeAccess.open[id]>0);
  homeAccess.hold[id]=near&&unlocked?2:Math.max(0,homeAccess.hold[id]-dt);
  const target=homeAccess.hold[id]>0?1:0;
  homeAccess.open[id]+=Math.sign(target-homeAccess.open[id])*Math.min(Math.abs(target-homeAccess.open[id]),dt*1.8);
 }
}
export function homeGateBlocks(x:number,z:number,radius=.4){
 return (Object.keys(homeGates) as HomeGate[]).some(id=>{
  const g=homeGates[id],p=localPoint(x,z,g.x,g.z,g.rotation);
  return homeAccess.open[id]<.85&&Math.abs(p.x)<g.width/2+radius&&Math.abs(p.z)<.12+radius;
 });
}
export function homeGuidance(x:number,z:number){
 for(const id of Object.keys(homeGates) as HomeGate[]){const g=homeGates[id];if(homeAccess.open[id]<.85&&Math.hypot(x-g.x,z-g.z)<(id==='door'?3.5:5))return 'YOUR HOME - Stand still for 3 seconds to open';}
 const p=localPoint(x,z,farmhouse.x,farmhouse.z,farmhouse.rotation);
 if(p.x>-9&&p.x<18&&p.z>-7.5&&p.z<7.5)return p.z>4.5?'YOUR HOME ? Follow the arrows to the front door':'WELCOME HOME ? Kitchen on the left ? Bedroom on the right';
 if(Math.hypot(x-homeGates.yard.x,z-homeGates.yard.z)<8)return 'YOUR HOME ? Gate opens automatically';
 return '';
}
