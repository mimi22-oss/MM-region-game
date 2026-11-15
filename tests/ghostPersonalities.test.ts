import test from 'node:test';
import assert from 'node:assert/strict';
import {GhostAiController} from '../src/game/ghostAi.ts';
import {createGhostPersonalityConfig,GHOST_PERSONALITIES,PLAYER_ON_FOOT_SPEED,ghostPersonalityForId} from '../src/game/ghostPersonalities.ts';
import {getPlayerDeathState,killPlayerFromGhost,requestPlayerRespawn,completePlayerRespawn,stepPlayerRespawnGrace,playerUnavailableForGhost,findProtectedRespawn} from '../src/game/playerDeath.ts';
const node={id:'spawn',role:'hiding' as const,x:0,z:0,localU:0,localV:0,links:[]};
const env={anchor:{x:0,z:0,localU:0,localV:0},waypoints:[node],waypointById:new Map([['spawn',node]]),hidingIds:['spawn'],patrolIds:['spawn'],roadCrossings:[],obstacleBoxes:[],treeColliders:[]};
function ready(id:keyof typeof GHOST_PERSONALITIES){const ai=new GhostAiController(env,createGhostPersonalityConfig(id),42,()=>.99);for(let i=0;i<25;i++)ai.step({dt:.05,activeBySchedule:true,playerX:100,playerZ:0,walkCheck:()=>true});return ai;}
test('IDs assign distinct independent personalities; detect radius and observation use initial tuning',()=>{
 assert.deepEqual([1,2,3].map(i=>ghostPersonalityForId(`ghost-${i}`)),['hunter','ambusher','stalker']);
 for(const id of ['hunter','ambusher','stalker'] as const){const ai=ready(id),p=GHOST_PERSONALITIES[id];
  let s=ai.step({dt:.05,activeBySchedule:true,playerX:p.detectRadiusM+1,playerZ:0,walkCheck:()=>true});assert.notEqual(s.state,'CHASING');
  for(let i=0;i<20;i++)s=ai.step({dt:.05,activeBySchedule:true,playerX:p.detectRadiusM-.1,playerZ:0,walkCheck:()=>true});
  assert.ok(s.chaseTriggerCount>=1,id);assert.ok(['CHASING','GRABBING'].includes(s.state),id);assert.ok(s.chaseSpeed<=p.chaseSpeedMps);
 }
 const a=ready('hunter'),b=ready('ambusher');a.forceStateForTest('CHASING');assert.notEqual(b.getSnapshot().state,'CHASING');
});
test('walking players can be caught, sprinting players escape, and valid close contact beats acceleration',()=>{
 for(const id of ['hunter','ambusher','stalker'] as const){
  const ai=ready(id);let x=GHOST_PERSONALITIES[id].detectRadiusM-.1,caught=false;
  for(let i=0;i<1100;i++){const s=ai.step({dt:.05,activeBySchedule:true,playerX:x,playerZ:0,walkCheck:()=>true});if(s.state==='GRABBING'){caught=true;break;}x+=PLAYER_ON_FOOT_SPEED.walk*.05;}
  assert.equal(caught,true,`${id} catches walker`);
  const runner=ready(id);x=GHOST_PERSONALITIES[id].detectRadiusM-.1;let escaped=false;
  for(let i=0;i<200;i++){const s=runner.step({dt:.05,activeBySchedule:true,playerX:x,playerZ:0,walkCheck:()=>true});assert.notEqual(s.state,'GRABBING');if(s.state==='RECOVERING')escaped=true;x+=PLAYER_ON_FOOT_SPEED.run*.05;}
  assert.equal(escaped,true,`${id} runner escapes`);
 }
 const close=ready('ambusher');const s=close.step({dt:.05,activeBySchedule:true,playerX:1,playerZ:0,walkCheck:()=>true});assert.equal(s.state,'GRABBING');assert.equal(s.x,0);
});
test('grab requires LOS and traversable corridor; ghost contact does not drag/move player or ghost',()=>{
 const ai=ready('hunter');ai.forceStateForTest('CHASING');
 let s=ai.step({dt:.05,activeBySchedule:true,playerX:1,playerZ:0,walkCheck:(x)=>x<.3||x>.7});assert.notEqual(s.state,'GRABBING');
 const valid=ready('hunter');s=valid.step({dt:.05,activeBySchedule:true,playerX:1,playerZ:0,walkCheck:()=>true});assert.equal(s.state,'GRABBING');
 const x=s.x,z=s.z;for(let i=0;i<10;i++)s=valid.step({dt:.05,activeBySchedule:true,playerX:1,playerZ:0,walkCheck:()=>true});assert.equal(s.x,x);assert.equal(s.z,z);
});
test('delta-time chase is comparable at 30/60Hz and never clamps/teleports back to patrol disk',()=>{
 const positions=[];
 for(const hz of [30,60]){const ai=ready('hunter');ai.forceStateForTest('CHASING');let s=ai.getSnapshot();for(let i=0;i<hz*2;i++)s=ai.step({dt:1/hz,activeBySchedule:true,playerX:20,playerZ:0,walkCheck:()=>true});positions.push(s.x);}
 assert.ok(Math.abs(positions[0]-positions[1])<.12);
});
test('lethal contact, safe-home veto, one death, respawn and grace restore the player lifecycle',()=>{
 assert.equal(killPlayerFromGhost('a',1,174.891,183.666),false);
 assert.equal(killPlayerFromGhost('a',1,0,0),true);assert.equal(getPlayerDeathState().phase,'dead');assert.equal(playerUnavailableForGhost(),true);
 assert.equal(killPlayerFromGhost('b',1,0,0),false);requestPlayerRespawn();assert.equal(getPlayerDeathState().phase,'respawning');
 assert.ok(findProtectedRespawn(()=>true));completePlayerRespawn();assert.equal(getPlayerDeathState().phase,'alive');assert.equal(playerUnavailableForGhost(),true);stepPlayerRespawnGrace(6);assert.equal(playerUnavailableForGhost(),false);
});

test('authored waypoint navigation routes around a wall or tree without crossing blocked geometry',()=>{
 const points=[['a',0,0,['b']],['b',0,3,['a','c']],['c',5,3,['b','d']],['d',5,0,['c']]] as const;
 const nodes=points.map(([id,x,z,links])=>({id,x,z,links:[...links],role:'hiding' as const,localU:x,localV:z}));
 for(const kind of ['wall','tree']){
  const route={...env,waypoints:nodes,waypointById:new Map(nodes.map(n=>[n.id,n])),hidingIds:['a'],patrolIds:['a'],obstacleBoxes:kind==='wall'?[{id:'wall',x:2.5,z:.5,halfW:.5,halfD:1.5,rotation:0,blocksSight:true}]:[],treeColliders:kind==='tree'?[{id:'tree',x:2.5,z:0,radius:.5}]:[]};
  const walk=(x:number,z:number)=>kind==='wall'?!(x>=2&&x<=3&&z>=-1&&z<=2):Math.hypot(x-2.5,z)>.9;
  const ai=new GhostAiController(route,createGhostPersonalityConfig('hunter'));
  for(let i=0;i<25;i++)ai.step({dt:.05,activeBySchedule:true,playerX:100,playerZ:0,walkCheck:walk});ai.forceStateForTest('CHASING');
  let caught=false;for(let i=0;i<300;i++){const s=ai.step({dt:.05,activeBySchedule:true,playerX:5,playerZ:0,walkCheck:walk});assert.equal(walk(s.x,s.z),true);if(s.state==='GRABBING'){caught=true;break;}}
  assert.equal(caught,true,kind);
 }
});
