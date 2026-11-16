import assert from 'node:assert/strict';
import { Client } from '@colyseus/sdk';
import { createTownServer } from '../server/server.ts';
import { issueSessionToken } from '../server/auth.ts';
import { WorldSimulation } from '../server/worldSimulation.ts';
import {
  AUTHORITATIVE_PROTOCOL_VERSION,
  AUTHORITATIVE_WORLD_ROOM,
  DEFAULT_INTEREST_RADIUS_M,
  WAREHOUSE_GHOST_ENCOUNTER,
  WORLD_MESSAGE_TYPES,
} from '../shared/network.ts';

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return round3(sorted[idx]);
}

function runSyntheticSimulationSoak(botCount, tickCount, combatEnabled) {
  const sim = new WorldSimulation({ combatEnabled });
  const ids = [];
  const clusterAnchors = [
    { x: 35.149, z: 36.176 },
    { x: 140, z: 240 },
    { x: 458.67, z: -464.24 },
    { x: 1385, z: -804 },
  ];

  for (let i = 0; i < botCount; i++) {
    const id = `bot-${i}`;
    ids.push(id);
    sim.addPlayer(
      id,
      {
        schemaVersion: 2,
        accountId: `acc_${i}`,
        displayName: `Bot${i}`,
        role: 'player',
        avatar: i % 2 === 0 ? 'mint' : 'gold',
        issuedAtMs: 0,
        expiresAtMs: 999999999999,
      },
      i,
    );
    const anchor = clusterAnchors[i % clusterAnchors.length];
    sim.placeEntityForServerTest(
      id,
      anchor.x + ((i % 4) - 1.5) * 3,
      anchor.z + (Math.floor(i / 4) % 4) * 3,
    );
  }

  const tickDurations = [];
  let snapshotsBuilt = 0;
  let totalVisiblePlayerEntries = 0;
  let totalCombatEvents = 0;

  for (let tick = 1; tick <= tickCount; tick++) {
    const simNowMs = 1_700_000_000_000 + tick * 50;
    for (let i = 0; i < botCount; i++) {
      const ang = tick * 0.1 + i;
      sim.enqueueMoveIntent(ids[i], tick, {
        dx: Math.cos(ang),
        dz: Math.sin(ang),
        yaw: ang,
        sprinting: i % 3 === 0,
        dtMs: 50,
      });
      if (combatEnabled && tick % 15 === 0) {
        sim.applyCombatStrike(
          ids[i],
          {
            targetId: i % 4 === 0 ? WAREHOUSE_GHOST_ENCOUNTER.id : ids[(i + 4) % botCount],
            targetKind: i % 4 === 0 ? 'ghost' : 'player',
            abilityId: tick % 30 === 0 ? 'ward-pulse' : 'light-strike',
            aimYaw: ang,
          },
          simNowMs,
        );
      }
    }

    const metrics = sim.stepTick(0.05, simNowMs);
    tickDurations.push(metrics.durationMs);
    const events = sim.flushTickEvents();
    totalCombatEvents += events.length;

    for (const id of ids) {
      const snap = sim.buildSnapshotForPlayer(id, events, simNowMs, DEFAULT_INTEREST_RADIUS_M);
      if (snap) {
        snapshotsBuilt += 1;
        totalVisiblePlayerEntries += snap.visiblePlayers.length;
      }
    }
  }

  const avgTickMs = round3(tickDurations.reduce((a, b) => a + b, 0) / tickDurations.length);
  const naiveN2Broadcasts = botCount * (botCount - 1) * tickCount;
  const fanoutReductionPct = round3((1 - totalVisiblePlayerEntries / naiveN2Broadcasts) * 100);

  return {
    botCount,
    tickCount,
    combatEnabled,
    avgTickMs,
    p95TickMs: percentile(tickDurations, 0.95),
    maxTickMs: round3(Math.max(...tickDurations)),
    tickBudgetMs: 50,
    snapshotsBuilt,
    avgVisiblePeersPerObserver: round3(totalVisiblePlayerEntries / snapshotsBuilt),
    naiveMaxPeersPerObserver: botCount - 1,
    bandwidthFanoutReductionPct: fanoutReductionPct,
    totalCombatEvents,
  };
}

