import { ward, angle, toWorld } from '../data/ward.ts';

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * World (x, z) သြဒိနိတ်မှ AH1 လမ်းမကြီးအလိုက် Local (u, v) သြဒိနိတ်သို့ ပြောင်းလဲပေးသော function
 * u: အနောက် (-) မှ အရှေ့ (+)
 * v: မြောက် (-) မှ တောင် (+)
 */
export function toLocalUV(x: number, z: number): { u: number; v: number } {
	return {
		u: x * cosA - z * sinA,
		v: x * sinA + z * cosA,
	};
}

export type MapDestination = {
	id: string;
	label: string;
	title: string;
	subtitle: string;
	x: number;
	z: number;
	yaw: number;
	pitch: number;
	distance: number;
};

export const MAP_DESTINATIONS: MapDestination[] = [
	{
		id: 'myothar-area-5',
		label: 'မြို့သာရပ်ကွက် · နယ်မြေ (၅)',
		title: ward.name,
		subtitle: `AH1 · Myothar · ${ward.currentArea} · Kalay`,
		...ward.spawn,
		yaw: 0,
		pitch: -0.14,
		distance: 8,
	},
	{
		id: 'tharsi',
		label: 'သာစည်ရွာ',
		title: 'သာစည်ရွာ · ကလေးမြို့နယ်',
		subtitle: 'AH1 · Thar Si Village · Kalay',
		...toWorld(0, 796),
		yaw: Math.PI / 4,
		pitch: -0.18,
		distance: 12,
	},
	{
		id: 'chinsai',
		label: 'ချင်းဆိုင်ရွာ',
		title: 'ချင်းဆိုင်ရွာ · ကလေးမြို့နယ်',
		subtitle: 'AH1 · Chin Sai Village · Kalay',
		...toWorld(0, 1150),
		yaw: Math.PI / 4,
		pitch: -0.18,
		distance: 12,
	},
	{
		id: 'zingalin',
		label: 'ဇင်းကလင်းကျေးရွာ',
		title: 'ဇင်းကလင်းကျေးရွာ · ကလေးမြို့နယ်',
		subtitle: 'AH1 · Zingalin Village · Kalay',
		...toWorld(0, 1510),
		yaw: Math.PI / 4,
		pitch: -0.18,
		distance: 12,
	},
	{
		id: 'htomar',
		label: 'ထိုမာကျေးရွာ',
		title: 'ထိုမာကျေးရွာ · ကလေးမြို့နယ်',
		subtitle: 'East of AH1 · Htomar Village · Kalay',
		...toWorld(256, 1927),
		yaw: (-Math.PI * 3) / 4,
		pitch: -0.18,
		distance: 14,
	},
	{
		id: 'tharyargone',
		label: 'သာယာကုန်းကျေးရွာ',
		title: 'သာယာကုန်းကျေးရွာ · ကလေးမြို့နယ်',
		subtitle: 'AH1 · Thar Yar Gone Village · St. Assumption Church · Kalay',
		...toWorld(0, 2700),
		yaw: Math.PI / 4,
		pitch: -0.18,
		distance: 12,
	},
	{
		id: 'htaukkyant',
		label: 'ထောက်ကြန့်ကျေးရွာ',
		title: 'ထောက်ကြန့်ကျေးရွာ · ကလေးမြို့နယ်',
		subtitle: 'AH1 · Htauk Kyant Village · Pagoda · Playground · High School · Kalay',
		...toWorld(0, 3300),
		yaw: Math.PI / 4,
		pitch: -0.18,
		distance: 14,
	},
	{
		id: 'kyarinn',
		label: 'ကြာအင်းရွာ',
		title: 'ကြာအင်းရွာ · ကလေးမြို့နယ်',
		subtitle: 'AH1 · Kyar Inn Village · Middle School · Churches · Kalay',
		...toWorld(0, 3850),
		yaw: Math.PI / 4,
		pitch: -0.18,
		distance: 14,
	},
	{
		id: 'kyarinn-lake',
		label: 'ကြာအင်းရေကန်',
		title: 'ကြာအင်းရေကန် · ကလေးမြို့နယ်',
		subtitle: 'Kyar Inn Lake · Southwest of Kyar Inn · Ponds & Water Pavilion',
		...toWorld(-340, 3990),
		yaw: Math.PI / 4,
		pitch: -0.22,
		distance: 16,
	},
];

