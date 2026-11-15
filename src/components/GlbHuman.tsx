import {useEffect,useMemo,useState,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {Mesh,MeshStandardMaterial,type Texture} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {HumanAppearance} from '../data/appearance';
import {createGlbHuman} from '../game/glbHuman';
import {getQualityPreset,useQualityPreset} from '../game/qualityPreset';
import type {CharacterMotion,DrivingPose} from './CartoonCharacter';

// 3D boy/girl model files: Vite emits these URLs in production as well as development.
export const HUMAN_MODEL_URLS={
 boy:new URL('../assets/boy.glb',import.meta.url).href,
 girl:new URL('../assets/girl.glb',import.meta.url).href,
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
type Props={preset:'boy'|'girl';appearance:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>;onError:()=>void};
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
function LoadedHuman({model,preset,appearance,motion,riding=false,driving}:Props&{model:GLTF}){
 const quality=useQualityPreset();
 const instance=useMemo(()=>createGlbHuman(model.scene,{castShadow:quality.characterCastShadow}),[model]);
 useEffect(()=>{instance.setCastShadow(quality.characterCastShadow);},[instance,quality.characterCastShadow]);
 useEffect(()=>()=>instance.dispose(),[instance]);
 useFrame((_,delta)=>{if(!driving||driving.current.active)instance.update(motion.current,riding,driving?.current,delta);});
 // Preserve the supplied texture artwork; height remains adjustable in Appearance.
 return <group name={`glb-${preset}-character`} scale={riding||driving?1:appearance.height} userData={{humanPreset:preset,model:HUMAN_MODEL_URLS[preset]}}>
  <primitive object={instance.root} dispose={null}/>
 </group>;
}
