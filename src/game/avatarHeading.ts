/** A -Z-facing avatar turns only after actual ground movement, never camera orbit. */
export function avatarHeading(previous:number,dx:number,dz:number){
 return Math.hypot(dx,dz)>0.00001?Math.atan2(-dx,-dz):previous;
}
