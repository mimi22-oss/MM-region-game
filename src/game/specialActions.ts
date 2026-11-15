import {useSyncExternalStore} from 'react';
import {
 AnimationClip,
 AnimationMixer,
 Bone,
 Group,
 Mesh,
 Object3D,
 Quaternion,
 QuaternionKeyframeTrack,
 Vector3,
 VectorKeyframeTrack,
} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

export type SpecialActionCategory='dance';
export type SpecialActionId=
 |'dance_01'
 |'dance_02'
 |'dance_03'
 |'dance_04'
 |'dance_05'
 |'dance_06';
export type SpecialActionStatus='idle'|'loading'|'playing'|'error';

export interface SpecialActionDefinition{
 readonly id:SpecialActionId;
 readonly category:SpecialActionCategory;
 readonly label:string;
 readonly myanmarLabel:string;
 readonly assetUrl:string;
 readonly clipName:string;
 readonly durationSec:number;
 readonly defaultLoop:boolean;
 readonly supportsGroupSync:boolean;
}

export interface SpecialActionState{
 activeActionId:SpecialActionId|null;
 status:SpecialActionStatus;
 loop:boolean;
 startedAtMs:number|null;
 groupId:string|null;
 error:string|null;
}

export interface RawAnimationAsset{
 scene:Object3D;
 clip:AnimationClip;
 actionId:SpecialActionId;
}

export interface SpecialActionCacheStats{
 rawCount:number;
 maxRawEntries:number;
 clipCount:number;
 maxClipEntries:number;
 hits:number;
 misses:number;
 evictions:number;
 loadedActionIds:SpecialActionId[];
}

export const DEFAULT_MAX_RAW_CACHE=4;
export const DEFAULT_MAX_CLIP_CACHE=6;

const ACTION_DEFINITIONS:SpecialActionDefinition[]=[
 {
  id:'dance_01',
  category:'dance',
  label:'Dance 01',
  myanmarLabel:'အက ၁',
  assetUrl:'/animations/dance_01.glb',
  clipName:'dance_01.001',
  durationSec:23.208,
  defaultLoop:true,
  supportsGroupSync:true,
 },
 {
  id:'dance_02',
  category:'dance',
  label:'Dance 02',
  myanmarLabel:'အက ၂',
  assetUrl:'/animations/dance_02.glb',
  clipName:'dance_02.001',
  durationSec:12.833,
  defaultLoop:true,
  supportsGroupSync:true,
 },
 {
  id:'dance_03',
  category:'dance',
  label:'Dance 03',
  myanmarLabel:'အက ၃',
  assetUrl:'/animations/dance_03.glb',
  clipName:'dance_03.001',
  durationSec:12.833,
  defaultLoop:true,
  supportsGroupSync:true,
 },
 {
  id:'dance_04',
  category:'dance',
  label:'Dance 04',
  myanmarLabel:'အက ၄',
  assetUrl:'/animations/dance_04.glb',
  clipName:'dance_04.001',
  durationSec:10.833,
  defaultLoop:true,
  supportsGroupSync:true,
 },
 {
  id:'dance_05',
  category:'dance',
  label:'Dance 05',
  myanmarLabel:'အက ၅',
  assetUrl:'/animations/dance_05.glb',
  clipName:'dance_05.001',
  durationSec:2.917,
  defaultLoop:true,
  supportsGroupSync:true,
 },
 {
  id:'dance_06',
  category:'dance',
  label:'Dance 06',
  myanmarLabel:'အက ၆',
  assetUrl:'/animations/dance_06.glb',
  clipName:'dance_06.001',
  durationSec:10.917,
  defaultLoop:true,
  supportsGroupSync:true,
 },
];

const registry=new Map<string,SpecialActionDefinition>(
 ACTION_DEFINITIONS.map(def=>[def.id,def]),
);

export function registerSpecialAction(definition:SpecialActionDefinition){
 registry.set(definition.id,definition);
}

export function getSpecialAction(id:string):SpecialActionDefinition|undefined{
 return registry.get(id);
}

export function listSpecialActions(category?:SpecialActionCategory):readonly SpecialActionDefinition[]{
 const all=Array.from(registry.values());
 return category?all.filter(item=>item.category===category):all;
}

/**
 * Computes the playback offset (in seconds) from a shared clock start timestamp
 * so future multiplayer group-dance coordination can align local phase without
 * coupling networking into this module.
 */
