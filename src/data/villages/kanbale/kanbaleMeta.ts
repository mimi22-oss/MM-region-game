import type { VillageMeta } from '../../types.ts';
import { kanbaleMeta, toWorld } from './kanbaleData.ts';
import {
  kanbaleBoundaryWorldPoints,
  kanbaleBoundaryUVPoints,
  kanbaleBoundaryGeoPoints,
  kanbaleBoundarySvgPath,
  kanbaleBoundaryBounds,
  isPointInsideKanbale,
} from './kanbaleBoundary.ts';
import {
  kanbaleDrain,
  kanbaleDrainWorldPoints,
  kanbaleDrainSvgPath,
  type WaterwayDrainPlot,
} from './kanbaleDrain.ts';

export * from './kanbaleData.ts';
export {
  kanbaleBoundaryWorldPoints,
  kanbaleBoundaryUVPoints,
  kanbaleBoundaryGeoPoints,
  kanbaleBoundarySvgPath,
  kanbaleBoundaryBounds,
  isPointInsideKanbale,
};
export {
  kanbaleDrain,
  kanbaleDrainWorldPoints,
  kanbaleDrainSvgPath,
  type WaterwayDrainPlot,
};

export const KANBALE_CUSTOM_BUILDINGS: Record<string, string> = {
  'way/403027623': 'KanbaleFarmhouse',
  'way/403030614': 'KanbaleSchool',
};

/**
 * Lightweight Kanbale village metadata for scene budget discovery, navigation, and location detection.
 * Bulk buildings (669), roads (45), road-plots (50), and trees (170) stream on demand from
 * versioned spatial chunks under `public/map/kanbale/<version>/manifest.json`.
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
  houses: [],
  roads: [],
  fields: [],
  bundedFields: [],
  trees: [],
  largeTrees: [],
  farmTrees: [],
  streamed: true,
  streamedDataset: 'kanbale',
};
