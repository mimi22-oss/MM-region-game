import { useEffect,useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { mobileQuality } from '../game/sceneBudget';
import { startupDiagnostics } from '../game/startupDiagnostics';
import { publishPerfSnapshot } from '../game/perfMetrics';
import { getRuntimePlatform } from '../services/platform';

/** Adapt laptops as well as phones, keeping DOM labels and controls sharp. */
export function FrameBudget({paused=false,onDprChange}:{paused?:boolean;onDprChange?:(dpr:number)=>void}){
 const setDpr=useThree(s=>s.setDpr),renderer=useThree(s=>s.gl),stats=useRef({seconds:0,frames:0,warmup:5,shadow:1,perfSeconds:0,perfFrames:0});
 useEffect(()=>{const original=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;return ()=>{renderer.shadowMap.autoUpdate=original;renderer.shadowMap.needsUpdate=true;};},[renderer]);
 const firstFrameRecorded = useRef(false);
 useFrame(({gl},dt)=>{
  if (!firstFrameRecorded.current) {
   firstFrameRecorded.current = true;
   startupDiagnostics.record('first-frame', { calls: gl.info.render.calls, triangles: gl.info.render.triangles });
  }
  if(document.hidden)return;
  stats.current.shadow+=dt;
  const shadowInterval=mobileQuality?1/10:1/20;
  if(stats.current.shadow>=shadowInterval){gl.shadowMap.needsUpdate=true;stats.current.shadow=0;}
  if(paused)return;
  const s=stats.current;
  const safeDt=Math.min(dt,.25);
  // Report actual elapsed frame time; clamping hides the stalls we are measuring.
  s.perfSeconds+=dt;s.perfFrames++;
  if(s.perfSeconds>=1){
   const fps=Math.round((s.perfFrames/s.perfSeconds)*10)/10;
   const avgFrameMs=s.perfFrames>0?Math.round((s.perfSeconds*1000/s.perfFrames)*10)/10:0;
   const mem=(performance as unknown as {memory?:{usedJSHeapSize?:number}}).memory;
   const heapUsedMb=mem&&typeof mem.usedJSHeapSize==='number'?Math.round((mem.usedJSHeapSize/(1024*1024))*10)/10:null;
   publishPerfSnapshot({
    fps,
    avgFrameMs,
    dpr:gl.getPixelRatio(),
    drawCalls:gl.info.render.calls,
    triangles:gl.info.render.triangles,
    geometries:gl.info.memory.geometries,
    textures:gl.info.memory.textures,
    heapUsedMb,
    platform:getRuntimePlatform(),
    updatedAt:Date.now(),
   });
   s.perfSeconds=0;s.perfFrames=0;
  }
  if(s.warmup>0){s.warmup-=dt;return}
  s.seconds+=safeDt;s.frames++;
  if(s.seconds<3)return;
  const dpr=gl.getPixelRatio();
  if(s.frames/s.seconds<(mobileQuality?26:40)&&dpr>.75){
   const next=dpr>1?1:dpr>.85?.85:.75;
   // Canvas re-applies its dpr prop on parent renders. Keep that prop in sync
   // or walking HUD updates continually undo adaptation and resize the canvas.
   (onDprChange??setDpr)(next);
  }
  s.seconds=0;s.frames=0;
 });
 return null;
}
