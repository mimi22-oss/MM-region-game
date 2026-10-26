import React,{useCallback,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Town} from '../../src/components/Town';
import {ward} from '../../src/data/ward';
const api=window as any;
function Inspect(){const {camera,scene}=useThree();api.perfView=(x:number,z:number,y:number)=>{camera.position.set(x+20,y,z+30);camera.lookAt(x,0,z);camera.userData.viewFocus={x,z};};
 useFrame(({gl},dt)=>{api.perfFrames??=[];api.perfFrames.push(dt*1000);if(api.perfFrames.length>120)api.perfFrames.shift();api.perfSample={calls:gl.info.render.calls,triangles:gl.info.render.triangles,geometries:gl.info.memory.geometries,textures:gl.info.memory.textures,programs:gl.info.programs?.length,regions:scene.children.filter(c=>c.name.startsWith('detail-')).map(c=>c.name)};});return null;}
function Fixture(){const [minute,setMinute]=useState(780);api.perfTime=setMinute;
 const loaded=useCallback((state:any)=>{api.perfLoading=state;},[]),failed=useCallback(()=>{api.perfError=true;},[]);
 return <Canvas shadows dpr={.6} gl={{logarithmicDepthBuffer:true}} style={{height:'100vh',width:'100vw'}} camera={{position:[ward.spawn.x+20,25,ward.spawn.z+30],far:9000,fov:65}} onCreated={({camera})=>{camera.lookAt(ward.spawn.x,0,ward.spawn.z);camera.userData.viewFocus=ward.spawn;}}><Town minute={minute} onLoadingChange={loaded} onSceneError={failed}/><Inspect/></Canvas>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
