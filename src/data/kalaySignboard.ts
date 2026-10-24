import { angle, toWorld } from './wards/myothar/area5.ts';

/**
 * ကလေးမြို့ ဆိုင်းဘုတ် (Kalaymyo Welcome Landmark Monument - kalay.png):
 * - တည်နေရာ (Location): Lat 23.1600815, Lng 94.0470009
 * - Scene X: 295.571, Scene Z: 261.630 (Local U=24.0, V=394.0)
 * - မျက်နှာမူ (Facing): West / 270.0° (rotY = angle - Math.PI / 2 = -Math.PI / 4 rad)
 * - ရွှေရောင် ရိုးရာ ကနုတ်ပန်းဘောင်၊ အနီရင့်ရောင် ဆိုင်းဘုတ်ပြား၊ စစ်မှန်သော "ကလေးမြို့" မြန်မာယူနီကုဒ် ရွှေစာလုံးကြီးများ၊
 *   ဒေါင်တိုင်လုံးကြီး ၂ တိုင်နှင့် ခံတပ်ရိုးတံတိုင်းတို ပန်းခြံကျွန်း
 */
export const KALAY_SIGN_HOUSE_ID = 'h98';
export const KALAY_SIGN_NAME = 'ကလေးမြို့ ဆိုင်းဘုတ် (Kalaymyo Landmark)';
export const KALAY_SIGN_BEARING = 180.0; // South / 180.0°
export const KALAY_SIGN_ROTATION = angle; // Math.PI / 4 rad so local +Z faces South 180.0°


export const kalaySignCoords = {
	u: 24.0,
	v: 394.0,
	lat: 23.1600815,
	lng: 94.0470009,
	...toWorld(24.0, 394.0), // x=295.571, z=261.630
	radius: 3.5,
	bearing: KALAY_SIGN_BEARING,
	rotation: KALAY_SIGN_ROTATION,
};
