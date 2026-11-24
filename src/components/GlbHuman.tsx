import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {Mesh,MeshStandardMaterial,type Texture} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {effectiveHumanHeightScale,type HumanAppearance} from '../data/appearance';
import {createGlbHuman} from '../game/glbHuman';
import {COMBAT_MODEL_URLS} from '../game/combat/AttackDefinitions';
import {getQualityPreset,useQualityPreset} from '../game/qualityPreset';
import {getPlayerDeathState} from '../game/playerDeath';
import type {HorseRiderPose} from '../game/horseAnimation';
import {
 getSpecialAction,
 getSpecialActionSyncPhase,
 loadSpecialActionClipForRig,
 markSpecialActionError,
 markSpecialActionPlaying,
 notifySpecialActionFadeOutComplete,
 stopSpecialAction,
 useSpecialAction,
} from '../game/specialActions';
import type {CharacterMotion,DrivingPose} from './CartoonCharacter';

// 3D boy/girl model files: Vite emits these URLs in production as well as development.
export const HUMAN_MODEL_URLS={
 boy:COMBAT_MODEL_URLS.boy,
 girl:COMBAT_MODEL_URLS.girl,
};
const models=new Map<string,Promise<GLTF>>();

function clampGltfTextures(gltf:GLTF,maxSize:number){
 if(typeof document==='undefined')return gltf;
 const seen=new Set<Texture>();
 const texKeys=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'] as const;
 gltf.scene.traverse(obj=>{
  if(!(obj instanceof Mesh))return;
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  for(const mat of mats){
   if(!(mat instanceof MeshStandardMaterial))continue;
   for(const key of texKeys){
    const tex=mat[key];
    if(!tex||seen.has(tex))continue;
    seen.add(tex);
    tex.anisotropy=Math.min(tex.anisotropy||1,maxSize<=1024?2:4);
    const img=tex.image as {width?:number;height?:number}|undefined;
    if(!img||typeof img.width!=='number'||typeof img.height!=='number')continue;
    const maxDim=Math.max(img.width,img.height);
    if(maxDim<=maxSize)continue;
    const scale=maxSize/maxDim;
    const w=Math.max(1,Math.round(img.width*scale));
    const h=Math.max(1,Math.round(img.height*scale));
    const canvas=document.createElement('canvas');
    canvas.width=w;
    canvas.height=h;
    const ctx=canvas.getContext('2d');
    if(ctx){
     ctx.imageSmoothingEnabled=true;
     ctx.imageSmoothingQuality='high';
     ctx.drawImage(img as CanvasImageSource,0,0,w,h);
     tex.image=canvas;
     tex.needsUpdate=true;
    }
   }
  }
 });
 return gltf;
}

