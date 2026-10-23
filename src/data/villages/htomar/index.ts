import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, VillageMeta } from '../../types.ts';

/**
 * AH1 မိန်းလမ်းမကြီး၏ အရှေ့ဘက်ခြမ်းနှင့် ထိုမာကျေးရွာ အတွင်းပိုင်းကြား
 * ခြားထားသော လယ်ကွင်း ၅ ကွင်းတန်း (u = 52, 94, 136, 178, 220)
 */
export const htomarFiveColumnFields: FieldPlot[] = [1780, 1825, 1870, 1915, 1960, 2005, 2050].flatMap((v, row) =>
 [52, 94, 136, 178, 220].map((u, col) => ({
  id: `htomar-east-sep-field-${row}-${col}`,
  row,
  u,
  v,
  ...toWorld(u, v),
  width: 36,
  depth: 36,
  rotation: angle,
  color: ['#8ca65c', '#a6af68', '#7e9c55', '#96a85d', '#86a257'][(row + col) % 5],
 }))
);

/**
 * ဇင်းကလင်းကျေးရွာနှင့် ထိုမာကျေးရွာကြား ခြားထားသော မြောက်ဘက် လယ်ကွင်းများ
 */
export const htomarNorthSeparationFields: FieldPlot[] = [1625, 1655].map((v, i) => ({
 id: `zingalin-htomar-sep-field-${i + 1}`,
 row: i,
 u: 126,
 v,
 ...toWorld(126, v),
 width: 214,
 depth: 24,
 rotation: angle,
 color: i % 2 ? '#7e9c55' : '#96a85d',
}));

// ထိုမာကျေးရွာ (အရှေ့ဘက် အတွင်းပိုင်း u = 256..508) ရှိ အရှေ့-အနောက် လမ်းသွယ် ၁၃ လမ်း
export const htomarLanes = [1735, 1767, 1799, 1831, 1863, 1895, 1927, 1959, 1991, 2023, 2055, 2087, 2119];
// ထိုမာကျေးရွာ အတွင်းပိုင်း မြောက်-တောင် ရွာတွင်းလမ်းသွယ် ၇ လမ်း
export const htomarCrossLanes = [256, 298, 340, 382, 424, 466, 508];

// မြောက်-တောင် လမ်းသွယ် ၇ လမ်းကြားရှိ အိမ်အကွက် (Block) ၆ ခု၏ u တန်ဖိုးများ
const eastInteriorBlocks = [
 [270, 284],       // Block 0: 256 နှင့် 298 ကြား
 [312, 326],       // Block 1: 298 နှင့် 340 ကြား
 [354, 368],       // Block 2: 340 နှင့် 382 ကြား
 [396, 410],       // Block 3: 382 နှင့် 424 ကြား
 [438, 452],       // Block 4: 424 နှင့် 466 ကြား
 [480, 494],       // Block 5: 466 နှင့် 508 ကြား
];

const houses: House[] = [];

// ၁။ AH1 မိန်းလမ်းမကြီး အနောက်ဘက်ခြမ်း — အိမ်ခြေအနည်းငယ်သာရှိပြီး အစိုးရ Technological University, Kalay နှင့် Government Technology High School(Khamtee) ကျောင်းဝင်းကြီး ၂ ခု တည်ရှိသည်
for (const v of [1890, 1904, 1920]) {
 for (const u of [-24, -40]) {
  const i = houses.length;
  houses.push({
   id: `htomar-west-h${i + 1}`,
   name: `ထိုမာ လမ်းမဘေးအိမ် ${i + 1}`,
   ...toWorld(u, v),
   width: 7.5,
   depth: 6.5,
   color: ['#d8c7a3', '#bd9973'][i % 2],
   rotation: angle,
   roof: ['#849699', '#8b5545'][i % 2],
  });
 }
}

