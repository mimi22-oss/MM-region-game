import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import {
  DEFAULT_INTRO_DURATION_SEC,
  DEFAULT_INTRO_SETTINGS,
  REDUCED_MOTION_DURATION_SEC,
  clampIntroDuration,
  loadIntroSettings,
  normalizeIntroSettings,
  resolveIntroBehavior,
  saveIntroSettings,
  shouldPlayIntro,
  type IntroSettings,
  type IntroSettingsStorage,
} from '../src/game/IntroSettings.ts';
import {
  completeIntro,
  getIntroState,
  isIntroHighAltitude,
  isIntroOwningCamera,
  resetIntroState,
  skipIntro,
  stageForProgress,
  startIntro,
  stepIntro,
  type IntroTarget,
} from '../src/game/IntroStateMachine.ts';
import {
  computeThirdPersonCameraPose,
  createIntroCameraPath,
  warpIntroProgress,
  type IntroObstacleBox,
} from '../src/game/IntroCameraPath.ts';
import { MAP_DESTINATIONS } from '../src/game/locationDetect.ts';
import { ward } from '../src/data/ward.ts';

function createMemoryStorage(): IntroSettingsStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

const sampleTarget: IntroTarget = {
  id: 'myothar-center',
  label: 'မြို့သာရပ်ကွက်',
  title: 'မြို့သာရပ်ကွက် · ကလေးမြို့',
  subtitle: 'ဗဟိုနေရာ',
  x: ward.spawn.x,
  z: ward.spawn.z,
  yaw: ward.spawnYaw,
  pitch: -0.12,
  distance: ward.spawnZoom,
};

test('IntroSettings defaults (~7s), clamping, storage roundtrip, and playback modes', () => {
  assert.equal(DEFAULT_INTRO_DURATION_SEC, 7);
  assert.equal(DEFAULT_INTRO_SETTINGS.mode, 'every-entry');

  const storage = createMemoryStorage();
  const initial = loadIntroSettings(storage);
  assert.deepEqual(initial, DEFAULT_INTRO_SETTINGS);

  const custom: IntroSettings = {
    mode: 'travel-entry',
    durationSec: 25, // Clamped to max
    respectReducedMotion: true,
    hasCompletedFirstEntry: false,
  };
  saveIntroSettings(custom, storage);
  const reloaded = loadIntroSettings(storage);
  assert.equal(reloaded.mode, 'travel-entry');
  assert.equal(reloaded.durationSec, clampIntroDuration(25));
  assert.equal(reloaded.durationSec <= 14, true);

  // Mode matrix checks
  assert.equal(shouldPlayIntro('entry', { ...DEFAULT_INTRO_SETTINGS, mode: 'first-entry', hasCompletedFirstEntry: false }), true);
  assert.equal(shouldPlayIntro('entry', { ...DEFAULT_INTRO_SETTINGS, mode: 'first-entry', hasCompletedFirstEntry: true }), false);
  assert.equal(shouldPlayIntro('travel', { ...DEFAULT_INTRO_SETTINGS, mode: 'first-entry', hasCompletedFirstEntry: false }), false);

  assert.equal(shouldPlayIntro('entry', { ...DEFAULT_INTRO_SETTINGS, mode: 'every-entry', hasCompletedFirstEntry: true }), true);
  assert.equal(shouldPlayIntro('travel', { ...DEFAULT_INTRO_SETTINGS, mode: 'every-entry', hasCompletedFirstEntry: true }), false);

  assert.equal(shouldPlayIntro('travel', { ...DEFAULT_INTRO_SETTINGS, mode: 'travel-entry', hasCompletedFirstEntry: true }), true);
  assert.equal(shouldPlayIntro('entry', { ...DEFAULT_INTRO_SETTINGS, mode: 'travel-entry', hasCompletedFirstEntry: true }), false);
  assert.equal(shouldPlayIntro('entry', { ...DEFAULT_INTRO_SETTINGS, mode: 'travel-entry', hasCompletedFirstEntry: false }), true);

  assert.equal(shouldPlayIntro('entry', { ...DEFAULT_INTRO_SETTINGS, mode: 'off' }), false);
  assert.equal(shouldPlayIntro('travel', { ...DEFAULT_INTRO_SETTINGS, mode: 'off' }), false);
  assert.equal(shouldPlayIntro('entry', DEFAULT_INTRO_SETTINGS, { diagnosticDisabled: true }), false);

  // Reduced-motion handling
  assert.equal(resolveIntroBehavior('entry', DEFAULT_INTRO_SETTINGS, { reducedMotion: true }), 'reduced-settle');
  assert.equal(
    resolveIntroBehavior('entry', normalizeIntroSettings({ respectReducedMotion: false }), { reducedMotion: true }),
    'cinematic',
  );
});

