import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHumanJump,rememberJumpMomentum,startHumanJump,stepHumanJump,steerHumanJump} from '../src/game/humanJump.ts';
import {canStand} from '../src/game/collision.ts';
import {homeGates,homeGateBlocks,homeAccess} from '../src/game/homeAccess.ts';
import {estatePanels,estateFenceBlocks} from '../src/data/farmEstate.ts';
import {ward,toWorld} from '../src/data/ward.ts';
import {createMobileInput,resetMobileInput,MobileGesture} from '../src/game/mobileInput.ts';

const floor=()=>0,clear=()=>true;
function flight(speed=0,dt=1/60,direction=speed?1:0){
 const j=createHumanJump(),p={x:0,z:0};
 for(let i=0;i<60;i++)rememberJumpMomentum(j,speed,0,1/60);
 startHumanJump(j,p,0,direction,0);let apex=0;
 for(let t=0;t<3&&j.airborne;t+=dt){stepHumanJump(j,p,dt,floor,clear,clear);apex=Math.max(apex,j.y);}
 assert.equal(j.airborne,false);assert.equal(j.y,0);return {p,apex};
}
test('standing jump returns vertically; directional hop moves a short distance',()=>{
 const standing=flight(),hop=flight(0,1/60,1);
 assert.deepEqual(standing.p,{x:0,z:0});assert.ok(standing.apex>.9&&standing.apex<1.1);
 assert.ok(hop.p.x>1&&hop.p.x<2);
});
test('run-up gives a higher, longer jump in either direction, consistently across frame rates',()=>{
 const walk=flight(4),run=flight(9.5),back=flight(-9.5,1/60,-1);
 assert.ok(run.apex>2.8&&run.apex>walk.apex*2);
 assert.ok(run.p.x>10&&run.p.x>walk.p.x*3);
 assert.ok(Math.abs(back.p.x+run.p.x)<.001);
 assert.ok(Math.abs(flight(9.5,1/20).p.x-flight(9.5,1/120).p.x)<.1);
});
test('jump cannot repeat in the air; pause and release do not remove momentum',()=>{
 const j=createHumanJump(),p={x:0,z:0};j.vx=9.5;
 startHumanJump(j,p,4,1,0);assert.equal(startHumanJump(j,p,4,1,0),false);
 const before={...j};stepHumanJump(j,p,0,()=>4,clear,clear);assert.deepEqual(j,before);
 rememberJumpMomentum(j,0,0,1);assert.equal(j.vx,9.5);
 for(let i=0;i<150;i++)stepHumanJump(j,p,1/60,()=>4,clear,clear);
 assert.equal(j.y,4);assert.ok(p.x>10);
});
test('releasing run at take-off preserves velocity; a stopped person has no drift',()=>{
 const j=createHumanJump(),p={x:0,z:0};j.vx=8;
 startHumanJump(j,p,0,0,0);assert.equal(j.vx,8);
 j.airborne=false;rememberJumpMomentum(j,0,0,1/60);
 startHumanJump(j,p,0,0,0);assert.equal(j.vx,0);
});
test('air steering adds only a small drift and never changes vertical impulse',()=>{
 const j=createHumanJump(),p={x:0,z:0};startHumanJump(j,p,0,0,0);
 const impulse=j.vy;steerHumanJump(j,1,0,.2);
 assert.equal(j.vy,impulse);assert.ok(j.vx>.5&&j.vx<1);
 for(let i=0;i<100;i++)steerHumanJump(j,1,1,.05);
 assert.ok(Math.hypot(j.vx,j.vz)<=9.50001);
});
test('swept motion stops at a thin wall but clears a low fence only with sufficient height',()=>{
 for(const [height,passes] of [[100,false],[2.25,true]] as const){
  const j=createHumanJump(),p={x:0,z:0};j.vx=9.5;startHumanJump(j,p,0,1,0);
  for(let i=0;i<40;i++)stepHumanJump(j,p,.05,floor,(x,_z,y)=>!(x>4&&x<4.15&&y<height),(x)=>x<=4||x>=4.15);
  assert.equal(p.x>5,passes);assert.equal(j.airborne,false);
 }
});
test('cross a drain; a jump too short returns to the bank without hovering over water',()=>{
 for(const [speed,crosses] of [[9.5,true],[2,false]] as const){
  const j=createHumanJump(),p={x:0,z:0};j.vx=speed;startHumanJump(j,p,0,1,0);
  for(let i=0;i<150;i++)stepHumanJump(j,p,1/60,floor,clear,(x)=>x<1||x>4);
  assert.equal(p.x>4,crosses);assert.ok(p.x<1||p.x>4);assert.equal(j.y,0);
 }
});
test('closed blue gates and metal fences retain their real clearance heights',()=>{
 homeAccess.open.street=0;const gate=homeGates.street;
 assert.equal(homeGateBlocks(gate.x,gate.z),true);
 assert.equal(homeGateBlocks(gate.x,gate.z,.4,2.2),false);
 assert.equal(canStand(gate.x,gate.z,0,true),false);
 assert.equal(canStand(gate.x,gate.z,2.3,true),true);
 for(const raised of [false,true]){
  const panel=estatePanels.find(p=>p.raised===raised)!,p=toWorld(panel.u,panel.v);
  assert.equal(estateFenceBlocks(p.x,p.z,.4,2),true);
  assert.equal(estateFenceBlocks(p.x,p.z,.4,raised?3.2:2.3),false);
 }
 const house=ward.houses[0];assert.equal(canStand(house.x,house.z,4,true),false);
});
test('mobile jump works independently alongside joystick and sprint; reset clears it',()=>{
 const input=createMobileInput(),gesture=new MobileGesture(input);
 gesture.down(1,'left',0,0);gesture.move(1,0,-40);input.sprint=true;input.jump=true;
 assert.equal(input.forward,1);assert.equal(input.sprint,true);assert.equal(input.jump,true);
 resetMobileInput(input);assert.equal(input.jump,false);assert.equal(input.sprint,false);
});
