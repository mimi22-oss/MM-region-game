import { TharSiVillage, TharSiVillagePlan } from './tharsi';
import { ChinSaiVillage, ChinSaiVillagePlan } from './chinsai';
import { ZingalinVillage, ZingalinVillagePlan } from './zingalin';
import { HtomarVillage, HtomarVillagePlan } from './htomar';
import { TharYarGoneVillage, TharYarGoneVillagePlan } from './tharyargone';
import { HtaukKyantVillage, HtaukKyantVillagePlan } from './htaukkyant';
import { KyarInnVillage, KyarInnVillagePlan } from './kyarinn';

export {
	TharSiVillage,
	TharSiVillagePlan,
	ChinSaiVillage,
	ChinSaiVillagePlan,
	ZingalinVillage,
	ZingalinVillagePlan,
	HtomarVillage,
	HtomarVillagePlan,
	TharYarGoneVillage,
	TharYarGoneVillagePlan,
	HtaukKyantVillage,
	HtaukKyantVillagePlan,
	KyarInnVillage,
	KyarInnVillagePlan,
};

/**
 * ကလေးမြို့နယ်အတွင်းရှိ ကျေးရွာများ (Villages) ၏ 3D နှင့် 2D Map Plan Components စုစည်းမှု။
 */
export function KalayVillages() {
	return (
		<group name="kalay-villages">
			<TharSiVillage />
			<ChinSaiVillage />
			<ZingalinVillage />
			<HtomarVillage />
			<TharYarGoneVillage />
			<HtaukKyantVillage />
			<KyarInnVillage />
		</group>
	);
}

export function KalayVillagesPlan({
	labels,
	onSelectLocation,
}: {
	labels: boolean;
	onSelectLocation?: (id: string) => void;
}) {
	return (
		<g id="kalay-villages-plan">
			<TharSiVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
			<ChinSaiVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
			<ZingalinVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
			<HtomarVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
			<TharYarGoneVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
			<HtaukKyantVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
			<KyarInnVillagePlan labels={labels} onSelectLocation={onSelectLocation} />
		</g>
	);
}
