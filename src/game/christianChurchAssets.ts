import { BoxGeometry, ConeGeometry, MeshStandardMaterial } from 'three';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Christian Church Components
 * ============================================================================
 * Dedicated GPU geometry/material cache for Christian churches across villages
 * (e.g. St. Assumption Catholic Church & Bell Tower, Kingdom Hall in Tharyargone;
 * Baptist, IBC, CJC, and St. Peter Catholic Church in Kyar Inn).
 */
export interface ChristianChurchAssetCache {
  readonly id: string;
  readonly unitBoxGeo: BoxGeometry;
  readonly pyramidSpireGeo: ConeGeometry;
  readonly gothicSpireGeo: ConeGeometry;
  readonly plinthStoneMat: MeshStandardMaterial;
  readonly kyarinnPlinthMat: MeshStandardMaterial;
  readonly corniceMat: MeshStandardMaterial;
  readonly crossGoldMat: MeshStandardMaterial;
  readonly steepleCrossGoldMat: MeshStandardMaterial;
  readonly sanctuaryWindowMat: MeshStandardMaterial;
  readonly tallWindowGlassMat: MeshStandardMaterial;
  readonly towerLouverMat: MeshStandardMaterial;
  readonly sanctuaryDoorMat: MeshStandardMaterial;
  readonly steepleDoorMat: MeshStandardMaterial;
}

let singletonChurchCache: ChristianChurchAssetCache | null = null;

export function getChristianChurchAssetCache(): ChristianChurchAssetCache {
  if (singletonChurchCache) return singletonChurchCache;

  singletonChurchCache = Object.freeze({
    id: 'christian-church-singleton-cache',
    unitBoxGeo: new BoxGeometry(1, 1, 1),
    pyramidSpireGeo: new ConeGeometry(1, 1, 4),
    gothicSpireGeo: new ConeGeometry(1, 1, 8),
    plinthStoneMat: new MeshStandardMaterial({ color: '#cfc4a9', roughness: 0.9 }),
    kyarinnPlinthMat: new MeshStandardMaterial({ color: '#d4ccb8', roughness: 0.9 }),
    corniceMat: new MeshStandardMaterial({ color: '#d7ccb2', roughness: 0.85 }),
    crossGoldMat: new MeshStandardMaterial({ color: '#e4c15a', metalness: 0.35, roughness: 0.42 }),
    steepleCrossGoldMat: new MeshStandardMaterial({ color: '#f5d061', metalness: 0.38, roughness: 0.4 }),
    sanctuaryWindowMat: new MeshStandardMaterial({ color: '#4b6a85', roughness: 0.55 }),
    tallWindowGlassMat: new MeshStandardMaterial({ color: '#8fb3cc', roughness: 0.45 }),
    towerLouverMat: new MeshStandardMaterial({ color: '#2b475e', roughness: 0.6 }),
    sanctuaryDoorMat: new MeshStandardMaterial({ color: '#6b4a30', roughness: 0.8 }),
    steepleDoorMat: new MeshStandardMaterial({ color: '#453123', roughness: 0.82 }),
  });

  return singletonChurchCache;
}

export function disposeChristianChurchAssetCache(): void {
  if (!singletonChurchCache) return;
  const c = singletonChurchCache;
  singletonChurchCache = null;
  c.unitBoxGeo.dispose();
  c.pyramidSpireGeo.dispose();
  c.gothicSpireGeo.dispose();
  c.plinthStoneMat.dispose();
  c.kyarinnPlinthMat.dispose();
  c.corniceMat.dispose();
  c.crossGoldMat.dispose();
  c.steepleCrossGoldMat.dispose();
  c.sanctuaryWindowMat.dispose();
  c.tallWindowGlassMat.dispose();
  c.towerLouverMat.dispose();
  c.sanctuaryDoorMat.dispose();
  c.steepleDoorMat.dispose();
}
