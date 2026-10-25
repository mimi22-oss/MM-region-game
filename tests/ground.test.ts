import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
import {GroundSurface,motorcycleGroundPose,carGroundPose,sceneGround,registerGroundRegion,releaseGroundRegions} from '../src/game/groundSurface.ts';
import {batchStaticMeshes} from '../src/game/staticBatch.ts';
import {motorcycleRide as r,stepMotorcycle,parkMotorcycle,tryMount} from '../src/game/motorcycleRide.ts';

test('ground survives town detachment, a distant village and return without a frame delay',()=>{
 const scene=new Group(),town=new Group(),village=new Group();
 for(const [root,x,height] of [[town,0,.47],[village,1800,.36]] as const){
  const deck=new Mesh(new BoxGeometry(20,height,20),new MeshBasicMaterial());
  deck.position.set(x,height/2,0);deck.userData.walkable=true;root.add(deck);
 }
 scene.add(town);registerGroundRegion(scene,'town',town);registerGroundRegion(scene,'village',village);
 const ground=sceneGround(scene,0);
 for(const active of [village,town,village,town]){
  town.removeFromParent();village.removeFromParent();scene.add(active);
  for(const [x,expected] of [[0,.47],[1800,.36]]){
   assert.ok(Math.abs(sceneGround(scene,100).height(x,0)-expected)<1e-6);
   assert.ok(carGroundPose(x,0,0,1,(x,z)=>ground.height(x,z)).y>=expected);
   assert.ok(motorcycleGroundPose(x,0,0,(x,z)=>ground.height(x,z)).y>=expected);
  }
  assert.equal(sceneGround(town,100),ground,'portal actors use the world ground');
 }
 releaseGroundRegions(scene);
 assert.notEqual(sceneGround(scene,101),ground);
});

test('raised rotated deck, stairs and batched floors support actors but roofs do not',()=>{
 const root=new Group(),surface=new GroundSurface(),material=new MeshBasicMaterial();
 for(let i=0;i<3;i++){const m=new Mesh(new BoxGeometry(2,.2,2),material);m.position.set(i*3,.1+i*.2,0);m.rotation.y=.3;m.userData.walkable=true;root.add(m);}
 const roof=new Mesh(new BoxGeometry(30,1,30),material);roof.position.y=4;root.add(roof);
 surface.refresh(root);
 for(let i=0;i<3;i++)assert.ok(Math.abs(surface.height(i*3,0)-(.2+i*.2))<1e-6);
 const batch=batchStaticMeshes(root);surface.refresh(root);
 assert.ok(Math.abs(surface.height(3,0)-.4)<1e-6);
 assert.equal(surface.height(100,100),0);
 root.clear();surface.refresh(root);assert.equal(surface.height(3,0),0);batch.dispose();
});
test('motorcycle tires stay above both contacts on a step and on a slope',()=>{
 for(const height of [(x:number,z:number)=>z<0?.4:0,(x:number,z:number)=>2-z*.2]){
  const p=motorcycleGroundPose(0,0,0,height);
  const axle=p.y+.286*Math.cos(p.pitch);
  assert.ok(axle+Math.sin(p.pitch)*.635-.286>=height(0,-.635));
  assert.ok(axle-Math.sin(p.pitch)*.635-.286>=height(0,.635));
 }
});
test('cars of every bot size follow raised roads and all actors share the index',()=>{
 const scene=new Group();assert.equal(sceneGround(scene,0),sceneGround(scene,.1));
 for(const size of [.78,1,1.05]){
  const flat=carGroundPose(0,0,0,size,()=>.47);
  assert.ok(Math.abs(flat.y-.482)<1e-6);assert.equal(flat.pitch,0);assert.equal(flat.roll,0);
  const slope=carGroundPose(0,0,0,size,(x,z)=>2-z*.2+x*.1);
  assert.ok(slope.pitch>0&&slope.roll>0&&slope.y>2);
 }
});
test('driving caps speed, brakes before reversing, pauses and cannot cross an obstacle',()=>{
 Object.assign(r,{x:0,z:0,yaw:0,riding:true,speed:0,reverseWait:0,maxKmh:20});
 for(let i=0;i<100;i++)stepMotorcycle(.05,1,0,false,false,()=>true);
 assert.ok(r.speed<=20/3.6);assert.ok(r.z<0);
 stepMotorcycle(.05,-1,0,false,false,()=>true);assert.ok(r.speed>0);
 for(let i=0;i<100;i++)stepMotorcycle(.05,-1,0,false,false,()=>true);
 assert.ok(r.speed<0&&r.speed>=-5/3.6);
 const z=r.z;stepMotorcycle(.05,1,0,false,true,()=>true);assert.equal(r.z,z);assert.equal(r.speed,0);
 stepMotorcycle(.05,1,0,false,false,()=>false);assert.equal(r.z,z);assert.equal(r.speed,0);
 parkMotorcycle();assert.equal(tryMount(r.x,r.z,()=>true),false);
});
