import { angle, toWorld } from '../../wards/myothar/area5.ts';
export { angle, toWorld };
import type { House, RoadPlot, FieldPlot, TreePlot, EastWestCanalPlot, PondPlot, VillageMeta } from '../../types.ts';

/**
 * ထောက်ကြန့်ကျေးရွာနှင့် ကြာအင်းကျေးရွာကြား ခြားထားသော လယ်ကွင်းများ
 * (AH1 ဘေးနှစ်ဖက်၊ v = 3540, 3600၊ စုစုပေါင်း ကွင်း ၂၀)
 */
export const kyarInnSeparationFields: FieldPlot[] = [3540, 3600].flatMap((v, row) =>
	[-225, -180, -135, -90, -45, 45, 90, 135, 180, 225].map((u, col) => ({
		id: `htaukkyant-kyarinn-sep-field-${row}-${col}`,
		row,
		u,
		v,
		...toWorld(u, v),
		width: 40,
		depth: 45,
		rotation: angle,
		color: ['#8ca65c', '#a6af68', '#7e9c55', '#96a85d', '#86a257'][(row + col) % 5],
	}))
);

/**
 * ကြာအင်းကျေးရွာ မြောက်ဘက်အဝင်ရှိ သပြေချောင်း (Taphi Chaung) နှင့် တံတား
 * (AH1 ပေါ်ရှိ တံတား: u = 0, v = 3645)
 */
export const kyarInnTaphiChaung: EastWestCanalPlot = {
	id: 'kyarinn-taphi-chaung',
	name: 'သပြေချောင်း (Taphi Chaung) နှင့် တံတား',
	u: 0,
	v: 3645,
	uMin: -290,
	uMax: 240,
	...toWorld(0, 3645),
	width: 5,
	depth: 530,
	rotation: angle,
	bridges: [{ u: 0, v: 3645, width: 14, depth: 8 }],
};

// ကြာအင်းကျေးရွာ အရှေ့-အနောက် လမ်းသွယ်များ (v = 3675 မှ 4035 အထိ)
export const kyarInnLanes = [3675, 3710, 3745, 3780, 3815, 3850, 3885, 3920, 3955, 3990, 4025];
// ရွာတွင်း မြောက်-တောင် လမ်းသွယ်များ (အနောက်ဘက် ၆ လမ်း၊ အရှေ့ဘက် ၄ လမ်း)
export const kyarInnCrossLanes = [-210, -172, -134, -96, -58, 56, 98, 140, 182];

// AH1 အနောက်ဘက်ခြမ်း အိမ်အကွက် ၆ ကွက်
const westBlockCols = [
	[-22, -32],
	[-48, -60],
	[-86, -98],
	[-124, -136],
	[-162, -174],
	[-200, -212],
];

// AH1 အရှေ့ဘက်ခြမ်း အိမ်အကွက် ၄ ကွက်
const eastBlockCols = [
	[22, 32],
	[50, 62],
	[92, 104],
	[134, 146],
	[176, 188],
];

const houses: House[] = [];

/**
 * ကြာအင်းကျေးရွာ၏ အထင်ကရ အဆောက်အအုံများ:
 * - Kyarinn middle school (အလက ကြာအင်း - ရွာလယ်ခေါင် အရှေ့ဘက်ခြမ်း: u = 70, v = 3850)
 * - Kyarinn Baptist Church (အနောက်ဘက်ခြမ်း၊ မြောက်ပိုင်း: u = -60, v = 3745)
 * - IBC Kyarinn (အနောက်ဘက်ခြမ်း၊ တောင်ပိုင်းအလယ်: u = -76, v = 3920)
 * - CJC Church Kyar Inn (အနောက်ဘက် အစွန်ပိုင်း: u = -146, v = 3890)
 * - St. Peter Catholic Church (အရှေ့ဘက်ခြမ်း၊ တောင်ပိုင်း: u = 60, v = 3945)
 */
export type KyarInnLandmarkBuilding = House & {
	kind:
		| 'school-hall'
		| 'school-wing'
		| 'school-office'
		| 'church-baptist'
		| 'church-ibc'
		| 'church-cjc'
		| 'church-catholic';
	height: number;
	steepleHeight?: number;
};

