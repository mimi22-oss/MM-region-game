import { angle, toWorld } from '../../wards/myothar/area5.ts';
export { angle, toWorld };

// စာသင်ကျောင်းသည် မိန်းလမ်းမကြီး (AH1) ဘက်သို့ မျက်နှာမူလှည့်ထားသည်
export const schoolRot = angle + Math.PI / 2;
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
 * Google Maps ပုံ (Htauk Kyant lake.png) ပါ ထောက်ကြန့်ကျေးရွာ အရှေ့မြောက်ဘက် လယ်ကွင်းစပ်ရှိ
 * ရေကန်ကြီး (Large Lake) နှင့် အောက်ဘက်သို့ တန်းစီတည်ရှိသော ရေကန် ၅ ကန်
 */
export const htaukKyantLake: PondPlot = {
 id: 'htaukkyant-large-lake',
 name: 'ထောက်ကြန့် ရေကန်ကြီး',
 u: 230,
 v: 3135,
 ...toWorld(230, 3135),
 width: 85,
 depth: 52,
 rotation: angle,
 color: '#3c7980',
};

export const htaukKyantPonds: PondPlot[] = [
 { id: 'htaukkyant-pond-1', name: 'ထောက်ကြန့် ရေကန် (၁)', u: 220, v: 3192, ...toWorld(220, 3192), width: 50, depth: 16, rotation: angle, color: '#3d838b' },
 { id: 'htaukkyant-pond-2', name: 'ထောက်ကြန့် ရေကန် (၂)', u: 220, v: 3220, ...toWorld(220, 3220), width: 50, depth: 16, rotation: angle, color: '#397d85' },
 { id: 'htaukkyant-pond-3', name: 'ထောက်ကြန့် ရေကန် (၃)', u: 220, v: 3248, ...toWorld(220, 3248), width: 50, depth: 16, rotation: angle, color: '#3f878f' },
 { id: 'htaukkyant-pond-4', name: 'ထောက်ကြန့် ရေကန် (၄)', u: 220, v: 3282, ...toWorld(220, 3282), width: 54, depth: 22, rotation: angle, color: '#36777f' },
 { id: 'htaukkyant-pond-5', name: 'ထောက်ကြန့် ရေကန် (၅)', u: 220, v: 3318, ...toWorld(220, 3318), width: 54, depth: 22, rotation: angle, color: '#3b8088' },
];

export const allHtaukKyantPonds: PondPlot[] = [htaukKyantLake, ...htaukKyantPonds];

/**
 * ဘောလုံးကွင်းနှင့် ထောက်ကြန့် စေတီတော်မြတ်ကြီးကြားရှိ လယ်ကွင်းအသေးလေး
 * (မိန်းလမ်းမကြီးဘက်မှ ကြည့်လျှင်: မိန်းလမ်း -> ဘောလုံးကွင်း -> လယ်ကွင်းအသေးလေး -> စေတီတော်မြတ်ကြီး)
 */
export const htaukKyantIntermediateField: FieldPlot = {
 id: 'htaukkyant-field-between-pitch-and-pagoda',
 u: 74,
 v: 3280,
 ...toWorld(74, 3280),
 width: 14,
 depth: 68,
 rotation: angle,
 color: '#7fa657',
};

// ထောက်ကြန့်ကျေးရွာ အရှေ့-အနောက် လမ်းသွယ်များ (v = 3080 မှ 3520 အထိ)
export const htaukKyantLanes = [3080, 3115, 3150, 3185, 3220, 3255, 3290, 3325, 3360, 3395, 3430, 3465, 3500];
// ရွာတွင်း မြောက်-တောင် လမ်းသွယ်များ
export const htaukKyantCrossLanes = [-162, -126, 142, 166];

// AH1 ဘေး အိမ်အကွက်များ (ဂြိုဟ်တုဓာတ်ပုံအတိုင်း အနောက်မြောက်နှင့် အရှေ့တောင်ဘက်သို့ အိမ်တန်းများ တိုးချဲ့ထားသည်)
const westBlockCols = [
 [-22, -32],
 [-52, -64],
 [-94, -106],
 [-136, -148],
 [-166, -178],
];

const eastBlockCols = [
 [22, 32],
 [52, 64],
 [94, 106],
 [136, 148],
 [166, 178],
];