export function getSpecialActionSyncPhase(
 startedAtMs:number|null,
 clipDurationSec:number,
 loop:boolean,
 nowMs=Date.now(),
):number{
 if(startedAtMs===null||clipDurationSec<=0)return 0;
 const elapsedSec=Math.max(0,(nowMs-startedAtMs)/1000);
 return loop?elapsedSec%clipDurationSec:Math.min(elapsedSec,clipDurationSec);
}

let state:SpecialActionState={
 activeActionId:null,
 status:'idle',
 loop:true,
 startedAtMs:null,
 groupId:null,
 error:null,
};

const listeners=new Set<()=>void>();

function emitStateChange(){
 for(const listener of listeners)listener();
}

export function subscribeSpecialAction(listener:()=>void){
 listeners.add(listener);
 return ()=>{listeners.delete(listener);};
}

export function getSpecialActionState():SpecialActionState{
 return state;
}

export function useSpecialAction():SpecialActionState{
 return useSyncExternalStore(subscribeSpecialAction,getSpecialActionState,getSpecialActionState);
}

export interface PlaySpecialActionOptions{
 loop?:boolean;
 startedAtMs?:number;
 groupId?:string|null;
}

export function playSpecialAction(id:SpecialActionId,options?:PlaySpecialActionOptions){
 const def=getSpecialAction(id);
 if(!def)return;
 const cachedClipAlreadyAvailable=rawCache.has(id);
 state={
  activeActionId:id,
  status:cachedClipAlreadyAvailable?'playing':'loading',
  loop:options?.loop??state.loop??def.defaultLoop,
  startedAtMs:options?.startedAtMs??Date.now(),
  groupId:options?.groupId??null,
  error:null,
 };
 emitStateChange();
}

export function markSpecialActionPlaying(id:SpecialActionId){
 if(state.activeActionId!==id||state.status==='playing')return;
 state={
  ...state,
  status:'playing',
  error:null,
 };
 emitStateChange();
}

export function markSpecialActionError(id:SpecialActionId,message:string){
 if(state.activeActionId!==id)return;
 state={
  ...state,
  activeActionId:null,
  status:'error',
  startedAtMs:null,
  error:message,
 };
 emitStateChange();
}

export function stopSpecialAction(){
 if(state.activeActionId===null&&state.status==='idle'&&state.error===null)return;
 state={
  ...state,
  activeActionId:null,
  status:'idle',
  startedAtMs:null,
  groupId:null,
  error:null,
 };
 emitStateChange();
}

export function setSpecialActionLoop(loop:boolean){
 if(state.loop===loop)return;
 state={
  ...state,
  loop,
 };
 emitStateChange();
}

export function toggleSpecialAction(id:SpecialActionId){
 if(state.activeActionId===id&&state.status!=='error'){
  stopSpecialAction();
 }else{
  playSpecialAction(id);
 }
}

function normalizeBoneName(name:string):string{
 return name.replace(/[:.\s]/g,'');
}

function cloneTransformHierarchyOnly(root:Object3D):Group{
 const clonedRoot=new Group();
 clonedRoot.name=root.name;
 clonedRoot.position.copy(root.position);
 clonedRoot.quaternion.copy(root.quaternion);
 clonedRoot.scale.copy(root.scale);

 const cloneChildren=(src:Object3D,dst:Object3D)=>{
  for(const child of src.children){
   if(child instanceof Mesh)continue;
   const copy=child instanceof Bone?new Bone():new Object3D();
   copy.name=child.name;
   copy.position.copy(child.position);
   copy.quaternion.copy(child.quaternion);
   copy.scale.copy(child.scale);
   dst.add(copy);
   cloneChildren(child,copy);
  }
 };

 cloneChildren(root,clonedRoot);
 return clonedRoot;
}

/**
 * Aligns upper-arm bind direction of A-pose rigs (such as girl.glb) to match
 * the source animation's T-pose arm elevation before delta computation, while
 * keeping the target rig's child forearms/hands and local twist intact.
 */
