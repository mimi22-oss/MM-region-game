import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import { resetMobileInput, touchDirection, type MobileInput } from '../game/mobileInput';

type Touch={id:number;x:number;y:number;lastX:number;lastY:number;direction:string};
export function MobileControls({input,disabled,onInteract}:{input:RefObject<MobileInput>;disabled:boolean;onInteract:()=>void}){
 const left=useRef<Touch|null>(null),right=useRef<Touch|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),[held,setHeld]=useState(false);
 const clear=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;left.current=null;right.current=null;resetMobileInput(input.current);setHeld(false)},[input]);
 useEffect(()=>{clear();const visibility=()=>{if(document.hidden)clear()};const media=matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)');const changed=()=>{if(!media.matches)clear()};window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);media.addEventListener('change',changed);return ()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',changed)}},[disabled,clear]);
 const down=(e:PointerEvent<HTMLDivElement>,side:'left'|'right')=>{
  if(disabled||e.button!==0)return;e.preventDefault();e.stopPropagation();
  const slot=side==='left'?left:right;if(slot.current)return;
  const direction=(e.target as HTMLElement).closest<HTMLElement>('[data-direction]')?.dataset.direction??'up';
  slot.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,direction};e.currentTarget.setPointerCapture(e.pointerId);
  if(side==='right'){input.current.sprint=true;return}
  timer.current=setTimeout(()=>{if(!left.current)return;Object.assign(input.current,touchDirection(left.current.direction),{active:true,session:input.current.session+1});setHeld(true);onInteract()},220);
 };
 const move=(e:PointerEvent<HTMLDivElement>)=>{
  const r=right.current;if(r?.id===e.pointerId){input.current.lookX+=e.clientX-r.lastX;input.current.lookY+=e.clientY-r.lastY;r.lastX=e.clientX;r.lastY=e.clientY;return}
  const l=left.current;if(l?.id!==e.pointerId||!input.current.active)return;
  const dx=e.clientX-l.x,dy=e.clientY-l.y;if(Math.hypot(dx,dy)>24)Object.assign(input.current,touchDirection(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')));
 };
 const release=(e:PointerEvent<HTMLDivElement>)=>{
  if(left.current?.id===e.pointerId){if(timer.current)clearTimeout(timer.current);timer.current=null;left.current=null;input.current.active=false;input.current.forward=0;input.current.right=0;setHeld(false)}
  if(right.current?.id===e.pointerId){right.current=null;input.current.sprint=false;input.current.lookX=0;input.current.lookY=0}
 };
 if(disabled)return null;
 return <div className={`mobile-controls${held?' mobile-controls-held':''}`} onContextMenu={e=>e.preventDefault()}>
  <div className="mobile-move-zone" onPointerDown={e=>down(e,'left')} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
   <div className="mobile-direction-pad" aria-label="Movement directions">
    {['up','left','down','right'].map((direction,i)=><button key={direction} type="button" data-direction={direction} className={`mobile-arrow mobile-arrow-${direction}`} aria-label={`Move ${direction}`}>{['↑','←','↓','→'][i]}</button>)}
   </div>
  </div>
  <div className="mobile-run-zone" aria-label="Hold to sprint; drag to look around" onPointerDown={e=>down(e,'right')} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}/>
 </div>;
}
