import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, PlaneGeometry, MeshStandardMaterial } from 'three';
import {
  clearKanbaleTiledCacheForTests,
  loadKanbaleAuthoredFeatures,
} from '../src/game/kanbaleTiledEditor.ts';
import {
  clearStreamedChunksForTests,
  decodeStreamedTileFeatures,
  getStreamedChunkStats,
  getStreamedLabels,
  getStreamedRoadPlotsForRegion,
  registerStreamedChunk,
  setStreamedPendingTileBounds,
  unregisterStreamedChunk,
} from '../src/game/streamedChunkRegistry.ts';
import {
  acquireSharedStandardMaterial,
  acquireUnitBoxGeometry,
  acquireUnitCylinderGeometry,
  acquireUnitPlaneGeometry,
  acquireUnitSphereGeometry,
  StreamedAssetPool,
} from '../src/game/streamedAssetPool.ts';
import {
  computeChunkOrigin,
  originLocalToWorld,
  quantizeFloatingOrigin,
  updateFloatingOrigin,
  worldToOriginLocal,
} from '../src/game/floatingOrigin.ts';
import {
  fetchMapJson,
  MapTileIndex,
  MapTileStore,
  validateManifest,
  type MapManifest,
  type MapTilePayload,
} from '../src/game/mapTileStore.ts';
import { projectMapPoint, unprojectMapPoint, type MapProjection } from '../src/game/mapProjection.ts';
import { canStand } from '../src/game/collision.ts';
import { registerGroundRegion, releaseGroundRegion, sceneGround } from '../src/game/groundSurface.ts';
import { loadRegionLayoutAsync, saveRegionLayout } from '../src/game/editorRegions.ts';
import { clearWorldEdits, deletedSource, sourceIsEdited } from '../src/game/worldEdits.ts';

async function readKanbaleDiskDataset() {
  const cfg = JSON.parse(await readFile('src/data/kanbaleDataset.json', 'utf8'));
  const manifestRel = String(cfg.manifest).replace(/^\/+/, '');
  const manifestPath = join('public', manifestRel);
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, 'utf8')));
  const rootDir = join(manifestPath, '..');

  const readJson = async (url: string, maxBytes: number, expectedSha256?: string) => {
    if (url.endsWith('manifest.json')) {
      return manifest;
    }
    const rawText = await readFile(join(rootDir, url), 'utf8');
    assert.ok(Buffer.byteLength(rawText) <= maxBytes, `tile ${url} respects maxBytes`);
    if (expectedSha256) {
      const digest = createHash('sha256').update(rawText).digest('hex');
      assert.equal(digest, expectedSha256, `SHA-256 matches for ${url}`);
    }
    return JSON.parse(rawText);
  };

  return { cfg, manifest, rootDir, readJson };
}