function alignArmsToSourcePose(dstRoot:Object3D,srcRoot:Object3D){
 dstRoot.updateMatrixWorld(true);
 srcRoot.updateMatrixWorld(true);

 const findByNorm=(root:Object3D,normName:string):Object3D|null=>{
  let found:Object3D|null=null;
  root.traverse(o=>{
   if(!found&&normalizeBoneName(o.name)===normName)found=o;
  });
  return found;
 };

 const pSrc=new Vector3(),cSrc=new Vector3(),vSrc=new Vector3();
 const pDst=new Vector3(),cDst=new Vector3(),vDst=new Vector3();
 const deltaWorld=new Quaternion();
 const parentWQ=new Quaternion(),armWQ=new Quaternion(),desiredWQ=new Quaternion();

 for(const [armName,forearmName] of [
  ['mixamorigLeftArm','mixamorigLeftForeArm'],
  ['mixamorigRightArm','mixamorigRightForeArm'],
 ] as const){
  const srcArm=findByNorm(srcRoot,armName);
  const srcFore=findByNorm(srcRoot,forearmName);
  const dstArm=findByNorm(dstRoot,armName);
  const dstFore=findByNorm(dstRoot,forearmName);
  if(!srcArm||!srcFore||!dstArm||!dstFore||!dstArm.parent)continue;

  srcArm.getWorldPosition(pSrc);
  srcFore.getWorldPosition(cSrc);
  dstArm.getWorldPosition(pDst);
  dstFore.getWorldPosition(cDst);
  vSrc.subVectors(cSrc,pSrc).normalize();
  vDst.subVectors(cDst,pDst).normalize();

  if(vSrc.angleTo(vDst)<0.08)continue;

  deltaWorld.setFromUnitVectors(vDst,vSrc);
  dstArm.parent.getWorldQuaternion(parentWQ);
  dstArm.getWorldQuaternion(armWQ);
  desiredWQ.copy(deltaWorld).multiply(armWQ);
  dstArm.quaternion.copy(parentWQ.invert().multiply(desiredWQ)).normalize();
  dstRoot.updateMatrixWorld(true);
 }
}

function getBoneDepth(node:Object3D):number{
 let depth=0;
 let cur=node.parent;
 while(cur){
  depth++;
  cur=cur.parent;
 }
 return depth;
}

/**
 * Retargets an extracted Mixamo clip onto a target humanoid rig (`boy.glb`,
 * `girl.glb`, etc.) in world-space relative deltas so parent transform splits
 * (`Armature` rotation differences) and bind-pose arm/bone twist differences
 * preserve exact motion without duplicating meshes or skeletons.
 */
