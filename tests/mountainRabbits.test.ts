import assert from 'node:assert/strict';
import test from 'node:test';
import { toWorld, ward } from '../src/data/ward.ts';
import { getAssetDefinition } from '../src/game/assetRegistry.ts';
import { canStand } from '../src/game/collision.ts';
import {
  disposeMountainRabbitAssetCache,
  getMountainRabbitAssetCache,
  getMountainRabbitAssetCacheStats,
} from '../src/game/mountainRabbitAssets.ts';
import {
  MountainRabbitFixedPool,
  buildMountainRabbitSpawns,
  type MountainRabbitZone,
} from '../src/game/mountainRabbitPool.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Mountain rabbits scatter randomly across all 4 mountain zones on clear elevated meadows', () => {
  const spawns = buildMountainRabbitSpawns(allPeaks);
  assert.ok(spawns.length >= 250, `Expected 250+ wild mountain rabbits (got ${spawns.length})`);

  const zones: MountainRabbitZone[] = [
    'taungphila',
    'highland-plateau',
    'western-spine',
    'maha-weipula',
  ];
  for (const zone of zones) {
    const inZone = spawns.filter((s) => s.zone === zone);
    assert.ok(inZone.length >= 30, `Zone ${zone} has 30+ random rabbits (got ${inZone.length})`);
  }

  // Every rabbit sits on elevated walkable terrain clear of buildings, roads, and water
  for (const sp of spawns) {
    assert.ok(sp.homeY >= 6, `${sp.id} stands on elevated mountain terrain (y=${sp.homeY.toFixed(1)}m)`);
    assert.equal(canStand(sp.homeX, sp.homeZ), true, `${sp.id} stands on clear walkable meadow`);
  }

  // Also registered in 3D Asset Registry for /map?tool=editor Drag & Drop
  const def = getAssetDefinition('nature:mountain-rabbit');
  assert.ok(def && def.nameMm.includes('ယုန်'));
});

test('MountainRabbitAssetCache is a strict Singleton and MountainRabbitFixedPool animates & recycles bounded slots', () => {
  const a = getMountainRabbitAssetCache();
  const b = getMountainRabbitAssetCache();
  assert.strictEqual(a, b, 'Strict Singleton reference cache (zero duplication)');
  assert.equal(getMountainRabbitAssetCacheStats().initialized, true);

  const spawns = buildMountainRabbitSpawns(allPeaks);
  const pool = new MountainRabbitFixedPool(spawns, { capacity: 24, syncMoveThreshold: 12 });

  const north = toWorld(-580, 240);
  assert.equal(pool.syncToFocus(north.x, north.z, true), true);
  assert.equal(pool.metrics().activeCount, 24, 'Bounded strictly at 24 fixed GPU slots');

  // Step live hopping animation for 2 seconds
  for (let i = 0; i < 40; i++) {
    pool.step(0.05, north.x, north.z, allPeaks);
  }
  assert.equal(pool.metrics().activeCount, 24);

  // Move camera 4.3 km south to Maha Weipula foothills -> recycles fixed slots cleanly!
  const south = toWorld(-1560, 4800);
  pool.step(0.05, south.x, south.z, allPeaks);
  assert.equal(pool.metrics().activeCount, 24);
  assert.ok(pool.metrics().totalRecycles > 0, 'Distant rabbit slots recycled cleanly in O(1)');

  pool.disposePool();
  assert.equal(pool.metrics().activeCount, 0);
  disposeMountainRabbitAssetCache();
});
