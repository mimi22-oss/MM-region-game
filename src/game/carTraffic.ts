export type TrafficRoad={id:string;x:number;z:number;width:number;depth:number;rotation:number;main?:boolean};
export type TrafficRoute={id:string;x:number;z:number;dx:number;dz:number;length:number;lane:number};
/** Merge overlapping/adjacent collinear highway pieces, ignoring residential lanes. */
export function buildTrafficRoutes(roads:TrafficRoad[]){
 const groups=new Map<string,{dx:number;dz:number;offset:number;segments:{lo:number;hi:number;width:number}[]}>();
 for(const r of roads){
  if(!r.main)continue;
  const horizontal=r.width>=r.depth;let dx=horizontal?Math.cos(r.rotation):Math.sin(r.rotation),dz=horizontal?-Math.sin(r.rotation):Math.cos(r.rotation);
  if(dz<-.00001||(Math.abs(dz)<.00001&&dx<0)){dx=-dx;dz=-dz}
  const offset=-dz*r.x+dx*r.z,mid=dx*r.x+dz*r.z,length=Math.max(r.width,r.depth),width=Math.min(r.width,r.depth);
  if(width<5||length<30)continue;
  const key=[dx.toFixed(4),dz.toFixed(4),offset.toFixed(1)].join(':');
  let g=groups.get(key);if(!g){g={dx,dz,offset,segments:[]};groups.set(key,g)}
  g.segments.push({lo:mid-length/2,hi:mid+length/2,width});
 }
 const routes:TrafficRoute[]=[];
 for(const [key,g] of groups){
  const merged:{lo:number;hi:number;width:number}[]=[];
  for(const s of g.segments.sort((a,b)=>a.lo-b.lo)){const last=merged[merged.length-1];if(last&&s.lo<=last.hi+.5){last.hi=Math.max(last.hi,s.hi);last.width=Math.min(last.width,s.width)}else merged.push({...s})}
  for(const [i,s] of merged.entries()){
   const lane=Math.min(2.2,s.width*.22),start=s.lo+lane+3,length=s.hi-s.lo-2*(lane+3);
   if(length<15)continue;
   routes.push({id:key+':'+i,x:g.dx*start-g.dz*g.offset,z:g.dz*start+g.dx*g.offset,dx:g.dx,dz:g.dz,length,lane});
  }
 }
 return routes;
}
export function trafficPose(r:TrafficRoute,travel:number){
 const arc=Math.PI*r.lane,period=2*r.length+2*arc;let s=((travel%period)+period)%period;
 let along:number,side:number,tx:number,tz:number;
 if(s<r.length){along=s;side=r.lane;tx=1;tz=0}
 else if((s-=r.length)<arc){const a=s/r.lane;along=r.length+r.lane*Math.sin(a);side=r.lane*Math.cos(a);tx=Math.cos(a);tz=-Math.sin(a)}
 else if((s-=arc)<r.length){along=r.length-s;side=-r.lane;tx=-1;tz=0}
 else {s-=r.length;const a=s/r.lane;along=-r.lane*Math.sin(a);side=-r.lane*Math.cos(a);tx=-Math.cos(a);tz=Math.sin(a)}
 const vx=r.dx*tx-r.dz*tz,vz=r.dz*tx+r.dx*tz;
 return {x:r.x+r.dx*along-r.dz*side,z:r.z+r.dz*along+r.dx*side,yaw:Math.atan2(-vx,-vz)};
}
export function carAppearance(index:number){return {color:`hsl(${(index*137.508+15)%360}, ${60+index%3*10}%, ${42+index%4*5}%)`,size:.78+(index%7)*.045};}