export const kyarInnLandmarkBuildings: KyarInnLandmarkBuilding[] = [
	// -------------------------------------------------------------------------
	// ၁။ အလက ကြာအင်း (Kyarinn middle school) အဆောက်အအုံများ (ဂြိုဟ်တုပုံအတိုင်း)
	// -------------------------------------------------------------------------
	// မြောက်ဘက် စာသင်ဆောင် ၁ (သွပ်ပြာရောင်အမိုးရှည်)
	{
		id: 'ki-school-north-hall-1',
		name: 'အလက ကြာအင်း မြောက်ဘက်ဆောင် ၁',
		kind: 'school-hall',
		height: 6.5,
		...toWorld(50, 3816),
		width: 32,
		depth: 9.5,
		color: '#e4decb',
		rotation: angle,
		roof: '#7fa2b2',
	},
	// မြောက်ဘက် စာသင်ဆောင် ၂ (သွပ်ပြာရောင်အမိုးရှည်)
	{
		id: 'ki-school-north-hall-2',
		name: 'အလက ကြာအင်း မြောက်ဘက်ဆောင် ၂',
		kind: 'school-hall',
		height: 6.5,
		...toWorld(86, 3816),
		width: 34,
		depth: 9.5,
		color: '#e4decb',
		rotation: angle,
		roof: '#7fa2b2',
	},
	// မြောက်ဘက် အနောက်စွန်း ရုံးခန်းဆောင် (အညိုရောင်အမိုး)
	{
		id: 'ki-school-office',
		name: 'အလက ကြာအင်း ရုံးခန်းဆောင်',
		kind: 'school-office',
		height: 5.5,
		...toWorld(25, 3816),
		width: 14,
		depth: 8,
		color: '#dad3c2',
		rotation: angle,
		roof: '#984a3b',
	},
	// အရှေ့ဘက် စာသင်ဆောင်ကြီး (မြေနီရောင်/ကြက်သွေးရောင် အမိုး)
	{
		id: 'ki-school-east-hall',
		name: 'အလက ကြာအင်း အရှေ့ဘက် ပင်မဆောင်',
		kind: 'school-wing',
		height: 6.5,
		...toWorld(116, 3848),
		width: 11,
		depth: 42,
		color: '#e5dfd2',
		rotation: angle,
		roof: '#963e32',
	},
	// အရှေ့ဘက် စာသင်ဆောင် တောင်ဘက်တိုးချဲ့ဆောင် (မြေနီရောင်အမိုး)
	{
		id: 'ki-school-east-wing',
		name: 'အလက ကြာအင်း အရှေ့တောင်ဆောင်',
		kind: 'school-wing',
		height: 6,
		...toWorld(116, 3880),
		width: 11,
		depth: 22,
		color: '#e5dfd2',
		rotation: angle,
		roof: '#963e32',
	},

	// -------------------------------------------------------------------------
	// ၂။ ခရစ်ယာန် ဘုရားကျောင်းများ (Churches)
	// -------------------------------------------------------------------------
	// Kyarinn Baptist Church (မိန်းလမ်းမကြီး အနောက်ဘက်ခြမ်း၊ မြောက်ပိုင်း)
	{
		id: 'ki-church-baptist',
		name: 'Kyarinn Baptist Church',
		kind: 'church-baptist',
		height: 8.5,
		steepleHeight: 14.5,
		...toWorld(-60, 3745),
		width: 22,
		depth: 16,
		color: '#f4f0e4',
		rotation: angle,
		roof: '#2d5a7d',
	},
	// IBC Kyarinn (မိန်းလမ်းမကြီး အနောက်ဘက်ခြမ်း၊ တောင်ပိုင်းအလယ်)
	{
		id: 'ki-church-ibc',
		name: 'IBC Kyarinn',
		kind: 'church-ibc',
		height: 7.5,
		steepleHeight: 12.5,
		...toWorld(-76, 3920),
		width: 20,
		depth: 14,
		color: '#eee4cb',
		rotation: angle,
		roof: '#8e4334',
	},
	// CJC Church Kyar Inn (အနောက်ဘက် ရွာအစွန်ပိုင်း)
	{
		id: 'ki-church-cjc',
		name: 'CJC Church Kyar Inn',
		kind: 'church-cjc',
		height: 7,
		steepleHeight: 11.5,
		...toWorld(-146, 3890),
		width: 18,
		depth: 14,
		color: '#e2dbcb',
		rotation: angle,
		roof: '#345e7d',
	},
	// St. Peter Catholic Church, Kyarinn (မိန်းလမ်းမကြီး အရှေ့ဘက်ခြမ်း၊ တောင်ပိုင်း)
	{
		id: 'ki-church-st-peter',
		name: 'St. Peter Catholic Church, Kyarinn',
		kind: 'church-catholic',
		height: 9,
		steepleHeight: 16,
		...toWorld(58, 3945),
		width: 24,
		depth: 16,
		color: '#ebe3d4',
		rotation: angle,
		roof: '#9b4234',
	},
];

