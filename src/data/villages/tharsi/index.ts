import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, WindingCanalPlot, EastWestCanalPlot, VillageMeta } from '../../types.ts';

/**
 * မြို့သာရပ်ကွက် · နယ်မြေ (၅) နှင့် သာစည်ရွာကြား ခြားထားသော လယ်ကွင်း ၆ ကွက်
 * (AH1 အနောက်ဘက်ခြမ်း၊ v = 425 မှ 615 အထိ ၆ ကွက်တန်းစီထားသည်)
 */
export const separationFields: FieldPlot[] = [425, 463, 501, 539, 577, 615].map((v, i) => ({
 id: `myothar-tharsi-sep-field-${i + 1}`,
 row: i,
 u: -82,
 v,
 ...toWorld(-82, v),
 width: 116,
 depth: 32,
 rotation: angle,
 color: ['#7e9c55', '#96a85d', '#86a257'][i % 3],
}));

/**
 * မြို့သာရပ်ကွက် · နယ်မြေ (၅) ရှိ ရေမြောင်းဆုံရာနေရာ (-160, 388) မှ
 * မြောင်းတစ်ခုအဖြစ် လယ်ကွင်းများ အနောက်ဘက်ကနေ ကွေ့ကောက်စီးဆင်းလာပြီး
 * သာစည်ရွာ အနောက်ဘက် အရှေ့-အနောက် ရေမြောင်းထိပ် (-360, 658) နှင့် ပူးပေါင်းစီးဆင်းသော ရေမြောင်း
 */
export const connectingCanal: WindingCanalPlot = {
 id: 'tharsi-connecting-canal',
 name: 'မြို့သာ-သာစည် ကွေ့ကောက် ဆက်သွယ်ရေး ရေမြောင်း',
 depth: 3.8,
 rotation: angle,
 points: [
  [-160, 388],
  [-170, 412],
  [-212, 442],
  [-186, 478],
  [-246, 516],
  [-218, 554],
  [-292, 592],
  [-334, 626],
  [-360, 658],
 ],
 bridges: [],
};

/**
 * လယ်ကွင်း ၆ ကွက်နှင့် သာစည်ရွာကြားတွင် AH1 လမ်းမကြီးကို ကန့်လန့်ဖြတ်သွားပြီး
 * အနောက်ဘက် ရေမြောင်းထိပ် (-360, 658) တွင် ကွေ့ကောက်ရေမြောင်းနှင့် ပူးပေါင်းစီးဆင်းသော အရှေ့-အနောက် ရေမြောင်း
 */
export const tharSiCanal: EastWestCanalPlot = {
 id: 'tharsi-ew-canal',
 name: 'သာစည် အရှေ့-အနောက် ရေမြောင်း',
 u: -65,
 v: 658,
 uMin: -360,
 uMax: 230,
 ...toWorld(-65, 658),
 width: 4.5,
 depth: 590,
 rotation: angle,
 bridges: [{ u: 0, v: 658, width: 14, depth: 7 }],
};

// မိန်းလမ်းမကြီးဘေးတွင် ဘေးချင်းယှဉ် ၂ ရပ်ကွက်တန်း (မြောက်ဘက်ခြမ်း ၄ ကွက် + တောင်ဘက်ခြမ်း ၄ ကွက် = လမ်းသွယ် ၉ လမ်း)
export const tharSiLanes = [672, 703, 734, 765, 796, 827, 858, 889, 920];
// အနောက်ဘက်သို့ ၃ တန်းစီ (၂ ရပ်ကွက် × ၃ တန်း = ၆ ရပ်ကွက်) ခွဲခြားပေးသော မြောက်-တောင် ရွာတွင်းလမ်းများ
export const tharSiCrossLanes = [-114, -218, -322];
export const tharSiEastCrossLanes = [56];

// အနောက်ဘက် ၃ တန်း (Tier 1, Tier 2, Tier 3) တစ်တန်းလျှင် အိမ် ၆ လုံးစီ
const westSectionTiers = [
 [-24, -39, -54, -69, -84, -99],
 [-128, -143, -158, -173, -188, -203],
 [-232, -247, -262, -277, -292, -307],
];

