import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { angle, toWorld, ward } from '../src/data/ward.ts';
import {
  preCanalGroveFarmTrees,
  preCanalGroveLargeTrees,
  separationFields,
  tharSiCanal,
  tharSiLanes,
  tharSiVillage,
} from '../src/data/villages/tharsi/index.ts';
import { canStand } from '../src/game/collision.ts';
import { detectLocation } from '../src/game/locationDetect.ts';
import { projectMapPoint, unprojectMapPoint, type MapProjection } from '../src/game/mapProjection.ts';
import {
  getStreamedLabels,
  registerStreamedChunk,
  unregisterStreamedChunk,
  type StreamedTreeRecord,
} from '../src/game/streamedChunkRegistry.ts';
import datasetConfig from '../src/data/tharsiZombieForestDataset.json' with { type: 'json' };

const projection = datasetConfig.projection as MapProjection;
const invC = Math.cos(angle);
const invS = Math.sin(angle);
const toUV = (x: number, z: number) => ({ u: x * invC - z * invS, v: x * invS + z * invC });

async function loadAllForestFeatures() {
  const manifestRel = datasetConfig.manifest.replace(/^\/+/, '');
  const manifestPath = join(process.cwd(), 'public', manifestRel);
  const manifestDir = join(manifestPath, '..');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const tiles = [];
  for (const tile of manifest.tiles) {
    const data = JSON.parse(await readFile(join(manifestDir, tile.url), 'utf8'));
    tiles.push({ tile, data });
  }
  return { manifest, tiles };
}

test('Zombie Forest dataset manifest and bounded JSON tiles cover all 4 quadrants within mobile/desktop budgets', async () => {
  const { manifest, tiles } = await loadAllForestFeatures();

  assert.equal(manifest.dataset, 'tharsi-zombie-forest');
  assert.equal(manifest.featureCount, 280, 'Forest must have 280 trees across 4 quadrants (100+100+40+40)');
  assert.equal(manifest.tiles.length, 2, 'Dataset fits in 2 bounded tiles so all 4 quadrants load simultaneously on mobile');
  assert.equal(datasetConfig.zoneRects.length, 4);

  const ids = new Set<string>();
  const quadCounts: Record<string, number> = {};
  for (const { tile, data } of tiles) {
    assert.ok(tile.bytes <= 256 * 1024, `Tile ${tile.id} exceeds 256 KiB budget`);
    assert.ok(data.features.length <= 256, `Tile ${tile.id} exceeds 256 features budget`);
    for (const f of data.features) {
      assert.ok(f.id && !ids.has(f.id), `Duplicate or missing stable ID: ${f.id}`);
      ids.add(f.id);
      const q = String(f.properties.quadrant);
      quadCounts[q] = (quadCounts[q] ?? 0) + 1;
    }
  }
  assert.equal(ids.size, 280);
  assert.deepEqual(quadCounts, { nw: 100, ne: 100, sw: 40, se: 40 });
});

test('Paddy fields are moved completely clear of all forest trees and Thar Si houses stay clear south of north forest buffer', async () => {
  const { tiles } = await loadAllForestFeatures();
  const existingGrove = [...preCanalGroveLargeTrees, ...preCanalGroveFarmTrees];
  const allFields = [
    ...separationFields,
    ...ward.southernFields,
    ...tharSiVillage.fields,
    ...tharSiVillage.bundedFields,
  ];

  // Moved separation fields sit around the requested U ≈ -237 side, clear West of NW/SW forests
  for (const sf of separationFields) {
    assert.equal(sf.u, -237, 'Separation paddies moved west to u=-237');
    assert.ok(sf.u! + sf.width / 2 < -150, 'Separation paddies stay well west of NW/SW forest');
  }
  // Moved southernFields sit clear East of NE/SE forests
  for (const sf of ward.southernFields) {
    assert.ok(sf.u! - sf.width / 2 > 145, 'Southern paddies stay well east of NE/SE forest');
  }

  // Thar Si houses & northmost lane stay clear South of the SW/SE forest buffer
  const northMostLaneV = Math.min(...tharSiLanes);
  const northMostHouseV = Math.min(...tharSiVillage.houses.map((h) => toUV(h.x, h.z).v));
  assert.ok(northMostLaneV >= 710, `Thar Si north lane (${northMostLaneV}) leaves room for north forest buffer`);
  assert.ok(northMostHouseV >= 718, `Thar Si north houses (${northMostHouseV}) stay well south of north forest`);

  // Verify projection round-trip
  const refWorld = toWorld(7.892, 644.895);
  const refGeo = unprojectMapPoint(projection, refWorld.x, refWorld.z);
  const refBack = projectMapPoint(projection, refGeo.lon, refGeo.lat);
  assert.ok(Math.hypot(refBack.x - refWorld.x, refBack.z - refWorld.z) < 1e-4);

  const allTreePoints: Array<{ u: number; v: number }> = [];
  for (const { data } of tiles) {
    for (const f of data.features) {
      const [lon, lat] = f.geometry.coordinates;
      const world = projectMapPoint(projection, lon, lat);
      const { u, v } = f.properties;
      const expected = toWorld(u, v);
      assert.ok(Math.hypot(world.x - expected.x, world.z - expected.z) < 0.05, `${f.id} matches local UV`);
      allTreePoints.push({ u, v });

      // Clear of AH1, canal water, and Thar Si houses/lanes
      assert.ok(Math.abs(u) >= 14.5, `${f.id} stays clear of AH1 highway`);
      assert.ok(Math.abs(v - tharSiCanal.v) >= 6.0, `${f.id} stays clear of canal water`);
      assert.ok(v <= 706.5, `${f.id} stays north of Thar Si village lanes & houses`);

      // Zero trees overlapping ANY paddy field
      for (const field of allFields) {
        const insideField =
          Math.abs(u - field.u!) <= field.width / 2 + 1.0 &&
          Math.abs(v - field.v!) <= field.depth / 2 + 1.0;
        assert.equal(insideField, false, `${f.id} must not stand on paddy field ${field.id}`);
      }

      // Zero overlap with existing grove trees
      for (const gt of existingGrove) {
        assert.ok(Math.hypot(world.x - gt.x, world.z - gt.z) >= 4.0, `${f.id} overlaps existing grove tree ${gt.id}`);
      }
    }
  }

  // Verify trees cover all 3 requested new locations (Loc A, Loc B, Loc C)
  for (const [label, targetU, targetV] of [
    ['Loc A (Thar Si Ward 1 North)', -46.607, 666.793],
    ['Loc B (Thar Si East North)', 34.289, 666.201],
    ['Loc C (North-East of canal)', 29.999, 623.921],
  ] as const) {
    const nearestDist = Math.min(...allTreePoints.map((t) => Math.hypot(t.u - targetU, t.v - targetV)));
    assert.ok(nearestDist < 12, `${label} must be surrounded by forest trees (nearest=${nearestDist.toFixed(1)}m)`);
  }
});