/** ကြာအင်းကျေးရွာ အထင်ကရ နေရာများ (အလက ကျောင်းဝင်း/ကွင်းပြင်) */
export const kyarInnLandmarks = [
	{
		id: 'ki-school-field',
		name: 'Kyarinn Middle School Ground',
		...toWorld(68, 3855),
		width: 96,
		depth: 66,
		rotation: angle,
	},
];

/**
 * ကြာအင်းရေကန် (Kyar Inn Lake) နှင့် ငါးကန်/ကြာကန်များ
 * (ရွာ၏ အနောက်မြောက်ဘက်ခြမ်း: u = -226 မှ -438, v = 3560 မှ 3800)
 * Google Maps ဂြိုဟ်တုဓာတ်ပုံအတိုင်း တည်ဆောက်ထားသော ကန် ၁၇ ကန်:
 * - ပင်မ ကြာအင်းရေကန် (Kyar Inn Lake Pin နေရာ၊ ရေပေါ်နားနေဆောင်နှင့် ကူးတံတားပါဝင်)
 * - အနောက်မြောက် ရေကန်ကြီးနှင့် ကန်သွယ်
 * - ကုန်းမြေပါ ရေကန် (အလယ်တွင် ကျွန်းကုန်းမြေ ပါဝင်သော ကန်)
 * - အလယ် ရေကန်စုံ
 * - တောင်ဘက် ရေကန်ကြီးနှင့် တောင်ဘက်စွန်း ငါးမွေးမြူရေးကန်များ
 * - အရှေ့ဘက် စိမ်းလန်းသော ကန်စုံနှင့် ရေကန်ငယ်များ
 */
