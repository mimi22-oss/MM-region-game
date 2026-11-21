import test from 'node:test';
import assert from 'node:assert/strict';
import { ward, toWorld } from '../src/data/ward.ts';
import {
  FixedObjectPool,
  MountainForestFixedPool,
  disposeTreeAssetCache,
  getTreeAssetCache,
  getTreeAssetCacheStats,
} from '../src/game/treeResourcePool.ts';
import {
  MAHA_WEIPULA_BASE_GATE_UV,
  MAHA_WEIPULA_SUMMIT_UV,
  buildWeipulaSlopeFlora,
} from '../src/game/weipulaClimb.ts';

test('TreeAssetCache is a strict Singleton memory reference cache (zero duplicate GPU geometries/materials)', () => {
  const first = getTreeAssetCache();
  const second = getTreeAssetCache();
  assert.strictEqual(first, second, 'Singleton cache returns the exact same object reference');
  assert.strictEqual(first.largeTrunkGeo, second.largeTrunkGeo, 'Village trunk geometry is shared by reference');
  assert.strictEqual(first.mountainPineLowGeo, second.mountainPineLowGeo, 'Mountain pine geometry is shared by reference');
  assert.strictEqual(first.mountainFoliageInstancedMat, second.mountainFoliageInstancedMat, 'Materials are shared by reference');
  const stats = getTreeAssetCacheStats();
  assert.equal(stats.initialized, true);
  assert.equal(stats.geometryCount, 15);
  assert.equal(stats.materialCount, 13);
});

test('FixedObjectPool enforces strict capacity ceiling and recycles slots without growing', () => {
  let factoryCalls = 0;
  const pool = new FixedObjectPool<{ slotTag: number }>(4, i => {
    factoryCalls += 1;
    return { slotTag: i };
  });
  assert.equal(factoryCalls, 4, 'Exactly capacity slots pre-allocated once');

  // Fill pool to capacity
  const s0 = pool.acquire('tree-0');
  const s1 = pool.acquire('tree-1');
  const s2 = pool.acquire('tree-2');
  const s3 = pool.acquire('tree-3');
  assert.ok(s0 && s1 && s2 && s3);
  assert.equal(pool.activeCount, 4);
  assert.equal(pool.freeCount, 0);

  // Beyond capacity returns null (never allocates or duplicates beyond fixed pool size)
  assert.equal(pool.acquire('tree-overflow'), null);
  assert.equal(factoryCalls, 4, 'Zero extra allocations after initialization');

  // Sync to a new set of visible trees: releases old slots & recycles exact same pre-allocated slots
  const assignedSlots: number[] = [];
  const res = pool.syncActive(
    ['tree-2', 'tree-3', 'tree-4', 'tree-5', 'tree-6'],
    slot => assignedSlots.push(slot.index),
  );
  assert.equal(res.released, 2, 'Two out-of-range trees released');
  assert.equal(res.assigned, 2, 'Two newly visible trees acquired recycled slots');
  assert.equal(pool.activeCount, 4, 'Active count stays strictly bounded at capacity');
  assert.equal(factoryCalls, 4, 'Still zero additional allocations during recycling');
  assert.ok(pool.metrics().totalRecycles >= 2, 'Slot recycling tracked accurately');
});

test('MountainForestFixedPool shares singleton cache references and recycles fixed slots as camera moves', () => {
  const peaks = [...ward.mountains, ...ward.weipula.peaks];
  const { trees, grassTufts } = buildWeipulaSlopeFlora(peaks, false);
  const cache = getTreeAssetCache();

  // Fixed pool much smaller than total world flora count (1,000+ trees -> bounded fixed GPU slots)
  const pool = new MountainForestFixedPool(trees, grassTufts, {
    pineCapacity: 120,
    broadCapacity: 80,
    grassCapacity: 100,
    syncMoveThreshold: 25,
  });

  // Verify every InstancedMesh binds directly to the Singleton Cache geometry & material references
  assert.strictEqual(pool.pineTrunkMesh.geometry, cache.mountainTrunkGeo);
  assert.strictEqual(pool.pineTrunkMesh.material, cache.mountainBarkMat);
  assert.strictEqual(pool.pineLowMesh.geometry, cache.mountainPineLowGeo);
  assert.strictEqual(pool.pineLowMesh.material, cache.mountainFoliageInstancedMat);
  assert.strictEqual(pool.broadCanopyMesh.geometry, cache.mountainBroadCanopyGeo);
  assert.strictEqual(pool.grassMesh.geometry, cache.mountainGrassTuftGeo);

  // Initial sync at mountain base
  const baseWorld = toWorld(MAHA_WEIPULA_BASE_GATE_UV.u, MAHA_WEIPULA_BASE_GATE_UV.v);
  assert.equal(pool.syncToFocus(baseWorld.x, baseWorld.z, true), true);
  const mBase = pool.metrics();
  assert.equal(mBase.totalFixedSlots, 300, 'Pool has strictly 300 fixed pre-allocated slots');
  assert.equal(mBase.totalActiveSlots, 300, 'All 300 fixed slots active without exceeding capacity');

  // Tiny camera jitter (< 25m) skips work completely (0ms idle cost)
  assert.equal(pool.syncToFocus(baseWorld.x + 5, baseWorld.z + 5), false);

  // Moving to the 1,320m summit recycles distant base slots for summit trees with zero growth
  const summitWorld = toWorld(MAHA_WEIPULA_SUMMIT_UV.u, MAHA_WEIPULA_SUMMIT_UV.v);
  assert.equal(pool.syncToFocus(summitWorld.x, summitWorld.z), true);
  const mSummit = pool.metrics();
  assert.equal(mSummit.totalFixedSlots, 300, 'Fixed slot capacity never grows');
  assert.ok(mSummit.pines.totalRecycles > 0, 'Pine pool recycled slots when moving from base to summit');
  assert.ok(mSummit.broads.totalRecycles > 0, 'Broadleaf pool recycled slots when moving from base to summit');
  assert.ok(mSummit.grass.totalRecycles > 0, 'Grass pool recycled slots when moving from base to summit');

  // Disposing pool releases instance buffers without destroying the shared Singleton Cache
  pool.disposePool();
  assert.strictEqual(getTreeAssetCache(), cache, 'Singleton cache remains alive & shared after pool unmount');
  disposeTreeAssetCache();
  assert.equal(getTreeAssetCacheStats().initialized, false, 'Explicit cache teardown disposes cleanly');
});
