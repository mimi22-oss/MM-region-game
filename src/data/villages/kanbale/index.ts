import type { VillageMeta, TreePlot, FieldPlot } from '../../types.ts';
import { kanbaleMeta, toWorld } from './kanbaleData.ts';
import { kanbaleBuildings, kanbaleHouses, type KanbaleBuildingData } from './kanbaleBuildings.ts';
import { kanbaleRoads, kanbaleRoadPlots, type KanbaleRoad } from './kanbaleRoads.ts';
import {
  kanbaleBoundaryWorldPoints,
  kanbaleBoundaryUVPoints,
  kanbaleBoundaryGeoPoints,
  kanbaleBoundarySvgPath,
  kanbaleBoundaryBounds,
  isPointInsideKanbale,
} from './kanbaleBoundary.ts';

export * from './kanbaleData.ts';
export * from './kanbaleBoundary.ts';
export * from './kanbaleBuildings.ts';
export * from './kanbaleRoads.ts';

/** ကံပုလဲရွာ ခြံဝင်း သစ်ပင်များ */
const trees: TreePlot[] = kanbaleBuildings.slice(0, 140).map((b, i) => ({
  id: `kanbale-tree-${i + 1}`,
  x: b.x + (i % 2 === 0 ? b.width / 2 + 1.8 : -b.width / 2 - 1.8),
  z: b.z + (i % 3 === 0 ? b.depth / 2 + 1.8 : -b.depth / 2 - 1.8),
  radius: 0.6,
}));

/** ကံပုလဲရွာ လမ်းဘေး အရိပ်ရ သစ်ပင်ကြီးများ */
const largeTrees: TreePlot[] = kanbaleRoads.slice(0, 30).map((r, i) => {
  const pt = r.worldPoints[Math.floor(r.worldPoints.length / 2)];
  return {
    id: `kanbale-large-tree-${i + 1}`,
    x: pt[0] + (i % 2 === 0 ? 4.2 : -4.2),
    z: pt[1] + (i % 2 === 0 ? 4.2 : -4.2),
    radius: 1.1,
  };
});

const farmTrees: TreePlot[] = [];
const fields: FieldPlot[] = [];
import {
  kanbaleDrain,
  kanbaleDrainWorldPoints,
  kanbaleDrainSvgPath,
  type WaterwayDrainPlot,
} from './kanbaleDrain.ts';

export {
  kanbaleDrain,
  kanbaleDrainWorldPoints,
  kanbaleDrainSvgPath,
  type WaterwayDrainPlot,
};

const bundedFields: FieldPlot[] = [];

/**
 * ကံပုလဲရွာ (Kanbale Village Meta Data)
 * System အားလုံး (`kalayVillages`, `detectLocation`, `collision`, `2D Minimap`) နှင့် ချိတ်ဆက်ရန်
 */
export const kanbaleVillage: VillageMeta = {
  id: kanbaleMeta.id,
  name: kanbaleMeta.name,
  englishName: kanbaleMeta.englishName,
  villageTract: kanbaleMeta.villageTract,
  description: kanbaleMeta.description,
  coordinates: kanbaleMeta.coordinates,
  x: kanbaleMeta.spawn.x,
  z: kanbaleMeta.spawn.z,
  labelPos: toWorld(1000, 150),
  separationFields: [],
  connectingCanal: kanbaleDrain,
  houses: kanbaleHouses,
  roads: kanbaleRoadPlots,
  fields,
  bundedFields,
  trees,
  largeTrees,
  farmTrees,
};

