import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  MeshLambertMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { getChinHouseAssetCache, type ChinHouseAssetCache } from './chinHouseAssets.ts';
import { getMonasteryBuildingAssetCache, type MonasteryBuildingAssetCache } from './monasteryAssets.ts';
import { getTreeAssetCache, type TreeAssetCache } from './treeResourcePool.ts';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Highland Plateau Camps, Villages,
 * Ponds, Boulders, Bushes & Earthen Trails (ZERO Geometry/Material Duplication)
 * ============================================================================
 * Strictly reuses existing Singletons (`getChinHouseAssetCache()`,
 * `getTreeAssetCache()`, `getMonasteryBuildingAssetCache()`) by memory reference
 * and allocates ONE shared GPU buffer set for camp tents, campfires, firewood,
 * boulders, and radial earthen paths.
 */

export interface HighlandPlateauAssetCache {
  readonly id: string;
  // Shared existing Singleton references (zero duplication!)
  readonly chinHouseCache: ChinHouseAssetCache;
  readonly treeCache: TreeAssetCache;
  readonly monasteryCache: MonasteryBuildingAssetCache;
  // Shared geometries for Highland camps, ponds, boulders, and trails
  readonly tentRoofGeo: ConeGeometry;
  readonly tentPoleGeo: CylinderGeometry;
  readonly campfireRingGeo: TorusGeometry;
  readonly campfireFlameGeo: ConeGeometry;
  readonly firewoodLogGeo: CylinderGeometry;
  readonly boulderGeo: DodecahedronGeometry;
  readonly trailHubGeo: CylinderGeometry;
  readonly trailStripGeo: BoxGeometry;
  readonly pondRimGeo: CylinderGeometry;
  readonly pondWaterGeo: CylinderGeometry;
  readonly houseRoofGeo: ConeGeometry;
  readonly waterJarGeo: SphereGeometry;
  // Shared materials
  readonly tentCanvasMat: MeshStandardMaterial;
  readonly tentWoodMat: MeshStandardMaterial;
  readonly campfireStoneMat: MeshStandardMaterial;
  readonly campfireFlameMat: MeshStandardMaterial;
  readonly firewoodMat: MeshStandardMaterial;
  readonly boulderInstancedMat: MeshLambertMaterial;
  readonly trailDirtMat: MeshStandardMaterial;
  readonly pondWaterMat: MeshStandardMaterial;
}

let singletonHighlandCache: HighlandPlateauAssetCache | null = null;
let highlandCacheCreationCount = 0;

export function getHighlandPlateauAssetCache(): HighlandPlateauAssetCache {
  if (singletonHighlandCache) return singletonHighlandCache;

  highlandCacheCreationCount += 1;
  const chinHouseCache = getChinHouseAssetCache();
  const treeCache = getTreeAssetCache();
  const monasteryCache = getMonasteryBuildingAssetCache();

  singletonHighlandCache = Object.freeze({
    id: `highland-plateau-singleton-${highlandCacheCreationCount}`,
    chinHouseCache,
    treeCache,
    monasteryCache,

    tentRoofGeo: new ConeGeometry(3.2, 3.1, 4),
    tentPoleGeo: new CylinderGeometry(0.09, 0.12, 3.8, 6),
    campfireRingGeo: new TorusGeometry(1.15, 0.24, 6, 10),
    campfireFlameGeo: new ConeGeometry(0.52, 1.15, 6),
    firewoodLogGeo: new CylinderGeometry(0.24, 0.26, 2.2, 6),
    boulderGeo: new DodecahedronGeometry(1.0, 0),
    trailHubGeo: new CylinderGeometry(0.5, 0.54, 0.14, 14),
    trailStripGeo: new BoxGeometry(1.0, 0.12, 1.0),
    pondRimGeo: new CylinderGeometry(1.0, 1.08, 0.42, 16),
    pondWaterGeo: new CylinderGeometry(0.88, 0.88, 0.12, 16),
    houseRoofGeo: new ConeGeometry(0.76, 1.0, 4),
    waterJarGeo: new SphereGeometry(0.45, 8, 6),

    tentCanvasMat: new MeshStandardMaterial({ color: '#dfbe8e', roughness: 0.88 }),
    tentWoodMat: new MeshStandardMaterial({ color: '#6b4528', roughness: 0.9 }),
    campfireStoneMat: new MeshStandardMaterial({ color: '#7b746a', roughness: 0.94 }),
    campfireFlameMat: new MeshStandardMaterial({
      color: '#ff962e',
      emissive: '#ff5d14',
      emissiveIntensity: 0.85,
      roughness: 0.4,
    }),
    firewoodMat: new MeshStandardMaterial({ color: '#7a4d2a', roughness: 0.92 }),
    boulderInstancedMat: new MeshLambertMaterial({ color: '#ffffff' }),
    trailDirtMat: new MeshStandardMaterial({ color: '#d4a36a', roughness: 0.96 }),
    pondWaterMat: new MeshStandardMaterial({ color: '#2b89a2', roughness: 0.18, metalness: 0.28 }),
  });

  return singletonHighlandCache;
}

export function getHighlandPlateauAssetCacheStats() {
  return {
    initialized: singletonHighlandCache !== null,
    creationCount: highlandCacheCreationCount,
  };
}

export function disposeHighlandPlateauAssetCache(): void {
  if (!singletonHighlandCache) return;
  const c = singletonHighlandCache;
  singletonHighlandCache = null;
  // Dispose ONLY highland-owned buffers (never dispose shared Tree/ChinHouse/Monastery singletons!)
  c.tentRoofGeo.dispose();
  c.tentPoleGeo.dispose();
  c.campfireRingGeo.dispose();
  c.campfireFlameGeo.dispose();
  c.firewoodLogGeo.dispose();
  c.boulderGeo.dispose();
  c.trailHubGeo.dispose();
  c.trailStripGeo.dispose();
  c.pondRimGeo.dispose();
  c.pondWaterGeo.dispose();
  c.houseRoofGeo.dispose();
  c.waterJarGeo.dispose();
  c.tentCanvasMat.dispose();
  c.tentWoodMat.dispose();
  c.campfireStoneMat.dispose();
  c.campfireFlameMat.dispose();
  c.firewoodMat.dispose();
  c.boulderInstancedMat.dispose();
  c.trailDirtMat.dispose();
  c.pondWaterMat.dispose();
}