test('Streamed Zombie Forest tiles register and release all 280 trunk colliders and labels cleanly', async () => {
  const { tiles } = await loadAllForestFeatures();
  const keys: string[] = [];
  const allTrees: StreamedTreeRecord[] = [];

  try {
    for (const { tile, data } of tiles) {
      const key = `test-zombie-forest:${tile.id}`;
      keys.push(key);
      const trees: StreamedTreeRecord[] = data.features.map((f: any) => {
        const [lon, lat] = f.geometry.coordinates;
        const w = projectMapPoint(projection, lon, lat);
        return { id: f.id, x: w.x, z: w.z, radius: f.properties.radius, variant: 'large' };
      });
      allTrees.push(...trees);
      registerStreamedChunk(key, {
        regionId: 'tharsi-zombie-forest',
        trees,
        labels:
          tile.id === '000000'
            ? [
                {
                  id: datasetConfig.label.id,
                  name: datasetConfig.label.text,
                  x: datasetConfig.label.x,
                  z: datasetConfig.label.z,
                  kind: 'place',
                  priority: 58,
                },
              ]
            : [],
      });
    }

    for (const t of allTrees) {
      assert.equal(canStand(t.x, t.z), false, `Tree trunk ${t.id} blocks walking when loaded`);
    }

    // AH1 highway and moved paddy field centers stay walkable
    for (let v = 520; v <= 715; v += 5) {
      const p = toWorld(0, v);
      assert.equal(canStand(p.x, p.z), true, `AH1 at v=${v} stays walkable`);
    }
    for (const sf of separationFields) {
      assert.equal(canStand(sf.x, sf.z), true, `${sf.id} center stays walkable`);
    }

    // Open combat corridors between trees remain walkable in both NW and NE forests
    for (const [cu, cv] of [
      [-55.25, 578.25],
      [55.25, 578.25],
      [-55.25, 684.25],
      [55.25, 684.25],
    ]) {
      const corridor = toWorld(cu, cv);
      assert.equal(canStand(corridor.x, corridor.z), true, `Combat corridor (${cu}, ${cv}) is walkable`);
    }

    assert.ok(getStreamedLabels().some((l) => l.id === datasetConfig.label.id));
  } finally {
    for (const key of keys) {
      unregisterStreamedChunk(key);
    }
  }

  assert.equal(getStreamedLabels().some((l) => l.id === datasetConfig.label.id), false);
  const sampleTree = allTrees[0];
  assert.equal(canStand(sampleTree.x, sampleTree.z), true, 'Tree collider released on tile unload');
});

test('Canal (v = 658) divides North Myothar Area 5 forest from South Thar Si forest in detectLocation', () => {
  // North of canal (v < 658) belongs to Myothar Area 5
  const onNorthBridge = toWorld(2.889, 657.523);
  assert.equal(detectLocation(onNorthBridge.x, onNorthBridge.z).id, 'myothar-area-5');
  assert.equal(detectLocation(onNorthBridge.x, onNorthBridge.z).label, 'မြို့သာရပ်ကွက် · နယ်မြေ (၅)');

  const nwForest = toWorld(-50, 610);
  const nwLoc = detectLocation(nwForest.x, nwForest.z);
  assert.equal(nwLoc.id, 'myothar-area-5');
  assert.equal(nwLoc.subArea, 'မြို့သာ နယ်မြေ (၅) · သစ်တောအုပ်');

  const neForest = toWorld(29.999, 623.921);
  const neLoc = detectLocation(neForest.x, neForest.z);
  assert.equal(neLoc.id, 'myothar-area-5');
  assert.equal(neLoc.subArea, 'မြို့သာ နယ်မြေ (၅) · သစ်တောအုပ်');

  // South of canal (v >= 658) belongs to Thar Si village
  const swForest = toWorld(-46.607, 666.793);
  const swLoc = detectLocation(swForest.x, swForest.z);
  assert.equal(swLoc.id, 'tharsi');
  assert.equal(swLoc.label, 'သာစည်ရွာ');
  assert.equal(swLoc.subArea, 'သာစည်ရွာ · သစ်တောအုပ်');

  const seForest = toWorld(34.289, 666.201);
  const seLoc = detectLocation(seForest.x, seForest.z);
  assert.equal(seLoc.id, 'tharsi');
  assert.equal(seLoc.subArea, 'သာစည်ရွာ · သစ်တောအုပ်');
});