// ၂။ AH1 အရှေ့ဘက် လယ်ကွင်း ၅ ကွင်းအခြား အတွင်းထဲရှိ ထိုမာကျေးရွာ အိမ်ခြေများ
for (let rowBlock = 0; rowBlock < htomarLanes.length - 1; rowBlock++) {
 const baseV = htomarLanes[rowBlock];
 for (const offsetV of [10, 22]) {
  const v = baseV + offsetV;
  for (let colBlock = 0; colBlock < eastInteriorBlocks.length; colBlock++) {
   if (rowBlock <= 1 && colBlock > 1) continue;
   if ((rowBlock === 2 || rowBlock === 3) && colBlock > 2) continue;
   if (rowBlock === 2 && colBlock === 2) continue;
   if (rowBlock === 6 && colBlock === 4) continue;
   if (rowBlock === 10 && colBlock > 3) continue;
   if (rowBlock === 11 && colBlock > 2) continue;

   for (const u of eastInteriorBlocks[colBlock]) {
    const i = houses.length;
    houses.push({
     id: `htomar-h${i + 1}`,
     name: `ထိုမာကျေးရွာအိမ် ${i + 1}`,
     ...toWorld(u, v),
     width: 7.5,
     depth: 6.5,
     color: ['#d8c7a3', '#bd9973', '#a9b9b0', '#c7b299'][(i + rowBlock + colBlock) % 4],
     rotation: angle - Math.PI / 2,
     roof: ['#8b5545', '#849699', '#a39a85', '#7d6655'][(i + rowBlock + colBlock) % 4],
    });
   }
  }
 }
}

/**
 * Google Maps ပုံပါ ထိုမာကျေးရွာနှင့် AH1 အနောက်ဘက်ခြမ်းရှိ အဓိက ကျောင်းဝင်းကြီးများနှင့် အထင်ကရနေရာများ
 * 1. Government Technology High School(Khamtee) — အစိုးရနည်းပညာအထက်တန်းကျောင်း (ခန္တီး) (AH1 အနောက်ဘက် မြောက်ပိုင်း)
 * 2. Technological University, Kalay — နည်းပညာတက္ကသိုလ် (ကလေး) (AH1 အနောက်ဘက် တောင်ပိုင်း၊ အဝင်လမ်းမရှည်၊ အဝိုင်းပတ်နှင့် လေးထောင့်ပုံ ပင်မကျောင်းဆောင်ကြီး)
 * 3. ထိုမာကျေးရွာ ဘုန်းကြီးကျောင်း နှင့် အထက-ထိုမာ
 */
export const htomarLandmarks = [
 {
  id: 'gths-khamtee',
  name: 'Government Technology High School(Khamtee) · အစိုးရနည်းပညာအထက်တန်းကျောင်း(ခန္တီး)',
  u: -115,
  v: 1715,
  ...toWorld(-115, 1715),
  width: 196,
  depth: 98,
  rotation: angle,
 },
 {
  id: 'tu-kalay',
  name: 'Technological University, Kalay · နည်းပညာတက္ကသိုလ်(ကလေး)',
  u: -140,
  v: 1830,
  ...toWorld(-140, 1830),
  width: 210,
  depth: 92,
  rotation: angle,
 },
 {
  id: 'htomar-monastery',
  name: 'ထိုမာကျေးရွာ ဘုန်းကြီးကျောင်း',
  u: 445,
  v: 1943,
  ...toWorld(445, 1943),
  width: 34,
  depth: 22,
  rotation: angle,
 },
 {
  id: 'behs-htomar',
  name: 'အထက-ထိုမာ',
  u: 361,
  v: 1815,
  ...toWorld(361, 1815),
  width: 32,
  depth: 20,
  rotation: angle,
 },
];

// Technological University, Kalay ၏ အဝင် အဝိုင်းပတ် (Roundabout) နှင့် ရှေ့ရင်ပြင် (Plaza)၊ GTHS Khamtee အားကစားကွင်း
export const htomarCampusFeatures = {
 gthsField: { u: -38, v: 1690, ...toWorld(-38, 1690), width: 32, depth: 36, rotation: angle },
 tuRoundabout: { u: -125, v: 1830, ...toWorld(-125, 1830), radius: 8 },
 tuFrontPlaza: { u: -142, v: 1830, ...toWorld(-142, 1830), width: 20, depth: 44, rotation: angle },
 tuCourtyard: { u: -196, v: 1830, ...toWorld(-196, 1830), width: 48, depth: 52, rotation: angle },
};

