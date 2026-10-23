import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, EastWestCanalPlot, PondPlot, VillageMeta } from '../../types.ts';

/**
 * သာယာကုန်းကျေးရွာနှင့် ထောက်ကြန့်ကျေးရွာကြား ခြားထားသော လယ်ကွင်းများ
 * (AH1 ဘေးနှစ်ဖက်၊ v = 2935, 3035၊ စုစုပေါင်း ကွင်း ၂၀)
 */
export const htaukKyantSeparationFields: FieldPlot[] = [2935, 3035].flatMap((v, row) =>
 [-225, -180, -135, -90, -45, 45, 90, 135, 180, 225].map((u, col) => ({
  id: `tharyargone-htaukkyant-sep-field-${row}-${col}`,
  row,
  u,
  v,
  ...toWorld(u, v),
  width: 40,
  depth: 42,
  rotation: angle,
  color: ['#8ca65c', '#a6af68', '#7e9c55', '#96a85d', '#86a257'][(row + col) % 5],
 }))
);

/**
 * သာယာကုန်းကျေးရွာနှင့် ထောက်ကြန့်ကျေးရွာကြား မိန်းလမ်းမကြီးကို အရှေ့အနောက် ကန့်လန့်ဖြတ်ထားသော တံတားနှင့် ရေမြောင်း
 * (AH1 ပေါ်ရှိ တံတား: u = 0, v = 2985)
 */
export const htaukKyantCanal: EastWestCanalPlot = {
 id: 'htaukkyant-ew-canal',
 name: 'သာယာကုန်း-ထောက်ကြန့် ကန့်လန့်ဖြတ် ရေမြောင်းနှင့် တံတား',
 u: 0,
 v: 2985,
 uMin: -320,
 uMax: 260,
 ...toWorld(0, 2985),
 width: 4.5,
 depth: 580,
 rotation: angle,
 bridges: [{ u: 0, v: 2985, width: 14, depth: 7 }],
};

/**
 * Google Maps ပုံ (Htauk Kyant lake.png) ပါ ထောက်ကြန့်ကျေးရွာ အနောက်မြောက်ဘက်ရှိ
 * ရေကန်ကြီး (Large Lake) နှင့် အောက်ဘက်သို့ တန်းစီတည်ရှိသော ရေကန် ၅ ကန်
 */
export const htaukKyantLake: PondPlot = {
 id: 'htaukkyant-large-lake',
 name: 'ထောက်ကြန့် ရေကန်ကြီး',
 u: -230,
 v: 3135,
 ...toWorld(-230, 3135),
 width: 85,
 depth: 52,
 rotation: angle,
 color: '#3c7980',
};

export const htaukKyantPonds: PondPlot[] = [
 { id: 'htaukkyant-pond-1', name: 'ထောက်ကြန့် ရေကန် (၁)', u: -220, v: 3192, ...toWorld(-220, 3192), width: 50, depth: 16, rotation: angle, color: '#3d838b' },
 { id: 'htaukkyant-pond-2', name: 'ထောက်ကြန့် ရေကန် (၂)', u: -220, v: 3220, ...toWorld(-220, 3220), width: 50, depth: 16, rotation: angle, color: '#397d85' },
 { id: 'htaukkyant-pond-3', name: 'ထောက်ကြန့် ရေကန် (၃)', u: -220, v: 3248, ...toWorld(-220, 3248), width: 50, depth: 16, rotation: angle, color: '#3f878f' },
 { id: 'htaukkyant-pond-4', name: 'ထောက်ကြန့် ရေကန် (၄)', u: -220, v: 3282, ...toWorld(-220, 3282), width: 54, depth: 22, rotation: angle, color: '#36777f' },
 { id: 'htaukkyant-pond-5', name: 'ထောက်ကြန့် ရေကန် (၅)', u: -220, v: 3318, ...toWorld(-220, 3318), width: 54, depth: 22, rotation: angle, color: '#3b8088' },
];

export const allHtaukKyantPonds: PondPlot[] = [htaukKyantLake, ...htaukKyantPonds];

// ထောက်ကြန့်ကျေးရွာ အရှေ့-အနောက် လမ်းသွယ်များ (v = 3080 မှ 3520 အထိ)
export const htaukKyantLanes = [3080, 3115, 3150, 3185, 3220, 3255, 3290, 3325, 3360, 3395, 3430, 3465, 3500];
// ရွာတွင်း မြောက်-တောင် လမ်းသွယ်များ (အနောက်ဘက် ၄ လမ်း၊ အရှေ့ဘက် ၄ လမ်း)
export const htaukKyantCrossLanes = [-162, -120, -78, -36, 36, 78, 120, 162];

