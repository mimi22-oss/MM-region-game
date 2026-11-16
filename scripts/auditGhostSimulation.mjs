import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {GhostAiController} from '../artifacts/ghost-audit/snapshot/src/game/ghostAi.ts';
import {createGhostPersonalityConfig} from '../artifacts/ghost-audit/snapshot/src/game/ghostPersonalities.ts';
const node={id:'a',role:'hiding',x:0,z:0,localU:0,localV:0,links:[]};
const env={anchor:{x:0,z:0,localU:0,localV:0},waypoints:[node],waypointById:new Map([['a',node]]),hidingIds:['a'],patrolIds:['a'],roadCrossings:[],obstacleBoxes:[],treeColliders:[]};
const results=[];
for(const mode of ['near-chasing-open','far-suspended'])for(const count of [1,3,10,50,100]){
 const actors=Array.from({length:count},(_,i)=>{const a=new GhostAiController(env,createGhostPersonalityConfig(['hunter','ambusher','stalker'][i%3]),123+i,()=>.99);a.forceStateForTest('CHASING');return a;});
 let collisionMs=0,collisionChecks=0,pathMs=0,pathCalls=0,stalled=0,displacement=0;
 for(const actor of actors){const original=actor.setTargetWaypoint.bind(actor);actor.setTargetWaypoint=(...args)=>{const t=performance.now();const result=original(...args);pathMs+=performance.now()-t;pathCalls++;return result;};}
 const walk=()=>{const t=performance.now();collisionChecks++;collisionMs+=performance.now()-t;return true;};
 const samples=[],heapBefore=process.memoryUsage().heapUsed;let stateCounts={};
 for(let frame=0;frame<200;frame++){
  const t=performance.now();for(const actor of actors){const x=actor.x,z=actor.z;const s=actor.step({dt:.05,activeBySchedule:true,playerX:mode==='far-suspended'?1000:actor.x+10,playerZ:mode==='far-suspended'?1000:actor.z,walkCheck:walk});
   const moved=Math.hypot(s.x-x,s.z-z);displacement+=moved;if(moved<1e-7&&mode==='near-chasing-open')stalled++;stateCounts[s.state]=(stateCounts[s.state]??0)+1;
  }samples.push(performance.now()-t);
 }
 const sorted=[...samples].sort((a,b)=>a-b);results.push({mode,count,frames:200,simulationSeconds:10,meanStepBatchMs:samples.reduce((s,n)=>s+n,0)/200,p95BatchMs:sorted[Math.floor(sorted.length*.95)],maxBatchMs:sorted.at(-1),collisionMs,collisionChecks,pathMs,pathCalls,stalled,displacement,heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,stateCounts});
}
await writeFile('artifacts/ghost-audit/simulation-performance.json',JSON.stringify({note:'Pinned source, instrumented Node simulation only, flat walkable stub, snapshots allocated as production. No render/GPU/Android. Collision timer measures callback overhead, not full map collision cost.',results},null,2));console.log(JSON.stringify(results.map(r=>({mode:r.mode,count:r.count,meanMs:r.meanStepBatchMs,p95Ms:r.p95BatchMs,stalls:r.stalled}))));
