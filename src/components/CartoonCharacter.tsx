import {lazy,Suspense,useEffect,useState,type RefObject} from 'react';
import {HUMAN_PRESETS,type HumanAppearance} from '../data/appearance';
import {
 shouldUseGlbCharacter,
 useCharacterRendererMode,
} from '../game/characterRenderer';
import {BlenderCharacter} from './BlenderCharacter';
import {GlbHuman} from './GlbHuman';
import type {HorseRiderPose} from '../game/horseAnimation';

export {
 DEFAULT_CHARACTER_RENDERER,
 getCharacterRendererMode,
 setCharacterRendererMode,
 shouldUseGlbCharacter,
 toggleCharacterRendererMode,
 useCharacterRendererMode,
 type CharacterRendererMode,
} from '../game/characterRenderer';

export type CharacterMotion={speed:number;distance:number;airborne?:boolean;jumpBend?:number;jumpVelocity?:number;swimming?:boolean;stepLift?:number;leftFoot?:number;rightFoot?:number};
export type DrivingPose={active:boolean;wheelAngle:number;interior:boolean;clutch:boolean;brake:boolean;throttle:boolean};
const ProceduralHuman=lazy(()=>import('./ProceduralHuman').then(module=>({default:module.CartoonCharacter})));

/** Renders GLB (`boy.glb`/`girl.glb`) when enabled or falls back to `ProceduralHuman`. */
export function CartoonCharacter({appearance=HUMAN_PRESETS.boy,deferGlb=false,...props}:{appearance?:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>;horsePose?:RefObject<HorseRiderPose>;deferGlb?:boolean;combat?:boolean}){
 const [failed,setFailed]=useState<string|null>(null);
 const [glbUnlocked,setGlbUnlocked]=useState(!deferGlb);
 const rendererMode=useCharacterRendererMode();
 const useGlb=shouldUseGlbCharacter(appearance.preset,rendererMode);
 const useCanolia=rendererMode==='canolia'&&!props.horsePose;
 useEffect(()=>{if(!deferGlb)setGlbUnlocked(true);},[deferGlb]);
 useEffect(()=>{setFailed(null);},[rendererMode,appearance.preset]);
 if((useGlb||useCanolia)&&!glbUnlocked&&failed!==appearance.preset)return null;
 // Previous 3D boy route (replaced by src/assets/boy.glb and girl.glb):
 // return <BlenderCharacter appearance={appearance} {...props}/>;
 // Keep the authored renderer available for family presets or when toggled to `'code'`.
 if(useCanolia&&failed!==appearance.preset)return <BlenderCharacter appearance={appearance} {...props} onError={()=>setFailed(appearance.preset)}/>;
 return useGlb&&failed!==appearance.preset
  ?<GlbHuman key={appearance.preset} preset={appearance.preset as 'boy'|'girl'} appearance={appearance} {...props} onError={()=>setFailed(appearance.preset)}/>
  :<Suspense fallback={null}><ProceduralHuman appearance={appearance} {...props}/></Suspense>;
}
