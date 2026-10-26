/** Metres and seconds. Running momentum increases take-off impulse, never gravity. */
export const JUMP_GRAVITY = 18;
export function createHumanJump() {
  return { airborne:false, y:0, vy:0, vx:0, vz:0, safeX:0, safeZ:0 };
}
export type HumanJump = ReturnType<typeof createHumanJump>;
export type JumpPosition = {x:number;z:number};
export function rememberJumpMomentum(j:HumanJump, vx:number, vz:number, dt:number) {
  if(j.airborne)return;
  // A standing directional hop works immediately; full running power needs a run-up.
  const blend=1-Math.exp(-Math.max(0,dt)*9);
  j.vx+=(vx-j.vx)*blend;j.vz+=(vz-j.vz)*blend;
  if(Math.hypot(vx,vz)<.01){j.vx=0;j.vz=0;}
}
export function startHumanJump(j:HumanJump,p:JumpPosition,y:number,dx:number,dz:number) {
  if(j.airborne)return false;
  const direction=Math.hypot(dx,dz),speed=Math.min(9.5,Math.hypot(j.vx,j.vz));
  // Releasing a direction at take-off must not erase existing running momentum.
  if(direction&&speed<2){j.vx=dx/direction*2;j.vz=dz/direction*2;}
  j.vy=6+Math.max(0,Math.min(9.5,Math.hypot(j.vx,j.vz))-4)*.8;
  j.y=y;j.safeX=p.x;j.safeZ=p.z;j.airborne=true;
  return true;
}
/** A small amount of air control allows a standing hop to drift with the joystick. */
export function steerHumanJump(j:HumanJump,dx:number,dz:number,dt:number) {
  const length=Math.hypot(dx,dz);
  if(!j.airborne||!length||dt<=0)return;
  j.vx+=dx/length*3*dt;j.vz+=dz/length*3*dt;
  const speed=Math.hypot(j.vx,j.vz);
  if(speed>9.5){j.vx*=9.5/speed;j.vz*=9.5/speed;}
}
/** Swept 120 Hz physics prevents tunnelling through thin gates on slow frames.
 * Water has no landing surface: an unsuccessful crossing returns to the last safe bank.
 * Solid walls/trees always block; callers may allow finite-height fences above their tops.
 */
export function stepHumanJump(j:HumanJump,p:JumpPosition,dt:number,
  height:(x:number,z:number)=>number,
  clear:(x:number,z:number,y:number)=>boolean,
  canLand:(x:number,z:number)=>boolean,
) {
  if(!j.airborne||dt<=0)return;
  const count=Math.ceil(Math.min(dt,.1)*120),h=Math.min(dt,.1)/count;
  for(let i=0;i<count&&j.airborne;i++){
    const nextY=j.y+j.vy*h-.5*JUMP_GRAVITY*h*h;
    j.vy-=JUMP_GRAVITY*h;
    const x=p.x+j.vx*h,z=p.z+j.vz*h;
    if(clear(x,p.z,Math.min(j.y,nextY)))p.x=x;else j.vx=0;
    if(clear(p.x,z,Math.min(j.y,nextY)))p.z=z;else j.vz=0;
    if(canLand(p.x,p.z)){j.safeX=p.x;j.safeZ=p.z;}
    // Do not descend through a fence or land suspended over a drain.
    if(!clear(p.x,p.z,nextY)) {p.x=j.safeX;p.z=j.safeZ;j.vx=0;j.vz=0;}
    const floor=height(p.x,p.z);
    if(nextY<=floor&&j.vy<=0){
      if(!canLand(p.x,p.z)){p.x=j.safeX;p.z=j.safeZ;}
      j.y=height(p.x,p.z);j.vy=0;j.airborne=false;
    }else j.y=nextY;
  }
}
