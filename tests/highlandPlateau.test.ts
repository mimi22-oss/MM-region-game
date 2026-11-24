import assert from 'node:assert/strict';
import test from 'node:test';
import { angle, toWorld, ward } from '../src/data/ward.ts';
import { getChinHouseAssetCache } from '../src/game/chinHouseAssets.ts';
import { canStand, treeBlocks } from '../src/game/collision.ts';
import {
  disposeHighlandPlateauAssetCache,
  getHighlandPlateauAssetCache,
  getHighlandPlateauAssetCacheStats,
} from '../src/game/highlandPlateauAssets.ts';
import { HighlandPlateauFixedPool } from '../src/game/highlandPlateauPool.ts';
import {
  HIGHLAND_HOUSE_FLOOR_HEIGHT,
  canStandHighlandPlateau,
  getHighlandPlateauCatalog,
  highlandPlateauSurfaceHeight,
  highlandTreeBlocks,
} from '../src/game/highlandPlateauWorld.ts';
import {
  clearWildlifeActors,
  computeWildlifeAvoidance,
  isWildlifeStepClear,
  upsertWildlifeActor,
} from '../src/game/mountainWildlifeAvoidance.ts';
import { horseFootprintClear } from '../src/game/horseRide.ts';
import { getMonasteryBuildingAssetCache } from '../src/game/monasteryAssets.ts';
import { rideFootprintClear } from '../src/game/motorcycleRide.ts';
import { mountainHeight, mountainMeshSurface } from '../src/game/mountainTerrain.ts';
import { buildTaungphilaSlopeFlora } from '../src/game/taungphilaWorld.ts';
import { buildWeipulaSlopeFlora } from '../src/game/weipulaClimb.ts';
import { getTreeAssetCache } from '../src/game/treeResourcePool.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Mountains have wide flat walkable highland plateaus (not pointy cones)', () => {
  // Check broad highland tableland mesas (`u ≈ -980`, `v = 220..4345`) are flat & level across 100m+
  for (const v of [220, 970, 2095, 3595]) {
    const hCenter = mountainHeight(-980, v, allPeaks);
    const hEast = mountainHeight(-900, v, allPeaks);
    const hWest = mountainHeight(-1060, v, allPeaks);
    const hNorth = mountainHeight(-980, v - 80, allPeaks);
    const hSouth = mountainHeight(-980, v + 80, allPeaks);

    assert.ok(hCenter >= 120, `Highland plateau at v=${v} is genuinely elevated (h=${hCenter.toFixed(1)}m)`);
    assert.ok(Math.abs(hEast - hCenter) < 1.5, `Plateau is flat eastward at v=${v}`);
    assert.ok(Math.abs(hWest - hCenter) < 1.5, `Plateau is flat westward at v=${v}`);
    assert.ok(Math.abs(hNorth - hCenter) < 1.5, `Plateau is flat northward at v=${v}`);
    assert.ok(Math.abs(hSouth - hCenter) < 1.5, `Plateau is flat southward at v=${v}`);
  }

  // Taungphila Mountain crowns are also broad flat meadows (not narrow spikes!)
  const tpCenter = mountainHeight(-630, 220, allPeaks);
  const tpOffset = mountainHeight(-605, 220, allPeaks);
  assert.ok(tpCenter >= 150);
  assert.ok(Math.abs(tpOffset - tpCenter) < 1.0, 'Taungphila summit plateau stays flat 25m out from crown');
});