// ကျောင်းဝင်းကြီး ၂ ခုနှင့် ဘုန်းကြီးကျောင်းရှိ အဆောက်အအုံများ (htomar-campus-* ဖြင့် စတင်သော အဆောက်အအုံများကို ကျောင်းဆောင်ပုံစံဖြင့် 3D ဆွဲပေးသည်)
export const htomarCampusBuildings: House[] = [
 // --- Government Technology High School(Khamtee) အဆောက်အအုံများ (Image 1 & Image 3 အတိုင်း) ---
 {
  id: 'htomar-campus-gths-front-courtyard',
  name: 'GTHS (Khamtee) · ရှေ့ကျောင်းဆောင်ဝင်း',
  ...toWorld(-38, 1742),
  width: 22,
  depth: 18,
  color: '#e5e0d0',
  rotation: angle,
  roof: '#8fa4b0',
 },
 {
  id: 'htomar-campus-gths-red-1',
  name: 'GTHS (Khamtee) · အလုပ်ရုံဆောင် (၁)',
  ...toWorld(-82, 1696),
  width: 11,
  depth: 24,
  color: '#e7d7b4',
  rotation: angle,
  roof: '#c4563d',
 },
 {
  id: 'htomar-campus-gths-red-2',
  name: 'GTHS (Khamtee) · အလုပ်ရုံဆောင် (၂)',
  ...toWorld(-104, 1696),
  width: 11,
  depth: 24,
  color: '#e7d7b4',
  rotation: angle,
  roof: '#c4563d',
 },
 {
  id: 'htomar-campus-gths-blue-1',
  name: 'GTHS (Khamtee) · မြောက်ဘက်ဆောင် (၁)',
  ...toWorld(-84, 1674),
  width: 13,
  depth: 11,
  color: '#dfe6eb',
  rotation: angle,
  roof: '#567ba3',
 },
 {
  id: 'htomar-campus-gths-blue-2',
  name: 'GTHS (Khamtee) · မြောက်ဘက်ဆောင် (၂)',
  ...toWorld(-106, 1674),
  width: 13,
  depth: 11,
  color: '#dfe6eb',
  rotation: angle,
  roof: '#9ab0c4',
 },
 {
  id: 'htomar-campus-gths-main',
  name: 'GTHS (Khamtee) · ပင်မစာသင်ဆောင်',
  ...toWorld(-94, 1742),
  width: 26,
  depth: 11,
  color: '#e7d7b4',
  rotation: angle,
  roof: '#8b5545',
 },
 {
  id: 'htomar-campus-gths-west-1',
  name: 'GTHS (Khamtee) · အနောက်မြောက် စာသင်ဆောင်',
  ...toWorld(-154, 1676),
  width: 28,
  depth: 10,
  color: '#dde5dc',
  rotation: angle,
  roof: '#6d9178',
 },
 {
  id: 'htomar-campus-gths-west-2',
  name: 'GTHS (Khamtee) · အနောက်တောင် စာသင်ဆောင်',
  ...toWorld(-154, 1742),
  width: 28,
  depth: 10,
  color: '#dde5dc',
  rotation: angle,
  roof: '#6d9178',
 },
 {
  id: 'htomar-campus-gths-west-3',
  name: 'GTHS (Khamtee) · အနောက်ဘက်ဆောင်',
  ...toWorld(-192, 1696),
  width: 11,
  depth: 26,
  color: '#d8cfb7',
  rotation: angle,
  roof: '#8b5545',
 },

 // --- Technological University, Kalay အဆောက်အအုံများ (Image 2 အတိုင်း) ---
 {
  id: 'htomar-campus-tu-se-courtyard',
  name: 'Technological University, Kalay · လမ်းမဘေး အရှေ့တောင်ဆောင်',
  ...toWorld(-36, 1862),
  width: 24,
  depth: 18,
  color: '#e2ece9',
  rotation: angle,
  roof: '#7ea89f',
 },
 {
  id: 'htomar-campus-tu-main-hall',
  name: 'Technological University, Kalay · မျက်နှာစာ ပင်မဆောင်ကြီး',
  ...toWorld(-160, 1830),
  width: 18,
  depth: 26,
  color: '#efe2c6',
  rotation: angle,
  roof: '#b34638',
 },
 {
  id: 'htomar-campus-tu-front-north',
  name: 'Technological University, Kalay · ရှေ့မြောက်ဘက်ဆောင်',
  ...toWorld(-164, 1804),
  width: 10,
  depth: 20,
  color: '#efe2c6',
  rotation: angle,
  roof: '#b34638',
 },
 {
  id: 'htomar-campus-tu-front-south',
  name: 'Technological University, Kalay · ရှေ့တောင်ဘက်ဆောင်',
  ...toWorld(-164, 1856),
  width: 10,
  depth: 20,
  color: '#efe2c6',
  rotation: angle,
  roof: '#b34638',
 },
 {
  id: 'htomar-campus-tu-north-wing',
  name: 'Technological University, Kalay · မြောက်ဘက် ဘေးဆောင်ရှည်',
  ...toWorld(-196, 1796),
  width: 48,
  depth: 11,
  color: '#e8d8b8',
  rotation: angle,
  roof: '#bc4b3c',
 },
 {
  id: 'htomar-campus-tu-south-wing',
  name: 'Technological University, Kalay · တောင်ဘက် ဘေးဆောင်ရှည်',
  ...toWorld(-196, 1864),
  width: 48,
  depth: 11,
  color: '#e8d8b8',
  rotation: angle,
  roof: '#bc4b3c',
 },
 {
  id: 'htomar-campus-tu-rear-wing',
  name: 'Technological University, Kalay · နောက်ဘက် ကျောင်းဆောင်ရှည်',
  ...toWorld(-228, 1830),
  width: 11,
  depth: 76,
  color: '#d9ccb2',
  rotation: angle,
  roof: '#7d6b5d',
 },

 // --- ထိုမာကျေးရွာ အတွင်းပိုင်းရှိ ဘုန်းကြီးကျောင်းနှင့် အထက-ထိုမာ ---
 {
  id: 'htomar-campus-monastery-main',
  name: 'ထိုမာ ဘုန်းကြီးကျောင်း · ကျောင်းဆောင်ကြီး',
  ...toWorld(445, 1943),
  width: 15,
  depth: 10,
  color: '#e7d7b4',
  rotation: angle - Math.PI / 2,
  roof: '#80564d',
 },
 {
  id: 'htomar-campus-behs-main',
  name: 'အထက-ထိုမာ · ကျောင်းဆောင်',
  ...toWorld(361, 1815),
  width: 16,
  depth: 9,
  color: '#d8cfb7',
  rotation: angle - Math.PI / 2,
  roof: '#547b69',
 },
];

