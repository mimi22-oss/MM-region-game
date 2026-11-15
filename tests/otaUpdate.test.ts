import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { BundleInfo } from '@capgo/capacitor-updater';
import {
  APP_NATIVE_BASELINE,
  checkUpdateCompatibility,
  classifyAssetCategory,
  classifyChangedPathsForRelease,
  compareSemver,
  validateAssetManifest,
  type ChannelReleaseDescriptor,
  type VersionedAssetManifest,
} from '../src/game/otaCompatibility.ts';
import {
  evaluateUpdateApplySafety,
  runAtSafeUpdateBoundary,
} from '../src/game/updateSafety.ts';
import {
  AssetCacheManager,
  InMemoryAssetBlobStore,
  InMemoryAssetMetadataStore,
} from '../src/services/assetCacheManager.ts';
import { isOfflineManagedAssetPath } from '../src/services/offlineAssetResolver.ts';
import {
  OtaCoordinator,
  type NativeUpdaterBridge,
} from '../src/services/otaUpdater.ts';
import { flushGameSave, loadGameSave, writeGameSave } from '../src/game/gameSave.ts';

const ROOT = process.cwd();

function sha256(bytes: Uint8Array | string): string {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes;
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function nodeSha256(bytes: Uint8Array): Promise<string> {
  return sha256(bytes);
}

function makeManifestAndAssets(
  version: string,
  channel: 'production' | 'staging',
  fileContents: Record<string, string>,
  overrides: Partial<VersionedAssetManifest> = {},
): {
  manifest: VersionedAssetManifest;
  manifestJson: string;
  manifestSha256: string;
  assetsByUrlPath: Map<string, Uint8Array>;
} {
  const assetsByUrlPath = new Map<string, Uint8Array>();
  const entries = Object.entries(fileContents).map(([relPath, text]) => {
    const bytes = new Uint8Array(Buffer.from(text, 'utf8'));
    assetsByUrlPath.set(relPath, bytes);
    return {
      path: relPath,
      sha256: sha256(bytes),
      bytes: bytes.byteLength,
      category: classifyAssetCategory(relPath),
      critical: true,
    };
  });
  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  const manifest = validateAssetManifest({
    schemaVersion: APP_NATIVE_BASELINE.otaSchemaVersion,
    version,
    channel,
    commitSha: 'testsha123',
    generatedAt: '2026-11-15T12:00:00.000Z',
    minNativeVersion: '1.0.0',
    minAndroidVersionCode: 1,
    totalBytes,
    files: entries,
    ...overrides,
  });
  const manifestJson = JSON.stringify(manifest);
  return {
    manifest,
    manifestJson,
    manifestSha256: sha256(manifestJson),
    assetsByUrlPath,
  };
}

function makeReleaseDescriptor(
  manifest: VersionedAssetManifest,
  manifestSha256: string,
  overrides: Partial<ChannelReleaseDescriptor> = {},
): ChannelReleaseDescriptor {
  const zipPayload = `ZIP:${manifest.version}:${manifest.channel}`;
  return {
    schemaVersion: manifest.schemaVersion,
    channel: manifest.channel,
    version: manifest.version,
    commitSha: manifest.commitSha,
    releasedAt: manifest.generatedAt,
    bundleUrl: `https://github.com/mimi22-oss/MM-region-game/releases/download/ota-v${manifest.version}/mm-region-ota-${manifest.version}.zip`,
    bundleSha256: sha256(zipPayload),
    bundleBytes: zipPayload.length,
    assetManifestUrl: 'https://mm-region-game.vercel.app/ota/asset-manifest.json',
    assetManifestSha256: manifestSha256,
    minNativeVersion: manifest.minNativeVersion,
    maxNativeVersion: manifest.maxNativeVersion,
    minAndroidVersionCode: manifest.minAndroidVersionCode,
    ...overrides,
  };
}

function createMemoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } as Storage;
}

