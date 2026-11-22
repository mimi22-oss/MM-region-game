import assert from 'node:assert/strict';
import test from 'node:test';
import { toWorld, ward } from '../src/data/ward.ts';
import { getAssetDefinition } from '../src/game/assetRegistry.ts';
import { canStand } from '../src/game/collision.ts';
import { buildMountainDeerSpawns } from '../src/game/mountainDeerPool.ts';
import { buildMountainRabbitSpawns } from '../src/game/mountainRabbitPool.ts';
import {
  disposeMountainTigerAssetCache,
  getMountainTigerAssetCache,
  getMountainTigerAssetCacheStats,
} from '../src/game/mountainTigerAssets.ts';
import {
  MountainTigerFixedPool,
  TIGER_PAIR_MAX_DIST_M,
  TIGER_PAIR_MIN_DIST_M,
  TIGER_PREY_MIN_SEPARATION_M,
  buildMountainTigerSpawns,
} from '../src/game/mountainTigerPool.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Mountain tigers spawn as both 2-tiger pairs and 1-tiger solitary territories strictly FAR from rabbits and deer', () => {
  const rabbits = buildMountainRabbitSpawns(allPeaks);
  const deer = buildMountainDeerSpawns(allPeaks);
  const tigers = buildMountainTigerSpawns(allPeaks, rabbits, deer);

  assert.ok(tigers.length >= 24, `Expected 24+ wild mountain tigers (got ${tigers.length})`);

  // Group by territoryId -> verify BOTH pairs (count === 2) AND solitary (count === 1) exist!
  const byTerritory = new Map<string, typeof tigers>();
  for (const t of tigers) {
    const arr = byTerritory.get(t.territoryId) ?? [];
    arr.push(t);
    byTerritory.set(t.territoryId, arr);
  }
  const pairTerritories = [...byTerritory.values()].filter((g) => g.length === 2);
  const soloTerritories = [...byTerritory.values()].filter((g) => g.length === 1);
  assert.ok(pairTerritories.length >= 6, `Multiple 2-tiger paired territories exist (got ${pairTerritories.length})`);
  assert.ok(soloTerritories.length >= 6, `Multiple 1-tiger solitary territories exist (got ${soloTerritories.length})`);

  assert.equal(TIGER_PREY_MIN_SEPARATION_M, 20);
  assert.equal(TIGER_PAIR_MIN_DIST_M, 3.5);
  assert.equal(TIGER_PAIR_MAX_DIST_M, 5.0);

  // Verify every pair sits strictly within 3.5m..5.0m
  for (const [a, b] of pairTerritories) {
    const d = Math.hypot(a.homeX - b.homeX, a.homeZ - b.homeZ);
    assert.ok(
      d >= TIGER_PAIR_MIN_DIST_M - 0.01 && d <= TIGER_PAIR_MAX_DIST_M + 0.01,
      `Paired tigers stay within 3.5–5.0m in same territory (dist=${d.toFixed(2)}m)`,
    );
  }

  // CRITICAL: Every single tiger MUST be strictly >= 20m away from EVERY rabbit AND EVERY deer!
  for (const t of tigers) {
    assert.ok(t.homeY >= 14, `${t.id} stands on elevated secluded mountain terrain`);
    assert.equal(canStand(t.homeX, t.homeZ), true, `${t.id} stands on clear walkable terrain`);

    for (const r of rabbits) {
      const d = Math.hypot(t.homeX - r.homeX, t.homeZ - r.homeZ);
      assert.ok(
        d >= TIGER_PREY_MIN_SEPARATION_M - 0.01,
        `${t.id} must stay >= ${TIGER_PREY_MIN_SEPARATION_M}m away from rabbit ${r.id} (got ${d.toFixed(1)}m)`,
      );
    }
    for (const dr of deer) {
      const d = Math.hypot(t.homeX - dr.homeX, t.homeZ - dr.homeZ);
      assert.ok(
        d >= TIGER_PREY_MIN_SEPARATION_M - 0.01,
        `${t.id} must stay >= ${TIGER_PREY_MIN_SEPARATION_M}m away from deer ${dr.id} (got ${d.toFixed(1)}m)`,
      );
    }
  }

  const def = getAssetDefinition('nature:mountain-tiger');
  assert.ok(def && def.nameMm.includes('ကျား'));
});

test('MountainTigerAssetCache is a strict Singleton and MountainTigerFixedPool animates & recycles bounded slots', () => {
  const a = getMountainTigerAssetCache();
  const b = getMountainTigerAssetCache();
  assert.strictEqual(a, b, 'Strict Singleton reference cache (zero duplication)');
  assert.equal(getMountainTigerAssetCacheStats().initialized, true);

  const tigers = buildMountainTigerSpawns(allPeaks);
  const pool = new MountainTigerFixedPool(tigers, { capacity: 12, syncMoveThreshold: 16 });

  const westAlpine = toWorld(-2680, 6200);
  assert.equal(pool.syncToFocus(westAlpine.x, westAlpine.z, true), true);
  assert.equal(pool.metrics().activeCount, 12, 'Bounded strictly at 12 fixed GPU slots');

  for (let i = 0; i < 40; i++) {
    pool.step(0.05, westAlpine.x, westAlpine.z, allPeaks);
  }
  assert.equal(pool.metrics().activeCount, 12);

  // Move camera to East Chin Range -> recycles fixed slots in O(1)!
  const eastRange = toWorld(1100, 5300);
  pool.step(0.05, eastRange.x, eastRange.z, allPeaks);
  assert.equal(pool.metrics().activeCount, 12);
  assert.ok(pool.metrics().totalRecycles > 0, 'Distant tiger slots recycled cleanly in O(1)');

  pool.disposePool();
  assert.equal(pool.metrics().activeCount, 0);
  disposeMountainTigerAssetCache();
});