test('IntroStateMachine steps cleanly through all 6 stages, preserves single camera owner, and handles skip', () => {
  resetIntroState();
  assert.equal(isIntroOwningCamera(), false);
  assert.equal(getIntroState().stage, 'idle');

  const started = startIntro(sampleTarget, 'entry', { durationSec: 7, reducedMotion: false });
  assert.equal(started.active, true);
  assert.equal(started.ownerId, 'intro');
  assert.equal(isIntroOwningCamera(), true);
  assert.equal(isIntroHighAltitude(), true);
  assert.equal(started.stage, 'regional-overview');

  // Verify stage progression mapping across [0..1]
  assert.equal(stageForProgress(0.05), 'regional-overview');
  assert.equal(stageForProgress(0.30), 'town-approach');
  assert.equal(stageForProgress(0.55), 'ward-descent');
  assert.equal(stageForProgress(0.76), 'neighborhood-flyover');
  assert.equal(stageForProgress(0.90), 'player-reveal');
  assert.equal(stageForProgress(0.98), 'handoff');

  // Step through full 7-second timeline (0.1s ticks = clamped dt ceiling)
  const visitedStages = new Set<string>([getIntroState().stage]);
  let guard = 0;
  let reachedEnd = false;
  while (guard < 120 && !reachedEnd) {
    const res = stepIntro(0.1);
    visitedStages.add(res.stage);
    reachedEnd = res.reachedEnd;
    guard++;
  }
  assert.equal(reachedEnd, true);
  assert.ok(visitedStages.has('regional-overview'));
  assert.ok(visitedStages.has('town-approach'));
  assert.ok(visitedStages.has('ward-descent'));
  assert.ok(visitedStages.has('neighborhood-flyover'));
  assert.ok(visitedStages.has('player-reveal'));
  assert.ok(visitedStages.has('handoff'));
  assert.equal(isIntroHighAltitude(), false);

  const done = completeIntro();
  assert.equal(done.active, false);
  assert.equal(done.ownerId, 'player');
  assert.equal(done.stage, 'idle');
  assert.equal(done.lastOutcome, 'completed');
  assert.equal(isIntroOwningCamera(), false);

  // Reduced-motion mode runs short settle duration and exits cleanly on skip
  const rm = startIntro(sampleTarget, 'travel', { reducedMotion: true });
  assert.equal(rm.durationSec, REDUCED_MOTION_DURATION_SEC);
  assert.equal(isIntroHighAltitude(), false);
  const skipped = skipIntro();
  assert.equal(skipped.active, false);
  assert.equal(skipped.ownerId, 'player');
  assert.equal(skipped.lastOutcome, 'skipped');

  resetIntroState();
});

