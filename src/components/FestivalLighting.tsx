import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {PointLight} from 'three';
import {CANDLE_LIGHT_COLOR} from '../game/candleModel';
/** Dynamic pool of lights distributing radiant illumination across nearby candles and surroundings. */
export function FestivalLighting({night}:{night:boolean}){
 const lights=useMemo(()=>Array.from({length:8},()=>new PointLight(CANDLE_LIGHT_COLOR,0,16,1.5)),[]),elapsed=useRef(1),lit=useRef(0);
 useFrame(({scene,camera,clock},dt)=>{
  elapsed.current+=dt;
  if(elapsed.current>.2){
   elapsed.current=0;
   const focus=camera.userData.viewFocus??camera.position,candidates:{p:number[];distance:number}[]=[];
   for(const root of scene.children){
    const festival=root.children.find(child=>child.name==='festival-candles');if(!festival)continue;
    for(const tile of festival.children){
     if(!tile.visible||Math.hypot(tile.position.x+32-focus.x,tile.position.z+32-focus.z)>140)continue;
     for(const p of tile.userData.flamePositions as number[][]){const distance=Math.hypot(p[0]-focus.x,p[2]-focus.z);if(distance<55)candidates.push({p,distance});}
    }
   }
   candidates.sort((a,b)=>a.distance-b.distance);
   const selected:typeof candidates=[];
   for(const candidate of candidates){if(selected.every(s=>Math.hypot(s.p[0]-candidate.p[0],s.p[2]-candidate.p[2])>2.0))selected.push(candidate);if(selected.length===lights.length)break;}
   lit.current=selected.length;selected.forEach(({p},i)=>lights[i].position.set(p[0],p[1]+.15,p[2]));
  }
  const baseIntensity=night?3.6:1.8;
  lights.forEach((light,i)=>{light.intensity=i<lit.current?baseIntensity*(1+.08*Math.sin(clock.elapsedTime*7.5+i*2.3)):0;});
 });
 return <>{lights.map((light,i)=><primitive key={i} object={light}/>)}</>;
}