function loadModel(url:string){
 let pending=models.get(url);
 if(!pending){
  pending=new GLTFLoader()
   .loadAsync(url)
   .then(gltf=>clampGltfTextures(gltf,getQualityPreset().glbMaxTextureSize))
   .catch(error=>{models.delete(url);throw error;});
  models.set(url,pending);
 }
 return pending;
}
type Props={preset:'boy'|'girl';appearance:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>;horsePose?:RefObject<HorseRiderPose>;combat?:boolean;onError:()=>void};
export function GlbHuman(props:Props){
 const url=HUMAN_MODEL_URLS[props.preset];
 const [model,setModel]=useState<GLTF>();
 useEffect(()=>{
  let live=true;
  loadModel(url).then(value=>{if(live)setModel(value);}).catch(error=>{console.error(`Unable to load ${props.preset} GLB`,error);if(live)props.onError();});
  return ()=>{live=false;};
 },[url]);
 return model?<LoadedHuman {...props} model={model}/>:null;
}
function LoadedHuman({model,preset,appearance,motion,riding=false,driving,horsePose,combat=false}:Props&{model:GLTF}){
 const quality=useQualityPreset();
 const special=useSpecialAction();
 const canPlaySpecial=!riding&&!driving&&!horsePose?.current?.active;
 const activeSpecialId=canPlaySpecial?special.activeActionId:null;
 const [instance,setInstance]=useState<ReturnType<typeof createGlbHuman>|null>(null);
 // Manage the imperative Three.js controller inside useLayoutEffect so StrictMode remounts create a fresh instance instead of reusing a disposed useMemo instance.
 useLayoutEffect(()=>{
  const created=createGlbHuman(model.scene,{castShadow:getQualityPreset().characterCastShadow,preset,combatClips:combat?model.animations:undefined});
  setInstance(created);
  return ()=>{
   setInstance(current=>current===created?null:current);
   created.dispose();
  };
 },[model,preset,combat]);
 useEffect(()=>{instance?.setCastShadow(quality.characterCastShadow);},[instance,quality.characterCastShadow]);
 useEffect(()=>{
  if(!instance)return;
  instance.onSpecialFinished(()=>{
   // Never clear or fade out the fallen death pose while the player is dead (prevents popping up / T-pose)
   if(getPlayerDeathState().phase!=='alive')return;
   stopSpecialAction();
  });
  instance.onSpecialStopped(()=>notifySpecialActionFadeOutComplete());
  return ()=>{
   instance.onSpecialFinished(null);
   instance.onSpecialStopped(null);
  };
 },[instance]);
 const latestPlaybackRef=useRef({loop:special.loop,speed:special.speed});
 latestPlaybackRef.current={loop:special.loop,speed:special.speed};
 useEffect(()=>{instance?.setSpecialLoop(special.loop);},[instance,special.loop]);
 useEffect(()=>{instance?.setSpecialSpeed(special.speed);},[instance,special.speed]);
 useEffect(()=>{
  if(!instance)return;
  if(!activeSpecialId){
   instance.setSpecialClip(null);
   return;
  }
  let cancelled=false;
  const loadGen=special.generation;
  const def=getSpecialAction(activeSpecialId);
  loadSpecialActionClipForRig(activeSpecialId,preset,model.scene)
   .then(clip=>{
    if(cancelled)return;
    const {loop,speed}=latestPlaybackRef.current;
    const syncTimeSec=def?.supportsGroupSync
     ? getSpecialActionSyncPhase(special.startedAtMs,clip.duration,loop)
     : 0;
    const isPlayerDead=getPlayerDeathState().phase!=='alive';
    instance.setSpecialClip(clip,{
     loop,
     syncTimeSec,
     speed,
     crossFadeSec:def?.crossFadeSec,
     fadeOutSec:def?.fadeOutSec,
     // While dead, clamp indefinitely on the final fallen frame so the character stays on the ground until respawn
     endHoldSec:isPlayerDead?999:def?.endHoldSec,
     allowWhileMoving:isPlayerDead?true:def?.allowWhileMoving,
     restart:true,
    });
    markSpecialActionPlaying(activeSpecialId,loadGen);
   })
   .catch(err=>{
    if(cancelled)return;
    const message=err instanceof Error?err.message:'Unable to load special animation.';
    console.error(`Unable to load special action ${activeSpecialId}:`,err);
    markSpecialActionError(activeSpecialId,message,loadGen);
    instance.setSpecialClip(null);
   });
  return ()=>{cancelled=true;};
 },[instance,activeSpecialId,special.startedAtMs,special.generation,preset,model]);
 useFrame((_,delta)=>{if(instance&&(!driving||driving.current.active))instance.update(motion.current,riding,driving?.current,delta,horsePose?.current);},combat?-.5:0);
 if(!instance)return null;
 // Preserve the supplied texture artwork; height remains adjustable in Appearance.
 return <group name={`glb-${preset}-character`} scale={riding||driving?1:effectiveHumanHeightScale(preset,appearance.height)} userData={{humanPreset:preset,model:HUMAN_MODEL_URLS[preset]}}>
  <primitive object={instance.root} dispose={null}/>
 </group>;
}