const houses: House[] = [];

// မိန်းလမ်းမကြီး (AH1) အနောက်ဘက်ခြမ်း — ဘေးချင်းယှဉ် ၂ ရပ်ကွက် × အနောက်ဘက် ၃ တန်း = ၆ ရပ်ကွက် (တစ်ရပ်ကွက်လျှင် ၄၈ လုံး၊ စုစုပေါင်း ၂၈၈ လုံး)
for (let tierIdx = 0; tierIdx < westSectionTiers.length; tierIdx++) {
 const tierCols = westSectionTiers[tierIdx];
 for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
  const wardNum = tierIdx * 2 + sideIdx + 1;
  const startBlock = sideIdx * 4;
  for (let b = 0; b < 4; b++) {
   const baseV = tharSiLanes[startBlock + b];
   for (const offsetV of [10, 21]) {
    const v = baseV + offsetV;
    for (const u of tierCols) {
     const i = houses.length;
     houses.push({
      id: `tharsi-h${i + 1}`,
      name: `သာစည် ရပ်ကွက် (${wardNum}) · အိမ် ${i + 1}`,
      ...toWorld(u, v),
      width: 7.5,
      depth: 6.5,
      color: ['#d8c7a3', '#bd9973', '#a9b9b0', '#c7b299'][(i + wardNum) % 4],
      rotation: angle,
      roof: ['#8b5545', '#849699', '#a39a85', '#7d6655'][(i + wardNum) % 4],
     });
    }
   }
  }
 }
}

