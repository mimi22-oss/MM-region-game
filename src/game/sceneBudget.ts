export const mobileQuality=typeof window!=='undefined'&&(matchMedia('(pointer: coarse)').matches||window.innerWidth<=760);
export type RegionBounds={id:string;minX:number;maxX:number;minZ:number;maxZ:number};
export function selectRegions(regions:RegionBounds[],x:number,z:number,height:number,previous:string[],mobile:boolean){
 if(height>(mobile?620:1100))return [];
 return regions.map(r=>({id:r.id,d:Math.hypot(Math.max(r.minX-x,0,x-r.maxX),Math.max(r.minZ-z,0,z-r.maxZ))}))
 .filter(r=>height<(previous.includes(r.id)?(mobile?620:1100):(mobile?420:800)))
 .filter(r=>r.d<(previous.includes(r.id)?650:500))
 .sort((a,b)=>(a.d-(previous.includes(a.id)?80:0))-(b.d-(previous.includes(b.id)?80:0)))
 .slice(0,mobile?1:2).map(r=>r.id);
}

export function selectOverviewRegions(regions:RegionBounds[],x:number,z:number,mobile:boolean){
 return [...regions].sort((a,b)=>Math.hypot((a.minX+a.maxX)/2-x,(a.minZ+a.maxZ)/2-z)-Math.hypot((b.minX+b.maxX)/2-x,(b.minZ+b.maxZ)/2-z)).slice(0,mobile?16:32).map(r=>r.id);
}

/** Do not replace entire region trees while the camera is in motion. */
export class ViewSettler {
 last:{x:number;z:number;height:number}|null=null;
 quiet=0;
 update(x:number,z:number,height:number,dt:number){
  const moved=!this.last||Math.hypot(x-this.last.x,z-this.last.z)>0.1||Math.abs(height-this.last.height)>0.1;
  this.quiet=moved?0:this.quiet+dt;
  this.last={x,z,height};
  return this.quiet>=0.6;
 }
}