test('Kanbale v2 manifest, SHA-256 integrity, projection accuracy, and floating origin precision hold', async () => {
  const { cfg, manifest, rootDir } = await readKanbaleDiskDataset();
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.regionId, 'kanbale');
  assert.equal(manifest.authority, 'publisher-manifest');
  assert.equal(manifest.tiles.length, cfg.counts.tiles);
  assert.equal(manifest.featureCount, 934);

  const projection = cfg.projection as MapProjection;
  const firstTile = manifest.tiles[0];
  assert.ok(/^[0-9a-f]{64}$/.test(firstTile.sha256 ?? ''), 'v2 tile carries full SHA-256 checksum');

  // Verify fetchMapJson rejects tampered bytes before caching
  const validTileText = await readFile(join(rootDir, firstTile.url), 'utf8');
  const tamperedTileText = validTileText.replace('building', 'TAMPERED');
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(tamperedTileText);
    await assert.rejects(
      fetchMapJson('http://local/tile.json', new AbortController().signal, firstTile.bytes, firstTile.sha256),
      /checksum mismatch/,
    );
  } finally {
    globalThis.fetch = origFetch;
  }

  // Projection round-trip accuracy at Kanbale Farmhouse & distant 120km Floating Origin
  const roundGeo = unprojectMapPoint(projection, 458.67, -464.24);
  const backWorld = projectMapPoint(projection, roundGeo.lon, roundGeo.lat);
  assert.ok(Math.hypot(backWorld.x - 458.67, backWorld.z - (-464.24)) < 1e-6);

  const farX = 120_458.671;
  const farZ = -185_464.249;
  const origin = quantizeFloatingOrigin(farX, farZ, 512);
  const local = worldToOriginLocal(farX, farZ, origin);
  assert.ok(Math.abs(local.x) <= 256 && Math.abs(local.z) <= 256, 'local coordinates stay small near origin');
  const recovered = originLocalToWorld(local.x, local.z, origin);
  assert.ok(Math.hypot(recovered.x - farX, recovered.z - farZ) < 1e-9);
  assert.equal(updateFloatingOrigin(origin, origin.x + 100, origin.z - 100, 512).shifted, false);
  assert.equal(updateFloatingOrigin(origin, origin.x + 420, origin.z, 512).shifted, true);

  // Decode all tiles and confirm exact counts match legacy Kanbale inventory
  const { kanbaleBuildings, kanbaleRoads } = await import('../src/data/villages/kanbale/index.ts');
  let buildingCount = 0;
  let roadCount = 0;
  let roadPlotCount = 0;
  let treeCount = 0;
  let schoolSample: { x: number; z: number } | null = null;
  for (const t of manifest.tiles) {
    const payload = JSON.parse(await readFile(join(rootDir, t.url), 'utf8')) as MapTilePayload;
    const decoded = decodeStreamedTileFeatures(payload, projection);
    buildingCount += decoded.buildings.length;
    roadCount += decoded.roads.length;
    roadPlotCount += decoded.roadPlots.length;
    treeCount += decoded.trees.length;
    const foundSchool = decoded.buildings.find((b) => b.id === 'way/403030614');
    if (foundSchool) schoolSample = { x: foundSchool.x, z: foundSchool.z };
  }
  assert.equal(buildingCount, kanbaleBuildings.length);
  assert.equal(roadCount, kanbaleRoads.length);
  assert.equal(roadPlotCount, 50);
  assert.equal(treeCount, 170);
  assert.ok(schoolSample);
  const origSchool = kanbaleBuildings.find((b) => b.id === 'way/403030614')!;
  assert.ok(Math.hypot(schoolSample.x - origSchool.x, schoolSample.z - origSchool.z) < 0.02);
});

