import type { RoadPlot } from '../data/types.ts';
export type RouteNode={x:number;z:number;links:number[];lane:boolean};
type Point={x:number;z:number};
const cross=(a:Point,b:Point)=>a.x*b.z-a.z*b.x;
/** Split road centre-lines at every junction, then keep only obstacle-free edges. */
export function buildRoadGraph(roads:readonly RoadPlot[],clear:(x:number,z:number)=>boolean){
 const lines=roads.map(r=>{const c=Math.cos(r.rotation),s=Math.sin(r.rotation),horizontal=r.width>=r.depth,length=Math.max(r.width,r.depth);const d={x:(horizontal?c:s)*length/2,z:(horizontal?-s:c)*length/2};return {a:{x:r.x-d.x,z:r.z-d.z},b:{x:r.x+d.x,z:r.z+d.z},cuts:[0,1],lane:!r.main}});
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j],r={x:a.b.x-a.a.x,z:a.b.z-a.a.z},s={x:b.b.x-b.a.x,z:b.b.z-b.a.z},q={x:b.a.x-a.a.x,z:b.a.z-a.a.z},den=cross(r,s);
  if(Math.abs(den)>1e-8){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=-1e-8&&t<=1+1e-8&&u>=-1e-8&&u<=1+1e-8){a.cuts.push(Math.max(0,Math.min(1,t)));b.cuts.push(Math.max(0,Math.min(1,u)))}}
  else if(Math.abs(cross(q,r))<0.001){for(const p of [b.a,b.b]){const t=((p.x-a.a.x)*r.x+(p.z-a.a.z)*r.z)/(r.x*r.x+r.z*r.z);if(t>=0&&t<=1)a.cuts.push(t)}for(const p of [a.a,a.b]){const u=((p.x-b.a.x)*s.x+(p.z-b.a.z)*s.z)/(s.x*s.x+s.z*s.z);if(u>=0&&u<=1)b.cuts.push(u)}}
 }
 const nodes:RouteNode[]=[],lookup=new Map<string,number>();
 const node=(x:number,z:number,lane:boolean)=>{const key=`${Math.round(x*100)},${Math.round(z*100)}`;let id=lookup.get(key);if(id===undefined){id=nodes.length;lookup.set(key,id);nodes.push({x,z,lane,links:[]})}else nodes[id].lane ||= lane;return id};
 for(const line of lines){line.cuts.sort((a,b)=>a-b);for(let i=1;i<line.cuts.length;i++){
  const a=line.cuts[i-1],b=line.cuts[i];if(b-a<1e-7)continue;
  const length=Math.hypot(line.b.x-line.a.x,line.b.z-line.a.z)*(b-a),parts=Math.ceil(length/8);let previous:number|undefined;
  for(let k=0;k<=parts;k++){const t=a+(b-a)*k/parts,x=line.a.x+(line.b.x-line.a.x)*t,z=line.a.z+(line.b.z-line.a.z)*t;
   if(!clear(x,z)){previous=undefined;continue}const id=node(x,z,line.lane);
   if(previous!==undefined&&previous!==id){const p=nodes[previous];let safe=true;const checks=Math.ceil(Math.hypot(x-p.x,z-p.z)/0.75);for(let n=1;n<checks;n++)if(!clear(p.x+(x-p.x)*n/checks,p.z+(z-p.z)*n/checks)){safe=false;break}
    if(safe){if(!p.links.includes(id))p.links.push(id);if(!nodes[id].links.includes(previous))nodes[id].links.push(previous)}
   }previous=id;
  }
 }}
 return nodes;
}
export function nextRoadNode(graph:RouteNode[],current:number,previous:number,random:number){const choices=graph[current].links.filter(n=>n!==previous);const available=choices.length?choices:graph[current].links;return available.length?available[Math.floor(random*available.length)%available.length]:current}
