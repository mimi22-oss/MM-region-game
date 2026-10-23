import { MyotharWard, MyotharWardPlan, Area5, Area5Plan } from './myothar';

export { MyotharWard, MyotharWardPlan, Area5, Area5Plan };

/**
 * ကလေးမြို့ရှိ ရပ်ကွက်ပေါင်း ၂၀ ကျော်ကို ရပ်ကွက်အလိုက် folder ခွဲ၍ စုစည်းထားသော 3D Component
 */
export function KalayWards(){
 return <group name="kalay-wards">
  <MyotharWard/>
 </group>;
}

/** ကလေးမြို့ရှိ ရပ်ကွက်များ၏ 2D Map Plan Component */
export function KalayWardsPlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 return <g id="kalay-wards-plan">
  <MyotharWardPlan labels={labels} onSelectLocation={onSelectLocation}/>
 </g>;
}

