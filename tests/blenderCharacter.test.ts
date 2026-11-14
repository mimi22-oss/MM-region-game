import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AnimationMixer,Bone,Box3,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {CHARACTER_CLIPS,characterClip,vaultPhase} from '../src/game/blenderCharacter.ts';
import {gameplayClips,createLimbFitter} from '../src/game/characterRig.ts';

const bytes=await readFile(new URL('../public/models/canolia-character.glb',import.meta.url));
const model=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
test('gameplay states select the correct authored clips, including vehicle and water priority',()=>{
 assert.equal(characterClip({speed:0}),'Idle');assert.equal(characterClip({speed:2}),'Walk');
 assert.equal(characterClip({speed:0,airborne:true}),'Vault');assert.equal(characterClip({speed:0,jumpBend:.5}),'Vault');
 assert.equal(characterClip({speed:0},true),'Bike_Idle');assert.equal(characterClip({speed:-2},true),'Bike_Drive');
 assert.equal(characterClip({speed:0,airborne:true},false,true),'Car_Drive');
 assert.equal(characterClip({speed:0,swimming:true}),'Swim_Idle');assert.equal(characterClip({speed:2,swimming:true}),'Swim_Forward');
 assert.ok(vaultPhase({speed:0,airborne:true,jumpVelocity:6})<.5);
 assert.ok(vaultPhase({speed:0,airborne:true,jumpVelocity:-6})>.5);
});
test('shipped GLB has all nine clips and cloned skeletons animate independently',()=>{
 assert.deepEqual(model.animations.map(a=>a.name).sort(),[...CHARACTER_CLIPS].sort());
 const a=clone(model.scene),b=clone(model.scene),original=new Box3().setFromObject(b);
 assert.ok(original.max.y>1.7&&original.max.y<1.9);
 assert.notEqual((a.getObjectByName('Warm_peach_skin') as SkinnedMesh).skeleton,(b.getObjectByName('Warm_peach_skin') as SkinnedMesh).skeleton);
 const hips=a.getObjectByName('Hips')!,clips=gameplayClips(model.animations,hips.position.y),mixer=new AnimationMixer(a);
 const raw=model.animations.find(c=>c.name==='Vault')!.tracks.find(t=>t.name==='Hips.position')!;
 assert.ok(Math.max(...raw.values)>.9,'original authored vertical jump remains untouched');
 for(const clip of clips){
  mixer.stopAllAction();mixer.clipAction(clip).play();mixer.update(clip.duration*.5);a.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(a);assert.ok(bounds.min.toArray().every(Number.isFinite),clip.name);
  if(clip.name==='Vault')assert.ok(Math.abs(hips.position.y-.69)<.0001,'no second vertical jump on top of controller physics');
 }
 assert.deepEqual(new Box3().setFromObject(b).min.toArray(),original.min.toArray());
 mixer.stopAllAction();mixer.uncacheRoot(a);
});
test('vehicle arm fitting reaches a grip after avatar rotation and scale',()=>{
 const avatar=clone(model.scene);avatar.rotation.y=Math.PI;avatar.scale.setScalar(.8);avatar.position.set(.28,.48,.04);
 const mixer=new AnimationMixer(avatar);mixer.clipAction(model.animations.find(a=>a.name==='Car_Drive')!).play();mixer.update(.5);avatar.updateMatrixWorld(true);
 const upper=avatar.getObjectByName('UpperArm_R') as Bone,lower=avatar.getObjectByName('Forearm_R') as Bone,end=avatar.getObjectByName('Hand_R') as Bone;
 const fitter=createLimbFitter(upper,lower,end),shoulder=upper.getWorldPosition(new Vector3());
 const target=shoulder.clone().add(new Vector3(-.10,-.15,-.17));
 fitter(target,new Vector3(-1,0,.5));
 assert.ok(end.getWorldPosition(new Vector3()).distanceTo(target)<.001);
});
