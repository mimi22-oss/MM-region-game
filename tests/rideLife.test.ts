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
