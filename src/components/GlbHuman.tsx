import {useEffect,useMemo,useState,type RefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {HumanAppearance} from '../data/appearance';
import {createGlbHuman} from '../game/glbHuman';
import type {CharacterMotion,DrivingPose} from './CartoonCharacter';

// 3D boy/girl model files: Vite emits these URLs in production as well as development.
export const HUMAN_MODEL_URLS={
 boy:new URL('../assets/boy.glb',import.meta.url).href,
 girl:new URL('../assets/girl.glb',import.meta.url).href,
};
const models=new Map<string,Promise<GLTF>>();
function loadModel(url:string){
 let pending=models.get(url);
 if(!pending){pending=new GLTFLoader().loadAsync(url).catch(error=>{models.delete(url);throw error;});models.set(url,pending);}
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
 const instance=useMemo(()=>createGlbHuman(model.scene),[model]);
 useEffect(()=>()=>instance.dispose(),[instance]);
 useFrame((_,delta)=>{if(!driving||driving.current.active)instance.update(motion.current,riding,driving?.current,delta);});
 // Preserve the supplied texture artwork; height remains adjustable in Appearance.
 return <group name={`glb-${preset}-character`} scale={riding||driving?1:appearance.height} userData={{humanPreset:preset,model:HUMAN_MODEL_URLS[preset]}}>
  <primitive object={instance.root} dispose={null}/>
 </group>;
}
