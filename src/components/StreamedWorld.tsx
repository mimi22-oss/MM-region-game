import { CarBots } from './CarBots';
import { lazy, Suspense, useMemo, useRef, useState, useLayoutEffect, type LazyExoticComponent, type ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, Matrix4, Quaternion, Vector3, Color } from 'three';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { mobileQuality, selectRegions, selectOverviewRegions, ViewSettler } from '../game/sceneBudget';
import { StaticBatch } from './StaticBatch';
import { RobotBots } from './RobotBots';

const components:Record<string,LazyExoticComponent<ComponentType>>={
 myothar:lazy(()=>import('./wards/myothar').then(m=>({default:m.MyotharWard}))),
 tharsi:lazy(()=>import('./villages/tharsi').then(m=>({default:m.TharSiVillage}))),
 chinsai:lazy(()=>import('./villages/chinsai').then(m=>({default:m.ChinSaiVillage}))),
 zingalin:lazy(()=>import('./villages/zingalin').then(m=>({default:m.ZingalinVillage}))),
 htomar:lazy(()=>import('./villages/htomar').then(m=>({default:m.HtomarVillage}))),
 tharyargone:lazy(()=>import('./villages/tharyargone').then(m=>({default:m.TharYarGoneVillage}))),
 htaukkyant:lazy(()=>import('./villages/htaukkyant').then(m=>({default:m.HtaukKyantVillage}))),
 kyarinn:lazy(()=>import('./villages/kyarinn').then(m=>({default:m.KyarInnVillage}))),
};
const regions=[{id:'myothar',houses:ward.houses,roads:ward.roads,fields:ward.fields},...kalayVillages];
const bounds=regions.map(r=>({id:r.id,minX:Math.min(...r.houses.map(h=>h.x))-60,maxX:Math.max(...r.houses.map(h=>h.x))+60,minZ:Math.min(...r.houses.map(h=>h.z))-60,maxZ:Math.max(...r.houses.map(h=>h.z))+60}));
type Plot={x:number;z:number;width:number;depth:number;rotation:number;color:string;height:number;y:number};
/** A single draw call per region keeps the whole map visible without detailed object trees. */
function Overview({region}:{region:typeof regions[number]}){
 const mesh=useRef<InstancedMesh>(null);
 const plots=useMemo<Plot[]>(()=>[
  ...region.fields.map(f=>({...f,height:.1,y:0})),
  ...('bundedFields' in region?region.bundedFields:[]).map(f=>({...f,height:.1,y:0})),
  ...('separationFields' in region?region.separationFields:[]).map(f=>({...f,height:.1,y:0})),
  ...region.roads.map(r=>({...r,color:r.main?'#657371':'#d4bd98',height:.15,y:.1})),
  ...region.houses.map(h=>({...h,color:h.roof,height:5,y:2.5})),
 ],[region]);
 useLayoutEffect(()=>{const matrix=new Matrix4(),q=new Quaternion(),axis=new Vector3(0,1,0),v=new Vector3(),scale=new Vector3(),color=new Color();
 plots.forEach((p,i)=>{matrix.compose(v.set(p.x,p.y,p.z),q.setFromAxisAngle(axis,p.rotation),scale.set(p.width,p.height,p.depth));mesh.current!.setMatrixAt(i,matrix);mesh.current!.setColorAt(i,color.set(p.color))});
 mesh.current!.instanceMatrix.needsUpdate=true;if(mesh.current!.instanceColor)mesh.current!.instanceColor.needsUpdate=true;mesh.current!.computeBoundingSphere();
 },[plots]);
 return <instancedMesh ref={mesh} args={[undefined,undefined,plots.length]}><boxGeometry/><meshLambertMaterial/></instancedMesh>;
}
function Detail({index}:{index:number}){const Scene=components[regions[index].id];return <StaticBatch><Scene/></StaticBatch>}
export function StreamedWorld(){
 const [active,setActive]=useState<string[]>([]),[overview,setOverview]=useState(()=>selectOverviewRegions(bounds,ward.spawn.x,ward.spawn.z,mobileQuality)),elapsed=useRef(0),settler=useRef(new ViewSettler());
 useFrame(({camera},dt)=>{
  const focus=camera.userData.viewFocus??{x:camera.position.x,z:camera.position.z};
  const settled=settler.current.update(focus.x,focus.z,camera.position.y,dt);
  elapsed.current+=dt;if(elapsed.current<.25||!settled)return;elapsed.current=0;
  const next=selectRegions(bounds,focus.x,focus.z,camera.position.y,active,mobileQuality);
  if(next.join()!==active.join())setActive(next);
  const visible=selectOverviewRegions(bounds,focus.x,focus.z,mobileQuality);
  if(visible.join()!==overview.join())setOverview(visible);
 });

 return <>
  {regions.map((r,i)=>(active.includes(r.id)||overview.includes(r.id))&&<group key={r.id}>
   {active.includes(r.id)?<Suspense fallback={<Overview region={r}/>}><Detail index={i}/></Suspense>:<Overview region={r}/>}
  </group>)}
  <RobotBots activeRegions={active}/>
  <CarBots/>
 </>;
}

