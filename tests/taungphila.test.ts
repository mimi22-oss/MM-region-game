import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ward } from '../src/data/ward.ts';
import { canStand } from '../src/game/collision.ts';
import { mountainHeight } from '../src/game/mountainTerrain.ts';
import { rideFootprintClear } from '../src/game/motorcycleRide.ts';
import {
  TAUNGPHILA_MOUNTAIN_WORLD,
  WEIPULA_JUNCTION_UV,
  buildTaungphilaRoadSegments,
  buildTaungphilaSlopeFlora,
} from '../src/game/taungphilaWorld.ts';
import { buildWeipulaRoadSegments } from '../src/game/weipulaClimb.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Taungphila Mountain foothills & user coordinate (-143.906, 576.112) are motorcycle-rideable', () => {
  assert.ok(canStand(-143.906, 576.112), 'User coordinate at Taungphila Mountain is clear');
  assert.ok(
    rideFootprintClear(-143.906, 576.112, 8.588652, (x, z) => canStand(x, z)),
    'Motorcycle footprint is completely clear at Taungphila approach',
  );

  // Exact peak centers still block walking cleanly (obstacleRadius = 6.5m)
  for (const m of ward.mountains) {
    assert.equal(canStand(m.x, m.z), false, `${m.id} summit core blocks walking`);
  }
});

test('Taungphila -> Weipula continuous ridge motorcycle highway connects cleanly at <= 25% grade with zero obstacles', () => {
  const segments = buildTaungphilaRoadSegments(allPeaks);
  assert.ok(segments.length >= 160, 'Continuous ridge highway has dense smooth segments');
  assert.ok(segments[0].y1 <= 0.25, `Road starts flush on flat valley floor (y1=${segments[0].y1.toFixed(2)})`);

  // Verify southern terminus connects seamlessly to Maha Weipula Highway at user's exact point (-772.322, 4552.174)
  const last = segments[segments.length - 1];
  assert.ok(
    Math.hypot(last.u2 - WEIPULA_JUNCTION_UV.u, last.v2 - WEIPULA_JUNCTION_UV.v) < 0.5,
    'Southern terminus joins Maha Weipula Highway at (-772.322, 4552.174)',
  );
  const weipulaSegs = buildWeipulaRoadSegments(allPeaks);
  let nearestWeipulaY = 0;
  let nearestDist = Infinity;
  for (const ws of weipulaSegs) {
    const du = ws.u2 - ws.u1;
    const dv = ws.v2 - ws.v1;
    const t = Math.max(0, Math.min(1, ((last.u2 - ws.u1) * du + (last.v2 - ws.v1) * dv) / Math.max(0.001, du * du + dv * dv)));
    const d = Math.hypot(last.u2 - (ws.u1 + du * t), last.v2 - (ws.v1 + dv * t));
    if (d < nearestDist) {
      nearestDist = d;
      nearestWeipulaY = ws.y1 + (ws.y2 - ws.y1) * t;
    }
  }
  assert.ok(nearestDist < 5, `Junction sits directly on Maha Weipula Highway (dist=${nearestDist.toFixed(2)}m)`);
  assert.ok(
    Math.abs(last.y2 - nearestWeipulaY) < 0.25,
    `Junction elevation matches Maha Weipula Highway seamlessly (${last.y2.toFixed(2)}m vs ${nearestWeipulaY.toFixed(2)}m)`,
  );

  let maxGrade = 0;
  let maxElevation = 0;
  for (const seg of segments) {
    maxGrade = Math.max(maxGrade, seg.grade);
    maxElevation = Math.max(maxElevation, seg.y1, seg.y2);
    const terrainMid = mountainHeight((seg.u1 + seg.u2) / 2, (seg.v1 + seg.v2) / 2, allPeaks);
    assert.ok(seg.y >= terrainMid - 0.05, `${seg.key} stays cleanly visible above mountain terrain`);
    assert.ok(canStand(seg.x, seg.z), `${seg.key} road center is obstacle-free for motorcycles`);
    assert.ok(
      rideFootprintClear(seg.x, seg.z, seg.yaw, (x, z) => canStand(x, z)),
      `${seg.key} full motorcycle wheelbase clears obstacles`,
    );
  }
  assert.ok(maxGrade <= 0.255, `Max road grade ${maxGrade.toFixed(3)} stays safely rideable by motorcycle`);
  assert.ok(maxElevation > 80, `Highway climbs high across Taungphila & Western Spine (reached ${maxElevation.toFixed(1)}m)`);
});

test('Full Taungphila -> Weipula Mountain Range includes lakes, forest belts, zayats, forest monasteries & pagodas', () => {
  const world = TAUNGPHILA_MOUNTAIN_WORLD;
  assert.ok(world.lakes.length >= 14, 'At least 14 mountain lakes across Taungphila -> Weipula');
  assert.ok(world.zayats.length >= 18, 'At least 18 mountain zayats across Taungphila -> Weipula');
  assert.ok(world.monasteries.length >= 12, 'At least 12 forest monasteries across Taungphila -> Weipula');
  assert.ok(world.pagodas.length >= 16, 'At least 16 mountain pagodas across Taungphila -> Weipula');
  assert.ok(
    world.pagodas.filter((p) => p.weekdayShrines).length >= 6,
    'Major summit pagodas across Taungphila, Western Spine & Weipula include 8 weekday shrines',
  );

  // Features span the entire range from Taungphila (v < 450) all the way to Maha Weipula (v > 4600)
  assert.ok(world.lakes.some((l) => l.v < 300) && world.lakes.some((l) => l.v > 4650), 'Lakes span Taungphila -> Weipula');
  assert.ok(world.monasteries.some((m) => m.v < 300) && world.monasteries.some((m) => m.v > 4600), 'Monasteries span Taungphila -> Weipula');
  assert.ok(world.pagodas.some((p) => p.v < 300) && world.pagodas.some((p) => p.v > 4800), 'Pagodas span Taungphila -> Weipula');

  // Lakes block walking on water but allow airborne flight
  for (const lk of world.lakes) {
    assert.equal(canStand(lk.x, lk.z, 0, false), false, `${lk.id} water blocks walking`);
    assert.equal(canStand(lk.x, lk.z, 0, true), true, `${lk.id} allows airborne flight`);
  }

  // Pagoda & forest monastery cores block walking
  for (const p of world.pagodas) {
    assert.equal(canStand(p.x, p.z), false, `${p.id} pagoda core blocks walking`);
  }
  for (const m of world.monasteries) {
    assert.equal(canStand(m.x, m.z), false, `${m.id} forest monastery hall core blocks walking`);
  }

  // Continuous lush forest trees & meadow grass span the entire Taungphila -> Weipula mountain corridor
  const desktopFlora = buildTaungphilaSlopeFlora(allPeaks, false);
  const mobileFlora = buildTaungphilaSlopeFlora(allPeaks, true);
  assert.ok(desktopFlora.trees.length >= 1600, 'Dense forest trees blanket Taungphila -> Weipula for desktop');
  assert.ok(mobileFlora.trees.length >= 850, 'Bounded forest trees blanket Taungphila -> Weipula for mobile');
  assert.ok(desktopFlora.trees.some((t) => t.v > 4200), 'Forest reaches right up to Maha Weipula');
  assert.ok(desktopFlora.grassTufts.length >= 800, 'Mountain meadow shrubs span the range');
});
