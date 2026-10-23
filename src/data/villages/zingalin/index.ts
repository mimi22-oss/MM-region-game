import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, WindingCanalPlot, VillageMeta } from '../../types.ts';

/**
 * ချင်းဆိုင်ရွာနှင့် ဇင်းကလင်းကျေးရွာကြား ခြားထားသော လယ်ကွင်းများ
 * (AH1 အနောက်ဘက်ခြမ်း၊ v = 1265 မှ 1345 အထိ)
 */
export const zingalinSeparationFields: FieldPlot[] = [1265, 1305, 1345].map((v, i) => ({
 id: `chinsai-zingalin-sep-field-${i + 1}`,
 row: i,
 u: -82,
 v,
 ...toWorld(-82, v),
 width: 116,
 depth: 30,
 rotation: angle,
 color: ['#7e9c55', '#96a85d', '#86a257'][i % 3],
}));

/**
 * Google Maps ပုံပါ ဇင်းကလင်းကျေးရွာ အရှေ့မြောက်ဘက်မှ ကွေ့ကောက်စီးဆင်းလာပြီး
 * AH1 လမ်းမကြီးကို ဖြတ်ကျော်စီးဆင်းသွားသော ဇီးချောင်း (Zee Chaung Stream)
 */
export const zeeChaungStream: WindingCanalPlot = {
 id: 'zingalin-zee-chaung',
 name: 'ဇီးချောင်း',
 depth: 4.5,
 rotation: angle,
 points: [
  [-235, 1310],
  [-195, 1355],
  [-145, 1395],
  [-85, 1425],
  [-24, 1448],
  [24, 1448],
  [78, 1482],
  [125, 1545],
  [165, 1615],
 ],
 bridges: [{ u: 0, v: 1448, width: 18, depth: 12 }],
};

// Google Maps ပုံအတိုင်း ဇင်းကလင်းကျေးရွာ၏ ရှည်မျောမျော လမ်းကွန်ရက် (တောင်ဘက် AH1 မှ အနောက်မြောက်ဘက်သို့ သွယ်တန်းနေသော ပုံစံ)
export const zingalinLanes = [1398, 1430, 1462, 1494, 1526, 1558, 1590];
export const zingalinCrossLanes = [-52, -108, -164, -220, -276, -332];

const westBlockCols = [
 [-22, -38],       // Tier 0: AH1 နှင့် -52 ကြား (တောင်ပိုင်း AH1 အနီး)
 [-68, -88],       // Tier 1: -52 နှင့် -108 ကြား
 [-124, -144],     // Tier 2: -108 နှင့် -164 ကြား (ရွာလယ်ပိုင်း)
 [-180, -200],     // Tier 3: -164 နှင့် -220 ကြား
 [-236, -256],     // Tier 4: -220 နှင့် -276 ကြား (အနောက်မြောက်ပိုင်း)
 [-292, -312],     // Tier 5: -276 နှင့် -332 ကြား (အနောက်မြောက်အဖျားပိုင်း)
];

const houses: House[] = [];

