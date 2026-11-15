import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Raycaster, Vector3, Scene, PointLight } from 'three';
import {registerSceneFestivalLightPool,unregisterSceneFestivalLightPool,getSceneFestivalLightPool,subscribeSceneFestivalLightPool} from '../src/game/pointLightPool.ts';
import { createCameraObstructionQuery } from '../src/game/cameraObstruction.ts';
import { buildBalloonShowDescriptors, evaluateBalloonTransform, evaluateBalloonTransformInto, selectFestivalZonesNearFocus } from '../src/festivals/festivalSimulation.ts';

const zones = [0, 1, 2].map(i => ({id:`zone-${i}`,name:'test',myanmarName:'test',x:i*3000,z:0,groundY:0,spreadRadius:120,palette:['#ffa000']}));
test('light pool replacement notifies consumers and old cleanup cannot erase the new pool',()=>{
  const scene=new Scene(),old=[new PointLight()],next=[new PointLight(),new PointLight()];let notifications=0;
  const unsubscribe=subscribeSceneFestivalLightPool(scene,()=>notifications++);
  registerSceneFestivalLightPool(scene,old);registerSceneFestivalLightPool(scene,next);
  unregisterSceneFestivalLightPool(scene,old);
  assert.equal(getSceneFestivalLightPool(scene),next);assert.equal(notifications,2);
  unregisterSceneFestivalLightPool(scene,next);assert.equal(getSceneFestivalLightPool(scene),undefined);assert.equal(notifications,3);
  unsubscribe();registerSceneFestivalLightPool(scene,[]);assert.equal(notifications,3);
});
test('zone culling and ordering preserve deterministic trajectories, including quality prefix', () => {
  const all=buildBalloonShowDescriptors(zones,40);
  const subset=buildBalloonShowDescriptors([zones[2],zones[0]],20);
  for(const zone of [zones[0],zones[2]]) {
    const expected=all.filter(d=>d.zoneId===zone.id);
    const actual=subset.filter(d=>d.zoneId===zone.id);
    for(let i=0;i<actual.length;i++) for(const t of [0,73.25,456]) {
      assert.deepEqual(evaluateBalloonTransform(actual[i],t),evaluateBalloonTransform(expected[i],t));
    }
  }
  assert.deepEqual(selectFestivalZonesNearFocus(zones,0,0,2,750).map(z=>z.id),['zone-0']);
  assert.deepEqual(selectFestivalZonesNearFocus(zones,3000,0,1,750).map(z=>z.id),['zone-1']);
  assert.equal(selectFestivalZonesNearFocus(zones,15000,0,2,750).length,0);
});
test('in-place trajectories match the allocating evaluator and reuse output', () => {
  const [descriptor]=buildBalloonShowDescriptors(zones,1);
  const output={x:0,y:0,z:0,rx:0,ry:0,rz:0,scale:0,progress:0};
  for(const t of [-10,0,16,9000]) {
    assert.equal(evaluateBalloonTransformInto(descriptor,t,output),output);
    assert.deepEqual(output,evaluateBalloonTransform(descriptor,t));
  }
});
test('camera query prunes avatar, hidden descendants, ridden vehicles and decoration before raycasts', () => {
  const root=new Group(),avatar=new Group(),hidden=new Group(),car=new Group(),balloon=new Group(),decor=new Group();
  root.add(avatar,hidden,car,balloon,decor);
  hidden.visible=false;car.userData.carId='own';balloon.userData.passengerBalloon=true;decor.userData.cameraIgnore=true;
  for(const parent of [avatar,hidden,car,balloon,decor]) {
    const trap=new Mesh();trap.raycast=()=>{assert.fail('excluded mesh must never be raycast');};parent.add(trap);
  }
  const wall=new Mesh(new BoxGeometry(2,2,1),new MeshBasicMaterial());wall.position.z=-5;root.add(wall);root.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(),new Vector3(0,0,-1),0,10);
  const find=createCameraObstructionQuery();
  assert.equal(find(ray,root,avatar,true,'own')?.object,wall);
  assert.equal(find(ray,root,avatar,true,'own')?.distance,4.5);
  wall.visible=false;assert.equal(find(ray,root,avatar,true,'own'),undefined);
  wall.geometry.dispose();(wall.material as MeshBasicMaterial).dispose();
});
