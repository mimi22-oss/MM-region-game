import assert from 'node:assert/strict';
import test from 'node:test';
import { farmhouse } from '../src/data/ward.ts';
import { PLAYER_OWNER } from '../src/game/homeAccess.ts';
import {
  canCreateMapFeature,
  canDeleteMapFeature,
  canEditAssetLibrary,
  canEditMapFeature,
  canImportOrModifyRegion,
  canOpenMapTool,
  createMapAccessContext,
  filterPermittedLayoutChanges,
  getActiveAuthoritySession,
  isOwnHomeFeature,
  setActiveAuthoritySession,
} from '../src/game/mapPermissions.ts';
import type { LayoutFeature, WorldLayout } from '../src/game/worldLayout.ts';

function sampleFeatures(): LayoutFeature[] {
  return [
    {
      id: farmhouse.id,
      kind: 'house',
      name: 'Farmhouse',
      points: [{ x: farmhouse.x, z: farmhouse.z }],
      color: '#d9c4a5',
      roofColor: '#9b3f2b',
      metadata: { authored: true, sourceId: farmhouse.id },
    },
    {
      id: 'neighbor-house-1',
      kind: 'house',
      name: 'Neighbor House',
      points: [{ x: 40, z: 40 }],
      color: '#baa892',
      roofColor: '#687788',
      metadata: { authored: true, sourceId: 'neighbor-house-1' },
    },
    {
      id: 'road-ah1',
      kind: 'road',
      name: 'AH1',
      points: [
        { x: 0, z: 0 },
        { x: 0, z: 100 },
      ],
      width: 12,
    },
    {
      id: 'tree-1',
      kind: 'tree',
      name: 'Mango Tree',
      points: [{ x: 15, z: -20 }],
    },
  ];
}

test('Map portal tool access restricts GeoJSON tool to admin while keeping Map Editor open for users', () => {
  const adminCtx = createMapAccessContext('admin');
  const userCtx = createMapAccessContext('user', PLAYER_OWNER);

  assert.equal(canOpenMapTool('editor', adminCtx), true);
  assert.equal(canOpenMapTool('geojson', adminCtx), true);
  assert.equal(canCreateMapFeature(adminCtx), true);
  assert.equal(canImportOrModifyRegion(adminCtx), true);
  assert.equal(canEditAssetLibrary(adminCtx), true);

  assert.equal(canOpenMapTool('editor', userCtx), true);
  assert.equal(canOpenMapTool('geojson', userCtx), false);
  assert.equal(canCreateMapFeature(userCtx), false);
  assert.equal(canImportOrModifyRegion(userCtx), false);
  assert.equal(canEditAssetLibrary(userCtx), false);
});

test('User role can edit only their own house and cannot edit, create, or delete other world features', () => {
  const adminCtx = createMapAccessContext('admin');
  const userCtx = createMapAccessContext('user', PLAYER_OWNER, ['custom-owned-house']);
  const [ownHome, neighborHome, road, tree] = sampleFeatures();
  const extraOwnedHouse: LayoutFeature = {
    id: 'house-via-owner-meta',
    kind: 'house',
    name: 'Extra House',
    points: [{ x: 80, z: 80 }],
    metadata: { ownerId: PLAYER_OWNER },
  };

  assert.equal(isOwnHomeFeature(ownHome, userCtx), true);
  assert.equal(isOwnHomeFeature(extraOwnedHouse, userCtx), true);
  assert.equal(isOwnHomeFeature(neighborHome, userCtx), false);
  assert.equal(isOwnHomeFeature(road, userCtx), false);

  assert.equal(canEditMapFeature(ownHome, userCtx), true);
  assert.equal(canEditMapFeature(extraOwnedHouse, userCtx), true);
  assert.equal(canEditMapFeature(neighborHome, userCtx), false);
  assert.equal(canEditMapFeature(road, userCtx), false);
  assert.equal(canEditMapFeature(tree, userCtx), false);

  assert.equal(canDeleteMapFeature(ownHome, userCtx), false);
  assert.equal(canDeleteMapFeature(neighborHome, userCtx), false);
  assert.equal(canDeleteMapFeature(neighborHome, adminCtx), true);
});

