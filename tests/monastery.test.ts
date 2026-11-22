import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStand, move } from '../src/game/collision.ts';
import { Mesh, Scene } from 'three';
import { ward } from '../src/data/ward.ts';
import {
  MYOTHAR_MONASTERY_BUILDINGS,
  MYOTHAR_MONASTERY_STUPAS,
  computeMonasteryBuildingLayout,
  registerMonasteryBuilding,
  unregisterMonasteryBuilding,
} from '../src/game/monasteryLayout.ts';
import { getPagodaShrines, PAGODA_APRON, PAGODA_OUTLINE } from '../src/game/pagodaLayout.ts';
import { getPagodaAssets, getPagodaAnimalGeometry, getPagodaShrineAssets } from '../src/game/pagodaAssets.ts';
import { registerGroundRegion, releaseGroundRegion, sceneGround } from '../src/game/groundSurface.ts';
import {
  getMonasteryBuildingAssetCache,
  disposeMonasteryBuildingAssetCache,
} from '../src/game/monasteryAssets.ts';
import { getMonkAssetCache, disposeMonkAssetCache } from '../src/game/monkAssets.ts';
import { getWeipulaVillagerCache } from '../src/game/weipulaVillagers.ts';
import {
  MONK_POOL_DESKTOP,
  MONK_POOL_MOBILE,
  MYOTHAR_MONASTERY_MONK_ZONE,
  MonkFixedPoolController,
} from '../src/game/monkPool.ts';
import { isProtectedFromFighting, formatBotTargetLabel } from '../src/game/botFighting.ts';
import {
  BURMESE_TOMB_PALETTES,
  disposeCemeteryTombAssetCache,
  getCemeteryTombAssetCache,
} from '../src/game/cemeteryTombAssets.ts';
import { detectLocation } from '../src/game/locationDetect.ts';
import {
  cemeteryToWorld, getCemeteryGrave, MYOTHAR_CEMETERY_LAYOUT, CEMETERY_ROW_SPACING, TOMB_LENGTH, TOMB_WIDTH,
} from '../src/game/cemeteryLayout.ts';

function toBuildingWorld(
  b: { x: number; z: number; rotation: number },
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(b.rotation);
  const s = Math.sin(b.rotation);
  return {
    x: b.x + lx * c + lz * s,
    z: b.z - lx * s + lz * c,
  };
}

test('The three pagodas match the scene coordinates and only the largest has eight weekday shrines', () => {
  const placements = MYOTHAR_MONASTERY_STUPAS;
  assert.deepEqual(placements.map(p => [p.x, p.z]), [
    [213.979, -112.147], [209.222, -128.463], [197.862, -123.834],
  ]);
  assert.ok(placements[0].radius > placements[1].radius && placements[1].radius > placements[2].radius);
  for (const p of placements) {
    const projected = toBuildingWorld(ward.monastery, p.u, p.v);
    assert.ok(Math.hypot(projected.x - p.x, projected.z - p.z) < .001);
    assert.equal(canStand(p.x, p.z), false, 'the solid pagoda cannot be walked through');
    for (const { x, z } of PAGODA_OUTLINE) {
      const corner = toBuildingWorld({ ...p, rotation: p.yaw }, x * p.radius * .99, z * p.radius * .99);
      assert.equal(canStand(corner.x, corner.z), false, 'collision includes the octagonal corners');
    }
  }
  const corners = getPagodaShrines(placements[0], ward.monastery.rotation);
  assert.equal(new Set(corners.map(p => p.id)).size, 8);
  const shrine = getPagodaShrineAssets();
  assert.strictEqual(shrine, getPagodaShrineAssets());
  assert.ok(shrine.statue.getAttribute('position').count > 0);
  for (const p of placements.slice(1)) assert.equal(getPagodaShrines(p).length, 0);
  for (const p of corners) {
    assert.equal(canStand(p.x, p.z), false, 'shrine pedestal blocks movement');
    const outside = toBuildingWorld({ ...p, rotation: p.yaw }, 0, 1.4);
    assert.equal(canStand(outside.x, outside.z), true, `${p.id} shrine has a clear approach`);
    assert.ok(getPagodaAnimalGeometry(p.figure).getAttribute('position').count > 0);
  }
  const main = placements[0];
  for (let step = 0; step < 64; step++) {
    const heading = step / 64 * Math.PI * 2, distance = main.radius + 1.04;
    assert.ok(canStand(main.x + Math.cos(heading) * distance, main.z + Math.sin(heading) * distance), 'continuous path around the main pagoda');
  }
});

