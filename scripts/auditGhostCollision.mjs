import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {buildDefaultWarehouseEnvironment,isGhostPointWalkable,findWaypointPath} from '../artifacts/ghost-audit/snapshot/src/data/ghostWarehouseWaypoints.ts';
const env=buildDefaultWarehouseEnvironment(),queries=[],paths=[];let valid=0;
for(let i=0;i<1000;i++)isGhostPointWalkable(env.anchor.x+Math.sin(i)*30,env.anchor.z+Math.cos(i)*30);
for(let i=0;i<10000;i++){const t=performance.now(),result=isGhostPointWalkable(env.anchor.x+Math.sin(i*.17)*35,env.anchor.z+Math.cos(i*.23)*50);queries.push(performance.now()-t);valid+=Number(result);}
for(let i=0;i<2000;i++){const t=performance.now();findWaypointPath(env,env.waypoints[i%env.waypoints.length].id,env.waypoints[(i*7+1)%env.waypoints.length].id);paths.push(performance.now()-t);}
const summarize=a=>({count:a.length,meanMs:a.reduce((s,n)=>s+n,0)/a.length,p95Ms:[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)],maxMs:Math.max(...a)});
const result={collision:summarize(queries),valid,pathfinding:summarize(paths),waypoints:env.waypoints.length,note:'Pinned authored warehouse map; Node microbenchmarks after warmup; queries include walkability+capsule/tree checks, not render/Android or per-frame whole scene costs.'};await writeFile('artifacts/ghost-audit/collision-path-performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
