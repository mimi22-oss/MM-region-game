import { useEffect,useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { mobileQuality } from '../game/sceneBudget';
import { startupDiagnostics } from '../game/startupDiagnostics';

/** Adapt laptops as well as phones, keeping DOM labels and controls sharp. */
export function FrameBudget({paused=false}:{paused?:boolean}){
 const setDpr=useThree(s=>s.setDpr),renderer=useThree(s=>s.gl),stats=useRef({seconds:0,frames:0,warmup:5,shadow:1});
 useEffect(()=>{const original=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;return ()=>{renderer.shadowMap.autoUpdate=original;renderer.shadowMap.needsUpdate=true;};},[renderer]);
 const firstFrameRecorded = useRef(false);
 useFrame(({gl},dt)=>{
  if (!firstFrameRecorded.current) {
   firstFrameRecorded.current = true;
   startupDiagnostics.record('first-frame', { calls: gl.info.render.calls, triangles: gl.info.render.triangles });
  }
  if(document.hidden)return;
  stats.current.shadow+=dt;
  if(stats.current.shadow>=1/20){gl.shadowMap.needsUpdate=true;stats.current.shadow=0;}
  if(paused)return;
  const s=stats.current;if(s.warmup>0){s.warmup-=dt;return}
  s.seconds+=Math.min(dt,.25);s.frames++;
  if(s.seconds<3)return;
  const dpr=gl.getPixelRatio();
  if(s.frames/s.seconds<(mobileQuality?26:40)&&dpr>.75)setDpr(dpr>1?1:dpr>.85?.85:.75);
  s.seconds=0;s.frames=0;
 });
 return null;
}