test('Teleport to Kanbale, corridor lock, unloading, LRU cache reuse, and pooled asset reuse work cleanly', async () => {
  clearStreamedChunksForTests();
  const { cfg, manifest, rootDir } = await readKanbaleDiskDataset();
  const projection = cfg.projection as MapProjection;
  const index = new MapTileIndex(manifest.tiles);

  let diskReads = 0;
  const store = new MapTileStore(
    manifest as MapManifest,
    async (tile) => {
      diskReads++;
      return JSON.parse(await readFile(join(rootDir, tile.url), 'utf8')) as MapTilePayload;
    },
    { maxActive: 2, maxTiles: 4, maxBytes: 1024 * 1024, concurrency: 2 },
  );

  const selectAndWait = async (tiles: readonly { id: string }[]) => {
    const ids = tiles.map(tile => tile.id);
    const ready = () => ids.every(id => store.getSnapshot().some(item => item.tile.id === id));
    store.select(ids);
    if (ready()) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out loading Kanbale tiles: ${ids.join(', ')}`));
      }, 5000);
      const unsubscribe = store.subscribe(() => {
        if (!ready()) return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      });
    });
  };

  const pool = new StreamedAssetPool();
  const scene = new Group();
  const mountedHandles = new Map<string, Array<{ release: () => void }>>();

  const mountLoadedSnapshot = () => {
    const wantedIds = new Set(store.getSnapshot().map((s) => `kanbale:${s.tile.id}`));
    // Mount incoming tiles first so shared ref-counted geometries/materials stay alive across swaps
    for (const { tile, data } of store.getSnapshot()) {
      const key = `kanbale:${tile.id}`;
      if (mountedHandles.has(key)) continue;
      const decoded = decodeStreamedTileFeatures(data, projection);
      const origin = computeChunkOrigin(tile.bbox[0], tile.bbox[2], tile.bbox[1], tile.bbox[3]);
      assert.ok(Number.isFinite(origin.x) && Number.isFinite(origin.z));

      const handles = [
        acquireUnitBoxGeometry(pool),
        acquireUnitPlaneGeometry(pool),
        acquireUnitCylinderGeometry(pool),
        acquireUnitSphereGeometry(pool),
        acquireSharedStandardMaterial('kanbale:wall', { color: '#ffffff' }, pool),
        acquireSharedStandardMaterial('kanbale:roof', { color: '#ffffff' }, pool),
      ];
      mountedHandles.set(key, handles);

      const tileGroup = new Group();
      const gMesh = new Mesh(new PlaneGeometry(100, 100), new MeshStandardMaterial());
      gMesh.rotateX(-Math.PI / 2);
      gMesh.position.set(decoded.buildings[0]?.x ?? 460, 0.04, decoded.buildings[0]?.z ?? -465);
      gMesh.userData.walkable = true;
      tileGroup.add(gMesh);

      registerStreamedChunk(key, { regionId: 'kanbale', ...decoded });
      registerGroundRegion(scene, `ground:${key}`, tileGroup);
    }
    // Release unselected tiles cleanly afterward (ground before pool refs)
    for (const [key, handles] of mountedHandles.entries()) {
      if (!wantedIds.has(key)) {
        unregisterStreamedChunk(key);
        releaseGroundRegion(scene, `ground:${key}`);
        handles.forEach((h) => h.release());
        mountedHandles.delete(key);
      }
    }
  };

  try {
    // 1. At Myothar spawn: 0 Kanbale tiles selected, 0 streamed colliders/labels
    assert.equal(getStreamedChunkStats().residentChunks, 0);
    assert.equal(getStreamedChunkStats().buildingColliders, 0);
    assert.equal(pool.getStats().totalRefs, 0);

    // 2. Teleport to Kanbale Farmhouse (458.67, -464.24): corridor lock protects before fetch resolves
    const farmhouseGeo = unprojectMapPoint(projection, 458.67, -464.24);
    const radius = 340 / Math.min(...projection.metersPerDegree);
    const teleportTiles = index.nearest(farmhouseGeo.lon, farmhouseGeo.lat, radius, 2);
    assert.ok(teleportTiles.length >= 1 && teleportTiles.length <= 2);

    const tile0Box = [
      projectMapPoint(projection, teleportTiles[0].bbox[0], teleportTiles[0].bbox[1]),
      projectMapPoint(projection, teleportTiles[0].bbox[2], teleportTiles[0].bbox[3]),
    ];
    setStreamedPendingTileBounds('kanbale', [
      {
        minX: Math.min(tile0Box[0].x, tile0Box[1].x),
        maxX: Math.max(tile0Box[0].x, tile0Box[1].x),
        minZ: Math.min(tile0Box[0].z, tile0Box[1].z),
        maxZ: Math.max(tile0Box[0].z, tile0Box[1].z),
      },
    ]);
    assert.equal(canStand(458.67, -464.24), false, 'actor corridor waits until downloading tile registers');
    setStreamedPendingTileBounds('kanbale', []);

    await selectAndWait(teleportTiles);
    mountLoadedSnapshot();

    assert.equal(getStreamedChunkStats().residentChunks, teleportTiles.length);
    assert.ok(getStreamedChunkStats().buildingColliders > 0, 'streamed Kanbale buildings register collision');
    assert.ok(getStreamedRoadPlotsForRegion('kanbale').length > 0, 'streamed road plots load for bots/traffic');
    const regularHouse = (decodeStreamedTileFeatures(store.getSnapshot()[0].data, projection).buildings.find((b) => !b.customComponent))!;
    assert.equal(canStand(regularHouse.x, regularHouse.z), false, 'loaded house footprint blocks standing');
    assert.ok(sceneGround(scene, 1).height(regularHouse.x, regularHouse.z) >= 0);

    // 3. Travel east within Kanbale to load additional tiles -> shared pool assets are reused (never duplicated!)
    const eastGeo = unprojectMapPoint(projection, 1385, -804);
    const eastTiles = index.nearest(eastGeo.lon, eastGeo.lat, radius, 2);
    await selectAndWait(eastTiles);
    mountLoadedSnapshot();

    const poolAfterTravel = pool.getStats();
    assert.ok(poolAfterTravel.reuseHits > 0, 'pool shared geometries and materials across tile swaps');
    assert.equal(poolAfterTravel.geometriesActive, 4, 'only 4 unique shared geometries allocated');
    assert.equal(poolAfterTravel.disposals, 0, 'reused pool assets are not disposed while tiles hold refs');

    // 4. Return immediately to Kanbale Farmhouse (still inside 4-tile LRU): ZERO additional disk reads!
    const readsBeforeReturn = diskReads;
    await selectAndWait(teleportTiles);
    mountLoadedSnapshot();
    assert.equal(diskReads, readsBeforeReturn, 'revisiting recently cached chunks reuses LRU store data');

    // 5. Teleport back to Myothar: unload all active chunks cleanly -> zero colliders, zero labels, zero GPU refs!
    store.select([]);
    mountLoadedSnapshot();
    assert.equal(getStreamedChunkStats().residentChunks, 0);
    assert.equal(getStreamedChunkStats().buildingColliders, 0);
    assert.equal(getStreamedChunkStats().treeColliders, 0);
    assert.equal(getStreamedChunkStats().roadPlots, 0);
    assert.equal(getStreamedLabels().length, 0);
    assert.equal(pool.getStats().totalRefs, 0);
    assert.equal(pool.getStats().geometriesActive, 0);
    assert.equal(pool.getStats().materialsActive, 0);
    assert.equal(canStand(regularHouse.x, regularHouse.z), true, 'unloaded house collider releases cleanly');
  } finally {
    store.dispose();
    pool.resetForTests();
    clearStreamedChunksForTests();
  }
});

test('Editor round-trips preserve Kanbale edits, deletions, and source snapshots from streamed chunks', async () => {
  clearStreamedChunksForTests();
  clearKanbaleTiledCacheForTests();
  clearWorldEdits();

  const { readJson } = await readKanbaleDiskDataset();
  const storage = new Map<string, string>();
  const oldStorage = globalThis.localStorage;
  const oldWindow = globalThis.window;

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      dispatchEvent: () => true,
    },
  });

  try {
    // 1. Load initial editable layout for Kanbale from streamed JSON chunks
    const features = await loadKanbaleAuthoredFeatures(readJson);
    assert.equal(features.length, 669 + 45 + 170, 'all 884 buildings, roads, and trees convert to authored editor features');

    const initialLayout = await loadRegionLayoutAsync('kanbale', readJson);
    assert.equal(initialLayout.features.length, 884);

    const editableHouse = initialLayout.features.find(
      (f) => f.kind === 'house' && f.id !== 'way/403027623' && f.id !== 'way/403030614',
    )!;
    const deletedHouse = initialLayout.features.find(
      (f) => f.kind === 'house' && f.id !== editableHouse.id && f.id !== 'way/403027623' && f.id !== 'way/403030614',
    )!;
    const origX = editableHouse.points[0].x;
    const origZ = editableHouse.points[0].z;

    // 2. Register streamed chunk collision & ground before edit
    registerStreamedChunk('editor-roundtrip:kanbale', {
      regionId: 'kanbale',
      buildings: [
        {
          id: editableHouse.id,
          name: editableHouse.name,
          x: origX,
          z: origZ,
          width: editableHouse.dimensions?.width ?? 7,
          depth: editableHouse.dimensions?.depth ?? 8,
          height: 3.8,
          area: 56,
          wallColor: editableHouse.color ?? '#d6c5a0',
          roofColor: editableHouse.roofColor ?? '#7d4f3b',
          rotation: editableHouse.rotation ?? 0,
          houseWidth: editableHouse.dimensions?.width ?? 7,
          houseLength: editableHouse.dimensions?.depth ?? 8,
          wallHeight: 3.2,
          roofHeight: 1.6,
          polygonPoints: [],
          relativePoints: [],
          privateHome: true,
        },
        {
          id: deletedHouse.id,
          name: deletedHouse.name,
          x: deletedHouse.points[0].x,
          z: deletedHouse.points[0].z,
          width: deletedHouse.dimensions?.width ?? 7,
          depth: deletedHouse.dimensions?.depth ?? 8,
          height: 3.8,
          area: 56,
          wallColor: '#d6c5a0',
          roofColor: '#7d4f3b',
          rotation: deletedHouse.rotation ?? 0,
          houseWidth: 7,
          houseLength: 8,
          wallHeight: 3.2,
          roofHeight: 1.6,
          polygonPoints: [],
          relativePoints: [],
          privateHome: true,
        },
      ],
    });
    assert.equal(canStand(origX, origZ), false, 'unedited house blocks its original footprint');

    // 3. Apply editor move/recolor & delete, then save back into mm-editor-region-v1:kanbale
    const nextFeatures = initialLayout.features
      .filter((f) => f.id !== deletedHouse.id)
      .map((f) =>
        f.id === editableHouse.id
          ? {
              ...f,
              points: [{ x: origX + 18, z: origZ - 12 }],
              rotation: (f.rotation ?? 0) + 0.4,
              roofColor: '#1e3a8a',
            }
          : f,
      );

    saveRegionLayout('kanbale', {
      ...initialLayout,
      features: nextFeatures,
      deletedSourceIds: [deletedHouse.id],
    });

    assert.equal(sourceIsEdited(editableHouse.id), true, 'moved house hides static streamed mesh');
    assert.equal(deletedSource(deletedHouse.id), true, 'deleted house is recorded in deletedSourceIds');
    assert.equal(canStand(origX, origZ), true, 'original vacated house footprint no longer blocks player');

    // 4. Reload editor layout from persistence and verify round-trip fidelity
    clearKanbaleTiledCacheForTests();
    const reopened = await loadRegionLayoutAsync('kanbale', readJson);
    const persistedHouse = reopened.features.find((f) => f.id === editableHouse.id)!;
    assert.ok(persistedHouse);
    assert.equal(persistedHouse.points[0].x, origX + 18);
    assert.equal(persistedHouse.points[0].z, origZ - 12);
    assert.equal(persistedHouse.roofColor, '#1e3a8a');
    assert.equal(persistedHouse.metadata?.sourceId, editableHouse.id);
    assert.ok(persistedHouse.metadata?.sourceSnapshot, 'sourceSnapshot preserved across editor round-trip');
    assert.deepEqual(reopened.deletedSourceIds, [deletedHouse.id]);
    assert.equal(reopened.features.some((f) => f.id === deletedHouse.id), false);
  } finally {
    clearWorldEdits();
    clearStreamedChunksForTests();
    clearKanbaleTiledCacheForTests();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: oldStorage });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: oldWindow });
  }
});