test('IntroCameraPath supports EVERY map destination + spawn, avoids jumps, and matches Player.tsx handoff exactly', () => {
  const allTargets: IntroTarget[] = [
    sampleTarget,
    ...MAP_DESTINATIONS.map((d) => ({
      id: d.id,
      label: d.label,
      title: d.title,
      subtitle: d.subtitle,
      x: d.x,
      z: d.z,
      yaw: d.yaw,
      pitch: d.pitch,
      distance: d.distance,
    })),
  ];

  // Synthetic mountainous terrain profile (simulating hills near Weipula & town plain)
  const sampleTerrain = (x: number, z: number) => {
    const distFromMountain = Math.hypot(x + 380, z - 4425);
    if (distFromMountain < 320) return 140 * Math.max(0, 1 - distFromMountain / 320);
    return 0;
  };

  for (const mobile of [false, true]) {
    for (const target of allTargets) {
      const path = createIntroCameraPath(target, {
        townCenter: { x: ward.spawn.x, z: ward.spawn.z },
        origin: target.id === 'myothar-center' ? null : { x: ward.spawn.x, z: ward.spawn.z },
        sampleSurfaceHeight: sampleTerrain,
        mobile,
      });

      const pos = new Vector3();
      const look = new Vector3();
      const focus = { x: 0, z: 0 };
      const prevPos = new Vector3();

      // Must start high overhead in Stage 1 (> 400m above terrain)
      path.evaluate(0, pos, look, focus, sampleTerrain);
      assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z), `${target.id} t=0 finite`);
      assert.ok(pos.y > sampleTerrain(target.x, target.z) + 400, `${target.id} starts high (${pos.y.toFixed(1)}m)`);

      // Sample 100 steps to verify C1 smoothness & terrain clearance
      let maxStepJump = 0;
      prevPos.copy(pos);
      for (let i = 1; i <= 100; i++) {
        const t = i / 100;
        path.evaluate(t, pos, look, focus, sampleTerrain);
        assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z));
        assert.ok(Number.isFinite(look.x) && Number.isFinite(look.y) && Number.isFinite(look.z));

        const localGround = sampleTerrain(pos.x, pos.z);
        assert.ok(pos.y >= localGround + 0.25, `${target.id} clears ground at t=${t}`);

        const stepDist = pos.distanceTo(prevPos);
        if (stepDist > maxStepJump) maxStepJump = stepDist;
        prevPos.copy(pos);
      }
      assert.ok(maxStepJump < 85, `${target.id} avoids teleport jump (maxStep=${maxStepJump.toFixed(1)})`);

      // Final pose at t = 1 MUST match Player.tsx third-person camera math within floating-point epsilon
      const expected = computeThirdPersonCameraPose(target, sampleTerrain(target.x, target.z));
      assert.ok(pos.distanceTo(expected.position) < 1e-4, `${target.id} terminal position matches Player camera`);
      assert.ok(look.distanceTo(expected.lookAt) < 1e-4, `${target.id} terminal lookAt matches Player camera`);
      assert.ok(Math.hypot(focus.x - target.x, focus.z - target.z) < 1e-4, `${target.id} terminal viewFocus on target`);
    }
  }
});

test('IntroCameraPath elevates smoothly above tall buildings and reducedMotion avoids sweeping arc', () => {
  const tallTower: IntroObstacleBox = {
    x: 45,
    z: 35,
    halfWidth: 28,
    halfDepth: 28,
    topY: 95,
  };
  const path = createIntroCameraPath(sampleTarget, {
    obstacles: [tallTower],
    sampleSurfaceHeight: () => 0,
  });

  const pos = new Vector3();
  const look = new Vector3();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    path.evaluate(t, pos, look);
    if (Math.abs(pos.x - tallTower.x) <= tallTower.halfWidth && Math.abs(pos.z - tallTower.z) <= tallTower.halfDepth && t < 0.92) {
      assert.ok(pos.y > tallTower.topY, `Camera (${pos.y.toFixed(1)}) clears obstacle roof (${tallTower.topY})`);
    }
  }

  // Monotonic warp sanity
  let prevU = 0;
  for (let i = 1; i <= 40; i++) {
    const u = warpIntroProgress(i / 40, false);
    assert.ok(u >= prevU && u <= 1);
    prevU = u;
  }

  // Reduced-motion path stays near player (does not start 500m high)
  const rmPath = createIntroCameraPath(sampleTarget, { reducedMotion: true, sampleSurfaceHeight: () => 0 });
  const rmStart = new Vector3();
  const rmLook = new Vector3();
  rmPath.evaluate(0, rmStart, rmLook);
  assert.ok(rmStart.y < 15, `Reduced motion stays close to ground (${rmStart.y.toFixed(2)}m)`);
  const rmEnd = new Vector3();
  rmPath.evaluate(1, rmEnd, rmLook);
  const expected = computeThirdPersonCameraPose(sampleTarget, 0);
  assert.ok(rmEnd.distanceTo(expected.position) < 1e-4);
});
