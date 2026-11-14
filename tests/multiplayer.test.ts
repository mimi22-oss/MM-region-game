import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from '@colyseus/sdk';
import { createTownServer } from '../server/server.ts';
import { presenceSpawn } from '../server/TownPresenceRoom.ts';
import { MultiplayerSession, validateEndpoint, type PresenceRoom } from '../src/multiplayer/session.ts';
import {
  MAX_PLAYERS, PRESENCE_ROOM, PROTOCOL_ERROR, PROTOCOL_VERSION, parseJoinPresence,
  type JoinPresence, type PresenceState,
} from '../shared/network.ts';

const profile = (name: string): JoinPresence => ({ version: PROTOCOL_VERSION, name, avatar: 'mint' });
async function until(check: () => boolean, label: string, timeout = 6000) {
  const end = Date.now() + timeout;
  while (!check()) {
    if (Date.now() >= end) assert.fail(`Timed out: ${label}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('protocol validation accepts bounded Unicode names and rejects authority fields', () => {
  assert.equal(parseJoinPresence(profile(' မြန်မာ '))?.name, 'မြန်မာ');
  for (const invalid of [null, [], {}, { ...profile('A'), x: 500 },
    { ...profile('A'), sessionId: 'victim' }, { ...profile('A'), owner: true },
    { ...profile('A'), inventory: [] }, { ...profile('A'), version: 999 },
    { ...profile('A'), avatar: 'admin' }, profile(''), profile('x'.repeat(25)), profile('<script>'), profile('a\nb')]) {
    assert.equal(parseJoinPresence(invalid), null);
  }
  assert.throws(() => validateEndpoint('file:///secret'));
  assert.throws(() => validateEndpoint('ws://user:pass@localhost'));
});

test('real Colyseus sockets: two-player lifecycle and authority boundary', { timeout: 30000 }, async t => {
  const { server, httpServer } = createTownServer();
  const sessions: MultiplayerSession[] = [];
  const rooms: PresenceRoom[] = [];
  await server.listen(0, '127.0.0.1');
  const address = httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `ws://127.0.0.1:${address.port}`;
  const connector = async (_endpoint: string, options: JoinPresence) => {
    const room = await new Client(endpoint).joinOrCreate<PresenceState>(PRESENCE_ROOM, options);
    rooms.push(room);
    return room;
  };
  const makeSession = () => {
    const session = new MultiplayerSession(connector);
    sessions.push(session);
    return session;
  };
  t.after(async () => {
    sessions.forEach(session => session.leave());
    await Promise.all(rooms.filter(room => room.connection.isOpen).map(room => room.leave()));
    await server.gracefullyShutdown(false);
  });

  const alice = makeSession(), bob = makeSession();
  await t.test('offline by default; both clients receive the same roster and server spawns', async () => {
    assert.equal(alice.getSnapshot().status, 'offline');
    assert.equal(rooms.length, 0);
    await alice.join(endpoint, 'Alice');
    await bob.join(endpoint, 'Bob', 'gold');
    await until(() => alice.getSnapshot().players.length === 2 && bob.getSnapshot().players.length === 2, 'two rosters');
    const a = alice.getSnapshot(), b = bob.getSnapshot();
    assert.equal(a.roomId, b.roomId);
    assert.notEqual(a.sessionId, b.sessionId);
    assert.deepEqual(a.players, b.players);
    assert.equal(a.players.filter(p => p.sessionId !== a.sessionId).length, 1);
    for (const player of a.players) {
      const expected = presenceSpawn(player.slot);
      assert.equal(player.x, expected.x);
      assert.equal(player.z, expected.z);
      assert.ok(player.slot >= 0 && player.slot < MAX_PLAYERS);
    }
  });

  await t.test('forged movement, teleport, ownership, inventory and editor messages cannot mutate state', async () => {
    const before = JSON.stringify(alice.getSnapshot().players);
    const room = rooms[1];
    let rejected = 0;
    room.onMessage(PROTOCOL_ERROR, payload => { assert.equal(payload.code, 'unsupported-message'); rejected++; });
    for (const command of ['move', 'teleport', 'ownership', 'inventory', 'world-edit']) {
      room.send(command, { sessionId: alice.getSnapshot().sessionId, x: 900, y: 50, z: 900, owner: true });
    }
    await until(() => rejected === 5, 'all forbidden commands rejected');
    assert.equal(JSON.stringify(alice.getSnapshot().players), before);
    assert.equal(JSON.stringify(bob.getSnapshot().players), before);
  });

  await t.test('bad version and client-supplied spawn are rejected at join', async () => {
    await assert.rejects(new Client(endpoint).joinOrCreate(PRESENCE_ROOM, { ...profile('Bad'), version: 999 }));
    await assert.rejects(new Client(endpoint).joinOrCreate(PRESENCE_ROOM, { ...profile('Bad'), x: 10 }));
    assert.equal(alice.getSnapshot().players.length, 2);
  });

  await t.test('leave removes the avatar; rejoin gets a fresh identity without stale roster', async () => {
    const oldId = bob.getSnapshot().sessionId;
    bob.leave();
    assert.equal(bob.getSnapshot().status, 'offline');
    assert.equal(bob.getSnapshot().players.length, 0);
    await until(() => alice.getSnapshot().players.length === 1, 'leave replication');
    await bob.join(endpoint, 'Bob again');
    await until(() => alice.getSnapshot().players.length === 2 && bob.getSnapshot().players.length === 2, 'rejoin');
    assert.notEqual(bob.getSnapshot().sessionId, oldId);
    assert.ok(!alice.getSnapshot().players.some(p => p.sessionId === oldId));
    assert.equal(new Set(alice.getSnapshot().players.map(p => p.slot)).size, 2);
  });

  await t.test('unexpected transport close clears both clients remote roster correctly', async () => {
    rooms.at(-1)!.connection.close(4001, 'test transport loss');
    await until(() => bob.getSnapshot().status === 'disconnected', 'disconnect status');
    assert.equal(bob.getSnapshot().players.length, 0);
    await until(() => alice.getSnapshot().players.length === 1, 'dropped player removal');
  });

  await t.test('cancelling a pending join releases the late real socket', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let lateRoom: PresenceRoom | undefined;
    const pendingSession = new MultiplayerSession(async (_url, options) => {
      await gate;
      lateRoom = await connector(endpoint, options);
      return lateRoom;
    });
    sessions.push(pendingSession);
    const joining = pendingSession.join(endpoint, 'Cancelled');
    pendingSession.leave();
    await joining;
    release();
    await until(() => !!lateRoom && !lateRoom.connection.isOpen, 'late socket released');
    await until(() => alice.getSnapshot().players.length === 1, 'late player removed');
    assert.equal(pendingSession.getSnapshot().status, 'offline');
  });

  await t.test('server shutdown clears remote avatars and allows local-only state', async () => {
    await server.gracefullyShutdown(false);
    await until(() => alice.getSnapshot().status === 'disconnected', 'shutdown notification');
    assert.equal(alice.getSnapshot().players.length, 0);
    alice.leave();
    assert.equal(alice.getSnapshot().status, 'offline');
  });
});

test('connection errors and timeouts settle without an unhandled rejection', async () => {
  const failed = new MultiplayerSession(async () => { throw new Error('Unavailable'); });
  await failed.join('ws://127.0.0.1:1', 'Test');
  assert.equal(failed.getSnapshot().status, 'error');
  assert.equal(failed.getSnapshot().error, 'Unavailable');
  const timedOut = new MultiplayerSession(() => new Promise(() => {}), 20);
  await timedOut.join('ws://127.0.0.1:1', 'Test');
  assert.equal(timedOut.getSnapshot().status, 'error');
  assert.match(timedOut.getSnapshot().error, /timed out/);
  timedOut.leave();
  assert.equal(timedOut.getSnapshot().status, 'offline');
});
