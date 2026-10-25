import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parkedCars } from '../src/data/cars.ts';
import { carRide, carInput, driveableCars, enterCar, parkCar, shiftCar, stepCar, nearbyCar, carExitSpot, gearSpeed, frontWheelAngle, wheelStepDistances, type CarGear } from '../src/game/carRide.ts';
import { canSummonCar, startCarSummon, stepCarSummon, updateSummonStand, carSummonState, resetCarSummon, TARGET_PARKING_U, TARGET_PARKING_V, SOUTH_YAW } from '../src/game/carSummon.ts';
import { farmhouse, toWorld } from '../src/data/ward.ts';
import { canStand } from '../src/game/collision.ts';
import { windshieldFrameGeometry, windshieldGeometry, cabinCurvePoint } from '../src/game/carWindshield.ts';
import { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } from 'three';
const car=driveableCars[0],free=()=>true;
beforeEach(()=>{parkCar();Object.assign(car,{...parkedCars[0],yaw:0,speed:0,distance:0,steering:0,wheelTravel:[0,0,0,0],mustLeave:false});});

test('the driver can see through the hollow windshield frame',()=>{
 const point=cabinCurvePoint(.14),normal=new Vector3(0,point.ny,point.nz);
 const ray=new Raycaster(new Vector3(.28,point.y,point.z).addScaledVector(normal,-1),normal);
 const material=new MeshBasicMaterial({side:DoubleSide}),frame=new Mesh(windshieldFrameGeometry(),material),glass=new Mesh(windshieldGeometry(.54,.02,.272,.046),material);
 assert.equal(ray.intersectObject(frame).length,0,'weatherstrip must not cover the view');
 assert.ok(ray.intersectObject(glass).length>0,'ray passes through the actual glass opening');
 frame.geometry.dispose();glass.geometry.dispose();material.dispose();
});

test('Ackermann front wheels and differential travel match the inside and outside turning radii',()=>{
 for(const steering of [-.5,.5]){
  const inside=Math.sign(steering),outside=-inside;
  assert.ok(Math.abs(frontWheelAngle(steering,inside))>Math.abs(frontWheelAngle(steering,outside)));
  const travel=wheelStepDistances(1,steering),insideIndex=inside===1?2:0,outsideIndex=2-insideIndex;
  assert.ok(travel[outsideIndex]>travel[insideIndex]);assert.ok(travel[outsideIndex+1]>travel[insideIndex+1]);
  assert.ok(wheelStepDistances(-1,steering).every(value=>value<0));
 }
});
test('steering has a finite rate, self-centers, reduces with speed and reverses yaw when backing',()=>{
 enterCar(car);shiftCar(1,true);stepCar(.05,0,1,false,false,false,free);
 assert.ok(car.steering>0&&car.steering<.1);assert.equal(car.yaw,0);
 const held=car.steering;stepCar(.05,0,0,false,false,false,free);assert.ok(car.steering<held);
 for(let i=0;i<30;i++)stepCar(.05,0,1,false,false,false,free);
 const lowSpeedAngle=car.steering;car.speed=20;
 for(let i=0;i<20;i++)stepCar(.05,0,1,false,true,false,free);
 assert.ok(car.steering<lowSpeedAngle);
 assert.ok(car.speed**2*Math.tan(car.steering)/2.08<5.6,'high-speed steering stays within the lateral-acceleration target');
 car.speed=0;car.yaw=0;shiftCar(-1,true);stepCar(.05,1,1,false,false,false,free);
 assert.ok(car.yaw>0,'right steering turns heading left while reversing');
});