test('The shared stupa apron supplies ground while the region is resident', () => {
  const a = getPagodaAssets();
  assert.strictEqual(a, getPagodaAssets());
  const scene = new Scene();
  const p = MYOTHAR_MONASTERY_STUPAS[0];
  const apron = new Mesh(a.apron, a.terrace);
  const thickness = p.radius * PAGODA_APRON.thickness, radius = p.radius * PAGODA_APRON.shrineRadius;
  apron.position.set(p.x, PAGODA_APRON.baseY, p.z);
  apron.scale.set(radius, thickness, radius);
  apron.userData.walkable = true;
  registerGroundRegion(scene, 'pagoda-test', apron);
  const ground = sceneGround(scene, 1);
  assert.ok(Math.abs(ground.height(p.x + 6, p.z) - (PAGODA_APRON.baseY + thickness)) < .0001);
  releaseGroundRegion(scene, 'pagoda-test');
  assert.equal(ground.height(p.x + 6, p.z), 0);
});

test('All 4 Myothar monastery buildings are walk-in with interior staircases and valid 2F stairwell cutouts', () => {
  assert.equal(MYOTHAR_MONASTERY_BUILDINGS.length, 4);
  const kinds = new Set(MYOTHAR_MONASTERY_BUILDINGS.map((b) => b.kind));
  assert.deepEqual(kinds, new Set(['mandap', 'dhamma', 'quarters', 'refectory']));

  for (const b of MYOTHAR_MONASTERY_BUILDINGS) {
    const layout = computeMonasteryBuildingLayout(b);

    // 1. Step rise stays strictly below Player.tsx 0.5m step limit & 2nd floor stays > 1.15m above 1st floor
    assert.ok(layout.stair.stepRise > 0.12 && layout.stair.stepRise < 0.35, `${b.id} stair stepRise valid`);
    assert.ok(layout.floor2Y - layout.floor1Y > 2.5, `${b.id} 2F ceiling clears 1.15m ray ceiling`);

    // 2. Front doorway, interior floor, stair bottom landing, stair mid, and stair top landing are walkable
    const frontOutside = toBuildingWorld(b, layout.frontEntryPoint.x, layout.frontEntryPoint.z - 1.6);
    const frontDoor = toBuildingWorld(b, layout.frontEntryPoint.x, layout.frontEntryPoint.z);
    const interior = toBuildingWorld(b, layout.interiorCenterPoint.x, layout.interiorCenterPoint.z);
    const stairBot = toBuildingWorld(b, layout.stair.bottomLanding.x, layout.stair.bottomLanding.z);
    const stairMid = toBuildingWorld(
      b,
      (layout.stair.minX + layout.stair.maxX) / 2,
      (layout.stair.minZ + layout.stair.maxZ) / 2,
    );
    const stairTop = toBuildingWorld(b, layout.stair.topLanding.x, layout.stair.topLanding.z);

    assert.ok(canStand(frontOutside.x, frontOutside.z), `${b.id} front outside walkable`);
    assert.ok(canStand(frontDoor.x, frontDoor.z), `${b.id} front doorway walkable`);
    assert.ok(canStand(interior.x, interior.z), `${b.id} interior walkable`);
    assert.ok(canStand(stairBot.x, stairBot.z), `${b.id} stair bottom landing walkable`);
    assert.ok(canStand(stairMid.x, stairMid.z), `${b.id} stair flight walkable`);
    assert.ok(canStand(stairTop.x, stairTop.z), `${b.id} stair top landing walkable`);

    // 3. Player can walk straight through the front doorway into the interior
    const walker = { ...frontOutside };
    const insideTarget = toBuildingWorld(b, layout.frontEntryPoint.x, layout.frontEntryPoint.z + 1.8);
    move(walker, insideTarget.x - frontOutside.x, insideTarget.z - frontOutside.z);
    assert.ok(Math.hypot(walker.x - insideTarget.x, walker.z - insideTarget.z) < 0.25, `${b.id} walk-in entry works`);

    // 4. Outer rear wall still blocks walking cleanly
    const rearWall = toBuildingWorld(b, layout.wallW * 0.35, layout.wallD / 2);
    assert.equal(canStand(rearWall.x, rearWall.z), false, `${b.id} rear exterior wall blocks`);

    // 5. 2nd floor slabs leave an exact stairwell opening (never covering the stair center!)
    assert.ok(layout.upperFloorSlabs.length >= 2, `${b.id} has 2nd floor slabs`);
    const scx = (layout.stair.minX + layout.stair.maxX) / 2;
    const scz = (layout.stair.minZ + layout.stair.maxZ) / 2;
    for (const slab of layout.upperFloorSlabs) {
      const overlapsStairCenter = scx > slab.minX && scx < slab.maxX && scz > slab.minZ && scz < slab.maxZ;
      assert.equal(overlapsStairCenter, false, `${b.id} 2F slab must not cover stairwell opening`);
    }
  }
});

