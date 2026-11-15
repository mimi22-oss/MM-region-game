import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearGameSave,
  flushGameSave,
  loadGameSave,
  scheduleGameSave,
  validateGameSave,
  writeGameSave,
} from '../src/game/gameSave.ts';
import { requestAssetEdit } from '../src/game/assetAiEdit.ts';
import { generateCustomAsset } from '../src/game/customAssets.ts';
import { getPerfSnapshot, publishPerfSnapshot, subscribePerfSnapshot } from '../src/game/perfMetrics.ts';
import { QUALITY_PRESET_CONFIGS } from '../src/game/qualityPreset.ts';
import {
  isNetworkOnline,
  setNetworkStateForTest,
  subscribeNetworkState,
} from '../src/services/networkStatus.ts';
import {
  ONLINE_SERVICES,
  createOnlineSyncAdapter,
  openOnlineSubscriptionStore,
} from '../src/services/onlineServices.ts';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

afterEach(() => {
  setNetworkStateForTest({ connected: true, connectionType: 'wifi', source: 'browser' });
});

test('gameSave validates, clamps bounds, round-trips, and clears cleanly', () => {
  assert.equal(validateGameSave(null), null);
  assert.equal(validateGameSave('bad'), null);
  assert.equal(validateGameSave({ version: 2, x: 0, z: 0, yaw: 0, zoom: 6 }), null);
  assert.equal(validateGameSave({ version: 1, x: Number.NaN, z: 0, yaw: 0, zoom: 6 }), null);

  const clamped = validateGameSave(
    {
      version: 1,
      x: 99999,
      z: -99999,
      yaw: 1.25,
      pitch: 5,
      zoom: 0.1,
      topDown: true,
      first: true,
      areaId: 'west-ward',
    },
    { halfWorldSize: 5000, minZoom: 2, maxZoom: 3600 },
  );
  assert.ok(clamped);
  assert.equal(clamped.x, 5000);
  assert.equal(clamped.z, -5000);
  assert.equal(clamped.zoom, 2);
  assert.ok(Math.abs(clamped.pitch - Math.PI / 2) < 1e-6);
  // First-person and top-down are mutually exclusive
  assert.equal(clamped.topDown, true);
  assert.equal(clamped.first, false);

  const store = createMemoryStorage();
  const written = writeGameSave(
    {
      x: 137.55,
      z: 245.26,
      yaw: -0.917,
      pitch: -0.14,
      zoom: 8.5,
      topDown: false,
      first: false,
      areaId: 'west-ward',
    },
    undefined,
    store,
  );
  assert.ok(written);
  const loaded = loadGameSave(undefined, store);
  assert.deepEqual(loaded, written);

  clearGameSave(store);
  assert.equal(loadGameSave(undefined, store), null);
});

test('scheduleGameSave + flushGameSave flushes pending state deterministically', () => {
  scheduleGameSave({
    x: 42,
    z: 84,
    yaw: 0.5,
    pitch: -0.1,
    zoom: 6,
    topDown: false,
    first: false,
    areaId: 'myothar',
  });
  const flushed = flushGameSave();
  assert.ok(flushed);
  assert.equal(flushed.x, 42);
  assert.equal(flushed.z, 84);
  assert.equal(flushGameSave(), null);
});

test('networkStatus notifies subscribers and onlineServices blocks unsafe or offline requests', async () => {
  const seen: boolean[] = [];
  const unsubscribe = subscribeNetworkState(() => {
    seen.push(isNetworkOnline());
  });
  try {
    setNetworkStateForTest({ connected: false, connectionType: 'none' });
    assert.equal(isNetworkOnline(), false);

    const invalidResult = await openOnlineSubscriptionStore('http://subscription-app-nine-phi.vercel.app/');
    assert.deepEqual(invalidResult, {
      opened: false,
      reason: 'invalid-url',
      message: 'Blocked disallowed or non-HTTPS shop URL.',
    });

    const offlineResult = await openOnlineSubscriptionStore('https://subscription-app-nine-phi.vercel.app/');
    assert.equal(offlineResult.opened, false);
    assert.equal(offlineResult.reason, 'offline');

    const sync = createOnlineSyncAdapter();
    assert.deepEqual(await sync.syncProfileSummary({ savedAt: '2026-01-01T00:00:00Z' }), {
      synced: false,
      reason: 'offline',
    });

    setNetworkStateForTest({ connected: true, connectionType: 'wifi' });
    assert.equal(isNetworkOnline(), true);
    assert.deepEqual(seen, [false, true]);
  } finally {
    unsubscribe();
  }

  for (const svc of ONLINE_SERVICES) {
    assert.equal(svc.requiresInternet, true);
    assert.equal(svc.offlineCachePolicy, 'never-cache-sensitive-data');
  }
});

test('offline Gemini AI helpers reject immediately without calling fetch', async () => {
  setNetworkStateForTest({ connected: false, connectionType: 'none' });
  await assert.rejects(
    requestAssetEdit({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      prompt: 'make roof blue',
      assetName: 'House',
      current: { scale: [1, 1, 1] },
    }),
    /Offline mode/,
  );

  await assert.rejects(
    generateCustomAsset({
      key: 'test-key',
      model: 'gemini-2.5-flash',
      prompt: 'wooden kiosk',
    }),
    /Offline mode/,
  );
});

test('perfMetrics and mobile QualityPreset enforce Android resource caps', () => {
  let notified = 0;
  const unsub = subscribePerfSnapshot(() => {
    notified++;
  });
  try {
    publishPerfSnapshot({
      fps: 58,
      avgFrameMs: 17.2,
      dpr: 1,
      drawCalls: 145,
      triangles: 48200,
      geometries: 120,
      textures: 24,
      heapUsedMb: 92.4,
      platform: 'android',
      updatedAt: Date.now(),
    });
    assert.equal(notified, 1);
    assert.equal(getPerfSnapshot().platform, 'android');
    assert.equal(getPerfSnapshot().fps, 58);
  } finally {
    unsub();
  }

  const mob = QUALITY_PRESET_CONFIGS.mobile;
  assert.equal(mob.characterCastShadow, false);
  assert.equal(mob.heroBalloonLight, false);
  assert.equal(mob.maxActiveFestivalZones, 1);
  assert.equal(mob.maxBalloonsPerZone, 32);
  assert.equal(mob.glbMaxTextureSize, 1024);
});
