import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@colyseus/sdk';
import { createTownServer } from '../server/server.ts';
import { issueGuestSessionToken, issueSessionToken, verifySessionToken } from '../server/auth.ts';
import { WorldSimulation } from '../server/worldSimulation.ts';
import {
  AUTHORITATIVE_HOME_SAFE_ZONE,
  AUTHORITATIVE_PROTOCOL_VERSION,
  AUTHORITATIVE_WORLD_ROOM,
  PRESENCE_ROOM,
  PROTOCOL_ERROR,
  PROTOCOL_VERSION,
  WAREHOUSE_GHOST_ENCOUNTER,
  WORLD_MESSAGE_TYPES,
  isPointInHomeSafeZone,
  type AuthoritativeAvatarStyle,
  type JoinAuthoritativeOptions,
  type JoinPresence,
  type PresenceState,
  type ServerRejectionPayload,
  type WorldSnapshotPayload,
} from '../shared/network.ts';
import {
  PLAYER_HOME_REFERENCE,
  TEMPORARY_HOME_BOUNDARY,
} from '../src/game/playerHomeProtection.ts';
import {
  createMapAccessContext,
  resolveCurrentMapAccessContext,
  setActiveAuthoritySession,
} from '../src/game/mapPermissions.ts';
import { MultiplayerSession } from '../src/multiplayer/session.ts';