// AH1 ဘေး အိမ်အကွက်များ
const westBlockCols = [
 [-22, -32],
 [-52, -64],
 [-94, -106],
 [-136, -148],
];

const eastBlockCols = [
 [22, 32],
 [52, 64],
 [94, 106],
 [136, 148],
];

const houses: House[] = [];

/**
 * ထောက်ကြန့်ကျေးရွာ၏ အထင်ကရ အဆောက်အအုံများ:
 * - Htauk Kyant Football Playground (မိန်းလမ်းမကြီးနှင့် Pagodaဘုရားကြားတွင် တည်ရှိသည်: u = 48, v = 3280)
 * - Htauk Kyant Pagoda (ဘောလုံးကွင်း၏ အနောက်ဘက်/အရှေ့ဘက် အတွင်းပိုင်းတွင် တည်ရှိသည်: u = 104, v = 3280)
 * - Htauk Kyant Monastery (ဘုရား၏ မြောက်ဘက်: u = 104, v = 3205)
 * - Basic Education High School - BEHS (မိန်းလမ်းမကြီး အနောက်ဘက်ခြမ်း၊ ဘောလုံးကွင်းနှင့် မျက်နှာချင်းဆိုင်: u = -76, v = 3285)
 */
export type HtaukKyantLandmarkBuilding = House & {
 kind: 'pagoda' | 'stupa' | 'monastery' | 'school-main' | 'school-wing' | 'pavilion';
 height: number;
};

export const htaukKyantLandmarkBuildings: HtaukKyantLandmarkBuilding[] = [
 // ဘုရားမြောက်ဘက် ကျောင်းတိုက်
 {
  id: 'hk-landmark-monastery',
  name: 'ထောက်ကြန့် ကျောင်းတိုက်',
  kind: 'monastery',
  height: 8.5,
  ...toWorld(104, 3205),
  width: 26,
  depth: 18,
  color: '#c9b897',
  rotation: angle,
  roof: '#8f4f3b',
 },
 // ဘုရားဝင်း ပင်မ တန်ဆောင်း / ဓမ္မာရုံ
 {
  id: 'hk-landmark-pagoda-pavilion',
  name: 'ထောက်ကြန့်စေတီ ဓမ္မာရုံ / တန်ဆောင်း',
  kind: 'pavilion',
  height: 6.5,
  ...toWorld(104, 3290),
  width: 18,
  depth: 14,
  color: '#f4eedf',
  rotation: angle,
  roof: '#b35d46',
 },
 // ထောက်ကြန့် စေတီတော်ကြီး ပလ္လင်တော်နှင့် မုခ် (ဘောလုံးကွင်း၏ နောက်ဘက်ခြမ်း)
 {
  id: 'hk-landmark-pagoda-base',
  name: 'ထောက်ကြန့် စေတီတော်မြတ်ကြီး',
  kind: 'pagoda',
  height: 4,
  ...toWorld(104, 3268),
  width: 14,
  depth: 14,
  color: '#ebe3cd',
  rotation: angle,
  roof: '#e5ba3c',
 },
 // အနောက်ဘက်ခြမ်း အထက ထောက်ကြန့် ပင်မ ၂ ထပ်ကျောင်းဆောင်ကြီး
 {
  id: 'hk-landmark-school-main',
  name: 'အထက ထောက်ကြန့် ပင်မကျောင်းဆောင်ကြီး',
  kind: 'school-main',
  height: 9,
  ...toWorld(-64, 3275),
  width: 44,
  depth: 15,
  color: '#dbe5ec',
  rotation: angle,
  roof: '#2d5c80',
 },
 // အထက ထောက်ကြန့် အလယ်တန်း ကျောင်းဆောင်ခွဲ
 {
  id: 'hk-landmark-school-wing',
  name: 'အထက ထောက်ကြန့် စာသင်ဆောင်',
  kind: 'school-wing',
  height: 7,
  ...toWorld(-98, 3305),
  width: 32,
  depth: 13,
  color: '#e4dfd3',
  rotation: angle,
  roof: '#a04d3d',
 },
];

/** မြေပုံနှင့် 3D တွင် စေတီရင်ပြင်၊ ဘောလုံးကွင်း၊ ကျောင်းဝင်းများ */
export const htaukKyantLandmarks = [
 {
  id: 'hk-football-playground',
  name: 'Htauk Kyant Football Playground',
  ...toWorld(48, 3280),
  width: 52,
  depth: 74,
  rotation: angle,
 },
 {
  id: 'hk-pagoda-compound',
  name: 'Htauk Kyant Pagoda',
  ...toWorld(104, 3280),
  width: 52,
  depth: 56,
  rotation: angle,
 },
 {
  id: 'hk-school-yard',
  name: 'Basic Education High School',
  ...toWorld(-76, 3285),
  width: 76,
  depth: 90,
  rotation: angle,
 },
];

