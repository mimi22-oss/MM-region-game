import { Area5, Area5Plan, Warehouses, FootballPitch } from './Area5';
import { MyotharCenter, MyotharCenterPlan } from './center';
import { KalayArea1, KalayArea1Plan } from '../kalayArea1';

export { Area5, Area5Plan, Warehouses, FootballPitch, MyotharCenter, MyotharCenterPlan, KalayArea1, KalayArea1Plan };

/**
 * မြို့သာရပ်ကွက် 3D Component
 * နယ်မြေ (၅)၊ မြို့သာရပ်ကွက် အလယ် (နယ်မြေ ၁ မှ ၇) နှင့် ကလေးမြို့ နယ်မြေ (၁) စုစည်းမှု
 */
export function MyotharWard() {
	return <group name="ward-myothar">
		<Area5 />
		<MyotharCenter />
		<KalayArea1 />
	</group>;
}

/** မြို့သာရပ်ကွက် 2D Map Plan Component */
export function MyotharWardPlan({ labels, onSelectLocation }: { labels: boolean; onSelectLocation?: (id: string) => void }) {
	return <g id="ward-myothar-plan">
		<Area5Plan labels={labels} onSelectLocation={onSelectLocation} />
		<MyotharCenterPlan labels={labels} onSelectLocation={onSelectLocation} />
		<KalayArea1Plan labels={labels} onSelectLocation={onSelectLocation} />
	</g>;
}