async function runRealWebSocketLoadTest(clientCount, durationMs, combatEnabled) {
  let simRef = null;
  const { server, httpServer, authSecret } = createTownServer({
    combatEnabled,
    reconnectSeconds: 0,
    maxAuthoritativePlayers: clientCount + 4,
    onAuthoritativeRoomCreated: (sim) => {
      simRef = sim;
    },
  });

  await server.listen(0, '127.0.0.1');
  const address = httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `ws://127.0.0.1:${address.port}`;

  const clusterAnchors = [
    { x: 35.149, z: 36.176 },
    { x: 140, z: 240 },
    { x: 458.67, z: -464.24 },
    { x: 1385, z: -804 },
  ];

  const clients = [];
  const snapshotsByClient = new Map();
  const visibleSumByClient = new Map();
  let strikeAccepted = 0;
  let strikeRejected = 0;

  try {
    for (let i = 0; i < clientCount; i++) {
      const token = issueSessionToken(authSecret, {
        accountId: `load_ws_${i}`,
        displayName: `Runner${i}`,
        role: 'player',
        avatar: i % 2 === 0 ? 'mint' : 'gold',
      });
      const room = await new Client(endpoint).joinOrCreate(AUTHORITATIVE_WORLD_ROOM, {
        version: AUTHORITATIVE_PROTOCOL_VERSION,
        token,
        avatar: i % 2 === 0 ? 'mint' : 'gold',
      });
      snapshotsByClient.set(room.sessionId, 0);
      visibleSumByClient.set(room.sessionId, 0);
      room.onMessage(WORLD_MESSAGE_TYPES.intentRejected, () => {
        strikeRejected += 1;
      });
      room.onMessage(WORLD_MESSAGE_TYPES.worldSnapshot, (snap) => {
        const s = snap;
        snapshotsByClient.set(room.sessionId, (snapshotsByClient.get(room.sessionId) ?? 0) + 1);
        visibleSumByClient.set(
          room.sessionId,
          (visibleSumByClient.get(room.sessionId) ?? 0) + s.visiblePlayers.length,
        );
        strikeAccepted += s.combatEvents.length;
      });
      clients.push(room);

      const anchor = clusterAnchors[i % clusterAnchors.length];
      simRef?.placeEntityForServerTest(
        room.sessionId,
        anchor.x + ((i % 4) - 1.5) * 3,
        anchor.z + (Math.floor(i / 4) % 4) * 3,
      );
    }

    const startTime = performance.now();
    let seq = 0;
    while (performance.now() - startTime < durationMs) {
      seq += 1;
      const now = Date.now();
      for (let i = 0; i < clients.length; i++) {
        const room = clients[i];
        const ang = seq * 0.15 + i;
        const moveEnv = {
          protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
          domain: 'movement',
          type: 'move',
          seq,
          clientTimeMs: now,
          payload: {
            dx: Math.cos(ang),
            dz: Math.sin(ang),
            yaw: ang,
            sprinting: i % 2 === 0,
            dtMs: 50,
          },
        };
        room.send(WORLD_MESSAGE_TYPES.moveIntent, moveEnv);

        if (combatEnabled && seq % 14 === 0 && i % 4 === 0) {
          const strikeEnv = {
            protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
            domain: 'combat',
            type: 'strike',
            seq,
            clientTimeMs: now,
            payload: {
              targetId: WAREHOUSE_GHOST_ENCOUNTER.id,
              targetKind: 'ghost',
              abilityId: 'light-strike',
              aimYaw: ang,
            },
          };
          room.send(WORLD_MESSAGE_TYPES.combatStrike, strikeEnv);
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    const totalSnaps = Array.from(snapshotsByClient.values()).reduce((a, b) => a + b, 0);
    const totalVis = Array.from(visibleSumByClient.values()).reduce((a, b) => a + b, 0);
    return {
      socketClients: clientCount,
      durationMs,
      combatEnabled,
      snapshotsReceived: totalSnaps,
      avgVisiblePeersPerSnapshot: totalSnaps > 0 ? round3(totalVis / totalSnaps) : 0,
      avgTickMs: clients[0]?.state?.avgTickMs ?? 0,
      serverTickReached: clients[0]?.state?.serverTick ?? 0,
      observedCombatFanoutEvents: strikeAccepted,
      rejectedOutOfRangeStrikes: strikeRejected,
    };
  } finally {
    await Promise.all(clients.filter((c) => c.connection.isOpen).map((c) => c.leave()));
    await server.gracefullyShutdown(false);
  }
}

const phase5ASim = runSyntheticSimulationSoak(64, 200, false);
const phase5AWebSocket = await runRealWebSocketLoadTest(32, 3000, false);
const phase5BSimWithCombat = runSyntheticSimulationSoak(64, 200, true);
const phase5BWebSocketWithCombat = await runRealWebSocketLoadTest(32, 3000, true);

assert.ok(phase5ASim.p95TickMs < 20, `5A sim p95 tick ${phase5ASim.p95TickMs}ms exceeded 20ms`);
assert.ok(phase5BSimWithCombat.p95TickMs < 20, `5B sim p95 tick ${phase5BSimWithCombat.p95TickMs}ms exceeded 20ms`);
assert.ok(phase5AWebSocket.snapshotsReceived >= 32 * 20, 'Expected >=20 snapshots per WS client');
assert.ok(phase5BWebSocketWithCombat.snapshotsReceived >= 32 * 20, 'Expected >=20 snapshots per WS client with combat');
assert.ok(phase5AWebSocket.avgVisiblePeersPerSnapshot < 12, 'Interest radius must bound visible peer count per observer');

console.log(
  JSON.stringify(
    {
      passed: true,
      phase5a_movement_interest_ghost: {
        synthetic64Bots: phase5ASim,
        realWebSocket32Clients: phase5AWebSocket,
      },
      phase5b_with_authoritative_combat: {
        synthetic64Bots: phase5BSimWithCombat,
        realWebSocket32Clients: phase5BWebSocketWithCombat,
      },
    },
    null,
    2,
  ),
);