export const kyarInnLakePonds: PondPlot[] = [
	// ၁။ ပင်မ ကြာအင်းရေကန် (Kyar Inn Lake Pin နေရာ) — ရေပေါ်နားနေဆောင်နှင့် ကူးတံတား ပါဝင်သော ကန်ကျယ်
	{
		id: 'ki-pond-main-lake',
		name: 'ကြာအင်းရေကန် ပင်မကန် (Kyar Inn Lake)',
		u: -340,
		v: 3690,
		...toWorld(-340, 3690),
		width: 64,
		depth: 36,
		rotation: angle,
		color: '#387570',
	},
	// ၂။ အနောက်မြောက် ရေကန်ကြီး (အနောက်ဘက်စွန်း ရေကန်ကျယ်)
	{
		id: 'ki-pond-northwest-large',
		name: 'အနောက်မြောက် ရေကန်ကြီး',
		u: -400,
		v: 3630,
		...toWorld(-400, 3630),
		width: 76,
		depth: 72,
		rotation: angle,
		color: '#2e616f',
	},
	// ၃။ အနောက်မြောက် ကန်သွယ် (ရေကန်ကြီး မြောက်ဘက် ကန်သွယ်ရှည်)
	{
		id: 'ki-pond-north-narrow',
		name: 'အနောက်မြောက် ကန်သွယ်',
		u: -400,
		v: 3575,
		...toWorld(-400, 3575),
		width: 26,
		depth: 32,
		rotation: angle,
		color: '#326674',
	},
	// ၄။ ကုန်းမြေပါ ရေကန် (အလယ်တွင် ကုန်းမြေကျွန်း ပါရှိသော ကန်)
	{
		id: 'ki-pond-island-lake',
		name: 'ကုန်းမြေပါ ရေကန် (Island Lake)',
		u: -340,
		v: 3600,
		...toWorld(-340, 3600),
		width: 56,
		depth: 34,
		rotation: angle,
		color: '#2d626d',
	},
	// ၅။ အထက် ကန်ငယ် (ကျွန်းပါကန် မြောက်ဘက်)
	{
		id: 'ki-pond-north-top',
		name: 'အထက် ကန်ငယ်',
		u: -340,
		v: 3568,
		...toWorld(-340, 3568),
		width: 46,
		depth: 20,
		rotation: angle,
		color: '#346972',
	},
	// ၆။ အလယ် အထက်ကန်
	{
		id: 'ki-pond-mid-upper',
		name: 'အလယ် အထက်ကန်',
		u: -340,
		v: 3632,
		...toWorld(-340, 3632),
		width: 54,
		depth: 16,
		rotation: angle,
		color: '#346871',
	},
	// ၇။ အလယ် အောက်ကန်
	{
		id: 'ki-pond-mid-lower',
		name: 'အလယ် အောက်ကန်',
		u: -340,
		v: 3654,
		...toWorld(-340, 3654),
		width: 54,
		depth: 16,
		rotation: angle,
		color: '#366a74',
	},
	// ၈။ တောင်ဘက် ရေကန်ကြီး (ပင်မကန် တောင်ဘက် ကန်ကျယ်)
	{
		id: 'ki-pond-south-large',
		name: 'တောင်ဘက် ရေကန်ကြီး',
		u: -340,
		v: 3738,
		...toWorld(-340, 3738),
		width: 68,
		depth: 38,
		rotation: angle,
		color: '#31646d',
	},
	// ၉။ တောင်ဘက်စွန်း အနောက်ကန် (အစိမ်းနုရောင် ကန်ငယ်)
	{
		id: 'ki-pond-south-sw',
		name: 'တောင်ဘက်စွန်း အနောက်ကန်',
		u: -368,
		v: 3782,
		...toWorld(-368, 3782),
		width: 26,
		depth: 24,
		rotation: angle,
		color: '#4d8472',
	},
	// ၁၀။ တောင်ဘက်စွန်း အရှေ့ကန် (သိုလှောင်ရုံဘေး ငါးကန်)
	{
		id: 'ki-pond-south-se',
		name: 'တောင်ဘက်စွန်း အရှေ့ကန်',
		u: -324,
		v: 3782,
		...toWorld(-324, 3782),
		width: 48,
		depth: 24,
		rotation: angle,
		color: '#2e5c67',
	},
	// ၁၁။ အရှေ့မြောက် ကန်ငယ် ၁ ("ရေ" ကန်)
	{
		id: 'ki-pond-east-ne-1',
		name: 'အရှေ့မြောက် ကန်ငယ် ၁',
		u: -288,
		v: 3590,
		...toWorld(-288, 3590),
		width: 24,
		depth: 13,
		rotation: angle,
		color: '#346670',
	},
	// ၁၂။ အရှေ့မြောက် ကန်ငယ် ၂ ("ရေ" ကန်)
	{
		id: 'ki-pond-east-ne-2',
		name: 'အရှေ့မြောက် ကန်ငယ် ၂',
		u: -288,
		v: 3608,
		...toWorld(-288, 3608),
		width: 24,
		depth: 13,
		rotation: angle,
		color: '#346670',
	},
	// ၁၃။ အရှေ့ အလယ်ကန်
	{
		id: 'ki-pond-east-mid',
		name: 'အရှေ့ အလယ်ကန်',
		u: -288,
		v: 3644,
		...toWorld(-288, 3644),
		width: 26,
		depth: 32,
		rotation: angle,
		color: '#2b5e6a',
	},
	// ၁၄။ အရှေ့ဘက် စိမ်းလန်းသောကန် ၁
	{
		id: 'ki-pond-east-green-1',
		name: 'အရှေ့ဘက် စိမ်းလန်းသောကန် ၁',
		u: -258,
		v: 3666,
		...toWorld(-258, 3666),
		width: 28,
		depth: 18,
		rotation: angle,
		color: '#558a54',
	},
	// ၁၅။ အရှေ့ဘက် စိမ်းလန်းသောကန် ၂
	{
		id: 'ki-pond-east-green-2',
		name: 'အရှေ့ဘက် စိမ်းလန်းသောကန် ၂',
		u: -226,
		v: 3666,
		...toWorld(-226, 3666),
		width: 28,
		depth: 18,
		rotation: angle,
		color: '#558a54',
	},
	// ၁၆။ အရှေ့မြောက် ရေမြောင်းကန် (ချောင်းသဏ္ဌာန် ရေကန်ရှည်)
	{
		id: 'ki-pond-far-ne-channel',
		name: 'အရှေ့မြောက် ရေမြောင်းကန်',
		u: -246,
		v: 3585,
		...toWorld(-246, 3585),
		width: 56,
		depth: 22,
		rotation: angle,
		color: '#38706a',
	},
	// ၁၇။ အရှေ့တောင် ကန်ငယ်
	{
		id: 'ki-pond-east-se',
		name: 'အရှေ့တောင် ကန်ငယ်',
		u: -285,
		v: 3714,
		...toWorld(-285, 3714),
		width: 22,
		depth: 28,
		rotation: angle,
		color: '#366873',
	},
];

