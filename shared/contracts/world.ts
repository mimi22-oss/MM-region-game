import {
  CONTRACT_SCHEMA_VERSIONS,
  assertDistinctAssetAndInstance,
  isValidAssetId,
  isValidChunkId,
  isValidInstanceId,
  isValidRegionId,
  isValidSha256Hex,
  type AssetId,
  type AuthorityOwner,
  type ChunkId,
  type InstanceId,
  type RegionId,
} from './ids.ts';

/**
 * Administrative place identity (ward, village, township).
 * Explicitly separate from streaming spatial grid chunks so governance, naming,
 * ownership, and billing can evolve independently from geometry chunking.
 */
export interface AdministrativePlace {
  readonly regionId: RegionId;
  readonly kind: 'ward' | 'village' | 'township' | 'custom';
  readonly name: string;
  readonly nameMm?: string;
  readonly parentAdminId?: string;
}

export type WorldCrs = 'EPSG:4326' | 'LOCAL_METERS_XZ';

export interface RegionProjectionSpec {
  readonly crs: WorldCrs;
  readonly originLonLat: readonly [number, number];
  readonly anchorXZ: readonly [number, number];
  readonly metersPerDegree: readonly [number, number];
  readonly rotationRad: number;
}

export type BoundingBox2D = readonly [number, number, number, number];

export interface SpatialChunkDescriptorV2 {
  readonly id: string;
  readonly chunkId?: ChunkId;
  readonly url: string;
  readonly bbox: BoundingBox2D;
  readonly bytes: number;
  readonly featureCount: number;
  readonly coordinateCount: number;
  readonly sha256?: string;
  readonly lod?: 0 | 1 | 2;
  readonly dependencies?: readonly AssetId[];
}

export interface SpatialChunkManifestV2 {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSIONS.worldChunk;
  readonly dataset: string;
  readonly regionId?: RegionId;
  readonly version: string;
  readonly crs: WorldCrs;
  readonly projection?: RegionProjectionSpec;
  readonly featureCount: number;
  readonly limits: {
    readonly maxFeatures: number;
    readonly maxBytes: number;
    readonly maxCoordinates: number;
  };
  readonly authority: Extract<AuthorityOwner, 'publisher-manifest' | 'local-offline'>;
  readonly tiles: readonly SpatialChunkDescriptorV2[];
}

/**
 * World object placement instance referencing a reusable AssetDefinition by `assetId`.
 * Replaces duplicating 3D geometry/GLB definitions per house, tree, or village.
 */
export interface WorldPlacementV1 {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSIONS.worldPlacement;
  readonly instanceId: InstanceId;
  readonly assetId: AssetId;
  readonly regionId: RegionId;
  readonly chunkId?: ChunkId;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly scale: readonly [number, number, number];
  readonly variantOverrides?: {
    readonly primaryColor?: string;
    readonly secondaryColor?: string;
    readonly label?: string;
  };
  readonly authority: Extract<AuthorityOwner, 'publisher-manifest' | 'server-authoritative' | 'local-offline'>;
}

/**
 * Engine-independent spatial walkability & safe-zone oracle injected into
 * pure AI/gameplay loops (`ghostAi.ts`, future combat & server AI) so simulation
 * never couples directly to `three` Scene traversal or `window.localStorage`.
 */
export interface WalkabilityPort {
  isPointWalkable(x: number, z: number): boolean;
  isSegmentWalkable?(ax: number, az: number, bx: number, bz: number): boolean;
  sampleGroundY?(x: number, z: number): number;
  isHomeProtected?(x: number, z: number, bufferM?: number): boolean;
}

