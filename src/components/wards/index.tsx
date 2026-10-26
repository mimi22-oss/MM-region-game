import { MyotharWard, MyotharWardPlan, Area5, Area5Plan } from './myothar';
import { KalayArea1, KalayArea1Plan } from './kalayArea1';

export { MyotharWard, MyotharWardPlan, Area5, Area5Plan, KalayArea1, KalayArea1Plan };

/**
 * ကလေးမြို့ရှိ ရပ်ကွက်ပေါင်း ၂၀ ကျော်ကို ရပ်ကွက်အလိုက် folder ခွဲ၍ စုစည်းထားသော 3D Component
 */
export function KalayWards(){
 return <group name="kalay-wards">
  <MyotharWard/>
  <KalayArea1/>
 </group>;
}

/** ကလေးမြို့ရှိ ရပ်ကွက်များ၏ 2D Map Plan Component */
export function KalayWardsPlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 return <g id="kalay-wards-plan">
  <MyotharWardPlan labels={labels} onSelectLocation={onSelectLocation}/>
  <KalayArea1Plan labels={labels} onSelectLocation={onSelectLocation}/>
 </g>;
}

