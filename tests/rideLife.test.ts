import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {rideLife,hitRide,tickRideLife} from '../src/game/rideLife.ts';
import {trafficColliders,hitsTraffic} from '../src/game/trafficColliders.ts';

test('one collision costs one life, recovery protects the rider, third crash restarts',()=>{
 Object.assign(rideLife,{lives:3,crashTime:0,invulnerable:0,contact:false});
 for(let expected=2;expected>=0;expected--){
  assert.equal(hitRide(),true);assert.equal(rideLife.lives,expected);
  for(let i=0;i<50;i++)assert.equal(hitRide(),false);
  assert.equal(tickRideLife(1),false);assert.equal(rideLife.lives,expected);
  assert.equal(tickRideLife(1),expected===0);
  assert.equal(hitRide(),false);
  tickRideLife(3);
  if(expected>0){assert.equal(hitRide(),false);rideLife.contact=false;}
 }
 assert.equal(rideLife.lives,3);assert.equal(rideLife.crashTime,0);
});

test('car and robot contact follows rotated bounds, bike wheels and vertical separation',()=>{
 trafficColliders.clear();
 const car=new Group();car.position.set(4,.2,8);car.rotation.y=Math.PI/2;car.updateMatrixWorld(true);
 trafficColliders.set(car,{width:1.9,depth:3.7});
 assert.equal(hitsTraffic(4,8,0,.2),true);
 assert.equal(hitsTraffic(5.8,8,0,.2),true);
 assert.equal(hitsTraffic(4,10.5,0,.2),false);
 assert.equal(hitsTraffic(4,8,0,4),false);
 trafficColliders.delete(car);assert.equal(hitsTraffic(4,8,0,.2),false);
 const robot=new Group();robot.updateMatrixWorld(true);trafficColliders.set(robot,{width:.85,depth:.65});
 assert.equal(hitsTraffic(0,1,0,0),true);assert.equal(hitsTraffic(2,0,0,0),false);
 trafficColliders.clear();
});

import {motorcycleRide,setRideAccelerate,setRideBrake,stepMotorcycle,parkMotorcycle} from '../src/game/motorcycleRide.ts';

test('orbit accel button accelerates motorcycle, releasing decelerates, brake stops quickly',()=>{
 Object.assign(motorcycleRide,{x:0,z:0,yaw:0,riding:true,speed:0,maxKmh:20,accelerating:false,braking:false});
 setRideAccelerate(true);
 assert.equal(motorcycleRide.accelerating,true);
 for(let i=0;i<40;i++)stepMotorcycle(.05,0,0,false,false,()=>true);
 assert.ok(motorcycleRide.speed>3);
 assert.ok(motorcycleRide.speed<=20/3.6);
 const topSpeed=motorcycleRide.speed;
 setRideAccelerate(false);
 assert.equal(motorcycleRide.accelerating,false);
 for(let i=0;i<10;i++)stepMotorcycle(.05,0,0,false,false,()=>true);
 assert.ok(motorcycleRide.speed<topSpeed);
 setRideBrake(true);
 for(let i=0;i<20;i++)stepMotorcycle(.05,0,0,false,false,()=>true);
 assert.equal(motorcycleRide.speed,0);
 setRideBrake(false);
 parkMotorcycle();
 assert.equal(motorcycleRide.accelerating,false);
 assert.equal(motorcycleRide.braking,false);
});

test('driving alone caps at 20km/h cruise, holding accel boosts to 60km/h, releasing winds down',()=>{
 Object.assign(motorcycleRide,{x:0,z:0,yaw:0,riding:true,speed:0,maxKmh:60,accelerating:false,braking:false});
 // Drive alone with throttle = 1 (Up key or joystick circle)
 for(let i=0;i<60;i++)stepMotorcycle(.05,1,0,false,false,()=>true);
 // Cruising caps at 20 km/h
 assert.ok(Math.abs(motorcycleRide.speed - 20/3.6) < 0.2);

 // Now hold accel button / Shift together with drive
 setRideAccelerate(true);
 for(let i=0;i<60;i++)stepMotorcycle(.05,1,0,false,false,()=>true);
 // Speeds up well past 20 km/h towards 60 km/h
 assert.ok(motorcycleRide.speed > 45/3.6);
 assert.ok(motorcycleRide.speed <= 60/3.6);
 const highSpeed = motorcycleRide.speed;

 // Release accel button while still holding drive
 setRideAccelerate(false);
 for(let i=0;i<20;i++)stepMotorcycle(.05,1,0,false,false,()=>true);
 // Winds down from high speed back towards 20 km/h
 assert.ok(motorcycleRide.speed < highSpeed);
 for(let i=0;i<80;i++)stepMotorcycle(.05,1,0,false,false,()=>true);
 assert.ok(Math.abs(motorcycleRide.speed - 20/3.6) < 0.2);

 // Release drive completely -> coasts down to 0 km/h
 for(let i=0;i<50;i++)stepMotorcycle(.05,0,0,false,false,()=>true);
 assert.equal(motorcycleRide.speed, 0);
});
