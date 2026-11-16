import test from 'node:test';
import assert from 'node:assert/strict';
import { createGhostRuntimeRegistry, registerGhostRuntime } from '../src/game/missions/ghostRuntimeRegistry.ts';
import { selectDevMarker, devMapProjection } from '../src/game/missions/ghostDevMapModel.ts';
import {belongsToAvatar,findSwordHand,createGhostSwordModel,swordGripRotation} from '../src/game/missions/ghostSwordAttachment.ts';
import {Box3,BoxGeometry,Group,Mesh,MeshBasicMaterial,Object3D,Quaternion,Vector3} from 'three';

test('runtime mount replacement cannot inherit data or be deleted/updated by the old mount', () => {
  let now = 10;
  const registry = createGhostRuntimeRegistry(() => now);
  const old = registry.register('ghost-1');
  old.report(1, 2, true, 'CHASING');
  const current = registry.register('ghost-1');
  assert.equal(registry.get('ghost-1'), undefined);
  current.report(8, 9, true, 'search', 'entity');
  old.report(-1, -1, true, 'STALE'); old.clear(); old.release();
  assert.equal(registry.get('ghost-1')?.x, 8);
  now += 1000;
  assert.equal(registry.get('ghost-1'), undefined);
  current.report(12, 13, false, 'PAUSED');
  assert.equal(registry.get('ghost-1')?.active, false);
  current.release();
  assert.equal(registry.get('ghost-1'), undefined);
});

test('all ghost IDs move independently; invalid values cannot poison fresh positions', () => {
  const registry = createGhostRuntimeRegistry(() => 1);
  const leases = [1,2,3].map(i => registry.register(`ghost-${i}`));
  leases.forEach((lease,i) => lease.report(i, i+1, true, 'CHASE'));
  leases[1].report(30, 40, true, 'return');
  leases[0].report(NaN, Infinity, true, 'INVALID');
  assert.deepEqual([1,2,3].map(i => registry.get(`ghost-${i}`)?.x), [0,30,2]);
  leases[1].clear();
  assert.equal(registry.get('ghost-2'), undefined);
  assert.equal(registry.get('ghost-3')?.state, 'CHASE');
});

test('fresh movement beats guard/spawn; stale data and unseeded guard never appear LIVE', () => {
  const guard = {x:99,z:99,mode:'guard',initialized:true,updatedAt:5};
  const runtime = {x:3,z:4,state:'CHASING',active:true,source:'ai' as const,updatedAt:5};
  assert.equal(selectDevMarker('ghost-1',runtime,guard,{x:0,z:0},10).x,3);
  assert.equal(selectDevMarker('ghost-1',{...runtime,active:false},guard,undefined,10).status,'INACTIVE');
  assert.equal(selectDevMarker('ghost-1',undefined,guard,undefined,10).source,'guard');
  const expired = selectDevMarker('ghost-1',runtime,guard,{x:0,z:0},1005);
  assert.equal(expired.source,'spawn'); assert.equal(expired.status,'UNAVAILABLE');
  assert.equal(selectDevMarker('ghost-1',undefined,{...guard,initialized:false},undefined,10).source,'unavailable');
});

test('map uses uniform X/Z scale; resizing SVG does not change world projection', () => {
  const p = devMapProjection([{x:-100,z:-50},{x:200,z:50}]);
  assert.ok(Math.abs((p.x(20)-p.x(0))-(p.y(20)-p.y(0)))<1e-10);
  assert.equal(p.x(50),160); assert.equal(p.y(0),120);
});

test('equipped sword resolves real GLB/procedural hand anchors and detects detached rigs',()=>{
  for(const name of ['mixamorigRightHand','equipment-right-hand','Hand_R']){
    const avatar=new Group(),rig=new Group(),hand=new Object3D();hand.name=name;
    avatar.add(rig);rig.add(hand);
    assert.equal(findSwordHand(avatar),hand);assert.equal(belongsToAvatar(hand,avatar),true);
    avatar.remove(rig);assert.equal(belongsToAvatar(hand,avatar),false);assert.equal(findSwordHand(avatar),null);
  }
});

