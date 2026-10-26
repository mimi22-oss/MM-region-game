export const BALLOON_LAUNCH={x:123.789,z:-37.022,latitude:23.1630588,longitude:94.0479507,yaw:-25.1*Math.PI/180};
export const BALLOON_DECK=.26;
export const BALLOON_MAX_Y=1600;
export function createBalloonRide(){
 return {
  x:BALLOON_LAUNCH.x,
  z:BALLOON_LAUNCH.z,
  y:0,
  yaw:BALLOON_LAUNCH.yaw,
  vx:0,
  vz:0,
  vy:0,
  riding:false,
  grounded:true,
  nearTime:0,
  mustLeave:false,
  blocked:false,
  autoCruise:false,
  autoReturn:false,
  cruiseVx:0,
  cruiseVz:0,
  returnDist:0
 };
}
export type BalloonRide=ReturnType<typeof createBalloonRide>;
export const balloonRide=createBalloonRide();
export const balloonInput={lift:0,steer:0,forward:0,exit:false,toggleView:false,verticalJoystick:false,toggleAutoReturn:false,stopCruise:false};
export function clearBalloonInput(){balloonInput.lift=0;balloonInput.steer=0;balloonInput.forward=0;balloonInput.exit=false;balloonInput.toggleView=false;balloonInput.toggleAutoReturn=false;balloonInput.stopCruise=false;}
export function resetBalloon(){Object.assign(balloonRide,createBalloonRide());clearBalloonInput();}
export type BalloonStatus={riding:boolean;near:boolean;altitude:number;kmh:number;grounded:boolean;blocked:boolean;autoCruise:boolean;autoReturn:boolean;returnDist:number};
export const emptyBalloonStatus:BalloonStatus={riding:false,near:false,altitude:0,kmh:0,grounded:true,blocked:false,autoCruise:false,autoReturn:false,returnDist:0};
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
export function stepBalloon(
 b:BalloonRide,
 dt:number,
 input:{forward:number;right:number;lift:number;yaw:number;fast?:boolean;brake?:boolean;steer?:number;stop?:boolean;autoCruise?:boolean;toggleAutoReturn?:boolean},
 height:Height,
 flightFloor:Height,
 edge:number
){
 if(!b.riding||dt<=0)return;

 if(input.toggleAutoReturn){
  b.autoReturn=!b.autoReturn;
  if(b.autoReturn)b.autoCruise=false;
 }
 if(input.stop){
  b.autoCruise=false;
  b.autoReturn=false;
  b.cruiseVx=0;
  b.cruiseVz=0;
 }

 const steerInput=(input.right||0)+(input.steer||0);
 const forwardInput=input.forward||0;

 // Cancel autoReturn if user steers manually or brakes
 if(b.autoReturn&&(Math.abs(steerInput)>0.08||Math.abs(forwardInput)>0.08||input.brake||input.stop)){
  b.autoReturn=false;
 }

 const steps=Math.ceil(Math.min(dt,.1)*60),h=Math.min(dt,.1)/steps;
 b.blocked=false;

 for(let i=0;i<steps;i++){
  const floor=flightFloor(b.x,b.z),altitude=b.y-floor;
  const isAirborne=b.y-height(b.x,b.z)>.45;

  let targetVx=0,targetVz=0,targetVy=0;

  if(b.autoReturn){
   // Auto-Return to Football field launch pad at 2x speed (36 km/h)
   const dx=BALLOON_LAUNCH.x-b.x;
   const dz=BALLOON_LAUNCH.z-b.z;
   const dist=Math.hypot(dx,dz);
   b.returnDist=Math.round(dist);

   if(dist>14){
    const returnSpeed=36;
    targetVx=(dx/dist)*returnSpeed;
    targetVz=(dz/dist)*returnSpeed;
    const safeFloor=flightFloor(b.x,b.z);
    const safeAltitude=safeFloor+22;
    if(b.y<safeAltitude-1){
     targetVy=7;
    }else if(b.y>safeAltitude+10){
     targetVy=-2;
    }else{
     targetVy=0;
    }
   }else if(dist>2.5){
    // Approach and smoothly decelerate over football field
    const returnSpeed=Math.max(3,(dist/14)*36);
    targetVx=(dx/dist)*returnSpeed;
    targetVz=(dz/dist)*returnSpeed;
    targetVy=-1.6;
   }else{
    // Final touchdown onto launch pad
    targetVx=(dx/Math.max(0.1,dist))*1.0;
    targetVz=(dz/Math.max(0.1,dist))*1.0;
    targetVy=-3.2;

    if(b.grounded||b.y-height(b.x,b.z)<0.12){
     b.x=BALLOON_LAUNCH.x;
     b.z=BALLOON_LAUNCH.z;
     b.y=height(b.x,b.z);
     b.yaw=BALLOON_LAUNCH.yaw;
     b.vx=0;
     b.vz=0;
     b.vy=0;
     b.grounded=true;
     b.autoReturn=false;
     b.autoCruise=false;
     b.returnDist=0;
     return;
    }
   }

   const targetYaw=Math.atan2(-dx,-dz);
   b.yaw+=Math.atan2(Math.sin(targetYaw-b.yaw),Math.cos(targetYaw-b.yaw))*Math.min(1,h*3);
  }else{
   // Manual / Auto-Cruise Mode
   if(input.brake||input.stop||!isAirborne){
    b.autoCruise=false;
    b.cruiseVx=0;
    b.cruiseVz=0;
   }

   const length=Math.max(1,Math.hypot(forwardInput,steerInput));
   const speed=input.fast?34:18;
   const moving=isAirborne&&!input.brake&&!input.stop;

   if(moving&&(Math.abs(forwardInput)>0.01||Math.abs(steerInput)>0.01)){
    targetVx=(-Math.sin(input.yaw)*forwardInput+Math.cos(input.yaw)*steerInput)/length*speed;
    targetVz=(-Math.cos(input.yaw)*forwardInput-Math.sin(input.yaw)*steerInput)/length*speed;
    b.cruiseVx=targetVx;
    b.cruiseVz=targetVz;
    if(input.autoCruise)b.autoCruise=true;
   }else if(b.autoCruise&&input.autoCruise===true&&moving){
    targetVx=b.cruiseVx;
    targetVz=b.cruiseVz;
   }else{
    targetVx=0;
    targetVz=0;
   }

   const lift=Math.max(-1,Math.min(1,input.lift));
   targetVy=input.brake?0:lift>0?lift*7:lift*Math.min(3,Math.max(.4,altitude*.7));
  }

  const blend=1-Math.exp(-h*2.8);
  b.vx+=(targetVx-b.vx)*blend;
  b.vz+=(targetVz-b.vz)*blend;
  b.vy+=(targetVy-b.vy)*blend;

  const x=Math.max(-edge,Math.min(edge,b.x+b.vx*h));
  const z=Math.max(-edge,Math.min(edge,b.z+b.vz*h));

  if(flightFloor(x,z)<=b.y+.06){
   b.x=x;
   b.z=z;
  }else{
   b.vx=0;
   b.vz=0;
   b.blocked=true;
  }

  const nextFloor=flightFloor(b.x,b.z);
  b.y=Math.max(height(b.x,b.z),Math.min(BALLOON_MAX_Y,Math.max(Math.min(nextFloor,b.y),b.y+b.vy*h)));
  b.grounded=b.y-height(b.x,b.z)<.08;
  if(b.y<=nextFloor+.001&&b.vy<0)b.vy=0;
  if(b.y>=BALLOON_MAX_Y&&b.vy>0)b.vy=0;

  if(Math.hypot(b.vx,b.vz)>.3){
   const yaw=Math.atan2(-b.vx,-b.vz);
   b.yaw+=Math.atan2(Math.sin(yaw-b.yaw),Math.cos(yaw-b.yaw))*Math.min(1,h*2.5);
  }
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
