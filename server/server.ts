import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PRESENCE_ROOM } from '../shared/network.ts';
import { TownPresenceRoom } from './TownPresenceRoom.ts';

/** Factory shared by the runnable server and real-socket integration tests. */
export function createTownServer() {
  const httpServer = createServer();
  const server = new Server({
    greet: false,
    gracefullyShutdown: false,
    transport: new WebSocketTransport({
      server: httpServer, maxPayload: 1024, pingInterval: 3000, pingMaxRetries: 2,
    }),
  });
  server.define(PRESENCE_ROOM, TownPresenceRoom);
  return { server, httpServer };
}
