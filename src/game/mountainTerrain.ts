import { BufferGeometry, Float32BufferAttribute, Color } from 'three';
export type TerrainPeak={u:number;v:number;radius:number;height:number};
const smooth=(t:number)=>t*t*(3-2*t);
function hash(x:number,z:number){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)}
export function terrainNoise(x:number,z:number){const a=Math.floor(x),b=Math.floor(z),u=smooth(x-a),v=smooth(z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v}
/** Compact support keeps the road pass and village footprints unchanged. */
export function mountainHeight(u:number,v:number,peaks:readonly TerrainPeak[]){
 let sum=0;
 for(const p of peaks){const dx=(u-p.u)/p.radius,dz=(v-p.v)/p.radius,r=Math.hypot(dx,dz);if(r>=1)continue;
  const azimuth=Math.atan2(dz,dx),valley=(1+Math.sin(azimuth*9+r*5+terrainNoise(u/90,v/90)*2))/2;
  const erosion=1-0.32*valley*r/(r+0.12);
  const h=p.height*Math.pow(1-r*r,1.25)*erosion;
  sum+=Math.pow(h,6);
 }
 return Math.pow(sum,1/6);
}
/** Connected tiled heightfield, vertex colors and shared-edge normals; no tree meshes. */
export function buildMountainTiles(peaks:readonly TerrainPeak[],step=10,haze=0){
 const size=240,n=Math.round(size/step),spacing=size/n,tiles=new Set<string>();
 for(const p of peaks)for(let x=Math.floor((p.u-p.radius)/size);x<=Math.floor((p.u+p.radius)/size);x++)for(let z=Math.floor((p.v-p.radius)/size);z<=Math.floor((p.v+p.radius)/size);z++)tiles.add(`${x},${z}`);
 const forest=new Color('#315c43'),sun=new Color('#637e4b'),soil=new Color('#93836a'),blue=new Color('#87a8c3');
 return [...tiles].map(key=>{
  const [tx,tz]=key.split(',').map(Number),u0=tx*size,v0=tz*size;
  const nearby=peaks.filter(p=>p.u+p.radius>=u0-2&&p.u-p.radius<=u0+size+2&&p.v+p.radius>=v0-2&&p.v-p.radius<=v0+size+2);
  const positions:number[]=[],colors:number[]=[],normals:number[]=[],indices:number[]=[],heights:number[]=[];
  for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){
   const u=u0+x*spacing,v=v0+z*spacing,h=mountainHeight(u,v,nearby);heights.push(h);
   positions.push(x*spacing,h,z*spacing);
   const dx=(mountainHeight(u+1,v,nearby)-mountainHeight(u-1,v,nearby))/2,dz=(mountainHeight(u,v+1,nearby)-mountainHeight(u,v-1,nearby))/2,len=Math.hypot(dx,1,dz);
   normals.push(-dx/len,1/len,-dz/len);
   const noise=terrainNoise(u/24,v/24)*0.65+terrainNoise(u/7,v/7)*0.35;
   const c=forest.clone().lerp(sun,noise*0.8);
   const scar=Math.max(0,(terrainNoise(u/65,v/45)-0.58)*2.5)*Math.min(1,Math.hypot(dx,dz)/3);
   c.lerp(soil,scar).lerp(blue,haze);colors.push(c.r,c.g,c.b);
  }
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
   const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;
   if(Math.max(heights[a],heights[b],heights[c],heights[d])<0.01)continue;
   indices.push(a,c,b,b,c,d);
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
  return {key,u:u0,v:v0,geometry};
 }).filter(tile=>{if(tile.geometry.index!.count)return true;tile.geometry.dispose();return false});
}
