import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { toWorld, ward } from '../src/data/ward.ts';
import {
  ALL_MP3_SFX_FILES,
  GAME_AUDIO_MAGIC,
  SFX_RETRY_COOLDOWN_MS,
  WAREHOUSE_HORROR_LOOP_AUDIO_FILE,
  WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES,
  WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES,
  WEAPON_GUNSHOT_AUDIO_FILES,
  WEAPON_KNIFE_DRAW_AUDIO_FILES,
  WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES,
  WEAPON_KNIFE_HIT_AUDIO_FILES,
  WEAPON_KNIFE_SLICE_AUDIO_FILES,
  WILDLIFE_DEER_BABY_AUDIO_FILES,
  WILDLIFE_DEER_STAG_AUDIO_FILES,
  WILDLIFE_TIGER_AUDIO_FILES,
  loadSfxBuffer,
  resolvePublicAudioUrl,
  unwrapGameAudioContainer,
} from '../src/game/audio/sfxBufferCache.ts';
import { WarehouseHorrorLoopPlayer } from '../src/game/audio/WarehouseHorrorLoopPlayer.ts';
import { gameAudio } from '../src/game/gameAudio.ts';
import { buildMountainDeerSpawns } from '../src/game/mountainDeerPool.ts';
import { buildMountainRabbitSpawns } from '../src/game/mountainRabbitPool.ts';
import { buildMountainTigerSpawns } from '../src/game/mountainTigerPool.ts';
import {
  MAX_WILDLIFE_CLIP_DURATION_SEC,
  MountainWildlifeAudioController,
  WILDLIFE_CALL_MAX_GAP_SEC,
  WILDLIFE_CALL_MIN_GAP_SEC,
  computeMountainAudioWeight,
  computeNextWildlifeGapSec,
  computeStereoPan,
  findNearestWildlifePoint,
  selectNextWildlifeEvent,
  type MountainWildlifeEventKind,
} from '../src/game/mountainWildlifeAudio.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Mountain wildlife audio stays completely silent in flat town/plains and ramps smoothly to 1 on mountains', () => {
  // Flat town center (Myothar plains) -> 0
  const town = toWorld(0, 0);
  assert.equal(
    computeMountainAudioWeight(town.x, town.z, allPeaks),
    0,
    'Town center must have zero mountain wildlife audio weight',
  );

  // Taungphila mountain plateau -> full 1.0
  const taungphila = toWorld(-580, 260);
  assert.ok(
    computeMountainAudioWeight(taungphila.x, taungphila.z, allPeaks) >= 0.85,
    'Taungphila summit/plateau activates mountain forest & wildlife audio',
  );

  // Western highland plateau -> full 1.0
  const highland = toWorld(-1000, 1800);
  assert.ok(
    computeMountainAudioWeight(highland.x, highland.z, allPeaks) >= 0.85,
    'Western highland plateau activates mountain wildlife audio',
  );

  // Maha Weipula upper mountain -> full 1.0
  const weipula = toWorld(-1500, 5200);
  assert.equal(
    computeMountainAudioWeight(weipula.x, weipula.z, allPeaks),
    1,
    'Maha Weipula mountain activates full mountain wildlife audio',
  );
});

test('Stereo panning accurately places tiger roars and deer calls left/right relative to camera forward', () => {
  // Camera at origin facing -Z (Three.js default forward): +X is right, -X is left
  const rightPan = computeStereoPan(0, 0, 0, -1, 50, 0);
  const leftPan = computeStereoPan(0, 0, 0, -1, -50, 0);
  const centerPan = computeStereoPan(0, 0, 0, -1, 0, -50);

  assert.ok(rightPan > 0.8, `Source to the right should pan positive (got ${rightPan})`);
  assert.ok(leftPan < -0.8, `Source to the left should pan negative (got ${leftPan})`);
  assert.ok(Math.abs(centerPan) < 0.01, `Source straight ahead should pan near 0 (got ${centerPan})`);
});

