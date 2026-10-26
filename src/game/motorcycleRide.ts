import { motorcycleData } from '../data/motorcycle.ts';
export const motorcycleRide={x:motorcycleData.x,z:motorcycleData.z,yaw:motorcycleData.rotation,groundY:0,pitch:0,riding:false,mustLeave:false,speed:0,distance:0,cooldown:0,nearTime:0,reverseWait:0,maxKmh:60,accelerating:false,braking:false};
export function setRideAccelerate(active:boolean){motorcycleRide.accelerating=active;}
export function setRideBrake(active:boolean){motorcycleRide.braking=active;}
export type RideStatus={riding:boolean;near:boolean;kmh:number;notice:string;lives:number;crashed:boolean;impactMode?:'walking'|'motorcycle'|'car';damage?:number};
export function parkMotorcycle(){motorcycleRide.riding=false;motorcycleRide.mustLeave=true;motorcycleRide.speed=0;motorcycleRide.accelerating=false;motorcycleRide.braking=false;motorcycleRide.cooldown=2;motorcycleRide.nearTime=0;motorcycleRide.reverseWait=0;}
export function rideFootprintClear(x:number,z:number,yaw:number,clear:(x:number,z:number)=>boolean,boost=false){
 const dx=-Math.sin(yaw)*.56,dz=-Math.cos(yaw)*.56;
 return clear(x,z)&&clear(x+dx,z+dz)&&clear(x-dx,z-dz);
}
export function tryMount(x:number,z:number,clear:(x:number,z:number)=>boolean,boost=false){
 const r=motorcycleRide;if(r.riding||r.mustLeave||r.cooldown>0||Math.hypot(x-r.x,z-r.z)>1.6)return false;
 r.riding=true;
 if(!rideFootprintClear(r.x,r.z,r.yaw,clear)){r.riding=false;return false;}
 r.speed=0;r.reverseWait=0;r.nearTime=0;return true;
}
export function dismountSpot(clear:(x:number,z:number)=>boolean){
 const r=motorcycleRide;
 for(const radius of [1.25,1.6,2.0])for(const a of [Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4]){
  const x=r.x-Math.sin(r.yaw+a)*radius,z=r.z-Math.cos(r.yaw+a)*radius;
  if(clear(x,z))return {x,z};
 }
 return null;
}
/** Swept three-point motorcycle footprint, with bounded steps to prevent tunnelling. */
export function stepMotorcycle(dt:number,throttle:number,steer:number,brake:boolean,paused:boolean,clear:(x:number,z:number)=>boolean,boost=false,cruiseScale=1){
 const r=motorcycleRide;if(!r.riding)return;
 dt=Math.min(.05,Math.max(0,dt));
 if(paused){r.speed=0;return;}
 const isBraking=brake||r.braking;
 const isBoosting=boost||r.accelerating;
 const effectiveThrottle=isBraking?0:(isBoosting?Math.max(throttle,1):throttle);
 const topMax=Math.min(80,Math.max(5,r.maxKmh))/3.6;
 const cruiseMax=Math.min(topMax,20/3.6*Math.max(1,Math.min(2,cruiseScale)));
 const targetMax=isBoosting?topMax:cruiseMax;
 if(isBraking){r.speed=Math.sign(r.speed)*Math.max(0,Math.abs(r.speed)-9.5*dt);r.reverseWait=0;}
 else if(effectiveThrottle<-.1){
  if(r.speed>0){r.speed=Math.max(0,r.speed-9.5*dt);r.reverseWait=0;}
  else{r.reverseWait+=dt;if(r.reverseWait>.25)r.speed=Math.max(-5/3.6,r.speed-2.2*dt);}
 }else if(effectiveThrottle>.1){
  r.reverseWait=0;
  if(r.speed<targetMax){const accelRate=r.speed<0?8:(isBoosting?5.6:4.2);r.speed=Math.min(targetMax,r.speed+accelRate*dt);}
  else if(r.speed>targetMax){r.speed=Math.max(targetMax,r.speed-3.2*dt);}
 }else{r.reverseWait=0;r.speed=Math.sign(r.speed)*Math.max(0,Math.abs(r.speed)-3.0*dt);}
 r.speed=Math.min(topMax,r.speed);
 const yaw=r.yaw-steer*dt*1.8*Math.min(1,Math.abs(r.speed)/.6)*Math.sign(r.speed);
 if(rideFootprintClear(r.x,r.z,yaw,clear))r.yaw=yaw;
 const distance=r.speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.1));
 for(let i=0;i<steps;i++){
  const d=distance/steps,x=r.x-Math.sin(r.yaw)*d,z=r.z-Math.cos(r.yaw)*d;
  if(!rideFootprintClear(x,z,r.yaw,clear)){r.speed=0;break;}
  r.x=x;r.z=z;r.distance+=d;
 }
}
