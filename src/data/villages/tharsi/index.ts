import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, WindingCanalPlot, EastWestCanalPlot, VillageMeta } from '../../types.ts';

/**
 * မြို့သာရပ်ကွက် · နယ်မြေ (၅) နှင့် သာစည်ရွာကြား ခြားထားသော လယ်ကွင်း ၆ ကွက်
 * (AH1 အနောက်ဘက်ခြမ်း၊ v = 430 မှ 630 အထိ ၆ ကွက်တန်းစီထားသည်)
 */
export const separationFields: FieldPlot[] = [430, 470, 510, 550, 590, 630].map((v, i) => ({
 id: `myothar-tharsi-sep-field-${i + 1}`,
 row: i,
 u: -78,
 v,
 ...toWorld(-78, v),
 width: 120,
 depth: 34,
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

export const tharSiLanes = [674, 710, 746, 782, 818];
export const tharSiCrossLanes = [-60, -126, -198];

const houses: House[] = [];

// အနောက်ဘက် ရွာတွင်း အိမ်တန်းများ (ရေမြောင်း၏ တောင်ဘက်၊ လမ်းသွယ် ၅ လမ်းကြား အကွက် ၄ ကွက်၊ တစ်ကွက်လျှင် ၂ တန်းစီ)
for (let block = 0; block < tharSiLanes.length - 1; block++) {
 const baseV = tharSiLanes[block];
 for (const offsetV of [11, 25]) {
  const v = baseV + offsetV;
  for (const u of [-26, -44, -80, -104, -152, -176]) {
   const i = houses.length;
   houses.push({
    id: `tharsi-h${i + 1}`,
    name: `သာစည်ရွာအိမ် ${i + 1}`,
    ...toWorld(u, v),
    width: 8.5,
    depth: 7,
    color: ['#d8c7a3', '#bd9973', '#a9b9b0', '#c7b299'][i % 4],
    rotation: angle,
    roof: ['#8b5545', '#849699', '#a39a85', '#7d6655'][i % 4],
   });
  }
 }
}

// AH1 အရှေ့ဘက် (အရှေ့-အနောက် ရေမြောင်း၏ တောင်ဘက်နှင့် ဝေပုလ္လတောင်ကြား) သာစည် အရှေ့ပိုင်း အိမ်တန်း
for (const u of [28, 52, 76, 100, 124, 148]) {
 const i = houses.length;
 houses.push({
  id: `tharsi-h${i + 1}`,
  name: `သာစည် အရှေ့ပိုင်းအိမ် ${i + 1}`,
  ...toWorld(u, 702),
  width: 9,
  depth: 8,
  color: i % 2 ? '#d8c7a3' : '#bfa58a',
  rotation: angle - Math.PI / 2,
  roof: i % 2 ? '#849699' : '#8b5545',
 });
}

const roads: RoadPlot[] = [
 // သာစည် ရွာမလမ်းမကြီး (AH1 မှ အနောက်ဘက်သို့ ရွာလယ်ဗဟိုလမ်းမ)
 {
  id: 'tharsi-main-road',
  name: 'သာစည် ရွာမလမ်းမကြီး',
  ...toWorld(-111, 746),
  width: 210,
  depth: 7.5,
  rotation: angle,
  main: true,
 },
 // အရှေ့-အနောက် ရွာတွင်း လမ်းသွယ်များ
 ...[674, 710, 782, 818].map((v, i) => ({
  id: `tharsi-ew-lane-${i + 1}`,
  name: `သာစည် လမ်းသွယ် ${i + 1}`,
  ...toWorld(-111, v),
  width: 210,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 // မြောက်-တောင် ရွာတွင်း ဖြတ်လမ်းများ
 ...tharSiCrossLanes.map((u, i) => ({
  id: `tharsi-ns-lane-${i + 1}`,
  name: `သာစည် အတွင်းလမ်း ${i + 1}`,
  ...toWorld(u, 746),
  width: 4,
  depth: 148,
  rotation: angle,
  main: false,
 })),
 // AH1 အရှေ့ဘက် သာစည် အရှေ့ပိုင်း လမ်းသွယ်
 {
  id: 'tharsi-east-lane',
  name: 'သာစည် အရှေ့ပိုင်းလမ်းသွယ်',
  ...toWorld(86, 684),
  width: 160,
  depth: 4.5,
  rotation: angle,
  main: false,
 },
];

// သာစည်ရွာ အနောက်ဘက် လယ်ကွက်များ (ကန်သင်းရိုးပါ စပါးစိုက်ခင်း ၁၆ ကွက်)
const bundedFields: FieldPlot[] = [682, 722, 762, 802].flatMap((v, row) =>
 [-242, -286, -330, -374].map((u, col) => ({
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

// သာစည်ရွာ အရှေ့ဘက် ယာခင်း/စိုက်ခင်းများ
const fields: FieldPlot[] = [685, 725, 765, 805].flatMap((v, row) =>
 [196, 246].map((u, col) => ({
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

// AH1 လမ်းမဘေး သာစည်ရွာရှေ့ အရိပ်ရ သစ်ပင်တန်း (ရေမြောင်းနှင့် လမ်းသွယ်ဝင်ပေါက်များကို ချန်လှပ်ထားသည်)
const trees: TreePlot[] = [
 666, 685, 699, 721, 735, 758, 771, 793, 807, 828,
].map((v, i) => ({
 id: `tharsi-canopy-${i}`,
 ...toWorld(-14, v),
 radius: 0.55,
}));

// သာစည်ရွာအဝင်၊ ရေမြောင်းဘေးနှင့် လမ်းဆုံ သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 ...[679, 715, 752, 787, 823].flatMap((v, i) =>
  [-12, -206].map((u, j) => ({
   id: `tharsi-shade-${i}-${j}`,
   ...toWorld(u, v),
   radius: 1.1,
  }))
 ),
 { id: 'tharsi-east-shade-1', ...toWorld(16, 690), radius: 1.1 },
 { id: 'tharsi-east-shade-2', ...toWorld(162, 690), radius: 1.1 },
];

// လယ်ကွင်းစပ်နှင့် ရွာပတ်လည် သစ်ပင်များ
const farmTrees: TreePlot[] = [
 680, 704, 728, 752, 776, 800, 822,
].map((v, i) => ({
 id: `tharsi-farm-tree-${i}`,
 ...toWorld(-216, v),
 radius: 0.5,
}));

/**
 * သာစည်ရွာ (Thar Si Village · Kalay Township)
 * Google Maps: 23.1564594, 94.0452765
 * တည်နေရာ - မြို့သာရပ်ကွက် နယ်မြေ (၅) မှ လယ်ကွင်း ၆ ကွက်နှင့် အရှေ့-အနောက် ရေမြောင်းခြားပြီး ဝေပုလ္လတောင်ကြီး၏ မြောက်ဘက်တွင် တည်ရှိသည်။
 */
export const tharSiVillage: VillageMeta = {
 id: 'tharsi',
 name: 'သာစည်ရွာ',
 englishName: 'Thar Si Village',
 villageTract: 'သာစည်ကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'မြို့သာရပ်ကွက် နယ်မြေ (၅) နှင့် ဝေပုလ္လတောင်ကြီးကြား၊ လယ်ကွင်း ၆ ကွက်နှင့် အရှေ့-အနောက် ရေမြောင်းတောင်ဘက်ရှိ သာစည်ရွာ',
 coordinates: { lat: 23.1564594, lng: 94.0452765 },
 ...toWorld(-105, 746),
 labelPos: toWorld(-110, 742),
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
