import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BundleInfo } from '@capgo/capacitor-updater';
import {
  buildAndroidBaselineReport,
  getPerfBaselineSummary,
  publishPerfSnapshot,
  recordDprAdaptation,
  recordFrameSample,
  resetPerfBaseline,
} from '../src/game/perfMetrics.ts';
import {
  StartupDiagnosticsManager,
  isThirdPartyExtensionError,
  type StartupStorageAdapter,
} from '../src/game/startupDiagnostics.ts';
import {
  APP_NATIVE_BASELINE,
  buildContentPacks,
  checkContentPackCompatibility,
  classifyAssetCategory,
  classifyContentPack,
  validateAssetManifest,
  type VersionedAssetEntry,
  type VersionedAssetManifest,
} from '../src/game/otaCompatibility.ts';
import {
  AssetCacheManager,
  IndexedDbAssetBlobStore,
  InMemoryAssetBlobStore,
  InMemoryAssetMetadataStore,
} from '../src/services/assetCacheManager.ts';
import { OtaCoordinator, type NativeUpdaterBridge } from '../src/services/otaUpdater.ts';

const ROOT = resolve(import.meta.dirname, '..');

function sha256Hex(input: Uint8Array | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function asyncSha256(bytes: Uint8Array): Promise<string> {
  return sha256Hex(bytes);
}

function createMemoryStorage(): StartupStorageAdapter {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function makePackManifest(
  version: string,
  fileContents: Record<string, string>,
  overrides: Partial<VersionedAssetManifest> = {},
): {
  assets: Map<string, Uint8Array>;
  manifest: VersionedAssetManifest;
} {
  const assets = new Map<string, Uint8Array>();
  const entries: VersionedAssetEntry[] = Object.entries(fileContents).map(([relPath, text]) => {
    const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
    assets.set(relPath, bytes);
    return {
      path: relPath,
      sha256: sha256Hex(bytes),
      bytes: bytes.byteLength,
      category: classifyAssetCategory(relPath),
      critical: true,
    };
  });

  // Compute deterministic sync packs using Node crypto
  const buckets = new Map<string, VersionedAssetEntry[]>();
  for (const e of entries) {
    const { packId } = classifyContentPack(e.path);
    const arr = buckets.get(packId) ?? [];
    arr.push(e);
    buckets.set(packId, arr);
  }
  const packs = Array.from(buckets.entries()).map(([packId, items]) => {
    const info = classifyContentPack(items[0].path);
    const sorted = [...items].sort((a, b) => a.path.localeCompare(b.path));
    const digestText = sorted.map((e) => `${e.path}:${e.sha256}:${e.bytes}`).join('\n');
    return {
      id: packId,
      name: info.name,
      kind: info.kind,
      required: info.required,
      version,
      sha256: sha256Hex(digestText),
      totalBytes: sorted.reduce((s, e) => s + e.bytes, 0),
      fileCount: sorted.length,
      paths: sorted.map((e) => e.path),
      minNativeVersion: '1.0.0',
      minAndroidVersionCode: 1,
      schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
    };
  });

  const manifest = validateAssetManifest({
    schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
    version,
    channel: 'production',
    commitSha: 'phase4sha',
    generatedAt: '2026-11-16T04:00:00.000Z',
    minNativeVersion: '1.0.0',
    minAndroidVersionCode: 1,
    totalBytes: entries.reduce((s, e) => s + e.bytes, 0),
    files: entries,
    packs,
    ...overrides,
  });

  return { assets, manifest };
}

test('Phase 4 instrumentation computes FPS & frame-ms percentiles and builds baseline JSON report', () => {
  resetPerfBaseline();

  // Feed 20 rendered frames ranging from 16ms to 42ms
  for (let i = 1; i <= 20; i++) {
    recordFrameSample(15 + i * 1.3);
  }
  recordDprAdaptation(0.85);

  const fpsSeries = [60, 58, 55, 52, 49, 44, 38, 31, 46, 54];
  for (let i = 0; i < fpsSeries.length; i++) {
    publishPerfSnapshot({
      fps: fpsSeries[i],
      avgFrameMs: Math.round((1000 / fpsSeries[i]) * 10) / 10,
      dpr: 0.85,
      drawCalls: 210 + i,
      triangles: 98_000 + i * 100,
      geometries: 420,
      textures: 14,
      heapUsedMb: 120 + i,
      platform: 'android',
      updatedAt: Date.now() + i * 1000,
      residentChunks: 3,
      buildingColliders: 185,
      poolGeometries: 4,
      poolMaterials: 8,
    });
  }

  const summary = getPerfBaselineSummary();
  assert.equal(summary.sampleCount, 10);
  assert.equal(summary.fps.min, 31);
  assert.equal(summary.fps.p50, 49);
  assert.equal(summary.fps.p1, 31);
  assert.ok(summary.frameMs.p95 >= 35);
  assert.equal(summary.dprAdaptations, 1);
  assert.equal(summary.peakHeapUsedMb, 129);
  assert.equal(summary.maxDrawCalls, 219);

  const report = buildAndroidBaselineReport({
    nativeVersion: '1.0.0',
    androidVersionCode: 1,
    currentVersion: '1.0.1',
    channel: 'production',
    storageBackend: 'indexeddb',
    persisted: true,
    usedBytes: 4_500_000,
    quotaBytes: 256_000_000,
    cachedPacks: [
      {
        id: 'region-kanbale',
        activeVersion: '1.0.1',
        previousVersion: '1.0.0',
        totalBytes: 512_000,
        fileCount: 10,
      },
    ],
  });

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.platform, 'android');
  assert.equal(report.app.appId, APP_NATIVE_BASELINE.appId);
  assert.equal(report.steadyState.peakHeapUsedMb, 129);
  assert.equal(report.offlineStorage.backend, 'indexeddb');
  assert.equal(report.offlineStorage.cachedPacks[0].id, 'region-kanbale');
});

test('Phase 4 startup diagnostics survives Android WebView cold kill across wiped sessionStorage', () => {
  const sessionA = createMemoryStorage();
  const persistent = createMemoryStorage();

  // First cold boot crashes mid-startup (never reaches game-ready, no beforeunload)
  const firstRun = new StartupDiagnosticsManager({
    sessionStore: sessionA,
    persistentStore: persistent,
    autoBoot: false,
  });
  firstRun.record('app-boot');
  firstRun.record('canvas-init');
  firstRun.record('building-geom', { regionId: 'kanbale' });
  assert.equal(firstRun.getLastCrash(), null);

  // Android OS kills process -> new cold boot has empty sessionStorage, persistent localStorage intact
  const sessionB = createMemoryStorage();
  const recoveryRun = new StartupDiagnosticsManager({
    sessionStore: sessionB,
    persistentStore: persistent,
    autoBoot: false,
  });
  const crash = recoveryRun.getLastCrash();
  assert.ok(crash, 'Expected crash report recovered from persistent store after sessionStorage loss');
  assert.equal(crash.isConfirmedCrash, true);
  assert.equal(crash.lastCompletedStage, 'building-geom');

  recoveryRun.record('first-frame');
  recoveryRun.record('webgl-context-lost');
  recoveryRun.record('webgl-context-restored');
  recoveryRun.record('game-ready');

  const summary = recoveryRun.getStartupSummary();
  assert.equal(summary.ready, true);
  assert.equal(summary.contextLostCount, 1);
  assert.equal(summary.contextRestoredCount, 1);
  assert.ok(typeof summary.firstFrameMs === 'number');
  assert.ok(typeof summary.timeToReadyMs === 'number');

  // Post-ready streaming checkpoints do not keep bloating startup history, and 200.js / M_ID extension errors are filtered
  const countAfterReady = recoveryRun.getCheckpoints().length;
  recoveryRun.record('map-data-load', { regionId: 'tharsi' });
  recoveryRun.record('building-geom', { regionId: 'tharsi' });
  assert.equal(recoveryRun.getCheckpoints().length, countAfterReady);
  assert.equal(
    isThirdPartyExtensionError({
      message: "TypeError: Cannot read properties of undefined (reading 'M_ID')",
      stack: 'at h (200.js:1:761)\n    at C (200.js:1:1442)',
    }),
    true,
  );
  assert.equal(
    isThirdPartyExtensionError({
      message: 'TypeError: Failed to load game asset',
      filename: '/src/main.tsx',
    }),
    false,
  );
});

test('Phase 4 content pack partitioning, compatibility bounds, and SHA-256 validation', async () => {
  const sampleFiles: VersionedAssetEntry[] = [
    { path: 'index.html', sha256: sha256Hex('html'), bytes: 4, category: 'app-bundle', critical: true },
    { path: 'models/canolia-character.glb', sha256: sha256Hex('char'), bytes: 4, category: 'character-model', critical: true },
    { path: 'models/ghost-woman.glb', sha256: sha256Hex('ghost'), bytes: 5, category: 'ghost-npc', critical: true },
    { path: 'motions/idle.glb', sha256: sha256Hex('idle'), bytes: 4, category: 'shared-motion', critical: false },
    { path: 'map/kanbale/68bfa30f/tiles/000000.json', sha256: sha256Hex('tile0'), bytes: 5, category: 'building-road-data', critical: true },
    { path: 'map/sithar-fields/0431166/manifest.json', sha256: sha256Hex('sithar'), bytes: 6, category: 'map-data', critical: true },
  ];

  const packs = await buildContentPacks(
    sampleFiles,
    {
      version: '1.1.0',
      schemaVersion: 1,
      minNativeVersion: '1.0.0',
      minAndroidVersionCode: 2,
    },
    asyncSha256,
  );

  const ids = packs.map((p) => p.id);
  assert.ok(ids.includes('core-shell'));
  assert.ok(ids.includes('characters-core'));
  assert.ok(ids.includes('npc-ghost'));
  assert.ok(ids.includes('motions-shared'));
  assert.ok(ids.includes('region-kanbale'));
  assert.ok(ids.includes('region-sithar-fields'));

  const kanbalePack = packs.find((p) => p.id === 'region-kanbale')!;
  assert.equal(kanbalePack.required, false);

  // Blocked on old native APK versionCode = 1 when pack requires versionCode = 2
  const blocked = checkContentPackCompatibility(kanbalePack, {
    nativeVersion: '1.0.0',
    androidVersionCode: 1,
    schemaVersion: 1,
    currentVersion: '1.0.0',
    channel: 'production',
  });
  assert.equal(blocked.compatible, false);
  assert.equal(blocked.requiresNativeApk, true);

  // Allowed when native APK meets versionCode >= 2
  const allowed = checkContentPackCompatibility(kanbalePack, {
    nativeVersion: '1.0.0',
    androidVersionCode: 2,
    schemaVersion: 1,
    currentVersion: '1.0.0',
    channel: 'production',
  });
  assert.equal(allowed.compatible, true);
  assert.equal(allowed.updateAvailable, true);
});

test('Phase 4 per-pack delta caching, corrupt pack rejection, rollback, and budget preservation', async () => {
  const blobStore = new InMemoryAssetBlobStore();
  const metaStore = new InMemoryAssetMetadataStore();

  const v1 = makePackManifest('1.0.1', {
    'index.html': 'shell-v1',
    'map/kanbale/v1/manifest.json': 'kanbale-manifest-v1',
    'map/kanbale/v1/tiles/000000.json': 'kanbale-tile0-v1',
    'models/canolia-character.glb': 'character-v1',
  });

  const v2 = makePackManifest('1.0.2', {
    'index.html': 'shell-v1',
    'map/kanbale/v1/manifest.json': 'kanbale-manifest-v1', // unchanged hash -> reused!
    'map/kanbale/v1/tiles/000000.json': 'kanbale-tile0-v2-updated',
    'models/canolia-character.glb': 'character-v1',
  });

  let activeAssets = v1.assets;
  let corruptTile = false;

  const manager = new AssetCacheManager({
    blobStore,
    metadataStore: metaStore,
    hashBytes: asyncSha256,
    fetcher: async (url) => {
      const pathPart = new URL(url).pathname.replace(/^\/+/, '');
      const bytes = activeAssets.get(pathPart);
      if (!bytes) return new Response('not found', { status: 404 });
      if (corruptTile && pathPart.endsWith('000000.json')) {
        return new Response(new Uint8Array(Buffer.from('CORRUPT-BYTES-XXXXXX-YYY', 'utf8')), { status: 200 });
      }
      return new Response(bytes.slice().buffer, { status: 200 });
    },
  });

  const localNative = {
    nativeVersion: '1.0.0',
    androidVersionCode: 1,
    schemaVersion: 1,
    currentVersion: '1.0.1',
    channel: 'production' as const,
  };

  // 1. Sync only Kanbale pack v1.0.1 -> characters & shell remain untouched/unpacked
  const sync1 = await manager.syncPack(v1.manifest, 'region-kanbale', {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
    codeVersion: '1.0.1',
    localNative,
  });
  assert.equal(sync1.downloadedFiles, 2);
  assert.equal(sync1.reusedFiles, 0);
  const resolvedV1 = await manager.resolveActiveAsset('map/kanbale/v1/tiles/000000.json');
  assert.equal(Buffer.from(resolvedV1!.bytes).toString('utf8'), 'kanbale-tile0-v1');
  assert.equal(await manager.resolveActiveAsset('models/canolia-character.glb'), null);

  // 2. Corrupt download on v1.0.2 is rejected & active v1.0.1 stays intact
  activeAssets = v2.assets;
  corruptTile = true;
  await assert.rejects(
    () =>
      manager.syncPack(v2.manifest, 'region-kanbale', {
        assetBaseUrl: 'https://mm-region-game.vercel.app',
        codeVersion: '1.0.2',
        localNative,
      }),
    /SHA-256 mismatch/,
  );
  const stillV1 = await manager.resolveActiveAsset('map/kanbale/v1/tiles/000000.json');
  assert.equal(Buffer.from(stillV1!.bytes).toString('utf8'), 'kanbale-tile0-v1');

  // 3. Valid delta update v1.0.2 reuses unchanged manifest file and downloads only changed tile
  corruptTile = false;
  const sync2 = await manager.syncPack(v2.manifest, 'region-kanbale', {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
    codeVersion: '1.0.2',
    localNative,
  });
  assert.equal(sync2.reusedFiles, 1);
  assert.equal(sync2.downloadedFiles, 1);
  assert.equal((await manager.verifyActiveIntegrity()).ok, true);
  const resolvedV2 = await manager.resolveActiveAsset('map/kanbale/v1/tiles/000000.json');
  assert.equal(Buffer.from(resolvedV2!.bytes).toString('utf8'), 'kanbale-tile0-v2-updated');

  // 4. Pack rollback restores v1.0.1 atomically without losing cached pack
  const rolled = await manager.rollbackPack('region-kanbale');
  assert.ok(rolled);
  assert.equal(rolled.version, '1.0.1');
  const afterRollback = await manager.resolveActiveAsset('map/kanbale/v1/tiles/000000.json');
  assert.equal(Buffer.from(afterRollback!.bytes).toString('utf8'), 'kanbale-tile0-v1');

  // 5. Required pack eviction is refused cleanly unless forced; optional pack clears back to APK fallback
  await manager.syncPack(v1.manifest, 'core-shell', {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
    codeVersion: '1.0.1',
    localNative,
  });
  await assert.rejects(() => manager.evictPack('core-shell'), /Cannot evict required/);
  assert.equal(await manager.evictPack('region-kanbale'), true);
  assert.equal(await manager.resolveActiveAsset('map/kanbale/v1/tiles/000000.json'), null);
});

test('Phase 4 OtaCoordinator exposes pack download, rollback, and IndexedDb fallback safety', async () => {
  const idbFallback = new IndexedDbAssetBlobStore();
  assert.equal(await idbFallback.get('deadbeef'.repeat(8)), null);
  assert.equal(await idbFallback.has('deadbeef'.repeat(8)), false);
  assert.deepEqual(await idbFallback.list(), []);

  const v1 = makePackManifest('1.0.1', {
    'index.html': 'shell',
    'map/kanbale/v1/tiles/000000.json': 'tile-from-ota',
  });

  const mockFetcher = async (url: string) => {
    const pathPart = new URL(url).pathname.replace(/^\/+/, '');
    if (pathPart === 'ota/asset-manifest.json') {
      return new Response(JSON.stringify(v1.manifest), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const bytes = v1.assets.get(pathPart);
    if (!bytes) return new Response('missing', { status: 404 });
    return new Response(bytes.slice().buffer, { status: 200 });
  };

  const blobStore = new InMemoryAssetBlobStore();
  const metaStore = new InMemoryAssetMetadataStore();
  const cacheManager = new AssetCacheManager({
    blobStore,
    metadataStore: metaStore,
    hashBytes: asyncSha256,
    fetcher: mockFetcher,
  });

  const bridge: NativeUpdaterBridge = {
    notifyAppReady: async () => {},
    current: async () => ({
      native: '1.0.0',
      bundle: { id: 'builtin', version: '', downloaded: '', checksum: '', status: 'success' } as BundleInfo,
    }),
    list: async () => ({ bundles: [] }),
    download: async () => ({ id: 'b1', version: '1.0.1', downloaded: '', checksum: '', status: 'pending' } as BundleInfo),
    next: async () => ({ id: 'b1', version: '1.0.1', downloaded: '', checksum: '', status: 'pending' } as BundleInfo),
    set: async () => {},
    reset: async () => {},
    addListener: async () => ({ remove: async () => {} }),
  };

  const coord = new OtaCoordinator({
    isNativeAndroidPlatform: () => true,
    nativeUpdater: bridge,
    assetCacheManager: cacheManager,
    getOnline: () => true,
    subscribeOnline: () => () => {},
    updateBaseUrl: 'https://mm-region-game.vercel.app',
    fetcher: mockFetcher,
  });

  await coord.initialize();
  await coord.downloadContentPack('region-kanbale');
  assert.equal(coord.getState().lastError, null);
  assert.equal(coord.getState().phase, 'up_to_date');
  assert.ok(
    coord.getState().contentPacks.some((p) => p.id === 'region-kanbale' && p.cachedVersion === '1.0.1'),
  );
  const verified = await coord.verifyOfflineIntegrity();
  assert.equal(verified.ok, true);
  assert.equal(verified.offlineFallbackReady, true);

  await coord.rollbackContentPack('region-kanbale');
  assert.equal(coord.getState().phase, 'rolled_back');
  assert.equal(await cacheManager.resolveActiveAsset('map/kanbale/v1/tiles/000000.json'), null);
  coord.dispose();
});

test('Phase 4 Android release build enables R8 code/resource shrinking and preserves Capacitor/Capgo bridge classes', () => {
  const buildGradle = readFileSync(join(ROOT, 'android/app/build.gradle'), 'utf8');
  assert.ok(buildGradle.includes('minifyEnabled true'), 'Expected release minifyEnabled true');
  assert.ok(buildGradle.includes('shrinkResources true'), 'Expected release shrinkResources true');

  const proguard = readFileSync(join(ROOT, 'android/app/proguard-rules.pro'), 'utf8');
  assert.ok(proguard.includes('com.mmregion.town3d.**'), 'ProGuard must keep MainActivity package');
  assert.ok(proguard.includes('com.getcapacitor.**'), 'ProGuard must keep Capacitor bridge');
  assert.ok(proguard.includes('ee.forgr.capacitor_updater.**'), 'ProGuard must keep Capgo updater');
});