test('Wildlife event scheduler interleaves ONLY tiger roars, barking deer & deer bellows (no forest ambient sounds)', () => {
  let seed = 1337;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const counts = new Map<MountainWildlifeEventKind, number>();
  let last: MountainWildlifeEventKind | null = null;
  for (let i = 0; i < 300; i++) {
    const ev = selectNextWildlifeEvent(
      rng,
      { mountainWeight: 1, nearestTigerDist: 90, nearestDeerDist: 95 },
      last,
    );
    assert.ok(ev !== null, 'Expected a wildlife call while within tiger/deer range');
    counts.set(ev, (counts.get(ev) ?? 0) + 1);
    last = ev;
  }

  assert.equal(counts.size, 3, 'Only tiger-roar, barking-deer, and deer-bellow events are scheduled');
  for (const kind of ['tiger-roar', 'barking-deer', 'deer-bellow'] as const) {
    assert.ok(
      (counts.get(kind) ?? 0) >= 40,
      `Expected natural share of ${kind} calls (got ${counts.get(kind) ?? 0})`,
    );
  }
});

test('No call is scheduled outside the wildlife call ranges (forest ambience removed)', () => {
  for (const roll of [0, .25, .5, .75, .999]) {
    const event = selectNextWildlifeEvent(() => roll, {
      mountainWeight: 1, nearestTigerDist: Infinity, nearestDeerDist: 420,
    }, null);
    assert.equal(event, null);
  }
});

test('Wildlife calls enforce a calm random 12-24s quiet gap and capped clip duration (no rapid overlapping calls)', () => {
  assert.ok(WILDLIFE_CALL_MIN_GAP_SEC >= 12);
  assert.ok(WILDLIFE_CALL_MAX_GAP_SEC >= 20);
  assert.ok(MAX_WILDLIFE_CLIP_DURATION_SEC <= 5.5);
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    const gap = computeNextWildlifeGapSec(() => r);
    assert.ok(
      gap >= WILDLIFE_CALL_MIN_GAP_SEC && gap <= WILDLIFE_CALL_MAX_GAP_SEC,
      `Gap must be within ${WILDLIFE_CALL_MIN_GAP_SEC}..${WILDLIFE_CALL_MAX_GAP_SEC}s (got ${gap})`,
    );
  }
});

test('MountainWildlifeAudioController tracks nearest live tiger/deer safely in headless environments and disposes cleanly', () => {
  const rabbits = buildMountainRabbitSpawns(allPeaks);
  const deer = buildMountainDeerSpawns(allPeaks);
  const tigers = buildMountainTigerSpawns(allPeaks, rabbits, deer);

  const ctrl = new MountainWildlifeAudioController();
  const sampleTiger = tigers[0];
  assert.ok(sampleTiger, 'At least one mountain tiger exists');

  const nearest = findNearestWildlifePoint(sampleTiger.homeX + 10, sampleTiger.homeZ, tigers);
  assert.ok(nearest.dist <= 10.01, `Finds nearest tiger accurately (got ${nearest.dist.toFixed(2)}m)`);

  // Step while standing on mountain near a tiger (headless Node has no AudioContext; must never throw)
  const st = ctrl.step(
    0.15,
    sampleTiger.homeX + 12,
    sampleTiger.homeZ,
    0,
    -1,
    allPeaks,
    tigers,
    deer,
  );
  assert.ok(st.mountainWeight >= 0.6, `Mountain weight active near tiger (got ${st.mountainWeight})`);
  assert.ok(st.nearestTigerDist <= 12.1);
  assert.ok(st.nearestTigerPan < -0.5, 'Tiger to the left pans left');

  // Step in town plains -> mountainWeight drops to 0
  const town = toWorld(0, 0);
  const townSt = ctrl.step(0.15, town.x, town.z, 0, -1, allPeaks, tigers, deer);
  assert.equal(townSt.mountainWeight, 0);

  ctrl.dispose();
  // Safe after dispose
  ctrl.step(0.15, sampleTiger.homeX, sampleTiger.homeZ, 0, -1, allPeaks, tigers, deer);
});

