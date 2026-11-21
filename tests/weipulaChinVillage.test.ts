import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { area5 } from '../src/data/wards/myothar/area5.ts';
import { mountainHeight } from '../src/game/mountainTerrain.ts';
import {
  MAHA_WEIPULA_SUMMIT_UV,
  buildWeipulaRoadSegments,
  buildWeipulaSlopeFlora,
} from '../src/game/weipulaClimb.ts';
import {
  WEIPULA_CHIN_COLS_PER_TIER,
  WEIPULA_CHIN_TIER_COUNT,
  WEIPULA_CHIN_VILLAGE_ANCHOR_UV,
  WEIPULA_CHIN_VILLAGE_PROJECTION,
  buildWeipulaChinStairCorridors,
  buildWeipulaChinVillageHouses,
  detectWeipulaChinVillageTier,
  isInsideWeipulaChinVillageUV,
} from '../src/game/weipulaChinVillageLayout.ts';
import { projectMapPoint, unprojectMapPoint } from '../src/game/mapProjection.ts';
import { detectLocation, MAP_DESTINATIONS } from '../src/game/locationDetect.ts';
import {
  clearStreamedChunksForTests,
  getStreamedChunkStats,
  registerStreamedChunk,
  unregisterStreamedChunk,
} from '../src/game/streamedChunkRegistry.ts';
import { canStand } from '../src/game/collision.ts';

const peaks = [...area5.mountains, ...area5.weipula.peaks];

function minDistanceToRoad(
  u: number,
  v: number,
  segs: ReturnType<typeof buildWeipulaRoadSegments>,
): number {
  let best = Infinity;
  for (const s of segs) {
    const du = s.u2 - s.u1;
    const dv = s.v2 - s.v1;
    const l2 = du * du + dv * dv;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - s.u1) * du + (v - s.v1) * dv) / l2)) : 0;
    const d = Math.hypot(u - (s.u1 + t * du), v - (s.v1 + t * dv));
    if (d < best) best = d;
  }
  return best;
}

test('Weipula mid-slope Chin terraced village places 100 stepped houses clear of the climbing highway and stairway', () => {
  const houses = buildWeipulaChinVillageHouses(peaks);
  const roadSegs = buildWeipulaRoadSegments(peaks);

  assert.equal(houses.length, 100, 'Expected exactly 100 terraced Chin houses');

  const ids = new Set<string>();
  const tierCounts = new Map<number, number>();
  let minRoadClearance = Infinity;
  let minStairClearance = Infinity;
  let closestToAnchor = Infinity;

  for (const h of houses) {
    assert.ok(!ids.has(h.id), `Duplicate house ID: ${h.id}`);
    ids.add(h.id);
    tierCounts.set(h.tier, (tierCounts.get(h.tier) ?? 0) + 1);

    // 1. Strict clearance from EVERY switchback climbing road segment
    const dRoad = minDistanceToRoad(h.u, h.v, roadSegs);
    if (dRoad < minRoadClearance) minRoadClearance = dRoad;
    const footprintRadius = Math.hypot(h.terraceWidth / 2, h.terraceDepth / 2);
    assert.ok(
      dRoad >= footprintRadius + 15,
      `House ${h.id} at (${h.u}, ${h.v}) too close to climbing road: ${dRoad.toFixed(1)}m`,
    );

    // 2. Strict clearance from the northern pilgrim stone stairway at u = -1560
    const dStair = Math.abs(h.u - MAHA_WEIPULA_SUMMIT_UV.u);
    if (dStair < minStairClearance) minStairClearance = dStair;
    assert.ok(dStair >= 100, `House ${h.id} too close to pilgrim stairway: ${dStair.toFixed(1)}m`);

    // 3. BaseY strictly clears local terrain so uphill rear never sinks into slope
    const localH = mountainHeight(h.u, h.v, peaks);
    assert.ok(
      h.baseY >= localH + 0.3,
      `House ${h.id} baseY ${h.baseY} should sit above terrain ${localH}`,
    );

    // 4. Hornbill scale & authentic Chin dimensions
    assert.ok(h.hornbillScale >= 1.0, `House ${h.id} must display Hornbill roof emblem`);
    assert.ok(h.width >= 7.5 && h.depth >= 6.5 && h.height >= 3.5);

    const dAnchor = Math.hypot(
      h.u - WEIPULA_CHIN_VILLAGE_ANCHOR_UV.u,
      h.v - WEIPULA_CHIN_VILLAGE_ANCHOR_UV.v,
    );
    if (dAnchor < closestToAnchor) closestToAnchor = dAnchor;
  }

  // All 10 tiers have 10 houses each and step cleanly down the mountainside
  assert.equal(tierCounts.size, WEIPULA_CHIN_TIER_COUNT);
  for (let tier = 1; tier <= WEIPULA_CHIN_TIER_COUNT; tier++) {
    assert.equal(tierCounts.get(tier), WEIPULA_CHIN_COLS_PER_TIER);
  }

  // Pairwise non-overlapping house spacing
  let minPairDist = Infinity;
  for (let i = 0; i < houses.length; i++) {
    for (let j = i + 1; j < houses.length; j++) {
      const d = Math.hypot(houses[i].u - houses[j].u, houses[i].v - houses[j].v);
      if (d < minPairDist) minPairDist = d;
    }
  }
  assert.ok(minPairDist >= 18, `Houses too crowded: min center spacing ${minPairDist.toFixed(2)}m`);
  assert.ok(minRoadClearance >= 40, `Expected >=40m road clearance, got ${minRoadClearance.toFixed(1)}m`);
  assert.ok(closestToAnchor <= 25, `Village should start right next to target anchor, got ${closestToAnchor.toFixed(1)}m`);

  // Terraced stair corridors connect all 10 tiers
  const stairs = buildWeipulaChinStairCorridors(peaks);
  assert.equal(stairs.length, (WEIPULA_CHIN_TIER_COUNT - 1) * 2);

  // Mountain flora clears the terraced village envelope
  const flora = buildWeipulaSlopeFlora(peaks, false);
  for (const t of flora.trees) {
    assert.ok(
      !isInsideWeipulaChinVillageUV(t.u, t.v, 0),
      `Mountain tree ${t.id} should not spawn inside terraced Chin village`,
    );
  }
});