// လူနေအိမ်ခြေများ ထည့်သွင်းခြင်း (ဘုရား၊ ဘောလုံးကွင်း၊ ကျောင်း၊ ရေကန်နေရာများကို ချန်လှပ်သည်)
for (let rowBlock = 0; rowBlock < htaukKyantLanes.length - 1; rowBlock++) {
 const baseV = htaukKyantLanes[rowBlock];
 for (const offsetV of [11, 23]) {
  const v = baseV + offsetV;

  // အနောက်ဘက်ခြမ်း အိမ်များ
  for (let colBlock = 0; colBlock < westBlockCols.length; colBlock++) {
   // ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် နေရာများ
   if (v >= 3110 && v <= 3340 && colBlock >= 2) continue;
   // အထက ထောက်ကြန့် ကျောင်းဝင်း နေရာ
   if (v >= 3240 && v <= 3340 && colBlock <= 2) continue;
   // ရွာမ အနောက်တောင်လမ်း လမ်းကြောင်းနေရာ
   if (v >= 3400 && v <= 3445 && (colBlock === 1 || colBlock === 2)) continue;
   // ရွာအစွန် ကွေးဝိုက်ချက်များ
   if (rowBlock === 0 && colBlock >= 3) continue;
   if (rowBlock >= 10 && colBlock >= 3) continue;

   for (const u of westBlockCols[colBlock]) {
    const i = houses.length;
    houses.push({
     id: `htaukkyant-h${i + 1}`,
     name: `ထောက်ကြန့်အိမ် ${i + 1}`,
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
   // မိန်းလမ်းမကြီးနှင့် Pagoda ကြားရှိ ဘောလုံးကွင်း နေရာ (u = 22..74, v = 3240..3320)
   if (v >= 3240 && v <= 3320 && colBlock <= 1) continue;
   // ဘောလုံးကွင်းနောက်ရှိ ထောက်ကြန့် စေတီတော်မြတ်ကြီး နေရာ (u = 78..130, v = 3240..3320)
   if (v >= 3240 && v <= 3320 && colBlock === 2) continue;
   // စေတီတော်မြောက်ဘက် ကျောင်းတိုက် နေရာ
   if (v >= 3190 && v <= 3225 && colBlock >= 1) continue;
   // ရွာမ အရှေ့ဘက်ဝင်လမ်း လမ်းကြောင်းနေရာ
   if (v >= 3180 && v <= 3215 && colBlock >= 1) continue;
   // ရွာအစွန်ပိုင်းများ
   if (rowBlock === 0 && colBlock >= 3) continue;
   if (rowBlock >= 10 && colBlock >= 3) continue;

   for (const u of eastBlockCols[colBlock]) {
    const i = houses.length;
    houses.push({
     id: `htaukkyant-h${i + 1}`,
     name: `ထောက်ကြန့်အိမ် ${i + 1}`,
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

houses.push(...htaukKyantLandmarkBuildings);

const roads: RoadPlot[] = [
 // Htauk Kyant road.png ပါ အနီရောင်မျဉ်းဖြင့် ပြထားသော ရွာတွင်းလမ်းမကြီး
 {
  id: 'htaukkyant-central-road-1',
  name: 'ထောက်ကြန့် ရွာမဝင်လမ်း',
  ...toWorld(80, 3195),
  width: 140,
  depth: 6,
  rotation: angle,
  main: true,
 },
 {
  id: 'htaukkyant-central-road-2',
  name: 'ထောက်ကြန့် ဘုရားနှင့်ကျောင်းကြား ရွာလယ်လမ်း',
  ...toWorld(0, 3280),
  width: 8,
  depth: 210,
  rotation: angle,
  main: true,
 },
 {
  id: 'htaukkyant-central-road-3',
  name: 'ထောက်ကြန့် အနောက်တောင်လမ်း',
  ...toWorld(-90, 3420),
  width: 160,
  depth: 6,
  rotation: angle,
  main: true,
 },
 // အရှေ့-အနောက် ရွာတွင်းလမ်းသွယ်များ
 ...htaukKyantLanes.map((v, i) => ({
  id: `htaukkyant-ew-lane-${i + 1}`,
  name: `ထောက်ကြန့် လမ်းသွယ် ${i + 1}`,
  ...toWorld(0, v),
  width: 320,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 // မြောက်-တောင် လမ်းသွယ်များ
 ...htaukKyantCrossLanes.map((u, i) => ({
  id: `htaukkyant-ns-lane-${i + 1}`,
  name: `ထောက်ကြန့် အတွင်းလမ်း ${i + 1}`,
  ...toWorld(u, 3290),
  width: 4.5,
  depth: 430,
  rotation: angle,
  main: false,
 })),
];

// ရွာအနောက်ဘက် လယ်ကွင်းများ
const bundedFields: FieldPlot[] = [3120, 3180, 3240, 3300, 3360, 3420, 3480].flatMap((v, row) =>
 [-310, -355, -400].map((u, col) => ({
  id: `htaukkyant-west-paddy-${row}-${col}`,
  row,
  u,
  v,
  ...toWorld(u, v),
  width: 42,
  depth: 54,
  rotation: angle,
  color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
 }))
);

// ရွာအရှေ့ဘက် လယ်ကွင်းများ
const fields: FieldPlot[] = [3120, 3180, 3240, 3300, 3360, 3420, 3480].flatMap((v, row) =>
 [205, 250, 295].map((u, col) => ({
  id: `htaukkyant-east-field-${row}-${col}`,
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
 [3090, 3120, 3150, 3180, 3210, 3240, 3270, 3300, 3330, 3360, 3390, 3420, 3450, 3480, 3510].map((v, i) => ({
  id: `htaukkyant-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// ရေကန်ကြီးဘေး၊ ဘောလုံးကွင်းဘေး၊ ဘုရားဝင်းနှင့် ကျောင်းဝင်းပတ်လည် သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 // ရေကန်ကြီးနှင့် ကန်များပတ်လည်
 [-280, 3135],
 [-230, 3105],
 [-180, 3135],
 [-188, 3192],
 [-188, 3230],
 [-188, 3280],
 [-188, 3320],
 [-255, 3220],
 [-255, 3290],
 // ကျောင်းဝင်းပတ်လည်
 [-40, 3255],
 [-40, 3315],
 [-115, 3265],
 [-115, 3325],
 // မိန်းလမ်းမကြီးနှင့် ဘောလုံးကွင်းကြား သစ်ပင်တန်း
 [20, 3242],
 [20, 3318],
 // ဘောလုံးကွင်းနှင့် ဘုရားကြား သစ်ပင်တန်း
 [74, 3242],
 [74, 3318],
 // ဘုရားဝင်းနှင့် ကျောင်းတိုက်
 [80, 3205],
 [128, 3205],
 [80, 3280],
 [128, 3280],
 [104, 3252],
 [104, 3308],
].map(([u, v], i) => ({
 id: `htaukkyant-shade-${i}`,
 ...toWorld(u, v),
 radius: 1.15,
}));

// ရွာအစွန်နှင့် လယ်ကွင်းစပ် သစ်ပင်များ
const farmTrees: TreePlot[] = [3090, 3150, 3210, 3270, 3330, 3390, 3450, 3510].flatMap((v, i) => [
 { id: `htaukkyant-west-farm-tree-${i}`, ...toWorld(-270, v), radius: 0.5 },
 { id: `htaukkyant-east-farm-tree-${i}`, ...toWorld(185, v), radius: 0.5 },
]);

/**
 * ထောက်ကြန့်ကျေးရွာ (Htauk Kyant Village · Kalay Township)
 * Google Maps: 23.0818187, 94.0176266
 * သာယာကုန်းကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြားတွင် တည်ရှိသည်။
 * မိန်းလမ်းကြီးနှင့် Htauk Kyant Pagoda ကြားတွင် ဘောလုံးကွင်း (Football Playground) ရှိပြီး၊
 * မျက်နှာချင်းဆိုင် အနောက်ဘက်တွင် Basic Education High School (အထက ထောက်ကြန့်)၊
 * အနောက်မြောက်ဘက်တွင် ရေကန်ကြီးနှင့် တန်းစီရေကန် ၅ ကန် ရှိသည်။
 */
export const htaukKyantVillage: VillageMeta = {
 id: 'htaukkyant',
 name: 'ထောက်ကြန့်ကျေးရွာ',
 englishName: 'Htauk Kyant Village',
 villageTract: 'ထောက်ကြန့်ကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'သာယာကုန်းကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြား၊ မိန်းလမ်းကြီးနှင့် ဘုရားကြား ဘောလုံးကွင်း၊ မျက်နှာချင်းဆိုင် အထကကျောင်း၊ အနောက်မြောက် ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် ပါဝင်သော ထောက်ကြန့်ကျေးရွာ',
 coordinates: { lat: 23.0818187, lng: 94.0176266 },
 ...toWorld(0, 3280),
 labelPos: toWorld(0, 3255),
 separationFields: htaukKyantSeparationFields,
 canal: htaukKyantCanal,
 ponds: allHtaukKyantPonds,
 houses,
 roads,
 fields,
 bundedFields,
 trees,
 largeTrees,
 farmTrees,
};
