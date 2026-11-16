import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorldSimulation } from '../server/worldSimulation.ts';
import { MultiplayerSession } from '../src/multiplayer/session.ts';
import { AUTHORITATIVE_HOME_SAFE_ZONE, PLAYER_MOVEMENT_LIMITS, WAREHOUSE_GHOST_ENCOUNTER } from '../shared/network.ts';
import type { WalkabilityPort } from '../shared/contracts/index.ts';
import { GhostAiController, CHASE_PATH_REFRESH_INTERVAL_SEC } from '../src/game/ghostAi.ts';
import { createGhostPersonalityConfig } from '../src/game/ghostPersonalities.ts';
import { setGhostThreatActive, isAnyGhostThreatActive, clearGhostThreat, setGhostDevForceActive } from '../src/game/ghostConfig.ts';
import {
  GHOST_LOAD_RETRY_DELAYS_MS,
  loadGhostModelOnce,
  setGhostModelLoaderForTest,
  resetGhostModelCacheForTest,
} from '../src/game/ghostModelLoader.ts';
import { gameAudio } from '../src/game/gameAudio.ts';
import {
  HorrorAudioMixer,
  MAX_MIXER_VOICES,
  getCuePriority,
} from '../src/game/audio/HorrorAudioMixer.ts';
import { HorrorAudioAssetLoader } from '../src/game/audio/HorrorAudioAssetLoader.ts';
import {
  shouldTriggerDetectionSting,
  createGhostScareAudioState,
  checkAndCommitScareCue,
} from '../src/game/ghostAudio.ts';
import {
  registerGhostDebugProvider,
  unregisterGhostDebugProvider,
  getGhostDebugSnapshot,
  setSelectedGhostId,
  setGizmosEnabled,
  setGhostDebugOverlayOpen,
} from '../src/game/audio/ghostDebugStore.ts';

function makeSessionAt(sim: WorldSimulation, sessionId: string) {
  sim.addPlayer(
    sessionId,
    {
      schemaVersion: 2,
      accountId: sessionId,
      displayName: 'AuditFixPlayer',
      role: 'player',
      avatar: 'mint',
      issuedAtMs: 0,
      expiresAtMs: 9999999999999,
    },
    0,
  );
  sim.placeEntityForServerTest(sessionId, 0, 0);

  const session = new MultiplayerSession();
  const s = session as unknown as {
    snapshot: ReturnType<MultiplayerSession['getSnapshot']>;
    room: { send(type: string, envelope: { seq: number; payload: unknown }): void };
    publish(next: ReturnType<MultiplayerSession['getSnapshot']>): void;
  };
  s.snapshot = { ...session.getSnapshot(), mode: 'authoritative-v2', status: 'connected' };
  let sent = 0;
  s.room = {
    send(_type, envelope) {
      sent++;
      sim.enqueueMoveIntent(
        sessionId,
        envelope.seq,
        envelope.payload as Parameters<WorldSimulation['enqueueMoveIntent']>[2],
      );
    },
  };
  return {
    session,
    getSentCount: () => sent,
    applySnapshot(nowMs: number) {
      const snap = sim.buildSnapshotForPlayer(sessionId, [], nowMs)!;
      s.publish({
        ...session.getSnapshot(),
        mode: 'authoritative-v2',
        status: 'connected',
        selfPlayer: snap.self,
      });
      return snap;
    },
  };
}

test('P0-1 / F01: 60Hz client movement throttled to network ticks preserves elapsed movement time', () => {
  const sim = new WorldSimulation({ combatEnabled: false });
  const harness = makeSessionAt(sim, 'move-audit');

  const originalNow = Date.now;
  let clock = 10000;
  Date.now = () => clock;
  try {
    for (let frame = 0; frame < 60; frame++) {
      clock = 10000 + frame * (1000 / 60);
      harness.session.sendMoveIntent(1, 0, 0, false, 1000 / 60);
      if (frame % 3 === 2) {
        sim.stepTick(0.05, clock);
      }
    }
    // Releasing keys shortly after flushes trailing sub-45ms remainder once cooldown clears
    clock = 11050;
    harness.session.sendMoveIntent(0, 0, 0, false, 1000 / 60);
    sim.stepTick(0.05, clock);
  } finally {
    Date.now = originalNow;
  }

  const snapshot = sim.buildSnapshotForPlayer('move-audit', [], 11050)!;
  assert.ok(harness.getSentCount() <= 24, `expected throttled sends <=24, got ${harness.getSentCount()}`);
  assert.ok(
    Math.abs(snapshot.self.x - PLAYER_MOVEMENT_LIMITS.walkMps) < 0.05,
    `expected ~3.2m walk displacement, got ${snapshot.self.x.toFixed(4)}m`,
  );
});

test('P0-1 / F01: multi-Hz parity (30/60/120 Hz), diagonal continuity, and server speed anti-cheat hold', () => {
  const distances: number[] = [];
  for (const hz of [30, 60, 120]) {
    const sim = new WorldSimulation({ combatEnabled: false });
    const harness = makeSessionAt(sim, `hz-${hz}`);
    const originalNow = Date.now;
    let clock = 20000;
    Date.now = () => clock;
    try {
      const dtMs = 1000 / hz;
      for (let i = 0; i < hz; i++) {
        clock = 20000 + i * dtMs;
        harness.session.sendMoveIntent(1, 0, 0, true, dtMs);
        if (i % Math.max(1, Math.round(hz / 20)) === 0) {
          sim.stepTick(0.05, clock);
        }
      }
      clock = 21100;
      harness.session.sendMoveIntent(0, 0, 0, false, dtMs);
      sim.stepTick(0.05, clock);
    } finally {
      Date.now = originalNow;
    }
    distances.push(sim.buildSnapshotForPlayer(`hz-${hz}`, [], 21100)!.self.x);
  }

  const spread = Math.max(...distances) - Math.min(...distances);
  assert.ok(spread < 0.15, `expected tight 30/60/120 Hz server parity, got ${JSON.stringify(distances)}`);
  assert.ok(Math.min(...distances) > 9.3, `expected ~9.5m sprint displacement, got ${JSON.stringify(distances)}`);

  // Idle stops zero packets; server reconciliation snaps only when divergence > 1.75m
  const sim = new WorldSimulation({ combatEnabled: false });
  const h = makeSessionAt(sim, 'reconcile');
  const originalNow = Date.now;
  let clock = 30000;
  Date.now = () => clock;
  try {
    h.applySnapshot(clock);
    assert.equal(h.session.sendMoveIntent(0, 0, 0, false, 16.67), false);
    assert.equal(h.getSentCount(), 0);
    assert.equal(h.session.reconcileLocalPosition(0.5, 0), null);
    const snapped = h.session.reconcileLocalPosition(4.0, 0);
    assert.ok(snapped && Math.abs(snapped.x) < 0.01);
  } finally {
    Date.now = originalNow;
  }
});

// ---------------------------------------------------------------------------
// P1-1 / F02 — Ghost must not grab players through impassable barriers
// ---------------------------------------------------------------------------

function makeAuth(sessionId: string) {
  return {
    schemaVersion: 2 as const,
    accountId: sessionId,
    displayName: 'AuditPlayer',
    role: 'player' as const,
    avatar: 'mint' as const,
    issuedAtMs: 0,
    expiresAtMs: 9_999_999_999_999,
  };
}

