import {lazy,Suspense,useState,type RefObject} from 'react';
import {HUMAN_PRESETS,type HumanAppearance} from '../data/appearance';
// Previous boy renderer: import {BlenderCharacter} from './BlenderCharacter';
import {GlbHuman} from './GlbHuman';

export type CharacterMotion={speed:number;distance:number;airborne?:boolean;jumpBend?:number;jumpVelocity?:number;swimming?:boolean;stepLift?:number;leftFoot?:number;rightFoot?:number};
export type DrivingPose={active:boolean;wheelAngle:number;interior:boolean;clutch:boolean;brake:boolean;throttle:boolean};
const ProceduralHuman=lazy(()=>import('./ProceduralHuman').then(module=>({default:module.CartoonCharacter})));

/** Boy/girl use the supplied GLBs everywhere this shared avatar is rendered. */
export function CartoonCharacter({appearance=HUMAN_PRESETS.boy,...props}:{appearance?:HumanAppearance;motion:RefObject<CharacterMotion>;riding?:boolean;driving?:RefObject<DrivingPose>}){
 const [failed,setFailed]=useState<string|null>(null);
 const supplied=appearance.preset==='boy'||appearance.preset==='girl';
 // Previous 3D boy route (replaced by src/assets/boy.glb and girl.glb):
 // return <BlenderCharacter appearance={appearance} {...props}/>;
 // Keep the authored renderer available for the other family presets.
 return supplied&&failed!==appearance.preset?<GlbHuman key={appearance.preset} preset={appearance.preset as 'boy'|'girl'} appearance={appearance} {...props} onError={()=>setFailed(appearance.preset)}/>:<Suspense fallback={null}><ProceduralHuman appearance={appearance} {...props}/></Suspense>;
}
