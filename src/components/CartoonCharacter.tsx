import {lazy,Suspense,useEffect,useState,type RefObject} from 'react';
import {HUMAN_PRESETS,type HumanAppearance} from '../data/appearance';
import {
 shouldUseGlbCharacter,
 useCharacterRendererMode,
} from '../game/characterRenderer';
// Previous boy renderer: import {BlenderCharacter} from './BlenderCharacter';
import {GlbHuman} from './GlbHuman';

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
export function CartoonCharacter({appearance=HUMAN_PRESETS.boy,...props}:{appearance?:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>}){
 const [failed,setFailed]=useState<string|null>(null);
 const rendererMode=useCharacterRendererMode();
 const useGlb=shouldUseGlbCharacter(appearance.preset,rendererMode);
 useEffect(()=>{setFailed(null);},[rendererMode,appearance.preset]);
 // Previous 3D boy route (replaced by src/assets/boy.glb and girl.glb):
 // return <BlenderCharacter appearance={appearance} {...props}/>;
 // Keep the authored renderer available for family presets or when toggled to `'code'`.
 return useGlb&&failed!==appearance.preset
  ?<GlbHuman key={appearance.preset} preset={appearance.preset as 'boy'|'girl'} appearance={appearance} {...props} onError={()=>setFailed(appearance.preset)}/>
  :<Suspense fallback={null}><ProceduralHuman appearance={appearance} {...props}/></Suspense>;
}
