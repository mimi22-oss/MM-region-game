import { angle, toWorld } from './area5.ts';

export interface ShweMyanmarBuilding {
	id: string;
	name: string;
	u: number;
	v: number;
	x: number;
	z: number;
	width: number;
	depth: number;
	height: number;
	color: string;
	roof: string;
	rotation: number;
}

/**
 * သိုလှောင်ရုံတန်း · မြို့သာ နယ်မြေ (၅) တောင်ဘက်ပိုင်း နေရာ ၄ ခု ဒေတာ
 * ၁။ ဆန်စက် (AH1 အနောက်ဘက်၊ လမ်းသွယ်တောင်ဘက်)
 * ၂။ မြေကွက်လပ် (AH1 အရှေ့ဘက်၊ လမ်းသွယ်တောင်ဘက်)
 * ၃။ ရွှေမြန်မာ စက်သုံးဆီဆိုင် (AH1 အရှေ့ဘက်၊ လမ်းသွယ်မြောက်ဘက်)
 * ၄။ လူနေရပ်ကွက် (AH1 အနောက်ဘက်၊ လမ်းသွယ်မြောက်ဘက်)
 * ၅။ မိန်းလမ်းမကြီးကို ကန့်လန့်ဖြတ်သန်းသွားသော လမ်းသွယ်လေး (v = -250)
 */

// ၁။ ရွှေမြန်မာ စက်သုံးဆီဆိုင် (AH1 အရှေ့ဘက်)
export const shweMyanmarFuelStation = {
	id: 'shwe-myanmar-fuel',
	name: 'ရွှေမြန်မာ စက်သုံးဆီဆိုင်',
	refU: 5.926,
	refV: -258.972,
	...toWorld(5.926, -258.972),
	rotation: angle,
	// ကွန်ကရစ် အဝင်ခြံဝင်း ပြင် (Forecourt Pavement)
	pavement: {
		u: 28,
		v: -274,
		...toWorld(28, -274),
		width: 44,
		depth: 38,
		rotation: angle,
		color: '#cfd4d8',
	},
	// ဆီဖြည့် ခုံးမကြီး (Canopy)
	canopy: {
		u: 22,
		v: -272,
		...toWorld(22, -272),
		width: 16,
		depth: 24,
		clearance: 5.2,
		roofThickness: 0.85,
		rotation: angle,
		fasciaColor: '#c92a2a', // Shwe Myanmar Red
		stripeColor: '#1864ab', // Blue Stripe
		roofColor: '#f8f9fa',
		columns: [
			{ u: 16, v: -264 },
			{ u: 28, v: -264 },
			{ u: 16, v: -280 },
			{ u: 28, v: -280 },
		].map(p => ({ ...p, ...toWorld(p.u, p.v) })),
	},
	// ဆီဖြည့်ပန့်ခုံများ (Fuel Dispenser Islands)
	islands: [
		{
			id: 'island-1',
			u: 16,
			v: -272,
			...toWorld(16, -272),
			width: 2.2,
			depth: 18,
			rotation: angle,
			pumps: [
				{ id: 'p1-oct92', u: 16, v: -268, ...toWorld(16, -268), type: 'Octane 92', color: '#2b8a3e' },
				{ id: 'p1-oct95', u: 16, v: -272, ...toWorld(16, -272), type: 'Octane 95', color: '#e03131' },
				{ id: 'p1-diesel', u: 16, v: -276, ...toWorld(16, -276), type: 'Diesel', color: '#f59f00' },
			],
		},
		{
			id: 'island-2',
			u: 28,
			v: -272,
			...toWorld(28, -272),
			width: 2.2,
			depth: 18,
			rotation: angle,
			pumps: [
				{ id: 'p2-oct92', u: 28, v: -268, ...toWorld(28, -268), type: 'Octane 92', color: '#2b8a3e' },
				{ id: 'p2-oct95', u: 28, v: -272, ...toWorld(28, -272), type: 'Octane 95', color: '#e03131' },
				{ id: 'p2-diesel', u: 28, v: -276, ...toWorld(28, -276), type: 'Diesel', color: '#f59f00' },
			],
		},
	],
	// စတိုးဆိုင်နှင့် ရုံးခန်း အဆောက်အအုံ (Convenience Store / Office)
	office: {
		id: 'fuel-office-shop',
		name: 'ရွှေမြန်မာ စတိုးနှင့်ရုံးခန်း',
		u: 46,
		v: -272,
		...toWorld(46, -272),
		width: 18,
		depth: 15,
		height: 4.4,
		color: '#ece8df',
		roof: '#343a40',
		rotation: angle,
	},
	// လမ်းဘေး ဆိုင်းဘုတ်တိုင်ကြီး (Totem / Price Pole Sign)
	totem: {
		u: 8.5,
		v: -285,
		...toWorld(8.5, -285),
		width: 2.6,
		depth: 1.0,
		height: 7.6,
		rotation: angle,
		title: 'ရွှေမြန်မာ စက်သုံးဆီ',
	},
	// မြေအောက်ဆီကန် အဖုံးများ (Underground Tank Manholes)
	tanks: [
		{ u: 38, v: -262, ...toWorld(38, -262), radius: 0.7 },
		{ u: 38, v: -265, ...toWorld(38, -265), radius: 0.7 },
		{ u: 38, v: -268, ...toWorld(38, -268), radius: 0.7 },
	],
	// ခြံစည်းရိုး နံရံ (Perimeter Wall)
	walls: [
		{ u: 51, v: -255, ...toWorld(51, -255), width: 1.0, depth: 36, rotation: angle },
		{ u: 29, v: -293, ...toWorld(29, -293), width: 44, depth: 1.0, rotation: angle },
	],
};