function createMockNativeUpdater(initialBundle: BundleInfo = {
  id: 'builtin',
  version: '',
  downloaded: '',
  checksum: '',
  status: 'success',
}) {
  const calls: string[] = [];
  let currentBundle = initialBundle;
  let bundles: BundleInfo[] = [initialBundle];
  const listeners = new Map<string, Array<(payload: Record<string, unknown>) => void>>();

  const bridge: NativeUpdaterBridge = {
    async notifyAppReady() {
      calls.push('notifyAppReady');
    },
    async current() {
      calls.push('current');
      return { bundle: currentBundle, native: '1.0.0' };
    },
    async list() {
      calls.push('list');
      return { bundles: [...bundles] };
    },
    async download(opts) {
      calls.push(`download:${opts.version}:${opts.checksum}`);
      const next: BundleInfo = {
        id: `bundle-${opts.version}`,
        version: opts.version,
        downloaded: '2026-11-15T12:00:00.000Z',
        checksum: opts.checksum,
        status: 'pending',
      };
      bundles = [...bundles.filter((b) => b.id !== next.id), next];
      return next;
    },
    async next(opts) {
      calls.push(`next:${opts.id}`);
      return bundles.find((b) => b.id === opts.id) ?? currentBundle;
    },
    async set(opts) {
      calls.push(`set:${opts.id}`);
      const found = bundles.find((b) => b.id === opts.id);
      if (found) currentBundle = { ...found, status: 'success' };
    },
    async reset() {
      calls.push('reset');
      currentBundle = initialBundle;
    },
    async addListener(eventName, listener) {
      const list = listeners.get(eventName) ?? [];
      list.push(listener);
      listeners.set(eventName, list);
      return {
        async remove() {
          const cur = listeners.get(eventName) ?? [];
          listeners.set(
            eventName,
            cur.filter((fn) => fn !== listener),
          );
        },
      };
    },
  };

  return {
    bridge,
    calls,
    emit(eventName: string, payload: Record<string, unknown>) {
      for (const fn of listeners.get(eventName) ?? []) fn(payload);
    },
    setCurrentBundle(b: BundleInfo) {
      currentBundle = b;
    },
    setBundles(nextList: BundleInfo[]) {
      bundles = nextList;
    },
  };
}

function createMemoryMetaStore() {
  let data: Record<string, unknown> | null = null;
  return {
    read() {
      return data ? structuredClone(data) : null;
    },
    write(next: unknown) {
      data = structuredClone(next) as Record<string, unknown>;
    },
  };
}

test('Phase 1 & 4: native vs OTA change classifier separates Android native changes from web/asset updates', () => {
  const webOnly = classifyChangedPathsForRelease([
    'src/components/GhostNpc.tsx',
    'public/models/ghost-woman.glb',
    'public/motions/ghost/freaky.glb',
    'public/map/sithar-fields/0431166f76b83ca83ff0/tiles/0.json',
    'index.html',
  ]);
  assert.equal(webOnly.otaEligible, true);
  assert.equal(webOnly.requiresNativeApk, false);
  assert.equal(webOnly.nativePaths.length, 0);

  const androidModified = classifyChangedPathsForRelease([
    'src/main.tsx',
    'android/app/src/main/AndroidManifest.xml',
  ]);
  assert.equal(androidModified.otaEligible, false);
  assert.equal(androidModified.requiresNativeApk, true);
  assert.deepEqual(androidModified.nativePaths, ['android/app/src/main/AndroidManifest.xml']);

  const nativeDepChanged = classifyChangedPathsForRelease(['package.json'], {
    changedDependencies: ['@capgo/capacitor-updater'],
  });
  assert.equal(nativeDepChanged.requiresNativeApk, true);
  assert.equal(nativeDepChanged.otaEligible, false);

  const docsOnly = classifyChangedPathsForRelease(['docs/ota-and-asset-sync.md', '.github/workflows/release-ota.yml']);
  assert.equal(docsOnly.requiresNativeApk, false);
});