houses.push(...htomarCampusBuildings);

/**
 * ထိုမာကျေးရွာ အရှေ့ဘက် လယ်ကွင်း ၅ ကွင်းနှင့် မိန်းလမ်းမကြီး (AH1) ကြား လမ်းမအနီးရှိ ဆိုင်များ
 * - စားသောက်ဆိုင် ၄ ဆိုင် (4 Restaurants)
 * - လက်ဖက်ရည်ဆိုင်လေး ၂ ဆိုင် (2 Tea Shops)
 * - ကွမ်းယာဆိုင် ၁ ဆိုင် (1 Betel Nut Stall)
 */
export type RoadsideShop = House & {
 shopType: 'restaurant' | 'teashop' | 'betel';
 u: number;
 v: number;
};

export const htomarRoadsideShops: RoadsideShop[] = [
 // စားသောက်ဆိုင် ၄ ဆိုင်
 {
  id: 'htomar-shop-restaurant-1',
  name: 'ထာမို မြန်မာထမင်းဆိုင် · စားသောက်ဆိုင် (၁)',
  shopType: 'restaurant',
  u: 22,
  v: 1712,
  ...toWorld(22, 1712),
  width: 9,
  depth: 7.5,
  color: '#efe0c4',
  rotation: angle - Math.PI / 2,
  roof: '#b54d3a',
 },
 {
  id: 'htomar-shop-restaurant-2',
  name: 'ရွှေကလေး စားသောက်ဆိုင် (၂)',
  shopType: 'restaurant',
  u: 22,
  v: 1762,
  ...toWorld(22, 1762),
  width: 9,
  depth: 7.5,
  color: '#e8d7b9',
  rotation: angle - Math.PI / 2,
  roof: '#9e4738',
 },
 {
  id: 'htomar-shop-restaurant-3',
  name: 'ချင်းတောင်တန်း စားသောက်ဆိုင် (၃)',
  shopType: 'restaurant',
  u: 22,
  v: 1812,
  ...toWorld(22, 1812),
  width: 9,
  depth: 7.5,
  color: '#efe0c4',
  rotation: angle - Math.PI / 2,
  roof: '#b54d3a',
 },
 {
  id: 'htomar-shop-restaurant-4',
  name: 'ဝေပုလ္လ စားသောက်ဆိုင် (၄)',
  shopType: 'restaurant',
  u: 22,
  v: 1862,
  ...toWorld(22, 1862),
  width: 9,
  depth: 7.5,
  color: '#e8d7b9',
  rotation: angle - Math.PI / 2,
  roof: '#9e4738',
 },
 // လက်ဖက်ရည်ဆိုင်လေး ၂ ဆိုင်
 {
  id: 'htomar-shop-teashop-1',
  name: 'ကျောင်းရှေ့ လက်ဖက်ရည်ဆိုင် (၁)',
  shopType: 'teashop',
  u: 20,
  v: 1786,
  ...toWorld(20, 1786),
  width: 7,
  depth: 6,
  color: '#dce8df',
  rotation: angle - Math.PI / 2,
  roof: '#497a6b',
 },
 {
  id: 'htomar-shop-teashop-2',
  name: 'မိတ်ဆုံ လက်ဖက်ရည်ဆိုင် (၂)',
  shopType: 'teashop',
  u: 20,
  v: 1838,
  ...toWorld(20, 1838),
  width: 7,
  depth: 6,
  color: '#dce8df',
  rotation: angle - Math.PI / 2,
  roof: '#497a6b',
 },
 // ကွမ်းယာဆိုင် ၁ ဆိုင်
 {
  id: 'htomar-shop-betel-1',
  name: 'လမ်းဆုံ ကွမ်းယာဆိုင်',
  shopType: 'betel',
  u: 15,
  v: 1748,
  ...toWorld(15, 1748),
  width: 3.4,
  depth: 3,
  color: '#f2e8c9',
  rotation: angle - Math.PI / 2,
  roof: '#2d6e5e',
 },
];