// ၂။ ဆန်စက် (AH1 အနောက်ဘက်)
export const shweMyanmarRiceMill = {
	id: 'myothar-rice-mill',
	name: 'ဆန်စက်ရုံဝင်း',
	refU: -5.675,
	refV: -238.528,
	...toWorld(-5.675, -238.528),
	rotation: angle,
	// အဓိက ဆန်စက်ရုံ အဆောက်အအုံကြီး (Main Mill Hall)
	mainBuilding: {
		id: 'ricemill-main-hall',
		name: 'ဆန်စက်ရုံ အဆောက်အအုံကြီး',
		u: -54,
		v: -236,
		...toWorld(-54, -236),
		width: 34,
		depth: 20,
		height: 8.8,
		color: '#c5bda8',
		roof: '#707f7c', // Corrugated steel roof
		rotation: angle,
	},
	// စပါးသိုလှောင်ရုံကြီး (Paddy Storage Shed)
	storageBuilding: {
		id: 'ricemill-paddy-shed',
		name: 'စပါးသိုလှောင်ရုံကြီး',
		u: -54,
		v: -220,
		...toWorld(-54, -220),
		width: 28,
		depth: 16,
		height: 7.2,
		color: '#baae96',
		roof: '#835446',
		rotation: angle,
	},
	// စပါးလှန်း ကုန်လန်းပြင် (Concrete Drying Yard)
	dryingYard: {
		u: -24,
		v: -232,
		...toWorld(-24, -232),
		width: 32,
		depth: 26,
		rotation: angle,
		color: '#d4cbb5',
	},
	// အဝဝင် ဂိတ်တဲနှင့် ချိန်ခွင်ရုံး (Gate Office & Weighbridge)
	gateOffice: {
		id: 'ricemill-gate-office',
		name: 'ဆန်စက် အဝင်ဂိတ်ရုံး',
		u: -11,
		v: -242,
		...toWorld(-11, -242),
		width: 6,
		depth: 5,
		height: 3.5,
		color: '#d6cdb8',
		roof: '#5c6f68',
		rotation: angle,
	},
	// ဆန်စက် အဝင်ဆိုင်းဘုတ် မုခ်ဦး (Mill Entrance Arch)
	entranceGate: {
		u: -7.5,
		v: -238.5,
		...toWorld(-7.5, -238.5),
		width: 1.2,
		depth: 9.0,
		rotation: angle,
		title: 'ဆန်စက်',
	},
	// ခြံစည်းရိုး အုတ်တံတိုင်း (Perimeter Walls)
	walls: [
		{ u: -38, v: -246.5, ...toWorld(-38, -246.5), width: 60, depth: 0.8, rotation: angle },
		{ u: -38, v: -212.5, ...toWorld(-38, -212.5), width: 60, depth: 0.8, rotation: angle },
		{ u: -69, v: -229.5, ...toWorld(-69, -229.5), width: 0.8, depth: 34, rotation: angle },
	],
};

