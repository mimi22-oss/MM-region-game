import test from 'node:test';
import assert from 'node:assert/strict';
import {GhostAiController} from '../src/game/ghostAi.ts';
import {DEFAULT_GHOST_AI_CONFIG} from '../src/game/ghostConfig.ts';
const node={id:'a',role:'hiding' as const,x:0,z:0,localU:0,localV:0,links:[]};
export const fixture={anchor:{x:0,z:0,localU:0,localV:0},waypoints:[node],waypointById:new Map([['a',node]]),hidingIds:['a'],patrolIds:['a'],roadCrossings:[],obstacleBoxes:[],treeColliders:[]};
test('first continuous visible proximity chases even when random approach threshold is six',()=>{
 const ai=new GhostAiController(fixture,DEFAULT_GHOST_AI_CONFIG,1,()=>.99);
 for(let i=0;i<25;i++)ai.step({dt:.05,activeBySchedule:true,playerX:100,playerZ:0,walkCheck:()=>true});
 const trace=[];for(let i=0;i<100;i++){const snap=ai.step({dt:.05,activeBySchedule:true,playerX:10,playerZ:0,walkCheck:()=>true});trace.push(snap.state);}
 assert.ok(trace.includes('CHASING')||trace.includes('GRABBING'),`actual trace: ${[...new Set(trace)].join(', ')}; threshold=${ai.getSnapshot().chaseThreshold}`);
});
