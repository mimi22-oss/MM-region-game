import assert from 'node:assert/strict';
import test from 'node:test';
import { toWorld } from '../src/data/ward.ts';
import {
  BRIDGE_FALL_MAX_DURATION_SEC,
  checkBridgeFallTrigger,
  createBridgeFallState,
  isMountainBridgeZone,
  resetBridgeFall,
  stepBridgeFall,
  syncBridgeFallAnchor,
  type BridgeFallMode,
} from '../src/game/bridgeFall.ts';
import {
  completePlayerRespawn,
  getPlayerDeathState,
  killPlayerFromBridgeFall,
  requestPlayerRespawn,
} from '../src/game/playerDeath.ts';

test('isMountainBridgeZone covers Taungphila, Western Spine, Weipula Junction, and Maha Weipula Summit', () => {
  const taungphila = toWorld(-509.13, 305.616);
  const ridge = toWorld(-704, 2400);
  const junction = toWorld(-772.322, 4552.174);
  const summit = toWorld(-1560, 6120);
  const town = toWorld(0, 120);

  assert.equal(isMountainBridgeZone(taungphila.x, taungphila.z), true);
  assert.equal(isMountainBridgeZone(ridge.x, ridge.z), true);
  assert.equal(isMountainBridgeZone(junction.x, junction.z), true);
  assert.equal(isMountainBridgeZone(summit.x, summit.z), true);
  assert.equal(isMountainBridgeZone(town.x, town.z), false);
});

test('Falling off a mountain bridge triggers Game Over across all 4 modes (walking, horse, motorcycle, car)', () => {
  const bridgePt = toWorld(-504, 306);
  const modes: BridgeFallMode[] = ['walking', 'horse', 'motorcycle', 'car'];

  for (const mode of modes) {
    const bf = createBridgeFallState();
    // Standing/riding on elevated Taungphila bridge at y = 68m
    syncBridgeFallAnchor(bf, bridgePt.x, 68, bridgePt.z);

    // Step 0.6m sideways off bridge edge -> ground suddenly drops to y = 12m (56m drop!)
    const triggered = checkBridgeFallTrigger(bf, {
      x: bridgePt.x + 0.6,
      z: bridgePt.z,
      groundY: 12,
      actorY: 12,
      yaw: 0.4,
      mode,
      airborne: false,
      dt: 0.016,
    });
    assert.equal(triggered, true, `${mode} stepping off 56m bridge must trigger fall`);
    assert.equal(bf.active, true);
    assert.equal(bf.mode, mode);

    // Simulate gravity plummet until impact (or bounded max duration)
    let impacted = false;
    let dropMeters = 0;
    let seq = 0;
    for (let i = 0; i < 60 && !impacted; i++) {
      const res = stepBridgeFall(bf, 0.04, () => 12);
      if (res.impacted) {
        impacted = true;
        dropMeters = res.dropMeters;
        seq = res.seq;
      }
    }
    assert.equal(impacted, true, `${mode} bridge fall must reach impact`);
    assert.ok(bf.elapsed <= BRIDGE_FALL_MAX_DURATION_SEC + 0.05);
    assert.ok(dropMeters >= 50, `${mode} dropMeters should reflect bridge height (got ${dropMeters})`);

    // Wire into playerDeath -> Game Over -> Respawn lifecycle
    const killed = killPlayerFromBridgeFall(dropMeters, mode, seq + 100);
    assert.equal(killed, true);
    assert.equal(getPlayerDeathState().phase, 'dead');
    assert.equal(getPlayerDeathState().ghostId, `bridge-fall:${mode}`);
    assert.equal(getPlayerDeathState().fallMeta?.mode, mode);
    assert.equal(getPlayerDeathState().fallMeta?.dropMeters, dropMeters);

    requestPlayerRespawn();
    assert.equal(getPlayerDeathState().phase, 'respawning');
    completePlayerRespawn();
    assert.equal(getPlayerDeathState().phase, 'alive');
    assert.equal(getPlayerDeathState().fallMeta, null);
  }
});

test('Jumping off a mountain bridge on foot or horseback also triggers bridge fall Game Over', () => {
  const bridgePt = toWorld(-772.322, 4552.174); // y ≈ 135m Weipula Junction viaduct
  const bf = createBridgeFallState();
  syncBridgeFallAnchor(bf, bridgePt.x, 135, bridgePt.z);

  // Jump upward from bridge at y = 135m -> apex 137m -> descend past edge over 40m valley
  assert.equal(
    checkBridgeFallTrigger(bf, {
      x: bridgePt.x + 1.0,
      z: bridgePt.z,
      groundY: 40,
      actorY: 136.5,
      yaw: 0,
      mode: 'horse',
      airborne: true,
      currentVy: 2.0,
      dt: 0.04,
    }),
    false,
    'jumping upward near apex has not dropped below takeoff yet',
  );

  const triggered = checkBridgeFallTrigger(bf, {
    x: bridgePt.x + 2.2,
    z: bridgePt.z,
    groundY: 40,
    actorY: 132.0,
    yaw: 0,
    mode: 'horse',
    airborne: true,
    currentVy: -7.0,
    dt: 0.04,
  });
  assert.equal(triggered, true, 'descending past bridge edge over deep drop triggers lethal fall');
  assert.equal(bf.active, true);
  assert.ok(bf.dropMeters >= 90);
});

test('No false positives: steep normal downhill roads, 2F town buildings, and teleports do NOT trigger Game Over', () => {
  const bridgePt = toWorld(-772.322, 4552.174);
  const bf = createBridgeFallState();
  syncBridgeFallAnchor(bf, bridgePt.x, 135, bridgePt.z);

  // 1. Fast downhill motorcycle ride on 28% mountain road (0.31m drop per frame)
  for (let i = 1; i <= 20; i++) {
    const triggered = checkBridgeFallTrigger(bf, {
      x: bridgePt.x + i * 0.8,
      z: bridgePt.z,
      groundY: 135 - i * 0.22,
      actorY: 135 - i * 0.22,
      yaw: 0,
      mode: 'motorcycle',
      airborne: false,
      dt: 0.04,
    });
    assert.equal(triggered, false, 'normal downhill road grade must never trigger bridge fall');
  }

  // 2. Teleport from mountain summit (1320m) back to town (0m)
  const townPt = toWorld(0, 120);
  resetBridgeFall(bf);
  syncBridgeFallAnchor(bf, townPt.x, 0, townPt.z);
  assert.equal(
    checkBridgeFallTrigger(bf, {
      x: townPt.x + 0.1,
      z: townPt.z,
      groundY: 0,
      actorY: 0,
      yaw: 0,
      mode: 'walking',
      airborne: false,
      dt: 0.016,
    }),
    false,
  );

  // 3. Stepping down from a 2nd-floor classroom/monastery (3.5m) in town must NOT trigger
  syncBridgeFallAnchor(bf, townPt.x, 3.5, townPt.z);
  assert.equal(
    checkBridgeFallTrigger(bf, {
      x: townPt.x + 0.3,
      z: townPt.z,
      groundY: 0,
      actorY: 0,
      yaw: 0,
      mode: 'walking',
      airborne: false,
      dt: 0.016,
    }),
    false,
    '3.5m indoor floor drop must never trigger mountain bridge Game Over',
  );
});