const houses: House[] = [];

/**
 * ထောက်ကြန့်ကျေးရွာ၏ အထင်ကရ အဆောက်အအုံများ:
 * - Htauk Kyant Football Playground (မိန်းလမ်းမကြီးဘေး: u = 44, v = 3280)
 * - လယ်ကွင်းအသေးလေး (ဘောလုံးကွင်းနှင့် စေတီကြား: u = 74, v = 3280)
 * - Htauk Kyant Pagoda (လယ်ကွင်းလေး၏ အရှေ့ဘက်: u = 110, v = 3280)
 * - Htauk Kyant Monastery (ဘုရား၏ မြောက်ဘက်: u = 110, v = 3205)
 * - Basic Education High School - BEHS (Htauk Kyant basic education high school detail.png အတိုင်း ကျောင်းဆောင် ၇ ဆောင်)
 */
export type HtaukKyantLandmarkBuilding = House & {
 kind:
  | 'pagoda'
  | 'stupa'
  | 'monastery'
  | 'school-main'
  | 'school-wing'
  | 'school-hall'
  | 'school-annex'
  | 'school-lab'
  | 'pavilion';
 height: number;
};

export const htaukKyantLandmarkBuildings: HtaukKyantLandmarkBuilding[] = [
 // ဘုရားမြောက်ဘက် ကျောင်းတိုက်
 {
  id: 'hk-landmark-monastery',
  name: 'ထောက်ကြန့် ကျောင်းတိုက်',
  kind: 'monastery',
  height: 8.5,
  ...toWorld(110, 3205),
  width: 26,
  depth: 18,
  color: '#c9b897',
  rotation: angle,
  roof: '#8f4f3b',
 },
 // ဘုရားဝင်း ပင်မ အဆောက်အဦး (ဓမ္မာရုံ / တန်ဆောင်း)
 {
  id: 'hk-landmark-pagoda-pavilion',
  name: 'ထောက်ကြန့်စေတီ ဓမ္မာရုံ / တန်ဆောင်း',
  kind: 'pavilion',
  height: 6.5,
  ...toWorld(96, 3280),
  width: 16,
  depth: 24,
  color: '#f4eedf',
  rotation: angle,
  roof: '#b35d46',
 },
 // ၁။ အဆောက်အဦး အရှေ့ဘက်ရှိ Pagoda စေတီတော်မြတ်ကြီး
 {
  id: 'hk-landmark-pagoda-base',
  name: 'ထောက်ကြန့် အရှေ့ဘက် စေတီတော်မြတ်ကြီး',
  kind: 'pagoda',
  height: 4,
  ...toWorld(122, 3280),
  width: 12,
  depth: 12,
  color: '#ebe3cd',
  rotation: angle,
  roof: '#e5ba3c',
 },
 // ၂။ အဆောက်အဦး အရှေ့မြောက်ဘက်ရှိ Pagoda စေတီတော်မြတ်
 {
  id: 'hk-landmark-pagoda-sw',
  name: 'ထောက်ကြန့် အရှေ့မြောက်ဘက် စေတီတော်မြတ်',
  kind: 'pagoda',
  height: 3.8,
  ...toWorld(122, 3256),
  width: 10,
  depth: 10,
  color: '#ebe3cd',
  rotation: angle,
  roof: '#e5ba3c',
 },
 // -------------------------------------------------------------------------
 // အထက ထောက်ကြန့် ကျောင်းဝင်း အဆောက်အအုံများ (detail.png အတိုင်း တည်ဆောက်ထားသည်)
 // -------------------------------------------------------------------------
 // ၁။ ပင်မ ၂ ထပ် အထက်တန်းဆောင်ကြီး (အနောက်ဘက်၊ မိန်းလမ်းမကြီးဘက် မျက်နှာမူ)
	{
		id: 'hk-landmark-school-main',
		name: 'အထက ထောက်ကြန့် ပင်မကျောင်းဆောင်ကြီး',
		kind: 'school-main',
		height: 8.5,
		...toWorld(-106, 3280),
		width: 44,
		depth: 13,
		color: '#e2dbcc',
		rotation: schoolRot,
		roof: '#9e4536',
	},
	// ၂။ မြောက်ဘက် စာသင်ဆောင် (U-shape ၏ မြောက်တောင်ပံ၊ မိန်းလမ်းဆီသို့ တန်းလျက်)
	{
		id: 'hk-school-west-wing',
		name: 'အထက ထောက်ကြန့် မြောက်ဘက် စာသင်ဆောင်',
		kind: 'school-wing',
		height: 6.5,
		...toWorld(-78, 3253),
		width: 10,
		depth: 36,
		color: '#ded8c8',
		rotation: schoolRot,
		roof: '#9a4838',
	},
	// ၃။ တောင်ဘက် စာသင်ဆောင် (U-shape ၏ တောင်တောင်ပံ၊ မိန်းလမ်းဆီသို့ တန်းလျက်)
	{
		id: 'hk-school-east-wing',
		name: 'အထက ထောက်ကြန့် တောင်ဘက် စာသင်ဆောင်',
		kind: 'school-wing',
		height: 6.5,
		...toWorld(-78, 3307),
		width: 10,
		depth: 36,
		color: '#ded8c8',
		rotation: schoolRot,
		roof: '#9c4939',
	},
	// ၄။ တောင်ဘက် စာသင်ဆောင်ရှည်ကြီး (သွပ်ပြာရောင် သတ္တုအမိုး)
	{
		id: 'hk-landmark-school-wing',
		name: 'အထက ထောက်ကြန့် စာသင်ဆောင်ရှည်',
		kind: 'school-hall',
		height: 6.5,
		...toWorld(-78, 3326),
		width: 10,
		depth: 38,
		color: '#e5dfd2',
		rotation: schoolRot,
		roof: '#7fa2b0',
	},
	// ၅။ အရှေ့ဘက် ခြံစည်းရိုးကပ် စာသင်ဆောင်/အဆောင်
	{
		id: 'hk-school-east-annex',
		name: 'အထက ထောက်ကြန့် အရှေ့ဘက် အဆောင်',
		kind: 'school-annex',
		height: 5.5,
		...toWorld(-40, 3318),
		width: 8,
		depth: 26,
		color: '#ded8c8',
		rotation: schoolRot,
		roof: '#9a4838',
	},
	// ၆။ အနောက်မြောက်ဘက် သိပ္ပံလက်တွေ့ခန်းဆောင်
	{
		id: 'hk-school-lab-building',
		name: 'အထက ထောက်ကြန့် သိပ္ပံလက်တွေ့ဆောင်',
		kind: 'school-lab',
		height: 5.5,
		...toWorld(-108, 3244),
		width: 11,
		depth: 9,
		color: '#ded8c8',
		rotation: schoolRot,
		roof: '#96a2aa',
	},
	// ၇။ စာသင်ဆောင်များကြား ရင်ပြင်ရှိ နားနေဆောင်ငယ်
	{
		id: 'hk-school-courtyard-pavilion',
		name: 'အထက ထောက်ကြန့် နားနေဆောင်',
		kind: 'pavilion',
		height: 4,
		...toWorld(-78, 3280),
		width: 6,
		depth: 6,
		color: '#ded8c8',
		rotation: schoolRot,
		roof: '#2d5c80',
	},
];

