export const BALLOON_LAUNCH={x:123.789,z:-37.022,latitude:23.1630588,longitude:94.0479507,yaw:-25.1*Math.PI/180};
export const BALLOON_DECK=.26;
export const BALLOON_MAX_Y=1600;
export function createBalloonRide(){return {x:BALLOON_LAUNCH.x,z:BALLOON_LAUNCH.z,y:0,yaw:BALLOON_LAUNCH.yaw,vx:0,vz:0,vy:0,riding:false,grounded:true,nearTime:0,mustLeave:false,blocked:false};}
export type BalloonRide=ReturnType<typeof createBalloonRide>;
export const balloonRide=createBalloonRide();
export const balloonInput={lift:0,exit:false,toggleView:false,verticalJoystick:false};
export function clearBalloonInput(){balloonInput.lift=0;balloonInput.exit=false;balloonInput.toggleView=false;}
export function resetBalloon(){Object.assign(balloonRide,createBalloonRide());clearBalloonInput();}
export type BalloonStatus={riding:boolean;near:boolean;altitude:number;kmh:number;grounded:boolean;blocked:boolean};
export const emptyBalloonStatus:BalloonStatus={riding:false,near:false,altitude:0,kmh:0,grounded:true,blocked:false};
type Height=(x:number,z:number)=>number;
type Clear=(x:number,z:number)=>boolean;
const footprint=[[0,0],[-1.6,-1.6],[-1.6,1.6],[1.6,-1.6],[1.6,1.6]];
/** Land only on open, level ground under the entire basket. */
export function balloonLanding(x:number,z:number,height:Height,clear:Clear){
 const center=height(x,z);
 return footprint.every(([dx,dz])=>clear(x+dx,z+dz)&&Math.abs(height(x+dx,z+dz)-center)<.4);
}
/** Conservative clearance survives visual-region unloading. Low flight stays outside
 * building/tree footprints; water is passable but never a landing site. */
export function balloonFlightFloor(x:number,z:number,height:Height,canLand:Clear,airClear:Clear){
 let floor=height(x,z),obstacle=false;
 for(const [dx,dz] of [[0,0],[-4.6,0],[4.6,0],[0,-4.6],[0,4.6],[-3.3,-3.3],[-3.3,3.3],[3.3,-3.3],[3.3,3.3]]){
  floor=Math.max(floor,height(x+dx,z+dz));
  if(!airClear(x+dx,z+dz))obstacle=true;
 }
 return floor+(obstacle?40:balloonLanding(x,z,height,canLand)?0:1.3);
}
export function stepBalloon(b:BalloonRide,dt:number,input:{forward:number;right:number;lift:number;yaw:number;fast?:boolean;brake?:boolean},height:Height,flightFloor:Height,edge:number){
 if(!b.riding||dt<=0)return;
 const steps=Math.ceil(Math.min(dt,.1)*60),h=Math.min(dt,.1)/steps;
 b.blocked=false;
 for(let i=0;i<steps;i++){
  const floor=flightFloor(b.x,b.z),altitude=b.y-floor;
  const length=Math.max(1,Math.hypot(input.forward,input.right)),speed=input.fast?34:18;
  const moving=b.y-height(b.x,b.z)>.45&&!input.brake;
  const vx=moving?(-Math.sin(input.yaw)*input.forward+Math.cos(input.yaw)*input.right)/length*speed:0;
  const vz=moving?(-Math.cos(input.yaw)*input.forward-Math.sin(input.yaw)*input.right)/length*speed:0;
  const lift=Math.max(-1,Math.min(1,input.lift));
  const vy=input.brake?0:lift>0?lift*7:lift*Math.min(3,Math.max(.4,altitude*.7));
  const blend=1-Math.exp(-h*2.8);
  b.vx+=(vx-b.vx)*blend;b.vz+=(vz-b.vz)*blend;b.vy+=(vy-b.vy)*blend;
  const x=Math.max(-edge,Math.min(edge,b.x+b.vx*h)),z=Math.max(-edge,Math.min(edge,b.z+b.vz*h));
  if(flightFloor(x,z)<=b.y+.06){b.x=x;b.z=z;}else{b.vx=0;b.vz=0;b.blocked=true;}
  const nextFloor=flightFloor(b.x,b.z);
  b.y=Math.max(height(b.x,b.z),Math.min(BALLOON_MAX_Y,Math.max(Math.min(nextFloor,b.y),b.y+b.vy*h)));
  b.grounded=b.y-height(b.x,b.z)<.08;
  if(b.y<=nextFloor+.001&&b.vy<0)b.vy=0;
  if(b.y>=BALLOON_MAX_Y&&b.vy>0)b.vy=0;
  if(Math.hypot(b.vx,b.vz)>.3){const yaw=Math.atan2(-b.vx,-b.vz);b.yaw+=Math.atan2(Math.sin(yaw-b.yaw),Math.cos(yaw-b.yaw))*Math.min(1,h*2);}
 }
}
export function balloonExitSpot(b:BalloonRide,height:Height,clear:Clear){
 if(!b.grounded||Math.hypot(b.vx,b.vz)>.7)return null;
 for(let i=0;i<12;i++){
  const a=b.yaw+i*Math.PI/6,x=b.x+Math.cos(a)*3.1,z=b.z-Math.sin(a)*3.1;
  if(clear(x,z)&&Math.abs(height(x,z)-b.y)<.45)return {x,z};
 }
 return null;
}
