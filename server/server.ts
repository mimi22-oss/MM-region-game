import { createServer } from 'node:http';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { AUTHORITATIVE_WORLD_ROOM, PRESENCE_ROOM } from '../shared/network.ts';
import { issueGuestSessionToken, resolveAuthSecret } from './auth.ts';
import { TownPresenceRoom } from './TownPresenceRoom.ts';
import {
  TownAuthoritativeRoom,
  type AuthoritativeRoomRuntimeConfig,
} from './TownAuthoritativeRoom.ts';
import type { WorldSimulation } from './worldSimulation.ts';
import { createDefaultWalkabilityPort } from './walkabilityProviders.ts';

export interface TownServerOptions {
  readonly authSecret?: string;
  readonly reconnectSeconds?: number;
  readonly maxAuthoritativePlayers?: number;
  readonly interestRadiusM?: number;
  readonly combatEnabled?: boolean;
  readonly onAuthoritativeRoomCreated?: (sim: WorldSimulation, roomId: string) => void;
}

/** Factory shared by the runnable server, load benchmarks, and real-socket integration tests. */
export function createTownServer(options: TownServerOptions = {}) {
  const authSecret = resolveAuthSecret(options.authSecret);
  const httpServer = createServer();
  const roomConfig: AuthoritativeRoomRuntimeConfig = {
    authSecret,
    reconnectSeconds: options.reconnectSeconds ?? 5,
    maxPlayers: options.maxAuthoritativePlayers,
    interestRadiusM: options.interestRadiusM,
    combatEnabled: options.combatEnabled ?? true,
    // F02: provide default warehouse collision + home protection so the
    // authoritative ghost cannot grab players through impassable walls.
    walkability: createDefaultWalkabilityPort(),
    onSimulationCreated: options.onAuthoritativeRoomCreated,
  };

  const server = new Server({
    greet: false,
    gracefullyShutdown: false,
    transport: new WebSocketTransport({
      server: httpServer,
      maxPayload: 4096,
      pingInterval: 3000,
      pingMaxRetries: 2,
    }),
    express: (app) => {
      app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
        next();
      });
      app.use(express.json({ limit: '2kb' }));
      app.get('/health', (_req, res) => {
        res.json({ ok: true, rooms: [PRESENCE_ROOM, AUTHORITATIVE_WORLD_ROOM] });
      });
      app.post('/auth/token', (req, res) => {
        try {
          const body = req.body as Record<string, unknown> | undefined;
          const { token, claims } = issueGuestSessionToken(
            authSecret,
            body?.name,
            body?.avatar,
          );
          res.status(200).json({ token, claims });
        } catch (err) {
          res.status(400).json({
            error: err instanceof Error ? err.message : 'Invalid token request',
          });
        }
      });
    },
  });

  server.define(PRESENCE_ROOM, TownPresenceRoom);
  server.define(AUTHORITATIVE_WORLD_ROOM, TownAuthoritativeRoom, roomConfig);
  return { server, httpServer, authSecret };
}