test('held GLB hierarchy has a grip pivot and human-size blade without changing shared resources',()=>{
  const source=new Group(),geometry=new BoxGeometry(.1,1,.04),material=new MeshBasicMaterial();
  const mesh=new Mesh(geometry,material);mesh.position.y=.5;source.add(mesh);
  const before=new Box3().setFromObject(source),held=createGhostSwordModel(source,true),world=createGhostSwordModel(source,false);
  const heldBounds=new Box3().setFromObject(held),worldBounds=new Box3().setFromObject(world);
  assert.ok(Math.abs(heldBounds.max.y-heldBounds.min.y-.95)<1e-6);
  assert.ok(Math.abs(worldBounds.max.y-worldBounds.min.y-2.2)<1e-6);
  assert.ok(heldBounds.max.y<.2&&heldBounds.min.y<-.7);
  const cloned=held.children[0].children[0].children[0] as Mesh;
  assert.equal(cloned.geometry,geometry);assert.equal(cloned.material,material);
  assert.deepEqual(new Box3().setFromObject(source),before);
  geometry.dispose();material.dispose();
});

test('blade grip points forward/down on rotated rigs and then follows hand animation',()=>{
  const avatar=new Group(),hand=new Group(),weapon=new Group();avatar.rotation.y=.8;hand.rotation.set(.4,.2,-.6);
  avatar.add(hand);hand.add(weapon);weapon.quaternion.copy(swordGripRotation(hand,avatar));
  const direction=new Vector3(0,-1,0).applyQuaternion(weapon.getWorldQuaternion(new Quaternion()));
  const expected=new Vector3(0,-.35,-1).normalize().applyQuaternion(avatar.getWorldQuaternion(new Quaternion()));
  assert.ok(direction.distanceTo(expected)<1e-8);
  hand.rotation.x+=.5;
  const moved=new Vector3(0,-1,0).applyQuaternion(weapon.getWorldQuaternion(new Quaternion()));
  assert.ok(moved.distanceTo(direction)>.1);
});

test('saved mission progress survives load; unique encounters and live sword distances preserve progression', async () => {
  const key = 'mm-region-three-ghosts-mission-v1';
  const saved = {version:1,encountered:['ghost-1'],swordCollected:false,hp:{'ghost-1':100,'ghost-2':150,'ghost-3':200},completed:false};
  const storage = new Map([[key,JSON.stringify(saved)]]);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)}});
  const mission = await import('../src/game/missions/threeGhostsMission.ts');
  const guard = await import('../src/game/missions/ghostGuardCoordinator.ts');
  const {area5} = await import('../src/data/wards/myothar/area5.ts');
  const cars=await import('../src/game/carRide.ts');
  cars.enterCar(cars.driveableCars[0]);assert.equal(cars.currentCar(),null);
  assert.deepEqual(mission.getThreeGhostsProgress(),saved);
  assert.equal(mission.markGhostEncounter('ghost-1'),false);
  assert.equal(mission.collectGhostSword(),false);
  mission.markGhostEncounter('ghost-2'); mission.markGhostEncounter('ghost-3');
  assert.equal(guard.swordGuardClear(),false); // Never treat unavailable ghosts as safely distant.
  const leases = mission.GHOST_IDS.map(id => registerGhostRuntime(id));
  leases.forEach(lease=>lease.report(area5.pitch.x+21,area5.pitch.z,true,'chase'));
  assert.equal(guard.swordGuardClear(),true);
  leases[1].report(area5.pitch.x+20,area5.pitch.z,true,'return');
  assert.equal(guard.swordGuardClear(),false); // Boundary is strictly >20m.
  leases[1].report(area5.pitch.x+21,area5.pitch.z,false,'PAUSED');
  assert.equal(guard.swordGuardClear(),false);
  leases[1].report(area5.pitch.x+21,area5.pitch.z,true,'return');
  assert.equal(guard.swordGuardClear(),true);
  assert.equal(mission.tryAutoCollectGhostSword(3.21,0,0,0,true),false);
  assert.equal(mission.tryAutoCollectGhostSword(0,0,0,0,false),false);
  assert.equal(mission.tryAutoCollectGhostSword(0,0,0,0,true,false),false);
  assert.equal(mission.tryAutoCollectGhostSword(NaN,0,0,0,true),false);
  // No guard-clearance input or key/timer is required; touching the radius boundary collects once.
  assert.equal(mission.tryAutoCollectGhostSword(3.2,0,0,0,true),true);
  assert.equal(mission.tryAutoCollectGhostSword(0,0,0,0,true),false);
  for (const id of mission.GHOST_IDS) mission.damageMissionGhost(id,mission.GHOST_STATS[id].maxHp);
  assert.equal(mission.hasCompletedThreeGhostsMission(),true);
  cars.enterCar(cars.driveableCars[0]);assert.equal(cars.currentCar(),cars.driveableCars[0]);cars.parkCar();
  assert.equal(JSON.parse(storage.get(key)!).completed,true);
  leases.forEach(lease=>lease.release());
  delete (globalThis as {localStorage?:unknown}).localStorage;
});
