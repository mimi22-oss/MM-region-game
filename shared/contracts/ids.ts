/**
 * Canonical schema versions, identifiers, and authority boundaries for MM Region Game.
 * Engine-independent: safe for Node servers, Web clients, Capacitor Android, and pipelines.
 */

export const CONTRACT_SCHEMA_VERSIONS = {
  worldChunk: 2,
  worldPlacement: 1,
  worldLayout: 1,
  assetDefinition: 2,
  characterDefinition: 1,
  appearance: 1,
  gameSave: 1,
  networkPresence: 1,
  networkAuthoritative: 2,
  mapPermissions: 1,
} as const;

export type AuthorityOwner =
  | 'local-offline'
  | 'server-authoritative'
  | 'publisher-manifest'
  | 'client-intent';

export type BrandedId<K extends string> = string & { readonly __brand?: K };

export type AssetId = BrandedId<'AssetId'>;
export type InstanceId = BrandedId<'InstanceId'>;
export type RegionId = BrandedId<'RegionId'>;
export type ChunkId = BrandedId<'ChunkId'>;
export type CharacterDefId = BrandedId<'CharacterDefId'>;
export type AccountId = BrandedId<'AccountId'>;
export type OrderId = BrandedId<'OrderId'>;
export type DeliveryJobId = BrandedId<'DeliveryJobId'>;

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const NAMESPACED_ASSET_ID_RE =
  /^(?:buildings?|nature|infrastructure|furniture|vehicles?|cultural|character|item|prop|custom):[a-z0-9][a-z0-9._-]{0,79}$/i;
const CHUNK_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}:L[0-3]:-?\d+:-?\d+$/;
const INSTANCE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9:/_.-]{0,127}$/;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export function isValidSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_RE.test(value.trim());
}

export function isValidAssetId(value: unknown): value is AssetId {
  return typeof value === 'string' && NAMESPACED_ASSET_ID_RE.test(value.trim());
}

export function parseAssetId(value: unknown): AssetId {
  if (!isValidAssetId(value)) {
    throw new Error(`Invalid AssetId "${String(value)}": expected "<category>:<slug>"`);
  }
  return value.trim() as AssetId;
}

export function isValidInstanceId(value: unknown): value is InstanceId {
  return typeof value === 'string' && INSTANCE_ID_RE.test(value.trim());
}

export function parseInstanceId(value: unknown): InstanceId {
  if (!isValidInstanceId(value)) {
    throw new Error(`Invalid InstanceId "${String(value)}"`);
  }
  return value.trim() as InstanceId;
}

export function isValidRegionId(value: unknown): value is RegionId {
  return typeof value === 'string' && SAFE_SLUG_RE.test(value.trim());
}

export function parseRegionId(value: unknown): RegionId {
  if (!isValidRegionId(value)) {
    throw new Error(`Invalid RegionId "${String(value)}"`);
  }
  return value.trim() as RegionId;
}

export function formatChunkId(
  regionOrCellGroup: string,
  level: 0 | 1 | 2 | 3,
  cx: number,
  cz: number,
): ChunkId {
  const slug = parseRegionId(regionOrCellGroup);
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cz)) {
    throw new Error(`Chunk cell coordinates must be integers (${cx}, ${cz})`);
  }
  return `${slug}:L${level}:${cx}:${cz}` as ChunkId;
}

export function isValidChunkId(value: unknown): value is ChunkId {
  return typeof value === 'string' && CHUNK_ID_RE.test(value.trim());
}

export function isValidCharacterDefId(value: unknown): value is CharacterDefId {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9:._-]{1,79}$/i.test(value.trim());
}

export function parseCharacterDefId(value: unknown): CharacterDefId {
  if (!isValidCharacterDefId(value)) {
    throw new Error(`Invalid CharacterDefId "${String(value)}"`);
  }
  return value.trim() as CharacterDefId;
}

/** Enforces that world placement instance IDs never alias reusable asset definitions. */
export function assertDistinctAssetAndInstance(
  assetId: string,
  instanceId: string,
): void {
  if (!assetId || !instanceId) {
    throw new Error('Both assetId and instanceId are required');
  }
  if (assetId === instanceId) {
    throw new Error(`InstanceId "${instanceId}" must be distinct from AssetId "${assetId}"`);
  }
}
