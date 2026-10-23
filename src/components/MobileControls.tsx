import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent } from 'react';
import { MobileGesture, type MobileInput } from '../game/mobileInput';

export function MobileControls({input,disabled,onInteract}:{input:RefObject<MobileInput>;disabled:boolean;onInteract:()=>void}){
 const gesture=useRef(new MobileGesture(input.current));
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),[held,setHeld]=useState(false);
 const clear=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;gesture.current.clear();setHeld(false)},[]);
 useEffect(()=>{clear();const visibility=()=>{if(document.hidden)clear()};const media=matchMedia('(max-width: 760px), (hover: none) and (pointer: coarse)');const changed=()=>{if(!media.matches)clear()};window.addEventListener('blur',clear);document.addEventListener('visibilitychange',visibility);media.addEventListener('change',changed);return ()=>{clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',changed)}},[disabled,clear]);
 const down=(e:PointerEvent<HTMLDivElement>,side:'left'|'right')=>{
  if(disabled||e.button!==0)return;e.preventDefault();e.stopPropagation();
  const direction=(e.target as HTMLElement).closest<HTMLElement>('[data-direction]')?.dataset.direction??'up';
  gesture.current.down(e.pointerId,side,e.clientX,e.clientY,direction);
  e.currentTarget.setPointerCapture(e.pointerId);onInteract();
  if(side==='left'&&!timer.current)timer.current=setTimeout(()=>{timer.current=null;gesture.current.hold();setHeld(input.current.active)},220);
  setHeld(input.current.active);
 };
 const move=(e:PointerEvent<HTMLDivElement>)=>{e.preventDefault();gesture.current.move(e.pointerId,e.clientX,e.clientY);setHeld(input.current.active||gesture.current.pinching)};
 const release=(e:PointerEvent<HTMLDivElement>)=>{gesture.current.up(e.pointerId);if(!gesture.current.fingers.size&&timer.current){clearTimeout(timer.current);timer.current=null}setHeld(input.current.active||gesture.current.pinching)};
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