// Google Maps ပုံပါ ဇင်းကလင်းကျေးရွာ၏ ရှည်မျောမျော အနားသတ်ပုံစံအတိုင်း အိမ်ခြေများ နေရာချထားခြင်း
for (let rowBlock = 0; rowBlock < zingalinLanes.length - 1; rowBlock++) {
 const baseV = zingalinLanes[rowBlock];
 for (const offsetV of [10, 21]) {
  const v = baseV + offsetV;
  for (let tierIdx = 0; tierIdx < westBlockCols.length; tierIdx++) {
   // အနောက်မြောက်ဘက် အဖျားပိုင်း (rowBlock 0, 1: v=1398..1462) သည် အနောက်ဘက်အတွင်းပိုင်း (tierIdx >= 3) တွင် ရှည်မျောမျော တည်ရှိသည်
   if (rowBlock === 0 && (tierIdx < 4 || tierIdx > 5)) continue;
   if (rowBlock === 1 && tierIdx < 3) continue;
   // အလယ်ပိုင်း (rowBlock 2: v=1462..1494) သည် tierIdx 1 မှ 5 အထိ ရှိသည်
   if (rowBlock === 2 && tierIdx < 1) continue;
   // ဇေတဝန်ကျောင်းတိုက် နေရာ (rowBlock 3, tierIdx 1) ကို ချန်ထားသည်
   if (rowBlock === 3 && tierIdx === 1) continue;
   // တောင်ဘက်ပိုင်း (rowBlock 4, 5: v=1526..1590) သည် AH1 လမ်းမကြီးအနီး (tierIdx 0 မှ 3) တွင် စုစည်းတည်ရှိသည်
   if (rowBlock === 4 && tierIdx > 3) continue;
   if (rowBlock === 5 && tierIdx > 2) continue;

   for (const u of westBlockCols[tierIdx]) {
    const i = houses.length;
    houses.push({
     id: `zingalin-h${i + 1}`,
     name: `ဇင်းကလင်းအိမ် ${i + 1}`,
     ...toWorld(u, v),
     width: 7.5,
     depth: 6.5,
     color: ['#d8c7a3', '#bd9973', '#a9b9b0', '#c7b299'][(i + rowBlock + tierIdx) % 4],
     rotation: angle,
     roof: ['#8b5545', '#849699', '#a39a85', '#7d6655'][(i + rowBlock + tierIdx) % 4],
    });
   }
  }
 }
}

// Google Maps ပုံအတိုင်း AH1 လမ်းမကြီး၏ အရှေ့တောင်ဘက်ခြမ်း (v = 1526..1590) ရွာနယ်နိမိတ်အတွင်းရှိ အိမ်ခြေများ
for (let rowBlock = 3; rowBlock < zingalinLanes.length - 1; rowBlock++) {
 const baseV = zingalinLanes[rowBlock];
 for (const offsetV of [10, 21]) {
  const v = baseV + offsetV;
  for (const u of [24, 40]) {
   if (rowBlock === 5 && u === 40) continue;
   const i = houses.length;
   houses.push({
    id: `zingalin-h${i + 1}`,
    name: `ဇင်းကလင်း အရှေ့ပိုင်းအိမ် ${i + 1}`,
    ...toWorld(u, v),
    width: 7.5,
    depth: 6.5,
    color: ['#d8c7a3', '#bfa58a', '#a9b9b0', '#c7b299'][i % 4],
    rotation: angle - Math.PI / 2,
    roof: ['#849699', '#8b5545', '#a39a85', '#7d6655'][i % 4],
   });
  }
 }
}

// Google Maps ပုံပါ ဇေတဝန်ကျောင်း (ဇင်းကလင်းရွာ)
export const zingalinMonasteries = [
 {
  id: 'zingalin-jetavan',
  name: 'ဇေတဝန်ကျောင်း · ဇင်းကလင်းရွာ',
  u: -78,
  v: 1510,
  ...toWorld(-78, 1510),
  width: 44,
  depth: 22,
  rotation: angle,
 },
];

houses.push(
 {
  id: 'zingalin-jetavan-main',
  name: 'ဇေတဝန်ကျောင်း · ကျောင်းဆောင်ကြီး',
  ...toWorld(-70, 1510),
  width: 14,
  depth: 10,
  color: '#e7d7b4',
  rotation: angle,
  roof: '#80564d',
 },
 {
  id: 'zingalin-jetavan-dhamma',
  name: 'ဇေတဝန်ကျောင်း · ဓမ္မာရုံ',
  ...toWorld(-88, 1510),
  width: 12,
  depth: 9,
  color: '#d8cfb7',
  rotation: angle,
  roof: '#547b69',
 }
);