test('Highland Plateau catalog scales to 100+ villages/camps and thousands of trees, bushes & boulders', () => {
  const catalog = getHighlandPlateauCatalog();

  assert.ok(catalog.settlements.length >= 100, `Supports 100+ highland settlements (got ${catalog.settlements.length})`);
  assert.ok(catalog.camps.length >= 15, `Includes rich base camps with tents, campfires & logs (got ${catalog.camps.length})`);
  assert.ok(catalog.houses.length >= 400, `Includes hundreds of highland village houses (got ${catalog.houses.length})`);
  assert.ok(catalog.ponds.length >= 40, `Includes dozens of highland ponds/lakes (got ${catalog.ponds.length})`);
  assert.ok(catalog.trees.length >= 4000, `Includes thousands of highland trees (got ${catalog.trees.length})`);
  assert.ok(catalog.bushes.length >= 3000, `Includes thousands of lush meadow bushes (got ${catalog.bushes.length})`);
  assert.ok(catalog.boulders.length >= 2000, `Includes thousands of boulders/quarry stones (got ${catalog.boulders.length})`);

  // Every settlement hub clearing is walkable on foot, on horse, AND by motorcycle!
  for (const s of catalog.settlements.slice(0, 25)) {
    assert.equal(canStand(s.x, s.z), true, `${s.id} central hub is walkable on foot`);
    assert.equal(
      horseFootprintClear(s.x, s.z, 0, (x, z) => canStand(x, z)),
      true,
      `${s.id} central hub is horse-rideable`,
    );
    assert.equal(
      rideFootprintClear(s.x, s.z, 0, (x, z) => canStand(x, z)),
      true,
      `${s.id} central hub is motorcycle-rideable`,
    );
  }

  // Walk-in Highland houses: open front doorway & interior are walkable with level timber floor, while perimeter walls block!
  const sampleHouse = catalog.houses[0];
  const hc = Math.cos(sampleHouse.rotation);
  const hs = Math.sin(sampleHouse.rotation);
  const houseWorld = (lx: number, lz: number) => ({
    x: sampleHouse.x + lx * hc + lz * hs,
    z: sampleHouse.z - lx * hs + lz * hc,
  });
  const doorway = houseWorld(0, sampleHouse.depth * 0.5);
  const backWall = houseWorld(0, -sampleHouse.depth * 0.5);
  assert.equal(canStandHighlandPlateau(sampleHouse.x, sampleHouse.z), true, 'Walk-in highland house interior is walkable');
  assert.equal(canStandHighlandPlateau(doorway.x, doorway.z), true, 'Highland house open front doorway is walkable');
  assert.equal(canStandHighlandPlateau(backWall.x, backWall.z), false, 'Highland house perimeter back wall blocks walking');
  const floorY = highlandPlateauSurfaceHeight(sampleHouse.x, sampleHouse.z);
  assert.ok(
    floorY !== null && Math.abs(floorY - (sampleHouse.y + HIGHLAND_HOUSE_FLOOR_HEIGHT)) < 0.05,
    'Highland house supplies level walkable floor height',
  );

  // Climbable mountain boulders: walkable AND lift surface height above ground!
  const sampleBoulder = catalog.boulders.find((b) => b.solidRadius > 0) ?? catalog.boulders[0];
  assert.equal(canStandHighlandPlateau(sampleBoulder.x, sampleBoulder.z), true, 'Mountain boulders are climbable (walkable)');
  const boulderTopY = highlandPlateauSurfaceHeight(sampleBoulder.x, sampleBoulder.z);
  assert.ok(
    boulderTopY !== null && boulderTopY > sampleBoulder.y,
    'Climbing onto boulder raises walkable surface height smoothly',
  );

  // Highland trees block trunks via `treeBlocks` so bumping into mountain trees triggers backward recoil!
  const sampleTree = catalog.trees[0];
  assert.equal(highlandTreeBlocks(sampleTree.x, sampleTree.z), true, 'Mountain tree trunk blocks in highlandTreeBlocks');
  assert.equal(treeBlocks(sampleTree.x, sampleTree.z), true, 'Mountain tree trunk integrates with global treeBlocks for recoil');

  // Wildlife avoidance: deer, rabbits & tigers steer around each other and never overlap!
  try {
    clearWildlifeActors();
    upsertWildlifeActor('deer-a', 'deer', 100, 100, 1.0);
    upsertWildlifeActor('rabbit-a', 'rabbit', 101.2, 100, 0.5);
    upsertWildlifeActor('tiger-a', 'tiger', 100, 101.6, 1.2);
    assert.equal(
      isWildlifeStepClear('deer-a', 101.0, 100, 1.0, 200, 200),
      false,
      'Deer cannot step through a rabbit',
    );
    assert.equal(
      isWildlifeStepClear('tiger-a', 100, 100.5, 1.2, 200, 200),
      false,
      'Tiger cannot step through a deer',
    );
    const steer = computeWildlifeAvoidance('deer-a', 100, 100, 1.0, 200, 200, {
      steerX: 0,
      steerZ: 0,
      blocked: false,
    });
    assert.equal(steer.blocked, true, 'Crowded animal detects avoidance steer');
    assert.ok(steer.steerX < 0 && steer.steerZ < 0, 'Avoidance pushes cleanly away from neighbors');
  } finally {
    clearWildlifeActors();
  }

  const sampleCamp = catalog.camps[0];
  assert.equal(canStandHighlandPlateau(sampleCamp.x, sampleCamp.z), false, 'Camp tent core blocks walking');

  const samplePond = catalog.ponds[0];
  assert.equal(canStandHighlandPlateau(samplePond.x, samplePond.z, 0.4, false), false, 'Pond water blocks walking');
  assert.equal(canStandHighlandPlateau(samplePond.x, samplePond.z, 0.4, true), true, 'Airborne flight passes over ponds');
});

