export interface WarehouseGeometry {id:string;x:number;z:number;width:number;depth:number;rotation:number}
export interface TreeGeometry {id:string;x:number;z:number;radius:number}
export interface HauntedSoundOrigin {id:string;sourceId:string;kind:'warehouse'|'tree';x:number;y:number;z:number}
const CORRIDOR_COS=Math.cos(Math.PI/4),CORRIDOR_SIN=Math.sin(Math.PI/4);
/**
 * Measures effective horizontal distance (meters) to the Warehouse Row audio zone using active
 * building geometry when present, falling back to radial distance from the reference anchor.
 */
export function warehouseZoneDistance(
 x:number,z:number,anchor:{x:number;z:number},warehouses:readonly WarehouseGeometry[]=[]
):number{
 const radial=Math.hypot(x-anchor.x,z-anchor.z);
 if(warehouses.length===0)return radial;
 const toUv=(wx:number,wz:number)=>({u:wx*CORRIDOR_COS-wz*CORRIDOR_SIN,v:wx*CORRIDOR_SIN+wz*CORRIDOR_COS});
 const a=toUv(anchor.x,anchor.z),p=toUv(x,z);
 let minV=a.v,maxV=a.v;
 for(const w of warehouses){
  if(Math.hypot(w.x-anchor.x,w.z-anchor.z)>165)continue;
  const wUv=toUv(w.x,w.z);
  minV=Math.min(minV,wUv.v);
  maxV=Math.max(maxV,wUv.v-10);
 }
 const clampedV=Math.max(minV,Math.min(maxV,p.v));
 return Math.min(radial,Math.hypot(p.u-a.u,p.v-clampedV));
}
/** Actual rotated wall faces across Warehouse Row, not arbitrary polygon bounding-box centres. */
export function warehouseSoundOrigins(warehouses:readonly WarehouseGeometry[],trees:readonly TreeGeometry[],anchor:{x:number;z:number},edited:(id:string)=>boolean=()=>false):HauntedSoundOrigin[]{
 const result:HauntedSoundOrigin[]=[];
 const activeWarehouses=warehouses.filter(w=>!edited(w.id)&&Math.hypot(w.x-anchor.x,w.z-anchor.z)<=165);
 for(const w of activeWarehouses){
  const c=Math.cos(w.rotation),s=Math.sin(w.rotation);
  for(const side of [-1,1]){const dx=side*w.width/2,dz=w.depth*.2;
   result.push({id:`warehouse-audio:${w.id}:${side}`,sourceId:w.id,kind:'warehouse',x:w.x+c*dx+s*dz,y:2.2,z:w.z-s*dx+c*dz});
  }
 }
 for(const tree of trees)if(!edited(tree.id)&&warehouseZoneDistance(tree.x,tree.z,anchor,activeWarehouses)<=65)
  result.push({id:`warehouse-audio:${tree.id}`,sourceId:tree.id,kind:'tree',x:tree.x,y:3,z:tree.z});
 return result;
}
/** Coarse horizontal segment/rotated-building slab test; optional muffling, no triangle raycasts. */
export function warehouseOccluded(ax:number,az:number,bx:number,bz:number,buildings:readonly WarehouseGeometry[]):boolean{
 for(const b of buildings){
  const c=Math.cos(b.rotation),s=Math.sin(b.rotation);
  const x=c*(ax-b.x)-s*(az-b.z),z=s*(ax-b.x)+c*(az-b.z);
  const dx=c*(bx-ax)-s*(bz-az),dz=s*(bx-ax)+c*(bz-az);
  let lo=.02,hi=.96;
  for(const [p,d,h] of [[x,dx,b.width/2],[z,dz,b.depth/2]]){
   if(Math.abs(d)<1e-8){if(Math.abs(p)>h){hi=-1;break;}}
   else {let a=(-h-p)/d,v=(h-p)/d;if(a>v)[a,v]=[v,a];lo=Math.max(lo,a);hi=Math.min(hi,v);}
  }
  if(lo<hi)return true;
 }
 return false;
}