test('Refectory & Alms Supplies Storage sits at user coordinates (187.099, -55.179) with walkable dining & storage rooms', () => {
  const refectory = MYOTHAR_MONASTERY_BUILDINGS.find((b) => b.kind === 'refectory')!;
  assert.ok(refectory, 'Refectory building exists');

  // Exact user coordinate (Scene X=187.099, Z=-55.179 / Local U=171.317, V=93.282) is inside & walkable
  assert.ok(canStand(187.099, -55.179), 'User coordinate inside Refectory dining hall is walkable');

  // West wing Alms Supplies Storage room center is walkable & reachable through open archway
  const storageCenter = toBuildingWorld(refectory, -5.8, 0.0);
  const archway = toBuildingWorld(refectory, -3.0, 0.2);
  const storageRack = toBuildingWorld(refectory, -9.6, 0.0);
  assert.ok(canStand(archway.x, archway.z), 'Open archway between Dining Hall & Alms Storage is walkable');
  assert.ok(canStand(storageCenter.x, storageCenter.z), 'Alms Supplies Storage floor is walkable');
  assert.equal(canStand(storageRack.x, storageRack.z), false, 'Alms bowl shelving rack blocks walking');
});

test('Monastery buildings support reusable registration & clean unregistration for future regions', () => {
  const tempSpec = {
    id: 'test-reusable-dhamma',
    kind: 'dhamma' as const,
    name: 'စမ်းသပ်ဓမ္မာရုံ',
    subtitle: 'စမ်းသပ်ကျောင်း',
    x: -1400,
    z: 1400,
    u: 0,
    v: 0,
    width: 25,
    depth: 19,
    rotation: 0,
    roofColor: '#8f1f24',
  };
  registerMonasteryBuilding(tempSpec);
  try {
    // Rear wall at z = 1400 + 8.4 blocks while registered
    assert.equal(canStand(-1400 + 6, 1400 + 8.4), false);
    assert.ok(canStand(-1400, 1400 - 8.4), 'front doorway walkable');
  } finally {
    unregisterMonasteryBuilding(tempSpec.id);
  }
  assert.ok(canStand(-1400 + 6, 1400 + 8.4), 'collider cleanly released after unregister');
});

test('Monastery Building & Monk Singleton Memory Reference Caches never duplicate shared resources', () => {
  const b1 = getMonasteryBuildingAssetCache();
  const b2 = getMonasteryBuildingAssetCache();
  assert.strictEqual(b1, b2, 'Monastery building cache is a strict singleton');
  assert.equal(b1.unitBoxGeo.userData.shared, true);
  assert.equal(b1.crimsonRoofMat.userData.shared, true);
  assert.strictEqual(b1.getRoofFrustumGeo(0.76), b2.getRoofFrustumGeo(0.76), 'roof frustums cached by ratio');

  const m1 = getMonkAssetCache();
  const m2 = getMonkAssetCache();
  const base = getWeipulaVillagerCache();
  assert.strictEqual(m1, m2, 'Monk asset cache is a strict singleton');
  assert.strictEqual(m1.base, base, 'Monk cache reuses shared base human geometries without duplication');
  assert.equal(m1.maroonRobeMat.userData.shared, true);
  assert.equal(m1.almsBowlBodyGeo.userData.shared, true);

  disposeMonasteryBuildingAssetCache();
  disposeMonkAssetCache();
});

test('MonkFixedPoolController enforces bounded Fixed Object Pool, sticky slots, and fighting protection', () => {
  const desktopPool = new MonkFixedPoolController(MONK_POOL_DESKTOP, 220);
  const mobilePool = new MonkFixedPoolController(MONK_POOL_MOBILE, 160);
  assert.equal(desktopPool.slots.length, MONK_POOL_DESKTOP);
  assert.equal(mobilePool.slots.length, MONK_POOL_MOBILE);

  const originX = MYOTHAR_MONASTERY_MONK_ZONE.originX;
  const originZ = MYOTHAR_MONASTERY_MONK_ZONE.originZ;
  const activeDay = desktopPool.rebalance(originX, originZ, ['myothar'], 480, 'morning');
  assert.equal(activeDay, MYOTHAR_MONASTERY_MONK_ZONE.monks.length);
  assert.equal(desktopPool.slots.length, MONK_POOL_DESKTOP, 'pool never grows dynamically');

  // Verify sticky slot assignment & in-place movement step
  const firstSlotMap = new Map(
    desktopPool.slots.filter((s) => s.member).map((s) => [s.member!.id, s.slotIndex]),
  );
  desktopPool.step(0.05);
  desktopPool.rebalance(originX + 2, originZ + 2, ['myothar'], 485, 'morning');
  for (const slot of desktopPool.slots) {
    if (!slot.member) continue;
    assert.equal(slot.slotIndex, firstSlotMap.get(slot.member.id), 'active monk preserves exact sticky slot index');
    assert.ok(Number.isFinite(slot.member.x) && Number.isFinite(slot.member.y) && Number.isFinite(slot.member.z));
  }

  // Night mode rests outdoor courtyard walkers while keeping indoor monks active
  const activeNight = desktopPool.rebalance(originX, originZ, ['myothar'], 1380, 'night');
  assert.ok(activeNight > 0 && activeNight < activeDay, 'night mode filters outdoor walkers while keeping indoor monks');

  // Leaving region releases all slots cleanly
  const activeAway = desktopPool.rebalance(originX + 2000, originZ + 2000, ['tharsi'], 480, 'morning');
  assert.equal(activeAway, 0);

  // Monks are protected from fighting
  assert.equal(isProtectedFromFighting('monastery-monk-myothar-monk-abbot-dhamma', originX, originZ), true);
  assert.equal(formatBotTargetLabel('monastery-monk-abbot', 'monk'), 'ဘုန်းတော်ကြီး');

  desktopPool.dispose();
  mobilePool.dispose();
});