test('HighlandPlateauAssetCache is a strict Singleton reusing existing Tree, ChinHouse & Monastery caches with zero duplication', () => {
  const a = getHighlandPlateauAssetCache();
  const b = getHighlandPlateauAssetCache();
  assert.strictEqual(a, b, 'Exact same singleton reference returned across repeated calls');
  assert.strictEqual(a.chinHouseCache, getChinHouseAssetCache(), 'Reuses existing ChinHouseAssetCache by reference');
  assert.strictEqual(a.treeCache, getTreeAssetCache(), 'Reuses existing TreeAssetCache by reference');
  assert.strictEqual(a.monasteryCache, getMonasteryBuildingAssetCache(), 'Reuses existing MonasteryBuildingAssetCache by reference');
  assert.equal(getHighlandPlateauAssetCacheStats().initialized, true);
});

test('HighlandPlateauFixedPool strictly bounds GPU memory and recycles slots across 100+ villages without growing', () => {
  const catalog = getHighlandPlateauCatalog();
  const pool = new HighlandPlateauFixedPool(catalog, {
    houseCapacity: 40,
    campCapacity: 8,
    pondCapacity: 8,
    trailCapacity: 60,
    boulderCapacity: 80,
    bushCapacity: 90,
    syncMoveThreshold: 20,
  });

  // Focus on Northern Highland Plateau (near Taungphila)
  const north = toWorld(-980, 260);
  assert.equal(pool.syncToFocus(north.x, north.z, true), true);
  const m1 = pool.metrics();
  assert.equal(m1.houses.activeCount, 40, 'Bounded strictly at 40 house slots even with 450+ houses');
  assert.equal(m1.boulders.activeCount, 80, 'Bounded strictly at 80 boulder slots even with 2,200+ boulders');
  assert.equal(m1.bushes.activeCount, 90, 'Bounded strictly at 90 bush slots even with 3,200+ bushes');

  // Small jitter inside syncMoveThreshold does zero work
  assert.equal(pool.syncToFocus(north.x + 5, north.z + 5), false);

  // Jump 3.5 km south toward Maha Weipula Highland Plateau -> recycles existing fixed slots!
  const south = toWorld(-980, 3800);
  assert.equal(pool.syncToFocus(south.x, south.z), true);
  const m2 = pool.metrics();
  assert.equal(m2.houses.activeCount, 40, 'Active slots stay bounded at fixed capacity');
  assert.ok(m2.houses.totalRecycles > 0, 'Distant house slots were recycled cleanly in O(1)');
  assert.ok(m2.bushes.totalRecycles > 0, 'Distant bush slots were recycled cleanly in O(1)');

  // Disposing the pool releases instance buffers WITHOUT disposing shared Singleton caches
  pool.disposePool();
  assert.equal(pool.metrics().totalActiveSlots, 0);
  assert.strictEqual(getHighlandPlateauAssetCache().treeCache, getTreeAssetCache());
  disposeHighlandPlateauAssetCache();
});

test('Mountain slope trees and boulders anchor strictly into rendered mountain mesh with zero floating gap', () => {
  const catalog = getHighlandPlateauCatalog();
  const weipula = buildWeipulaSlopeFlora(allPeaks, false);
  const taungphila = buildTaungphilaSlopeFlora(allPeaks, false);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (const t of [...catalog.trees, ...weipula.trees, ...taungphila.trees]) {
    const surf = mountainMeshSurface(t.u, t.v, allPeaks);
    const downhillRootY = surf.y - surf.slope * 1.72 * t.scale;
    assert.ok(
      t.y <= downhillRootY + 0.05,
      `Tree ${t.id} base (${t.y.toFixed(2)}m) anchors into downhill slope (${downhillRootY.toFixed(2)}m, slope=${surf.slope.toFixed(2)})`,
    );
  }

  for (const b of catalog.boulders) {
    const bu = b.x * cosA - b.z * sinA;
    const bv = b.x * sinA + b.z * cosA;
    const surf = mountainMeshSurface(bu, bv, allPeaks);
    const boulderBottomY = b.y - b.sy;
    const downhillEdgeY = surf.y - Math.max(b.sx, b.sz) * surf.slope;
    assert.ok(
      boulderBottomY <= downhillEdgeY + 0.05,
      `Boulder ${b.id} bottom (${boulderBottomY.toFixed(2)}m) anchors below downhill slope (${downhillEdgeY.toFixed(2)}m, slope=${surf.slope.toFixed(2)})`,
    );
  }
});
