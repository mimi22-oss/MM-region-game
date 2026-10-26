import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBalloonRide,stepBalloon,balloonExitSpot,balloonLanding,balloonFlightFloor,BALLOON_LAUNCH,BALLOON_MAX_Y} from '../src/game/balloonRide.ts';
import {canStand} from '../src/game/collision.ts';
const flat=()=>0;
const idle={forward:0,right:0,lift:0,yaw:0};
function flying(){const b=createBalloonRide();b.riding=true;return b;}
test('the requested football-field launch point has room for the passenger basket and envelope',()=>{
 assert.equal(BALLOON_LAUNCH.x,123.789);assert.equal(BALLOON_LAUNCH.z,-37.022);
 assert.ok(balloonLanding(BALLOON_LAUNCH.x,BALLOON_LAUNCH.z,flat,canStand));
 assert.equal(balloonFlightFloor(BALLOON_LAUNCH.x,BALLOON_LAUNCH.z,flat,canStand,(x,z)=>canStand(x,z,0,true)),0);
});
test('lift takes off gradually, release holds altitude, and down settles gently on the ground',()=>{
 const b=flying(),x=b.x,z=b.z;
 for(let i=0;i<120;i++)stepBalloon(b,1/60,{...idle,lift:1},flat,flat,10000);
 assert.ok(b.y>10&&b.y<14);assert.equal(b.x,x);assert.equal(b.z,z);assert.equal(b.grounded,false);
 for(let i=0;i<180;i++)stepBalloon(b,1/60,idle,flat,flat,10000);
 const y=b.y;for(let i=0;i<120;i++)stepBalloon(b,1/60,idle,flat,flat,10000);assert.ok(Math.abs(y-b.y)<.01);
 for(let i=0;i<1500;i++)stepBalloon(b,1/60,{...idle,lift:-1},flat,flat,10000);
 assert.equal(b.y,0);assert.equal(b.grounded,true);assert.equal(b.vy,0);
});
test('camera-relative lateral/forward steering, pause, brake and map boundaries work at different frame rates',()=>{
 for(const dt of [1/20,1/60]){
  const b=flying();b.x=0;b.z=0;b.y=20;
  for(let t=0;t<2;t+=dt)stepBalloon(b,dt,{...idle,forward:1,right:1},flat,flat,10);
  assert.ok(b.x>0&&b.x<=10&&b.z<0&&b.z>=-10);
  const before={...b};stepBalloon(b,0,{...idle,lift:1},flat,flat,10);assert.deepEqual(b,before);
  for(let t=0;t<3;t+=dt)stepBalloon(b,dt,{...idle,brake:true},flat,flat,10);
  assert.ok(Math.hypot(b.vx,b.vz)<.01);
 }
});
test('low flight cannot cross a building; altitude allows overflight and safe descent respects its clearance',()=>{
 const obstacle=(x:number)=>x>2&&x<8?40:0,b=flying();b.x=0;b.z=0;b.y=5;
 for(let i=0;i<120;i++)stepBalloon(b,1/60,{...idle,right:1},flat,obstacle,100);
 assert.ok(b.x<=2);assert.equal(b.blocked,true);
 b.y=50;
 for(let i=0;i<90;i++)stepBalloon(b,1/60,{...idle,right:1},flat,obstacle,100);
 assert.ok(b.x>8);
 b.x=5;b.vx=0;b.y=42;
 for(let i=0;i<180;i++)stepBalloon(b,1/60,{...idle,lift:-1},flat,obstacle,100);
 assert.ok(b.y>=40);assert.equal(b.grounded,false);
});
test('no dismount in the air or on unsafe terrain, clear landing gives an outside exit spot',()=>{
 const b=flying();b.y=20;b.grounded=false;assert.equal(balloonExitSpot(b,flat,()=>true),null);
 b.y=0;b.grounded=true;assert.ok(balloonExitSpot(b,flat,()=>true));
 assert.equal(balloonExitSpot(b,flat,()=>false),null);
 assert.equal(balloonLanding(0,0,flat,()=>false),false);
 assert.equal(balloonLanding(0,0,(x)=>x>0?2:0,()=>true),false);
 assert.equal(balloonFlightFloor(0,0,flat,()=>false,()=>true),1.3);
 b.y=BALLOON_MAX_Y-.01;stepBalloon(b,.1,{...idle,lift:1},flat,flat,1000);assert.ok(b.y<=BALLOON_MAX_Y);
});
test('a newly detected obstacle does not teleport a grounded balloon up forty metres',()=>{
 const b=flying();b.x=0;b.z=0;
 stepBalloon(b,.05,idle,flat,()=>40,100);
 assert.equal(b.y,0);
});
