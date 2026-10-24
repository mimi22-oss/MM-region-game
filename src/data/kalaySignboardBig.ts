import { angle, toWorld } from './wards/myothar/area5.ts';

/**
 * ကလေးမြို့ ဂိတ်ဆိုင်းဘုတ်ကြီး (Kalaymyo Town Entrance Arch Gate - image-big.png):
 * - တည်နေရာ (Location): Robot location ချင်းဆိုင်ရွာ (Chin Sai village) တွင် တွေ့ခဲ့သော အနေအထားအတိုင်း
 *   Lat (approx) 23.1532794, Lng (approx) 94.0468397
 * - Scene X/Z (m): 813.173, 813.173 (Local U=0.0, V=1150.0)
 * - AH1 မိန်းလမ်းမကြီး (width 12m, u=0) ကို ဖြတ်၍ လမ်းမကြီး ၂ဖက် (East/West shoulders) ကို
 *   ခွထားသော ဂိတ်တိုင် ၂ တိုင်ဖြင့် ရပ်တည်သည့် ဂိတ်ဆိုင်းဘုတ် — ချင်းဆိုင်ရွာ ရွာမလမ်း ၂ လမ်း
 *   (chinsai-main-road-1 at v=1134, chinsai-main-road-2 at v=1167) ကြားတွင် တည်ရှိသည်
 * - မျက်နှာမူ (Facing): North / 0.0° (rotY = angle + Math.PI rad; local +Z faces North 0.0°)
 * - ဒေါင်တိုင် ၂ တိုင်ကြား ချိတ်ဆက်ထားသော ရွှေ/အနီ ကန့်လန့်တန်းကြီး (rigid lintel beam) တစ်ခုတည်း
 *   ဖြင့် လမ်းမကြီးကို ခွဲခြားစီးဆင်းနိုင်အောင် အပေါ်စီးမှ ဖြတ်ကျော်ထားသည့် ဒီဇိုင်း (kalaySignboard.ts ၏
 *   ဒေါင်တိုင် ၂ တိုင် + သီးခြားမျှော်ဆိုင်းဘုတ်ပြား ဒီဇိုင်းမှ မတူ)
 */
export const KALAY_SIGN_BIG_NAME = 'ကလေးမြို့ ဂိတ်ဆိုင်းဘုတ်ကြီး (Kalaymyo Town Gate Arch)';
export const KALAY_SIGN_BIG_BEARING = 0.0; // North / 0.0°
export const KALAY_SIGN_BIG_ROTATION = angle + Math.PI; // local +Z faces North 0.0°

/** ဆိုင်းဘုတ်ပြားအလယ် ရွှေစာသား (Main red plaque gold text) */
export const KALAY_SIGN_BIG_TITLE = 'ကလေးမြို့ မှ ကြိုဆိုပါ၏';
/** ထိပ်ဖူး အစိမ်းရောင် ခွေးပေါ်ရှိ ရွှေစာသား (Crest green band gold text) */
export const KALAY_SIGN_BIG_SUBTITLE = 'စစ်တိုင်းတိုင်းဒေသကြီး';

/** AH1 လမ်းမကြီး ၏ ထိုနေရာရှိ လမ်းကျယ် (AH1 road width at the crossing point) */
export const KALAY_SIGN_BIG_ROAD_WIDTH = 12.0;
/** ဒေါင်တိုင် ၂ တိုင်ကြား အကွာအဝေး (Clear span between the two pillars, covering road + shoulders) */
export const KALAY_SIGN_BIG_SPAN = 13.0;
/** ဂိတ်တိုင် တစ်ဖက်စီ လမ်းမဗဟိုမှ အကွာအဝေး (Pillar offset from road centerline) */
export const KALAY_SIGN_BIG_PILLAR_OFFSET = KALAY_SIGN_BIG_SPAN / 2;

export const kalaySignBigCoords = {
	u: 0.0,
	v: 1150.0,
	lat: 23.1532794,
	lng: 94.0468397,
	...toWorld(0.0, 1150.0), // x=813.173, z=813.173
	span: KALAY_SIGN_BIG_SPAN,
	roadWidth: KALAY_SIGN_BIG_ROAD_WIDTH,
	bearing: KALAY_SIGN_BIG_BEARING,
	rotation: KALAY_SIGN_BIG_ROTATION,
};
