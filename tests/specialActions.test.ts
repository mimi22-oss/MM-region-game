import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {Box3,Vector3} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createGlbHuman} from '../src/game/glbHuman.ts';
import {
 clearSpecialActionCache,
 DEFAULT_MAX_CLIP_CACHE,
 DEFAULT_MAX_RAW_CACHE,
 getSpecialAction,
 getSpecialActionCacheStats,
 getSpecialActionState,
 getSpecialActionSyncPhase,
 listSpecialActions,
 loadSpecialActionClipForRig,
 playSpecialAction,
 retargetAnimationClipToRig,
 setSpecialActionLoop,
 stopSpecialAction,
 toggleSpecialAction,
 type SpecialActionId,
} from '../src/game/specialActions.ts';

async function parseGlbStripTextures(relativePath:string):Promise<GLTF>{
 const bytes=await readFile(new URL(relativePath,import.meta.url));
 const jsonLength=bytes.readUInt32LE(12);
 const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 delete json.images;
 delete json.textures;
 delete json.samplers;
 delete json.materials;
 for(const mesh of json.meshes??[])for(const primitive of mesh.primitives??[])delete primitive.material;
 const rawJson=JSON.stringify(json);
 const encoded=Buffer.from(rawJson.padEnd(Math.ceil(rawJson.length/4)*4,' '));
 const bin=bytes.subarray(20+jsonLength);
 const buffer=Buffer.alloc(20+encoded.length+bin.length);
 bytes.copy(buffer,0,0,12);
 buffer.writeUInt32LE(buffer.length,8);
 buffer.writeUInt32LE(encoded.length,12);
 buffer.writeUInt32LE(0x4e4f534a,16);
 encoded.copy(buffer,20);
 bin.copy(buffer,20+encoded.length);
 return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
}

async function parseAnimationOnlyGlb(relativePath:string):Promise<{gltf:GLTF;byteLength:number;json:Record<string,unknown>}>{
 const bytes=await readFile(new URL(relativePath,import.meta.url));
 const jsonLength=bytes.readUInt32LE(12);
 const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString()) as Record<string,unknown>;
 const gltf=await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),
  '',
 );
 return {gltf,byteLength:bytes.length,json};
}

test('extracted dance GLBs contain zero meshes, zero images, zero scale tracks, and match source durations',async()=>{
 const srcInfo=await stat(new URL('../dance group.glb',import.meta.url));
 const srcGltf=await parseGlbStripTextures('../dance group.glb');
 const actions=listSpecialActions('dance');
 assert.equal(actions.length,6);

 let totalExtractedBytes=0;
 for(const action of actions){
  const relPath=`../public${action.assetUrl}`;
  const {gltf,byteLength,json}=await parseAnimationOnlyGlb(relPath);
  totalExtractedBytes+=byteLength;

  assert.equal(json.meshes,undefined,`${action.id} omits meshes`);
  assert.equal(json.images,undefined,`${action.id} omits embedded images`);
  assert.equal(json.textures,undefined,`${action.id} omits textures`);
  assert.equal(json.materials,undefined,`${action.id} omits materials`);
  assert.equal(json.skins,undefined,`${action.id} omits skins`);

  let meshCount=0;
  gltf.scene.traverse(obj=>{
   if((obj as {isMesh?:boolean}).isMesh)meshCount++;
  });
  assert.equal(meshCount,0,`${action.id} has 0 Mesh instances at runtime`);

  assert.equal(gltf.animations.length,1,`${action.id} holds single animation clip`);
  const clip=gltf.animations[0];
  assert.equal(clip.name,action.clipName);
  assert.ok(clip.tracks.every(t=>!t.name.endsWith('.scale')),`${action.id} strips constant scale tracks`);

  const srcClip=srcGltf.animations.find(a=>a.name===action.clipName);
  assert.ok(srcClip,`source GLB has ${action.clipName}`);
  assert.ok(Math.abs(clip.duration-srcClip.duration)<1e-3,`${action.id} preserves original duration`);
 }

 assert.ok(
  totalExtractedBytes<srcInfo.size*0.5,
  `total extracted size (${totalExtractedBytes}) is < 50% of source (${srcInfo.size})`,
 );
});

