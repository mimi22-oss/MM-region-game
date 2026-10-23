import { Area5, Area5Plan, Warehouses, FootballPitch } from './Area5';

export { Area5, Area5Plan, Warehouses, FootballPitch };

/**
 * မြို့သာရပ်ကွက် 3D Component
 * နောက်ပိုင်းတွင် နယ်မြေ (၁)၊ (၂)၊ (၃)၊ (၄) စသည့် နယ်မြေ component များကို ဤနေရာတွင် ထပ်ပေါင်းထည့်နိုင်ပါသည်။
 */
export function MyotharWard(){
 return <group name="ward-myothar">
  <Area5/>
 </group>;
}

/** မြို့သာရပ်ကွက် 2D Map Plan Component */
export function MyotharWardPlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 return <g id="ward-myothar-plan">
  <Area5Plan labels={labels} onSelectLocation={onSelectLocation}/>
 </g>;
}

