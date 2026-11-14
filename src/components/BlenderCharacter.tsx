import {useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {AnimationMixer,Bone,LoopRepeat,Mesh,MeshStandardMaterial,SkinnedMesh,Vector3,type AnimationAction,type Group} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {HUMAN_PRESETS,type HumanAppearance} from '../data/appearance';
import {characterClip,vaultPhase,type CharacterClip} from '../game/blenderCharacter';
import type {CharacterMotion,DrivingPose} from './CartoonCharacter';
import {gameplayClips,createLimbFitter} from '../game/characterRig';
import {driverGrip} from '../game/carCabin';

export const CHARACTER_MODEL_URL = `${import.meta.env.BASE_URL}models/canolia-character.glb`;
let modelPromise:Promise<GLTF>|undefined;
function loadModel(){
 return modelPromise??=(new GLTFLoader().loadAsync(CHARACTER_MODEL_URL).catch(error=>{modelPromise=undefined;throw error;}));
}
type Props={appearance:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>;onError?:()=>void};
export function BlenderCharacter(props:Props){
 const [model,setModel]=useState<GLTF>();
 useEffect(()=>{
  let live=true;
  loadModel().then(value=>{if(live)setModel(value);}).catch(error=>{console.error('Unable to load Blender character',error);if(live)props.onError?.();});
  return ()=>{live=false;};
 },[]);
 return model?<LoadedCharacter {...props} model={model}/>:null;
}
function LoadedCharacter({model,appearance,motion,riding=false,driving}:Props&{model:GLTF}){
 const instance=useMemo(()=>{
  // Skeletons and materials belong to each avatar; buffers stay shared in the loader cache.
  const object=clone(model.scene) as Group;
  const materials:MeshStandardMaterial[]=[];
  const originals=new Map<MeshStandardMaterial,MeshStandardMaterial>();
  object.traverse(child=>{
   if(!(child instanceof Mesh))return;
   const copy=(m:MeshStandardMaterial)=>{const result=m.clone();materials.push(result);originals.set(result,m);return result;};
   child.material=Array.isArray(child.material)?child.material.map(m=>copy(m as MeshStandardMaterial)):copy(child.material as MeshStandardMaterial);
   child.castShadow=true;child.receiveShadow=true;
   if(child instanceof SkinnedMesh)child.frustumCulled=false;
   if(child.name==='Hoodie_violet_cotton')child.name='human-torso';
  });
  const mixer=new AnimationMixer(object),actions={} as Record<CharacterClip,AnimationAction>;
  const hips=object.getObjectByName('Hips');
  for(const clip of gameplayClips(model.animations,hips?.position.y??.69)){
   actions[clip.name as CharacterClip]=mixer.clipAction(clip).setLoop(LoopRepeat,Infinity);
  }
  const limb=(a:string,b:string,c:string)=>createLimbFitter(object.getObjectByName(a) as Bone,object.getObjectByName(b) as Bone,object.getObjectByName(c) as Bone);
  const arms={L:limb('UpperArm_L','Forearm_L','Hand_L'),R:limb('UpperArm_R','Forearm_R','Hand_R')};
  return {object,materials,originals,mixer,actions,arms,head:object.getObjectByName('Head')!,target:new Vector3(),pole:new Vector3()};
 },[model]);
 useEffect(()=>()=>{
  instance.mixer.stopAllAction();instance.mixer.uncacheRoot(instance.object);
  instance.materials.forEach(m=>m.dispose());
  instance.object.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.dispose();});
 },[instance]);
 useEffect(()=>{
  const defaults=HUMAN_PRESETS.boy;
  for(const m of instance.materials){
   m.color.copy(instance.originals.get(m)!.color);
   const field=m.name==='Warm peach skin'?'skin':m.name==='Espresso hair'||m.name==='Warm hair ridges'?'hairColor':m.name.startsWith('Hoodie')||m.name.startsWith('Violet')||m.name==='Hood interior'?'clothingColor':m.name.startsWith('Charcoal')?'trousersColor':m.name==='Off white leather'||m.name==='White rubber'?'shoeColor':null;
   if(field&&appearance[field]!==defaults[field])m.color.set(appearance[field]);
  }
 },[appearance,instance]);
 const current=useRef<CharacterClip|null>(null),placement=useRef<Group>(null),container=useRef<Group>(null);
 useFrame((_,delta)=>{
  if(driving&&!driving.current.active)return;
  const name=characterClip(motion.current,riding,!!driving),action=instance.actions[name];
  if(current.current!==name){
   if(current.current)instance.actions[current.current]?.fadeOut(.16);
   action.reset().fadeIn(.16).play();current.current=name;
  }
  action.paused=name==='Vault';
  if(name==='Vault')action.time=vaultPhase(motion.current)*action.getClip().duration;
  action.timeScale=name==='Walk'?Math.max(.5,Math.min(2.5,Math.abs(motion.current.speed)/1.8)):1;
  instance.mixer.update(Math.min(delta,.06));
  // Authored +Z faces the existing gameplay -Z after this group's rotation.
  if(placement.current)placement.current.position.y=driving?.167:riding?.11:0;
  instance.head.scale.setScalar(driving?.current.interior?0:1);
  if((driving||riding)&&container.current){
   instance.object.updateWorldMatrix(true,true);
   for(const side of [-1,1]){
    if(driving)driverGrip(side,driving.current.wheelAngle,instance.target);
    else instance.target.set(side*.27,.86,-.49);
    instance.target.y+=driving?.03:0;
    instance.target.applyMatrix4(container.current.matrixWorld);
    instance.pole.set(side,.1,.5).transformDirection(container.current.matrixWorld);
    instance.arms[side<0?'R':'L'](instance.target,instance.pole);
   }
  }
 });
 return <group ref={container} name="blender-character" scale={riding||driving?1:appearance.height} userData={{humanPreset:appearance.preset,model:CHARACTER_MODEL_URL}}>
  <group ref={placement} rotation={[0,Math.PI,0]}><primitive object={instance.object} dispose={null}/></group>
 </group>;
}
