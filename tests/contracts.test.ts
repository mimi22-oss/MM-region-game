import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  CONTRACT_SCHEMA_VERSIONS,
  DOMAIN_AUTHORITY_MATRIX,
  assertDistinctAssetAndInstance,
  formatChunkId,
  parseAssetId,
  parseClientIntentEnvelope,
  validateAssetDefinitionV2,
  validateCharacterDefinitionV1,
  validateSpatialChunkManifestV2,
  validateWorldPlacement,
  type WalkabilityPort,
} from '../shared/contracts/index.ts';
import { HUMAN_PRESETS, humanPresetToCharacterDef, type HumanPreset } from '../src/data/appearance.ts';
import { buildDefaultWarehouseEnvironment } from '../src/data/ghostWarehouseWaypoints.ts';
import { ASSET_LIST, listAssetDefinitionsV2, toAssetDefinitionV2 } from '../src/game/assetRegistry.ts';
import { DEFAULT_GHOST_AI_CONFIG } from '../src/game/ghostConfig.ts';
import { GhostAiController } from '../src/game/ghostAi.ts';
import { migrateGameSave } from '../src/game/gameSave.ts';
import { createMapAccessContext, resolveEffectiveMapRole } from '../src/game/mapPermissions.ts';
import { upgradeManifestToV2, type MapManifest } from '../src/game/mapTileStore.ts';
import { extractWorldPlacements, type WorldLayout } from '../src/game/worldLayout.ts';

const ROOT = resolve(import.meta.dirname, '..');

test('shared/contracts remains strictly engine-independent (zero Three/R3F/DOM/Capacitor imports)', () => {
  const dir = resolve(ROOT, 'shared', 'contracts');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length >= 5);
  for (const file of files) {
    const raw = readFileSync(resolve(dir, file), 'utf8');
    const codeOnly = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(codeOnly, /from ['"](?:three|react|react-dom|@react-three|@capacitor)/);
    assert.doesNotMatch(codeOnly, /\b(?:window|document|localStorage)\b/);
  }
});

test('canonical IDs enforce assetId vs instanceId separation and valid chunk coordinates', () => {
  const assetId = parseAssetId('building:myothar-house');
  const chunkId = formatChunkId('myothar', 2, -4, 7);
  assert.equal(assetId, 'building:myothar-house');
  assert.equal(chunkId, 'myothar:L2:-4:7');
  assert.throws(() => parseAssetId('myothar-house'));
  assert.throws(() => assertDistinctAssetAndInstance('building:house', 'building:house'));
  assert.throws(() =>
    validateWorldPlacement({
      schemaVersion: CONTRACT_SCHEMA_VERSIONS.worldPlacement,
      instanceId: 'building:house',
      assetId: 'building:house',
      regionId: 'myothar',
      position: [0, 0, 0],
      rotationY: 0,
      scale: [1, 1, 1],
      authority: 'local-offline',
    }),
  );
});

test('ASSET_REGISTRY adapts cleanly into AssetDefinitionV2 for every built-in asset', () => {
  const v2List = listAssetDefinitionsV2();
  assert.equal(v2List.length, ASSET_LIST.length);
  for (const item of v2List) {
    const validated = validateAssetDefinitionV2(item);
    assert.equal(validated.schemaVersion, 2);
    assert.equal(validated.authority, item.provenance.sourceType === 'ai-custom' ? 'local-offline' : 'publisher-manifest');
    assert.ok(validated.lods.length >= 1);
  }
  const sample = toAssetDefinitionV2(ASSET_LIST[0]);
  assert.equal(sample.assetId, ASSET_LIST[0].assetId);
});

test('HUMAN_PRESETS adapt into shared-rig CharacterDefinitionV1 contracts', () => {
  for (const preset of Object.keys(HUMAN_PRESETS) as HumanPreset[]) {
    const def = validateCharacterDefinitionV1(humanPresetToCharacterDef(preset));
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.sharedRigRequired, true);
    assert.equal(def.rigProfile, 'mixamo-humanoid-v1');
    assert.notEqual(def.characterDefId, def.modelAssetId);
  }
});