test('side-door boarding checks the approach, and exit cannot immediately auto-board again',()=>{
 car.x=0;car.z=0;
 assert.equal(nearbyCar(1.7,0,free),car);
 assert.equal(nearbyCar(0,3,free),undefined);
 assert.equal(nearbyCar(1.7,0,()=>false),undefined);
 enterCar(car);car.speed=4;assert.equal(carExitSpot(free),null);
 car.speed=0;const spot=carExitSpot(free)!;assert.ok(spot);
 parkCar();assert.equal(nearbyCar(spot.x,spot.z,free),undefined);
 nearbyCar(10,0,free);assert.equal(nearbyCar(1.7,0,free),car);
});
test('neutral and depressed clutch disconnect the engine; gear changes need the clutch',()=>{
 enterCar(car);
 for(let i=0;i<30;i++)stepCar(.05,1,0,false,false,false,free);
 assert.equal(car.speed,0);assert.ok(carRide.rpm>1000);
 assert.equal(shiftCar(1,false),false);assert.equal(carRide.gear,0);
 assert.equal(shiftCar(1,true),true);
 for(let i=0;i<10;i++)stepCar(.05,1,0,false,true,false,free);
 assert.equal(car.speed,0);
 stepCar(.05,1,0,false,false,false,free);assert.ok(car.speed>0);
});
test('four gears cap speed, braking overrides gas, and direction changes need a stop',()=>{
 enterCar(car);
 for(const gear of [1,2,3,4] as CarGear[]){
  car.speed=0;shiftCar(gear,true);
  for(let i=0;i<500;i++)stepCar(.05,1,0,false,false,false,free);
  assert.ok(Math.abs(car.speed-gearSpeed(gear))<1e-6);
 }
 assert.equal(shiftCar(-1,true),false);assert.equal(shiftCar(1,true),false);
 const speed=car.speed;stepCar(.05,1,0,true,false,false,free);assert.ok(car.speed<speed);
 for(let i=0;i<100;i++)stepCar(.05,1,0,true,false,false,free);
 assert.equal(car.speed,0);assert.equal(shiftCar(-1,true),true);
 stepCar(.05,1,0,false,false,false,free);assert.ok(car.speed<0);
 assert.equal(shiftCar(1,true),true,'very low reverse speed is safe to change');
});
test('whole-car swept footprint stops at a narrow barrier, pauses, and steers only while moving',()=>{
 car.x=0;car.z=0;enterCar(car);shiftCar(4,true);car.speed=20;
 stepCar(.05,1,0,false,false,false,(_x,z)=>Math.abs(z+2.3)>.1);
 assert.equal(car.speed,0);assert.ok(car.z>-0.4,'front bumper cannot tunnel through the barrier');
 const yaw=car.yaw;stepCar(.05,0,1,true,false,false,free);assert.equal(car.yaw,yaw);
 stepCar(.05,1,1,false,false,false,free);assert.ok(car.yaw<yaw);
 const x=car.x,z=car.z;stepCar(.05,1,1,false,false,true,free);assert.equal(car.speed,0);assert.equal(car.x,x);assert.equal(car.z,z);
});
test('parked-car collision follows the driven position and does not block its own driver',()=>{
 Object.assign(car,{...parkedCars[0],yaw:parkedCars[0].rotation});
 assert.equal(canStand(car.x,car.z),false);
 enterCar(car);assert.equal(canStand(car.x,car.z),true);
 const old={x:car.x,z:car.z};car.x+=5;car.z+=5;parkCar();
 assert.equal(canStand(old.x,old.z),true);
 assert.equal(canStand(car.x,car.z),false);
 assert.equal(carInput.throttle,false);
});

test('car summon appears only after standing still for 3 seconds in the summon zone and drives car to main road front facing South',()=>{
 resetCarSummon();
 // Inside farmhouse (lx=0, lz=0): cannot summon
 const inside = toWorld(-72, 270);
 assert.equal(canSummonCar(inside.x, inside.z, false, false), false);

 // Arriving at spot (standTimer = 0): should NOT show immediately upon stopping
 assert.equal(canSummonCar(185.429, 196.050, false, false), false);

 // Standing for 1.5 seconds: still less than 3 seconds, should NOT show yet
 updateSummonStand(1.5, 185.429, 196.050, false, false, false);
 assert.equal(canSummonCar(185.429, 196.050, false, false), false);

 // Walking while in the zone: resets timer
 updateSummonStand(0.1, 185.429, 196.050, true, false, false);
 assert.equal(carSummonState.standTimer, 0);

 // Standing still for 3.1 seconds: reaches 3 seconds, now it shows!
 updateSummonStand(3.1, 185.429, 196.050, false, false, false);
 assert.equal(canSummonCar(185.429, 196.050, false, false), true);

 // Driving or riding: cannot summon
 assert.equal(canSummonCar(185.429, 196.050, true, false), false);
 assert.equal(canSummonCar(185.429, 196.050, false, true), false);

 // Start summon: status becomes driving
 assert.equal(startCarSummon(), true);
 assert.equal(carSummonState.status, 'driving');

 // Advance simulation until car arrives
 for (let i = 0; i < 150; i++) {
  stepCarSummon(0.05, () => 0);
 }
 assert.equal(carSummonState.status, 'arrived');
 assert.equal(car.speed, 0);

 // Target parking position check:
 const target = toWorld(TARGET_PARKING_U, TARGET_PARKING_V);
 assert.ok(Math.hypot(car.x - target.x, car.z - target.z) < 0.1, 'car is parked in front of main road');
 assert.ok(Math.abs(car.yaw - SOUTH_YAW) < 1e-4, 'car is facing South');
 resetCarSummon();
});