test('Weipula Chin village streamed JSON tiles, projection round-trip, location detection, and collision lifecycle work cleanly', async () => {
  const meta = JSON.parse(await readFile('src/data/weipulaChinVillageDataset.json', 'utf8'));
  assert.equal(meta.dataset, 'weipula-chin-village');
  assert.equal(meta.houseCount, 100);
  assert.equal(meta.tiers, 10);

  const manifestRel = String(meta.manifest).replace(/^\/+/, '');
  const manifest = JSON.parse(await readFile(join('public', manifestRel), 'utf8'));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.featureCount, 100);
  assert.ok(manifest.tiles.length >= 2, '100 houses should partition cleanly into bounded spatial tiles');

  // Verify projection round-trip & tile payload budgets
  let decodedCount = 0;
  let firstHouse: { id: string; x: number; z: number; width: number; depth: number; rotation: number } | null = null;
  for (const tile of manifest.tiles) {
    assert.ok(tile.featureCount <= 64, `Tile ${tile.id} exceeded 64-feature cap`);
    assert.ok(tile.bytes <= 262144, `Tile ${tile.id} exceeded 256 KiB cap`);
    const tileDir = join('public', manifestRel, '..');
    const payload = JSON.parse(await readFile(join(tileDir, tile.url), 'utf8'));
    assert.equal(payload.features.length, tile.featureCount);
    for (const f of payload.features) {
      decodedCount++;
      const [lon, lat] = f.properties.anchorGeo;
      const world = projectMapPoint(WEIPULA_CHIN_VILLAGE_PROJECTION, lon, lat);
      const back = unprojectMapPoint(WEIPULA_CHIN_VILLAGE_PROJECTION, world.x, world.z);
      assert.ok(Math.abs(back.lon - lon) < 1e-6 && Math.abs(back.lat - lat) < 1e-6);
      if (!firstHouse) {
        firstHouse = {
          id: String(f.id),
          x: world.x,
          z: world.z,
          width: Number(f.properties.width),
          depth: Number(f.properties.depth),
          rotation: Number(f.properties.rotation),
        };
      }
    }
  }
  assert.equal(decodedCount, 100);
  assert.ok(firstHouse);

  // Verify streamed collision registration & release lifecycle
  clearStreamedChunksForTests();
  try {
    assert.equal(canStand(firstHouse.x, firstHouse.z), true, 'Before tile mounts, position is open');
    registerStreamedChunk('weipula-chin-village:test-tile', {
      regionId: 'weipula-chin-village',
      buildings: [
        {
          id: firstHouse.id,
          name: 'Test Chin House',
          x: firstHouse.x,
          z: firstHouse.z,
          width: firstHouse.width,
          depth: firstHouse.depth,
          height: 3.8,
          area: firstHouse.width * firstHouse.depth,
          wallColor: '#6a482d',
          roofColor: '#7d3c2e',
          rotation: firstHouse.rotation,
          houseLength: firstHouse.depth,
          houseWidth: firstHouse.width,
          wallHeight: 3.8,
          roofHeight: 1.6,
          polygonPoints: [],
          relativePoints: [],
          privateHome: true,
        },
      ],
      labels: [
        {
          id: meta.label.id,
          name: meta.label.text,
          x: meta.label.x,
          z: meta.label.z,
          kind: 'place',
          priority: 76,
        },
      ],
    });
    assert.equal(canStand(firstHouse.x, firstHouse.z), false, 'Mounted tile blocks house interior');
    assert.equal(getStreamedChunkStats().buildingColliders, 1);

    unregisterStreamedChunk('weipula-chin-village:test-tile');
    assert.equal(canStand(firstHouse.x, firstHouse.z), true, 'Unmounted tile releases collision cleanly');
    assert.equal(getStreamedChunkStats().buildingColliders, 0);
  } finally {
    clearStreamedChunksForTests();
  }

  // Verify location detection & teleport destination
  assert.ok(MAP_DESTINATIONS.some(d => d.id === 'weipula-chin-village'));
  const detected = detectLocation(meta.anchorWorld.x, meta.anchorWorld.z);
  assert.equal(detected.id, 'weipula-chin-village');
  assert.equal(detectWeipulaChinVillageTier(WEIPULA_CHIN_VILLAGE_ANCHOR_UV.u, WEIPULA_CHIN_VILLAGE_ANCHOR_UV.v), 1);
});
