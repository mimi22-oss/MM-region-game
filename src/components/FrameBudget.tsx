import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { mobileQuality } from '../game/sceneBudget';
/** Reduce pixel work on slower phones; never increase it mid-session. */
export function FrameBudget(){
 const setDpr=useThree(s=>s.setDpr),stats=useRef({seconds:0,frames:0,dpr:1,warmup:5});
 useFrame((_,dt)=>{if(!mobileQuality||document.hidden)return;
  const s=stats.current;if(s.warmup>0){s.warmup-=dt;return}
  s.seconds+=Math.min(dt,.25);s.frames++;
  if(s.seconds<3)return;
  if(s.frames/s.seconds<26&&s.dpr>.75){s.dpr=.75;setDpr(s.dpr)}
  s.seconds=0;s.frames=0;
 });
 return null;
}
