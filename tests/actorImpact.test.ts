import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {rideLife,hitActor,hitWalkingContact,fallProgress,actorFallProgress,isWalkingRecoil,tickRideLife} from '../src/game/rideLife.ts';
import {walkWithContacts,createWalkingRecoil,stepWalkingRecoil,WALKING_RECOIL_DISTANCE} from '../src/game/walkingCollision.ts';
import {trafficColliders,trafficContact} from '../src/game/trafficColliders.ts';
import {closedSleeveGeometry,garmentGeometry,coveredStride} from '../src/game/characterClothing.ts';
import {driveableCars,carRide,enterCar,parkCar,stepCar,shiftCar} from '../src/game/carRide.ts';
import {treeBlocks} from '../src/game/collision.ts';
import {ward} from '../src/data/ward.ts';
import {kalayVillages} from '../src/data/villages/index.ts';
import {mangoTrees} from '../src/data/mangoTrees.ts';
import {tamarindTrees} from '../src/data/tamarindTrees.ts';
import {estatePalms} from '../src/data/farmEstate.ts';
beforeEach(()=>{Object.assign(rideLife,{lives:3,crashTime:0,invulnerable:0,contact:false,damage:0});trafficColliders.clear();parkCar();});

test('ordinary walls block without recoil, damage or recovery time, and allow walking along the edge',()=>{
 const p={x:0,z:0},contact=walkWithContacts(p,2,0,x=>x<.7,()=>null);
 assert.equal(contact,'obstacle');assert.ok(p.x<.7);assert.equal(hitWalkingContact(contact),false);
 assert.equal(rideLife.lives,3);assert.equal(rideLife.crashTime,0);assert.equal(isWalkingRecoil(),false);
 const beforeZ=p.z;walkWithContacts(p,1,1,x=>x<.7,()=>null);
 assert.ok(p.x<.7);assert.ok(Math.abs(p.z-beforeZ-1)<1e-9);
});

test('a tree contact triggers a short upright recoil without damage or repeated triggering',()=>{
 const p={x:0,z:0},contact=walkWithContacts(p,2,0,x=>x<.7,()=>null,x=>x>=.7);
 assert.equal(contact,'tree');assert.equal(hitWalkingContact(contact),true);assert.equal(rideLife.lives,3);assert.equal(rideLife.damage,0);
 assert.equal(hitWalkingContact(contact),false);tickRideLife(.2);assert.equal(isWalkingRecoil(),true);assert.equal(actorFallProgress(),0);
 tickRideLife(2);assert.equal(hitActor('walking'),false);tickRideLife(3);assert.equal(hitActor('walking'),false);
 rideLife.contact=false;assert.equal(hitActor('walking'),true);
});

test('tree classification covers town, village, orchard and estate trunks without classifying a house as a tree',()=>{
 const trees=[...ward.trees,...ward.farmTrees,...ward.largeTrees,...mangoTrees,...tamarindTrees,...estatePalms,
  ...kalayVillages.flatMap(v=>[...v.trees,...v.largeTrees,...v.farmTrees])];
 for(const tree of trees)assert.equal(treeBlocks(tree.x,tree.z),true);
 const house=ward.houses[0];assert.equal(treeBlocks(house.x,house.z),false);
 assert.equal(treeBlocks(ward.spawn.x,ward.spawn.z),false);
});

test('a car moving into a standing person is fatal, while a robot contact causes upright recoil',()=>{
 const robot=new Group(),car=new Group();robot.updateMatrixWorld(true);car.updateMatrixWorld(true);
 trafficColliders.set(robot,{width:.85,depth:.65,kind:'robot'});
 const at=(x:number,z:number)=>trafficContact(x,z,0,0,true);
 assert.equal(walkWithContacts({x:0,z:0},0,0,()=>true,at),'robot');
 assert.equal(hitActor('walking'),true);assert.equal(isWalkingRecoil(),true);assert.equal(actorFallProgress(),0);
 Object.assign(rideLife,{crashTime:0,invulnerable:0,contact:false});
 trafficColliders.set(car,{width:1.9,depth:3.7,kind:'car'});
 const contact=walkWithContacts({x:0,z:0},0,0,()=>true,at);
 assert.equal(contact,'car','car takes priority over overlapping robot');
 assert.equal(hitActor('walking',contact==='car'),true);assert.equal(rideLife.lives,0);assert.equal(fallProgress(.01,0),1);
 assert.equal(tickRideLife(1),false);assert.equal(tickRideLife(1),true);assert.equal(rideLife.lives,3);
});