houses.push(...htomarRoadsideShops);

const roads: RoadPlot[] = [
 // --- AH1 အနောက်ဘက်ခြမ်း GTHS (Khamtee) နှင့် Technological University, Kalay ကျောင်းဝင်းလမ်းများ ---
 {
  id: 'gths-north-road',
  name: 'GTHS (Khamtee) မြောက်ဘက်ကျောင်းလမ်း',
  ...toWorld(-115, 1662),
  width: 210,
  depth: 4.5,
  rotation: angle,
  main: false,
 },
 {
  id: 'gths-mid-road',
  name: 'GTHS (Khamtee) အလယ်ကျောင်းဝင်းလမ်း',
  ...toWorld(-115, 1716),
  width: 210,
  depth: 4.5,
  rotation: angle,
  main: false,
 },
 {
  id: 'gths-tu-boundary-road',
  name: 'GTHS နှင့် TU ကြား ကျောင်းဝင်းလမ်းမ',
  ...toWorld(-115, 1768),
  width: 210,
  depth: 5.5,
  rotation: angle,
  main: true,
 },
 {
  id: 'gths-cross-road-1',
  name: 'GTHS အတွင်းလမ်း (၁)',
  ...toWorld(-64, 1715),
  width: 4,
  depth: 106,
  rotation: angle,
  main: false,
 },
 {
  id: 'gths-cross-road-2',
  name: 'GTHS အတွင်းလမ်း (၂)',
  ...toWorld(-128, 1715),
  width: 4,
  depth: 106,
  rotation: angle,
  main: false,
 },
 // Image 2 အတိုင်း မိန်းလမ်းမကြီး (AH1) မှ Technological University, Kalay ပင်မဆောင်ရှေ့ အဝိုင်းပတ်သို့ တည့်တည့်ဝင်သော အဝင်လမ်းမရှည်
 {
  id: 'tu-kalay-entrance-boulevard',
  name: 'နည်းပညာတက္ကသိုလ် (ကလေး) အဝင်လမ်းမကြီး',
  ...toWorld(-66, 1830),
  width: 120,
  depth: 7,
  rotation: angle,
  main: true,
 },
 // --- AH1 မှ အရှေ့ဘက် လယ်ကွင်း ၅ ကွင်းကို ဖြတ်၍ ထိုမာကျေးရွာသို့ ဝင်သော အဓိက ရွာအဝင်လမ်းမကြီး ၂ လမ်း ---
 {
  id: 'htomar-access-road-north',
  name: 'ထိုမာ မြောက်ဘက် ရွာအဝင်လမ်းမကြီး (Htomar Rd)',
  ...toWorld(170, 1735),
  width: 328,
  depth: 6,
  rotation: angle,
  main: true,
 },
 {
  id: 'htomar-access-road-center',
  name: 'ထိုမာ အလယ်ပိုင်း ဆက်သွယ်ရေးလမ်းမ',
  ...toWorld(254, 1927),
  width: 496,
  depth: 6,
  rotation: angle,
  main: true,
 },
 // မြောက်ဘက် လည်ပင်းပိုင်း အရှေ့-အနောက် လမ်းသွယ်များ (v = 1767, 1799, 1831)
 ...[1767, 1799, 1831].map((v, i) => ({
  id: `htomar-neck-ew-lane-${i + 1}`,
  name: `ထိုမာ မြောက်ပိုင်းလမ်းသွယ် ${i + 1}`,
  ...toWorld(319, v),
  width: 126,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 // အလယ်နှင့် တောင်ပိုင်း ရွာမကြီးအတွင်းရှိ အရှေ့-အနောက် လမ်းသွယ်များ (v = 1863..2119)
 ...[1863, 1895, 1959, 1991, 2023, 2055, 2087, 2119].map((v, i) => ({
  id: `htomar-grid-ew-lane-${i + 1}`,
  name: `ထိုမာ ရွာတွင်းလမ်းသွယ် ${i + 1}`,
  ...toWorld(382, v),
  width: 252,
  depth: 4.5,
  rotation: angle,
  main: false,
 })),
 // ထိုမာရွာတွင်း မြောက်-တောင် ကန့်လန့်ဖြတ်လမ်းသွယ် ၇ လမ်း
 {
  id: 'htomar-ns-lane-1',
  name: 'ထိုမာ အတွင်းလမ်း ၁',
  ...toWorld(256, 1927),
  width: 5,
  depth: 384,
  rotation: angle,
  main: true,
 },
 {
  id: 'htomar-ns-lane-2',
  name: 'ထိုမာ အတွင်းလမ်း ၂',
  ...toWorld(298, 1927),
  width: 4.5,
  depth: 384,
  rotation: angle,
  main: false,
 },
 {
  id: 'htomar-ns-lane-3',
  name: 'ထိုမာ အတွင်းလမ်း ၃',
  ...toWorld(340, 1927),
  width: 4.5,
  depth: 384,
  rotation: angle,
  main: false,
 },
 {
  id: 'htomar-ns-lane-4',
  name: 'ထိုမာ အတွင်းလမ်း ၄',
  ...toWorld(382, 1943),
  width: 4.5,
  depth: 352,
  rotation: angle,
  main: false,
 },
 {
  id: 'htomar-ns-lane-5',
  name: 'ထိုမာ အတွင်းလမ်း ၅',
  ...toWorld(424, 1959),
  width: 4.5,
  depth: 192,
  rotation: angle,
  main: false,
 },
 {
  id: 'htomar-ns-lane-6',
  name: 'ထိုမာ အတွင်းလမ်း ၆',
  ...toWorld(466, 1959),
  width: 4,
  depth: 192,
  rotation: angle,
  main: false,
 },
 {
  id: 'htomar-ns-lane-7',
  name: 'ထိုမာ အတွင်းလမ်း ၇',
  ...toWorld(508, 1959),
  width: 4,
  depth: 192,
  rotation: angle,
  main: false,
 },
];

// AH1 အနောက်ဘက်ခြမ်း ကျောင်းဝင်းကြီး ၂ ခု၏ အနောက်ဘက်နှင့် တောင်ဘက်ရှိ လယ်ကွင်းများ
const bundedFields: FieldPlot[] = [
 ...[1955, 2005, 2055].flatMap((v, row) =>
  [-115, -165, -215, -265].map((u, col) => ({
   id: `htomar-west-paddy-${row}-${col}`,
   row,
   u,
   v,
   ...toWorld(u, v),
   width: 44,
   depth: 40,
   rotation: angle,
   color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
  }))
 ),
 ...[1700, 1755, 1810, 1865].flatMap((v, row) =>
  [-295, -345].map((u, col) => ({
   id: `htomar-far-west-paddy-${row}-${col}`,
   row,
   u,
   v,
   ...toWorld(u, v),
   width: 44,
   depth: 42,
   rotation: angle,
   color: ['#98a85e', '#7d9c54'][(row + col) % 2],
  }))
 ),
];

// AH1 နှင့် ထိုမာကျေးရွာကြား လယ်ကွင်း ၅ ကွင်းတန်း + ထိုမာကျေးရွာ၏ အရှေ့ဘက်အစွန်ရှိ လယ်ကွင်းများ
const fields: FieldPlot[] = [
 ...htomarFiveColumnFields,
 ...[1870, 1920, 1970, 2020, 2070].flatMap((v, row) =>
  [544, 592].map((u, col) => ({
   id: `htomar-far-east-field-${row}-${col}`,
   u,
   v,
   ...toWorld(u, v),
   width: 42,
   depth: 38,
   rotation: angle,
   color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
  }))
 ),
];

// AH1 လမ်းမဘေး သစ်ပင်တန်း
const trees: TreePlot[] = [-12, 12].flatMap((u, sideIdx) =>
 (u < 0
  ? [1680, 1710, 1750, 1785, 1812, 1848, 1880, 1910, 1950, 1985]
  : [1680, 1696, 1725, 1774, 1799, 1825, 1850, 1878, 1910, 1950, 1985]
 ).map((v, i) => ({
  id: `htomar-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// ထိုမာကျေးရွာအဝင်၊ ရွာတွင်းလမ်းဆုံနှင့် TU / GTHS ကျောင်းဝင်းအတွင်းရှိ သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 [250, 1742],
 [250, 1856],
 [250, 1920],
 [250, 1984],
 [250, 2048],
 [336, 1762],
 [336, 1856],
 [336, 1952],
 [336, 2048],
 [420, 1890],
 [420, 1984],
 [504, 1890],
 [504, 1984],
 // GTHS နှင့် TU Kalay ကျောင်းဝင်းအတွင်းရှိ အရိပ်ရ သစ်ပင်ကြီးများ
 [-54, 1816],
 [-86, 1816],
 [-112, 1816],
 [-54, 1844],
 [-86, 1844],
 [-112, 1844],
 [-120, 1730],
 [-142, 1705],
 [-175, 1728],
].map(([u, v], i) => ({
 id: `htomar-shade-${i}`,
 ...toWorld(u, v),
 radius: 1.1,
}));

// လယ်ကွင်း ၅ ကွင်းတန်းနှင့် ထိုမာရွာစပ်ကြား + TU ကျောင်းဝင်းအတွင်း သစ်ပင်များ
const farmTrees: TreePlot[] = [
 [242, 1775],
 [242, 1815],
 [242, 1880],
 [242, 1945],
 [242, 2010],
 [242, 2075],
 [518, 1910],
 [518, 1965],
 [518, 2020],
 [-185, 1820],
 [-205, 1820],
 [-185, 1840],
 [-205, 1840],
].map(([u, v], i) => ({
 id: `htomar-farm-tree-${i}`,
 ...toWorld(u, v),
 radius: 0.5,
}));

/**
 * ထိုမာကျေးရွာ (Htomar Village · Kalay Township)
 * Google Maps: 23.1149722, 94.0401687
 * - AH1 အနောက်ဘက်ခြမ်းတွင် Government Technology High School(Khamtee) နှင့် Technological University, Kalay ကျောင်းဝင်းကြီး ၂ ခု တည်ရှိသည်။
 * - AH1 အရှေ့ဘက်ခြမ်းတွင် လယ်ကွင်း ၅ ကွင်းခြားပြီး အတွင်းထဲ၌ ထိုမာကျေးရွာ အိမ်ခြေအများအပြား တည်ရှိသည်။
 */
export const htomarVillage: VillageMeta = {
 id: 'htomar',
 name: 'ထိုမာကျေးရွာ',
 englishName: 'Htomar Village',
 villageTract: 'ထိုမာကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'AH1 အနောက်ဘက်တွင် Technological University (Kalay) နှင့် GTHS (Khamtee)၊ အရှေ့ဘက် လယ်ကွင်း ၅ ကွင်းအခြား အတွင်းပိုင်းတွင် အိမ်ခြေအများအပြား တည်ရှိသော ထိုမာကျေးရွာ',
 coordinates: { lat: 23.1149722, lng: 94.0401687 },
 ...toWorld(360, 1927),
 labelPos: toWorld(368, 1915),
 separationFields: htomarNorthSeparationFields,
 houses,
 roads,
 fields,
 bundedFields,
 trees,
 largeTrees,
 farmTrees,
};
