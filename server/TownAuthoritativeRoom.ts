import { Room, ServerError, type Client } from '@colyseus/core';
import {
  AUTHORITATIVE_PROTOCOL_VERSION,
  DEFAULT_INTEREST_RADIUS_M,
  MAX_AUTHORITATIVE_PLAYERS,
  PROTOCOL_ERROR,
  WORLD_MESSAGE_TYPES,
  WORLD_TICK_MS,
  parseClientIntentEnvelope,
  parseCombatStrikePayload,
  parseJoinAuthoritativeOptions,
  parseMoveIntentPayload,
  type CombatEventRecord,
  type ProtocolError,
  type ServerRejectionPayload,
} from '../shared/network.ts';
import type { WalkabilityPort } from '../shared/contracts/index.ts';
import { verifySessionToken, type VerifiedSessionAuth } from './auth.ts';
import { TownAuthoritativeMetaState } from './state.ts';
import { WorldSimulation, type SimulationTickMetrics } from './worldSimulation.ts';

export interface AuthoritativeRoomRuntimeConfig {
  readonly authSecret: string;
  readonly reconnectSeconds?: number;
  readonly maxPlayers?: number;
  readonly interestRadiusM?: number;
  readonly combatEnabled?: boolean;
  readonly walkability?: WalkabilityPort;
  readonly onSimulationCreated?: (sim: WorldSimulation, roomId: string) => void;
}

export class TownAuthoritativeRoom extends Room<{ state: TownAuthoritativeMetaState }> {
  maxClients = MAX_AUTHORITATIVE_PLAYERS;
  maxMessagesPerSecond = 45;

  private authSecret = '';
  private reconnectSeconds = 5;
  private interestRadiusM = DEFAULT_INTEREST_RADIUS_M;
  private sim!: WorldSimulation;
  private tickMsAvg = 0;
  private tickSamples = 0;

  getSimulation(): WorldSimulation {
    return this.sim;
  }

  onCreate(options: Partial<AuthoritativeRoomRuntimeConfig> = {}) {
    if (typeof options.authSecret !== 'string' || options.authSecret.length < 16) {
      throw new Error('TownAuthoritativeRoom requires configured authSecret');
    }
    this.authSecret = options.authSecret;
    this.reconnectSeconds = options.reconnectSeconds ?? 5;
    this.interestRadiusM = options.interestRadiusM ?? DEFAULT_INTEREST_RADIUS_M;
    this.maxClients = options.maxPlayers ?? MAX_AUTHORITATIVE_PLAYERS;

    this.sim = new WorldSimulation({
      walkability: options.walkability,
      combatEnabled: options.combatEnabled ?? true,
    });
    this.setState(new TownAuthoritativeMetaState());
    this.state.protocolVersion = AUTHORITATIVE_PROTOCOL_VERSION;
    this.setPatchRate(100);

    options.onSimulationCreated?.(this.sim, this.roomId);

    this.onMessage(WORLD_MESSAGE_TYPES.moveIntent, (client, raw) => {
      const envelope = parseClientIntentEnvelope(raw);
      if (!envelope || envelope.domain !== 'movement') {
        this.reject(client, {
          reason: 'invalid_payload',
          domain: 'movement',
          message: 'Invalid movement intent envelope or forbidden authority fields',
        });
        return;
      }
      const payload = parseMoveIntentPayload(envelope.payload);
      if (!payload) {
        this.reject(client, {
          reason: 'invalid_payload',
          domain: 'movement',
          seq: envelope.seq,
          message: 'Invalid movement vector or timing step',
        });
        return;
      }
      const outcome = this.sim.enqueueMoveIntent(client.sessionId, envelope.seq, payload);
      if (!outcome.ok) {
        this.reject(client, {
          reason: outcome.reason,
          domain: 'movement',
          seq: envelope.seq,
          message: outcome.message,
        });
      }
    });

    this.onMessage(WORLD_MESSAGE_TYPES.combatStrike, (client, raw) => {
      const envelope = parseClientIntentEnvelope(raw);
      if (!envelope || envelope.domain !== 'combat') {
        this.reject(client, {
          reason: 'invalid_payload',
          domain: 'combat',
          message: 'Invalid combat intent envelope or forbidden damage/hp fields',
        });
        return;
      }
      const payload = parseCombatStrikePayload(envelope.payload);
      if (!payload) {
        this.reject(client, {
          reason: 'invalid_payload',
          domain: 'combat',
          seq: envelope.seq,
          message: 'Invalid combat strike target or ability',
        });
        return;
      }
      const outcome = this.sim.applyCombatStrike(client.sessionId, payload, Date.now());
      if (!outcome.ok) {
        this.reject(client, {
          reason: outcome.reason,
          domain: 'combat',
          seq: envelope.seq,
          message: outcome.message,
        });
        return;
      }
      this.broadcastSnapshotsNow([]);
    });

    // Reject unknown/forged commands cleanly without mutating state
    this.onMessage('*', (client) => {
      const err: ProtocolError = { code: 'unsupported-message' };
      client.send(PROTOCOL_ERROR, err);
    });

    this.setSimulationInterval((dtMs) => {
      this.stepSimulation(dtMs);
    }, WORLD_TICK_MS);
  }

