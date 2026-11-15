import {afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {GhostAiController} from '../src/game/ghostAi.ts';
import {DEFAULT_GHOST_AI_CONFIG} from '../src/game/ghostConfig.ts';
import {PLAYER_HOME_REFERENCE as home,HOME_RETREAT,isPlayerHomeProtected,getPlayerHomeBoundary,validHomePolygon,homeBoundaryDistance,stepHomeRetreat,configureTemporaryHomeRadius} from '../src/game/playerHomeProtection.ts';
import {applyGhostOpacity,rememberGhostMaterial} from '../src/game/ghostVisuals.ts';
import {publishWorldEdits,clearWorldEdits} from '../src/game/worldEdits.ts';
import type {GhostWarehouseEnvironment} from '../src/data/ghostWarehouseWaypoints.ts';
function env(offset=24):GhostWarehouseEnvironment{
 const a={id:'spawn',x:home.x+offset,z:home.z,role:'hiding' as const,localU:0,localV:0,links:['other']};
 const b={id:'other',x:home.x+45,z:home.z,role:'patrol' as const,localU:0,localV:0,links:['spawn']};
 return {anchor:{x:a.x,z:a.z,localU:0,localV:0},waypoints:[a,b],waypointById:new Map([['spawn',a],['other',b]]),hidingIds:['spawn'],patrolIds:['other'],roadCrossings:[],treeColliders:[],obstacleBoxes:[]};
}
const step=(ai:GhostAiController,x=home.x+18,dt=.05,walkCheck=()=>true)=>ai.step({dt,activeBySchedule:true,playerX:x,playerZ:home.z,walkCheck});
function ready(offset=24,seed=3){const ai=new GhostAiController(env(offset),DEFAULT_GHOST_AI_CONFIG,seed,()=>0);for(let i=0;i<25;i++)step(ai,home.x+60);return ai;}
afterEach(()=>{clearWorldEdits();configureTemporaryHomeRadius();});
test('exact scene circle boundary is inclusive and editor polygon replaces fallback safely',()=>{
 assert.equal(isPlayerHomeProtected(home.x+18,home.z),true);assert.equal(isPlayerHomeProtected(home.x+18.01,home.z),false);
 assert.equal(isPlayerHomeProtected(home.x+22.9,home.z,5),true);
 configureTemporaryHomeRadius(12);assert.equal(isPlayerHomeProtected(home.x+15,home.z),false);configureTemporaryHomeRadius();
 assert.throws(()=>configureTemporaryHomeRadius(NaN));
 const points=[{x:home.x-8,z:home.z-6},{x:home.x+8,z:home.z-6},{x:home.x+8,z:home.z+6},{x:home.x-8,z:home.z+6}];
 assert.equal(validHomePolygon(points),true);assert.equal(validHomePolygon([points[0],points[2],points[1],points[3]]),false);
 publishWorldEdits([{version:1,name:'Home yard',updatedAt:'test',features:[{id:'yard',kind:'block',name:'Protected yard',points,metadata:{safeZone:'player-home'}}]}]);
 assert.equal(getPlayerHomeBoundary().kind,'polygon');assert.equal(isPlayerHomeProtected(home.x+8,home.z),true);assert.equal(isPlayerHomeProtected(home.x+9,home.z),false);
 points[0].x=0;assert.equal(isPlayerHomeProtected(home.x-8,home.z),true,'cached ring owns its points');
 clearWorldEdits();assert.equal(getPlayerHomeBoundary().kind,'circle');
});
test('protection precedes same-frame catch, scare windup, and active grab',()=>{
 for(const state of ['CHASING','SCARING','GRABBING'] as const){
  const ai=ready(19);ai.forceStateForTest(state);const previous=ai.getSnapshot();
  const snap=step(ai);assert.equal(snap.state,'RETREAT');assert.equal(snap.homeProtected,true);
  assert.equal(snap.grabInteraction.active,false);assert.equal(snap.grabCount,previous.grabCount);assert.equal(snap.attackEnabled,false);assert.equal(snap.collisionEnabled,false);assert.equal(snap.audioCue,null);
 }
 const outside=ready();outside.forceStateForTest('CHASING');assert.equal(step(outside,home.x+24).state,'GRABBING','normal catch outside protection remains');
});
test('three independent ghosts retreat, fade over two seconds, return to spawn, and respect exit buffer/cooldown',()=>{
 const ghosts=[ready(24,1),ready(26,2),ready(28,3)],original=ghosts.map(ai=>ai.getSnapshot());
 for(const ai of ghosts)ai.forceStateForTest('CHASING');
 for(let i=0;i<85;i++)for(const ai of ghosts){const snap=step(ai);assert.equal(snap.grabInteraction.active,false);assert.equal(snap.attackEnabled,false);assert.equal(snap.collisionEnabled,false);}
 for(let i=0;i<ghosts.length;i++){const snap=ghosts[i].getSnapshot();assert.equal(snap.state,'COOLDOWN');assert.equal(snap.opacity,0);assert.equal(snap.x,original[i].x);assert.equal(snap.z,original[i].z);}
 for(let i=0;i<400;i++)for(const ai of ghosts)assert.equal(step(ai,home.x+22.9).visible,false,'buffer prevents immediate boundary reattack');
 for(const ai of ghosts){assert.equal(step(ai,home.x+25).state,'SPAWNING');assert.equal(ai.getSnapshot().attackEnabled,false);for(let i=0;i<25;i++)step(ai,home.x+60);assert.equal(ai.getSnapshot().opacity,1);assert.equal(ai.getSnapshot().collisionEnabled,true);}
});
test('retreat never crosses blocked geometry or moves closer to protection, and pause does not advance fade',()=>{
 const point={x:home.x+19,z:home.z};stepHomeRetreat(point,home.x+18,home.z,.05,()=>false);assert.equal(point.x,home.x+19);
 for(let i=0;i<30;i++){const before=homeBoundaryDistance(point.x,point.z);stepHomeRetreat(point,home.x+18,home.z,.05,()=>true);assert.ok(homeBoundaryDistance(point.x,point.z)>=before);}
 const ai=ready();ai.forceStateForTest('CHASING');for(let i=0;i<24;i++)step(ai,home.x+18,.05,()=>false);
 assert.equal(ai.getSnapshot().state,'FADE_OUT');const initial=ai.getSnapshot();
 for(let i=0;i<100;i++)step(ai,home.x+18,0,()=>false);assert.equal(ai.getSnapshot().opacity,initial.opacity);
 for(let i=0;i<45;i++)step(ai,home.x+18,.05,()=>false);assert.equal(ai.getSnapshot().opacity,0);
 assert.equal(ai.getSnapshot().x,initial.x);assert.equal(ai.getSnapshot().z,initial.z);
});
test('dormant ghosts do not respawn inside protection, including a moved editor boundary over spawn',()=>{
 const ai=new GhostAiController(env());for(let i=0;i<400;i++)assert.equal(step(ai).visible,false);
 for(let i=0;i<30;i++)assert.equal(step(ai,home.x+22).visible,false);
 assert.equal(step(ai,home.x+24).state,'SPAWNING');
});
test('per-instance fade restores authored material state without changing shared materials or recompiling each frame',()=>{
 const shared=new MeshStandardMaterial({opacity:.8,transparent:true,depthWrite:false});const a=shared.clone(),b=shared.clone();rememberGhostMaterial(a);rememberGhostMaterial(b);
 applyGhostOpacity(a,.3);assert.equal(a.opacity,.24);assert.equal(shared.opacity,.8);assert.equal(b.opacity,.8);
 const version=a.version;applyGhostOpacity(a,.2);assert.equal(a.version,version);
 applyGhostOpacity(a,1);assert.equal(a.opacity,.8);assert.equal(a.transparent,true);assert.equal(a.depthWrite,false);
 shared.dispose();a.dispose();b.dispose();
});