/** ကြာအင်းရေကန် ကုန်းမြေ (Island in ki-pond-island-lake) */
export const kyarInnLakeIsland = {
	id: 'ki-lake-island',
	name: 'ကြာအင်းရေကန် ကုန်းမြေ (Island)',
	u: -340,
	v: 3600,
	...toWorld(-340, 3600),
	width: 32,
	depth: 14,
	rotation: angle,
	color: '#4e8248',
};

/** ကြာအင်းရေကန် ရေပေါ်နားနေဆောင်၊ သစ်သားကူးတံတားနှင့် သိုလှောင်ရုံ/တဲများ */
export const kyarInnLakeStructures: House[] = [
	// ရေပေါ် နားနေဆောင် (Water Pavilion on stilts)
	{
		id: 'ki-lake-pavilion',
		name: 'ကြာအင်းရေကန် ရေပေါ်နားနေဆောင်',
		...toWorld(-336, 3704),
		width: 7.5,
		depth: 6,
		color: '#d6cbb5',
		roof: '#a44634',
		rotation: angle,
	},
	// ကန်ဘောင်မှ ရေပေါ်ဆောင်သို့ ကူးသော သစ်သားတံတား
	{
		id: 'ki-lake-footbridge',
		name: 'ရေပေါ်ဆောင် ကူးတံတား',
		...toWorld(-336, 3712),
		width: 2.2,
		depth: 10,
		color: '#9c7b5b',
		roof: '#7d5e42',
		rotation: angle,
	},
	// တောင်ဘက်စွန်း ငါးမွေးမြူရေး သိုလှောင်ရုံ/တဲကြီး
	{
		id: 'ki-lake-fishery-shed',
		name: 'ငါးမွေးမြူရေး သိုလှောင်ရုံ',
		...toWorld(-298, 3782),
		width: 12,
		depth: 6,
		color: '#c2b8a3',
		roof: '#7a8e94',
		rotation: angle,
	},
	// ရေပေါ်ဆောင် အနီး ကန်ဘောင်တဲ
	{
		id: 'ki-lake-hut-south',
		name: 'ကန်ဘောင် နားနေတဲ',
		...toWorld(-322, 3714),
		width: 5.5,
		depth: 4.5,
		color: '#cebe9e',
		roof: '#8d5042',
		rotation: angle,
	},
	// အနောက်မြောက် ကန်ကြီးဘေး တဲ
	{
		id: 'ki-lake-shelter-nw',
		name: 'အနောက်မြောက်ကန် စောင့်တဲ',
		...toWorld(-368, 3662),
		width: 6,
		depth: 4.5,
		color: '#d2c9b6',
		roof: '#48687b',
		rotation: angle,
	},
];