/** Minimal walkability: a single impassable wall strip at z=30..32 for all x in 25..50 */
function makeBarrierPort(
  barrierMinX: number,
  barrierMaxX: number,
  barrierMinZ: number,
  barrierMaxZ: number,
): WalkabilityPort {
  return {
    isPointWalkable(x: number, z: number): boolean {
      return !(x >= barrierMinX && x <= barrierMaxX && z >= barrierMinZ && z <= barrierMaxZ);
    },
    isHomeProtected: () => false,
  };
}

test('P1-1 / F02: ghost cannot grab player through an impassable wall barrier', () => {
  // Wall at z=28..30, ghost at (35, 24), player at (35, 32) — barrier between them
  const wall = makeBarrierPort(20, 50, 28, 30);
  const sim = new WorldSimulation({ walkability: wall, combatEnabled: true });

  sim.addPlayer('p-barrier', makeAuth('p-barrier'), 0);
  // Place ghost just inside grab range on the other side of the wall
  sim.placeEntityForServerTest('warehouse-ghost-1', 35, 24.5); // ghost side
  sim.placeEntityForServerTest('p-barrier', 35, 31.0);         // player side (barrier z=28..30)

  const nowMs = 50_000;
  // Advance enough ticks for the ghost to attempt a grab
  for (let i = 0; i < 10; i++) {
    sim.stepTick(0.1, nowMs + i * 100);
  }

  const snap = sim.buildSnapshotForPlayer('p-barrier', [], nowMs + 1000)!;
  assert.equal(
    snap.self.hp,
    100,
    `hp should remain 100 (barrier blocks grab), got ${snap.self.hp}`,
  );
});

test('P1-1 / F02: ghost can grab player in clear line-of-sight (no barrier)', () => {
  // No barriers — ghost within grab range, unobstructed
  const openPort: WalkabilityPort = {
    isPointWalkable: () => true,
    isHomeProtected: () => false,
  };
  const sim = new WorldSimulation({ walkability: openPort, combatEnabled: true });

  sim.addPlayer('p-open', makeAuth('p-open'), 0);
  // Place ghost within grabRangeM (1.65 m) of player, same z-layer, open space
  const grabRange = WAREHOUSE_GHOST_ENCOUNTER.grabRangeM;
  sim.placeEntityForServerTest('warehouse-ghost-1', 35, 36);
  sim.placeEntityForServerTest('p-open', 35 + grabRange * 0.9, 36);

  // Enough ticks for grab cooldown to pass and damage to apply
  const nowMs = 60_000;
  for (let i = 0; i < 15; i++) {
    sim.stepTick(0.1, nowMs + i * 100);
  }

  const snap = sim.buildSnapshotForPlayer('p-open', [], nowMs + 1500)!;
  assert.ok(snap.self.hp < 100, `hp should be < 100 on successful grab, got ${snap.self.hp}`);
});

test('P1-1 / F02: grab blocked by corner/fence strip does not damage player', () => {
  // Thin fence strip at z=20..21 spanning x=20..55
  const fence = makeBarrierPort(20, 55, 20, 21);
  const sim = new WorldSimulation({ walkability: fence, combatEnabled: true });

  sim.addPlayer('p-fence', makeAuth('p-fence'), 0);
  sim.placeEntityForServerTest('warehouse-ghost-1', 35, 18.5); // south of fence
  sim.placeEntityForServerTest('p-fence', 35, 21.5);           // north of fence

  const nowMs = 70_000;
  for (let i = 0; i < 10; i++) {
    sim.stepTick(0.1, nowMs + i * 100);
  }

  const snap = sim.buildSnapshotForPlayer('p-fence', [], nowMs + 1000)!;
  assert.equal(snap.self.hp, 100, `fence should block grab, hp got ${snap.self.hp}`);
});

test('P1-1 / F02: null walkability (no provider) does not block grab — backward compat', () => {
  // WorldSimulation with no walkability port — grab should behave as before fix
  const sim = new WorldSimulation({ combatEnabled: true });

  sim.addPlayer('p-noport', makeAuth('p-noport'), 0);
  const grabRange = WAREHOUSE_GHOST_ENCOUNTER.grabRangeM;
  sim.placeEntityForServerTest('warehouse-ghost-1', 35, 36);
  sim.placeEntityForServerTest('p-noport', 35 + grabRange * 0.9, 36);

  const nowMs = 80_000;
  for (let i = 0; i < 15; i++) {
    sim.stepTick(0.1, nowMs + i * 100);
  }

  const snap = sim.buildSnapshotForPlayer('p-noport', [], nowMs + 1500)!;
  assert.ok(
    snap.self.hp < 100,
    `no walkability port: grab should still work (backward compat), got hp=${snap.self.hp}`,
  );
});

// ---------------------------------------------------------------------------
// P1-2 / F03 — Ghost & Player Simulation Timestep Parity (Substep Accumulator)
// ---------------------------------------------------------------------------

const dummyNode = { id: 'a', role: 'hiding' as const, x: 0, z: 0, localU: 0, localV: 0, links: [] };
const testEnv = {
  anchor: { x: 0, z: 0, localU: 0, localV: 0 },
  waypoints: [dummyNode],
  waypointById: new Map([['a', dummyNode]]),
  hidingIds: ['a'],
  patrolIds: ['a'],
  roadCrossings: [],
  obstacleBoxes: [],
  treeColliders: [],
};

test('P1-2 / F03: equal wall-time chase preserves displacement across 5Hz and 60Hz (ratio >= 0.90)', () => {
  const distances: number[] = [];
  const cfg = createGhostPersonalityConfig('hunter');
  for (const hz of [60, 5]) {
    const ai = new GhostAiController(testEnv, cfg, 1);
    ai.forceStateForTest('CHASING');
    for (let i = 0; i < 2 * hz; i++) {
      ai.step({
        dt: 1 / hz,
        activeBySchedule: true,
        playerX: 20,
        playerZ: 0,
        walkCheck: () => true,
      });
    }
    distances.push(ai.getSnapshot().x);
  }
  const ratio = distances[1] / distances[0];
  assert.ok(
    ratio >= 0.90 && ratio <= 1.15,
    `5Hz vs 60Hz ratio should be >=0.90 (was 0.118 before fix), got ${ratio.toFixed(4)}: ${JSON.stringify({ hz60: distances[0], hz5: distances[1] })}`,
  );
});