test('recoil retreats one step opposite the impact direction at any frame rate',()=>{
 assert.equal(WALKING_RECOIL_DISTANCE,.64);
 for(const dt of [1/30,1/60,.05])for(const yaw of [0,Math.PI/2,-.7]){
  const p={x:4,z:7},recoil=createWalkingRecoil(yaw);
  for(let elapsed=0;elapsed<2;elapsed+=dt)stepWalkingRecoil(recoil,p,dt,()=>true,()=>null);
  assert.ok(Math.abs(p.x-4-Math.sin(yaw)*WALKING_RECOIL_DISTANCE)<1e-9);
  assert.ok(Math.abs(p.z-7-Math.cos(yaw)*WALKING_RECOIL_DISTANCE)<1e-9);
  assert.equal(recoil.finished,true);assert.equal(recoil.yaw,yaw);
 }
});

test('recoil pauses with zero time and stops before a thin wall or another actor',()=>{
 const p={x:0,z:0},recoil=createWalkingRecoil(0);
 stepWalkingRecoil(recoil,p,0,()=>true,()=>null);assert.deepEqual(p,{x:0,z:0});
 stepWalkingRecoil(recoil,p,2,(_x,z)=>z<.3||z>.45,()=>null);
 assert.ok(p.z<.3);assert.equal(recoil.finished,true);
 for(const kind of ['car','robot'] as const){
  const q={x:0,z:0};stepWalkingRecoil(createWalkingRecoil(0),q,2,()=>true,(_x,z)=>z>.3?kind:null);
  assert.ok(q.z<=.3);
 }
});

test('recoil can escape an initially overlapping robot but stops at the next robot',()=>{
 const p={x:0,z:0},recoil=createWalkingRecoil(0);
 stepWalkingRecoil(recoil,p,2,()=>true,(_x,z)=>z<.2||z>.4?'robot':null);
 assert.ok(p.z>=.2&&p.z<=.4);assert.equal(recoil.escapedRobot,true);assert.equal(recoil.finished,true);
});

test('car impacts cost exactly 1.5 lives per distinct collision and a second crash restarts',()=>{
 const car=driveableCars[0];Object.assign(car,{x:0,z:0,yaw:0,speed:0,model:'compact',transmission:'manual',wheelTravel:[0,0,0,0]});enterCar(car);shiftCar(1,true);car.speed=4;
 const impact=stepCar(.05,1,0,false,false,false,(_x,z)=>z> -1.95);
 assert.equal(impact.blocked,true);assert.ok(impact.speed>0);assert.equal(car.speed,0);
 assert.equal(hitActor('car'),true);assert.equal(rideLife.lives,1.5);assert.equal(rideLife.damage,1.5);
 for(let i=0;i<20;i++)assert.equal(hitActor('car'),false);
 tickRideLife(2);tickRideLife(3);rideLife.contact=false;
 assert.equal(hitActor('car'),true);assert.equal(rideLife.lives,0);assert.equal(tickRideLife(2),true);
 assert.equal(carRide.carId,car.id,'lifecycle reset is handled by Player, not by the damage calculator');
});

test('swept walking checks catch cars before entering them and stationary clear ground does not cause falls',()=>{
 const p={x:-3,z:0};const hit=walkWithContacts(p,8,0,()=>true,(x)=>Math.abs(x)<.5?'car':null);
 assert.equal(hit,'car');assert.ok(p.x<=-.5);
 assert.equal(walkWithContacts({x:0,z:0},0,0,()=>false,()=>null),null);
});

test('skirts have visible outer and inner surfaces all around, and covered steps stay inside their hem',()=>{
 const material=new MeshBasicMaterial();
 for(const kind of ['dress','longyi'] as const){
  const geometry=garmentGeometry(kind),mesh=new Mesh(geometry,material);
  for(let i=0;i<24;i++){
   const angle=i/24*Math.PI*2,out=new Vector3(Math.cos(angle),0,Math.sin(angle));
   const outerRay=new Raycaster(out.clone().multiplyScalar(.6).setY(.30),out.clone().negate());
   assert.ok(outerRay.intersectObject(mesh).length>0,`${kind} outside is opaque at angle ${angle}`);
   assert.ok(new Raycaster(new Vector3(0,.30,0),out).intersectObject(mesh).length>0,`${kind} inside is visible`);
   const stride=coveredStride(angle,1),ankleExcursion=.70*Math.abs(Math.sin(stride))+.052;
   assert.ok(ankleExcursion<.24,'lower legs remain inside even the narrower longyi');
  }
  geometry.dispose();
 }
 material.dispose();
});

test('motorcycle sleeves have solid caps at both ends',()=>{
 const geometry=closedSleeveGeometry([[0,0,0],[0,.5,0],[0,1,0]],.073),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material);
 const top=new Raycaster(new Vector3(0,1.2,0),new Vector3(0,-1,0)).intersectObject(mesh)[0];
 const bottom=new Raycaster(new Vector3(0,-.2,0),new Vector3(0,1,0)).intersectObject(mesh)[0];
 assert.ok(top&&Math.abs(top.point.y-1)<1e-6);assert.ok(bottom&&Math.abs(bottom.point.y)<1e-6);
 geometry.dispose();material.dispose();
});