/** မြေပုံနှင့် 3D တွင် စေတီရင်ပြင်၊ ဘောလုံးကွင်း၊ ကျောင်းဝင်းများနှင့် ကျောင်းကွင်းပြင် */
export const htaukKyantLandmarks = [
 {
  id: 'hk-football-playground',
  name: 'Htauk Kyant Football Playground',
  ...toWorld(44, 3282),
  width: 46,
  depth: 68,
  rotation: angle,
 },
 {
  id: 'hk-pagoda-compound',
  name: 'Htauk Kyant Pagoda',
  ...toWorld(108, 3280),
  width: 54,
  depth: 60,
  rotation: angle,
 },
 {
		id: 'hk-school-yard',
		name: 'Basic Education High School',
		...toWorld(-72, 3280),
		width: 106,
		depth: 90,
		rotation: schoolRot,
	},
	{
		id: 'hk-school-assembly-ground',
		name: 'အထက ကျောင်းကွင်းပြင်',
		...toWorld(-42, 3270),
		width: 38,
		depth: 28,
		rotation: schoolRot,
	},
	{
		id: 'hk-school-garden',
		name: 'အထက စိုက်ခင်းကွက်',
		...toWorld(-42, 3298),
		width: 12,
		depth: 20,
		rotation: schoolRot,
	},
];