/** ကြာအင်းရေကန် ကန်ဘောင်လမ်းများနှင့် ဆက်သွယ်ရေးလမ်းများ */
export const kyarInnLakeRoads: RoadPlot[] = [
	// ကန်ဘောင် မြောက်-တောင် ပင်မလမ်း
	{
		id: 'ki-lake-spine-road',
		name: 'ကြာအင်းရေကန် ပင်မဘောင်လမ်း',
		...toWorld(-306, 3680),
		width: 4.5,
		depth: 250,
		rotation: angle,
		main: false,
	},
	// ရွာတွင်းမှ ရေကန်သို့ ဆက်သွယ်သော အရှေ့-အနောက် လမ်း ၁
	{
		id: 'ki-lake-access-road-1',
		name: 'ကြာအင်းရေကန် ဝင်လမ်း ၁',
		...toWorld(-258, 3675),
		width: 4.5,
		depth: 100,
		rotation: angle,
		main: false,
	},
	// ရွာတွင်းမှ ရေကန်သို့ ဆက်သွယ်သော အရှေ့-အနောက် လမ်း ၂
	{
		id: 'ki-lake-access-road-2',
		name: 'ကြာအင်းရေကန် ဝင်လမ်း ၂',
		...toWorld(-270, 3745),
		width: 4.5,
		depth: 120,
		rotation: angle,
		main: false,
	},
];

/** ကြာအင်းရေကန် ကန်ဘောင် သစ်ပင်ရိပ်များ */
export const kyarInnLakeTrees: TreePlot[] = [
	[-306, 3570],
	[-306, 3620],
	[-306, 3660],
	[-306, 3700],
	[-306, 3740],
	[-306, 3780],
	[-372, 3600],
	[-372, 3665],
	[-372, 3720],
	[-372, 3760],
	[-440, 3610],
	[-440, 3655],
	[-340, 3712],
	[-322, 3720],
].map(([u, v], i) => ({
	id: `ki-lake-tree-${i}`,
	...toWorld(u, v),
	radius: 0.9,
}));

// လူနေအိမ်ခြေများ ထည့်သွင်းခြင်း (ကျောင်းဝင်းနှင့် ဘုရားကျောင်းနေရာများ ချန်လှပ်သည်)
for (let rowBlock = 0; rowBlock < kyarInnLanes.length - 1; rowBlock++) {
	const baseV = kyarInnLanes[rowBlock];
	for (const offsetV of [11, 23]) {
		const v = baseV + offsetV;

		// အနောက်ဘက်ခြမ်း အိမ်များ
		for (let colBlock = 0; colBlock < westBlockCols.length; colBlock++) {
			// Kyarinn Baptist Church နေရာ (u = -60, v = 3745)
			if (v >= 3735 && v <= 3760 && colBlock === 1) continue;
			// IBC Kyarinn နေရာ (u = -76, v = 3920)
			if (v >= 3910 && v <= 3935 && (colBlock === 1 || colBlock === 2)) continue;
			// CJC Church နေရာ (u = -146, v = 3890)
			if (v >= 3880 && v <= 3905 && colBlock === 3) continue;
			// ရွာအစွန် ကွေးဝိုက်ချက်များ
			if (rowBlock === 0 && colBlock >= 4) continue;
			if (rowBlock >= 9 && colBlock >= 5) continue;

			for (const u of westBlockCols[colBlock]) {
				const i = houses.length;
				houses.push({
					id: `kyarinn-h${i + 1}`,
					name: `ကြာအင်းအိမ် ${i + 1}`,
					...toWorld(u, v),
					width: 7.5,
					depth: 6.5,
					color: ['#d8c7a3', '#bd9973', '#a9b9b0', '#c7b299'][(i + rowBlock + colBlock) % 4],
					rotation: angle,
					roof: ['#8b5545', '#849699', '#a39a85', '#7d6655'][(i + rowBlock + colBlock) % 4],
				});
			}
		}

		// အရှေ့ဘက်ခြမ်း အိမ်များ
		for (let colBlock = 0; colBlock < eastBlockCols.length; colBlock++) {
			// အလက ကြာအင်း ကျောင်းဝင်းနှင့် ကွင်းပြင်ကြီး နေရာ (u = 18..126, v = 3810..3895)
			if (v >= 3810 && v <= 3895 && colBlock <= 2) continue;
			// St. Peter Catholic Church နေရာ (u = 58, v = 3945)
			if (v >= 3935 && v <= 3960 && (colBlock === 1 || colBlock === 2)) continue;
			// ရွာအစွန်ပိုင်းများ
			if (rowBlock === 0 && colBlock >= 3) continue;
			if (rowBlock >= 9 && colBlock >= 4) continue;

			for (const u of eastBlockCols[colBlock]) {
				const i = houses.length;
				houses.push({
					id: `kyarinn-h${i + 1}`,
					name: `ကြာအင်းအိမ် ${i + 1}`,
					...toWorld(u, v),
					width: 7.5,
					depth: 6.5,
					color: ['#d8c7a3', '#bd9973', '#a9b9b0', '#c7b299'][(i + rowBlock + colBlock) % 4],
					rotation: angle,
					roof: ['#8b5545', '#849699', '#a39a85', '#7d6655'][(i + rowBlock + colBlock) % 4],
				});
			}
		}
	}
}

