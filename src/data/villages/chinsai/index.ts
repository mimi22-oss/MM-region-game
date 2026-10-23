import { angle, toWorld } from '../../wards/myothar/area5.ts';
import type { House, RoadPlot, FieldPlot, TreePlot, VillageMeta } from '../../types.ts';

/**
 * သာစည်ရွာနှင့် ချင်းဆိုင်ရွာကြား ခြားထားသော လယ်ကွင်း ၃ ကွက်
 * (AH1 အနောက်ဘက်ခြမ်း၊ v = 955 မှ 1035 အထိ ၃ ကွက်တန်းစီထားသည်)
 */
export const chinSaiSeparationFields: FieldPlot[] = [955, 995, 1035].map((v, i) => ({
 id: `tharsi-chinsai-sep-field-${i + 1}`,
 row: i,
 u: -82,
 v,
 ...toWorld(-82, v),
 width: 116,
 depth: 30,
 rotation: angle,
 color: ['#86a257', '#7e9c55', '#96a85d'][i % 3],
}));

// Google Maps ပုံအတိုင်း ချင်းဆိုင်ရွာ အနောက်ဘက်ခြမ်းရှိ အရှေ့-အနောက် လမ်းများ
export const chinSaiLanes = [1068, 1101, 1134, 1167, 1200];
// Google Maps ပုံအတိုင်း အရှေ့-အနောက်လမ်းများကို ဖြတ်သွားသော မြောက်-တောင် ရွာတွင်းလမ်း ၆ လမ်း
export const chinSaiCrossLanes = [-48, -92, -136, -180, -224, -268];

// မြောက်-တောင် လမ်းသွယ် ၆ လမ်းကြားရှိ အိမ်အကွက် (Block) များ၏ u တန်ဖိုးများ
const westBlockCols = [
 [-20, -34],       // Tier 0: AH1 နှင့် ပထမလမ်းသွယ် (-48) ကြား
 [-62, -78],       // Tier 1: -48 နှင့် -92 ကြား
 [-106, -122],     // Tier 2: -92 နှင့် -136 ကြား
 [-150, -166],     // Tier 3: -136 နှင့် -180 ကြား
 [-194, -210],     // Tier 4: -180 နှင့် -224 ကြား
 [-238, -254],     // Tier 5: -224 နှင့် -268 ကြား
 [-282, -298],     // Tier 6: -268 အနောက်ဘက်အစွန်
];

const houses: House[] = [];