// လူနေအိမ်ခြေများ ထည့်သွင်းခြင်း (ဘုရား၊ ဘောလုံးကွင်း၊ ကျောင်းနေရာများကို ချန်လှပ်သည်)
for (let rowBlock = 0; rowBlock < htaukKyantLanes.length - 1; rowBlock++) {
 const baseV = htaukKyantLanes[rowBlock];
 for (const offsetV of [11, 23]) {
  const v = baseV + offsetV;

  // အနောက်ဘက်ခြမ်း အိမ်များ
  for (let colBlock = 0; colBlock < westBlockCols.length; colBlock++) {
   // အထက ထောက်ကြန့် ကျောင်းဝင်း နေရာ
   if (v >= 3230 && v <= 3345 && colBlock <= 2) continue;
   // ရွာမ အနောက်တောင်လမ်း လမ်းကြောင်းနေရာ
   if (v >= 3400 && v <= 3445 && colBlock === 2) continue;
   // ရွာအစွန် ကွေးဝိုက်ချက်များ (ဂြိုဟ်တုပုံစံအတိုင်း အနောက်မြောက်ဘက်ကို တိုးချဲ့ခွင့်ပြုသည်)
   if (rowBlock === 0 && colBlock >= 3) continue;
   if (rowBlock >= 11 && colBlock >= 3) continue;

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
   // မိန်းလမ်းမကြီးနှင့် Pagoda ကြားရှိ ဘောလုံးကွင်း နေရာ (u = 22..68, v = 3248..3320)
   if (v >= 3248 && v <= 3320 && colBlock <= 1) continue;
   // စေတီဝင်းနှင့် အဆောက်အဦး နေရာ (u = 86..134, v = 3250..3320)
   // စေတီမြောက်ဘက်တွင် ၂ အိမ်တန်း (v = 3231 နှင့် v = 3243) အပြည့်တည်ဆောက်သည်
   if (v >= 3250 && v <= 3320 && colBlock === 2) continue;
   // စေတီတော်မြောက်ဘက် ကျောင်းတိုက် နေရာ (ကျောင်းတိုက်တည်နေရာ တကွက်သာ ချန်လှပ်သည်)
   if (v >= 3192 && v <= 3218 && colBlock === 2) continue;
   // ရွာမ အရှေ့ဘက်ဝင်လမ်း လမ်းမကြီး လမ်းကြောင်းနေရာ
   if (v >= 3192 && v <= 3200 && colBlock <= 3) continue;
   // ရွာအစွန်ပိုင်းများ (အရှေ့မြောက်နှင့် အရှေ့တောင် အိမ်တန်းများ တိုးချဲ့ခွင့်ပြုသည်)
   if (rowBlock === 0 && colBlock >= 3) continue;
   if (rowBlock >= 11 && colBlock >= 4) continue;

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
 [-210, -255, -300, -345, -390].map((u, col) => ({
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

// ရွာအရှေ့ဘက် လယ်ကွင်းများ (ဘောလုံးကွင်းနှင့် စေတီကြား လယ်ကွင်းလေး + အရှေ့ဘက် လယ်ကွင်းများ)
const fields: FieldPlot[] = [
 htaukKyantIntermediateField,
 ...[3120, 3180, 3240, 3300, 3360, 3420, 3480].flatMap((v, row) => {
  const cols = v <= 3330 ? [280, 325, 370] : [205, 250, 295];
  return cols.map((u, col) => ({
   id: `htaukkyant-east-field-${row}-${col}`,
   u,
   v,
   ...toWorld(u, v),
   width: 42,
   depth: 54,
   rotation: angle,
   color: (row + col) % 2 ? '#8ca65c' : '#a6af68',
  }));
 }),
];

// AH1 လမ်းဘေး သစ်ပင်တန်း
const trees: TreePlot[] = [-12, 12].flatMap((u, sideIdx) =>
 [3090, 3120, 3150, 3180, 3210, 3240, 3270, 3300, 3330, 3360, 3390, 3420, 3450, 3480, 3510].map((v, i) => ({
  id: `htaukkyant-canopy-${sideIdx}-${i}`,
  ...toWorld(u, v),
  radius: 0.55,
 }))
);

// အရှေ့မြောက် ရေကန်ကြီးဘေး၊ ဘောလုံးကွင်းဘေး၊ ဘုရားဝင်းနှင့် ကျောင်းဝင်းပတ်လည် သစ်ပင်ကြီးများ
const largeTrees: TreePlot[] = [
 // အရှေ့မြောက် ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် ပတ်လည်
 [280, 3135],
 [230, 3105],
 [180, 3135],
 [188, 3192],
 [188, 3230],
 [188, 3280],
 [188, 3320],
 [255, 3220],
 [255, 3290],
 // ကျောင်းဝင်း အတွင်းနှင့် ပတ်လည် သစ်ပင်ကြီးများ (မိန်းလမ်းမကြီးဘက် မျက်နှာမူထားသော ကျောင်းဝင်းဘေး)
	[-28, 3244],
	[-24, 3336],
	[-40, 3338],
	[-116, 3228],
	[-118, 3280],
	[-116, 3336],
	[-82, 3236],
	[-78, 3270],
	[-78, 3290],
	[-88, 3340],
 // မိန်းလမ်းမကြီးနှင့် ဘောလုံးကွင်းကြား သစ်ပင်တန်း
 [14, 3246],
 [18, 3318],
 // ဘောလုံးကွင်းနှင့် လယ်ကွင်းလေးကြား သစ်ပင်တန်း
 [68, 3248],
 [66, 3318],
 // လယ်ကွင်းလေးနှင့် ဘုရားကြား သစ်ပင်တန်း
 [82, 3248],
 [82, 3318],
 // ဘုရားဝင်းနှင့် ကျောင်းတိုက်
 [86, 3205],
 [134, 3205],
 [82, 3280],
 [138, 3280],
 [138, 3252],
 [110, 3310],
].map(([u, v], i) => ({
 id: `htaukkyant-shade-${i}`,
 ...toWorld(u, v),
 radius: 1.15,
}));

// ရွာအစွန်နှင့် လယ်ကွင်းစပ် သစ်ပင်များ
const farmTrees: TreePlot[] = [3090, 3150, 3210, 3270, 3330, 3390, 3450, 3510].flatMap((v, i) => [
 { id: `htaukkyant-west-farm-tree-${i}`, ...toWorld(-210, v), radius: 0.5 },
 { id: `htaukkyant-east-farm-tree-${i}`, ...toWorld(185, v), radius: 0.5 },
]);

/**
 * ထောက်ကြန့်ကျေးရွာ (Htauk Kyant Village · Kalay Township)
 * Google Maps: 23.0818187, 94.0176266
 * သာယာကုန်းကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြားတွင် တည်ရှိသည်။
 * မိန်းလမ်းကြီး -> ဘောလုံးကွင်း -> လယ်ကွင်းအသေးလေး -> Htauk Kyant Pagoda၊
 * မျက်နှာချင်းဆိုင် အနောက်ဘက်တွင် Basic Education High School (အထက ထောက်ကြန့်)၊
 * အရှေ့မြောက်ဘက် လယ်ကွင်းစပ်တွင် ရေကန်ကြီးနှင့် တန်းစီရေကန် ၅ ကန် ရှိသည်။
 */
export const htaukKyantVillage: VillageMeta = {
 id: 'htaukkyant',
 name: 'ထောက်ကြန့်ကျေးရွာ',
 englishName: 'Htauk Kyant Village',
 villageTract: 'ထောက်ကြန့်ကျေးရွာအုပ်စု · ကလေးမြို့နယ်',
 description: 'သာယာကုန်းကျေးရွာနှင့် ဝေပုလ္လတောင်ကြီးကြား၊ မိန်းလမ်းကြီး -> ဘောလုံးကွင်း -> လယ်ကွင်းလေး -> စေတီ၊ မျက်နှာချင်းဆိုင် အထကကျောင်း၊ အရှေ့မြောက် လယ်ကွင်းစပ် ရေကန်ကြီးနှင့် ရေကန် ၅ ကန် ပါဝင်သော ထောက်ကြန့်ကျေးရွာ',
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