export type DetectedLocation = {
	id: string;
	label: string;
	title: string;
	subtitle: string;
	subArea?: string;
};

/**
 * လက်ရှိ World (x, z) တည်နေရာပေါ် မူတည်၍ ရောက်ရှိနေသော ရပ်ကွက်၊ ကျေးရွာနှင့် အထင်ကရ နေရာအမည်ကို တွက်ချက်ပေးသည်။
 * Robot ဖြင့် လမ်းလျှောက်သွားသည့်အခါဖြစ်စေ၊ Shift + Drag ဖြင့် မြေပုံဆွဲရွှေ့သည့်အခါဖြစ်စေ အလိုအလျောက် ပြောင်းလဲပေးရန် သုံးသည်။
 */
export function detectLocation(x: number, z: number): DetectedLocation {
	const { u, v } = toLocalUV(x, z);

	// ၁။ မြို့သာရပ်ကွက် · နယ်မြေ (၅) (v < 600)
	if (v < 600) {
		let subArea = 'မြို့သာရပ်ကွက် · နယ်မြေ (၅)';
		let title = ward.name;
		let subtitle = `AH1 · Myothar · ${ward.currentArea} · Kalay`;

		if (u <= -400 && v >= 20 && v <= 560) {
			subArea = 'တောင်ဖီလာတောင် · မြို့သာ နယ်မြေ (၅)';
			title = 'တောင်ဖီလာတောင် · မြို့သာရပ်ကွက်';
			subtitle = 'Taung Phi Lar Mountain · Myothar · နယ်မြေ (၅) · Kalay';
		} else if (u >= 152 && u <= 260 && v >= 25 && v <= 105) {
			subArea = 'မြို့သာ ဘုန်းတော်ကြီးကျောင်းဝင်း · နယ်မြေ (၅)';
			subtitle = 'Monastery Compound · Myothar · နယ်မြေ (၅) · Kalay';
		} else if (u >= 75 && u <= 150 && v >= 10 && v <= 118) {
			subArea = 'မြို့သာ ဘောလုံးကွင်း · နယ်မြေ (၅)';
			subtitle = 'Football Pitch · Myothar · နယ်မြေ (၅) · Kalay';
		} else if (u >= 40 && u <= 210 && v >= 295 && v <= 385) {
			subArea = 'ဆန်စက်နှင့် စပါးသိုလှောင်ရုံဝင်း · နယ်မြေ (၅)';
			subtitle = 'Rice Mill & Paddy Store · Myothar · နယ်မြေ (၅) · Kalay';
		} else if (Math.abs(u) <= 55 && v >= -95 && v <= 95) {
			subArea = 'သိုလှောင်ရုံတန်း · မြို့သာ နယ်မြေ (၅)';
			subtitle = 'AH1 Warehouses · Myothar · နယ်မြေ (၅) · Kalay';
		} else if (u >= 15 && u <= 145 && v >= 125 && v <= 255) {
			subArea = 'နယ်မြေ (၅) · ကွင်းဘေးအိမ်တန်း';
		} else if (u >= -190 && u <= -15 && v >= 125 && v <= 390) {
			subArea = 'နယ်မြေ (၅) · အနောက်ဘက်ရပ်ကွက်';
		}

		return {
			id: 'myothar-area-5',
			label: 'မြို့သာရပ်ကွက် · နယ်မြေ (၅)',
			title,
			subtitle,
			subArea,
		};
	}

	// ၂။ သာစည်ရွာ (600 <= v < 1015) — အနောက်ဘက် ၆ ရပ်ကွက် နှင့် အရှေ့ပိုင်းရပ်ကွက်
	if (v < 1015) {
		let subArea = 'သာစည်ရွာ';
		let title = 'သာစည်ရွာ · ကလေးမြို့နယ်';
		let subtitle = 'AH1 · Thar Si Village · Kalay';

		if (v >= 665 && v <= 935) {
			if (u >= -114 && u <= -10) {
				const wNum = v <= 796 ? '၁' : '၂';
				const wEn = v <= 796 ? '1' : '2';
				subArea = `သာစည်ရွာ · ရပ်ကွက် (${wNum})`;
				title = `သာစည်ရွာ · ရပ်ကွက် (${wNum}) · ကလေးမြို့နယ်`;
				subtitle = `Thar Si Village · Ward (${wEn}) · Kalay`;
			} else if (u >= -218 && u < -114) {
				const wNum = v <= 796 ? '၃' : '၄';
				const wEn = v <= 796 ? '3' : '4';
				subArea = `သာစည်ရွာ · ရပ်ကွက် (${wNum})`;
				title = `သာစည်ရွာ · ရပ်ကွက် (${wNum}) · ကလေးမြို့နယ်`;
				subtitle = `Thar Si Village · Ward (${wEn}) · Kalay`;
			} else if (u >= -330 && u < -218) {
				const wNum = v <= 796 ? '၅' : '၆';
				const wEn = v <= 796 ? '5' : '6';
				subArea = `သာစည်ရွာ · ရပ်ကွက် (${wNum})`;
				title = `သာစည်ရွာ · ရပ်ကွက် (${wNum}) · ကလေးမြို့နယ်`;
				subtitle = `Thar Si Village · Ward (${wEn}) · Kalay`;
			} else if (u >= 10 && u <= 65) {
				subArea = 'သာစည်ရွာ · အရှေ့ပိုင်းရပ်ကွက်';
				title = 'သာစည်ရွာ · အရှေ့ပိုင်းရပ်ကွက် · ကလေးမြို့နယ်';
				subtitle = 'Thar Si East Ward · AH1 East · Kalay';
			}
		}

		return {
			id: 'tharsi',
			label: 'သာစည်ရွာ',
			title,
			subtitle,
			subArea,
		};
	}

	// ၃။ ချင်းဆိုင်ရွာ (1015 <= v < 1320)
	if (v < 1320) {
		let subArea = 'ချင်းဆိုင်ရွာ';
		let subtitle = 'AH1 · Chin Sai Village · Kalay';

		if (u >= -85 && u <= -18 && v >= 1095 && v <= 1132) {
			subArea = 'မင်းကျောင်းကျောင်းတိုက် · ချင်းဆိုင်ရွာ';
			subtitle = 'မင်းကျောင်းကျောင်းတိုက် · Chin Sai Village · Kalay';
		} else if (u >= -85 && u <= -18 && v >= 1185 && v <= 1228) {
			subArea = 'ကမ္ဘာရန်ကင်းကျောင်းတိုက် · ချင်းဆိုင်ရွာ';
			subtitle = 'ကမ္ဘာရန်ကင်းကျောင်းတိုက် · Chin Sai Village · Kalay';
		}

		return {
			id: 'chinsai',
			label: 'ချင်းဆိုင်ရွာ',
			title: 'ချင်းဆိုင်ရွာ · ကလေးမြို့နယ်',
			subtitle,
			subArea,
		};
	}

	// ၄။ ဇင်းကလင်းကျေးရွာ (1320 <= v < 1650)
	if (v < 1650) {
		let subArea = 'ဇင်းကလင်းကျေးရွာ';
		let subtitle = 'AH1 · Zingalin Village · Kalay';

		if (u >= -105 && u <= -50 && v >= 1495 && v <= 1528) {
			subArea = 'ဇေတဝန်ကျောင်းတိုက် · ဇင်းကလင်းကျေးရွာ';
			subtitle = 'ဇေတဝန်ကျောင်းတိုက် · Zingalin Village · Kalay';
		} else if (Math.abs(u) <= 35 && v >= 1432 && v <= 1464) {
			subArea = 'ဇီးချောင်းတံတား · ဇင်းကလင်းကျေးရွာ';
			subtitle = 'Zee Chaung Bridge · Zingalin Village · Kalay';
		}

		return {
			id: 'zingalin',
			label: 'ဇင်းကလင်းကျေးရွာ',
			title: 'ဇင်းကလင်းကျေးရွာ · ကလေးမြို့နယ်',
			subtitle,
			subArea,
		};
	}

	// ၅။ ထိုမာကျေးရွာ (1650 <= v < 2350)
	if (v < 2350) {
		let subArea = 'ထိုမာကျေးရွာ';
		let title = 'ထိုမာကျေးရွာ · ကလေးမြို့နယ်';
		let subtitle = 'East of AH1 · Htomar Village · Kalay';

		if (u <= -20 && u >= -220 && v >= 1660 && v <= 1765) {
			subArea = 'GTHS (Khamtee) · ထိုမာကျေးရွာ';
			title = 'ထိုမာကျေးရွာ · GTHS (Khamtee)';
			subtitle = 'Government Technology High School (Khamtee) · Htomar · Kalay';
		} else if (u <= -20 && u >= -260 && v > 1765 && v <= 1885) {
			subArea = 'နည်းပညာတက္ကသိုလ် (ကလေး) · ထိုမာကျေးရွာ';
			title = 'ထိုမာကျေးရွာ · နည်းပညာတက္ကသိုလ် (ကလေး)';
			subtitle = 'Technological University, Kalay · Htomar · Kalay';
		} else if (u >= 335 && u <= 390 && v >= 1795 && v <= 1835) {
			subArea = 'အထက-ထိုမာ ကျောင်းဝင်း · ထိုမာကျေးရွာ';
			subtitle = 'BEHS Htomar · Htomar Village · Kalay';
		} else if (u >= 250 && u <= 520 && v >= 1730 && v <= 2130) {
			subArea = 'ထိုမာကျေးရွာ · အရှေ့ပိုင်း ပင်မရွာတွင်း';
		}

		return {
			id: 'htomar',
			label: 'ထိုမာကျေးရွာ',
			title,
			subtitle,
			subArea,
		};
	}

	// ၆။ သာယာကုန်းကျေးရွာ (2350 <= v < 2980)
	if (v < 2980) {
		let subArea = 'သာယာကုန်းကျေးရွာ';
		let subtitle = 'AH1 · Thar Yar Gone Village · St. Assumption Church · Kalay';

		if (u >= -170 && u <= -125 && v >= 2695 && v <= 2735) {
			subArea = 'St. Assumption Catholic Church · သာယာကုန်း';
			subtitle = 'St. Assumption Church · Thar Yar Gone Village · Kalay';
		} else if (u >= -255 && u <= -215 && v >= 2700 && v <= 2732) {
			subArea = "Kingdom Hall of Jehovah's Witnesses · သာယာကုန်း";
			subtitle = 'Kingdom Hall · Thar Yar Gone Village · Kalay';
		} else if (u >= 30 && u <= 75 && v >= 2885 && v <= 2925) {
			subArea = 'Thida Tun Rice Mill-2 ဆန်စက် · သာယာကုန်း';
			subtitle = 'Thida Tun Rice Mill-2 · Thar Yar Gone Village · Kalay';
		}

		return {
			id: 'tharyargone',
			label: 'သာယာကုန်းကျေးရွာ',
			title: 'သာယာကုန်းကျေးရွာ · ကလေးမြို့နယ်',
			subtitle,
			subArea,
		};
	}

	// ၇။ ထောက်ကြန့်ကျေးရွာ (2980 <= v < 3620)
	if (v < 3620) {
		let subArea = 'ထောက်ကြန့်ကျေးရွာ';
		let subtitle = 'AH1 · Htauk Kyant Village · Pagoda · Playground · High School · Kalay';

		if (u >= -125 && u <= -20 && v >= 3230 && v <= 3340) {
			subArea = 'အထက ထောက်ကြန့် ကျောင်းဝင်း';
			subtitle = 'BEHS Htauk Kyant · အထက ထောက်ကြန့် · Kalay';
		} else if (u >= 20 && u <= 72 && v >= 3245 && v <= 3320) {
			subArea = 'ထောက်ကြန့် ဘောလုံးကွင်း';
			subtitle = 'Htauk Kyant Football Playground · Kalay';
		} else if (u > 72 && u <= 155 && v >= 3235 && v <= 3315) {
			subArea = 'ထောက်ကြန့် စေတီတော်မြတ်ကြီးဝင်း';
			subtitle = 'Htauk Kyant Pagoda Compound · စေတီတော်မြတ် · Kalay';
		} else if (u >= 180 && u <= 285 && v >= 3100 && v <= 3340) {
			subArea = 'ထောက်ကြန့် ရေကန်ကြီးနှင့် ငါးကန်များ';
			subtitle = 'Htauk Kyant Lake & Fish Ponds · Kalay';
		}

		return {
			id: 'htaukkyant',
			label: 'ထောက်ကြန့်ကျေးရွာ',
			title: 'ထောက်ကြန့်ကျေးရွာ · ကလေးမြို့နယ်',
			subtitle,
			subArea,
		};
	}

	// ၈။ ကြာအင်းရေကန် (အနောက်တောင်ဘက်ခြမ်း u <= -215, 3835 <= v <= 4135)
	if (u <= -215 && v >= 3835 && v <= 4135) {
		return {
			id: 'kyarinn-lake',
			label: 'ကြာအင်းရေကန်',
			title: 'ကြာအင်းရေကန် · ကလေးမြို့နယ်',
			subtitle: 'Kyar Inn Lake · Southwest of Kyar Inn · Ponds & Water Pavilion',
			subArea: 'ကြာအင်းရေကန်နှင့် ရေလယ်နားနေဆောင်',
		};
	}

	// ၉။ ဝေပုလ္လတောင်တန်း (v > 4160)
	if (v > 4160) {
		return {
			id: 'kyarinn',
			label: 'ဝေပုလ္လတောင်ကြီး · ကြာအင်းတောင်ဘက်',
			title: 'မဟာဝေပုလ္လတောင်တော် · ကလေးမြို့နယ်',
			subtitle: 'Mount Weipula · Maha Weipula Summit Pagoda · South of Kyar Inn',
			subArea: 'ဝေပုလ္လတောင်တန်းနှင့် တောင်ပေါ်စေတီတော်',
		};
	}

	// ၁၀။ ကြာအင်းရွာ (3620 <= v <= 4160)
	let subArea = 'ကြာအင်းရွာ';
	let subtitle = 'AH1 · Kyar Inn Village · Middle School · Churches · Kalay';

	if (u >= 20 && u <= 115 && v >= 3805 && v <= 3895) {
		subArea = 'အလက ကြာအင်း (Kyarinn Middle School)';
		subtitle = 'Kyarinn Middle School · အလက ကြာအင်း · Kalay';
	} else if (u >= -90 && u <= -35 && v >= 3720 && v <= 3770) {
		subArea = 'Kyarinn Baptist Church ဘုရားကျောင်း';
		subtitle = 'Kyarinn Baptist Church · ကြာအင်းရွာ · Kalay';
	} else if (u >= -105 && u <= -45 && v >= 3895 && v <= 3945) {
		subArea = 'IBC Kyarinn ဘုရားကျောင်း';
		subtitle = 'IBC Kyarinn Church · ကြာအင်းရွာ · Kalay';
	} else if (u >= -175 && u <= -120 && v >= 3865 && v <= 3915) {
		subArea = 'CJC Church Kyar Inn ဘုရားကျောင်း';
		subtitle = 'CJC Church Kyar Inn · ကြာအင်းရွာ · Kalay';
	} else if (u >= 35 && u <= 90 && v >= 3920 && v <= 3970) {
		subArea = 'St. Peter Catholic Church ဘုရားကျောင်း';
		subtitle = 'St. Peter Catholic Church · ကြာအင်းရွာ · Kalay';
	} else if (Math.abs(u) <= 35 && v >= 3630 && v <= 3662) {
		subArea = 'သပြေချောင်းတံတား (Taphi Chaung)';
		subtitle = 'Taphi Chaung Bridge · ကြာအင်းရွာအဝင် · Kalay';
	}

	return {
		id: 'kyarinn',
		label: 'ကြာအင်းရွာ',
		title: 'ကြာအင်းရွာ · ကလေးမြို့နယ်',
		subtitle,
		subArea,
	};
}
