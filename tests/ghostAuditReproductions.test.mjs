import test from 'node:test';
import assert from 'node:assert/strict';
import {GhostAiController} from '../artifacts/ghost-audit/snapshot/src/game/ghostAi.ts';
import {createGhostPersonalityConfig} from '../artifacts/ghost-audit/snapshot/src/game/ghostPersonalities.ts';
import {WorldSimulation} from '../artifacts/ghost-audit/snapshot/server/worldSimulation.ts';
const node={id:'a',role:'hiding',x:0,z:0,localU:0,localV:0,links:[]};
const env={anchor:{x:0,z:0,localU:0,localV:0},waypoints:[node],waypointById:new Map([['a',node]]),hidingIds:['a'],patrolIds:['a'],roadCrossings:[],obstacleBoxes:[],treeColliders:[]};
test('AUDIT REPRO: equal wall-time chase should not lose most displacement at 5Hz',()=>{
 const distances=[];for(const hz of [60,5]){const ai=new GhostAiController(env,createGhostPersonalityConfig('hunter'),1);ai.forceStateForTest('CHASING');for(let i=0;i<2*hz;i++)ai.step({dt:1/hz,activeBySchedule:true,playerX:20,playerZ:0,walkCheck:()=>true});distances.push(ai.getSnapshot().x);}
 assert.ok(distances[1]/distances[0]>.85,JSON.stringify({hz60:distances[0],hz5:distances[1],ratio:distances[1]/distances[0]}));
});
test('AUDIT REPRO: authoritative ghost must not damage across an impassable barrier',()=>{
 const sim=new WorldSimulation({walkability:{isPointWalkable:(x)=>!(x>35.6&&x<36),isHomeProtected:()=>false},combatEnabled:true});
 sim.addPlayer('audit',{schemaVersion:2,accountId:'audit',displayName:'Audit',role:'player',avatar:'mint',issuedAtMs:0,expiresAtMs:9999999999999},0);
 sim.placeEntityForServerTest('warehouse-ghost-1',35.149,36.176);sim.placeEntityForServerTest('audit',36.5,36.176);sim.stepTick(.05,10000);
 const snapshot=sim.buildSnapshotForPlayer('audit',sim.flushTickEvents(),10000);assert.equal(snapshot.self.hp,100,JSON.stringify({hp:snapshot.self.hp,events:snapshot.combatEvents}));
});
import {MultiplayerSession} from '../artifacts/ghost-audit/snapshot/src/multiplayer/session.ts';
test('AUDIT REPRO: 60Hz client movement throttled to network ticks must preserve elapsed movement time',()=>{
 const sim=new WorldSimulation({combatEnabled:false});sim.addPlayer('move-audit',{schemaVersion:2,accountId:'move-audit',displayName:'Move Audit',role:'player',avatar:'mint',issuedAtMs:0,expiresAtMs:9999999999999},0);sim.placeEntityForServerTest('move-audit',0,0);
 const session=new MultiplayerSession();session.snapshot={...session.getSnapshot(),mode:'authoritative-v2',status:'connected'};
 let sent=0;session.room={send(_type,envelope){sent++;sim.enqueueMoveIntent('move-audit',envelope.seq,envelope.payload);}};
 const originalNow=Date.now;let clock=10000;Date.now=()=>clock;
 try{for(let frame=0;frame<60;frame++){clock=10000+frame*1000/60;session.sendMoveIntent(1,0,0,false,1000/60);if(frame%3===2)sim.stepTick(.05,clock);}}
 finally{Date.now=originalNow;}
 const snapshot=sim.buildSnapshotForPlayer('move-audit',[],11000);assert.ok(Math.abs(snapshot.self.x-3.2)<.12,JSON.stringify({sent,serverDistance:snapshot.self.x,expectedClientDistance:3.2}));
});
test('AUDIT REPRO: blocked empty route must respect path replanning throttle',()=>{
 const ai=new GhostAiController({...env,obstacleBoxes:[{id:'wall',x:2.5,z:0,halfW:.5,halfD:2,rotation:0,blocksSight:true}]},createGhostPersonalityConfig('hunter'),1);ai.forceStateForTest('CHASING');let calls=0;const original=ai.setTargetWaypoint.bind(ai);ai.setTargetWaypoint=(...args)=>{calls++;return original(...args);};
 for(let i=0;i<20;i++)ai.step({dt:.05,activeBySchedule:true,playerX:10,playerZ:0,walkCheck:(x)=>x<2||x>3});
 assert.ok(calls<=5,JSON.stringify({elapsedSec:1,replanCalls:calls,expectedMaximum:5}));
});
