import React, { Profiler, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Raycaster, Vector3, type Group } from 'three';

const api=window as any, params=new URLSearchParams(location.search);
const before=params.get('version')==='before', count=Number(params.get('characters')??1), enabled=params.get('festival')!=='0', riding=params.get('mode')==='ride';
const base=before?'/artifacts/performance-audit/before/src':'/artifacts/performance-audit/after/src';
const load=(path:string)=>import(/* @vite-ignore */ `${base}/${path}`);
const [{TazaungdaingScene},{createDefaultFestivalConfig,MYOTHAR_FESTIVAL_HUB},{GlbHuman},{HUMAN_PRESETS},{TimeEnvironment}]=await Promise.all([
  load('festivals/TazaungdaingScene.tsx'),load('festivals/FestivalConfiguration.ts'),load('components/GlbHuman.tsx'),load('data/appearance.ts'),load('components/TimeEnvironment.tsx'),
]);
const query=before?null:(await load('game/cameraObstruction.ts')).createCameraObstructionQuery();
const config={...createDefaultFestivalConfig(),enabled:true,scheduleMode:'manual',activeZoneId:'all',balloonsPerZone:120,allowDaytimePreview:true};
const x=MYOTHAR_FESTIVAL_HUB.x,z=MYOTHAR_FESTIVAL_HUB.z;
api.audit={frames:[],renders:0,ready:false,start(){this.frames=[];this.renders=0;this.sampling=true;},stop(){this.sampling=false;return {frames:this.frames,renders:this.renders,renderer:this.renderer};}};
function Character({index}:{index:number}) {
  const motion=useRef({speed:riding?8:4,distance:0});
  useFrame((_,dt)=>{motion.current.distance+=motion.current.speed*Math.min(dt,.05);});
  return <group name={`audit-avatar-${index}`} position={[x+(index%3)*2,0,z+Math.floor(index/3)*2]}>
    <GlbHuman preset="boy" appearance={HUMAN_PRESETS.boy} motion={motion} riding={riding} onError={()=>{api.audit.error='GLB load failed';}} />
  </group>;
}
function Inspect() {
  const ray=useRef(new Raycaster(new Vector3(x,1.65,z),new Vector3(0,.12,1).normalize(),0,6));
  useFrame(({scene,gl},dt)=>{
    let skins=0;scene.traverse(o=>{if((o as any).isSkinnedMesh)skins++;});
    api.audit.ready=skins>=count;
    const player=scene.getObjectByName('audit-avatar-0')??null;
    const t=performance.now();
    if(count>0){if(query)query(ray.current,scene,player,false,null);else ray.current.intersectObjects(scene.children,true);}
    const cameraMs=performance.now()-t;
    const far=scene.getObjectByName('far-lod-balloons')?.children[0] as any;
    if(api.audit.sampling)api.audit.frames.push({ms:dt*1000,calls:gl.info.render.calls,triangles:gl.info.render.triangles,textures:gl.info.memory.textures,geometries:gl.info.memory.geometries,cameraMs,farVersion:far?.instanceMatrix.version??0,farCount:far?.count??0,skins});
    const context=gl.getContext(),ext=context.getExtension('WEBGL_debug_renderer_info');
    api.audit.renderer=ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER);
  });
  return null;
}
function Fixture() {
  return <Canvas shadows dpr={1} camera={{position:[x,3,z+6],fov:65,far:9000}} style={{width:'100vw',height:'100vh'}}
    onCreated={({camera})=>{camera.lookAt(x,1.4,z);camera.userData.viewFocus={x,z};}}>
    <TimeEnvironment minute={1260}/>
    <group name="audit-candle-region"><group name="festival-candles"><group position={[x-32,0,z-32]} userData={{flamePositions:Array.from({length:500},(_,i)=>[x+(i%25)-12,.6,z+Math.floor(i/25)-10])}} /></group></group>
    {enabled&&<TazaungdaingScene config={config} night={true} minute={1260}/>}
    {Array.from({length:count},(_,i)=><Character key={i} index={i}/>)}
    <Inspect/>
  </Canvas>;
}
createRoot(document.getElementById('root')!).render(<Profiler id="audit" onRender={()=>api.audit.renders++}><Fixture/></Profiler>);