// Google Maps ပုံပါ ချင်းဆိုင်ရွာ အနားသတ်ပုံစံအတိုင်း အနောက်မြောက်ဘက်တွင် ရွာဝန်းကျယ်ပြီး
// AH1 လမ်းမဘေး အရှေ့မြောက်ထောင့်တွင် မင်းကျောင်းကျောင်းတိုက်၊ အရှေ့တောင်ထောင့်တွင် ကမ္ဘာရန်ကင်းကျောင်းတိုက် ရှိသည်
for (let rowBlock = 0; rowBlock < chinSaiLanes.length - 1; rowBlock++) {
 const baseV = chinSaiLanes[rowBlock];
 for (const offsetV of [10, 22]) {
  const v = baseV + offsetV;
  for (let tierIdx = 0; tierIdx < westBlockCols.length; tierIdx++) {
   // Google Maps ပုံအတိုင်း အပေါ်ဆုံးအတန်း (rowBlock 0: v=1068..1101) သည် အနောက်ဘက်ပိုင်း (tierIdx >= 3) တွင်သာ ရှိသည်
   if (rowBlock === 0 && tierIdx < 3) continue;
   // ဒုတိယအတန်း (rowBlock 1: v=1101..1134) တွင် AH1 အနီး မင်းကျောင်းကျောင်းတိုက်နေရာ (tierIdx < 2) ကို ချန်ထားသည်
   if (rowBlock === 1 && tierIdx < 2) continue;
   // အောက်ဆုံးအတန်း (rowBlock 3: v=1167..1200) တွင် အနောက်ဘက်အစွန် (tierIdx === 6) ကို ချန်ထားသည်
   if (rowBlock === 3 && tierIdx === 6) continue;

   for (const u of westBlockCols[tierIdx]) {
    const i = houses.length;
    houses.push({
     id: `chinsai-h${i + 1}`,
     name: `ချင်းဆိုင်အိမ် ${i + 1}`,
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

// AH1 အရှေ့ဘက်ခြမ်း — မိန်းလမ်းမကြီး (u = 0) နှင့် အရှေ့ဘက် လယ်ကွင်းများကြားရှိ အိမ်ခြေ ၁ တန်း (u = 24)
for (let rowBlock = 0; rowBlock < chinSaiLanes.length - 1; rowBlock++) {
 const baseV = chinSaiLanes[rowBlock];
 for (const offsetV of [10, 22]) {
  const v = baseV + offsetV;
  const i = houses.length;
  houses.push({
   id: `chinsai-h${i + 1}`,
   name: `ချင်းဆိုင် အရှေ့ဘက်အိမ်တန်း · အိမ် ${i + 1}`,
   ...toWorld(24, v),
   width: 7.5,
   depth: 6.5,
   color: ['#d8c7a3', '#bfa58a', '#a9b9b0', '#c7b299'][i % 4],
   rotation: angle - Math.PI / 2,
   roof: ['#849699', '#8b5545', '#a39a85', '#7d6655'][i % 4],
  });
 }
}

// Google Maps ပုံပါ ချင်းဆိုင်ရွာရှိ ဘုန်းကြီးကျောင်းတိုက် ၂ ခု (မင်းကျောင်းကျောင်းတိုက် နှင့် ကမ္ဘာရန်ကင်းကျောင်းတိုက်)
export const chinSaiMonasteries = [
 {
  id: 'min-kyaung',
  name: 'မင်းကျောင်းကျောင်းတိုက်',
  u: -52,
  v: 1114,
  ...toWorld(-52, 1114),
  width: 56,
  depth: 24,
  rotation: angle,
 },
 {
  id: 'kambha-yan-kin',
  name: 'ကမ္ဘာရန်ကင်းကျောင်းတိုက်',
  u: -54,
  v: 1218,
  ...toWorld(-54, 1218),
  width: 58,
  depth: 24,
  rotation: angle,
 },
];

// ကျောင်းတိုက် ၂ ခုအတွင်းရှိ ကျောင်းဆောင်များကိုလည်း collision နှင့် 3D အဆောက်အအုံစာရင်းတွင် ထည့်သွင်းထားသည်
houses.push(
 {
  id: 'chinsai-min-kyaung-main',
  name: 'မင်းကျောင်းကျောင်းတိုက် · ကျောင်းဆောင်ကြီး',
  ...toWorld(-46, 1114),
  width: 16,
  depth: 11,
  color: '#e7d7b4',
  rotation: angle,
  roof: '#80564d',
 },
 {
  id: 'chinsai-min-kyaung-dhamma',
  name: 'မင်းကျောင်းကျောင်းတိုက် · ဓမ္မာရုံ',
  ...toWorld(-66, 1114),
  width: 13,
  depth: 10,
  color: '#d8cfb7',
  rotation: angle,
  roof: '#547b69',
 },
 {
  id: 'chinsai-kambha-main',
  name: 'ကမ္ဘာရန်ကင်းကျောင်းတိုက် · ကျောင်းဆောင်ကြီး',
  ...toWorld(-48, 1218),
  width: 16,
  depth: 11,
  color: '#e7d7b4',
  rotation: angle,
  roof: '#80564d',
 },
 {
  id: 'chinsai-kambha-dhamma',
  name: 'ကမ္ဘာရန်ကင်းကျောင်းတိုက် · ဓမ္မာရုံ',
  ...toWorld(-68, 1218),
  width: 13,
  depth: 10,
  color: '#d8cfb7',
  rotation: angle,
  roof: '#547b69',
 }
);

const roads: RoadPlot[] = [
 // Google Maps ပုံအတိုင်း AH1 မှ ရွာထဲသို့ တိုက်ရိုက်ဝင်သော အဓိက အရှေ့-အနောက် ရွာမလမ်း ၂ လမ်း (v = 1134, 1167)
 {
  id: 'chinsai-main-road-1',
  name: 'ချင်းဆိုင် ရွာမလမ်း (၁)',
  ...toWorld(-158, 1134),
  width: 304,
  depth: 6,
  rotation: angle,
  main: true,
 },
 {
  id: 'chinsai-main-road-2',
  name: 'ချင်းဆိုင် ရွာမလမ်း (၂)',
  ...toWorld(-158, 1167),
  width: 304,
  depth: 6,
  rotation: angle,
  main: true,
 },
 // အနောက်မြောက်ဘက် ရွာတွင်း အရှေ့-အနောက် လမ်းသွယ်များ (v = 1068, 1101) နှင့် တောင်ဘက်လမ်းသွယ် (v = 1200)
 {
  id: 'chinsai-ew-lane-north-1',
  name: 'ချင်းဆိုင် မြောက်ပိုင်းလမ်းသွယ် (၁)',
  ...toWorld(-218, 1068),
  width: 184,
  depth: 4,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ew-lane-north-2',
  name: 'ချင်းဆိုင် မြောက်ပိုင်းလမ်းသွယ် (၂)',
  ...toWorld(-196, 1101),
  width: 228,
  depth: 4.5,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ew-lane-south',
  name: 'ချင်းဆိုင် တောင်ပိုင်းလမ်းသွယ်',
  ...toWorld(-136, 1200),
  width: 260,
  depth: 4,
  rotation: angle,
  main: false,
 },
 // Google Maps ပုံအတိုင်း မြောက်-တောင် ရွာတွင်းလမ်းသွယ် ၆ လမ်း
 {
  id: 'chinsai-ns-lane-1',
  name: 'ချင်းဆိုင် အတွင်းလမ်း ၁',
  ...toWorld(-48, 1164),
  width: 4,
  depth: 76,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ns-lane-2',
  name: 'ချင်းဆိုင် အတွင်းလမ်း ၂',
  ...toWorld(-92, 1150),
  width: 4,
  depth: 104,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ns-lane-3',
  name: 'ချင်းဆိုင် အတွင်းလမ်း ၃',
  ...toWorld(-136, 1134),
  width: 4.5,
  depth: 136,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ns-lane-4',
  name: 'ချင်းဆိုင် အတွင်းလမ်း ၄',
  ...toWorld(-180, 1134),
  width: 4.5,
  depth: 136,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ns-lane-5',
  name: 'ချင်းဆိုင် အတွင်းလမ်း ၅',
  ...toWorld(-224, 1134),
  width: 4.5,
  depth: 136,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-ns-lane-6',
  name: 'ချင်းဆိုင် အတွင်းလမ်း ၆',
  ...toWorld(-268, 1118),
  width: 4,
  depth: 104,
  rotation: angle,
  main: false,
 },
 // AH1 အရှေ့ဘက် အိမ်ခြေ ၁ တန်းအတွက် အရှေ့-အနောက် လမ်းသွယ်များနှင့် အိမ်တန်း-လယ်ကွင်းကြား လမ်းသွယ်
 ...chinSaiLanes.map((v, i) => ({
  id: `chinsai-east-ew-lane-${i + 1}`,
  name: `ချင်းဆိုင် အရှေ့လမ်းသွယ် ${i + 1}`,
  ...toWorld(22, v),
  width: 32,
  depth: 4,
  rotation: angle,
  main: false,
 })),
 {
  id: 'chinsai-east-ns-lane',
  name: 'ချင်းဆိုင် အရှေ့အိမ်တန်းလမ်း',
  ...toWorld(38, 1134),
  width: 4,
  depth: 136,
  rotation: angle,
  main: false,
 },
 // Google Maps ပုံအတိုင်း AH1 အရှေ့ဘက် လယ်ကွင်းများထဲသို့ ခွဲထွက်သွားသော လယ်ကွင်းလမ်း ၂ လမ်း
 {
  id: 'chinsai-east-field-track-1',
  name: 'ချင်းဆိုင် အရှေ့လယ်ကွင်းလမ်း (၁)',
  ...toWorld(78, 1068),
  width: 84,
  depth: 3.5,
  rotation: angle,
  main: false,
 },
 {
  id: 'chinsai-east-field-track-2',
  name: 'ချင်းဆိုင် အရှေ့လယ်ကွင်းလမ်း (၂)',
  ...toWorld(68, 1236),
  width: 124,
  depth: 3.5,
  rotation: angle,
  main: false,
 },
];

// ချင်းဆိုင်ရွာ အနောက်ဘက်နှင့် တောင်ဘက်ပတ်လည်ရှိ ကန်သင်းရိုးပါ စပါးစိုက်ခင်းများ
const bundedFields: FieldPlot[] = [
 ...[1075, 1115, 1155, 1195].flatMap((v, row) =>
  [-342, -386, -430].map((u, col) => ({
   id: `chinsai-west-paddy-${row}-${col}`,
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

// AH1 အရှေ့ဘက် အိမ်ခြေ ၁ တန်း (u = 24) ၏ နောက်ရှိ လယ်ကွင်းများ
const fields: FieldPlot[] = [955, 995, 1035, 1085, 1120, 1155, 1190].flatMap((v, row) =>
 [68, 116, 164, 212].map((u, col) => ({
  id: `chinsai-east-field-${row}-${col}`,
  u,
  v,
  ...toWorld(u, v),
  width: 42,
  depth: 28,
  rotation: angle,
  color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
 }))
);

// AH1 လမ်းမဘေး ချင်းဆိုင်ရွာရှေ့ အရိပ်ရ သစ်ပင်တန်း
const trees: TreePlot[] = [-12, 12].flatMap((u, sideIdx) =>
 [1076, 1094, 1118, 1148, 1182, 1210, 1226].map((v, i) => ({
  id: `chinsai-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// သာစည်-ချင်းဆိုင်ကြား လယ် ၃ ကွက်ဘေး သစ်ပင်ကျဲကျဲနှင့် ချင်းဆိုင်ရွာအတွင်း သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 ...[
  [-14, 952],
  [-18, 995],
  [-13, 1038],
  [11, 972],
  [11, 1022],
 ].map(([u, v], i) => ({
  id: `chinsai-sep-large-${i}`,
  ...toWorld(u, v),
  radius: 1.1,
 })),
 ...[
  [-28, 1106],
  [-82, 1114],
  [-30, 1218],
  [-84, 1218],
  [-96, 1096],
  [-140, 1096],
  [-184, 1096],
  [-228, 1096],
  [-96, 1162],
  [-184, 1162],
  [-272, 1162],
 ].map(([u, v], i) => ({
  id: `chinsai-shade-${i}`,
  ...toWorld(u, v),
  radius: 1.1,
 })),
];

// ချင်းဆိုင်ရွာ အနောက်ဘက် လယ်ကွင်းစပ် သစ်ပင်များ
const farmTrees: TreePlot[] = [
 [-15, 974],
 [-15, 1016],
 [-314, 1078],
 [-314, 1112],
 [-314, 1148],
 [-280, 1185],
 [-210, 1212],
 [-140, 1212],
].map(([u, v], i) => ({
 id: `chinsai-farm-tree-${i}`,
 ...toWorld(u, v),
 radius: 0.5,
}));

/**
 * ချင်းဆိုင်ရွာ (Chin Sai Village · Kalay Township)
 * Google Maps: 23.1468474, 94.043361
 * သာစည်ရွာနှင့် ဝေပုလ္လတောင်ကြီးကြား၊ သာစည်ရွာမှ လယ်ကွင်း ၃ ကွက်အခြားတွင် တည်ရှိသည်။
 */
export const chinSaiVillage: VillageMeta = {
 id: 'chinsai',
 name: 'ချင်းဆိုင်ရွာ',
 englishName: 'Chin Sai Village',
 villageTract: 'ချင်းဆိုင်ကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'သာစည်ရွာနှင့် ဝေပုလ္လတောင်ကြီးကြား လယ်ကွင်း ၃ ကွက်အခြား၊ AH1 အနောက်ဘက်ခြမ်းတွင် မင်းကျောင်းကျောင်းတိုက်နှင့် ကမ္ဘာရန်ကင်းကျောင်းတိုက်တို့ ပါဝင်သော ချင်းဆိုင်ရွာ',
 coordinates: { lat: 23.1468474, lng: 94.043361 },
 ...toWorld(-158, 1134),
 labelPos: toWorld(-165, 1126),
 separationFields: chinSaiSeparationFields,
 houses,
 roads,
 fields,
 bundedFields,
 trees,
 largeTrees,
 farmTrees,
};
