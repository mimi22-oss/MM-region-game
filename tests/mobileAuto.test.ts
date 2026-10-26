import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMobileInput,resetMobileInput,MobileGesture,touchDirection,type MobileDirection} from '../src/game/mobileInput.ts';
import {createBalloonRide,stepBalloon} from '../src/game/balloonRide.ts';
import {motorcycleRide,stepMotorcycle} from '../src/game/motorcycleRide.ts';

function setup(){const input=createMobileInput();return {input,g:new MobileGesture(input)};}
function hold(g:MobileGesture,ms=700){for(let elapsed=0;elapsed<ms;elapsed+=50)g.advanceTick(Math.min(50,ms-elapsed));}
function latch(g:MobileGesture,direction:MobileDirection='up'){g.downTick(1,direction,0,0);hold(g);g.up(1);}

test('all four short presses release normally, deliberate holds persist at normal speed',()=>{
 for(const direction of ['up','right','down','left'] as const){
  const {input,g}=setup();g.downTick(1,direction,0,0);hold(g,600);g.up(1);
  assert.equal(input.active,false);assert.equal(input.autoDirection,null);
  latch(g,direction);assert.equal(input.active,true);assert.equal(input.autoDirection,direction);assert.equal(input.moveScale,1);
  assert.equal(input.forward,touchDirection(direction).forward);assert.equal(input.right,touchDirection(direction).right);
 }
});
test('continuous hold accelerates gradually, caps at 2x, and direction changes preserve speed',()=>{
 const {input,g}=setup();g.downTick(1,'up',0,0);hold(g,1400);assert.equal(input.moveScale,1);
 hold(g,100);assert.equal(input.moveScale,1.25);hold(g,10000);assert.equal(input.moveScale,2);g.up(1);
 const session=input.session;g.downTick(2,'right',0,0);g.up(2);
 assert.equal(input.autoDirection,'right');assert.equal(input.moveScale,2);assert.ok(input.session>session);
 const rightSession=input.session;g.downTick(3,'right',0,0);g.up(3);
 assert.equal(input.moveScale,1);assert.equal(input.autoDirection,'right');assert.equal(input.session,rightSession);
 g.downTick(4,'right',0,0);hold(g);g.up(4);assert.equal(input.moveScale,1.25);
});
test('dragging takes manual control; looking around does not sprint or interrupt auto',()=>{
 const {input,g}=setup();latch(g);g.down(2,'right',100,0);g.move(2,105,4);
 assert.equal(input.autoDirection,'up');assert.equal(input.sprint,false);assert.equal(input.lookX,5);g.up(2);
 g.downTick(3,'left',0,0);g.move(3,20,20);assert.equal(input.autoDirection,null);g.up(3);assert.equal(input.active,false);
 latch(g);g.down(4,'left',0,0);g.move(4,20,0);assert.equal(input.autoDirection,null);assert.equal(input.right,1);g.up(4);assert.equal(input.active,false);
});
test('stop, cancellation and external reset cannot resurrect a held auto direction',()=>{
 for(const cancel of ['stop','clear','reset'] as const){
  const {input,g}=setup();g.downTick(1,'down',0,0);hold(g);
  if(cancel==='reset')resetMobileInput(input);else g[cancel]();
  hold(g,2000);g.up(1);assert.equal(input.autoDirection,null);assert.equal(input.active,false);assert.equal(input.moveScale,1);
  if(cancel!=='reset')assert.equal(input.stopRequested,true);
 }
});
test('pinch and same-side multi-touch stop auto through all pointer releases',()=>{
 for(const sameSide of [false,true]){
  const {input,g}=setup();latch(g);g.downTick(2,'up',0,0);g.down(3,sameSide?'left':'right',100,0,'up',sameSide);
  g.move(2,-20,0);g.move(3,120,0);assert.equal(input.autoDirection,null);assert.equal(input.stopRequested,true);
  g.up(2);g.up(3);hold(g,2000);assert.equal(input.active,false);assert.equal(input.stopRequested,true);
 }
});
test('assistive activation controls direction and speed without a pointer hold',()=>{
 const {input,g}=setup();g.activateTick('left');assert.equal(input.autoDirection,'left');assert.equal(input.moveScale,1);
 g.activateTick('left');assert.equal(input.moveScale,1.25);g.stop();assert.equal(input.active,false);
});
test('balloon speed increases within flight limits and stops safely at an obstacle',()=>{
 const flat=()=>0;
 function flight(scale:number){const b=createBalloonRide();b.riding=true;b.x=0;b.z=0;b.y=50;b.grounded=false;
  for(let i=0;i<300;i++)stepBalloon(b,1/60,{forward:0,right:1,lift:0,yaw:0,speedScale:scale},flat,flat,10000);
  return b;
 }
 const normal=flight(1),fast=flight(2);assert.ok(fast.x>normal.x*1.7);assert.ok(fast.vx<=34);
 const blocked=flight(2),wall=blocked.x+2;
 for(let i=0;i<180;i++)stepBalloon(blocked,1/60,{forward:0,right:1,lift:0,yaw:0,speedScale:2},flat,x=>x>wall?100:0,10000);
 assert.ok(blocked.x<=wall);assert.equal(blocked.blocked,true);
});
test('motorcycle auto speed respects configured speed limits and braking',()=>{
 const original={...motorcycleRide};
 try{
  Object.assign(motorcycleRide,{riding:true,speed:0,x:0,z:0,yaw:0,braking:false,accelerating:false,maxKmh:30});
  for(let i=0;i<600;i++)stepMotorcycle(1/60,1,0,false,false,()=>true,false,2);
  assert.ok(Math.abs(motorcycleRide.speed-30/3.6)<.01);
  for(let i=0;i<300;i++)stepMotorcycle(1/60,1,0,true,false,()=>true,false,2);
  assert.equal(motorcycleRide.speed,0);
 }finally{Object.assign(motorcycleRide,original);}
});
