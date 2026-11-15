import {useCallback,useEffect,useMemo,useRef,useSyncExternalStore} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {PointLight,type Object3D} from 'three';
import {CANDLE_LIGHT_COLOR} from '../game/candleModel';
import {useQualityPreset} from '../game/qualityPreset';
import {festivalPoolCountForPreset,getHeroBalloonLightTarget,getSceneFestivalLightPool,subscribeSceneFestivalLightPool} from '../game/pointLightPool';

const TILE_RADIUS_SQ = 140 * 140;
const FLAME_RADIUS_SQ = 55 * 55;
const MIN_LIGHT_SPACING_SQ = 2.0 * 2.0;

/** Dynamic pool of lights distributing radiant illumination across nearby candles and surroundings. */
export function FestivalLighting({night}:{night:boolean}){
 const {scene}=useThree();
 const preset=useQualityPreset();
 const subscribePool=useCallback((listener:()=>void)=>subscribeSceneFestivalLightPool(scene,listener),[scene]);
 const readPool=useCallback(()=>getSceneFestivalLightPool(scene),[scene]);
 const sharedPool=useSyncExternalStore(subscribePool,readPool,readPool);
 const desiredCount=festivalPoolCountForPreset(preset);
 const localLights=useMemo(
  ()=>sharedPool?[]:Array.from({length:desiredCount},()=>new PointLight(CANDLE_LIGHT_COLOR,0,16,1.5)),
  [sharedPool,desiredCount]
 );
 const lights=sharedPool??localLights;
 const elapsed=useRef(1);
 const cacheAge=useRef(10);
 const lastSceneChildren=useRef(-1);
 const cachedGroups=useRef<Object3D[]>([]);
 const lit=useRef(0);

 // Reusable scratch buffers to avoid per-search heap allocations
 const candPos=useRef<number[][]>([]);
 const candDistSq=useRef<number[]>([]);
 const chosenX=useRef<Float64Array>(new Float64Array(8));
 const chosenZ=useRef<Float64Array>(new Float64Array(8));
 const chosenIdx=useRef<Int32Array>(new Int32Array(8));

 useEffect(()=>()=>{
  for(let i=0;i<lights.length;i++){
   lights[i].intensity=0;
   lights[i].distance=16;
   lights[i].decay=1.5;
  }
  for(let i=0;i<localLights.length;i++)localLights[i].dispose?.();
 },[lights,localLights]);

 useFrame(({scene:frameScene,camera,clock},dt)=>{
  if(lights.length===0)return;
  if(camera.position.y>220){
   lit.current=0;
   for(let i=0;i<lights.length;i++)lights[i].intensity=0;
   return;
  }
  const lamps=frameScene.userData.environmentLamps??(night?1:0);
  if(!night&&lamps<0.05){
   lit.current=0;
   for(let i=0;i<lights.length;i++)lights[i].intensity=0;
   return;
  }
  const heroTarget=preset.heroBalloonLight?getHeroBalloonLightTarget(frameScene):null;
  const heroSlotActive=Boolean(heroTarget&&heroTarget.active&&lights.length>1);
  const candleSlotBudget=heroSlotActive?lights.length-1:lights.length;

  elapsed.current+=dt;
  cacheAge.current+=dt;
  if(elapsed.current>0.2){
   elapsed.current=0;
   const groups=cachedGroups.current;
   if(cacheAge.current>1.5||frameScene.children.length!==lastSceneChildren.current){
    cacheAge.current=0;
    lastSceneChildren.current=frameScene.children.length;
    groups.length=0;
    for(let r=0;r<frameScene.children.length;r++){
     const root=frameScene.children[r];
     for(let c=0;c<root.children.length;c++){
      const child=root.children[c];
      if(child.name==='festival-candles')groups.push(child);
     }
    }
   }

   const focus=camera.userData.viewFocus??camera.position;
   const fx=focus.x;
   const fz=focus.z;
   const posBuf=candPos.current;
   const distBuf=candDistSq.current;
   let candCount=0;

   for(let g=0;g<groups.length;g++){
    const festival=groups[g];
    if(!festival.parent||!festival.visible)continue;
    const tiles=festival.children;
    for(let t=0;t<tiles.length;t++){
     const tile=tiles[t];
     if(!tile.visible)continue;
     const tdx=tile.position.x+32-fx;
     const tdz=tile.position.z+32-fz;
     if(tdx*tdx+tdz*tdz>TILE_RADIUS_SQ)continue;
     const flames=tile.userData.flamePositions as number[][]|undefined;
     if(!flames)continue;
     for(let f=0;f<flames.length;f++){
      const p=flames[f];
      const dx=p[0]-fx;
      const dz=p[2]-fz;
      const dSq=dx*dx+dz*dz;
      if(dSq<FLAME_RADIUS_SQ){
       posBuf[candCount]=p;
       distBuf[candCount]=dSq;
       candCount++;
      }
     }
    }
   }

   // Pick up to candleSlotBudget nearest flames obeying minimum horizontal spacing (zero allocations)
   const cx=chosenX.current;
   const cz=chosenZ.current;
   const cIdx=chosenIdx.current;
   let chosen=0;
   for(let slot=0;slot<candleSlotBudget;slot++){
    let bestJ=-1;
    let bestD=Infinity;
    for(let j=0;j<candCount;j++){
     const d=distBuf[j];
     if(d>=bestD)continue;
     const p=posBuf[j];
     let tooClose=false;
     for(let k=0;k<chosen;k++){
      const sdx=cx[k]-p[0];
      const sdz=cz[k]-p[2];
      if(sdx*sdx+sdz*sdz<=MIN_LIGHT_SPACING_SQ){
       tooClose=true;
       break;
      }
     }
     if(!tooClose){
      bestD=d;
      bestJ=j;
     }
    }
    if(bestJ<0)break;
    const picked=posBuf[bestJ];
    cIdx[chosen]=bestJ;
    cx[chosen]=picked[0];
    cz[chosen]=picked[2];
    lights[chosen].position.set(picked[0],picked[1]+0.15,picked[2]);
    lights[chosen].distance=16;
    lights[chosen].decay=1.5;
    chosen++;
   }
   lit.current=chosen;
  }

  const baseIntensity=1.8+1.8*lamps;
  const elapsedT=clock.elapsedTime*7.5;
  const activeCount=Math.min(lit.current,candleSlotBudget);
  for(let i=0;i<candleSlotBudget;i++){
   lights[i].intensity=i<activeCount?baseIntensity*(1+0.08*Math.sin(elapsedT+i*2.3)):0;
  }
  if(heroSlotActive&&heroTarget){
   const heroLight=lights[lights.length-1];
   heroLight.position.set(heroTarget.x,heroTarget.y,heroTarget.z);
   heroLight.distance=24;
   heroLight.decay=1.8;
   heroLight.intensity=heroTarget.intensity;
  }else if(candleSlotBudget<lights.length){
   lights[lights.length-1].intensity=0;
  }
 });
 if(sharedPool)return null;
 return <>{localLights.map((light,i)=><primitive key={i} object={light}/>)}</>;
}
