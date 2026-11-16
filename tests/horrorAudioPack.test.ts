import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  HORROR_AUDIO_DESCRIPTORS,
  HORROR_AUDIO_IDS,
  resolveHorrorAudioBaseUrl,
  resolveHorrorAudioUrl,
  validateHorrorAudioManifest,
} from '../src/game/audio/HorrorAudioRegistry.ts';
import {
  HorrorAudioAssetLoader,
  createSeamlessLoopBuffer,
} from '../src/game/audio/HorrorAudioAssetLoader.ts';
import {
  GhostAudioEventScheduler,
  horrorPresetToAssetId,
} from '../src/game/audio/GhostAudioEventScheduler.ts';
import {
  inferAssetContentType,
} from '../src/services/assetCacheManager.ts';
import { isOfflineManagedAssetPath } from '../src/services/offlineAssetResolver.ts';

const ROOT = resolve(import.meta.dirname, '..');
const PACK_ROOT = join(ROOT, 'public/assets/audio/horror');

function makeFakeAudioBuffer(length = 48000, sampleRate = 48000) {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) data[i] = Math.sin((i / sampleRate) * 220 * Math.PI * 2) * 0.25;
  return {
    duration: length / sampleRate,
    length,
    numberOfChannels: 1,
    sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

function makeFakeAudioContext() {
  return {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createBuffer(channels: number, length: number, sampleRate: number) {
      const arrays = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        duration: length / sampleRate,
        length,
        numberOfChannels: channels,
        sampleRate,
        getChannelData: (ch: number) => arrays[ch],
      } as unknown as AudioBuffer;
    },
  } as unknown as AudioContext;
}

test('horror audio pack layout has no nested folder and every manifest entry matches disk Ogg/Opus + SHA-256', () => {
  assert.equal(
    existsSync(join(PACK_ROOT, 'mm-region-horror-audio')),
    false,
    'must not contain nested mm-region-horror-audio folder',
  );
  const manifestPath = join(PACK_ROOT, 'manifest.json');
  assert.ok(existsSync(manifestPath), 'manifest.json must exist under public/assets/audio/horror/');

  const rawManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifest = validateHorrorAudioManifest(rawManifest);
  assert.equal(manifest.assets.length, HORROR_AUDIO_IDS.length);

  for (const id of HORROR_AUDIO_IDS) {
    const entry = manifest.assets.find((a) => a.id === id);
    assert.ok(entry, `manifest must include asset ${id}`);
    assert.equal(entry.file, HORROR_AUDIO_DESCRIPTORS[id].file);

    const filePath = join(PACK_ROOT, entry.file);
    assert.ok(existsSync(filePath), `missing audio file ${entry.file}`);
    const bytes = readFileSync(filePath);
    assert.ok(statSync(filePath).size > 1000, `non-empty audio file ${entry.file}`);
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'OggS', `${entry.file} must start with OggS container magic`);
    assert.ok(bytes.includes(Buffer.from('OpusHead')), `${entry.file} must contain OpusHead packet`);

    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, entry.sha256, `sha256 checksum match for ${entry.file}`);
  }
});

test('URL resolution honors configured Vite base URL and blocks unsafe paths', () => {
  assert.equal(resolveHorrorAudioBaseUrl('/'), '/assets/audio/horror/');
  assert.equal(resolveHorrorAudioBaseUrl('/mm-town'), '/mm-town/assets/audio/horror/');
  assert.equal(resolveHorrorAudioBaseUrl('/mm-town/'), '/mm-town/assets/audio/horror/');
  assert.equal(resolveHorrorAudioBaseUrl('./'), './assets/audio/horror/');

  assert.equal(
    resolveHorrorAudioUrl('events/horror-sting.opus', '/sub/'),
    '/sub/assets/audio/horror/events/horror-sting.opus',
  );
  assert.equal(resolveHorrorAudioUrl('manifest.json', '/sub/'), '/sub/assets/audio/horror/manifest.json');

  for (const unsafe of ['../secret.opus', 'https://evil.com/a.opus', '/abs.opus', 'ambience/foo.mp3', 'events/a.opus?x=1']) {
    assert.throws(() => resolveHorrorAudioUrl(unsafe, '/'));
  }

  assert.throws(() => validateHorrorAudioManifest({ pack: 'x', version: '1', codec: 'opus', sampleRateHz: 48000, channels: 1, assets: [] }));
});