async function until(check: () => boolean, label: string, timeoutMs = 8000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= end) assert.fail(`Timed out waiting for: ${label}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

test('Phase 5 contracts match playerHomeProtection single-source geometry', () => {
  assert.equal(AUTHORITATIVE_HOME_SAFE_ZONE.x, PLAYER_HOME_REFERENCE.x);
  assert.equal(AUTHORITATIVE_HOME_SAFE_ZONE.z, PLAYER_HOME_REFERENCE.z);
  assert.equal(
    TEMPORARY_HOME_BOUNDARY.kind === 'circle' ? TEMPORARY_HOME_BOUNDARY.radius : 0,
    AUTHORITATIVE_HOME_SAFE_ZONE.radius,
  );
  assert.equal(isPointInHomeSafeZone(PLAYER_HOME_REFERENCE.x, PLAYER_HOME_REFERENCE.z), true);
  assert.equal(
    isPointInHomeSafeZone(WAREHOUSE_GHOST_ENCOUNTER.anchorX, WAREHOUSE_GHOST_ENCOUNTER.anchorZ),
    false,
  );
});

test('Phase 5 session auth signs, verifies, rejects tampering/expiry, and strips admin role on guest issuance', () => {
  const secret = 'test-secret-phase5-authoritative-01';
  const { token, claims } = issueGuestSessionToken(secret, ' မြန်မာGuest ', 'gold');
  assert.equal(claims.role, 'player');
  assert.equal(claims.avatar, 'gold');

  const verified = verifySessionToken(secret, token);
  assert.ok(verified);
  assert.equal(verified.accountId, claims.accountId);
  assert.equal(verified.role, 'player');

  // Tampered payload rejected by timing-safe HMAC check
  const parts = token.split('.');
  const badPayload = Buffer.from(JSON.stringify({ ...claims, role: 'admin' }), 'utf8').toString('base64url');
  assert.equal(verifySessionToken(secret, `${parts[0]}.${badPayload}.${parts[2]}`), null);

  // Wrong secret or expired token rejected
  assert.equal(verifySessionToken('other-secret-0123456789', token), null);
  const expiredToken = issueSessionToken(
    secret,
    { accountId: 'acc_expired', displayName: 'Old', role: 'player', ttlMs: 1000 },
    1000,
  );
  assert.equal(verifySessionToken(secret, expiredToken, 5000), null);
});

test('Phase 5 real Colyseus sockets: auth, spatial interest isolation, ghost encounter, combat, and anti-cheat', { timeout: 35000 }, async (t) => {
  let activeSim: WorldSimulation | null = null;
  const { server, httpServer, authSecret } = createTownServer({
    authSecret: 'phase5-socket-test-secret-key-99',
    reconnectSeconds: 1,
    onAuthoritativeRoomCreated: (sim) => {
      activeSim = sim;
    },
  });

  await server.listen(0, '127.0.0.1');
  const addr = httpServer.address();
  assert.ok(addr && typeof addr !== 'string');
  const wsEndpoint = `ws://127.0.0.1:${addr.port}`;
  const httpEndpoint = `http://127.0.0.1:${addr.port}`;

  const rawRooms: Array<{ leave(): Promise<unknown>; connection: { isOpen: boolean } }> = [];
  const sessions: MultiplayerSession[] = [];

  t.after(async () => {
    setActiveAuthoritySession('local-offline');
    sessions.forEach((s) => s.leave());
    await Promise.all(rawRooms.filter((r) => r.connection.isOpen).map((r) => r.leave()));
    await server.gracefullyShutdown(false);
  });

  await t.test('rejects unauthenticated, expired, tampered, or v1-spawn-forged joins', async () => {
    const expired = issueSessionToken(
      authSecret,
      { accountId: 'acc_exp', displayName: 'Exp', role: 'player', ttlMs: 1000 },
      1000,
    );
    await assert.rejects(
      new Client(wsEndpoint).joinOrCreate(AUTHORITATIVE_WORLD_ROOM, {
        version: AUTHORITATIVE_PROTOCOL_VERSION,
        token: '',
        avatar: 'mint',
      }),
    );
    await assert.rejects(
      new Client(wsEndpoint).joinOrCreate(AUTHORITATIVE_WORLD_ROOM, {
        version: AUTHORITATIVE_PROTOCOL_VERSION,
        token: expired,
        avatar: 'mint',
      }),
    );
    await assert.rejects(
      new Client(wsEndpoint).joinOrCreate(AUTHORITATIVE_WORLD_ROOM, {
        version: AUTHORITATIVE_PROTOCOL_VERSION,
        token: issueSessionToken(authSecret, { accountId: 'acc_bad', displayName: 'Bad' }),
        avatar: 'mint',
        x: 900,
      }),
    );
  });

  await t.test('guest /auth/token never grants admin and client session removes local admin default', async () => {
    const res = await fetch(`${httpEndpoint}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PlayerOne', role: 'admin', isAdmin: true }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; claims: { role: string } };
    assert.equal(body.claims.role, 'player');

    const localAdminCtx = createMapAccessContext('admin');
    assert.equal(resolveCurrentMapAccessContext(localAdminCtx).role, 'admin');

    const authConnector = async (endpoint: string, opts: JoinAuthoritativeOptions) => {
      const room = await new Client(endpoint).joinOrCreate<Record<string, unknown>>(
        AUTHORITATIVE_WORLD_ROOM,
        opts,
      );
      rawRooms.push(room);
      return room;
    };
    const aliceSession = new MultiplayerSession(undefined, 8000, {
      mode: 'authoritative-v2',
      authConnector,
    });
    sessions.push(aliceSession);

    await aliceSession.join(wsEndpoint, 'Alice', 'mint', { token: body.token });
    await until(
      () =>
        aliceSession.getSnapshot().status === 'connected' &&
        aliceSession.getSnapshot().selfPlayer !== null,
      'alice authoritative join & initial snapshot',
    );
    assert.equal(aliceSession.getSnapshot().serverRole, 'player');
    // Connected authoritative player loses local admin default!
    assert.equal(resolveCurrentMapAccessContext(localAdminCtx).role, 'user');

    aliceSession.leave();
    assert.equal(resolveCurrentMapAccessContext(localAdminCtx).role, 'admin');
  });

  await t.test('interest management isolates distant cells, Ghost respects home protection, and combat validates anti-cheat', async () => {
    const tokA = issueSessionToken(authSecret, { accountId: 'acc_a', displayName: 'Alice', role: 'player' });
    const tokB = issueSessionToken(authSecret, { accountId: 'acc_b', displayName: 'Bob', role: 'player' });
    const tokC = issueSessionToken(authSecret, { accountId: 'acc_c', displayName: 'Charlie', role: 'player' });

    const joinDirect = async (token: string, avatar: AuthoritativeAvatarStyle) => {
      const r = await new Client(wsEndpoint).joinOrCreate<Record<string, unknown>>(
        AUTHORITATIVE_WORLD_ROOM,
        { version: AUTHORITATIVE_PROTOCOL_VERSION, token, avatar },
      );
      rawRooms.push(r);
      return r;
    };

    const roomA = await joinDirect(tokA, 'mint');
    const roomB = await joinDirect(tokB, 'gold');
    const roomC = await joinDirect(tokC, 'mint');

    let snapA: WorldSnapshotPayload | null = null;
    let snapB: WorldSnapshotPayload | null = null;
    let snapC: WorldSnapshotPayload | null = null;
    const rejA: ServerRejectionPayload[] = [];
    let protoErrorsA = 0;

    roomA.onMessage(WORLD_MESSAGE_TYPES.worldSnapshot, (s: WorldSnapshotPayload) => { snapA = s; });
    roomB.onMessage(WORLD_MESSAGE_TYPES.worldSnapshot, (s: WorldSnapshotPayload) => { snapB = s; });
    roomC.onMessage(WORLD_MESSAGE_TYPES.worldSnapshot, (s: WorldSnapshotPayload) => { snapC = s; });
    roomA.onMessage(WORLD_MESSAGE_TYPES.intentRejected, (r: ServerRejectionPayload) => { rejA.push(r); });
    roomA.onMessage(PROTOCOL_ERROR, () => { protoErrorsA += 1; });

    assert.ok(activeSim, 'Server simulation created');
    // Place Alice & Bob near Warehouse (35.15, 36.18), and Charlie far away in Kanbale East (1385, -804)
    activeSim.placeEntityForServerTest(roomA.sessionId, 38, 36.176);
    activeSim.placeEntityForServerTest(roomB.sessionId, 40, 36.176);
    activeSim.placeEntityForServerTest(roomC.sessionId, 1385, -804);

    await until(
      () =>
        snapA !== null &&
        snapC !== null &&
        snapA.visiblePlayers.some((p) => p.sessionId === roomB.sessionId) &&
        snapA.visibleGhosts.length === 1,
      'interest snapshots settled',
    );

    // Spatial interest isolation: Alice sees Bob + Warehouse Ghost, never Charlie; Charlie sees neither!
    assert.ok(!snapA!.visiblePlayers.some((p) => p.sessionId === roomC.sessionId));
    assert.equal(snapC!.visiblePlayers.length, 0);
    assert.equal(snapC!.visibleGhosts.length, 0);
    assert.notEqual(snapA!.cellId, snapC!.cellId);

    // Tampered movement & unsupported admin commands rejected without moving Alice
    const xBeforeHack = snapA!.self.x;
    roomA.send(WORLD_MESSAGE_TYPES.moveIntent, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'movement',
      type: 'move',
      seq: 1,
      clientTimeMs: Date.now(),
      payload: { dx: 1, dz: 0, yaw: 0, sprinting: true, dtMs: 50, x: 9999 },
    });
    roomA.send('teleport', { x: 900, z: 900 });
    await until(() => rejA.length >= 1 && protoErrorsA >= 1, 'tampered movement & teleport rejected');
    assert.ok(Math.abs(snapA!.self.x - xBeforeHack) < 1);

    // Legitimate move intent moves Alice within server velocity limits
    roomA.send(WORLD_MESSAGE_TYPES.moveIntent, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'movement',
      type: 'move',
      seq: 2,
      clientTimeMs: Date.now(),
      payload: { dx: 1, dz: 0, yaw: 1.57, sprinting: false, dtMs: 200 },
    });
    await until(() => snapA!.self.lastAckSeq >= 2, 'legit move acknowledged');
    assert.ok(snapA!.self.x > xBeforeHack && snapA!.self.x < xBeforeHack + 2);

    // Impossible hit: Charlie (in Kanbale, >1500m away) tries to strike Ghost -> out_of_range
    const rejC: ServerRejectionPayload[] = [];
    roomC.onMessage(WORLD_MESSAGE_TYPES.intentRejected, (r: ServerRejectionPayload) => { rejC.push(r); });
    roomC.send(WORLD_MESSAGE_TYPES.combatStrike, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'combat',
      type: 'strike',
      seq: 1,
      clientTimeMs: Date.now(),
      payload: {
        targetId: WAREHOUSE_GHOST_ENCOUNTER.id,
        targetKind: 'ghost',
        abilityId: 'light-strike',
        aimYaw: 0,
      },
    });
    await until(() => rejC.some((r) => r.reason === 'out_of_range'), 'impossible hit rejected');
    assert.equal(snapA!.visibleGhosts[0].hp, WAREHOUSE_GHOST_ENCOUNTER.maxHp);

    // Tampered damage smuggle rejected
    const rejLenBefore = rejA.length;
    roomA.send(WORLD_MESSAGE_TYPES.combatStrike, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'combat',
      type: 'strike',
      seq: 3,
      clientTimeMs: Date.now(),
      payload: {
        targetId: WAREHOUSE_GHOST_ENCOUNTER.id,
        targetKind: 'ghost',
        abilityId: 'light-strike',
        aimYaw: 0,
        damage: 9999,
      },
    });
    await until(() => rejA.length > rejLenBefore, 'tampered damage rejected');
    assert.equal(snapA!.visibleGhosts[0].hp, WAREHOUSE_GHOST_ENCOUNTER.maxHp);

    // PvP inside Protected Home Safe Zone is blocked by server
    activeSim.placeEntityForServerTest(
      roomB.sessionId,
      AUTHORITATIVE_HOME_SAFE_ZONE.x,
      AUTHORITATIVE_HOME_SAFE_ZONE.z,
    );
    activeSim.placeEntityForServerTest(
      roomA.sessionId,
      AUTHORITATIVE_HOME_SAFE_ZONE.x + 1.5,
      AUTHORITATIVE_HOME_SAFE_ZONE.z,
    );
    await until(() => Boolean(snapB?.self.inSafeZone), 'Bob inside safe zone');
    const rejProtectedBefore = rejA.length;
    roomA.send(WORLD_MESSAGE_TYPES.combatStrike, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'combat',
      type: 'strike',
      seq: 4,
      clientTimeMs: Date.now(),
      payload: {
        targetId: roomB.sessionId,
        targetKind: 'player',
        abilityId: 'light-strike',
        aimYaw: 0,
      },
    });
    await until(
      () => rejA.slice(rejProtectedBefore).some((r) => r.reason === 'protected_zone'),
      'safe-zone PvP strike blocked',
    );

    // Ghost retreats and deals 0 damage if placed at home protection perimeter
    activeSim.placeEntityForServerTest(
      WAREHOUSE_GHOST_ENCOUNTER.id,
      AUTHORITATIVE_HOME_SAFE_ZONE.x + AUTHORITATIVE_HOME_SAFE_ZONE.radius + 1,
      AUTHORITATIVE_HOME_SAFE_ZONE.z,
    );
    await until(
      () => Boolean(snapB?.visibleGhosts[0]?.homeProtected) && snapB?.visibleGhosts[0]?.state === 'RETREATING',
      'ghost forced into retreat near protected home',
    );
    assert.equal(snapB!.self.hp, 100);

    // Authoritative Ghost Combat + Banishment: bring Alice right up to Ghost away from home
    activeSim.placeEntityForServerTest(WAREHOUSE_GHOST_ENCOUNTER.id, 35.149, 36.176);
    activeSim.placeEntityForServerTest(roomA.sessionId, 36.5, 36.176);
    await until(() => snapA!.visibleGhosts[0]?.state !== 'RETREATING', 'ghost active at warehouse');

    roomA.send(WORLD_MESSAGE_TYPES.combatStrike, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'combat',
      type: 'strike',
      seq: 5,
      clientTimeMs: Date.now(),
      payload: {
        targetId: WAREHOUSE_GHOST_ENCOUNTER.id,
        targetKind: 'ghost',
        abilityId: 'ward-pulse',
        aimYaw: 0,
      },
    });
    await until(() => snapA!.visibleGhosts[0].hp === 80, 'ward-pulse reduced ghost HP from 120 to 80');

    // Cooldown spam check immediately after ward-pulse (1800ms cooldown)
    const rejCooldownBefore = rejA.length;
    roomA.send(WORLD_MESSAGE_TYPES.combatStrike, {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'combat',
      type: 'strike',
      seq: 6,
      clientTimeMs: Date.now(),
      payload: {
        targetId: WAREHOUSE_GHOST_ENCOUNTER.id,
        targetKind: 'ghost',
        abilityId: 'ward-pulse',
        aimYaw: 0,
      },
    });
    await until(
      () => rejA.slice(rejCooldownBefore).some((r) => r.reason === 'cooldown'),
      'ability cooldown enforced',
    );
  });

  await t.test('rollback flag presence-v1 still connects cleanly to TownPresenceRoom', async () => {
    const legacyConnector = async (endpoint: string, profile: JoinPresence) => {
      const r = await new Client(endpoint).joinOrCreate<PresenceState>(PRESENCE_ROOM, profile);
      rawRooms.push(r);
      return r;
    };
    const rollbackSession = new MultiplayerSession(legacyConnector, 8000, { mode: 'presence-v1' });
    sessions.push(rollbackSession);
    await rollbackSession.join(wsEndpoint, 'RollbackGuest', 'gold', { mode: 'presence-v1' });
    await until(
      () =>
        rollbackSession.getSnapshot().status === 'connected' &&
        rollbackSession.getSnapshot().players.length === 1,
      'presence-v1 fallback connected with roster',
    );
    assert.equal(rollbackSession.getSnapshot().mode, 'presence-v1');
    assert.equal(rollbackSession.getSnapshot().players.length, 1);
  });

  await t.test('WorldSimulation deterministic combat banishes Ghost and respawns KO PvP player at protected home', () => {
    const sim = new WorldSimulation({ combatEnabled: true });
    const claimsA = {
      schemaVersion: 2 as const,
      accountId: 'sim_a',
      displayName: 'FighterA',
      role: 'player' as const,
      avatar: 'mint' as const,
      issuedAtMs: 0,
      expiresAtMs: 999999999999,
    };
    const claimsB = {
      ...claimsA,
      accountId: 'sim_b',
      displayName: 'FighterB',
    };
    sim.addPlayer('sa', claimsA, 0);
    sim.addPlayer('sb', claimsB, 1);
    sim.placeEntityForServerTest('sa', 36.5, 36.176);
    sim.placeEntityForServerTest('sb', 38.0, 36.176);

    // Banish Warehouse Ghost cleanly with 3 ward pulses (3 * 40 = 120)
    let now = 10_000;
    for (let i = 0; i < 3; i++) {
      const res = sim.applyCombatStrike(
        'sa',
        { targetId: WAREHOUSE_GHOST_ENCOUNTER.id, targetKind: 'ghost', abilityId: 'ward-pulse', aimYaw: 0 },
        now,
      );
      assert.equal(res.ok, true);
      if (i === 2) assert.equal(res.event?.defeated, true);
      for (let t = 0; t < 40; t++) {
        now += 50;
        sim.stepTick(0.05, now);
      }
    }
    const snap = sim.buildSnapshotForPlayer('sa', [], now);
    assert.equal(snap?.visibleGhosts[0]?.state, 'BANISHED');
    assert.equal(snap?.visibleGhosts[0]?.hp, 0);

    // Drain FighterA stamina sequentially until server enforces insufficient_stamina, or regen & verify KO -> protected home
    sim.placeEntityForServerTest('sb', 38.0, 36.176);
    let sawStaminaReject = false;
    let koSeen = false;
    for (let i = 0; i < 6; i++) {
      now += 1900;
      sim.stepTick(0.05, now); // minimal regen so stamina depletes cleanly
      const attempt = sim.applyCombatStrike(
        'sa',
        { targetId: 'sb', targetKind: 'player', abilityId: 'ward-pulse', aimYaw: 0 },
        now,
      );
      if (!attempt.ok && attempt.reason === 'insufficient_stamina') {
        sawStaminaReject = true;
        break;
      }
      if (attempt.ok && attempt.event?.defeated) {
        koSeen = true;
        // Recharge stamina cleanly so stamina check passes and safe-zone protection blocks strike on KO'd respawn
        for (let t = 0; t < 40; t++) {
          now += 50;
          sim.stepTick(0.05, now);
        }
        const afterKo = sim.applyCombatStrike(
          'sa',
          { targetId: 'sb', targetKind: 'player', abilityId: 'light-strike', aimYaw: 0 },
          now,
        );
        assert.equal(afterKo.ok, false);
        assert.equal(afterKo.reason, 'protected_zone');
        break;
      }
    }
    const snapB = sim.buildSnapshotForPlayer('sb', [], now);
    assert.ok(snapB);
    assert.ok(sawStaminaReject || koSeen);
    assert.equal(snapB.self.inSafeZone, true);
    assert.equal(snapB.self.hp, 100);
  });
});
