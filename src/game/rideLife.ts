export const rideLife={lives:3,crashTime:0,invulnerable:0,contact:false};
export function hitRide(){
 if(rideLife.crashTime>0||rideLife.invulnerable>0||rideLife.contact)return false;
 rideLife.lives=Math.max(0,rideLife.lives-1);rideLife.crashTime=2;rideLife.contact=true;return true;
}
export function tickRideLife(dt:number){
 rideLife.invulnerable=Math.max(0,rideLife.invulnerable-dt);
 if(rideLife.crashTime<=0)return false;
 rideLife.crashTime=Math.max(0,rideLife.crashTime-dt);
 if(rideLife.crashTime>0)return false;
 rideLife.invulnerable=3;
 if(rideLife.lives===0){rideLife.lives=3;rideLife.contact=false;return true;}
 return false;
}