export function retargetAnimationClipToRig(
 srcClip:AnimationClip,
 srcRoot:Object3D,
 dstRoot:Object3D,
):AnimationClip{
 const srcRef=cloneTransformHierarchyOnly(srcRoot);
 const dstRef=cloneTransformHierarchyOnly(dstRoot);
 alignArmsToSourcePose(dstRef,srcRef);

 srcRef.updateMatrixWorld(true);
 dstRef.updateMatrixWorld(true);

 const srcBones=new Map<string,Object3D>();
 const dstBones=new Map<string,Object3D>();
 const srcWorldRestInv=new Map<string,Quaternion>();
 const dstWorldRest=new Map<string,Quaternion>();
 const trackedNormNames=new Set<string>(['mixamorigHips']);
 for(const t of srcClip.tracks){
  const dot=t.name.lastIndexOf('.');
  if(dot>0)trackedNormNames.add(normalizeBoneName(t.name.slice(0,dot)));
 }

 // Animation-only GLBs have no GLTF `skins` array, so GLTFLoader instantiates joints as Object3D rather than Bone.
 const isRigJoint=(obj:Object3D,key:string)=>
  obj instanceof Bone||trackedNormNames.has(key)||key.startsWith('mixamorig');

 srcRef.traverse(obj=>{
  if(!obj.name)return;
  const key=normalizeBoneName(obj.name);
  if(isRigJoint(obj,key)){
   srcBones.set(key,obj);
   srcWorldRestInv.set(key,obj.getWorldQuaternion(new Quaternion()).invert());
  }
 });
 dstRef.traverse(obj=>{
  if(!obj.name)return;
  const key=normalizeBoneName(obj.name);
  if(isRigJoint(obj,key)){
   dstBones.set(key,obj);
   dstWorldRest.set(key,obj.getWorldQuaternion(new Quaternion()));
  }
 });

 const quatTracks=srcClip.tracks.filter(t=>t.name.endsWith('.quaternion'));
 if(quatTracks.length===0){
  return srcClip.clone();
 }

 let sampleTimes=quatTracks[0].times;
 for(let i=1;i<quatTracks.length;i++){
  if(quatTracks[i].times.length>sampleTimes.length){
   sampleTimes=quatTracks[i].times;
  }
 }
 const sharedTimes=new Float32Array(sampleTimes);
 const numFrames=sharedTimes.length;

 const srcHips=srcBones.get('mixamorigHips');
 const dstHips=dstBones.get('mixamorigHips');
 const hipsPosTrack=srcClip.tracks.find(
  t=>t.name.endsWith('.position')&&normalizeBoneName(t.name.slice(0,-'.position'.length))==='mixamorigHips',
 );

 const srcHipsRestWPos=new Vector3();
 const dstHipsRestWPos=new Vector3();
 let heightRatio=1;
 if(srcHips&&dstHips){
  srcHips.getWorldPosition(srcHipsRestWPos);
  dstHips.getWorldPosition(dstHipsRestWPos);
  heightRatio=dstHipsRestWPos.y/Math.max(0.001,srcHipsRestWPos.y);
 }

 const targetEntries:{
  normName:string;
  dstTrackName:string;
  srcBone:Object3D;
  dstBone:Object3D;
  srcRestInv:Quaternion;
  dstRest:Quaternion;
  values:Float32Array;
  prevQ:Quaternion|null;
 }[]=[];

 for(const track of quatTracks){
  const rawBoneName=track.name.slice(0,-'.quaternion'.length);
  const normName=normalizeBoneName(rawBoneName);
  const srcBone=srcBones.get(normName);
  const dstBone=dstBones.get(normName);
  const srcRestInv=srcWorldRestInv.get(normName);
  const dstRest=dstWorldRest.get(normName);
  if(!srcBone||!dstBone||!srcRestInv||!dstRest)continue;
  targetEntries.push({
   normName,
   dstTrackName:`${dstBone.name}.quaternion`,
   srcBone,
   dstBone,
   srcRestInv,
   dstRest,
   values:new Float32Array(numFrames*4),
   prevQ:null,
  });
 }

 targetEntries.sort((a,b)=>getBoneDepth(a.dstBone)-getBoneDepth(b.dstBone));

 const hipsPosValues=hipsPosTrack&&srcHips&&dstHips?.parent?new Float32Array(numFrames*3):null;

 const mixer=new AnimationMixer(srcRef);
 const action=mixer.clipAction(srcClip);
 action.play();

 const wSrcAnim=new Quaternion();
 const wDstAnim=new Quaternion();
 const wDstParentAnim=new Quaternion();
 const localQ=new Quaternion();
 const srcWPos=new Vector3();
 const dstWPos=new Vector3();

 try{
  for(let f=0;f<numFrames;f++){
   mixer.setTime(sharedTimes[f]);
   srcRef.updateMatrixWorld(true);

   if(hipsPosValues&&srcHips&&dstHips?.parent){
    srcHips.getWorldPosition(srcWPos);
    dstWPos.copy(srcWPos).sub(srcHipsRestWPos).multiplyScalar(heightRatio).add(dstHipsRestWPos);
    dstHips.parent.worldToLocal(dstWPos);
    hipsPosValues[f*3]=dstWPos.x;
    hipsPosValues[f*3+1]=dstWPos.y;
    hipsPosValues[f*3+2]=dstWPos.z;
   }

   for(let bi=0;bi<targetEntries.length;bi++){
    const entry=targetEntries[bi];
    entry.srcBone.getWorldQuaternion(wSrcAnim);
    wDstAnim.copy(wSrcAnim).multiply(entry.srcRestInv).multiply(entry.dstRest);
    if(entry.dstBone.parent){
     entry.dstBone.parent.getWorldQuaternion(wDstParentAnim);
     localQ.copy(wDstParentAnim).invert().multiply(wDstAnim).normalize();
    }else{
     localQ.copy(wDstAnim).normalize();
    }

    if(entry.prevQ&&entry.prevQ.dot(localQ)<0){
     localQ.set(-localQ.x,-localQ.y,-localQ.z,-localQ.w);
    }
    if(!entry.prevQ)entry.prevQ=new Quaternion();
    entry.prevQ.copy(localQ);

    entry.dstBone.quaternion.copy(localQ);
    entry.dstBone.updateWorldMatrix(false,true);

    entry.values[f*4]=localQ.x;
    entry.values[f*4+1]=localQ.y;
    entry.values[f*4+2]=localQ.z;
    entry.values[f*4+3]=localQ.w;
   }
  }
 }finally{
  mixer.stopAllAction();
  mixer.uncacheRoot(srcRef);
 }

 const outTracks:(VectorKeyframeTrack|QuaternionKeyframeTrack)[]=[];
 if(hipsPosValues&&dstHips){
  outTracks.push(new VectorKeyframeTrack(`${dstHips.name}.position`,sharedTimes,hipsPosValues));
 }
 for(const entry of targetEntries){
  outTracks.push(new QuaternionKeyframeTrack(entry.dstTrackName,sharedTimes,entry.values));
 }

 return new AnimationClip(srcClip.name,srcClip.duration,outTracks);
}

/**
 * Bounded LRU cache for lazy-loaded animation assets and retargeted clips.
 */
