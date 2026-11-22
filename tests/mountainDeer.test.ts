import assert from 'node:assert/strict';
import test from 'node:test';
import { toWorld, ward } from '../src/data/ward.ts';
import { getAssetDefinition } from '../src/game/assetRegistry.ts';
import { canStand } from '../src/game/collision.ts';
import {
  disposeMountainDeerAssetCache,
  getMountainDeerAssetCache,
  getMountainDeerAssetCacheStats,
} from '../src/game/mountainDeerAssets.ts';
import {
  MountainDeerFixedPool,
  buildMountainDeerSpawns,
  type MountainDeerZone,
} from '../src/game/mountainDeerPool.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Mountain deer herds scatter randomly across all 4 mountain zones on clear elevated meadows', () => {
  const spawns = buildMountainDeerSpawns(allPeaks);
  assert.ok(spawns.length >= 160, `Expected 160+ wild mountain deer (got ${spawns.length})`);
  assert.ok(spawns.some((s) => s.hasAntlers), 'Herds include antlered stags');
  assert.ok(spawns.some((s) => !s.hasAntlers), 'Herds include does and fawns');

  const zones: MountainDeerZone[] = [
    'taungphila',
    'highland-plateau',
    'western-spine',
    'maha-weipula',
  ];
  for (const zone of zones) {
    const inZone = spawns.filter((s) => s.zone === zone);
    assert.ok(inZone.length >= 24, `Zone ${zone} has 24+ random deer (got ${inZone.length})`);
  }

  for (const sp of spawns) {
    assert.ok(sp.homeY >= 8, `${sp.id} stands on elevated mountain terrain (y=${sp.homeY.toFixed(1)}m)`);
    assert.equal(canStand(sp.homeX, sp.homeZ), true, `${sp.id} stands on clear walkable meadow`);
  }

  const def = getAssetDefinition('nature:mountain-deer');
  assert.ok(def && def.nameMm.includes('သမင်'));
});

test('MountainDeerAssetCache is a strict Singleton and MountainDeerFixedPool animates & recycles bounded slots', () => {
  const a = getMountainDeerAssetCache();
  const b = getMountainDeerAssetCache();
  assert.strictEqual(a, b, 'Strict Singleton reference cache (zero duplication)');
  assert.equal(getMountainDeerAssetCacheStats().initialized, true);

  const spawns = buildMountainDeerSpawns(allPeaks);
  const pool = new MountainDeerFixedPool(spawns, { capacity: 20, syncMoveThreshold: 14 });

  const north = toWorld(-845, 220);
  assert.equal(pool.syncToFocus(north.x, north.z, true), true);
  assert.equal(pool.metrics().activeCount, 20, 'Bounded strictly at 20 fixed GPU slots');

  // Step grazing/walking animations for 2 seconds
  for (let i = 0; i < 40; i++) {
    pool.step(0.05, north.x, north.z, allPeaks);
  }
  assert.equal(pool.metrics().activeCount, 20);

  // Move camera 4.3 km south to Maha Weipula -> recycles fixed slots cleanly!
  const south = toWorld(-1560, 4800);
  pool.step(0.05, south.x, south.z, allPeaks);
  assert.equal(pool.metrics().activeCount, 20);
  assert.ok(pool.metrics().totalRecycles > 0, 'Distant deer slots recycled cleanly in O(1)');

  pool.disposePool();
  assert.equal(pool.metrics().activeCount, 0);
  disposeMountainDeerAssetCache();
});