test('filterPermittedLayoutChanges allows own-home updates for users and blocks all unauthorized mutations', () => {
  const adminCtx = createMapAccessContext('admin');
  const userCtx = createMapAccessContext('user', PLAYER_OWNER);
  const features = sampleFeatures();
  const prevLayout: WorldLayout = {
    version: 1,
    name: 'Myothar Ward',
    features,
    deletedSourceIds: [],
  };

  // User edits own house color and coordinates
  const validUserNext: WorldLayout = {
    ...prevLayout,
    features: features.map((f) =>
      f.id === farmhouse.id
        ? { ...f, color: '#f59e0b', points: [{ x: farmhouse.x + 2, z: farmhouse.z }] }
        : f,
    ),
  };
  const validResult = filterPermittedLayoutChanges(validUserNext, prevLayout, userCtx);
  assert.equal(validResult.blockedCount, 0);
  assert.equal(validResult.layout.features[0].color, '#f59e0b');
  assert.equal(validResult.layout.features[0].points[0].x, farmhouse.x + 2);

  // User tries to mutate neighbor house, road, add a feature, delete tree, and rename region
  const maliciousUserNext: WorldLayout = {
    version: 1,
    name: 'Hijacked Region',
    deletedSourceIds: ['neighbor-house-1'],
    features: [
      { ...features[0], color: '#10b981' }, // allowed own-home edit
      { ...features[1], color: '#ef4444' }, // blocked neighbor edit
      { ...features[2], width: 30 }, // blocked road edit
      // features[3] (tree) omitted -> blocked deletion
      { id: 'injected-shop', kind: 'shop', name: 'Injected', points: [{ x: 1, z: 1 }] }, // blocked add
    ],
  };

  const filtered = filterPermittedLayoutChanges(maliciousUserNext, prevLayout, userCtx);
  assert.ok(filtered.blockedCount >= 5);
  assert.equal(filtered.layout.name, 'Myothar Ward');
  assert.deepEqual(filtered.layout.deletedSourceIds, []);
  assert.equal(filtered.layout.features.length, prevLayout.features.length);
  assert.equal(filtered.layout.features[0].color, '#10b981');
  assert.equal(filtered.layout.features[1].color, '#baa892');
  assert.equal(filtered.layout.features[2].width, 12);
  assert.equal(filtered.layout.features[3].id, 'tree-1');

  // Admin performs the exact same changes -> all allowed
  const adminResult = filterPermittedLayoutChanges(maliciousUserNext, prevLayout, adminCtx);
  assert.equal(adminResult.blockedCount, 0);
  assert.equal(adminResult.layout.name, 'Hijacked Region');
});

test('getActiveAuthoritySession returns a cached referentially-stable snapshot for useSyncExternalStore', () => {
  setActiveAuthoritySession('local-offline');
  const first = getActiveAuthoritySession();
  const second = getActiveAuthoritySession();
  assert.strictEqual(first, second, 'Repeated reads without state change must return identical reference');
  assert.equal(first.mode, 'local-offline');
  assert.equal(first.serverRole, undefined);

  setActiveAuthoritySession('server-authoritative', 'admin');
  const third = getActiveAuthoritySession();
  const fourth = getActiveAuthoritySession();
  assert.notStrictEqual(third, first, 'State change produces a new frozen snapshot');
  assert.strictEqual(third, fourth, 'Subsequent reads stay cached');
  assert.equal(third.mode, 'server-authoritative');
  assert.equal(third.serverRole, 'admin');

  // Restore default local-offline state
  setActiveAuthoritySession('local-offline');
});
