import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, WindingCanalPlot, VillageMeta } from '../../types.ts';

/**
 * ထိုမာကျေးရွာနှင့် သာယာကုန်းကျေးရွာကြား ခြားထားသော လယ်ကွင်း ၅၀ ကွင်း
 * (AH1 နှစ်ဖက်စီတွင် ၅ ကွင်းစီ ကွင်းတန်း ၁၀ တန် × မြောက်-တောင် ၅ တန် = ၅၀ ကွင်း၊ v = 2215 မှ 2403 အထိ)
 */
export const tharYarGoneSeparationFields: FieldPlot[] = [2215, 2262, 2309, 2356, 2403].flatMap((v, row) =>
 [-230, -185, -140, -95, -50, 50, 95, 140, 185, 230].map((u, col) => ({
  id: `htomar-tharyargone-sep-field-${row}-${col}`,
  row,
  u,
  v,
  ...toWorld(u, v),
  width: 40,
  depth: 40,
  rotation: angle,
  color: ['#8ca65c', '#a6af68', '#7e9c55', '#96a85d', '#86a257'][(row + col) % 5],
 }))
);

/**
 * Google Maps ပုံပါ သာယာကုန်းကျေးရွာ အနောက်ဘက်မှ ကွေ့ကောက်စီးဆင်းနေသော စမ်းချောင်း
 */
export const tharYarGoneStream: WindingCanalPlot = {
 id: 'tharyargone-west-stream',
 name: 'သာယာကုန်း အနောက်ဘက်ချောင်း',
 depth: 4,
 rotation: angle,
 points: [
  [-290, 2470],
  [-318, 2540],
  [-296, 2620],
  [-330, 2700],
  [-300, 2780],
  [-326, 2860],
  [-300, 2930],
  [-262, 2965],
 ],
 bridges: [],
};

// သာယာကုန်းကျေးရွာ အရှေ့-အနောက် လမ်းသွယ် ၁၁ လမ်း (အကွက် ၁၀ ကွက်)
export const tharYarGoneLanes = [2540, 2572, 2604, 2636, 2668, 2700, 2732, 2764, 2796, 2828, 2860];
// မြောက်-တောင် ရွာတွင်းလမ်းသွယ် ၆ လမ်း
export const tharYarGoneCrossLanes = [-40, -84, -128, -172, -216, -260];

// AH1 အနောက်ဘက်ခြမ်း အိမ်အကွက် ၆ ကွက်၏ u တန်ဖိုးများ
const westBlocks = [
 [-22, -32],
 [-52, -66],
 [-96, -110],
 [-140, -154],
 [-184, -198],
 [-228, -242],
];

const houses: House[] = [];