test('Special Action Registry manages Play, Stop, Loop, switch, and sync phase cleanly',()=>{
 stopSpecialAction();
 clearSpecialActionCache();
 assert.equal(getSpecialActionState().status,'idle');
 assert.equal(getSpecialActionState().activeActionId,null);

 playSpecialAction('dance_01',{startedAtMs:1000});
 assert.equal(getSpecialActionState().activeActionId,'dance_01');
 assert.equal(getSpecialActionState().status,'loading');
 assert.equal(getSpecialActionState().loop,true);

 setSpecialActionLoop(false);
 assert.equal(getSpecialActionState().loop,false);

 toggleSpecialAction('dance_02');
 assert.equal(getSpecialActionState().activeActionId,'dance_02');

 toggleSpecialAction('dance_02');
 assert.equal(getSpecialActionState().activeActionId,null);
 assert.equal(getSpecialActionState().status,'idle');

 assert.equal(getSpecialAction('dance_06')?.clipName,'dance_06.001');
 assert.ok(Math.abs(getSpecialActionSyncPhase(1000,10,true,23500)-2.5)<1e-6);
 assert.equal(getSpecialActionSyncPhase(1000,10,false,23500),10);
 stopSpecialAction();
 setSpecialActionLoop(true);
});

test('lazy loader dedupes requests and enforces bounded LRU cache limits',async()=>{
 clearSpecialActionCache();
 let fetchCount=0;
 const mockLoader=async(url:string)=>{
  fetchCount++;
  const fileName=url.split('/').pop()!;
  const {gltf}=await parseAnimationOnlyGlb(`../public/animations/${fileName}`);
  return gltf;
 };

 const boyModel=await parseGlbStripTextures('../src/assets/boy.glb');
 const initialStats=getSpecialActionCacheStats();
 assert.equal(initialStats.rawCount,0);
 assert.equal(initialStats.clipCount,0);

 // Concurrent duplicate requests only load once
 const [c1a,c1b]=await Promise.all([
  loadSpecialActionClipForRig('dance_01','boy',boyModel.scene,mockLoader),
  loadSpecialActionClipForRig('dance_01','boy',boyModel.scene,mockLoader),
 ]);
 assert.equal(fetchCount,1,'dedupes concurrent in-flight load');
 assert.equal(c1a,c1b,'returns identical cached AnimationClip');

 // Second call hits clipCache directly
 const c1c=await loadSpecialActionClipForRig('dance_01','boy',boyModel.scene,mockLoader);
 assert.equal(c1c,c1a);
 assert.equal(fetchCount,1,'repeat call served from clipCache');

 // Load all 6 dances sequentially and verify bounded LRU caps
 const ids:SpecialActionId[]=['dance_01','dance_02','dance_03','dance_04','dance_05','dance_06'];
 for(const id of ids){
  await loadSpecialActionClipForRig(id,'boy',boyModel.scene,mockLoader);
 }
 const afterStats=getSpecialActionCacheStats();
 assert.ok(afterStats.rawCount<=DEFAULT_MAX_RAW_CACHE,'raw cache respects bounded LRU limit');
 assert.ok(afterStats.clipCount<=DEFAULT_MAX_CLIP_CACHE,'retargeted clip cache respects bounded LRU limit');
 assert.ok(afterStats.evictions>0,'evicts oldest entries once capacity exceeded');
 clearSpecialActionCache();
});

