import type { Room } from '@colyseus/sdk';
import { isNetworkOnline, refreshNetworkState } from '../services/networkStatus.ts';
import {
  PRESENCE_ROOM, PROTOCOL_ERROR, PROTOCOL_VERSION,
  type JoinPresence, type PresencePlayer, type PresenceState,
} from '../../shared/network.ts';

export type PresenceRoom = Room<unknown, PresenceState>;
export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type SessionSnapshot = {
  status: ConnectionStatus;
  roomId: string;
  sessionId: string;
  players: readonly PresencePlayer[];
  error: string;
};
type Connector = (endpoint: string, profile: JoinPresence) => Promise<PresenceRoom>;
const empty = (status: ConnectionStatus = 'offline', error = ''): SessionSnapshot => ({
  status, roomId: '', sessionId: '', players: [], error,
});
const connectRoom: Connector = async (endpoint, profile) => {
  // Offline play doesn't load the SDK or open any network connection.
  const { Client } = await import('@colyseus/sdk');
  return new Client(endpoint).joinOrCreate<PresenceState>(PRESENCE_ROOM, profile);
};

export function validateEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (!['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use a WebSocket server URL without credentials or query parameters.');
  }
  return url.href;
}

/** Network lifetime is independent of Player, camera, map streaming and React frames. */
export class MultiplayerSession {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private generation = 0;
  private room?: PresenceRoom;
  private connector: Connector;
  private timeoutMs: number;
  private cancelPending?: () => void;

  constructor(connector: Connector = connectRoom, timeoutMs = 12000) {
    this.connector = connector;
    this.timeoutMs = timeoutMs;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish(snapshot: SessionSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }
  private close(room: PresenceRoom) {
    room.reconnection.enabled = false;
    void room.leave().catch(() => room.connection.close());
  }

  async join(endpoint: string, name: string, avatar: JoinPresence['avatar'] = 'mint') {
    this.leave();
    const generation = this.generation;
    void refreshNetworkState();
    if (!isNetworkOnline()) {
      this.publish(empty('offline', 'You are offline. Local gameplay remains available; reconnect to join multiplayer.'));
      return;
    }
    this.publish(empty('connecting'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const url = validateEndpoint(endpoint);
      const pending = this.connector(url, { version: PROTOCOL_VERSION, name, avatar });
      // A cancelled or timed-out handshake may still finish: immediately release its seat.
      void pending.then(room => {
        if (generation !== this.generation) this.close(room);
      }, () => {});
      const cancelled = new Promise<never>((_, reject) => {
        this.cancelPending = () => reject(new Error('Connection cancelled'));
        timer = setTimeout(() => reject(new Error('Connection timed out. Retry or continue offline.')), this.timeoutMs);
      });
      const room = await Promise.race([pending, cancelled]);
      if (generation !== this.generation) return;
      room.reconnection.enabled = false; // Explicit retry starts a fresh guest session.
      this.room = room;
      const current = () => generation === this.generation && this.room === room;
      const update = () => {
        if (!current()) return;
        const players: PresencePlayer[] = [];
        room.state?.players?.forEach(p => players.push({
          sessionId: p.sessionId, name: p.name, avatar: p.avatar, slot: p.slot,
          x: p.x, y: p.y, z: p.z, yaw: p.yaw,
        }));
        this.publish({ status: 'connected', roomId: room.roomId, sessionId: room.sessionId, players, error: '' });
      };
      const disconnected = (code: number) => {
        if (!current()) return;
        this.room = undefined;
        this.publish(empty('disconnected', `Connection closed (${code}). Local play is still available.`));
      };
      room.onStateChange(update);
      room.onLeave(disconnected);
      room.onDrop(disconnected);
      room.onError((_code, message) => {
        if (!current()) return;
        this.room = undefined;
        this.close(room);
        this.publish(empty('error', message ?? 'Connection failed'));
      });
      room.onMessage(PROTOCOL_ERROR, () => {});
      update();
    } catch (error) {
      if (generation !== this.generation) return;
      this.generation++; // Invalidate any still-pending handshake.
      this.publish(empty('error', error instanceof Error ? error.message : 'Connection failed'));
    } finally {
      clearTimeout(timer);
      if (generation === this.generation) this.cancelPending = undefined;
    }
  }

  leave = () => {
    this.generation++;
    this.cancelPending?.();
    this.cancelPending = undefined;
    const room = this.room;
    this.room = undefined;
    if (room) this.close(room);
    this.publish(empty());
  };
}