houses.push(...kyarInnLandmarkBuildings);

const roads: RoadPlot[] = [
	// AH1 ပင်မလမ်းမကြီး ရွာလယ်အပိုင်း
	{
		id: 'kyarinn-main-road',
		name: 'AH1 ကြာအင်းလမ်းမကြီး',
		...toWorld(0, 3850),
		width: 10,
		depth: 380,
		rotation: angle,
		main: true,
	},
	// အရှေ့-အနောက် ရွာတွင်းလမ်းသွယ်များ
	...kyarInnLanes.map((v, i) => ({
		id: `kyarinn-ew-lane-${i + 1}`,
		name: `ကြာအင်း လမ်းသွယ် ${i + 1}`,
		...toWorld(0, v),
		width: 380,
		depth: 4,
		rotation: angle,
		main: false,
	})),
	// မြောက်-တောင် လမ်းသွယ်များ
	...kyarInnCrossLanes.map((u, i) => ({
		id: `kyarinn-ns-lane-${i + 1}`,
		name: `ကြာအင်း အတွင်းလမ်း ${i + 1}`,
		...toWorld(u, 3850),
		width: 4.5,
		depth: 370,
		rotation: angle,
		main: false,
	})),
];

// ရွာအနောက်ဘက် လယ်ကွင်းများ (အနောက်မြောက်ဘက် ကြာအင်းရေကန်နေရာမှအပ ကျန်နေရာများ)
const bundedFields: FieldPlot[] = [
	// ရေကန်များ အနောက်ဘက်စွန်း လယ်ကွင်းများ (v = 3680, 3740, 3800)
	...[3680, 3740, 3800].flatMap((v, row) =>
		[-475, -520].map((u, col) => ({
			id: `kyarinn-west-paddy-${row}-${col}`,
			row,
			u,
			v,
			...toWorld(u, v),
			width: 42,
			depth: 54,
			rotation: angle,
			color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
		}))
	),
	// ရေကန်များ တောင်ဘက် လယ်ကွင်းများ (v = 3860, 3920, 3980)
	...[3860, 3920, 3980].flatMap((v, row) =>
		[-250, -295, -340, -385, -430].map((u, col) => ({
			id: `kyarinn-west-paddy-${row + 3}-${col}`,
			row: row + 3,
			u,
			v,
			...toWorld(u, v),
			width: 42,
			depth: 54,
			rotation: angle,
			color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
		}))
	),
];