test('retargets all 6 dances onto boy.glb & girl.glb and blends Idle ↔ Dance ↔ Switch ↔ Walk without conflicts',async()=>{
 const [boyModel,girlModel]=await Promise.all([
  parseGlbStripTextures('../src/assets/boy.glb'),
  parseGlbStripTextures('../src/assets/girl.glb'),
 ]);

 for(const [preset,model] of [['boy',boyModel],['girl',girlModel]] as const){
  const avatar=createGlbHuman(model.scene,{preset});

  const clipPromises=listSpecialActions('dance').map(async def=>{
   const {gltf}=await parseAnimationOnlyGlb(`../public${def.assetUrl}`);
   return retargetAnimationClipToRig(gltf.animations[0],gltf.scene,model.scene);
  });
  const clips=await Promise.all(clipPromises);

  // Verify every track of every clip contains valid finite floats and drives valid ground height
  for(const clip of clips){
   assert.ok(clip.tracks.length>=50,`${preset} ${clip.name} preserves full humanoid bone tracks (${clip.tracks.length})`);
   for(const track of clip.tracks){
    for(let i=0;i<track.values.length;i++){
     assert.ok(Number.isFinite(track.values[i]),`${preset} ${clip.name} ${track.name}[${i}] is finite`);
    }
   }
   avatar.setSpecialClip(clip,{loop:true,syncTimeSec:clip.duration*0.35});
   for(let f=0;f<25;f++){
    avatar.update({speed:0,distance:0},false,undefined,.032);
   }
   avatar.root.updateMatrixWorld(true);
   assert.ok(avatar.specialBlend()>0.99,`${preset} reaches full dance blend on ${clip.name}`);
   const bounds=new Box3().setFromObject(avatar.root);
   const size=bounds.getSize(new Vector3());
   assert.ok(bounds.min.y>-0.18&&bounds.min.y<0.45,`${preset} ${clip.name} feet stay near floor (min.y=${bounds.min.y.toFixed(3)})`);
   assert.ok(size.y>1.2&&size.y<2.1,`${preset} ${clip.name} keeps sane standing height (${size.y.toFixed(3)})`);
  }

  // Test Eye Blink continues independently during dance
  let danceBlinkPeak=0;
  for(let f=0;f<280;f++){
   avatar.update({speed:0,distance:0},false,undefined,.016);
   danceBlinkPeak=Math.max(danceBlinkPeak,avatar.blink());
  }
  assert.ok(danceBlinkPeak>0.8,`${preset} eye blink keeps working while dancing`);

  // Test Dance 1 -> Dance 2 switch crossfade keeps blend valid and updates clip name
  avatar.setSpecialClip(clips[1],{loop:true,crossFadeSec:0.25});
  for(let f=0;f<10;f++)avatar.update({speed:0,distance:0},false,undefined,.02);
  assert.equal(avatar.specialClipName(),clips[1].name);
  assert.ok(avatar.specialBlend()>0.95);

  // Test Stop transitions smoothly Dance -> Idle
  avatar.setSpecialClip(null);
  avatar.update({speed:0,distance:0},false,undefined,.05);
  const midBlend=avatar.specialBlend();
  assert.ok(midBlend>0&&midBlend<1,`smooth fade-out intermediate blend (${midBlend.toFixed(3)})`);
  for(let f=0;f<40;f++)avatar.update({speed:0,distance:0},false,undefined,.032);
  assert.equal(avatar.specialBlend(),0,'returns cleanly to 0 specialBlend after stop');
  assert.equal(avatar.specialClipName(),null);

  // Test Walk conflict cancels Dance cleanly even without explicit Stop
  avatar.setSpecialClip(clips[0],{loop:true});
  for(let f=0;f<25;f++)avatar.update({speed:0,distance:0},false,undefined,.032);
  assert.ok(avatar.specialBlend()>0.99);
  for(let f=0;f<30;f++)avatar.update({speed:4.0,distance:f*.06},false,undefined,.032);
  assert.equal(avatar.clip(),'walk');
  assert.equal(avatar.specialBlend(),0,'walking smoothly overrides and exits active dance');

  // Test LoopOnce triggers onSpecialFinished callback cleanly
  let finishedCount=0;
  avatar.onSpecialFinished(()=>{finishedCount++;});
  avatar.setSpecialClip(clips[4],{loop:false,syncTimeSec:Math.max(0,clips[4].duration-0.08)});
  for(let f=0;f<12;f++)avatar.update({speed:0,distance:0},false,undefined,.02);
  assert.equal(finishedCount,1,'non-looping dance emits finished callback once at end');

  avatar.dispose();
 }
});