// AH1 အနောက်ဘက်ခြမ်း — Google Maps ပုံအတိုင်း လမ်းဆုံတန်းစီ အိမ်ခြေများ ပါဝင်သော ရွာကြီး
for (let rowBlock = 0; rowBlock < tharYarGoneLanes.length - 1; rowBlock++) {
 const baseV = tharYarGoneLanes[rowBlock];
 for (const offsetV of [10, 22]) {
  const v = baseV + offsetV;
  for (let colBlock = 0; colBlock < westBlocks.length; colBlock++) {
   // St. Assumption Church ဘုရားကျောင်းဝင်း (ရွာအလယ်ဗဟို)
   if (rowBlock === 5 && colBlock === 3) continue;
   // Kingdom Hall of Jehovah's Witnesses နေရာ
   if (rowBlock === 5 && colBlock === 5) continue;
   // Thitsar nantaw mango farms (သရက်ခြံ) နေရာ
   if (rowBlock === 3 && colBlock >= 4) continue;
   // Siangbawi Hlawnching မိုတယ်/တည်းခိုခန်း နေရာ
   if (rowBlock === 8 && colBlock === 0) continue;
   // ရွာမြောက်ပိုင်းနှင့် တောင်ပိုင်း အစွန်းများ (Google Maps ရွာပုံစံအတိုင်း ကျဉ်းမြောင်း)
   if (rowBlock === 0 && colBlock >= 4) continue;
   if (rowBlock === 8 && colBlock === 5) continue;
   if (rowBlock === 9 && colBlock >= 4) continue;

   for (const u of westBlocks[colBlock]) {
    const i = houses.length;
    houses.push({
     id: `tharyargone-h${i + 1}`,
     name: `သာယာကုန်းအိမ် ${i + 1}`,
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

// AH1 အရှေ့ဘက်ခြမ်း — မိန်းလမ်းမကြီးဘေး အိမ်ခြေ ၂ တန်း (Google Maps ပုံပါ AH1 အရှေ့ဘက် အိမ်စုငယ်)
for (let rowBlock = 1; rowBlock <= 6; rowBlock++) {
 const baseV = tharYarGoneLanes[rowBlock];
 for (const offsetV of [10, 22]) {
  const v = baseV + offsetV;
  for (const u of [24, 40]) {
   const i = houses.length;
   houses.push({
    id: `tharyargone-h${i + 1}`,
    name: `သာယာကုန်း အရှေ့ပိုင်းအိမ် ${i + 1}`,
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

/**
 * သာယာကုန်းကျေးရွာ၏ အထင်ကရ အဆောက်အအုံများ (tyg-landmark-* ဖြင့်စသော id များကို အထူးပုံစံဖြင့် 3D ဆွဲပေးသည်)
 * - St. Assumption Church (ရွာအလည်တည့်တည့်)
 * - Kingdom Hall of Jehovah's Witnesses
 * - Siangbawi Hlawnching တည်းခိုခန်း
 * - Sui Lian Thang လက်ဖက်ရည်ဆိုင် နှင့် AH1 ဘေး စားသောက်ဆိုင်
 * - Thida Tun Rice Mill-2 (ဆန်စက်)
 */
export type TharYarGoneLandmarkBuilding = House & {
 kind: 'church' | 'tower' | 'hall' | 'guesthouse' | 'shop' | 'mill';
 height: number;
};

export const tharYarGoneLandmarkBuildings: TharYarGoneLandmarkBuilding[] = [
 {
  id: 'tyg-landmark-church',
  name: 'St. Assumption Church · ဘုရားကျောင်း',
  kind: 'church',
  height: 8,
  ...toWorld(-147, 2718),
  width: 12,
  depth: 17,
  color: '#f1ead8',
  rotation: angle,
  roof: '#a8453a',
 },
 {
  id: 'tyg-landmark-church-tower',
  name: 'St. Assumption Church · ခေါင်းလောင်းစင်',
  kind: 'tower',
  height: 17,
  ...toWorld(-147, 2708),
  width: 7,
  depth: 5.5,
  color: '#f4eedf',
  rotation: angle,
  roof: '#8a3c33',
 },
 {
  id: 'tyg-landmark-kingdom-hall',
  name: "Kingdom Hall of Jehovah's Witnesses",
  kind: 'hall',
  height: 5.5,
  ...toWorld(-235, 2716),
  width: 14,
  depth: 12,
  color: '#e4e2d8',
  rotation: angle,
  roof: '#6f8da3',
 },
 {
  id: 'tyg-landmark-siangbawi',
  name: 'Siangbawi Hlawnching · တည်းခိုခန်း',
  kind: 'guesthouse',
  height: 6,
  ...toWorld(-26, 2845),
  width: 14,
  depth: 13,
  color: '#e8d9bf',
  rotation: angle,
  roof: '#b9604a',
 },
 {
  id: 'tyg-landmark-sui-lian-thang',
  name: 'Sui Lian Thang · လက်ဖက်ရည်ဆိုင်',
  kind: 'shop',
  height: 4,
  ...toWorld(24, 2844),
  width: 8,
  depth: 7,
  color: '#dce8df',
  rotation: angle - Math.PI / 2,
  roof: '#497a6b',
 },
 {
  id: 'tyg-landmark-restaurant',
  name: 'AH1 ဘေး စားသောက်ဆိုင်',
  kind: 'shop',
  height: 4,
  ...toWorld(24, 2812),
  width: 9,
  depth: 7.5,
  color: '#efe0c4',
  rotation: angle - Math.PI / 2,
  roof: '#b54d3a',
 },
 {
  id: 'tyg-landmark-rice-mill',
  name: 'Thida Tun Rice Mill-2 · ဆန်စက်',
  kind: 'mill',
  height: 9,
  ...toWorld(52, 2905),
  width: 24,
  depth: 16,
  color: '#cbbd98',
  rotation: angle,
  roof: '#9b8a62',
 },
];

houses.push(...tharYarGoneLandmarkBuildings);

/** မြေပုံနှင့် 3D တွင် ကျောင်းဝင်း၊ ရင်ပြင်များ ပြသရန် */
export const tharYarGoneLandmarks = [
 {
  id: 'tyg-church-plaza',
  name: 'St. Assumption Church',
  ...toWorld(-147, 2717),
  width: 32,
  depth: 22,
  rotation: angle,
 },
 {
  id: 'tyg-kingdom-hall-yard',
  name: "Kingdom Hall",
  ...toWorld(-235, 2716),
  width: 22,
  depth: 18,
  rotation: angle,
 },
 {
  id: 'tyg-rice-mill-yard',
  name: 'Thida Tun Rice Mill-2',
  ...toWorld(52, 2905),
  width: 36,
  depth: 26,
  rotation: angle,
 },
];

const roads: RoadPlot[] = [
 // ရွာအလယ် အရှေ့-အနောက် ရွာမလမ်းမကြီး (St. Assumption Church ၏ မြောက်ဘက်၊ v = 2700)
 {
  id: 'tharyargone-main-road',
  name: 'သာယာကုန်း ရွာမလမ်းမကြီး',
  ...toWorld(-133, 2700),
  width: 262,
  depth: 7,
  rotation: angle,
  main: true,
 },
 // ကျန် အရှေ့-အနောက် လမ်းသွယ်များ
 ...tharYarGoneLanes.filter(v => v !== 2700).map((v, i) => ({
  id: `tharyargone-ew-lane-${i + 1}`,
  name: `သာယာကုန်း လမ်းသွယ် ${i + 1}`,
  ...toWorld(-133, v),
  width: 262,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 // မြောက်-တောင် ရွာတွင်းလမ်းသွယ် ၆ လမ်း
 ...tharYarGoneCrossLanes.map((u, i) => ({
  id: `tharyargone-ns-lane-${i + 1}`,
  name: `သာယာကုန်း အတွင်းလမ်း ${i + 1}`,
  ...toWorld(u, 2700),
  width: 4.5,
  depth: 340,
  rotation: angle,
  main: false,
 })),
 // AH1 အရှေ့ဘက် အိမ် ၂ တန်း အရှေ့-အနောက်လမ်းသွယ်များ
 ...[2572, 2604, 2636, 2668, 2700, 2732, 2764].map((v, i) => ({
  id: `tharyargone-east-ew-lane-${i + 1}`,
  name: `သာယာကုန်း အရှေ့လမ်းသွယ် ${i + 1}`,
  ...toWorld(32, v),
  width: 40,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 {
  id: 'tharyargone-east-ns-lane',
  name: 'သာယာကုန်း အရှေ့အိမ်တန်းလမ်း',
  ...toWorld(52, 2668),
  width: 4,
  depth: 200,
  rotation: angle,
  main: false,
 },
];

// AH1 အနောက်ဘက် ရွာ၏ အနောက်ဘက် ကန်သင်းရိုးပါ လယ်ကွင်းများ (စမ်းချောင်းအနောက်)
const bundedFields: FieldPlot[] = [2560, 2610, 2660, 2710, 2760, 2810, 2860].flatMap((v, row) =>
 [-372, -416, -460].map((u, col) => ({
  id: `tharyargone-west-paddy-${row}-${col}`,
  row,
  u,
  v,
  ...toWorld(u, v),
  width: 40,
  depth: 44,
  rotation: angle,
  color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
 }))
);

// AH1 အရှေ့ဘက် အိမ် ၂ တန်း၏ နောက်ရှိ လယ်ကွင်းများ
const fields: FieldPlot[] = [2560, 2610, 2660, 2710, 2760, 2810, 2860].flatMap((v, row) =>
 [90, 135, 180, 225].map((u, col) => ({
  id: `tharyargone-east-field-${row}-${col}`,
  u,
  v,
  ...toWorld(u, v),
  width: 40,
  depth: 44,
  rotation: angle,
  color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
 }))
);

// AH1 လမ်းမဘေး သစ်ပင်တန်း
const trees: TreePlot[] = [-12, 12].flatMap((u, sideIdx) =>
 [2548, 2576, 2604, 2632, 2660, 2688, 2716, 2744, 2772, 2800, 2828, 2856].map((v, i) => ({
  id: `tharyargone-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// သရက်ခြံ (Thitsar nantaw mango farms)၊ ဘုရားကျောင်းဝင်းနှင့် ရွာတွင်း သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 ...[-184, -198, -230, -244].flatMap(u =>
  [2644, 2652, 2660].map(v => [u, v] as [number, number])
 ),
 [-164, 2706],
 [-164, 2726],
 [-215, 2722],
 [60, 2690],
 [60, 2740],
 [-75, 2590],
 [-75, 2780],
].map(([u, v], i) => ({
 id: `tharyargone-shade-${i}`,
 ...toWorld(u, v),
 radius: 1.1,
}));

// ရွာအနောက်ဘက်အစွန်နှင့် လယ်ကွင်းစပ် သစ်ပင်များ
const farmTrees: TreePlot[] = [2560, 2610, 2660, 2710, 2760, 2810, 2860].map((v, i) => ({
 id: `tharyargone-farm-tree-${i}`,
 ...toWorld(-270, v),
 radius: 0.5,
}));

/**
 * သာယာကုန်းကျေးရွာ (Thar Yar Gone Village · Kalay Township)
 * Google Maps: 23.0969275, 94.0191043
 * ထိုမာကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြားတွင် တည်ရှိပြီး ရွာအလည်တည့်တည့်တွင် St. Assumption Church ရှိသည်။
 * ထိုမာကျေးရွာနှင့်ကြား လယ်ကွင်း ၅၀ ကွင်း ခြားထားသည်။
 */
export const tharYarGoneVillage: VillageMeta = {
 id: 'tharyargone',
 name: 'သာယာကုန်းကျေးရွာ',
 englishName: 'Thar Yar Gone Village',
 villageTract: 'သာယာကုန်းကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'ထိုမာကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြား၊ လယ်ကွင်း ၅၀ ကွင်းအခြားတွင် ရွာအလည်တည့်တည့် St. Assumption Church ဘုရားကျောင်း ပါဝင်သော သာယာကုန်းကျေးရွာ',
 coordinates: { lat: 23.0969275, lng: 94.0191043 },
 ...toWorld(-133, 2700),
 labelPos: toWorld(-133, 2686),
 separationFields: tharYarGoneSeparationFields,
 connectingCanal: tharYarGoneStream,
 houses,
 roads,
 fields,
 bundedFields,
 trees,
 largeTrees,
 farmTrees,
};
