import { Area5, Area5Plan, Warehouses, FootballPitch } from './Area5';
import { MyotharCenter, MyotharCenterPlan } from './center';

export { Area5, Area5Plan, Warehouses, FootballPitch, MyotharCenter, MyotharCenterPlan };

/**
 * မြို့သာရပ်ကွက် 3D Component
 * နယ်မြေ (၅) နှင့် မြို့သာရပ်ကွက် အလယ်ခေါင် (နယ်မြေ ၁ မှ ၇) စုစည်းမှု
 */
export function MyotharWard(){
 return <group name="ward-myothar">
  <Area5/>
  <MyotharCenter/>
 </group>;
}

/** မြို့သာရပ်ကွက် 2D Map Plan Component */
export function MyotharWardPlan({labels,onSelectLocation}:{labels:boolean;onSelectLocation?:(id:string)=>void}){
 return <g id="ward-myothar-plan">
  <Area5Plan labels={labels} onSelectLocation={onSelectLocation}/>
  <MyotharCenterPlan labels={labels} onSelectLocation={onSelectLocation}/>
 </g>;
}