test('Phase 1 & 2 config audit: capacitor.config.ts preserves local bundled entry and vercel.json protects /ota/', () => {
  const capConfig = fs.readFileSync(path.join(ROOT, 'capacitor.config.ts'), 'utf8');
  assert.match(capConfig, /webDir:\s*'dist'/);
  assert.match(capConfig, /androidScheme:\s*'https'/);
  assert.match(capConfig, /cleartext:\s*false/);
  assert.match(capConfig, /allowMixedContent:\s*false/);
  assert.match(capConfig, /autoUpdate:\s*'off'/);
  assert.match(capConfig, /httpsOnly:\s*true/);
  assert.doesNotMatch(capConfig, /url:\s*['"]https:\/\/mm-region-game\.vercel\.app/);

  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(vercelJson.buildCommand, 'npm run build:vercel');
  assert.equal(vercelJson.rewrites[0].source, '/((?!ota/).*)');
  assert.ok(
    vercelJson.headers.some(
      (rule: { source: string; headers: { key: string; value: string }[] }) =>
        rule.source === '/ota/(.*)' &&
        rule.headers.some((h) => h.key.toLowerCase() === 'cache-control' && h.value.includes('no-store')),
    ),
  );
  assert.equal(isOfflineManagedAssetPath('/models/ghost-woman.glb'), true);
  assert.equal(isOfflineManagedAssetPath('/motions/ghost/freaky.glb'), true);
  assert.equal(isOfflineManagedAssetPath('/map/sithar-fields/manifest.json'), true);
  assert.equal(isOfflineManagedAssetPath('/ota/production.json'), false);
});

test('Phase 2 compatibility checks enforce schema, semver native bounds, HTTPS, SHA-256, and downgrade safety', () => {
  assert.equal(compareSemver('1.0', '1.0.0'), 0);
  assert.equal(compareSemver('1.2.0', '1.1.9'), 1);
  assert.equal(compareSemver('1.2.0-staging.1', '1.2.0'), -1);
  assert.equal(compareSemver('1.0.1-staging', '1.0.0'), 1);
  assert.equal(compareSemver('1.0.2', '1.0.1-staging'), 1);

  const { manifest, manifestSha256 } = makeManifestAndAssets('1.1.0', 'production', {
    'index.html': '<html>v1.1</html>',
  });
  const release = makeReleaseDescriptor(manifest, manifestSha256);
  const local = {
    nativeVersion: '1.0.0',
    androidVersionCode: 1,
    schemaVersion: 1,
    currentVersion: '1.0.0',
    channel: 'production' as const,
  };

  assert.equal(checkUpdateCompatibility(release, local).reason, 'compatible');
  assert.equal(
    checkUpdateCompatibility({ ...release, minNativeVersion: '2.0.0' }, local).reason,
    'requires_native_apk',
  );
  assert.equal(
    checkUpdateCompatibility({ ...release, minAndroidVersionCode: 2 }, local).reason,
    'requires_native_apk',
  );
  assert.equal(
    checkUpdateCompatibility({ ...release, schemaVersion: 2 }, local).reason,
    'schema_mismatch',
  );
  assert.equal(
    checkUpdateCompatibility({ ...release, bundleSha256: 'bad' }, local).reason,
    'invalid_checksum',
  );
  assert.equal(
    checkUpdateCompatibility({ ...release, bundleUrl: 'http://insecure.example/a.zip' }, local).reason,
    'invalid_url',
  );
  assert.equal(
    checkUpdateCompatibility({ ...release, version: '0.9.0' }, local).reason,
    'downgrade_blocked',
  );
});

test('Phase 6.1 & 6.2 & 6.3: Fresh offline APK boots immediately, delta-updates when online, then runs offline on new assets', async () => {
  const blobStore = new InMemoryAssetBlobStore();
  const metadataStore = new InMemoryAssetMetadataStore();
  const metaStore = createMemoryMetaStore();
  const native = createMockNativeUpdater();

  const v11 = makeManifestAndAssets('1.1.0', 'production', {
    'index.html': '<html>v1.1</html>',
    'models/ghost-woman.glb': 'GLB-GHOST-V1',
    'motions/ghost/freaky.glb': 'GLB-FREAKY-SHARED',
    'map/sithar-fields/tiles/0.json': '{"roads":1}',
  });
  const r11 = makeReleaseDescriptor(v11.manifest, v11.manifestSha256);

  const fetchedUrls: string[] = [];
  let isOnline = false;
  let activeServerData: { release: ChannelReleaseDescriptor; manifestJson: string; assets: Map<string, Uint8Array> } = {
    release: r11,
    manifestJson: v11.manifestJson,
    assets: v11.assetsByUrlPath,
  };

  const cacheManager = new AssetCacheManager({
    blobStore,
    metadataStore,
    hashBytes: nodeSha256,
    fetcher: async (url) => {
      fetchedUrls.push(url);
      if (!isOnline) throw new Error('Network unreachable');
      const pathname = new URL(url).pathname.replace(/^\/+/, '');
      const bytes = activeServerData.assets.get(pathname);
      if (!bytes) return new Response('Not Found', { status: 404 });
      return new Response(bytes, { status: 200 });
    },
  });

  const coordinator = new OtaCoordinator({
    isNativeAndroidPlatform: () => true,
    nativeUpdater: native.bridge,
    assetCacheManager: cacheManager,
    metaStore,
    getOnline: () => isOnline,
    fetcher: async (url) => {
      fetchedUrls.push(url);
      if (!isOnline) throw new Error('Network unreachable');
      const pathname = new URL(url).pathname.replace(/^\/+/, '');
      if (pathname === 'ota/production.json') {
        return new Response(JSON.stringify(activeServerData.release), { status: 200 });
      }
      if (pathname === 'ota/asset-manifest.json') {
        return new Response(activeServerData.manifestJson, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    },
  });

  // 1. Fresh offline APK launch must call notifyAppReady() and remain healthy offline
  const initState = await coordinator.initialize();
  assert.equal(native.calls[0], 'notifyAppReady');
  assert.equal(initState.phase, 'offline');
  assert.equal(initState.offlineFallbackReady, true);
  assert.equal(await cacheManager.resolveActiveAsset('models/ghost-woman.glb'), null);

  await coordinator.checkForUpdate();
  assert.equal(coordinator.getState().phase, 'offline');
  assert.equal(fetchedUrls.length, 0);

  // 2. Device comes online and pulls v1.1.0
  isOnline = true;
  await coordinator.checkForUpdate();
  assert.equal(coordinator.getState().phase, 'update_available');
  await coordinator.downloadAvailableUpdate();
  assert.equal(coordinator.getState().phase, 'ready_to_restart');
  const apply1 = await coordinator.applyUpdateNow();
  assert.equal(apply1.applied, true);
  assert.equal(await cacheManager.verifyActiveIntegrity().then((r) => r.ok), true);

  // 3. v1.2.0 only changes index.html and models/ghost-woman.glb — motions/ and map/ reuse hashes
  const v12 = makeManifestAndAssets('1.2.0', 'production', {
    'index.html': '<html>v1.2</html>',
    'models/ghost-woman.glb': 'GLB-GHOST-V2',
    'motions/ghost/freaky.glb': 'GLB-FREAKY-SHARED',
    'map/sithar-fields/tiles/0.json': '{"roads":1}',
  });
  activeServerData = {
    release: makeReleaseDescriptor(v12.manifest, v12.manifestSha256),
    manifestJson: v12.manifestJson,
    assets: v12.assetsByUrlPath,
  };
  fetchedUrls.length = 0;

  const coordinatorV12 = new OtaCoordinator({
    isNativeAndroidPlatform: () => true,
    nativeUpdater: native.bridge,
    assetCacheManager: cacheManager,
    metaStore,
    getOnline: () => isOnline,
    fetcher: async (url) => {
      const pathname = new URL(url).pathname.replace(/^\/+/, '');
      if (pathname === 'ota/production.json') {
        return new Response(JSON.stringify(activeServerData.release), { status: 200 });
      }
      if (pathname === 'ota/asset-manifest.json') {
        return new Response(activeServerData.manifestJson, { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    },
  });
  await coordinatorV12.initialize();
  await coordinatorV12.checkForUpdate();
  const deltaCheck = await cacheManager.computeDelta(v12.manifest);
  assert.equal(deltaCheck.reusable.length, 2);
  assert.equal(deltaCheck.toDownload.length, 2);

  await coordinatorV12.downloadAvailableUpdate();
  assert.equal(coordinatorV12.getState().phase, 'ready_to_restart');
  assert.equal(
    fetchedUrls.some((u) => u.includes('motions/ghost/freaky.glb')),
    false,
  );
  assert.equal(
    fetchedUrls.some((u) => u.includes('models/ghost-woman.glb')),
    true,
  );
  await coordinatorV12.applyUpdateNow();

  // 4. Go offline and restart fresh coordinator: v1.2.0 works completely offline without hitting network
  isOnline = false;
  const offlinePostUpdate = new OtaCoordinator({
    isNativeAndroidPlatform: () => true,
    nativeUpdater: native.bridge,
    assetCacheManager: cacheManager,
    metaStore,
    getOnline: () => isOnline,
    fetcher: async () => {
      throw new Error('Offline!');
    },
  });
  const bootedState = await offlinePostUpdate.initialize();
  assert.equal(bootedState.currentVersion, '1.2.0');
  assert.equal(bootedState.phase, 'offline');
  const resolvedGhost = await cacheManager.resolveActiveAsset('/models/ghost-woman.glb');
  assert.ok(resolvedGhost);
  assert.equal(Buffer.from(resolvedGhost.bytes).toString('utf8'), 'GLB-GHOST-V2');
});

test('Phase 6.4 & 6.5: Interrupted download resumes cleanly without corrupting active assets or leaking stale files', async () => {
  const blobStore = new InMemoryAssetBlobStore();
  const metadataStore = new InMemoryAssetMetadataStore();

  const v1 = makeManifestAndAssets('1.0.0', 'production', {
    'index.html': 'v1-html',
    'map/sithar-fields/tiles/0.json': '{"road":"old-v1"}',
  });
  const v2 = makeManifestAndAssets('1.1.0', 'production', {
    'index.html': 'v2-html',
    'map/sithar-fields/tiles/0.json': '{"road":"new-v2"}',
  });

  let dropSecondAsset = false;
  let currentServerMap = v1.assetsByUrlPath;

  const cacheManager = new AssetCacheManager({
    blobStore,
    metadataStore,
    hashBytes: nodeSha256,
    fetcher: async (url) => {
      const pathname = new URL(url).pathname.replace(/^\/+/, '');
      if (dropSecondAsset && pathname.endsWith('tiles/0.json')) {
        throw new Error('Simulated TCP connection drop');
      }
      const bytes = currentServerMap.get(pathname);
      if (!bytes) return new Response('Not Found', { status: 404 });
      return new Response(bytes, { status: 200 });
    },
  });

  await cacheManager.syncToManifest(v1.manifest, {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
  });
  assert.equal(cacheManager.getActiveVersion(), '1.0.0');

  // Switch server to v2 and fail midway after first file
  currentServerMap = v2.assetsByUrlPath;
  dropSecondAsset = true;
  await assert.rejects(
    cacheManager.syncToManifest(v2.manifest, {
      assetBaseUrl: 'https://mm-region-game.vercel.app',
    }),
    /TCP connection drop/,
  );

  // Active generation MUST still be v1.0.0 and intact
  assert.equal(cacheManager.getActiveVersion(), '1.0.0');
  const activeTileDuringFailure = await cacheManager.resolveActiveAsset('map/sithar-fields/tiles/0.json');
  assert.equal(Buffer.from(activeTileDuringFailure!.bytes).toString('utf8'), '{"road":"old-v1"}');
  assert.deepEqual(cacheManager.getState().staging?.completedPaths, ['index.html']);

  // Restore network and resume v2: already-verified index.html is skipped!
  dropSecondAsset = false;
  const resumed = await cacheManager.syncToManifest(v2.manifest, {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
  });
  assert.equal(resumed.resumedFiles, 1);
  assert.equal(resumed.reusedFiles, 1);
  assert.equal(resumed.downloadedFiles, 1);
  assert.equal(cacheManager.getActiveVersion(), '1.1.0');

  // Old cached asset v1 must NOT be returned once v2 is active
  const activeTileAfterResume = await cacheManager.resolveActiveAsset('map/sithar-fields/tiles/0.json');
  assert.equal(Buffer.from(activeTileAfterResume!.bytes).toString('utf8'), '{"road":"new-v2"}');
  assert.equal(activeTileAfterResume!.sha256, v2.manifest.files[1].sha256);
});

test('Phase 6.3 & 6.6: Checksum mismatch rejects corrupt assets and failed bundle startup rolls back automatically', async () => {
  const blobStore = new InMemoryAssetBlobStore();
  const metadataStore = new InMemoryAssetMetadataStore();
  const metaStore = createMemoryMetaStore();

  const v1 = makeManifestAndAssets('1.0.0', 'production', {
    'models/canolia-character.glb': 'VALID-CANOLIA-V1',
  });
  const cacheManager = new AssetCacheManager({
    blobStore,
    metadataStore,
    hashBytes: nodeSha256,
    fetcher: async (url) => {
      const p = new URL(url).pathname.replace(/^\/+/, '');
      if (p.includes('corrupt')) {
        return new Response(Buffer.from('CORRUPTED-BYTES'), { status: 200 });
      }
      const bytes = v1.assetsByUrlPath.get(p);
      return bytes ? new Response(bytes, { status: 200 }) : new Response('404', { status: 404 });
    },
  });

  await cacheManager.syncToManifest(v1.manifest, {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
  });

  // Attempting to sync a manifest whose payload fails SHA-256 must fail cleanly & preserve v1
  const badManifest = validateAssetManifest({
    schemaVersion: 1,
    version: '1.1.0',
    channel: 'production',
    commitSha: 'bad',
    generatedAt: '2026-11-15T12:00:00.000Z',
    minNativeVersion: '1.0.0',
    minAndroidVersionCode: 1,
    totalBytes: 15,
    files: [
      {
        path: 'models/corrupt.glb',
        sha256: sha256('EXPECTED-CLEAN-BYTES'),
        bytes: 15,
        category: 'character-model',
        critical: true,
      },
    ],
  });
  await assert.rejects(
    cacheManager.syncToManifest(badManifest, { assetBaseUrl: 'https://mm-region-game.vercel.app' }),
    /SHA-256 mismatch/,
  );
  assert.equal(cacheManager.getActiveVersion(), '1.0.0');

  // Native rollback simulation: v1.1.0 was applied, native CapacitorUpdater reverted to builtin on boot
  metaStore.write({
    channel: 'production',
    pendingApply: {
      version: '1.1.0',
      bundleId: 'bundle-1.1.0',
      previousVersion: '1.0.0',
      requestedAt: '2026-11-15T12:01:00.000Z',
    },
    rollbackNotification: null,
    lastCheckedAt: null,
  });

  const v11 = makeManifestAndAssets('1.1.0', 'production', {
    'models/canolia-character.glb': 'VALID-CANOLIA-V2',
  });
  const cache2 = new AssetCacheManager({
    blobStore,
    metadataStore,
    hashBytes: nodeSha256,
    fetcher: async (url) => {
      const p = new URL(url).pathname.replace(/^\/+/, '');
      const bytes = v11.assetsByUrlPath.get(p);
      return bytes ? new Response(bytes, { status: 200 }) : new Response('404', { status: 404 });
    },
  });
  await cache2.syncToManifest(v11.manifest, { assetBaseUrl: 'https://mm-region-game.vercel.app' });
  assert.equal(cache2.getActiveVersion(), '1.1.0');

  const nativeWithRollback = createMockNativeUpdater({
    id: 'builtin',
    version: '',
    downloaded: '',
    checksum: '',
    status: 'success',
  });
  nativeWithRollback.setBundles([
    { id: 'builtin', version: '', downloaded: '', checksum: '', status: 'success' },
    { id: 'bundle-1.1.0', version: '1.1.0', downloaded: '', checksum: 'abc', status: 'error' },
  ]);

  const coord = new OtaCoordinator({
    isNativeAndroidPlatform: () => true,
    nativeUpdater: nativeWithRollback.bridge,
    assetCacheManager: cache2,
    metaStore,
    getOnline: () => true,
  });

  const afterBoot = await coord.initialize();
  assert.equal(afterBoot.phase, 'rolled_back');
  assert.ok(afterBoot.rollbackNotification);
  assert.equal(afterBoot.rollbackNotification.failedVersion, '1.1.0');
  assert.equal(afterBoot.currentVersion, '1.0.0');
  assert.equal(cache2.getActiveVersion(), '1.0.0');
});

test('Phase 6: Storage limit never deletes the sole working offline copy', async () => {
  const blobStore = new InMemoryAssetBlobStore();
  const metadataStore = new InMemoryAssetMetadataStore();

  const v1 = makeManifestAndAssets('1.0.0', 'production', {
    'models/canolia-character.glb': '1234567890',
  });
  const cacheManager = new AssetCacheManager({
    blobStore,
    metadataStore,
    maxStorageBytes: 12,
    hashBytes: nodeSha256,
    fetcher: async (url) => {
      const p = new URL(url).pathname.replace(/^\/+/, '');
      const bytes = v1.assetsByUrlPath.get(p);
      return bytes ? new Response(bytes, { status: 200 }) : new Response('404', { status: 404 });
    },
  });

  await cacheManager.syncToManifest(v1.manifest, {
    assetBaseUrl: 'https://mm-region-game.vercel.app',
  });
  assert.equal(cacheManager.getActiveVersion(), '1.0.0');

  const oversized = makeManifestAndAssets('1.1.0', 'production', {
    'models/canolia-character.glb': '1234567890123456',
  });
  await assert.rejects(
    cacheManager.syncToManifest(oversized.manifest, {
      assetBaseUrl: 'https://mm-region-game.vercel.app',
    }),
    /exceeds storage limit/,
  );

  // Sole working offline copy MUST remain intact
  const active = await cacheManager.resolveActiveAsset('models/canolia-character.glb');
  assert.ok(active);
  assert.equal(Buffer.from(active.bytes).toString('utf8'), '1234567890');
});

test('Phase 5 & 6.7: Safe lifecycle boundary blocks interrupts during ghost chase/vehicles and preserves player save', async () => {
  const prevStorage = (globalThis as { window?: { localStorage?: Storage } }).window;
  const mockStorage = createMemoryLocalStorage();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: mockStorage };

  try {
    writeGameSave({
      x: 35.2,
      z: 36.1,
      yaw: 1.4,
      pitch: -0.1,
      zoom: 16,
      topDown: false,
      first: false,
      areaId: 'myothar',
    });

    const ghostBusySafety = evaluateUpdateApplySafety({
      ghostThreatActive: true,
      ghostGrabActive: false,
      ridingMotorcycle: false,
      drivingCar: false,
      ridingBalloon: false,
      introActive: false,
      sceneLoading: false,
    });
    assert.equal(ghostBusySafety.safeToApplyNow, false);
    assert.deepEqual(ghostBusySafety.blockingReasons, ['ghost_chase']);

    const carBusySafety = evaluateUpdateApplySafety({
      ghostThreatActive: false,
      ghostGrabActive: false,
      ridingMotorcycle: false,
      drivingCar: true,
      ridingBalloon: false,
      introActive: false,
      sceneLoading: false,
    });
    assert.equal(carBusySafety.safeToApplyNow, false);
    assert.deepEqual(carBusySafety.blockingReasons, ['car_drive']);

    let appliedCount = 0;
    const deferred = await runAtSafeUpdateBoundary(
      {
        ghostThreatActive: true,
        ghostGrabActive: true,
        ridingMotorcycle: false,
        drivingCar: false,
        ridingBalloon: false,
        introActive: false,
        sceneLoading: false,
      },
      () => flushGameSave(),
      () => {
        appliedCount += 1;
      },
    );
    assert.equal(deferred.applied, false);
    assert.equal(deferred.deferred, true);
    assert.equal(appliedCount, 0);

    const safeResult = await runAtSafeUpdateBoundary(
      {
        ghostThreatActive: false,
        ghostGrabActive: false,
        ridingMotorcycle: false,
        drivingCar: false,
        ridingBalloon: false,
        introActive: false,
        sceneLoading: false,
      },
      () =>
        flushGameSave({
          x: 42.5,
          z: -18.25,
          yaw: 0.75,
          pitch: -0.12,
          zoom: 14,
          topDown: false,
          first: true,
          areaId: 'kanbale',
        }),
      () => {
        appliedCount += 1;
      },
    );
    assert.equal(safeResult.applied, true);
    assert.equal(safeResult.saveFlushed, true);
    assert.equal(appliedCount, 1);

    const loadedSave = loadGameSave();
    assert.ok(loadedSave);
    assert.equal(loadedSave.x, 42.5);
    assert.equal(loadedSave.z, -18.25);
    assert.equal(loadedSave.areaId, 'kanbale');
    assert.equal(loadedSave.first, true);
  } finally {
    if (prevStorage === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = prevStorage;
    }
  }
});

test('Phase 2 & 5 error resilience: HTML fallback (<!doctype html>) and 404 never surface raw JSON SyntaxError or duplicate messages', async () => {
  const htmlFallbackCoord = new OtaCoordinator({
    isNativeAndroidPlatform: () => false,
    nativeUpdater: createMockNativeUpdater().bridge,
    assetCacheManager: new AssetCacheManager({
      blobStore: new InMemoryAssetBlobStore(),
      metadataStore: new InMemoryAssetMetadataStore(),
      hashBytes: nodeSha256,
    }),
    metaStore: createMemoryMetaStore(),
    getOnline: () => true,
    initialVersion: '1.0.0',
    nativeVersion: '1.0.0',
    androidVersionCode: 1,
    fetcher: async () =>
      new Response('<!doctype html><html lang="my"><body>SPA fallback</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
  });

  const htmlState = await htmlFallbackCoord.checkForUpdate();
  assert.equal(htmlState.phase, 'failed');
  assert.ok(htmlState.lastError);
  assert.match(htmlState.lastError, /returned HTML instead of JSON/i);
  assert.doesNotMatch(htmlState.lastError, /Unexpected token/i);
  assert.notEqual(htmlState.statusMessage, htmlState.lastError);

  const notFoundCoord = new OtaCoordinator({
    isNativeAndroidPlatform: () => false,
    nativeUpdater: createMockNativeUpdater().bridge,
    assetCacheManager: new AssetCacheManager({
      blobStore: new InMemoryAssetBlobStore(),
      metadataStore: new InMemoryAssetMetadataStore(),
      hashBytes: nodeSha256,
    }),
    metaStore: createMemoryMetaStore(),
    getOnline: () => true,
    initialVersion: '1.0.0',
    nativeVersion: '1.0.0',
    androidVersionCode: 1,
    fetcher: async () => new Response('Not Found', { status: 404 }),
  });

  const notFoundState = await notFoundCoord.checkForUpdate();
  assert.equal(notFoundState.phase, 'failed');
  assert.ok(notFoundState.lastError);
  assert.match(notFoundState.lastError, /not published yet.*HTTP 404/i);
  assert.notEqual(notFoundState.statusMessage, notFoundState.lastError);
});