export function validateWorldPlacement(input: unknown): WorldPlacementV1 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('WorldPlacementV1 must be an object');
  }
  const v = input as Record<string, unknown>;
  if (v.schemaVersion !== CONTRACT_SCHEMA_VERSIONS.worldPlacement) {
    throw new Error(`Unsupported WorldPlacement schemaVersion: ${String(v.schemaVersion)}`);
  }
  if (!isValidInstanceId(v.instanceId) || !isValidAssetId(v.assetId) || !isValidRegionId(v.regionId)) {
    throw new Error('Invalid instanceId, assetId, or regionId on WorldPlacementV1');
  }
  assertDistinctAssetAndInstance(v.assetId, v.instanceId);
  if (v.chunkId !== undefined && !isValidChunkId(v.chunkId)) {
    throw new Error(`Invalid chunkId "${String(v.chunkId)}"`);
  }
  const pos = v.position;
  const scale = v.scale;
  if (
    !Array.isArray(pos) ||
    pos.length !== 3 ||
    !pos.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    throw new Error('WorldPlacementV1.position must contain 3 finite numbers');
  }
  if (
    !Array.isArray(scale) ||
    scale.length !== 3 ||
    !scale.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100)
  ) {
    throw new Error('WorldPlacementV1.scale must contain 3 positive numbers <= 100');
  }
  if (typeof v.rotationY !== 'number' || !Number.isFinite(v.rotationY)) {
    throw new Error('WorldPlacementV1.rotationY must be finite');
  }
  const authority = v.authority;
  if (
    authority !== 'publisher-manifest' &&
    authority !== 'server-authoritative' &&
    authority !== 'local-offline'
  ) {
    throw new Error(`Invalid WorldPlacement authority: ${String(authority)}`);
  }
  return v as unknown as WorldPlacementV1;
}

export function validateSpatialChunkManifestV2(input: unknown): SpatialChunkManifestV2 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid SpatialChunkManifestV2');
  }
  const m = input as SpatialChunkManifestV2;
  if (
    m.schemaVersion !== CONTRACT_SCHEMA_VERSIONS.worldChunk ||
    (m.crs !== 'EPSG:4326' && m.crs !== 'LOCAL_METERS_XZ') ||
    !m.dataset ||
    !m.version ||
    !Array.isArray(m.tiles) ||
    !m.limits
  ) {
    throw new Error('Malformed SpatialChunkManifestV2 header');
  }
  if (m.regionId !== undefined && !isValidRegionId(m.regionId)) {
    throw new Error(`Invalid regionId "${String(m.regionId)}"`);
  }
  if (m.authority !== 'publisher-manifest' && m.authority !== 'local-offline') {
    throw new Error(`Invalid manifest authority "${String(m.authority)}"`);
  }
  let count = 0;
  const seen = new Set<string>();
  for (const t of m.tiles) {
    if (!t.id || seen.has(t.id) || !/^tiles\/[a-zA-Z0-9._-]+\.json$/.test(t.url)) {
      throw new Error(`Invalid or duplicate chunk descriptor "${t?.id}"`);
    }
    seen.add(t.id);
    if (t.chunkId !== undefined && !isValidChunkId(t.chunkId)) {
      throw new Error(`Invalid chunkId "${String(t.chunkId)}"`);
    }
    if (t.sha256 !== undefined && !isValidSha256Hex(t.sha256)) {
      throw new Error(`Invalid chunk sha256 on "${t.id}"`);
    }
    if (!Array.isArray(t.bbox) || t.bbox.length !== 4 || !t.bbox.every(Number.isFinite)) {
      throw new Error(`Invalid bbox on "${t.id}"`);
    }
    if (
      t.dependencies !== undefined &&
      (!Array.isArray(t.dependencies) || t.dependencies.some((dep: unknown) => !isValidAssetId(dep)))
    ) {
      throw new Error(`Invalid dependency AssetId on "${t.id}"`);
    }
    count += t.featureCount;
  }
  if (count !== m.featureCount) {
    throw new Error(`SpatialChunkManifestV2 featureCount mismatch (${count} !== ${m.featureCount})`);
  }
  return m;
}
