export type ImpactMode='walking'|'motorcycle'|'car';
export const rideLife={lives:3,crashTime:0,invulnerable:0,contact:false,mode:'motorcycle' as ImpactMode,damage:0};
export function hitActor(mode:ImpactMode,hitByCar=false){
 if(rideLife.crashTime>0||rideLife.invulnerable>0||rideLife.contact)return false;
 const damage=mode==='walking'?(hitByCar?rideLife.lives:0):mode==='car'?1.5:1;
 rideLife.mode=mode;rideLife.damage=Math.min(rideLife.lives,damage);
 rideLife.lives=Math.max(0,rideLife.lives-damage);rideLife.crashTime=2;rideLife.contact=true;return true;
}
export function hitRide(){return hitActor('motorcycle');}
export function fallProgress(crashTime:number,lives:number){return crashTime>0?Math.max(0,Math.min(1,(2-crashTime)/.35,lives>0?crashTime/.4:1)):0;}
export function isWalkingRecoil(){return rideLife.mode==='walking'&&rideLife.damage===0&&rideLife.crashTime>0;}
export function actorFallProgress(){return isWalkingRecoil()?0:fallProgress(rideLife.crashTime,rideLife.lives);}
export function tickRideLife(dt:number){
 rideLife.invulnerable=Math.max(0,rideLife.invulnerable-dt);
 if(rideLife.crashTime<=0)return false;
 rideLife.crashTime=Math.max(0,rideLife.crashTime-dt);
 if(rideLife.crashTime>0)return false;
 rideLife.invulnerable=3;
 if(rideLife.lives===0){rideLife.lives=3;rideLife.contact=false;return true;}
 return false;
}