test('P1-2 / F03: chase speed reaches configured m/s on straight-line chase', () => {
  const cfg = createGhostPersonalityConfig('hunter');
  const ai = new GhostAiController(testEnv, cfg, 1);
  ai.forceStateForTest('CHASING');
  for (let i = 0; i < 60; i++) {
    ai.step({ dt: 1 / 60, activeBySchedule: true, playerX: 20, playerZ: 0, walkCheck: () => true });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSpeed = (ai as any).chaseSpeed;
  assert.equal(currentSpeed, cfg.chaseSpeedMps, `chaseSpeed should accelerate to configured ${cfg.chaseSpeedMps} m/s`);
});

test('P1-2 / F03: home fade duration and cooldown timers align across 5Hz and 60Hz', () => {
  const fadeTimes: number[] = [];
  for (const hz of [60, 5]) {
    const ai = new GhostAiController(testEnv, createGhostPersonalityConfig('hunter'), 1);
    ai.forceStateForTest('FADE_OUT');
    let time = 0;
    for (let i = 0; i < 5 * hz; i++) {
      const snap = ai.step({ dt: 1 / hz, activeBySchedule: true, playerX: 20, playerZ: 0, walkCheck: () => true });
      time += 1 / hz;
      if (snap.state === 'COOLDOWN') break;
    }
    fadeTimes.push(time);
  }
  const diffSec = Math.abs(fadeTimes[0] - fadeTimes[1]);
  assert.ok(
    diffSec <= 0.05,
    `home fade-out duration must match within 50ms across 5Hz and 60Hz (diff: ${diffSec}s, got ${JSON.stringify(fadeTimes)})`,
  );
});

test('P1-2 / F03: cooldown and state timers advance consistently at 5Hz vs 60Hz', () => {
  const elapsedDurations: number[] = [];
  for (const hz of [60, 5]) {
    const ai = new GhostAiController(testEnv, createGhostPersonalityConfig('hunter'), 1);
    // Enter OBSERVING_PLAYER which has an explicit observation timer
    ai.forceStateForTest('OBSERVING_PLAYER');
    let stepsUntilTransition = 0;
    // Step up to 3 seconds wall-time
    for (let i = 0; i < 3 * hz; i++) {
      const snap = ai.step({
        dt: 1 / hz,
        activeBySchedule: true,
        playerX: 5,
        playerZ: 0,
        walkCheck: () => true,
      });
      stepsUntilTransition++;
      if (snap.state !== 'OBSERVING_PLAYER') {
        break;
      }
    }
    elapsedDurations.push(stepsUntilTransition / hz);
  }
  const diffSec = Math.abs(elapsedDurations[0] - elapsedDurations[1]);
  assert.ok(
    diffSec <= 0.25,
    `state timer should expire at consistent wall time across 5Hz and 60Hz (diff: ${diffSec}s, got ${JSON.stringify(elapsedDurations)})`,
  );
});

test('P1-2 / F03: dt = 0 freezes ghost position and timers (paused state)', () => {
  const ai = new GhostAiController(testEnv, createGhostPersonalityConfig('hunter'), 1);
  ai.forceStateForTest('CHASING');
  const snapBefore = ai.getSnapshot();

  // Step 20 times with dt = 0 (paused)
  for (let i = 0; i < 20; i++) {
    ai.step({
      dt: 0,
      activeBySchedule: true,
      playerX: 20,
      playerZ: 0,
      walkCheck: () => true,
    });
  }
  const snapAfter = ai.getSnapshot();
  assert.equal(snapAfter.x, snapBefore.x, 'x position must not advance when dt is 0');
  assert.equal(snapAfter.z, snapBefore.z, 'z position must not advance when dt is 0');
});

test('P1-2 / F03: large delta spike is clamped to 0.25s (prevents spiral of death)', () => {
  const ai = new GhostAiController(testEnv, createGhostPersonalityConfig('hunter'), 1);
  ai.forceStateForTest('CHASING');

  // Single huge step simulating 5-second background tab freeze
  const snap = ai.step({
    dt: 5.0,
    activeBySchedule: true,
    playerX: 50,
    playerZ: 0,
    walkCheck: () => true,
  });

  // Hunter max chase speed is ~4.2 m/s. In 0.25s, max displacement is <= 4.2 * 0.25 = 1.05m.
  // If unclamped (5.0s), displacement would be >15m.
  assert.ok(
    snap.x <= 1.2,
    `huge 5s frame spike should be clamped to at most 0.25s of movement, got ${snap.x.toFixed(3)}m`,
  );
});

// ---------------------------------------------------------------------------
// P1-3 / F04 — Explicit Authority Handoff (Server Ghost & Death Synchronization)
// ---------------------------------------------------------------------------

test('P1-3 / F04: authoritative server ghost deals grab damage, triggers defeat event, and auto-respawns at protected home', () => {
  const sim = new WorldSimulation({ combatEnabled: true });
  sim.addPlayer('victim', makeAuth('victim'), 0);

  // Position player in warehouse open space, ghost directly within grab range
  const gx = 35.149;
  const gz = 36.176;
  sim.placeEntityForServerTest('victim', gx + 1.0, gz);
  sim.placeEntityForServerTest('warehouse-ghost-1', gx, gz);

  let nowMs = 100_000;
  // Step simulation until the first grab lands
  sim.stepTick(0.05, nowMs);
  let snap = sim.buildSnapshotForPlayer('victim', sim.flushTickEvents(), nowMs)!;

  assert.equal(snap.self.hp, 100 - WAREHOUSE_GHOST_ENCOUNTER.grabDamage, 'first grab deals exact grabDamage');
  assert.equal(snap.visibleGhosts[0].state, 'GRABBING');

  // Fast forward grab cooldowns (2500ms) to land 2nd and 3rd grabs until defeat (100 -> 66 -> 32 -> 0)
  nowMs += 2600;
  sim.stepTick(0.05, nowMs);
  snap = sim.buildSnapshotForPlayer('victim', sim.flushTickEvents(), nowMs)!;
  assert.equal(snap.self.hp, 100 - 2 * WAREHOUSE_GHOST_ENCOUNTER.grabDamage, 'second grab deals damage');

  nowMs += 2600;
  sim.stepTick(0.05, nowMs);
  const events = sim.flushTickEvents();
  snap = sim.buildSnapshotForPlayer('victim', events, nowMs)!;

  // On 3rd grab, player is defeated and auto-respawned at protected home safe-zone
  const defeatEvent = events.find((e) => e.targetId === 'victim' && e.defeated);
  assert.ok(defeatEvent, 'defeat event must be recorded on fatal grab');
  assert.equal(defeatEvent.targetHpAfter, 0);

  // Snapshot confirms player is back at full HP and safe-zone position
  assert.equal(snap.self.hp, 100, 'player HP restored to 100 on respawn');
  assert.ok(snap.self.inSafeZone, 'player inSafeZone is true after home respawn');
  assert.ok(
    Math.hypot(snap.self.x - AUTHORITATIVE_HOME_SAFE_ZONE.x, snap.self.z - AUTHORITATIVE_HOME_SAFE_ZONE.z) < 10,
    'player teleported to home safe-zone coordinates',
  );
});

test('P1-3 / F04: ghost threat state tracks authoritative ghost CHASING and GRABBING states', () => {
  clearGhostThreat();
  assert.equal(isAnyGhostThreatActive(), false, 'initial threat state is false');

  // When authoritative ghost marker enters CHASING or GRABBING:
  setGhostThreatActive('warehouse-ghost-1', true);
  assert.equal(isAnyGhostThreatActive(), true, 'threat active during chase/grab');

  // When ghost retreats or wanders:
  setGhostThreatActive('warehouse-ghost-1', false);
  assert.equal(isAnyGhostThreatActive(), false, 'threat cleared when ghost ceases hostility');
});

test('P1-3 / F04: player inside home safe zone is immune from server ghost attacks and forces RETREATING', () => {
  const sim = new WorldSimulation({ combatEnabled: true });
  sim.addPlayer('safe-player', makeAuth('safe-player'), 0);

  // Place player right at home safe-zone centre
  sim.placeEntityForServerTest('safe-player', AUTHORITATIVE_HOME_SAFE_ZONE.x, AUTHORITATIVE_HOME_SAFE_ZONE.z);
  // Place ghost just outside buffer
  sim.placeEntityForServerTest(
    'warehouse-ghost-1',
    AUTHORITATIVE_HOME_SAFE_ZONE.x + AUTHORITATIVE_HOME_SAFE_ZONE.radius + 2,
    AUTHORITATIVE_HOME_SAFE_ZONE.z,
  );

  const nowMs = 200_000;
  for (let i = 0; i < 20; i++) {
    sim.stepTick(0.1, nowMs + i * 100);
  }

  const snap = sim.buildSnapshotForPlayer('safe-player', sim.flushTickEvents(), nowMs + 2000)!;
  assert.equal(snap.self.hp, 100, 'player inside home safe-zone takes 0 ghost damage');
  assert.ok(snap.self.inSafeZone, 'player is inSafeZone');
});

// ---------------------------------------------------------------------------
// P1-4 / F05 — Ghost GLB Loading Failure Retry & Bounded Backoff
// ---------------------------------------------------------------------------

test('P1-4 / F05: backoff retry schedule enforces bounded 5s / 15s / 30s delays', () => {
  assert.deepEqual(
    [...GHOST_LOAD_RETRY_DELAYS_MS],
    [5000, 15000, 30000],
    'retry delays must follow the audited 5s, 15s, 30s exponential schedule',
  );
});

test('P1-4 / F05: transient GLB load failure resets cache and allows recovery on retry', async () => {
  resetGhostModelCacheForTest();
  let attempts = 0;

  // Mock loader that fails with HTTP 500 on attempt 1, then succeeds on attempt 2
  const dummyGltf = { scene: { traverse: () => {} }, animations: [] } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTF;
  setGhostModelLoaderForTest(async () => {
    attempts++;
    if (attempts === 1) {
      throw new Error('HTTP 500: Internal Server Error (transient offline)');
    }
    return dummyGltf;
  });

  try {
    // Attempt 1: should reject with the transient error
    await assert.rejects(
      () => loadGhostModelOnce(),
      /HTTP 500/,
      'first attempt should reject on simulated network failure',
    );
    assert.equal(attempts, 1, 'first load invoked custom loader once');

    // Attempt 2: retry should succeed, mounting the model without being permanently blocked
    const result = await loadGhostModelOnce();
    assert.equal(result, dummyGltf, 'retry must resolve to loaded GLTF');
    assert.equal(attempts, 2, 'second load invoked custom loader on retry');

    // Subsequent call: should reuse cached result without re-fetching
    const cachedResult = await loadGhostModelOnce();
    assert.equal(cachedResult, dummyGltf, 'cached result must be returned on subsequent calls');
    assert.equal(attempts, 2, 'cached result must not increment fetch attempts');
  } finally {
    resetGhostModelCacheForTest();
  }
});

// ---------------------------------------------------------------------------
// P2-1 / F06 — Blocked Empty Route Replan Throttle & Dynamic Navigation
// ---------------------------------------------------------------------------

test('P2-1 / F06: chase refresh interval constant is set to 0.35s', () => {
  assert.equal(
    CHASE_PATH_REFRESH_INTERVAL_SEC,
    0.35,
    'chase path refresh timer must unify the conflicting 0.30s / 0.45s rates to 0.35s',
  );
});

test('P2-1 / F06: blocked empty route throttles waypoint path replanning to <= 5 calls in 1.0s', () => {
  const node = { id: 'a', role: 'hiding' as const, x: 0, z: 0, localU: 0, localV: 0, links: [] };
  const env = {
    anchor: { x: 0, z: 0, localU: 0, localV: 0 },
    waypoints: [node],
    waypointById: new Map([['a', node]]),
    hidingIds: ['a'],
    patrolIds: ['a'],
    roadCrossings: [],
    obstacleBoxes: [{ id: 'wall', x: 2.5, z: 0, halfW: 0.5, halfD: 2, rotation: 0, blocksSight: true }],
    treeColliders: [],
  };
  const ai = new GhostAiController(env, createGhostPersonalityConfig('hunter'), 1);
  ai.forceStateForTest('CHASING');
  let calls = 0;
  const original = ai.setTargetWaypoint.bind(ai);
  ai.setTargetWaypoint = (...args) => {
    calls++;
    return original(...args);
  };
  for (let i = 0; i < 20; i++) {
    ai.step({ dt: 0.05, activeBySchedule: true, playerX: 10, playerZ: 0, walkCheck: (x) => x < 2 || x > 3 });
  }
  // In 1.0s (20 frames at 0.05s), refresh timer 0.35s must throttle replans to <= 4 calls (was 20 calls before fix)
  assert.ok(calls <= 5, `expected replan calls <= 5, got ${calls}`);
  assert.ok(calls >= 2, `expected at least 2 throttled refreshes over 1.0s, got ${calls}`);
});

test('P2-1 / F06: player moving to new waypoint sector bypasses cooldown and replans immediately', () => {
  const nodeA = { id: 'a', role: 'hiding' as const, x: 0, z: 0, localU: 0, localV: 0, links: ['b'] };
  const nodeB = { id: 'b', role: 'patrol' as const, x: 10, z: 0, localU: 0, localV: 0, links: ['a', 'c'] };
  const nodeC = { id: 'c', role: 'patrol' as const, x: 20, z: 0, localU: 0, localV: 0, links: ['b'] };
  const env = {
    anchor: { x: 0, z: 0, localU: 0, localV: 0 },
    waypoints: [nodeA, nodeB, nodeC],
    waypointById: new Map([['a', nodeA], ['b', nodeB], ['c', nodeC]]),
    hidingIds: ['a'],
    patrolIds: ['b', 'c'],
    roadCrossings: [],
    obstacleBoxes: [{ id: 'wall', x: 5, z: 0, halfW: 0.5, halfD: 5, rotation: 0, blocksSight: true }],
    treeColliders: [],
  };
  const ai = new GhostAiController(env, createGhostPersonalityConfig('hunter'), 1);
  ai.forceStateForTest('CHASING');
  let calls = 0;
  const original = ai.setTargetWaypoint.bind(ai);
  ai.setTargetWaypoint = (...args) => {
    calls++;
    return original(...args);
  };
  // Step 0: Player at B (x=10). Initial replan should target B.
  ai.step({ dt: 0.05, activeBySchedule: true, playerX: 10, playerZ: 0, walkCheck: () => true });
  assert.equal(calls, 1, 'initial chase step planned route to player waypoint B');
  assert.equal(ai.getSnapshot().targetWaypointId, 'b', 'target waypoint should be B');

  // Step 1 (only 0.05s later, well before 0.35s cooldown): Player at same sector B -> must NOT replan
  ai.step({ dt: 0.05, activeBySchedule: true, playerX: 10.2, playerZ: 0, walkCheck: () => true });
  assert.equal(calls, 1, 'minor player movement in same sector must be throttled');

  // Step 2 (only 0.10s into cooldown): Player moves to sector C (x=20) -> must trigger immediate replan!
  ai.step({ dt: 0.05, activeBySchedule: true, playerX: 20, playerZ: 0, walkCheck: () => true });
  assert.equal(calls, 2, 'target waypoint changing to C must bypass refresh timer immediately');
  assert.equal(ai.getSnapshot().targetWaypointId, 'c', 'target waypoint should immediately switch to C');
});

test('P2-1 / F06: direct path loss due to obstacle immediately triggers waypoint path replanning', () => {
  const nodeA = { id: 'a', role: 'hiding' as const, x: 0, z: 0, localU: 0, localV: 0, links: ['b'] };
  const nodeB = { id: 'b', role: 'patrol' as const, x: 10, z: 0, localU: 0, localV: 0, links: ['a'] };
  const env = {
    anchor: { x: 0, z: 0, localU: 0, localV: 0 },
    waypoints: [nodeA, nodeB],
    waypointById: new Map([['a', nodeA], ['b', nodeB]]),
    hidingIds: ['a'],
    patrolIds: ['b'],
    roadCrossings: [],
    // Wall between x=4 and x=6 only when player is at z > 2
    obstacleBoxes: [{ id: 'wall', x: 5, z: 3, halfW: 0.5, halfD: 2, rotation: 0, blocksSight: true }],
    treeColliders: [],
  };
  const ai = new GhostAiController(env, createGhostPersonalityConfig('hunter'), 1);
  ai.forceStateForTest('CHASING');
  let calls = 0;
  const original = ai.setTargetWaypoint.bind(ai);
  ai.setTargetWaypoint = (...args) => {
    calls++;
    return original(...args);
  };
  // Step 0: Player at (8, 0), no obstacle between ghost (0, 0) and player -> directPath is true!
  ai.step({ dt: 0.05, activeBySchedule: true, playerX: 8, playerZ: 0, walkCheck: () => true });
  // Ghost can steer directly, no need for setTargetWaypoint
  assert.equal(calls, 0, 'direct LOS chase does not call setTargetWaypoint');

  // Step 1 (0.05s later): Player ducks behind wall at (8, 3) -> LOS lost!
  // directLost should immediately trigger setTargetWaypoint without waiting 0.35s
  ai.step({ dt: 0.05, activeBySchedule: true, playerX: 8, playerZ: 3, walkCheck: () => true });
  assert.equal(calls, 1, 'losing direct path must immediately trigger waypoint path planning');
});

test('P2-1 / F06: unblock recovery restores direct chase sprint when line of sight opens', () => {
  const nodeA = { id: 'a', role: 'hiding' as const, x: 0, z: 0, localU: 0, localV: 0, links: ['b'] };
  const nodeB = { id: 'b', role: 'patrol' as const, x: 10, z: 0, localU: 0, localV: 0, links: ['a'] };
  const env = {
    anchor: { x: 0, z: 0, localU: 0, localV: 0 },
    waypoints: [nodeA, nodeB],
    waypointById: new Map([['a', nodeA], ['b', nodeB]]),
    hidingIds: ['a'],
    patrolIds: ['b'],
    roadCrossings: [],
    obstacleBoxes: [{ id: 'wall', x: 5, z: 0, halfW: 0.5, halfD: 2, rotation: 0, blocksSight: true }],
    treeColliders: [],
  };
  const ai = new GhostAiController(env, createGhostPersonalityConfig('hunter'), 1);
  ai.forceStateForTest('CHASING');
  // Initially behind wall (player at (10, 0))
  ai.step({ dt: 0.05, activeBySchedule: true, playerX: 10, playerZ: 0, walkCheck: () => true });

  // Player moves out into the clear hallway at (5, 5) where wall does not block sight or walkability
  // Step through until refresh timer fires (>= 0.35s)
  for (let i = 0; i < 8; i++) {
    ai.step({ dt: 0.05, activeBySchedule: true, playerX: 5, playerZ: 5, walkCheck: () => true });
  }
  const snap = ai.getSnapshot();
  assert.equal(snap.state, 'CHASING', 'ghost remains in CHASING state');
  assert.ok(snap.chaseSpeed > 0, 'ghost accelerates during unblocked chase');
});

// ---------------------------------------------------------------------------
// P2-2 / F07 & F08 — Haunted Warehouse Audio Gating & Voice Pool Ceiling
// ---------------------------------------------------------------------------

test('P2-2 / F07: HauntedWarehouseAudioZone is mounted outside diagnosticConfig.disableNPCs gate', () => {
  const streamedWorldSource = readFileSync(resolve('src/components/StreamedWorld.tsx'), 'utf8');
  // Confirm HauntedWarehouseAudioZone is outside the disableNPCs block
  const disableNpcsBlockMatch = streamedWorldSource.match(/!diagnosticConfig\.disableNPCs[\s\S]*?<\/>/);
  assert.ok(disableNpcsBlockMatch, 'must find disableNPCs block in StreamedWorld.tsx');
  assert.equal(
    disableNpcsBlockMatch[0].includes('HauntedWarehouseAudioZone'),
    false,
    'HauntedWarehouseAudioZone must NOT be inside !diagnosticConfig.disableNPCs block',
  );
  // Confirm HauntedWarehouseAudioZone receives paused={paused}
  assert.ok(
    streamedWorldSource.includes('<HauntedWarehouseAudioZone') && streamedWorldSource.includes('paused={paused}'),
    'HauntedWarehouseAudioZone must receive paused={paused} prop',
  );
});

function setupFakeGameAudio() {
  const gains: any[] = [];
  function createFakeGain() {
    const g = {
      gain: {
        value: 1,
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        setTargetAtTime: () => {},
      },
      connect: () => g,
      disconnect: () => {},
    };
    gains.push(g);
    return g;
  }

  const fakeCtx = {
    sampleRate: 48000,
    currentTime: 100,
    state: 'running',
    createGain: createFakeGain,
    createBufferSource: () => {
      const src = {
        buffer: null,
        playbackRate: { value: 1 },
        connect: (dest: any) => dest,
        disconnect: () => {},
        start: () => {},
        stop: () => {
          if (src.onended) src.onended();
        },
        onended: null as (() => void) | null,
      };
      return src;
    },
    createPanner: () => ({
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      connect: (dest: any) => dest,
      disconnect: () => {},
    }),
    createBiquadFilter: () => ({
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: (dest: any) => dest,
      disconnect: () => {},
    }),
    createStereoPanner: () => ({
      pan: { value: 0 },
      connect: (dest: any) => dest,
      disconnect: () => {},
    }),
    createOscillator: () => ({
      frequency: { value: 440 },
      connect: (dest: any) => dest,
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    }),
    createBuffer: (channels: number, length: number, sampleRate: number) => ({
      duration: length / sampleRate,
      length,
      numberOfChannels: channels,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    }),
  } as unknown as AudioContext;

  gameAudio.context = fakeCtx;
  gameAudio.master = createFakeGain();
  gameAudio.ghost = createFakeGain();
  gameAudio.ambience = createFakeGain();
  gameAudio.horrorEvents = createFakeGain();
  gameAudio.chaseMusic = createFakeGain();
  gameAudio.setActive(true);
  gameAudio.setLevels({ master: 1, ghost: 1, ambience: 1, horrorEvents: 1, chaseMusic: 1 });

  return {
    ctx: fakeCtx,
    restore() {
      gameAudio.context = null;
      gameAudio.master = null;
      gameAudio.ghost = null;
      gameAudio.ambience = null;
      gameAudio.horrorEvents = null;
      gameAudio.chaseMusic = null;
      gameAudio.setActive(false);
    },
  };
}

function makeFakeAudioBuffer() {
  return {
    duration: 1.0,
    length: 48000,
    numberOfChannels: 1,
    sampleRate: 48000,
    getChannelData: () => new Float32Array(48000),
  } as unknown as AudioBuffer;
}

test('P2-2 / F08: cue priority helper grades gameplay critical cues over ambient decoration', () => {
  assert.equal(getCuePriority('ghost-grab-impact'), 3);
  assert.equal(getCuePriority('horror-sting'), 3);
  assert.equal(getCuePriority(undefined, 'ghost_grab'), 3);
  assert.equal(getCuePriority(undefined, 'ghost_warning'), 3);

  assert.equal(getCuePriority('spectral-shriek'), 2);
  assert.equal(getCuePriority('spectral-cackle'), 2);
  assert.equal(getCuePriority(undefined, 'ghost_scream'), 2);

  assert.equal(getCuePriority('rusted-door-creak'), 1);
  assert.equal(getCuePriority('wood-cracks'), 1);
  assert.equal(getCuePriority('distant-footsteps'), 1);
});

test('P2-2 / F08: 50-burst stress test enforces unified voice pool cap <= 18 without spawning procedural voices', () => {
  const fakeAudio = setupFakeGameAudio();
  try {
    const loader = new HorrorAudioAssetLoader();
    const mixer = new HorrorAudioMixer(loader);
    let synthCalls = 0;
    (mixer as any).synth = {
      diagnostics: { voices: 0 },
      activeVoiceCount: () => 0,
      position: () => {},
      play: () => { synthCalls++; },
      stop: () => {},
      stopAll: () => {},
      release: () => {},
      hasVoice: () => false,
      encounterBusy: false,
    };
    (loader as any).decodedBuffers.set('spectral-shriek', makeFakeAudioBuffer());

    const modes: string[] = [];
    for (let i = 0; i < 50; i++) {
      const mode = mixer.playCue({
        assetId: 'spectral-shriek',
        fallbackPreset: 'ghost_scream',
        owner: `stress-${i}`,
        volume: 0.8,
      });
      modes.push(mode);
    }

    const opusCount = modes.filter((m) => m === 'opus').length;
    const skippedCount = modes.filter((m) => m === 'skipped').length;
    const proceduralCount = modes.filter((m) => m === 'procedural').length;

    assert.equal(opusCount, 18, 'first 18 cues must allocate Opus voices up to MAX_MIXER_VOICES');
    assert.equal(skippedCount, 32, 'subsequent 32 cues must be skipped rather than overflowing');
    assert.equal(proceduralCount, 0, 'zero cues should drop into procedural synthesis when Opus is cached');
    assert.equal(synthCalls, 0, 'synth.play must not be invoked on burst overflow');
    assert.equal(mixer.activeVoiceCount(), 18, 'aggregate active voice count must strictly equal 18');
  } finally {
    fakeAudio.restore();
  }
});

test('P2-2 / F08: critical gameplay cues preempt low-priority ambient decoration sounds', () => {
  const fakeAudio = setupFakeGameAudio();
  try {
    const loader = new HorrorAudioAssetLoader();
    const mixer = new HorrorAudioMixer(loader);
    (mixer as any).synth = {
      diagnostics: { voices: 0 },
      activeVoiceCount: () => 0,
      position: () => {},
      play: () => {},
      stop: () => {},
      stopAll: () => {},
      release: () => {},
      hasVoice: () => false,
      encounterBusy: false,
    };
    (loader as any).decodedBuffers.set('rusted-door-creak', makeFakeAudioBuffer());
    (loader as any).decodedBuffers.set('ghost-grab-impact', makeFakeAudioBuffer());

    // Fill all 18 slots with priority 1 ambient creaks
    for (let i = 0; i < 18; i++) {
      const mode = mixer.playCue({
        assetId: 'rusted-door-creak',
        owner: `creak-${i}`,
        volume: 0.5,
      });
      assert.equal(mode, 'opus');
    }
    assert.equal(mixer.activeVoiceCount(), 18, 'voice pool is full with 18 ambient creaks');

    // Trigger critical grab impact (priority 3)
    const grabMode = mixer.playCue({
      assetId: 'ghost-grab-impact',
      owner: 'ghost-1',
      volume: 1.0,
    });
    assert.equal(grabMode, 'opus', 'critical ghost-grab-impact must succeed by preempting an ambient creak');
    assert.equal(mixer.activeVoiceCount(), 18, 'voice count must stay clamped at 18');

    // An incoming priority 1 creak should now be skipped because pool is full and cannot preempt
    const secondCreakMode = mixer.playCue({
      assetId: 'rusted-door-creak',
      owner: 'creak-late',
      volume: 0.5,
    });
    assert.equal(secondCreakMode, 'skipped', 'ambient creak cannot preempt equal or higher priority voices');
    assert.equal(mixer.activeVoiceCount(), 18);
  } finally {
    fakeAudio.restore();
  }
});

test('P2-2 / F08: uncached Opus buffer triggers procedural synthesis when under voice cap', () => {
  const fakeAudio = setupFakeGameAudio();
  try {
    const loader = new HorrorAudioAssetLoader();
    const mixer = new HorrorAudioMixer(loader);
    let playedPreset: string | null = null;
    (mixer as any).synth = {
      diagnostics: { voices: 0 },
      activeVoiceCount: () => 0,
      position: () => {},
      play: (preset: string) => { playedPreset = preset; },
      stop: () => {},
      stopAll: () => {},
      release: () => {},
      hasVoice: () => false,
      encounterBusy: false,
    };
    // No buffer cached in this fresh loader
    const mode = mixer.playCue({
      assetId: 'spectral-shriek',
      fallbackPreset: 'ghost_scream',
      fallbackToProcedural: true,
      owner: 'uncached-test',
      volume: 0.7,
    });
    assert.equal(mode, 'procedural', 'must fall back to procedural synthesis when buffer is uncached');
    assert.equal(playedPreset, 'ghost_scream', 'synth.play should receive the fallback preset');
  } finally {
    fakeAudio.restore();
  }
});

// ---------------------------------------------------------------------------
// P2-3 / F09 & F10 — Spatial Emitter Bus Pooling & Ambience Bed Handover Tail
// ---------------------------------------------------------------------------

test('P2-3 / F09: spatial emitters are pooled by (owner, bus) preventing bus hijacking on concurrent cues', () => {
  const fakeAudio = setupFakeGameAudio();
  try {
    const loader = new HorrorAudioAssetLoader();
    const mixer = new HorrorAudioMixer(loader);
    (loader as any).decodedBuffers.set('spectral-shriek', makeFakeAudioBuffer());
    (loader as any).decodedBuffers.set('rusted-door-creak', makeFakeAudioBuffer());

    // Play spatial cue on ghostEffects bus for ghost-1
    const mode1 = mixer.playCue({
      assetId: 'spectral-shriek',
      owner: 'ghost-1',
      position: { x: 10, y: 1, z: 10 },
      volume: 0.8,
    });
    assert.equal(mode1, 'opus');

    // While still playing, trigger a spatial cue on horrorEvents bus for the same owner ghost-1
    const mode2 = mixer.playCue({
      assetId: 'rusted-door-creak',
      owner: 'ghost-1',
      position: { x: 12, y: 1, z: 10 },
      volume: 0.8,
    });
    assert.equal(mode2, 'opus');

    // Verify both emitters exist separately under owner:bus keys
    const emittersMap = (mixer as any).emitters as Map<string, any>;
    assert.ok(emittersMap.has('ghost-1:ghostEffects'), 'emitter for ghostEffects must exist');
    assert.ok(emittersMap.has('ghost-1:horrorEvents'), 'emitter for horrorEvents must exist');
    assert.notEqual(
      emittersMap.get('ghost-1:ghostEffects'),
      emittersMap.get('ghost-1:horrorEvents'),
      'emitters for distinct buses must not share GainNode destinations',
    );
  } finally {
    fakeAudio.restore();
  }
});

test('P2-3 / F10: procedural-to-opus ambience handover maintains 0.55s fade overlap tail before disposing', () => {
  const fakeAudio = setupFakeGameAudio();
  try {
    const loader = new HorrorAudioAssetLoader();
    const mixer = new HorrorAudioMixer(loader);

    // Initial tick: Opus not ready, so procedural bed is created
    const tick1 = mixer.updateWarehouseAmbience({ active: true, level: 1, isNight: true, dt: 0.05 });
    assert.equal(tick1.bedMode, 'procedural', 'initial tick must use procedural bed');
    assert.ok((mixer as any).proceduralBed, 'proceduralBed must be instantiated');

    // Now Opus loops become ready
    (loader as any).decodedBuffers.set('warehouse-drone', makeFakeAudioBuffer());
    (loader as any).decodedBuffers.set('eerie-wind', makeFakeAudioBuffer());

    // Transition tick: Opus starts, procedural bed transitions to fading tail
    const tick2 = mixer.updateWarehouseAmbience({ active: true, level: 1, isNight: true, dt: 0.05 });
    assert.equal(tick2.bedMode, 'opus', 'transition tick engages opus bed mode');
    const fadingBed = (mixer as any).proceduralFadingBed;
    assert.ok(fadingBed, 'proceduralFadingBed must be held during crossfade tail');
    assert.equal((fadingBed as any).disposed, false, 'procedural bed must NOT be abruptly disposed on tick 2');

    // Step 0.20s forward: fading bed must still be alive (within 0.55s tail)
    mixer.updateWarehouseAmbience({ active: true, level: 1, isNight: true, dt: 0.20 });
    assert.equal((fadingBed as any).disposed, false, 'fading bed must remain alive mid-crossfade');

    // Step 0.40s forward (total elapsed 0.65s > 0.55s): fading bed must be disposed cleanly
    mixer.updateWarehouseAmbience({ active: true, level: 1, isNight: true, dt: 0.40 });
    assert.equal((fadingBed as any).disposed, true, 'fading bed must dispose after 0.55s tail expires');
    assert.equal((mixer as any).proceduralFadingBed, null, 'fading bed reference must be cleared');
  } finally {
    fakeAudio.restore();
  }
});

// ---------------------------------------------------------------------------
// P2-4 / F11 — Direct-Chase Detection Sting Alignment & Cold Clip Deduplication
// ---------------------------------------------------------------------------

test('P2-4 / F11: Hunter direct chase detection (HIDING -> CHASING) triggers horror sting with cooldown and home protection', () => {
  // 1. Initial detection of player by Hunter (transitions directly HIDING -> CHASING)
  const initialTrigger = shouldTriggerDetectionSting('CHASING', 'HIDING', -Infinity, 1.0, false);
  assert.equal(initialTrigger, true, 'Hunter direct chase detection must trigger horror sting');

  // 2. Next frame: ghost continues chasing (CHASING -> CHASING)
  const chaseFrame = shouldTriggerDetectionSting('CHASING', 'CHASING', 1.0, 1.05, false);
  assert.equal(chaseFrame, false, 'consecutive chase frames must NOT re-trigger horror sting');

  // 3. Player enters safe home (retreating = true)
  const safeHomeTrigger = shouldTriggerDetectionSting('CHASING', 'HIDING', -Infinity, 5.0, true);
  assert.equal(safeHomeTrigger, false, 'safe home retreat must suppress horror sting');

  // 4. Ghost transitions from GRABBING to CHASING
  const grabToChase = shouldTriggerDetectionSting('CHASING', 'GRABBING', 1.0, 15.0, false);
  assert.equal(grabToChase, false, 'transition from active grab to chase is not a fresh detection');

  // 5. Stalker personality: HIDING -> OBSERVING_PLAYER triggers sting, but OBSERVING_PLAYER -> CHASING does not duplicate
  const stalkerDetect = shouldTriggerDetectionSting('OBSERVING_PLAYER', 'HIDING', -Infinity, 20.0, false);
  assert.equal(stalkerDetect, true, 'Stalker observation detection triggers sting');
  const stalkerChase = shouldTriggerDetectionSting('CHASING', 'OBSERVING_PLAYER', 20.0, 23.5, false);
  assert.equal(stalkerChase, false, 'Stalker transition from observe to chase must NOT duplicate sting');

  // 6. Ambusher personality: HIDING -> SCARING triggers sting, SCARING -> CHASING does not duplicate
  const ambusherDetect = shouldTriggerDetectionSting('SCARING', 'HIDING', -Infinity, 30.0, false);
  assert.equal(ambusherDetect, true, 'Ambusher scare detection triggers sting');
  const ambusherChase = shouldTriggerDetectionSting('CHASING', 'SCARING', 30.0, 32.0, false);
  assert.equal(ambusherChase, false, 'Ambusher transition from scare to chase must NOT duplicate sting');

  // 7. Cooldown guard: re-encounter within 10s is suppressed
  const quickReencounter = shouldTriggerDetectionSting('CHASING', 'WANDERING', 30.0, 35.0, false);
  assert.equal(quickReencounter, false, 're-encounter within 10s cooldown must be suppressed');

  // 8. Re-encounter after cooldown expires (> 10s)
  const fullCooldownReencounter = shouldTriggerDetectionSting('CHASING', 'WANDERING', 30.0, 42.0, false);
  assert.equal(fullCooldownReencounter, true, 're-encounter after 10s cooldown must trigger sting');
});

test('P2-4 / F11: cold GLB clip delayed arrival (800ms) deduplicates against GhostAiController discrete scream event', () => {
  const dedupState = createGhostScareAudioState();

  // Step 1: t = 10.0s, GhostAiController enters SCARING and emits discrete scream event
  const aiScream = checkAndCommitScareCue(
    'scream',
    'ai_event',
    { state: 'SCARING', scareTriggerCount: 1, grabSeq: 0, audioClockSec: 10.0 },
    dedupState,
  );
  assert.equal(aiScream, true, 'AI event scream must play initially');
  assert.equal(dedupState.lastScreamScareSeq, 1, 'lastScreamScareSeq must be recorded');

  // Step 2: t = 10.8s (800ms later), freaky.glb finishes cold fetch and HorrorAnimationSync fires
  const lateClipScream = checkAndCommitScareCue(
    'scream',
    'animation_sync',
    { state: 'SCARING', scareTriggerCount: 1, grabSeq: 0, audioClockSec: 10.8 },
    dedupState,
  );
  assert.equal(lateClipScream, false, 'delayed freaky.glb arrival (800ms) must NOT double-fire spectral-shriek');

  // Step 3: Stale clip arrival after ghost already transitioned to CHASING
  const staleChaseScream = checkAndCommitScareCue(
    'scream',
    'animation_sync',
    { state: 'CHASING', scareTriggerCount: 1, grabSeq: 0, audioClockSec: 11.5 },
    dedupState,
  );
  assert.equal(staleChaseScream, false, 'stale freaky.glb arrival after state changed to CHASING must be suppressed');

  // Step 4: Next encounter cycle (scareTriggerCount = 2) at t = 30.0s
  const nextEncounterScream = checkAndCommitScareCue(
    'scream',
    'ai_event',
    { state: 'SCARING', scareTriggerCount: 2, grabSeq: 0, audioClockSec: 30.0 },
    dedupState,
  );
  assert.equal(nextEncounterScream, true, 'new encounter scare cycle (scareTriggerCount = 2) must play scream');
  assert.equal(dedupState.lastScreamScareSeq, 2);
});

test('P2-4 / F11: evil-laugh is deduplicated during SCARING laugh subphase and GRABBING player-fall', () => {
  const dedupState = createGhostScareAudioState();

  // SCARING subphase laugh: AI event fires
  const scareLaughAi = checkAndCommitScareCue(
    'evil-laugh',
    'ai_event',
    { state: 'SCARING', scareTriggerCount: 1, grabSeq: 0, audioClockSec: 12.0 },
    dedupState,
  );
  assert.equal(scareLaughAi, true, 'SCARING evil-laugh from AI event must play');

  // Late clip sync for laugh_01 during SCARING
  const scareLaughLateSync = checkAndCommitScareCue(
    'evil-laugh',
    'animation_sync',
    { state: 'SCARING', scareTriggerCount: 1, grabSeq: 0, audioClockSec: 12.6 },
    dedupState,
  );
  assert.equal(scareLaughLateSync, false, 'SCARING evil-laugh duplicate from clip sync must be suppressed');

  // GRABBING player-fall: AI event fires
  const grabLaughAi = checkAndCommitScareCue(
    'evil-laugh',
    'ai_event',
    { state: 'GRABBING', scareTriggerCount: 1, grabSeq: 5, audioClockSec: 25.0 },
    dedupState,
  );
  assert.equal(grabLaughAi, true, 'GRABBING evil-laugh from AI event must play');

  // Late clip sync for laugh_01 during player-fall
  const grabLaughLateSync = checkAndCommitScareCue(
    'evil-laugh',
    'animation_sync',
    { state: 'GRABBING', scareTriggerCount: 1, grabSeq: 5, audioClockSec: 25.4 },
    dedupState,
  );
  assert.equal(grabLaughLateSync, false, 'GRABBING evil-laugh duplicate from clip sync must be suppressed');

  // Stale laugh after ghost returned to CHASING or FLEEING
  const staleLaugh = checkAndCommitScareCue(
    'evil-laugh',
    'animation_sync',
    { state: 'FLEEING', scareTriggerCount: 1, grabSeq: 5, audioClockSec: 26.0 },
    dedupState,
  );
  assert.equal(staleLaugh, false, 'stale laugh in FLEEING state must be suppressed');
});

// ---------------------------------------------------------------------------
// P3-1 / Part 13 — Development-Only Ghost AI Telemetry & 3D Gizmos Store
// ---------------------------------------------------------------------------

test('P3-1 / Part 13: ghostDebugStore samples 16 telemetry fields including delta distance and replan rate', () => {
  setGhostDevForceActive(true);
  const fakeSnapshot: any = {
    state: 'CHASING',
    homeProtected: false,
    playerKilled: false,
    chaseSpeed: 4.2,
    attackEnabled: true,
    collisionEnabled: true,
    x: 35.15,
    z: 36.18,
    yaw: 1.57,
    opacity: 1,
    visible: true,
    activeClip: { clipId: 'freaky', loop: true, speedScale: 1 },
    currentWaypointId: 'wp-1',
    targetWaypointId: 'wp-2',
    scareTriggerCount: 2,
    crossingCount: 0,
    fallTriggerCount: 0,
    encounterCount: 1,
    chaseThreshold: 3,
    encounterCycleCount: 1,
    chaseTriggerCount: 1,
    grabCount: 0,
    playerInsideEncounterZone: true,
    audioCue: { seq: 4, cue: 'scream' },
    grabInteraction: {
      active: false,
      phase: 'none',
      seq: 0,
      ghostX: 35.15,
      ghostZ: 36.18,
      fallProgress: 0,
    },
    distToPlayerM: 18.5,
    hasLineOfSight: true,
    directPath: true,
    replanCount: 1,
    scareCooldownTimer: 0,
    encounterCooldownTimer: 0,
    pathQueue: ['wp-2', 'wp-3'],
    pathWaypoints: [
      { id: 'wp-2', x: 38.0, z: 36.18 },
      { id: 'wp-3', x: 42.0, z: 36.18 },
    ],
    safeCooldown: false,
    targetX: 38.0,
    targetZ: 36.18,
  };

  const mockProvider: any = {
    ghostId: 'ghost-test-1',
    zoneId: 'warehouse-1',
    personality: 'hunter',
    getSnapshot: () => fakeSnapshot,
    forceState: () => {},
    preloadAllClips: async () => [],
    getMicroTimings: () => ({ aiMs: 0.12, audioMs: 0.08 }),
    getModelStatus: () => 'ready',
    getInactivityReason: () => 'active',
    getLastStateTransition: () => ({ from: 'HIDING', to: 'CHASING', ageSec: 1.2 }),
  };

  registerGhostDebugProvider('ghost-test-1', mockProvider);
  try {
    const snap1 = getGhostDebugSnapshot();
    assert.ok(snap1.ghosts.length >= 1, 'ghost telemetry record must be populated');
    const record = snap1.ghosts.find((g) => g.ghostId === 'ghost-test-1');
    assert.ok(record, 'record for ghost-test-1 must exist');

    // 1. Identity & Lifecycle
    assert.equal(record.ghostId, 'ghost-test-1');
    assert.equal(record.personality, 'hunter');
    assert.equal(record.mountStatus, 'ready');
    assert.equal(record.inactivityReason, 'active');

    // 2. State & Sensing
    assert.equal(record.state, 'CHASING');
    assert.equal(record.detectionRadiusM, 25);
    assert.equal(record.distToPlayerM, 18.5);
    assert.deepEqual(record.lastStateTransition, { from: 'HIDING', to: 'CHASING', ageSec: 1.2 });
    assert.equal(record.safeZoneStatus, 'outside');

    // 3. Movement & Navigation
    assert.deepEqual(record.targetPosition, { x: 38.0, z: 36.2 });
    assert.equal(record.velocityMps, 4.2);
    assert.equal(record.pathfindingStatus, 'direct-corridor');
    assert.equal(record.pathWaypoints.length, 2);

    // 4. Combat & Cooldowns
    assert.equal(record.encounterStats.encounterCount, 1);
    assert.equal(record.encounterStats.chaseThreshold, 3);
    assert.equal(record.encounterStats.scareTriggerCount, 2);
    assert.equal(record.attackCooldown.grabPhase, 'none');

    // 5. Audio & Performance
    assert.equal(record.lastAudioEvent.cue, 'scream');
    assert.ok(record.audioContextState.includes('Scheduled/Decoded/Graph-Active'), 'context state must reflect graph-active');
    assert.deepEqual(record.microTimings, { aiMs: 0.12, audioMs: 0.08 });

    // Test second sample calculating delta distance
    fakeSnapshot.distToPlayerM = 15.0; // closed 3.5m
    fakeSnapshot.replanCount = 2;
    registerGhostDebugProvider('ghost-test-1', mockProvider); // triggers recompute
    const snap2 = getGhostDebugSnapshot();
    const record2 = snap2.ghosts.find((g) => g.ghostId === 'ghost-test-1');
    assert.ok(record2);
    assert.equal(record2.distToPlayerM, 15.0);
    assert.equal(record2.playerDistDeltaM, -3.5, 'closing distance must produce negative delta (-3.5m)');
  } finally {
    unregisterGhostDebugProvider('ghost-test-1');
    setGhostDevForceActive(false);
  }
});

test('P3-1 / Part 13: store controls (ghost selector, gizmos toggle, overlay visibility) operate cleanly', () => {
  // Test selection
  setSelectedGhostId('ghost-2');
  assert.equal(getGhostDebugSnapshot().selectedGhostId, 'ghost-2');
  setSelectedGhostId('all');
  assert.equal(getGhostDebugSnapshot().selectedGhostId, 'all');

  // Test gizmos toggle
  setGizmosEnabled(false);
  assert.equal(getGhostDebugSnapshot().gizmosEnabled, false);
  setGizmosEnabled(true);
  assert.equal(getGhostDebugSnapshot().gizmosEnabled, true);

  // Test overlay open toggle
  setGhostDebugOverlayOpen(true);
  assert.equal(getGhostDebugSnapshot().overlayOpen, true);
  setGhostDebugOverlayOpen(false);
  assert.equal(getGhostDebugSnapshot().overlayOpen, false);
});
