import { toWorld } from './wards/myothar/area5.ts';

/**
 * ဦးရွှေအိမ်နှင့် မုန့်စျေးဆိုင် (U Shwe House & Myanmar Traditional Snack Stall):
 * - တည်နေရာ (Location): Lat 23.1614608, Lng 94.0466737 (Scene X=152.735, Z=186.676)
 * - Local U/V: u=-24.0, v=240.0 (Robot standing right in front at u=-16.995, v=239.244 facing West)
 * - မုန့်စျေးဆိုင် အဖီ (Lean-to Annex Snack Stall):
 *   - မုန့်ရောင်းကောင်တာနှင့် မုန့်မှန်ဗီရိုကြီး (Snack Counter & Glass Display Case)
 *   - မုန့်ဟင်းခါးအိုးကြီး၊ မုန့်ဖတ်တောင်းနှင့် ပန်းကန်များ (Mohinga Pot, Noodles & Bowls)
 *   - အကြော်စုံဗန်းကြီး (ဘူးသီးကြော်၊ ဘယာကြော်၊ မတ်ပဲကြော်)
 *   - မုန့်လက်ကောက်၊ မုန့်စိမ်းပေါင်း၊ ရွှေကြည်မုန့်၊ ငှက်ပျောဖက်ထုပ်မုန့်များ
 *   - မုန့်ဖန်ပုလင်းကြီး ၃ လုံး (Snack Jars with Biscuits & Brittle)
 *   - ရေနွေးကြမ်းဝိုင်း၊ လက်ဖက်ရည်ခွက်များနှင့် ဓာတ်ဗူး (Burmese Tea Table & Stools)
 */
export const U_SHWE_HOUSE_ID = 'h79';
export const U_SHWE_HOUSE_NAME = 'northNear · အိမ်တန်း 240 · ဦးရွှေအိမ် (U Shwe House)';
export const U_SHWE_SHOP_NAME = 'ဦးရွှေ မုန့်စျေးဆိုင်';

export const uShweHouseCoords = {
	u: -24.0,
	v: 240.0,
	lat: 23.1614608,
	lng: 94.0466737,
	...toWorld(-24.0, 240.0), // x=152.735, z=186.676
	width: 10.0,
	depth: 9.0,
	color: '#d8c7a3',
	roof: '#8b5545',
};

export const SNACK_ITEMS = [
	{ id: 'mohinga', name: 'မုန့်ဟင်းခါး', price: '၁၅၀၀ ကျပ်' },
	{ id: 'a-kyaw', name: 'အကြော်စုံ (ဘူးသီးကြော်၊ ဘယာကြော်၊ မတ်ပဲကြော်)', price: '၃၀၀ ကျပ်' },
	{ id: 'mont-let-kauk', name: 'မုန့်လက်ကောက် (သကာရည်ဆမ်း)', price: '၅၀၀ ကျပ်' },
	{ id: 'mont-sein-paung', name: 'မုန့်စိမ်းပေါင်း (အုန်းသီးဆံဆမ်း)', price: '၅၀၀ ကျပ်' },
	{ id: 'shwe-kyi', name: 'ရွှေကြည်မုန့် / သာကူမုန့်', price: '၅၀၀ ကျပ်' },
	{ id: 'tea', name: 'မြန်မာ့လက်ဖက်ရည် (ချိုဆိမ့်)', price: '၈၀၀ ကျပ်' },
];