// ၃။ မြေကွက်လပ် / ဝိုင်းအလွတ်မြေ (AH1 အရှေ့ဘက်)
export const shweMyanmarVacantLot = {
	id: 'myothar-vacant-lot',
	name: 'မြေကွက်လပ် (ဝိုင်းအလွတ်မြေ)',
	refU: 4.377,
	refV: -241.137,
	...toWorld(4.377, -241.137),
	rotation: angle,
	// အလွတ်မြေကွက် မျက်နှာပြင် (Lot Ground)
	ground: {
		u: 44,
		v: -231,
		...toWorld(44, -231),
		width: 72,
		depth: 28,
		rotation: angle,
		color: '#a3ad7f',
	},
	// စိုက်ခင်း/ခြံစောင့် သစ်သားတဲလေး (Field Shed)
	shed: {
		id: 'vacant-lot-shed',
		name: 'ကွက်လပ်စောင့် တဲအိမ်ငယ်',
		u: 65,
		v: -226,
		...toWorld(65, -226),
		width: 6.5,
		depth: 5.5,
		height: 3.2,
		color: '#9c8162',
		roof: '#735b44',
		rotation: angle,
	},
	// ခြံစည်းရိုး (Fence boundaries)
	fences: [
		{ u: 44, v: -245.5, ...toWorld(44, -245.5), width: 72, depth: 0.4, rotation: angle },
		{ u: 44, v: -216.5, ...toWorld(44, -216.5), width: 72, depth: 0.4, rotation: angle },
		{ u: 80.5, v: -231, ...toWorld(80.5, -231), width: 0.4, depth: 29, rotation: angle },
	],
	// သစ်ပင်ရိပ်များ (Shade Trees)
	trees: [
		{ u: 22, v: -222, ...toWorld(22, -222), radius: 2.2 },
		{ u: 42, v: -220, ...toWorld(42, -220), radius: 2.4 },
		{ u: 58, v: -238, ...toWorld(58, -238), radius: 2.0 },
		{ u: 74, v: -222, ...toWorld(74, -222), radius: 2.5 },
	],
	// ဆိုင်းဘုတ် (Lot Sign)
	sign: {
		u: 8.5,
		v: -242,
		...toWorld(8.5, -242),
		title: 'ဝိုင်းအလွတ်မြေ',
	},
};

// ၄။ လူနေရပ်ကွက် (AH1 အနောက်ဘက်)
export const shweMyanmarResidential = {
	id: 'myothar-residential',
	name: 'လူနေရပ်ကွက်',
	refU: -6.836,
	refV: -261.719,
	...toWorld(-6.836, -261.719),
	rotation: angle,
	// သိန်းထိုက်စံ ဆောက်လုပ်ရေးပစ္စည်း အရောင်းဆိုင် (Building Materials Store)
	store: {
		id: 'thein-htike-san-store',
		name: 'သိန်းထိုက်စံ ဆောက်လုပ်ရေးပစ္စည်းဆိုင်',
		u: -16,
		v: -286,
		...toWorld(-16, -286),
		width: 14,
		depth: 11,
		height: 4.8,
		color: '#dcd3be',
		roof: '#3a6677',
		rotation: angle,
		storefront: {
			title: 'သိန်းထိုက်စံ',
			subtitle: 'ဆောက်လုပ်ရေးပစ္စည်း အရောင်းဆိုင်',
		},
	},
	// လူနေအိမ်များ (Residential Myanmar Houses)
	houses: [
		{
			id: 'res-house-1',
			name: 'လူနေအိမ် ၁ (နှစ်ထပ်တိုက်)',
			u: -28,
			v: -264,
			...toWorld(-28, -264),
			width: 11,
			depth: 9.5,
			height: 6.2,
			color: '#d6c6a8',
			roof: '#835446',
			rotation: angle,
		},
		{
			id: 'res-house-2',
			name: 'လူနေအိမ် ၂ (ပျဉ်ထောင်အိမ်ကြီး)',
			u: -52,
			v: -264,
			...toWorld(-52, -264),
			width: 12,
			depth: 10,
			height: 5.6,
			color: '#9f8263',
			roof: '#547967',
			rotation: angle,
		},
		{
			id: 'res-house-3',
			name: 'လူနေအိမ် ၃ (ခြံဝင်းအိမ်)',
			u: -36,
			v: -278,
			...toWorld(-36, -278),
			width: 10.5,
			depth: 9,
			height: 5.2,
			color: '#dfd2ba',
			roof: '#738382',
			rotation: angle,
		},
		{
			id: 'res-house-4',
			name: 'လူနေအိမ် ၄ (ဥယျာဉ်အိမ်)',
			u: -60,
			v: -278,
			...toWorld(-60, -278),
			width: 11.5,
			depth: 9.5,
			height: 5.4,
			color: '#a88d6e',
			roof: '#855444',
			rotation: angle,
		},
		{
			id: 'res-house-5',
			name: 'လူနေအိမ် ၅ (လမ်းဘေးအိမ်)',
			u: -40,
			v: -292,
			...toWorld(-40, -292),
			width: 10,
			depth: 8.5,
			height: 5.0,
			color: '#dcd0bc',
			roof: '#657e75',
			rotation: angle,
		},
	],
	// ခြံစည်းရိုးများနှင့် သစ်ပင်များ
	trees: [
		{ u: -18, v: -272, ...toWorld(-18, -272), radius: 2.2 },
		{ u: -42, v: -268, ...toWorld(-42, -268), radius: 2.4 },
		{ u: -68, v: -266, ...toWorld(-68, -266), radius: 2.5 },
		{ u: -24, v: -288, ...toWorld(-24, -288), radius: 2.1 },
		{ u: -54, v: -288, ...toWorld(-54, -288), radius: 2.3 },
	],
};