test('Cemetery at (44.577, -411.532) is named သင်္ချိုင်း (ကံပုလဲ) and BurmeseTomb cache provides realistic merged geometry', () => {
  const loc = detectLocation(44.577, -411.532);
  assert.equal(loc.id, 'myothar-cemetery');
  assert.equal(loc.label, 'သင်္ချိုင်း (ကံပုလဲ)');
  assert.equal(loc.subArea, 'သင်္ချိုင်း (ကံပုလဲ)');

  const c1 = getCemeteryTombAssetCache();
  const c2 = getCemeteryTombAssetCache();
  assert.strictEqual(c1, c2, 'Cemetery tomb cache is a strict singleton');
  assert.equal(c1.burmeseTombBodyGeo.userData.shared, true);
  assert.equal(c1.burmeseTombAccentGeo.userData.shared, true);
  assert.ok(c1.burmeseTombBodyGeo.attributes.position.count > 100, 'Realistic multi-tiered Burmese tomb geometry');
  assert.ok((c1.burmeseTombBodyGeo.boundingSphere?.radius ?? 0) > 0.8);
  assert.ok(Math.abs(c1.burmeseTombBodyGeo.boundingBox!.max.x - TOMB_LENGTH / 2) < .0001);
  assert.ok(Math.abs(c1.burmeseTombBodyGeo.boundingBox!.max.z - TOMB_WIDTH / 2) < .0001);
  assert.ok(BURMESE_TOMB_PALETTES.length >= 8);

  disposeCemeteryTombAssetCache();
});

test('Cemetery walkways connect the entrance, cross aisles and separated rows without cutting through graves', () => {
  const layout = MYOTHAR_CEMETERY_LAYOUT;
  assert.ok(CEMETERY_ROW_SPACING - TOMB_LENGTH * 1.1 >= 1.6);
  assert.ok(canStand(layout.entrance.x, layout.entrance.z));
  assert.ok(canStand(61.5, -410.37), 'the existing teleport point is on the main avenue');
  for (const path of layout.paths.filter(p => p.kind !== 'avenue')) {
    const crossAxis = path.kind === 'cross' ? 0 : 1, travelAxis = 1 - crossAxis;
    const offsets = path.points.map(p => p[crossAxis]);
    const center = (Math.min(...offsets) + Math.max(...offsets)) / 2;
    const endpoints = path.points.flatMap((a, i) => {
      const b = path.points[(i + 1) % path.points.length];
      if ((a[crossAxis] > center) === (b[crossAxis] > center)) return [];
      const fraction = (center - a[crossAxis]) / (b[crossAxis] - a[crossAxis]);
      return [a[travelAxis] + (b[travelAxis] - a[travelAxis]) * fraction];
    });
    assert.equal(endpoints.length, 2);
    for (let t = .12; t <= .88; t += .035) {
      const position = endpoints[0] + (endpoints[1] - endpoints[0]) * t;
      const lx = path.kind === 'row' ? position : center;
      const lz = path.kind === 'cross' ? position : center;
      const w = cemeteryToWorld(layout, lx, lz);
      assert.ok(canStand(w.x, w.z), `clear ${path.id} at ${lx},${lz}`);
    }
  }
  let featured = 0;
  for (let row = 0; row < layout.rows.length; row++) for (let col = 0; col < layout.columns; col++) {
    const plot = getCemeteryGrave(layout, row, col);
    if (!plot) continue;
    if (plot.epitaph) featured++;
    const w = cemeteryToWorld(layout, plot.x, plot.z);
    assert.equal(canStand(w.x, w.z), false, 'stone tombs are solid');
  }
  assert.equal(featured, 6, 'custom epitaphs occupy their own single grave slot');
});