  onAuth(_client: Client, options: unknown): VerifiedSessionAuth {
    const parsed = parseJoinAuthoritativeOptions(options);
    if (!parsed) {
      throw new ServerError(400, 'Invalid authoritative join options or protocol version');
    }
    const verified = verifySessionToken(this.authSecret, parsed.token, Date.now());
    if (!verified) {
      throw new ServerError(401, 'Unauthorized or expired session token');
    }
    return {
      ...verified,
      avatar: parsed.avatar,
    };
  }

  onJoin(client: Client) {
    const auth = client.auth as VerifiedSessionAuth;
    const occupied = this.sim.getOccupiedSlots();
    let slot = 0;
    while (occupied.has(slot)) slot += 1;

    this.sim.addPlayer(client.sessionId, auth, slot);
    this.state.onlineCount = this.sim.getPlayerCount();
    this.sendSnapshotToClient(client, []);
  }

  async onDrop(client: Client) {
    if (this.reconnectSeconds <= 0) return;
    try {
      await this.allowReconnection(client, this.reconnectSeconds);
    } catch {
      // Timed out or room disposed; onLeave will remove player cleanly
    }
  }

  onReconnect(client: Client) {
    this.sendSnapshotToClient(client, []);
  }

  onLeave(client: Client) {
    this.sim.removePlayer(client.sessionId);
    this.state.onlineCount = this.sim.getPlayerCount();
  }

  private reject(client: Client, rejection: ServerRejectionPayload): void {
    client.send(WORLD_MESSAGE_TYPES.intentRejected, rejection);
  }

  private stepSimulation(dtMs: number): void {
    const nowMs = Date.now();
    const metrics: SimulationTickMetrics = this.sim.stepTick(dtMs / 1000, nowMs);
    const events = this.sim.flushTickEvents();
    this.tickSamples += 1;
    this.tickMsAvg =
      this.tickMsAvg + (metrics.durationMs - this.tickMsAvg) / Math.min(20, this.tickSamples);
    this.state.serverTick = metrics.tick;
    this.state.onlineCount = metrics.playerCount;
    this.state.avgTickMs = Math.round(this.tickMsAvg * 1000) / 1000;
    this.broadcastSnapshotsNow(events, nowMs);
  }

  private broadcastSnapshotsNow(
    events: readonly CombatEventRecord[],
    nowMs: number = Date.now(),
  ): void {
    for (const client of this.clients) {
      this.sendSnapshotToClient(client, events, nowMs);
    }
  }

  private sendSnapshotToClient(
    client: Client,
    events: readonly CombatEventRecord[],
    nowMs: number = Date.now(),
  ): void {
    const snapshot = this.sim.buildSnapshotForPlayer(
      client.sessionId,
      events,
      nowMs,
      this.interestRadiusM,
    );
    if (snapshot) {
      client.send(WORLD_MESSAGE_TYPES.worldSnapshot, snapshot);
    }
  }
}