export class BoundedLruCache<K,V>{
 private readonly map=new Map<K,V>();
 private readonly maxEntries:number;
 public evictions=0;

 constructor(maxEntries:number){
  this.maxEntries=maxEntries;
 }

 get size(){
  return this.map.size;
 }

 has(key:K){
  return this.map.has(key);
 }

 keys():K[]{
  return Array.from(this.map.keys());
 }

 get(key:K):V|undefined{
  const val=this.map.get(key);
  if(val===undefined)return undefined;
  this.map.delete(key);
  this.map.set(key,val);
  return val;
 }

 set(key:K,value:V){
  if(this.map.has(key)){
   this.map.delete(key);
  }else if(this.map.size>=this.maxEntries){
   const oldestKey=this.map.keys().next().value;
   if(oldestKey!==undefined){
    this.map.delete(oldestKey);
    this.evictions++;
   }
  }
  this.map.set(key,value);
 }

 clear(){
  this.map.clear();
 }
}

const rawCache=new BoundedLruCache<SpecialActionId,RawAnimationAsset>(DEFAULT_MAX_RAW_CACHE);
const clipCache=new BoundedLruCache<string,AnimationClip>(DEFAULT_MAX_CLIP_CACHE);
const inFlightRaw=new Map<SpecialActionId,Promise<RawAnimationAsset>>();
const inFlightClips=new Map<string,Promise<AnimationClip>>();

let cacheHits=0;
let cacheMisses=0;
let sharedLoader:GLTFLoader|null=null;

function getLoader(){
 if(!sharedLoader)sharedLoader=new GLTFLoader();
 return sharedLoader;
}

export async function loadRawSpecialActionAsset(
 id:SpecialActionId,
 loaderFn?:(url:string)=>Promise<{scene:Object3D;animations:AnimationClip[]}>,
):Promise<RawAnimationAsset>{
 const cached=rawCache.get(id);
 if(cached){
  cacheHits++;
  return cached;
 }

 const inflight=inFlightRaw.get(id);
 if(inflight)return inflight;

 const def=getSpecialAction(id);
 if(!def)throw new Error(`Unknown special action: ${id}`);

 cacheMisses++;
 const promise=(loaderFn?loaderFn(def.assetUrl):getLoader().loadAsync(def.assetUrl))
  .then(gltf=>{
   const clip=gltf.animations.find(c=>c.name===def.clipName)??gltf.animations[0];
   if(!clip)throw new Error(`No animation clip found in ${def.assetUrl}`);
   const asset:RawAnimationAsset={
    scene:gltf.scene,
    clip,
    actionId:id,
   };
   rawCache.set(id,asset);
   return asset;
  })
  .finally(()=>{
   inFlightRaw.delete(id);
  });

 inFlightRaw.set(id,promise);
 return promise;
}

export async function loadSpecialActionClipForRig(
 id:SpecialActionId,
 rigKey:string,
 targetRigRoot:Object3D,
 loaderFn?:(url:string)=>Promise<{scene:Object3D;animations:AnimationClip[]}>,
):Promise<AnimationClip>{
 const cacheKey=`${id}:${rigKey}`;
 const cachedClip=clipCache.get(cacheKey);
 if(cachedClip){
  cacheHits++;
  return cachedClip;
 }

 const inflight=inFlightClips.get(cacheKey);
 if(inflight)return inflight;

 cacheMisses++;
 const promise=loadRawSpecialActionAsset(id,loaderFn)
  .then(rawAsset=>{
   const retargeted=retargetAnimationClipToRig(rawAsset.clip,rawAsset.scene,targetRigRoot);
   clipCache.set(cacheKey,retargeted);
   return retargeted;
  })
  .finally(()=>{
   inFlightClips.delete(cacheKey);
  });

 inFlightClips.set(cacheKey,promise);
 return promise;
}

export function getSpecialActionCacheStats():SpecialActionCacheStats{
 return {
  rawCount:rawCache.size,
  maxRawEntries:DEFAULT_MAX_RAW_CACHE,
  clipCount:clipCache.size,
  maxClipEntries:DEFAULT_MAX_CLIP_CACHE,
  hits:cacheHits,
  misses:cacheMisses,
  evictions:rawCache.evictions+clipCache.evictions,
  loadedActionIds:rawCache.keys(),
 };
}

export function clearSpecialActionCache(){
 rawCache.clear();
 clipCache.clear();
 inFlightRaw.clear();
 inFlightClips.clear();
 rawCache.evictions=0;
 clipCache.evictions=0;
 cacheHits=0;
 cacheMisses=0;
}
