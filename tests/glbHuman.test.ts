import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationClip,Box3,QuaternionKeyframeTrack,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createGlbHuman,selectBoyClip} from '../src/game/glbHuman.ts';
import {
 DEFAULT_CHARACTER_RENDERER,
 getCharacterRendererMode,
 setCharacterRendererMode,
 shouldUseGlbCharacter,
 toggleCharacterRendererMode,
} from '../src/game/characterRenderer.ts';

async function parseCharacterGlb(relativePath:string){
 const bytes=await readFile(new URL(relativePath,import.meta.url));
 const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 // Test the original mesh and skin in Node; embedded images are decoded by the browser.
 delete json.images;delete json.textures;delete json.samplers;delete json.materials;
 for(const mesh of json.meshes??[])for(const primitive of mesh.primitives??[])delete primitive.material;
 const encoded=Buffer.from(JSON.stringify(json).padEnd(Math.ceil(JSON.stringify(json).length/4)*4,' '));
 const bin=bytes.subarray(20+jsonLength),buffer=Buffer.alloc(20+encoded.length+bin.length);
 bytes.copy(buffer,0,0,12);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(encoded.length,12);buffer.writeUInt32LE(0x4e4f534a,16);encoded.copy(buffer,20);bin.copy(buffer,20+encoded.length);
 return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
}

for(const preset of ['boy','girl'] as const){
 test(`${preset} GLB normalizes at the soles and poses independently for gameplay`,async()=>{
  const model=await parseCharacterGlb(`../src/assets/${preset}.glb`);
  assert.equal(model.animations.length,0,'supplied files use pure TypeScript skeleton poses');
  const a=createGlbHuman(model.scene),b=createGlbHuman(model.scene);
  const initial=new Box3().setFromObject(a.root);
  assert.ok(Math.abs(initial.min.y)<1e-5);
  assert.ok(Math.abs(initial.getSize(new Vector3()).y-1.8)<1e-5);
  const skins:SkinnedMesh[]=[];a.object.traverse(o=>{if(o instanceof SkinnedMesh)skins.push(o);});
  assert.ok(skins.length>0);
  const original=b.object.getObjectByName('mixamorigLeftUpLeg')!.quaternion.clone();
  a.update({speed:2,distance:.3});
  assert.ok(!a.object.getObjectByName('mixamorigLeftUpLeg')!.quaternion.equals(original));
  assert.ok(b.object.getObjectByName('mixamorigLeftUpLeg')!.quaternion.equals(original));
  for(const pose of ['idle','walk','run','jump','bike_idle','bike_ride','car']){
   const speed=pose==='walk'?3.8:pose==='run'?8.8:pose==='bike_ride'?7.5:0;
   const riding=pose==='bike_idle'||pose==='bike_ride';
   const driving=pose==='car'?{wheelAngle:.4,interior:false,brake:true,clutch:false,throttle:false}:undefined;
   a.update({speed,distance:.4,airborne:pose==='jump',jumpBend:pose==='jump'?.8:0,jumpVelocity:pose==='jump'?3:0},riding,driving,.016);
   a.root.updateMatrixWorld(true);
   const bounds=new Box3().setFromObject(a.root);
   assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),pose);
   if(riding){
    const hips=a.object.getObjectByName('mixamorigHips')!.getWorldPosition(new Vector3());
    assert.ok(hips.y>.82&&hips.z>.02,`${preset} sits squarely on motorcycle seat cushion (${hips.x.toFixed(3)}, ${hips.y.toFixed(3)}, ${hips.z.toFixed(3)})`);
    for(const [side,s] of [['Left',-1],['Right',1]] as const){
     const mid1=a.object.getObjectByName(`mixamorig${side}HandMiddle1`)!.getWorldPosition(new Vector3());
     const mid2=a.object.getObjectByName(`mixamorig${side}HandMiddle2`)!.getWorldPosition(new Vector3());
     const mid3=a.object.getObjectByName(`mixamorig${side}HandMiddle3`)!.getWorldPosition(new Vector3());
     assert.ok(mid3.y<mid1.y-0.02,`${preset} ${side} fingers curl downward around handlebar grip`);
     const gripFront=mid1.clone().add(mid2).multiplyScalar(.5);
     const targetFront=new Vector3(s*.270,.834,-.514);
     assert.ok(gripFront.distanceTo(targetFront)<.018,`${preset} ${side} hand wraps around front of motorcycle handlebar (${gripFront.distanceTo(targetFront).toFixed(4)}m)`);
    }
   }
  }
  a.dispose();b.dispose();
 });
}