// AH1 အရှေ့ဘက်ခြမ်း — မိန်းလမ်းမကြီးနှင့် လယ်ကွင်းကြားတွင် အိမ်ခြေ ၂ တန်း (u = 24, 42)
for (let block = 0; block < tharSiLanes.length - 1; block++) {
 const baseV = tharSiLanes[block];
 for (const offsetV of [10, 21]) {
  const v = baseV + offsetV;
  for (const u of [24, 42]) {
   const i = houses.length;
   houses.push({
    id: `tharsi-h${i + 1}`,
    name: `သာစည် အရှေ့ပိုင်းအိမ် ${i + 1}`,
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

const roads: RoadPlot[] = [
 // သာစည် ရွာမလမ်းမကြီး (ဘေးချင်းယှဉ် ၂ ရပ်ကွက်ကြား ဗဟိုလမ်းမကြီး v = 796)
 {
  id: 'tharsi-main-road',
  name: 'သာစည် ရွာမလမ်းမကြီး',
  ...toWorld(-164, 796),
  width: 316,
  depth: 7.5,
  rotation: angle,
  main: true,
 },
 {
  id: 'tharsi-east-main-road',
  name: 'သာစည် အရှေ့ပိုင်း ရွာမလမ်း',
  ...toWorld(31, 796),
  width: 50,
  depth: 7.5,
  rotation: angle,
  main: true,
 },
 // အနောက်ဘက် ၆ ရပ်ကွက်အတွင်း အရှေ့-အနောက် လမ်းသွယ်များ
 ...tharSiLanes.filter(v => v !== 796).map((v, i) => ({
  id: `tharsi-ew-lane-${i + 1}`,
  name: `သာစည် လမ်းသွယ် ${i + 1}`,
  ...toWorld(-164, v),
  width: 316,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 // အရှေ့ဘက် အိမ် ၂ တန်းအတွင်း အရှေ့-အနောက် လမ်းသွယ်များ
 ...tharSiLanes.filter(v => v !== 796).map((v, i) => ({
  id: `tharsi-east-ew-lane-${i + 1}`,
  name: `သာစည် အရှေ့လမ်းသွယ် ${i + 1}`,
  ...toWorld(31, v),
  width: 50,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 // အနောက်ဘက် ၆ ရပ်ကွက်ကို ပိုင်းခြားပေးသော မြောက်-တောင် ရွာတွင်းလမ်းများ
 ...tharSiCrossLanes.map((u, i) => ({
  id: `tharsi-ns-lane-${i + 1}`,
  name: `သာစည် ရပ်ကွက်ခြားလမ်း ${i + 1}`,
  ...toWorld(u, 796),
  width: 4.5,
  depth: 252,
  rotation: angle,
  main: false,
 })),
 // အရှေ့ဘက် အိမ် ၂ တန်းနှင့် လယ်ကွင်းကြား မြောက်-တောင် လမ်းသွယ်
 ...tharSiEastCrossLanes.map((u, i) => ({
  id: `tharsi-east-ns-lane-${i + 1}`,
  name: `သာစည် အရှေ့အတွင်းလမ်း ${i + 1}`,
  ...toWorld(u, 796),
  width: 4,
  depth: 252,
  rotation: angle,
  main: false,
 })),
];

// အနောက်ဘက် ၆ ရပ်ကွက်၏ အနောက်ဘက်နှင့် တောင်ဖီလာတောင်ကြားရှိ လယ်ကွက်များ (ကန်သင်းရိုးပါ စပါးစိုက်ခင်း ၁၈ ကွက်)
const bundedFields: FieldPlot[] = [688, 730, 772, 814, 856, 898].flatMap((v, row) =>
 [-354, -398, -442].map((u, col) => ({
  id: `tharsi-paddy-${row}-${col}`,
  row,
  u,
  v,
  ...toWorld(u, v),
  width: 38,
  depth: 34,
  rotation: angle,
  color: ['#7d9c54', '#98a85e', '#6f9252', '#a3ad64'][(row + col) % 4],
 }))
);

// AH1 အရှေ့ဘက် အိမ်ခြေ ၂ တန်း (u = 24, 42) ၏ နောက်ရှိ လယ်ကွင်း/စိုက်ခင်းများ
const fields: FieldPlot[] = [688, 730, 772, 814, 856, 898].flatMap((v, row) =>
 [86, 134, 182].map((u, col) => ({
  id: `tharsi-east-field-${row}-${col}`,
  u,
  v,
  ...toWorld(u, v),
  width: 42,
  depth: 34,
  rotation: angle,
  color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
 }))
);

// AH1 လမ်းမဘေး သာစည်ရွာရှေ့ အနောက်ဘက်နှင့် အရှေ့ဘက် အရိပ်ရ သစ်ပင်တန်း
const trees: TreePlot[] = [-13, 13].flatMap((u, sideIdx) =>
 [682, 693, 713, 724, 744, 755, 775, 786, 807, 817, 837, 848, 868, 879, 899, 910].map((v, i) => ({
  id: `tharsi-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// မြို့သာ နယ်မြေ(၅) နှင့် သာစည်ရွာကြား လယ်ကွင်းများနှင့် မိန်းလမ်းမကြီး (AH1) ကြားရှိ သစ်ပင်ကျဲကျဲများ
export const sparseFieldRoadLargeTrees: TreePlot[] = [
 [-14, 428],
 [-19, 476],
 [-13, 524],
 [-18, 568],
 [10, 446],
 [10, 536],
].map(([u, v], i) => ({
 id: `tharsi-sparse-large-${i}`,
 ...toWorld(u, v),
 radius: 1.1,
}));

export const sparseFieldRoadFarmTrees: TreePlot[] = [
 [-11, 452],
 [-16, 500],
 [-12, 548],
 [10, 492],
 [10, 578],
].map(([u, v], i) => ({
 id: `tharsi-sparse-farm-${i}`,
 ...toWorld(u, v),
 radius: 0.5,
}));

// သာစည်ရွာဘက် ရေမြောင်း (v = 658) နားမရောက်ခင် လယ်ကွင်းနားရှိ သစ်ပင်အုပ်အုပ် ထူထူလေး (Dense Grove)
export const preCanalGroveLargeTrees: TreePlot[] = [
 [-12, 598],
 [-19, 604],
 [-11, 612],
 [-18, 618],
 [-12, 626],
 [-20, 630],
 [-11, 637],
 [-19, 639],
 [-27, 637],
 [-35, 640],
 [-44, 638],
 [-53, 641],
 [-14, 647],
 [-23, 648],
 [-32, 647],
 [-41, 649],
 [-50, 648],
 [-60, 646],
].map(([u, v], i) => ({
 id: `tharsi-grove-large-${i}`,
 ...toWorld(u, v),
 radius: 1.1,
}));

export const preCanalGroveFarmTrees: TreePlot[] = [
 [-15, 601],
 [-14, 608],
 [-21, 614],
 [-15, 622],
 [-16, 633],
 [-16, 643],
 [-24, 643],
 [-31, 642],
 [-39, 644],
 [-47, 643],
 [-56, 644],
 [-65, 642],
 [-18, 650],
 [-28, 650],
 [-37, 650],
].map(([u, v], i) => ({
 id: `tharsi-grove-farm-${i}`,
 ...toWorld(u, v),
 radius: 0.5,
}));

// သာစည်ရွာအဝင်၊ ရပ်ကွက်လမ်းဆုံ၊ လယ်ကွင်း-လမ်းမကြား သစ်ပင်ကျဲကျဲနှင့် ရေမြောင်းမရောက်ခင် သစ်ပင်အုပ်ထူထူ
const largeTrees: TreePlot[] = [
 ...sparseFieldRoadLargeTrees,
 ...preCanalGroveLargeTrees,
 ...[677, 739, 802, 863, 925].flatMap((v, i) =>
  [-11, -118, -222, -328, 11, 60].map((u, j) => ({
   id: `tharsi-shade-${i}-${j}`,
   ...toWorld(u, v),
   radius: 1.1,
  }))
 ),
];

// အနောက်ဘက် ၆ ရပ်ကွက်အဆုံး၊ လယ်ကွင်း-လမ်းမကြား သစ်ပင်ကျဲကျဲနှင့် ရေမြောင်းမရောက်ခင် သစ်ပင်အုပ်ထူထူ
const farmTrees: TreePlot[] = [
 ...sparseFieldRoadFarmTrees,
 ...preCanalGroveFarmTrees,
 ...[685, 715, 745, 775, 805, 835, 865, 895, 918].map((v, i) => ({
  id: `tharsi-farm-tree-${i}`,
  ...toWorld(-332, v),
  radius: 0.5,
 })),
];

/**
 * သာစည်ရွာ (Thar Si Village · Kalay Township)
 * Google Maps: 23.1564594, 94.0452765
 * - မိန်းလမ်းမကြီး (AH1) အနောက်ဘက်ခြမ်းတွင် ဘေးချင်းယှဉ် ၂ ရပ်ကွက် × အနောက်ဘက် ၃ တန်း = ၆ ရပ်ကွက် (တစ်ရပ်ကွက် ၄၈ လုံး × ၆ = ၂၈၈ လုံး)
 * - ၎င်း ၆ ရပ်ကွက်၏ အနောက်ဘက်တွင် လယ်ကွင်းများနှင့် တောင်ဖီလာတောင်
 * - မိန်းလမ်းမကြီး (AH1) အရှေ့ဘက်ခြမ်းတွင် မိန်းလမ်းမကြီးနှင့် လယ်ကွင်းကြား အိမ်ခြေ ၂ တန်း (၃၂ လုံး)
 */
export const tharSiVillage: VillageMeta = {
 id: 'tharsi',
 name: 'သာစည်ရွာ',
 englishName: 'Thar Si Village',
 villageTract: 'သာစည်ကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'မိန်းလမ်းမကြီးအနောက်ဘက် ၆ ရပ်ကွက် (တစ်ရပ်ကွက် ၄၈ လုံး)၊ အရှေ့ဘက် လယ်ကွင်းနှင့်လမ်းမကြား အိမ်ခြေ ၂ တန်းပါဝင်သော သာစည်ရွာ',
 coordinates: { lat: 23.1564594, lng: 94.0452765 },
 ...toWorld(-160, 796),
 labelPos: toWorld(-164, 792),
 separationFields,
 connectingCanal,
 canal: tharSiCanal,
 houses,
 roads,
 fields,
 bundedFields,
 trees,
 largeTrees,
 farmTrees,
};