test('All 14 wildlife, weapon and warehouse audio assets are packed as anti-IDM .mta containers and unwrap to valid MP3 audio', () => {
  assert.equal(WILDLIFE_TIGER_AUDIO_FILES.length, 3);
  assert.equal(WILDLIFE_DEER_BABY_AUDIO_FILES.length, 1);
  assert.equal(WILDLIFE_DEER_STAG_AUDIO_FILES.length, 1);
  assert.equal(WEAPON_GUNSHOT_AUDIO_FILES.length, 2);
  assert.equal(WEAPON_KNIFE_DRAW_AUDIO_FILES.length, 1);
  assert.equal(WEAPON_KNIFE_SLICE_AUDIO_FILES.length, 1);
  assert.equal(WEAPON_KNIFE_HIT_AUDIO_FILES.length, 1);
  assert.equal(WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES.length, 1);
  assert.equal(WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES.length, 1);
  assert.equal(WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES.length, 1);
  assert.ok(WAREHOUSE_HORROR_LOOP_AUDIO_FILE.endsWith('arctsound-horror-576085.mta'));
  assert.equal(ALL_MP3_SFX_FILES.length, 14);

  for (const rel of ALL_MP3_SFX_FILES) {
    assert.ok(rel.endsWith('.mta'), `Asset must use non-media .mta extension (got ${rel})`);
    assert.ok(!rel.toLowerCase().includes('.mp3'), `URL must not expose .mp3 extension (${rel})`);
    const abs = path.resolve(process.cwd(), 'public', rel);
    assert.ok(fs.existsSync(abs), `Missing packed audio asset on disk: ${abs}`);
    const raw = fs.readFileSync(abs);
    assert.ok(raw.length > 10_000, `Audio asset unexpectedly small (${raw.length} bytes): ${rel}`);
    // Verify packed header starts with MTGA (NOT raw ID3 / MPEG frame sync)
    assert.deepEqual(
      [raw[0], raw[1], raw[2], raw[3]],
      [...GAME_AUDIO_MAGIC],
      `Packed file must begin with MTGA magic header: ${rel}`,
    );

    // Verify in-memory unwrapping restores valid MP3 header ("ID3" or MPEG frame sync 0xFF 0xE0+)
    const unwrapped = new Uint8Array(unwrapGameAudioContainer(raw));
    const isId3 = unwrapped[0] === 0x49 && unwrapped[1] === 0x44 && unwrapped[2] === 0x33;
    const isMpegSync = unwrapped[0] === 0xff && (unwrapped[1] & 0xe0) === 0xe0;
    assert.ok(isId3 || isMpegSync, `Unwrapped payload must be valid MP3 audio: ${rel}`);
    assert.equal(resolvePublicAudioUrl(rel), `/${rel}`);
  }
});

test('A warehouse decode failure backs off and leaves playback recoverable', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const fetchSound = t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1, 2, 3])));
  let decodeAttempts = 0;
  let starts = 0;
  const context = {
    state: 'running',
    currentTime: 1,
    async decodeAudioData() {
      if (++decodeAttempts === 1) throw new Error('Audio decoder unavailable');
      return { length: 1 };
    },
    createGain: () => ({ gain: { value: 0, setTargetAtTime() {} }, connect() {}, disconnect() {} }),
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() { starts++; }, stop() {} }),
  } as unknown as AudioContext;
  const previousContext = gameAudio.context;
  const previousAmbience = gameAudio.ambience;
  gameAudio.context = context;
  gameAudio.ambience = context.createGain();
  const player = new WarehouseHorrorLoopPlayer();
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

  try {
    assert.equal(player.update(true, 0.5, 0.1).sources, 0);
    await settle();
    assert.equal(decodeAttempts, 1, 'Failed playback does not immediately start another decode');
    assert.equal(await loadSfxBuffer(context, WAREHOUSE_HORROR_LOOP_AUDIO_FILE), null);
    for (let i = 0; i < 30; i++) player.update(true, 0.5, 0.1);
    await settle();
    assert.equal(decodeAttempts, 1);

    t.mock.timers.tick(SFX_RETRY_COOLDOWN_MS);
    player.update(true, 0.5, 0.1);
    await settle();
    assert.equal(decodeAttempts, 2);
    assert.equal(fetchSound.mock.callCount(), 1, 'The retry can reuse the downloaded bytes');
    assert.equal(player.update(true, 0.5, 0.1).sources, 1);
    assert.equal(starts, 1);
  } finally {
    player.dispose();
    gameAudio.context = previousContext;
    gameAudio.ambience = previousAmbience;
  }
});
