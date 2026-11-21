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
test('a two-finger slide pans without zoom, even when the touch events arrive unevenly', () => {
 const {input,g}=setup();
 g.down(1,'right',280,180);g.down(2,'right',350,180);
 g.move(1,310,180,10);g.move(2,357,180,20);
 const initialPan=input.panX;
 assert.equal(initialPan,8.5,'intent detection applies only movement beyond the dead zone');
 g.move(1,328,185,30);g.move(2,377,185,40);
 g.up(1);g.up(2);
 assert.equal(input.panX,initialPan+19);
 assert.equal(input.panY,5);
 assert.equal(input.zoomFactor,1);
 assert.equal(input.lookX,0);
});
test('a pinch zooms without translating its moving midpoint', () => {
 const {input,g}=setup();
 g.down(1,'right',260,180);g.down(2,'right',340,180);
 g.move(1,245,186,10);g.move(2,355,186,20);
 g.move(1,234,191,30);g.move(2,360,191,40);
 g.up(1);g.up(2);
 assert.ok(input.zoomFactor<1);
 assert.equal(input.panX,0);
 assert.equal(input.panY,0);
});
test('anchored pinch waits for the second finger, and a lifted look keeps its last sample', () => {
 const {input,g}=setup();
 g.down(1,'right',260,180);g.down(2,'right',340,180);
 g.move(2,360,180,10);g.move(2,366,180,74);
 assert.equal(g.pinching,false);
 g.move(2,369,180,75);g.move(2,375,180,90);
 assert.ok(input.zoomFactor<1);
 g.clear();
 g.down(3,'right',300,200);g.move(3,322,208);g.up(3);
 assert.equal(input.lookX,22);
 assert.equal(input.lookY,8);
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

test('walking joystick locks an exact diagonal after three steady seconds and stops on short release',()=>{
 const {input,g}=setup();g.walkLockEnabled=true;
 g.down(1,'left',100,100);g.move(1,130,60);hold(g,2950);
 assert.equal(input.walkLocked,false);g.up(1);assert.equal(input.active,false);
 g.down(2,'left',100,100);g.move(2,130,60);hold(g,2950);
 assert.equal(input.walkLocked,false);hold(g,50);assert.equal(input.walkLocked,true);
 g.up(2);assert.equal(input.active,true);assert.equal(input.forward,.8);assert.equal(input.right,.6);
});

test('changing the held position restarts the timer, while small finger jitter is tolerated',()=>{
 const {input,g}=setup();g.walkLockEnabled=true;
 g.down(1,'left',100,100);g.move(1,100,60);hold(g,2900);
 g.move(1,140,100);hold(g,200);assert.equal(input.walkLocked,false);
 g.move(1,141,102);hold(g,2800);assert.equal(input.walkLocked,true);
});

test('locked steering persists, camera look preserves motion, and neutral stops immediately',()=>{
 const {input,g}=setup();g.walkLockEnabled=true;
 g.down(1,'left',100,100);g.move(1,100,60);hold(g,3000);g.up(1);
 for(const [x,y,forward,right] of [[140,100,0,1],[60,100,0,-1],[100,140,-1,0]]){
  g.down(2,'left',100,100);g.move(2,x,y);g.up(2);
  assert.equal(input.walkLocked,true);assert.equal(input.forward||0,forward);assert.equal(input.right||0,right);
 }
 const direction={forward:input.forward,right:input.right};
 g.down(3,'right',300,100);g.move(3,350,140);
 assert.deepEqual({forward:input.forward,right:input.right},direction);
 assert.equal(input.sprint,false);assert.equal(input.lookX,50);g.up(3);
 g.down(4,'left',100,100);g.move(4,100,100);
 assert.equal(input.walkLocked,false);assert.equal(input.active,false);assert.equal(input.stopRequested,true);
 g.up(4);hold(g,4000);assert.equal(input.active,false);
});

test('walking lock captures running and cannot survive stop, external reset, or cancelled gestures',()=>{
 for(const cancel of ['stop','clear','reset'] as const){
  const {input,g}=setup();g.walkLockEnabled=true;
  g.down(1,'left',100,100);g.move(1,100,60);input.sprint=true;hold(g,3000);
  input.sprint=false;assert.equal(input.lockedSprint,true);
  if(cancel==='reset')resetMobileInput(input);else g[cancel]();
  hold(g,4000);g.up(1);assert.equal(input.active,false);assert.equal(input.walkLocked,false);assert.equal(input.lockedSprint,false);
 }
});

test('two fingers can steer and look independently after walking locks',()=>{
 const {input,g}=setup();g.walkLockEnabled=true;
 g.down(1,'left',100,100);g.move(1,100,60);hold(g,3000);
 g.down(2,'right',300,100);g.move(1,140,100);g.move(2,340,130);
 assert.equal(g.pinching,false);assert.equal(input.walkLocked,true);
 assert.equal(input.right,1);assert.equal(input.lookX,40);
 g.up(1);g.up(2);assert.equal(input.active,true);
});

test('mobile 6-rule action and character behavior: release <3s, hold 3s lock, release persists, steer, center stop, and stop button',()=>{
 const {input,g}=setup();g.walkLockEnabled=true;

 // Rule 1: Joystick ဆွဲပြီး 3s မပြည့်ခင် လွှတ် -> ရပ်မယ်
 g.down(1,'left',100,100);
 g.move(1,100,60); // dragged up/forward
 hold(g,1500); // 1.5s
 assert.ok(g.getLockHoldProgress()>=0.49&&g.getLockHoldProgress()<=0.52,'lock hold progress is ~50% at 1.5s');
 assert.equal(input.walkLocked,false,'not locked before 3s');
 g.up(1);
 assert.equal(input.active,false,'stops on release before 3s');
 assert.equal(g.getLockHoldProgress(),0,'progress resets on release');

 // Rule 2: တစ်နေရာမှာ 3s ဖိထား -> Lock ဖြစ်မယ်
 g.down(2,'left',100,100);
 g.move(2,100,60);
 hold(g,1500);
 assert.ok(g.getLockHoldProgress()>=0.49&&g.getLockHoldProgress()<=0.52);
 hold(g,1500); // reaches 3000ms
 assert.equal(input.walkLocked,true,'locks after 3s continuous hold');
 assert.equal(g.getLockHoldProgress(),0,'progress resets to 0 once locked');

 // Rule 3: Lock ဖြစ်ပြီး လွှတ်လိုက် -> ဆက်သွားမယ်
 g.up(2);
 assert.equal(input.walkLocked,true,'remains locked after release');
 assert.equal(input.active,true,'continues moving after release');
 assert.equal(input.forward,1,'maintains forward vector');
 assert.equal(input.right,0);

 // Rule 4: Locked Joystick ကို ဘယ်/ညာ/အောက် ဆွဲ -> Direction ပြောင်းမယ်
 // Drag right
 g.down(3,'left',100,100);
 g.move(3,140,100); // right
 assert.equal(input.walkLocked,true);
 assert.equal(input.forward||0,0);
 assert.equal(input.right||0,1);
 g.up(3);
 assert.equal(input.walkLocked,true);
 assert.equal(input.active,true);
 assert.equal(input.right||0,1,'persists moving right after releasing steering');

 // Drag down
 g.down(4,'left',100,100);
 g.move(4,100,140); // down
 assert.equal(input.walkLocked,true);
 assert.equal(input.forward||0,-1);
 assert.equal(input.right||0,0);
 g.up(4);
 assert.equal(input.walkLocked,true);
 assert.equal(input.active,true);
 assert.equal(input.forward||0,-1,'persists moving down after releasing steering');

 // Drag left
 g.down(5,'left',100,100);
 g.move(5,60,100); // left
 assert.equal(input.walkLocked,true);
 assert.equal(input.forward||0,0);
 assert.equal(input.right||0,-1);
 g.up(5);
 assert.equal(input.walkLocked,true);
 assert.equal(input.active,true);
 assert.equal(input.right||0,-1,'persists moving left after releasing steering');

 // Rule 5: Joystick ကို အလယ်ပြန်ဆွဲ -> Unlock + Stop
 g.down(6,'left',100,100);
 g.move(6,102,101); // within 10px deadzone (center)
 assert.equal(input.walkLocked,false,'unlocks when dragged back to center');
 assert.equal(input.active,false,'stops when dragged back to center');
 assert.equal(input.stopRequested,true,'requests stop');
 g.up(6);
 assert.equal(input.walkLocked,false);
 assert.equal(input.active,false);

 // Rule 6: Stop Button နှိပ် -> ချက်ချင်းရပ်မယ်
 // Re-lock first
 g.down(7,'left',100,100);
 g.move(7,100,60);
 hold(g,3000);
 assert.equal(input.walkLocked,true);
 g.up(7);
 assert.equal(input.active,true);
 // Stop button triggers gesture.stop()
 g.stop();
 assert.equal(input.walkLocked,false,'stop button unlocks');
 assert.equal(input.active,false,'stop button stops active motion');
 assert.equal(input.stopRequested,true,'stop button sets stopRequested');
});
