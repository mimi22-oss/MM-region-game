/**
 * Myanmar Fire Balloon Profile & Mathematical Curves (မီးပုံးပျံ ပုံသဏ္ဌာန်)
 *
 * Defines the authentic profile of Myanmar traditional hot-air/candle-powered
 * paper balloons used during Taunggyi Tazaungdaing and Thadingyut festivals.
 *
 * Starts above the wooden candle tray platform at y = 1.50m, swells outward to
 * a maximum radius of 1.48m at y = 3.81m, and narrows smoothly to the crown at y = 5.04m.
 * Each pair is [radius, height] in local meters.
 */
export const BALLOON_PROFILE: [number, number][] = [
  [0.37, 1.50],
  [0.53, 1.64],
  [0.78, 1.94],
  [1.05, 2.35],
  [1.29, 2.83],
  [1.43, 3.31],
  [1.48, 3.81],
  [1.43, 4.24],
  [1.23, 4.63],
  [0.88, 4.88],
  [0.45, 5.01],
  [0.00, 5.04],
];

/**
 * Calculates smooth interpolated radius at any height y along the balloon envelope.
 */
export function radiusAt(y: number): number {
  for (let i = 0; i < BALLOON_PROFILE.length - 1; i++) {
    const [r0, y0] = BALLOON_PROFILE[i];
    const [r1, y1] = BALLOON_PROFILE[i + 1];
    if (y <= y1) {
      const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
      const s = t * t * (3 - 2 * t);
      return r0 + (r1 - r0) * s;
    }
  }
  return 0;
}

/**
 * Traditional Shan mulberry paper lantern colors (မီးပုံးပျံ အရောင်အသွေးများ)
 */
export const BALLOON_PALETTE = [
  '#ff9d2b', // Radiant Golden Amber
  '#ffa734', // Warm Flame Orange
  '#f58622', // Deep Tangerine
  '#ff791a', // Fiery Sunset Orange
  '#f2ab42', // Marigold Gold
  '#e86b1a', // Rich Vermilion
  '#ffb84d', // Soft Candle Glow
];

export interface VillageLaunchHub {
  id: string;
  name: string;
  myanmarName: string;
  x: number;
  z: number;
  groundY: number;
  spreadRadius: number;
  palette: string[];
}

/**
 * ညကောင်းကင်ယံသို့ မီးပုံးပျံများ လွှင့်တင်မည့် ၉ နေရာ:
 * ၁။ ကံပုလဲ (Kanbale)
 * ၂။ သာစည် (Thar Si)
 * ၃။ ချင်းဆိုင် (Chin Sai)
 * ၄။ ဇင်းကလင်း (Zingalin)
 * ၅။ ထိုမာ (Htomar)
 * ၆။ သာယာကုန်း (Thar Yar Gone)
 * ၇။ ထောက်ကြန့် (Htauk Kyant)
 * ၈။ ကြာအင်း (Kyar Inn)
 * ၉။ ဝေပုလ္လတောင်တန်းကြီး (Weipula Mountain)
 */
export const VILLAGE_LAUNCH_HUBS: VillageLaunchHub[] = [
  {
    id: 'kanbale',
    name: 'Kanbale Village',
    myanmarName: 'ကံပုလဲရွာ',
    x: 458.67,
    z: -464.24,
    groundY: 0,
    spreadRadius: 240,
    palette: ['#ff9d2b', '#ffa734', '#f2ab42', '#ffb84d'],
  },
  {
    id: 'tharsi',
    name: 'Thar Si Village',
    myanmarName: 'သာစည်ရွာ',
    x: 562.86,
    z: 562.86,
    groundY: 0,
    spreadRadius: 260,
    palette: ['#ffa734', '#f58622', '#ff9d2b', '#ff791a'],
  },
  {
    id: 'chinsai',
    name: 'Chin Sai Village',
    myanmarName: 'ချင်းဆိုင်ရွာ',
    x: 813.17,
    z: 813.17,
    groundY: 0,
    spreadRadius: 260,
    palette: ['#ff9d2b', '#f2ab42', '#ffa734', '#e86b1a'],
  },
  {
    id: 'zingalin',
    name: 'Zingalin Village',
    myanmarName: 'ဇင်းကလင်းရွာ',
    x: 1067.73,
    z: 1067.73,
    groundY: 0,
    spreadRadius: 280,
    palette: ['#f58622', '#ff9d2b', '#ff791a', '#f2ab42'],
  },
  {
    id: 'htomar',
    name: 'Htomar Village',
    myanmarName: 'ထိုမာကျေးရွာ',
    x: 1543.61,
    z: 1181.58,
    groundY: 0,
    spreadRadius: 320,
    palette: ['#ffa734', '#ff791a', '#f58622', '#e86b1a'],
  },
  {
    id: 'tharyargone',
    name: 'Thar Yar Gone Village',
    myanmarName: 'သာယာကုန်းရွာ',
    x: 1909.19,
    z: 1909.19,
    groundY: 0,
    spreadRadius: 300,
    palette: ['#ff9d2b', '#ffa734', '#f2ab42', '#ff791a'],
  },
  {
    id: 'htaukkyant',
    name: 'Htauk Kyant Village',
    myanmarName: 'ထောက်ကြန့်ရွာ',
    x: 2333.45,
    z: 2333.45,
    groundY: 0,
    spreadRadius: 320,
    palette: ['#ff791a', '#f58622', '#e86b1a', '#ffa734'],
  },
  {
    id: 'kyarinn',
    name: 'Kyar Inn Village',
    myanmarName: 'ကြာအင်းရွာ',
    x: 2722.36,
    z: 2722.36,
    groundY: 0,
    spreadRadius: 350,
    palette: ['#f2ab42', '#ffa734', '#ff9d2b', '#ff791a'],
  },
  {
    id: 'weipula',
    name: 'Weipula Mountain Range',
    myanmarName: 'ဝေပုလ္လတောင်တန်းကြီး',
    x: 2860.25,
    z: 3397.65,
    groundY: 120, // High mountain peak launch pad
    spreadRadius: 420,
    palette: ['#ffb84d', '#f2ab42', '#ffa734', '#ff791a', '#e86b1a'],
  },
];

/**
 * မြို့သာ အလယ်ခေါင် မီးပုံးပျံများ စုဆုံရာ ပစ်မှတ်ဗဟို (Myothar Convergence Target)
 */
export const MYOTHAR_CONVERGENCE_TARGET = {
  x: -180,
  z: -480,
  fanSpread: 380, // Fan out across Myothar sky dome
};
