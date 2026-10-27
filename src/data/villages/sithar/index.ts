import type { VillageMeta, TreePlot, FieldPlot } from '../../types.ts';
import { sitharMeta, toWorld } from './sitharData.ts';
import { siTharBuildings, siTharHouses } from './sitharBuildings.ts';
import { siTharRoads, siTharRoadPlots } from './sitharRoads.ts';
import {
  sitharBoundaryWorldPoints,
  sitharBoundaryUVPoints,
  sitharBoundaryGeoPoints,
  sitharBoundarySvgPath,
  sitharBoundaryBounds,
  isPointInsideSiThar,
} from './sitharBoundary.ts';

export * from './sitharData.ts';
export * from './sitharBoundary.ts';
export * from './sitharBuildings.ts';
export * from './sitharRoads.ts';

import {siTharSeparationFields} from './separationFields.ts';
export * from './separationFields.ts';

const trees: TreePlot[] = siTharBuildings.filter(b => !b.isLandmark).slice(0, 30).map((b, i) => {
  const rot = b.rotation;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const localX = (i % 2 === 0 ? 1 : -1) * (b.width / 2 + 0.4);
  const localZ = (i % 3 === 0 ? 1 : -1) * (b.depth / 2 + 0.25);
  return {
    id: `sithar-tree-${i + 1}`,
    x: Number((b.x + localX * cos - localZ * sin).toFixed(2)),
    z: Number((b.z + localX * sin + localZ * cos).toFixed(2)),
    radius: 0.45,
  };
});

/** စည်သာရွာ လမ်းဘေး အရိပ်ရ သစ်ပင်ကြီးများ */
const largeTrees: TreePlot[] = [
  ...[4030, 4050, 4070, 4090].flatMap((v, i) => [
    { id: `sithar-ah1-tree-w-${i}`, ...toWorld(-8.0, v), radius: 0.9 },
    { id: `sithar-ah1-tree-e-${i}`, ...toWorld(8.0, v), radius: 0.9 },
  ]),
  { id: 'sithar-church-banyan-tree', ...toWorld(-124.0, 4060.5), radius: 1.2 },
  { id: 'sithar-monastery-peepal-tree', ...toWorld(-124.0, 4064.5), radius: 1.2 },
];

const farmTrees: TreePlot[] = [];
const bundedFields: FieldPlot[] = [];

/**
 * စည်သာကျေးရွာ (Si Thar Village Meta Data)
 * System အားလုံး (kalayVillages, detectLocation, collision, 2D Minimap) နှင့် ချိတ်ဆက်ရန်
 */
export const siTharVillage: VillageMeta = {
  id: sitharMeta.id,
  name: sitharMeta.name,
  englishName: sitharMeta.englishName,
  villageTract: sitharMeta.villageTract,
  description: sitharMeta.description,
  coordinates: sitharMeta.coordinates,
  x: sitharMeta.spawn.x,
  z: sitharMeta.spawn.z,
  labelPos: toWorld(0, 4061),
  separationFields: siTharSeparationFields,
  houses: siTharHouses,
  roads: siTharRoadPlots,
  fields: siTharSeparationFields,
  bundedFields,
  ponds: [],
  trees,
  largeTrees,
  farmTrees,
};