test('map manifests, world layouts, and saves upgrade cleanly into v2/enveloped contracts', () => {
  const manifestV1: MapManifest = {
    schemaVersion: 1,
    dataset: 'sithar-fields',
    version: '0431166f76b83ca83ff0',
    crs: 'EPSG:4326',
    featureCount: 2,
    limits: { maxFeatures: 256, maxBytes: 262144, maxCoordinates: 8192 },
    tiles: [
      { id: '000000', url: 'tiles/000000.hash.json', bbox: [94.0, 23.0, 94.1, 23.1], bytes: 1024, featureCount: 2, coordinateCount: 8 },
    ],
  };
  const v2Manifest = validateSpatialChunkManifestV2(
    upgradeManifestToV2(manifestV1, { regionId: 'sithar', dependencies: ['nature:canopy-tree'] }),
  );
  assert.equal(v2Manifest.schemaVersion, 2);
  assert.equal(v2Manifest.regionId, 'sithar');
  assert.deepEqual(v2Manifest.tiles[0].dependencies, ['nature:canopy-tree']);

  const layout: WorldLayout = {
    version: 1,
    name: 'Test Village',
    updatedAt: '2026-11-16T00:00:00.000Z',
    features: [
      { id: 'road-1', kind: 'road', name: 'Main Road', points: [{ x: 0, z: 0 }, { x: 10, z: 0 }], width: 6 },
      { id: 'house-inst-99', kind: 'house', assetId: 'building:sithar-house', name: 'Sithar Home', points: [{ x: 12, z: -8 }], rotation: 0.5 },
      { id: 'building:tea-shop', kind: 'shop', assetId: 'building:tea-shop', name: 'Tea', points: [{ x: -5, z: 4 }] },
    ],
  };
  const placements = extractWorldPlacements(layout, 'sithar');
  assert.equal(placements.length, 2);
  assert.equal(placements[0].assetId, 'building:sithar-house');
  assert.equal(placements[0].instanceId, 'house-inst-99');
  assert.notEqual(placements[1].instanceId, placements[1].assetId);

  const migratedSave = migrateGameSave({ version: 1, x: 10, z: 20, yaw: 0, pitch: -0.1, zoom: 8, topDown: false, first: false, savedAt: '2026-11-16T00:00:00.000Z' });
  assert.ok(migratedSave);
  assert.equal(migratedSave.authority, 'local-offline');
  assert.equal(migratedSave.data.x, 10);
});

test('authority matrix & trust-boundary validators reject tampered payloads and online admin defaults', () => {
  assert.equal(DOMAIN_AUTHORITY_MATRIX.orders.requiresIdempotencyKey, true);
  assert.equal(DOMAIN_AUTHORITY_MATRIX['ghost-ai'].clientRole, 'read-only-mirror');

  const validOrder = parseClientIntentEnvelope({
    protocolVersion: 2,
    domain: 'orders',
    type: 'order.create',
    seq: 1,
    clientTimeMs: 1700000000000,
    idempotencyKey: 'idem_order_0001',
    payload: { listingId: 'listing-1', quantity: 2 },
  });
  assert.ok(validOrder);

  // Reject missing idempotency key, read-only domains, and client price/admin smuggling
  assert.equal(parseClientIntentEnvelope({ protocolVersion: 2, domain: 'orders', type: 'order.create', seq: 1, clientTimeMs: 1, payload: { listingId: 'l1' } }), null);
  assert.equal(parseClientIntentEnvelope({ protocolVersion: 2, domain: 'shop-catalog', type: 'catalog.edit', seq: 1, clientTimeMs: 1, payload: { listingId: 'l1' } }), null);
  assert.equal(
    parseClientIntentEnvelope({
      protocolVersion: 2,
      domain: 'orders',
      type: 'order.create',
      seq: 2,
      clientTimeMs: 1,
      idempotencyKey: 'idem_order_0002',
      payload: { listingId: 'l1', quantity: 1, price: 0 },
    }),
    null,
  );
  assert.equal(
    parseClientIntentEnvelope({
      protocolVersion: 2,
      domain: 'combat',
      type: 'combat.strike',
      seq: 3,
      clientTimeMs: 1,
      payload: { targetId: 'npc-1', damage: 9999 },
    }),
    null,
  );

  const clientCtx = createMapAccessContext('admin');
  assert.equal(resolveEffectiveMapRole(clientCtx, 'local-offline'), 'admin');
  assert.equal(resolveEffectiveMapRole(clientCtx, 'server-authoritative'), 'user');
  assert.equal(resolveEffectiveMapRole(clientCtx, 'server-authoritative', 'admin'), 'admin');
});

test('GhostAiController accepts injected WalkabilityPort without changing local behavior', () => {
  const env = buildDefaultWarehouseEnvironment();
  let walkChecks = 0;
  const mockPort: WalkabilityPort = {
    isPointWalkable: () => {
      walkChecks++;
      return true;
    },
    isHomeProtected: () => true,
  };
  const ai = new GhostAiController(env, DEFAULT_GHOST_AI_CONFIG, 12345, Math.random, mockPort);
  const snap = ai.step({
    dt: 0.05,
    activeBySchedule: true,
    playerX: env.anchor.x,
    playerZ: env.anchor.z,
  });
  assert.equal(snap.homeProtected, true);
  assert.equal(snap.state, 'COOLDOWN');
  assert.equal(snap.opacity, 0);
  void walkChecks;
});
