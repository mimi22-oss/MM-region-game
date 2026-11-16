import {useEffect,useState} from 'react';
import {type Group} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createGhostSwordModel} from '../game/missions/ghostSwordAttachment';

let sourcePromise:Promise<Group>|undefined;
function loadSword(){
  return sourcePromise??=new GLTFLoader().loadAsync('/models/knife.glb')
    .then(gltf=>gltf.scene).catch(error=>{sourcePromise=undefined;throw error;});
}
/** World pickup and equipped weapon share one cached asset, with separate transforms. */
export function GhostSwordModel({held=false}:{held?:boolean}){
  const [model,setModel]=useState<Group|null>(null);
  useEffect(()=>{
    let alive=true;
    loadSword().then(source=>{if(alive)setModel(createGhostSwordModel(source,held));})
      .catch(error=>console.warn('Ghost sword model unavailable; using procedural sword',error));
    return()=>{alive=false;};
  },[held]);
  if(model)return <primitive object={model} dispose={null}/>;
  return <group scale={held?1:2}>
    <mesh position={[0,-.38,0]}><boxGeometry args={[.065,.65,.018]}/><meshStandardMaterial color="#dce8ee" metalness={.75} roughness={.3}/></mesh>
    <mesh position={[0,-.04,0]}><boxGeometry args={[.19,.025,.04]}/><meshStandardMaterial color="#b99b4d"/></mesh>
    <mesh position={[0,.035,0]}><cylinderGeometry args={[.025,.025,.14,8]}/><meshStandardMaterial color="#3c2117"/></mesh>
  </group>;
}