// ရွာအရှေ့ဘက် လယ်ကွင်းများ
const fields: FieldPlot[] = [3680, 3740, 3800, 3860, 3920, 3980].flatMap((v, row) =>
	[220, 265, 310].map((u, col) => ({
		id: `kyarinn-east-field-${row}-${col}`,
		u,
		v,
		...toWorld(u, v),
		width: 42,
		depth: 54,
		rotation: angle,
		color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
	}))
);

// AH1 လမ်းဘေး သစ်ပင်တန်း
const trees: TreePlot[] = [-12, 12].flatMap((u, sideIdx) =>
	[3680, 3710, 3740, 3770, 3800, 3830, 3860, 3890, 3920, 3950, 3980, 4010].map((v, i) => ({
		id: `kyarinn-canopy-${sideIdx}-${i}`,
		...toWorld(u, v),
		radius: 0.55,
	}))
);

// သပြေချောင်းဘေး၊ ဘုရားကျောင်းများနှင့် အလက ကျောင်းဝန်းပတ်လည် သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
	// သပြေချောင်းဘေး သစ်ပင်ကြီးများ
	[-180, 3645],
	[-100, 3645],
	[-30, 3645],
	[30, 3645],
	[100, 3645],
	[180, 3645],
	// အလက ကြာအင်း ကျောင်းဝန်းပတ်လည်
	[18, 3816],
	[18, 3888],
	[125, 3816],
	[125, 3892],
	[68, 3892],
	// Kyarinn Baptist Church ပတ်လည်
	[-46, 3745],
	[-74, 3745],
	// IBC Kyarinn ပတ်လည်
	[-64, 3920],
	[-88, 3920],
	// St. Peter Catholic Church ပတ်လည်
	[44, 3945],
	[72, 3945],
].map(([u, v], i) => ({
	id: `kyarinn-shade-${i}`,
	...toWorld(u, v),
	radius: 1.15,
}));

// ရွာအစွန် လယ်ကွင်းစပ် သစ်ပင်များ
const farmTrees: TreePlot[] = [3680, 3740, 3800, 3860, 3920, 3980].flatMap((v, i) => [
	{ id: `kyarinn-west-farm-tree-${i}`, ...toWorld(-240, v), radius: 0.5 },
	{ id: `kyarinn-east-farm-tree-${i}`, ...toWorld(210, v), radius: 0.5 },
]);

/**
 * ကြာအင်းကျေးရွာ (Kyar Inn Village · Kalay Township)
 * ထောက်ကြန့်ကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြားတွင် တည်ရှိသည်။
 * ရွာလယ်ခေါင် အရှေ့ဘက်ခြမ်းတွင် အလက ကြာအင်း (Kyarinn middle school)၊
 * Kyarinn Baptist Church၊ IBC Kyarinn၊ St. Peter Catholic Church၊ CJC Church နှင့်
 * မြောက်ဘက်အဝင်တွင် သပြေချောင်း (Taphi Chaung) တို့ ပါဝင်သည်။
 */
export const kyarInnVillage: VillageMeta = {
	id: 'kyarinn',
	name: 'ကြာအင်းရွာ',
	englishName: 'Kyar Inn Village',
	villageTract: 'ကြာအင်းကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
	description:
		'ထောက်ကြန့်ကျေးရွာနှင့် ဝေပုလ္လတောင်ကြား၊ အလက ကြာအင်းကျောင်း၊ Kyarinn Baptist Church၊ IBC Kyarinn၊ St. Peter Catholic Church၊ CJC Church၊ သပြေချောင်း နှင့် အနောက်မြောက်ဘက် ကြာအင်းရေကန် (Kyar Inn Lake) တို့ ပါဝင်သော ကြာအင်းကျေးရွာ',
	coordinates: { lat: 23.068, lng: 94.02 },
	...toWorld(0, 3850),
	labelPos: toWorld(0, 3825),
	separationFields: kyarInnSeparationFields,
	canal: kyarInnTaphiChaung,
	houses: [...houses, ...kyarInnLakeStructures],
	roads: [...roads, ...kyarInnLakeRoads],
	fields,
	bundedFields,
	ponds: kyarInnLakePonds,
	trees,
	largeTrees: [...largeTrees, ...kyarInnLakeTrees],
	farmTrees,
};