const roads: RoadPlot[] = [
 // AH1 မှ ဇင်းကလင်းရွာလယ်နှင့် အနောက်မြောက်ပိုင်းသို့ သွယ်တန်းသွားသော အဓိက ရွာမလမ်းမကြီး ၂ လမ်း (v = 1494, 1526)
 {
  id: 'zingalin-main-road-1',
  name: 'ဇင်းကလင်း ရွာမလမ်းမကြီး (၁)',
  ...toWorld(-172, 1494),
  width: 332,
  depth: 6,
  rotation: angle,
  main: true,
 },
 {
  id: 'zingalin-main-road-2',
  name: 'ဇင်းကလင်း ရွာမလမ်းမကြီး (၂)',
  ...toWorld(-144, 1526),
  width: 276,
  depth: 6,
  rotation: angle,
  main: true,
 },
 // အနောက်မြောက်ပိုင်း လမ်းသွယ်များ (v = 1398, 1430, 1462)
 {
  id: 'zingalin-ew-lane-1',
  name: 'ဇင်းကလင်း မြောက်ပိုင်းလမ်းသွယ် (၁)',
  ...toWorld(-276, 1398),
  width: 120,
  depth: 4,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ew-lane-2',
  name: 'ဇင်းကလင်း မြောက်ပိုင်းလမ်းသွယ် (၂)',
  ...toWorld(-248, 1430),
  width: 176,
  depth: 4,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ew-lane-3',
  name: 'ဇင်းကလင်း အလယ်ပိုင်းလမ်းသွယ်',
  ...toWorld(-192, 1462),
  width: 280,
  depth: 4.5,
  rotation: angle,
  main: false,
 },
 // တောင်ပိုင်း AH1 အနီး လမ်းသွယ်များ (v = 1558, 1590)
 {
  id: 'zingalin-ew-lane-4',
  name: 'ဇင်းကလင်း တောင်ပိုင်းလမ်းသွယ် (၁)',
  ...toWorld(-116, 1558),
  width: 220,
  depth: 4.5,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ew-lane-5',
  name: 'ဇင်းကလင်း တောင်ပိုင်းလမ်းသွယ် (၂)',
  ...toWorld(-88, 1590),
  width: 164,
  depth: 4,
  rotation: angle,
  main: false,
 },
 // AH1 အရှေ့ဘက်ခြမ်း ရွာတွင်းလမ်းသွယ်များ
 ...[1494, 1526, 1558, 1590].map((v, i) => ({
  id: `zingalin-east-ew-lane-${i + 1}`,
  name: `ဇင်းကလင်း အရှေ့လမ်းသွယ် ${i + 1}`,
  ...toWorld(29, v),
  width: 46,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 {
  id: 'zingalin-east-ns-lane',
  name: 'ဇင်းကလင်း အရှေ့ပိုင်းလမ်း',
  ...toWorld(52, 1542),
  width: 4,
  depth: 100,
  rotation: angle,
  main: false,
 },
 // ဇင်းကလင်းရွာတွင်း မြောက်-တောင် ကန့်လန့်ဖြတ်လမ်းသွယ် ၆ လမ်း
 {
  id: 'zingalin-ns-lane-1',
  name: 'ဇင်းကလင်း အတွင်းလမ်း ၁',
  ...toWorld(-52, 1542),
  width: 4.5,
  depth: 100,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ns-lane-2',
  name: 'ဇင်းကလင်း အတွင်းလမ်း ၂',
  ...toWorld(-108, 1526),
  width: 4.5,
  depth: 132,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ns-lane-3',
  name: 'ဇင်းကလင်း အတွင်းလမ်း ၃',
  ...toWorld(-164, 1510),
  width: 4.5,
  depth: 100,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ns-lane-4',
  name: 'ဇင်းကလင်း အတွင်းလမ်း ၄',
  ...toWorld(-220, 1478),
  width: 4.5,
  depth: 100,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ns-lane-5',
  name: 'ဇင်းကလင်း အတွင်းလမ်း ၅',
  ...toWorld(-276, 1446),
  width: 4.5,
  depth: 100,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-ns-lane-6',
  name: 'ဇင်းကလင်း အတွင်းလမ်း ၆',
  ...toWorld(-332, 1446),
  width: 4,
  depth: 100,
  rotation: angle,
  main: false,
 },
 // Google Maps ပုံအတိုင်း ရွာမှ အနောက်ဘက် လယ်ကွင်းများထဲသို့ ဖြာထွက်သွားသော လယ်ကွင်းလမ်း ၂ လမ်း
 {
  id: 'zingalin-west-field-track-1',
  name: 'ဇင်းကလင်း အနောက်လယ်ကွင်းလမ်း (၁)',
  ...toWorld(-396, 1430),
  width: 120,
  depth: 3.5,
  rotation: angle,
  main: false,
 },
 {
  id: 'zingalin-west-field-track-2',
  name: 'ဇင်းကလင်း အနောက်လယ်ကွင်းလမ်း (၂)',
  ...toWorld(-396, 1494),
  width: 120,
  depth: 3.5,
  rotation: angle,
  main: false,
 },
];

// ဇင်းကလင်းရွာ အနောက်ဘက်နှင့် တောင်ဘက်ရှိ ကန်သင်းရိုးပါ စပါးစိုက်ခင်းများ
const bundedFields: FieldPlot[] = [
 ...[1410, 1455, 1515, 1560, 1605].flatMap((v, row) =>
  [-368, -412, -456].map((u, col) => ({
   id: `zingalin-west-paddy-${row}-${col}`,
   row,
   u,
   v,
   ...toWorld(u, v),
   width: 38,
   depth: 32,
   rotation: angle,
   color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
  }))
 ),
];

// AH1 အရှေ့ဘက်ခြမ်း လယ်ကွင်းများ
const fields: FieldPlot[] = [1265, 1305, 1345, 1385, 1510, 1550, 1590].flatMap((v, row) =>
 [84, 132, 180].map((u, col) => ({
  id: `zingalin-east-field-${row}-${col}`,
  u,
  v,
  ...toWorld(u, v),
  width: 42,
  depth: 30,
  rotation: angle,
  color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
 }))
);

// AH1 လမ်းမဘေး ဇင်းကလင်းရွာအဝင် အရိပ်ရ သစ်ပင်တန်း
const trees: TreePlot[] = [-12, 12].flatMap((u, sideIdx) =>
 [1472, 1486, 1506, 1518, 1538, 1550, 1570, 1582, 1602].map((v, i) => ({
  id: `zingalin-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// ဇင်းကလင်းရွာအတွင်းနှင့် ဇီးချောင်းဘေး သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 ...[
  [-14, 1265],
  [-18, 1310],
  [-14, 1355],
  [-15, 1415],
  [-56, 1490],
  [-112, 1490],
  [-168, 1458],
  [-224, 1458],
  [-280, 1426],
  [-336, 1426],
  [-56, 1554],
  [-112, 1554],
  [12, 1490],
  [56, 1522],
 ].map(([u, v], i) => ({
  id: `zingalin-shade-${i}`,
  ...toWorld(u, v),
  radius: 1.1,
 })),
];

// ဇင်းကလင်းရွာ အနောက်ဘက် လယ်ကွင်းစပ် သစ်ပင်များ
const farmTrees: TreePlot[] = [
 [-340, 1408],
 [-340, 1445],
 [-340, 1480],
 [-265, 1515],
 [-205, 1545],
 [-150, 1580],
].map(([u, v], i) => ({
 id: `zingalin-farm-tree-${i}`,
 ...toWorld(u, v),
 radius: 0.5,
}));

/**
 * ဇင်းကလင်းကျေးရွာ (Zingalin / Zinkalae Village · Kalay Township)
 * Google Maps: 23.137794, 94.0341038
 * ချင်းဆိုင်ရွာနှင့် ဝေပုလ္လတောင်ကြီးကြားတွင် တည်ရှိသည်။
 */
export const zingalinVillage: VillageMeta = {
 id: 'zingalin',
 name: 'ဇင်းကလင်းကျေးရွာ',
 englishName: 'Zingalin Village',
 villageTract: 'ဇင်းကလင်းကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'ချင်းဆိုင်ရွာနှင့် ဝေပုလ္လတောင်ကြီးကြား၊ ဇီးချောင်းနှင့် ဇေတဝန်ကျောင်းတိုက်တို့ ပါဝင်သော ဇင်းကလင်းကျေးရွာ',
 coordinates: { lat: 23.137794, lng: 94.0341038 },
 ...toWorld(-144, 1494),
 labelPos: toWorld(-155, 1482),
 separationFields: zingalinSeparationFields,
 connectingCanal: zeeChaungStream,
 houses,
 roads,
 fields,
 bundedFields,
 trees,
 largeTrees,
 farmTrees,
};