// ၅။ ကန့်လန့်ဖြတ် လမ်းသွယ် (Cross Road based on map4.png)
export interface ShweMyanmarRoadSegment {
	id: string;
	name: string;
	u: number;
	v: number;
	x: number;
	z: number;
	width: number;
	depth: number;
	rotation: number;
	main: boolean;
	color: string;
}

export const shweMyanmarCrossRoads: ShweMyanmarRoadSegment[] = [
	// အရှေ့ဘက်ခြမ်း လမ်းသွယ် (East branch south of Vacant Lot running E-SE)
	{
		id: 'cross-east-1',
		name: 'ကန့်လန့်ဖြတ်လမ်းသွယ် (မြေကွက်လပ်တောင်ဘက် အရှေ့ခြမ်း ၁)',
		u: 33,
		v: -205,
		...toWorld(33, -205),
		width: 55,
		depth: 6.0,
		rotation: angle + Math.atan2(6, 54),
		main: false,
		color: '#555f5c',
	},
	{
		id: 'cross-east-2',
		name: 'ကန့်လန့်ဖြတ်လမ်းသွယ် (အရှေ့တောင်ပိုင်း ၂)',
		u: 89,
		v: -198,
		...toWorld(89, -198),
		width: 63,
		depth: 6.0,
		rotation: angle + Math.atan2(8, 62),
		main: false,
		color: '#555f5c',
	},
	// အနောက်ဘက်ခြမ်း လမ်းသွယ် (West branch south of Rice Mill curving NW)
	{
		id: 'cross-west-1',
		name: 'ကန့်လန့်ဖြတ်လမ်းသွယ် (ဆန်စက်တောင်ဘက် အနောက်ခြမ်း ၁)',
		u: -21,
		v: -211,
		...toWorld(-21, -211),
		width: 31,
		depth: 5.5,
		rotation: angle + Math.atan2(-6, -30),
		main: false,
		color: '#555f5c',
	},
	{
		id: 'cross-west-2',
		name: 'ကန့်လန့်ဖြတ်လမ်းသွယ် (ဆန်စက်အနောက်ဘက် ကွေ့ ၂)',
		u: -51,
		v: -219,
		...toWorld(-51, -219),
		width: 36,
		depth: 5.5,
		rotation: angle + Math.atan2(-12, -34),
		main: false,
		color: '#555f5c',
	},
	{
		id: 'cross-west-3',
		name: 'ကန့်လန့်ဖြတ်လမ်းသွယ် (အနောက်မြောက်ဘက် ဆက် ၃)',
		u: -75.5,
		v: -234.5,
		...toWorld(-75.5, -234.5),
		width: 28,
		depth: 5.5,
		rotation: angle + Math.atan2(-21, -19),
		main: false,
		color: '#555f5c',
	},
];