test('boy.glb matches boy t post.glb and TypeScript animation controller drives Idle, Walk, Run, Jump, Sit, and Motorcycle Ride smoothly',async()=>{
 const [sourceBytes,assetBoyBytes]=await Promise.all([
  readFile(new URL('../boy t post.glb',import.meta.url)),
  readFile(new URL('../src/assets/boy.glb',import.meta.url)),
 ]);
 assert.equal(Buffer.compare(sourceBytes,assetBoyBytes),0,'src/assets/boy.glb matches boy t post.glb');

 assert.equal(selectBoyClip({speed:0,distance:0}),'idle');
 assert.equal(selectBoyClip({speed:4,distance:1}),'walk');
 assert.equal(selectBoyClip({speed:9.5,distance:2}),'run');
 assert.equal(selectBoyClip({speed:0,distance:0,airborne:true,jumpBend:.6}),'jump');
 assert.equal(selectBoyClip({speed:0,distance:0},false,true),'sit');
 assert.equal(selectBoyClip({speed:0,distance:0},true,false),'motorcycle_idle');
 assert.equal(selectBoyClip({speed:5,distance:1},true,false),'motorcycle_ride');

 const model=await parseCharacterGlb('../src/assets/boy.glb');
 const avatar=createGlbHuman(model.scene);
 const tPoseHand=avatar.object.getObjectByName('mixamorigLeftHand')!.getWorldPosition(new Vector3());

 // 1. Idle lowers arms from T-pose to natural side hang and curls fingers
 avatar.update({speed:0,distance:0});
 avatar.root.updateMatrixWorld(true);
 assert.equal(avatar.clip(),'idle');
 const idleHand=avatar.object.getObjectByName('mixamorigLeftHand')!.getWorldPosition(new Vector3());
 assert.ok(idleHand.y<tPoseHand.y-.2,'idle lowers arms naturally from T-pose');
 assert.ok(Math.abs(idleHand.x)<Math.abs(tPoseHand.x)-.15,'idle brings hands close to body sides');

 // 2. Walk vs Run: Run has larger thigh drive and higher bent-elbow forward hand pump (Right arm swings forward with Left leg)
 avatar.update({speed:3.8,distance:.37});
 avatar.root.updateMatrixWorld(true);
 assert.equal(avatar.clip(),'walk');
 const walkKneeZ=avatar.object.getObjectByName('mixamorigLeftLeg')!.getWorldPosition(new Vector3()).z;
 const walkHandY=avatar.object.getObjectByName('mixamorigRightHand')!.getWorldPosition(new Vector3()).y;

 avatar.update({speed:9.2,distance:.55});
 avatar.root.updateMatrixWorld(true);
 assert.equal(avatar.clip(),'run');
 const runKneeZ=avatar.object.getObjectByName('mixamorigLeftLeg')!.getWorldPosition(new Vector3()).z;
 const runHandY=avatar.object.getObjectByName('mixamorigRightHand')!.getWorldPosition(new Vector3()).y;
 assert.ok(runKneeZ<walkKneeZ,'run drives front knee further forward (-Z) than walk');
 assert.ok(runHandY>walkHandY,'run bends elbows higher for athletic arm pump');

 // 3. Smooth frame-by-frame damping transitions without discontinuities
 const damped=createGlbHuman(model.scene);
 for(let i=0;i<15;i++){
  damped.update({speed:8.5,distance:i*.12},false,undefined,.016);
 }
 assert.equal(damped.clip(),'run');
 avatar.dispose();
 damped.dispose();
});
test('characterRenderer defaults to glb for boy/girl and toggles cleanly between glb and code character',()=>{
 assert.equal(DEFAULT_CHARACTER_RENDERER,'glb');
 assert.equal(getCharacterRendererMode(),'glb');
 assert.equal(shouldUseGlbCharacter('boy'),true);
 assert.equal(shouldUseGlbCharacter('girl'),true);
 assert.equal(shouldUseGlbCharacter('father'),false);
 assert.equal(toggleCharacterRendererMode(),'code');
 assert.equal(shouldUseGlbCharacter('boy'),false);
 assert.equal(shouldUseGlbCharacter('girl'),false);
 assert.equal(setCharacterRendererMode('glb'),'glb');
 assert.equal(shouldUseGlbCharacter('boy'),true);
});
test('GLB boy and girl characters blink naturally in standing and seated animations',async()=>{
 for(const preset of ['boy','girl'] as const){
  const model=await parseCharacterGlb(`../src/assets/${preset}.glb`);
  const avatar=createGlbHuman(model.scene,{preset});
  assert.equal(avatar.blink(),0,'eyes start open');

  let peak=0;
  let reopened=false;
  for(let i=0;i<300;i++){
   avatar.update({speed:0,distance:0},false,undefined,.016);
   const v=avatar.blink();
   assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
   if(v>peak)peak=v;
   if(peak>0.8&&v===0)reopened=true;
  }
  assert.ok(peak>0.8,`${preset} reaches full blink closure (${peak})`);
  assert.ok(reopened,`${preset} re-opens cleanly after blink`);

  let seatedPeak=0;
  for(let i=0;i<300;i++){
   avatar.update({speed:0,distance:0},true,undefined,.016);
   const v=avatar.blink();
   if(v>seatedPeak)seatedPeak=v;
  }
  assert.ok(seatedPeak>0.8,`${preset} blinks while seated on motorcycle (${seatedPeak})`);
  avatar.dispose();
 }
});
test('disposed GLB human instance ignores special clips while a fresh remounted instance on the same scene animates normally',async()=>{
 assert.equal(shouldUseGlbCharacter(undefined),false,'missing human preset does not match GLB dance support');
 const clip=new AnimationClip('dance_01',1,[
  new QuaternionKeyframeTrack('mixamorigLeftArm.quaternion',[0,0.5,1],[0,0,0,1,0,0,Math.SQRT1_2,Math.SQRT1_2,0,0,0,1]),
 ]);
 for(const preset of ['boy','girl'] as const){
  const model=await parseCharacterGlb(`../src/assets/${preset}.glb`);
  const stale=createGlbHuman(model.scene,{preset});
  stale.dispose();
  stale.setSpecialClip(clip,{loop:true});
  stale.update({speed:0,distance:0},false,undefined,.032);
  assert.equal(stale.specialBlend(),0,`${preset} disposed instance stays inert after cleanup`);
  assert.equal(stale.specialClipName(),null);

  const remounted=createGlbHuman(model.scene,{preset});
  remounted.update({speed:0,distance:0},false,undefined,.016);
  const idleArmQuat=remounted.object.getObjectByName('mixamorigLeftArm')!.quaternion.clone();
  remounted.setSpecialClip(clip,{loop:true,syncTimeSec:0.5});
  for(let f=0;f<25;f++){
   remounted.update({speed:0,distance:0},false,undefined,.032);
  }
  assert.ok(remounted.specialBlend()>0.99,`${preset} fresh remounted instance reaches full special clip blend`);
  assert.equal(remounted.specialClipName(),'dance_01');
  const dancingArmQuat=remounted.object.getObjectByName('mixamorigLeftArm')!.quaternion;
  assert.ok(idleArmQuat.angleTo(dancingArmQuat)>0.2,`${preset} fresh remounted instance rotates arm bones during special clip`);
  remounted.dispose();
 }
});
