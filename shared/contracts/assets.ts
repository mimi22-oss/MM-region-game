import {
  CONTRACT_SCHEMA_VERSIONS,
  isValidAssetId,
  isValidSha256Hex,
  type AssetId,
  type AuthorityOwner,
} from './ids.ts';

export type AssetDomainCategory =
  | 'buildings'
  | 'nature'
  | 'infrastructure'
  | 'furniture'
  | 'vehicles'
  | 'cultural'
  | 'character';

export interface AssetLodSpec {
  readonly level: 0 | 1 | 2;
  readonly url?: string;
  readonly sha256?: string;
  readonly maxTriangles: number;
  readonly screenSwitchPx?: number;
}

export interface AssetProvenance {
  readonly sourceType: 'procedural' | 'blender-glb' | 'ai-custom' | 'osm-derived';
  readonly sourceRef?: string;
  readonly license?: string;
  readonly author?: string;
}

export interface AssetCollisionSpec {
  readonly type: 'box' | 'cylinder' | 'none';
  readonly width?: number;
  readonly depth?: number;
  readonly radius?: number;
}

export interface AssetFootprint2D {
  readonly shape: 'rect' | 'circle' | 'complex';
  readonly defaultWidth: number;
  readonly defaultDepth: number;
  readonly color: string;
  readonly stroke: string;
  readonly roofRidge?: boolean;
}

export interface AssetBudgetSpec {
  readonly maxTriangles: number;
  readonly maxTexturePx: number;
  readonly maxBytes: number;
}

export interface AssetDefinitionV2 {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSIONS.assetDefinition;
  readonly assetId: AssetId;
  readonly version: string;
  readonly contentHash?: string;
  readonly name: string;
  readonly nameMm: string;
  readonly category: AssetDomainCategory;
  readonly rendererHint: string;
  readonly provenance: AssetProvenance;
  readonly bounds: {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
  };
  readonly collision: AssetCollisionSpec;
  readonly footprint2d: AssetFootprint2D;
  readonly skeletonId?: string;
  readonly animationClips?: readonly string[];
  readonly lods: readonly AssetLodSpec[];
  readonly budgets: AssetBudgetSpec;
  readonly dependencies: readonly AssetId[];
  readonly authority: Extract<AuthorityOwner, 'publisher-manifest' | 'local-offline'>;
  readonly tags: readonly string[];
}

export function validateAssetDefinitionV2(input: unknown): AssetDefinitionV2 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('AssetDefinitionV2 must be an object');
  }
  const v = input as AssetDefinitionV2;
  if (v.schemaVersion !== CONTRACT_SCHEMA_VERSIONS.assetDefinition) {
    throw new Error(`Unsupported AssetDefinition schemaVersion: ${String(v.schemaVersion)}`);
  }
  if (!isValidAssetId(v.assetId)) {
    throw new Error(`Invalid AssetDefinitionV2.assetId: "${String(v.assetId)}"`);
  }
  if (!v.version || typeof v.version !== 'string') {
    throw new Error(`Missing version on "${v.assetId}"`);
  }
  if (v.contentHash !== undefined && !isValidSha256Hex(v.contentHash)) {
    throw new Error(`Invalid sha256 contentHash on "${v.assetId}"`);
  }
  const { width, depth, height } = v.bounds ?? {};
  if (
    ![width, depth, height].every(
      (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1000,
    )
  ) {
    throw new Error(`Invalid bounds on "${v.assetId}"`);
  }
  if (
    !v.budgets ||
    ![v.budgets.maxTriangles, v.budgets.maxTexturePx, v.budgets.maxBytes].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    )
  ) {
    throw new Error(`Invalid budgets on "${v.assetId}"`);
  }
  if (!Array.isArray(v.lods) || v.lods.length === 0) {
    throw new Error(`AssetDefinitionV2 "${v.assetId}" requires at least one LOD entry`);
  }
  for (const lod of v.lods) {
    if (lod.sha256 !== undefined && !isValidSha256Hex(lod.sha256)) {
      throw new Error(`Invalid LOD sha256 on "${v.assetId}"`);
    }
    if (!Number.isSafeInteger(lod.maxTriangles) || lod.maxTriangles <= 0) {
      throw new Error(`Invalid LOD triangle budget on "${v.assetId}"`);
    }
  }
  if (!Array.isArray(v.dependencies) || v.dependencies.some((dep: unknown) => !isValidAssetId(dep) || dep === v.assetId)) {
    throw new Error(`Invalid self/malformed dependency on "${v.assetId}"`);
  }
  return v;
}
