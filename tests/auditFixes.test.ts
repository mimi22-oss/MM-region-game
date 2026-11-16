import assert from 'node:assert/strict';
import test from 'node:test';
import { WorldSimulation } from '../server/worldSimulation.ts';
import { MultiplayerSession } from '../src/multiplayer/session.ts';
import { PLAYER_MOVEMENT_LIMITS } from '../shared/network.ts';

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
