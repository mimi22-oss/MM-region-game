import {useEffect,useRef} from 'react';
import {useAppearance} from '../game/appearanceStore';
import {shouldUseGlbCharacter,useCharacterRendererMode} from '../game/characterRenderer';
import {
 listSpecialActions,
 setSpecialActionLoop,
 stopSpecialAction,
 toggleSpecialAction,
 useSpecialAction,
} from '../game/specialActions';
import type {CharacterKind} from './CharacterPicker';

interface ActionMenuProps{
 open:boolean;
 onOpenChange:(open:boolean)=>void;
 character:CharacterKind;
 disabledReason?:string|null;
}

export function ActionMenu({open,onOpenChange,character,disabledReason}:ActionMenuProps){
 const actions=listSpecialActions('dance');
 const special=useSpecialAction();
 const appearance=useAppearance();
 const rendererMode=useCharacterRendererMode();
 const wrapRef=useRef<HTMLDivElement>(null);

 const glbCapable=character==='cartoon'&&shouldUseGlbCharacter(appearance.human.preset,rendererMode);
 const unavailableMessage=
  disabledReason??
  (!glbCapable?'အကကစားရန် GLB Boy သို့မဟုတ် Girl ဇာတ်ကောင်ကို ရွေးချယ်ထားရမည်။':null);

 const isPlaying=special.activeActionId!==null;
 const activeDef=actions.find(item=>item.id===special.activeActionId);

 useEffect(()=>{
  if(!open)return;
  const onPointerDown=(e:PointerEvent)=>{
   if(wrapRef.current&&!wrapRef.current.contains(e.target as Node)){
    onOpenChange(false);
   }
  };
  document.addEventListener('pointerdown',onPointerDown);
  return ()=>document.removeEventListener('pointerdown',onPointerDown);
 },[open,onOpenChange]);

 return (
  <div className="action-menu-wrap" ref={wrapRef}>
   <button
    type="button"
    className={`action-menu-trigger${isPlaying||open?' location-btn-active':''}`}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label="အထူးလှုပ်ရှားမှု (Action Menu)"
    title="အကများ (Special Action Menu)"
    onClick={()=>{
     if(document.pointerLockElement)document.exitPointerLock();
     onOpenChange(!open);
    }}
   >
    <svg
     width="22"
     height="22"
     viewBox="0 0 24 24"
     fill="none"
     stroke="currentColor"
     strokeWidth="2"
     strokeLinecap="round"
     strokeLinejoin="round"
     aria-hidden="true"
    >
     <circle cx="12" cy="4.5" r="2.2" />
     <path d="M7.5 10.5 12 8.5l4.5 2M12 8.5v5.2l-3.2 5.3M12 13.7l3.2 5.3" />
    </svg>
   </button>

   {open&&(
    <div
     className="action-menu-popover"
     role="dialog"
     aria-label="Dance Action Menu"
     onWheel={e=>e.stopPropagation()}
    >
     <div className="action-menu-header">
      <div>
       <strong>Action Menu · အက</strong>
       <span className="action-menu-subtitle">
        {activeDef
         ?`${activeDef.label} (${special.status==='loading'?'Loading…':'Playing'})`
         :'Select a dance · လှုပ်ရှားမှုရွေးပါ'}
       </span>
      </div>
      <button
       type="button"
       className="action-menu-close"
       aria-label="Action Menu ပိတ်မည်"
       onClick={()=>onOpenChange(false)}
      >
       ✕
      </button>
     </div>

     {unavailableMessage&&(
      <div className="action-menu-notice" role="status">
       {unavailableMessage}
      </div>
     )}

     {special.error&&(
      <div className="action-menu-notice action-menu-error" role="alert">
       {special.error}
      </div>
     )}

     <div className="action-menu-controls">
      <button
       type="button"
       className={`action-pill-btn${special.loop?' is-on':''}`}
       aria-pressed={special.loop}
       onClick={()=>setSpecialActionLoop(!special.loop)}
      >
       Loop: {special.loop?'ON':'OFF'}
      </button>
      <button
       type="button"
       className="action-pill-btn action-stop-btn"
       disabled={!isPlaying}
       onClick={()=>stopSpecialAction()}
      >
       Stop · ရပ်
      </button>
     </div>

     <div className="action-menu-grid">
      {actions.map(action=>{
       const selected=special.activeActionId===action.id;
       const loading=selected&&special.status==='loading';
       return (
        <button
         key={action.id}
         type="button"
         className={`action-dance-btn${selected?' is-active':''}`}
         disabled={Boolean(unavailableMessage)}
         aria-pressed={selected}
         onClick={()=>{
          toggleSpecialAction(action.id);
          onOpenChange(false);
         }}
        >
         <span className="action-dance-title">{action.label}</span>
         <span className="action-dance-meta">
          {loading?'Loading…':selected?'Playing':`${action.myanmarLabel} · ${Math.round(action.durationSec)}s`}
         </span>
        </button>
       );
      })}
     </div>
    </div>
   )}
  </div>
 );
}
