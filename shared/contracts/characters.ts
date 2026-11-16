import {
  CONTRACT_SCHEMA_VERSIONS,
  isValidAssetId,
  isValidCharacterDefId,
  type AssetId,
  type AuthorityOwner,
  type CharacterDefId,
} from './ids.ts';

export type RigProfileId =
  | 'mixamo-humanoid-v1'
  | 'procedural-human-v1'
  | 'robot-biped-v1'
  | 'ghost-biped-v1';

export type CharacterRole =
  | 'player'
  | 'npc-civilian'
  | 'npc-ghost'
  | 'npc-vendor'
  | 'npc-courier'
  | 'npc-combatant';

export type CharacterAppearanceVariantV1 = {
  readonly presetId: string;
  readonly primaryColor?: string;
  readonly secondaryColor?: string;
  readonly hairColor?: string;
  readonly skinColor?: string;
  readonly heightScale: number;
};

/**
 * Separates logical character definition (reusable rig + appearance + animation references + role stats)
 * from per-instance simulation state and Three.js `SkinnedMesh` objects.
 */
export interface CharacterDefinitionV1 {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSIONS.characterDefinition;
  readonly characterDefId: CharacterDefId;
  readonly displayName: string;
  readonly displayNameMm?: string;
  readonly role: CharacterRole;
  readonly rigProfile: RigProfileId;
  readonly modelAssetId: AssetId;
  readonly sharedRigRequired: boolean;
  readonly supportedClipIds: readonly string[];
  readonly defaultAppearance: CharacterAppearanceVariantV1;
  readonly authority: Extract<AuthorityOwner, 'publisher-manifest' | 'server-authoritative' | 'local-offline'>;
}

export function validateCharacterDefinitionV1(input: unknown): CharacterDefinitionV1 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('CharacterDefinitionV1 must be an object');
  }
  const v = input as CharacterDefinitionV1;
  if (v.schemaVersion !== CONTRACT_SCHEMA_VERSIONS.characterDefinition) {
    throw new Error(`Unsupported CharacterDefinition schemaVersion: ${String(v.schemaVersion)}`);
  }
  if (!isValidCharacterDefId(v.characterDefId)) {
    throw new Error(`Invalid characterDefId "${String(v.characterDefId)}"`);
  }
  if (!isValidAssetId(v.modelAssetId)) {
    throw new Error(`Invalid modelAssetId "${String(v.modelAssetId)}"`);
  }
  if (!v.defaultAppearance || typeof v.defaultAppearance.presetId !== 'string') {
    throw new Error(`Missing defaultAppearance on "${v.characterDefId}"`);
  }
  const scale = v.defaultAppearance.heightScale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0.5 || scale > 2.0) {
    throw new Error(`Invalid heightScale (${String(scale)}) on "${v.characterDefId}"`);
  }
  if (!Array.isArray(v.supportedClipIds)) {
    throw new Error(`supportedClipIds must be an array on "${v.characterDefId}"`);
  }
  return v;
}
