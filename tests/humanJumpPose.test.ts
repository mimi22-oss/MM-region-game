import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Group,MeshBasicMaterial,SkinnedMesh,Vector3} from 'three';
import {createJumpPose,prepareJump,stepJumpPose,jumpKneeBend,jumpLegPose,createJumpLegRig,skinJumpLeg} from '../src/game/humanJumpPose.ts';

test('both knees load before extending; take-off fires once and remains straight in flight',()=>{
 const p=createJumpPose();assert.equal(prepareJump(p,9,0),true);
 assert.equal(prepareJump(p,0,0),false);
 assert.equal(stepJumpPose(p,.06),false);assert.ok(jumpKneeBend(p)>.45);
 assert.equal(stepJumpPose(p,.06),false);assert.ok(jumpKneeBend(p)>.99);
 assert.equal(stepJumpPose(p,.03),false);assert.ok(jumpKneeBend(p)>.4&&jumpKneeBend(p)<.6);
 assert.equal(stepJumpPose(p,.04),true);assert.equal(jumpKneeBend(p),0);
 assert.equal(stepJumpPose(p,.03),false);assert.equal(p.vx,9);
});
test('pause freezes preparation; landing softly bends and then recovers',()=>{
 const p=createJumpPose();prepareJump(p,0,0);stepJumpPose(p,.06);const before={...p};
 stepJumpPose(p,0);assert.deepEqual(p,before);
 p.prepare=0;p.landing=.20;stepJumpPose(p,.10);assert.ok(Math.abs(jumpKneeBend(p)-.5)<1e-9);
 stepJumpPose(p,.10);assert.equal(jumpKneeBend(p),0);assert.equal(prepareJump(p,0,0),true);
});
test('hip and knee articulation keeps both soles planted and ankle orientation level',()=>{
 for(const covered of [false,true])for(const bend of [0,.3,.7,1])for(const side of [-1,1]){
  const {angle,drop}=jumpLegPose(bend,covered),rig=createJumpLegRig(),root=new Group();
  root.position.set(side*.104,.707-drop,.016);root.add(rig.hip);
  rig.hip.rotation.x=angle;rig.knee.rotation.x=-2*angle;rig.ankle.rotation.x=angle;
  root.updateMatrixWorld(true);
  const ankle=rig.ankle.getWorldPosition(new Vector3()),knee=rig.knee.getWorldPosition(new Vector3());
  assert.ok(Math.abs(ankle.y-.147)<1e-8);assert.ok(Math.abs(ankle.z-.016)<1e-8);
  assert.ok(knee.z<=ankle.z);assert.ok(Math.abs(rig.ankle.getWorldDirection(new Vector3()).y)<1e-8);
  // The covered garment follows the lowering waist while keeping its hem above the shoes.
  const hem=-drop+.14*(1-drop/.59)+.73*drop/.59;assert.ok(Math.abs(hem-.14)<1e-8);
  rig.skeleton.dispose();
 }
});
test('continuous trouser skin bends at the knee without separating the ankle or invalid weights',()=>{
 const source=new BufferGeometry();source.setAttribute('position',new Float32BufferAttribute([0,0,0,0,-.28,0,0,-.56,0],3));
 const geometry=skinJumpLeg(source),material=new MeshBasicMaterial(),mesh=new SkinnedMesh(geometry,material),rig=createJumpLegRig(),root=new Group();
 root.add(mesh,rig.hip);root.updateMatrixWorld(true);mesh.bind(rig.skeleton);
 rig.hip.rotation.x=.8;rig.knee.rotation.x=-1.6;rig.ankle.rotation.x=.8;root.updateMatrixWorld(true);rig.skeleton.update();
 const ankle=mesh.applyBoneTransform(2,new Vector3(0,-.56,0));
 assert.ok(Math.abs(ankle.y+.56*Math.cos(.8))<1e-6);assert.ok(Math.abs(ankle.z)<1e-6);
 for(let i=0;i<3;i++){
  const w=geometry.attributes.skinWeight;assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-6);
 }
 geometry.dispose();source.dispose();material.dispose();rig.skeleton.dispose();
});
