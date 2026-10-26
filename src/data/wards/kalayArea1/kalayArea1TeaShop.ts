import { toWorld } from '../myothar/area5.ts';

export interface TeaTableData {
	id: string;
	du: number; // local offset along U from shop center
	dv: number; // local offset along V from shop center
	isOutdoor: boolean;
	cupCount: number;
	hasTeapot: boolean;
}

export interface TVData {
	id: string;
	du: number;
	dv: number;
	y: number;
	rotY: number; // rotation in local space
	width: number;
	height: number;
	channel: 'football' | 'entertainment';
}

/**
 * ကလေးမြို့ နယ်မြေ (၁) — နန်းကလိန် လက်ဖက်ရည်ဆိုင် Data
 *
 * တည်နေရာ: AH1 အာရှလမ်းမကြီး အနောက်ဘက်ကပ်လျက်၊ နန်းကလိန်ချောင်းတံတား မြောက်ဘက်
 * UV Center: u = -13.25, v = -1199.85
 * World Center: x = -857.79, z = -839.05
 */
export const nankaleinTeaShopData = {
	id: 'kalay-area-1-tea-shop',
	name: 'နန်းကလိန် လက်ဖက်ရည်ဆိုင်',
	englishName: 'Nankalein Tea Shop',
	u: -13.25,
	v: -1199.85,
	x: toWorld(-13.25, -1199.85).x,
	z: toWorld(-13.25, -1199.85).z,
	rotation: Math.PI / 4, // 45 deg, aligned with AH1
	width: 12.0, // U direction (from u=-7.25 to u=-19.25)
	depth: 22.0, // V direction (from v=-1188.85 to v=-1210.85)

	// အဆောက်အဦ ပင်မဆောင် (Indoor Main Hall)
	indoor: {
		width: 6.2, // du: -6.0 to +0.2
		depth: 18.0, // dv: -9.0 to +9.0
		centerU: -16.15,
		centerV: -1199.85,
		floorY: 0.22,
		wallHeight: 3.8,
	},

	// အပြင်ဝရံတာ ထမင်းစား/လက်ဖက်ရည်သောက်ခင်း (Outdoor Dining Patio facing AH1)
	outdoor: {
		width: 5.8, // du: 0.2 to +6.0
		depth: 20.0, // dv: -10.0 to +10.0
		centerU: -10.35,
		centerV: -1199.85,
		floorY: 0.12,
	},

	// တီဗွီ ၂ လုံး (2 Wall-Mounted Flat-screen TVs)
	tvs: [
		{
			id: 'tea-shop-tv-1',
			du: -2.8,
			dv: 8.85, // Mounted on North Wall
			y: 2.35,
			rotY: Math.PI, // Facing South into indoor dining area
			width: 2.4,
			height: 1.4,
			channel: 'football',
		},
		{
			id: 'tea-shop-tv-2',
			du: -2.8,
			dv: -8.85, // Mounted on South Wall
			y: 2.35,
			rotY: 0, // Facing North into indoor dining area
			width: 2.4,
			height: 1.4,
			channel: 'entertainment',
		},
	] as TVData[],

	// စားပွဲ ၁၂ လုံး (အထဲ ၆ လုံး + အပြင် ၆ လုံး၊ စားပွဲ ၁ လုံးလျှင် လက်ဖက်ရည် ၄ ခွက်စီ)
	tables: [
		// --- အထဲ စားပွဲ ၆ လုံး (6 Indoor Tables) ---
		{ id: 'indoor-table-1', du: -4.0, dv: 5.8, isOutdoor: false, cupCount: 4, hasTeapot: true },
		{ id: 'indoor-table-2', du: -4.0, dv: 2.8, isOutdoor: false, cupCount: 4, hasTeapot: true },
		{ id: 'indoor-table-3', du: -1.8, dv: 4.8, isOutdoor: false, cupCount: 4, hasTeapot: true },
		{ id: 'indoor-table-4', du: -4.0, dv: -2.8, isOutdoor: false, cupCount: 4, hasTeapot: true },
		{ id: 'indoor-table-5', du: -4.0, dv: -5.8, isOutdoor: false, cupCount: 4, hasTeapot: true },
		{ id: 'indoor-table-6', du: -1.8, dv: -4.8, isOutdoor: false, cupCount: 4, hasTeapot: true },

		// --- အပြင် စားပွဲ ၆ လုံး (6 Outdoor Veranda Tables) ---
		{ id: 'outdoor-table-1', du: 2.0, dv: 6.2, isOutdoor: true, cupCount: 4, hasTeapot: true },
		{ id: 'outdoor-table-2', du: 2.0, dv: 0.0, isOutdoor: true, cupCount: 4, hasTeapot: true },
		{ id: 'outdoor-table-3', du: 2.0, dv: -6.2, isOutdoor: true, cupCount: 4, hasTeapot: true },
		{ id: 'outdoor-table-4', du: 4.4, dv: 6.2, isOutdoor: true, cupCount: 4, hasTeapot: true },
		{ id: 'outdoor-table-5', du: 4.4, dv: 0.0, isOutdoor: true, cupCount: 4, hasTeapot: true },
		{ id: 'outdoor-table-6', du: 4.4, dv: -6.2, isOutdoor: true, cupCount: 4, hasTeapot: true },
	] as TeaTableData[],
};