test('HorrorAudioAssetLoader deduplicates concurrent loads, caches buffers, avoids startup preloads, and handles decode fallback', async () => {
  const manifestRaw = readFileSync(join(PACK_ROOT, 'manifest.json'), 'utf8');
  const fetchCalls: string[] = [];
  let decodeCalls = 0;
  const ctx = makeFakeAudioContext();

  const loader = new HorrorAudioAssetLoader({
    baseUrl: '/app/',
    getAudioContext: () => ctx,
    detectOpus: () => ({
      supported: true,
      oggOpus: 'probably',
      rawOpus: 'probably',
      mediaSourceOpus: true,
      runtimeDecodeOk: null,
      method: 'dom-audio',
      detail: 'Test browser Opus supported',
    }),
    fetcher: async (url) => {
      fetchCalls.push(url);
      if (url.endsWith('manifest.json')) {
        return new Response(manifestRaw, { status: 200 });
      }
      await new Promise((r) => setTimeout(r, 10));
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
    },
    decodeAudioData: async () => {
      decodeCalls++;
      return makeFakeAudioBuffer();
    },
  });

  // Zero fetches happen before explicitly loading or preloading.
  assert.equal(fetchCalls.length, 0);

  const concurrent = await Promise.all([
    loader.loadBuffer('horror-sting'),
    loader.loadBuffer('horror-sting'),
    loader.loadBuffer('horror-sting'),
  ]);
  assert.ok(concurrent.every(Boolean));
  assert.equal(decodeCalls, 1, 'concurrent loads share one fetch + decode');
  assert.deepEqual(fetchCalls, [
    '/app/assets/audio/horror/manifest.json',
    '/app/assets/audio/horror/events/horror-sting.opus',
  ]);

  // Cached hit requires no additional fetch/decode.
  const secondHit = await loader.loadBuffer('horror-sting');
  assert.ok(secondHit);
  assert.equal(decodeCalls, 1);

  // Seamless loop builder writes equal-power boundary crossfade cleanly.
  const seamless = loader.getSeamlessLoopBuffer('horror-sting');
  assert.ok(seamless);
  assert.ok(seamless.loopStartSec > 0 && seamless.loopEndSec > seamless.loopStartSec);
  const manualSeam = createSeamlessLoopBuffer(ctx, makeFakeAudioBuffer(), 0.25);
  assert.ok(manualSeam.loopStartSec > 0);

  // Decode failure switches Opus runtime status cleanly and returns null without throwing.
  const failingLoader = new HorrorAudioAssetLoader({
    getAudioContext: () => ctx,
    detectOpus: () => ({
      supported: true,
      oggOpus: 'maybe',
      rawOpus: '',
      mediaSourceOpus: false,
      runtimeDecodeOk: null,
      method: 'dom-audio',
      detail: 'Probe ok',
    }),
    fetcher: async (url) => {
      if (url.endsWith('manifest.json')) return new Response(manifestRaw, { status: 200 });
      return new Response(new Uint8Array([9, 8, 7]), { status: 200 });
    },
    decodeAudioData: async () => {
      throw new Error('EncodingError: Unable to decode Opus stream');
    },
  });
  const failed = await failingLoader.loadBuffer('warehouse-drone');
  assert.equal(failed, null);
  const diag = failingLoader.getDiagnostics();
  assert.equal(diag.opusSupport.supported, false);
  assert.equal(diag.opusSupport.runtimeDecodeOk, false);
  assert.ok(diag.lastError?.includes('Unable to decode Opus'));
});

test('Opus offline asset MIME inference and Capacitor offline resolver recognize horror audio pack assets', () => {
  assert.equal(inferAssetContentType('assets/audio/horror/ambience/warehouse-drone.opus'), 'audio/ogg; codecs=opus');
  assert.equal(inferAssetContentType('assets/audio/horror/manifest.json'), 'application/json; charset=utf-8');
  assert.equal(isOfflineManagedAssetPath('/assets/audio/horror/manifest.json'), true);
  assert.equal(isOfflineManagedAssetPath('/assets/audio/horror/events/ghost-grab-impact.opus'), true);
  assert.equal(isOfflineManagedAssetPath('/assets/audio/horror/ghost/spectral-shriek.opus'), true);
});

test('GhostAudioEventScheduler maps presets to Opus pack assets and enforces per-event cooldowns', () => {
  assert.equal(horrorPresetToAssetId('warehouse_creak'), 'rusted-door-creak');
  assert.equal(horrorPresetToAssetId('wood_crack'), 'wood-cracks');
  assert.equal(horrorPresetToAssetId('ghost_footsteps'), 'distant-footsteps');
  assert.equal(horrorPresetToAssetId('ghost_whisper'), 'ghost-whisper');
  assert.equal(horrorPresetToAssetId('ghost_evil_laugh'), 'spectral-cackle');
  assert.equal(horrorPresetToAssetId('ghost_sudden_scream'), 'spectral-shriek');

  const scheduler = new GhostAudioEventScheduler(445);
  const seenAt: Record<string, number[]> = {};
  for (let i = 0; i < 6000; i++) {
    const choice = scheduler.tick(0.1, 14, true, 0);
    if (choice) {
      (seenAt[choice.preset] ??= []).push(i * 0.1);
    }
  }
  for (const preset of ['warehouse_creak', 'wood_crack', 'ghost_footsteps', 'ghost_whisper'] as const) {
    const times = seenAt[preset] ?? [];
    assert.ok(times.length >= 2, `expected repeated ${preset} events`);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      assert.ok(gap >= 9.9, `expected cooldown >=10s between ${preset} events, got ${gap.toFixed(2)}s`);
    }
  }
});
