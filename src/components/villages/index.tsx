import { TharSiVillage, TharSiVillagePlan } from './tharsi';
import { ChinSaiVillage, ChinSaiVillagePlan } from './chinsai';

export { TharSiVillage, TharSiVillagePlan, ChinSaiVillage, ChinSaiVillagePlan };

/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) ၏ 3D နှင့် 2D Map Plan Components စုစည်းမှု။
 */
export function KalayVillages(){
 return <group name="kalay-villages">
  <TharSiVillage/>
  <ChinSaiVillage/>
 </group>;
}

export function KalayVillagesPlan({labels}:{labels:boolean}){
 return <g id="kalay-villages-plan">
  <TharSiVillagePlan labels={labels}/>
  <ChinSaiVillagePlan labels={labels}/>
 </g>;
}
