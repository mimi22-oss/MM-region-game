import type { VillageMeta, TreePlot, FieldPlot, PondPlot } from '../../types.ts';
import { natmyaungMeta, toWorld } from './natmyaungData.ts';
import { natmyaungBuildings, natmyaungHouses, type NatmyaungBuildingData } from './natmyaungBuildings.ts';
import { natmyaungRoads, natmyaungRoadPlots, type NatmyaungRoadData } from './natmyaungRoads.ts';
import {
  natmyaungBoundaryWorldPoints,
  natmyaungBoundaryUVPoints,
  natmyaungBoundaryGeoPoints,
  natmyaungBoundarySvgPath,
  natmyaungBoundaryBounds,
  isPointInsideNatmyaung,
} from './natmyaungBoundary.ts';

export * from './natmyaungData.ts';
export * from './natmyaungBoundary.ts';
export * from './natmyaungBuildings.ts';
export * from './natmyaungRoads.ts';

/** နတ်မြောင်းရွာ ခြံဝင်း သစ်ပင်များ */
const trees: TreePlot[] = natmyaungBuildings.slice(0, 30).map((b, i) => ({
  id: `natmyaung-tree-${i + 1}`,
  x: b.x + (i % 2 === 0 ? b.width / 2 + 1.8 : -b.width / 2 - 1.8),
  z: b.z + (i % 3 === 0 ? b.depth / 2 + 1.8 : -b.depth / 2 - 1.8),
  radius: 0.6,
}));

/** နတ်မြောင်းရွာ လမ်းဘေး အရိပ်ရ သစ်ပင်ကြီးများ */
const largeTrees: TreePlot[] = [
  // AH1 လမ်းဘေး သစ်ပင်ကြီးများ (လမ်းသွယ်များနှင့် ကင်းလွတ်သော နေရာများ)
  ...[4151, 4173, 4195, 4217, 4239, 4261, 4283, 4305].flatMap((v, i) => [
    { id: `natmyaung-ah1-tree-w-${i}`, ...toWorld(-8.0, v), radius: 1.1 },
    { id: `natmyaung-ah1-tree-e-${i}`, ...toWorld(8.0, v), radius: 1.1 },
  ]),
  // ရွာလယ် ဘုန်းတော်ကြီးကျောင်း ရိပ်သာ ညောင်ပင်ကြီး
  { id: 'natmyaung-banyan-tree', ...toWorld(82, 4160), radius: 1.6 },
];

/** နတ်မြောင်း ရွာလယ်ရေကန် */
export const natmyaungPonds: PondPlot[] = [
  {
    id: 'natmyaung-village-pond',
    name: 'နတ်မြောင်း ရွာလယ်ရေကန်',
    u: 95,
    v: 4239,
    ...toWorld(95, 4239),
    width: 15,
    depth: 15,
    rotation: Math.PI / 4,
    color: '#2a6f97',
  },
];

const farmTrees: TreePlot[] = [];
const fields: FieldPlot[] = [];
const bundedFields: FieldPlot[] = [];

/**
 * နတ်မြောင်းကျေးရွာ (Nat Myaung Village Meta Data)
 * System အားလုံး (`kalayVillages`, `detectLocation`, `collision`, `2D Minimap`) နှင့် ချိတ်ဆက်ရန်
 */
export const natmyaungVillage: VillageMeta = {
  id: natmyaungMeta.id,
  name: natmyaungMeta.name,
  englishName: natmyaungMeta.englishName,
  villageTract: natmyaungMeta.villageTract,
  description: natmyaungMeta.description,
  coordinates: natmyaungMeta.coordinates,
  x: natmyaungMeta.spawn.x,
  z: natmyaungMeta.spawn.z,
  labelPos: toWorld(0, 4220),
  separationFields: [],
  houses: natmyaungHouses,
  roads: natmyaungRoadPlots,
  fields,
  bundedFields,
  ponds: natmyaungPonds,
  trees,
  largeTrees,
  farmTrees,
};
