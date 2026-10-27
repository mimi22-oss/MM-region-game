import type {LayoutFeature,Point2,WorldLayout} from './worldLayout.ts';

/** Transform a selection as one assembly, preserving every member's relative placement. */
export function transformSelection(layout:WorldLayout,ids:readonly string[],change:{dx?:number;dz?:number;angle?:number;scale?:number;pivot?:Point2}):WorldLayout{
 const selected=new Set(ids),members=layout.features.filter(f=>selected.has(f.id));
 const points=members.flatMap(f=>f.points);if(!points.length)return layout;
 const pivot=change.pivot??{x:points.reduce((s,p)=>s+p.x,0)/points.length,z:points.reduce((s,p)=>s+p.z,0)/points.length};
 const angle=change.angle??0,scale=change.scale??1,dx=change.dx??0,dz=change.dz??0;
 if(![pivot.x,pivot.z,angle,scale,dx,dz].every(Number.isFinite)||scale<=0)throw new Error('Invalid selection transform');
 const c=Math.cos(angle),s=Math.sin(angle);
 return {...layout,features:layout.features.map(f=>{
  if(!selected.has(f.id))return f;
  return {...f,points:f.points.map(p=>{const x=(p.x-pivot.x)*scale,z=(p.z-pivot.z)*scale;return {x:pivot.x+x*c+z*s+dx,z:pivot.z-x*s+z*c+dz};}),rotation:(f.rotation??0)+angle,
   dimensions:f.dimensions?{...f.dimensions,width:f.dimensions.width*scale,depth:f.dimensions.depth*scale}:undefined,
   width:f.width===undefined?undefined:f.width*scale,size:f.size===undefined?undefined:f.size*scale};
 })};
}

export function editVertex(feature:LayoutFeature,index:number,point:Point2):LayoutFeature{
 if(index<0||index>=feature.points.length||!Number.isFinite(point.x)||!Number.isFinite(point.z))throw new Error('Invalid vertex');
 const last=feature.points.length-1;
 const closed=last>1&&feature.points[0].x===feature.points[last].x&&feature.points[0].z===feature.points[last].z;
 return {...feature,points:feature.points.map((p,i)=>i===index||(closed&&(index===0||index===last)&&(i===0||i===last))?{...point}:p)};
}

/** Selecting one member selects the complete persistent assembly. */
export function expandGroups(layout:WorldLayout,ids:readonly string[]):string[]{
 const chosen=new Set(ids),groups=new Set(layout.features.filter(f=>chosen.has(f.id)&&f.groupId).map(f=>f.groupId));
 return layout.features.filter(f=>chosen.has(f.id)||(f.groupId&&groups.has(f.groupId))).map(f=>f.id);
}

export function deleteSelection(layout:WorldLayout,ids:readonly string[]):WorldLayout{
 const chosen=new Set(ids),deleted=new Set(layout.deletedSourceIds??[]);
 for(const f of layout.features)if(chosen.has(f.id)&&typeof f.metadata?.sourceId==='string')deleted.add(f.metadata.sourceId);
 return {...layout,features:layout.features.filter(f=>!chosen.has(f.id)),deletedSourceIds:[...deleted]};
}

/** Joining keeps the first line's identity/style and consumes the second source. */
export function isLineLikeFeature(f: LayoutFeature): boolean {
  return f.kind === 'road' || f.metadata?.category === 'canal' || f.metadata?.category === 'drain' || f.points.length >= 2;
}

export function joinLines(layout:WorldLayout,firstId:string,secondId:string):WorldLayout{
 const a=layout.features.find(f=>f.id===firstId),b=layout.features.find(f=>f.id===secondId);
 if(!a||!b||a===b||!isLineLikeFeature(a)||!isLineLikeFeature(b)||a.points.length<2||b.points.length<2)throw new Error('Select two roads, canals or paths');
 let best={distance:Infinity,a:a.points,b:b.points};
 for(const ap of [a.points,[...a.points].reverse()])for(const bp of [b.points,[...b.points].reverse()]){
  const p=ap[ap.length-1],q=bp[0],distance=Math.hypot(p.x-q.x,p.z-q.z);
  if(distance<best.distance)best={distance,a:ap,b:bp};
 }
 const points=[...best.a,...(best.distance<1e-6?best.b.slice(1):best.b)];
 const next=deleteSelection(layout,[secondId]);
 return {...next,features:next.features.map(f=>f.id===firstId?{...f,points}:f)};
}

export function removeVertex(feature:LayoutFeature,index:number):LayoutFeature{
 const closed=feature.points.length>2&&feature.points[0].x===feature.points.at(-1)!.x&&feature.points[0].z===feature.points.at(-1)!.z;
 const vertices=closed?feature.points.slice(0,-1):feature.points;
 const actualIndex=closed&&index===feature.points.length-1?0:index;
 const minimum=isLineLikeFeature(feature)?2:3;
 if(!Number.isInteger(actualIndex)||actualIndex<0||actualIndex>=vertices.length||vertices.length<=minimum)throw new Error(`Keep at least ${minimum} vertices`);
 const points=vertices.filter((_,i)=>i!==actualIndex);
 return {...feature,points:closed?[...points,{...points[0]}]:points};
}

export function extendLine(feature:LayoutFeature,point:Point2,end:'start'|'end'='end'):LayoutFeature{
 if(!isLineLikeFeature(feature)||!Number.isFinite(point.x)||!Number.isFinite(point.z))throw new Error('Invalid line extension');
 return {...feature,points:end==='start'?[{...point},...feature.points]:[...feature.points,{...point}]};
}

