export type MapProjection={origin:[number,number];anchor:[number,number];metersPerDegree:[number,number];rotation:number};
/** Explicit per-dataset calibration: legacy villages use different compressed scales. */
export function projectMapPoint(p:MapProjection,lon:number,lat:number){
 const u=(lon-p.origin[0])*p.metersPerDegree[0],v=-(lat-p.origin[1])*p.metersPerDegree[1],c=Math.cos(p.rotation),s=Math.sin(p.rotation);
 return {x:p.anchor[0]+u*c+v*s,z:p.anchor[1]-u*s+v*c};
}
export function unprojectMapPoint(p:MapProjection,x:number,z:number){
 const dx=x-p.anchor[0],dz=z-p.anchor[1],c=Math.cos(p.rotation),s=Math.sin(p.rotation);
 return {lon:p.origin[0]+(dx*c-dz*s)/p.metersPerDegree[0],lat:p.origin[1]-(dx*s+dz*c)/p.metersPerDegree[1]};
}
