import type { Room } from '@colyseus/sdk';
import { isNetworkOnline, refreshNetworkState } from '../services/networkStatus.ts';
import { setActiveAuthoritySession } from '../game/mapPermissions.ts';
import {
  AUTHORITATIVE_PROTOCOL_VERSION,
  AUTHORITATIVE_WORLD_ROOM,
  PLAYER_MOVEMENT_LIMITS,
  PRESENCE_ROOM,
  PROTOCOL_ERROR,
  PROTOCOL_VERSION,
  WORLD_MESSAGE_TYPES,
  type AuthoritativeAvatarStyle,
  type ClientIntentEnvelope,
  type CombatAbilityId,
  type CombatEventRecord,
  type CombatStrikePayload,
  type JoinAuthoritativeOptions,
  type JoinPresence,
  type MoveIntentPayload,
  type MultiplayerMode,
  type PresencePlayer,
  type PresenceState,
  type ServerRejectionPayload,
  type WorldSnapshotGhost,
  type WorldSnapshotPayload,
  type WorldSnapshotPlayer,
} from '../../shared/network.ts';

export type PresenceRoom = Room<unknown, PresenceState>;
export type AuthoritativeRoom = Room<unknown, Record<string, unknown>>;
export type AnySessionRoom = PresenceRoom | AuthoritativeRoom;

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type SessionSnapshot = {
  mode: MultiplayerMode;
  status: ConnectionStatus;
  roomId: string;
  sessionId: string;
  serverRole: 'player' | 'moderator' | 'admin' | null;
  cellId: string | null;
  serverTick: number;
  selfPlayer: WorldSnapshotPlayer | null;
  players: readonly PresencePlayer[];
  ghosts: readonly WorldSnapshotGhost[];
  recentCombatEvents: readonly CombatEventRecord[];
  lastRejection: ServerRejectionPayload | null;
  error: string;
};

type LegacyConnector = (endpoint: string, profile: JoinPresence) => Promise<PresenceRoom>;
type AuthoritativeConnector = (
  endpoint: string,
  options: JoinAuthoritativeOptions,
) => Promise<AuthoritativeRoom>;

export function resolveDefaultMultiplayerMode(): MultiplayerMode {
  try {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('mpMode');
      if (param === 'presence-v1' || param === 'authoritative-v2') return param;
    }
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (env?.VITE_MULTIPLAYER_MODE === 'presence-v1') return 'presence-v1';
    if (env?.VITE_MULTIPLAYER_MODE === 'authoritative-v2') return 'authoritative-v2';
  } catch {
    // Node fallback
  }
  return 'authoritative-v2';
}

const empty = (
  mode: MultiplayerMode = 'authoritative-v2',
  status: ConnectionStatus = 'offline',
  error = '',
): SessionSnapshot => ({
  mode,
  status,
  roomId: '',
  sessionId: '',
  serverRole: null,
  cellId: null,
  serverTick: 0,
  selfPlayer: null,
  players: [],
  ghosts: [],
  recentCombatEvents: [],
  lastRejection: null,
  error,
});

const connectPresenceRoom: LegacyConnector = async (endpoint, profile) => {
  const { Client } = await import('@colyseus/sdk');
  return new Client(endpoint).joinOrCreate<PresenceState>(PRESENCE_ROOM, profile);
};

const connectAuthoritativeRoom: AuthoritativeConnector = async (endpoint, options) => {
  const { Client } = await import('@colyseus/sdk');
  return new Client(endpoint).joinOrCreate<Record<string, unknown>>(
    AUTHORITATIVE_WORLD_ROOM,
    options,
  );
};

export function validateEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (
    !['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use a WebSocket server URL without credentials or query parameters.');
  }
  return url.href;
}

export function wsToHttpEndpoint(endpointHref: string): string {
  const u = new URL(endpointHref);
  if (u.protocol === 'ws:') u.protocol = 'http:';
  else if (u.protocol === 'wss:') u.protocol = 'https:';
  return u.href.replace(/\/+$/, '');
}

async function fetchGuestSessionToken(
  endpointHref: string,
  name: string,
  avatar: AuthoritativeAvatarStyle,
): Promise<string> {
  const baseHttp = wsToHttpEndpoint(endpointHref);
  const res = await fetch(`${baseHttp}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, avatar }),
  });
  if (!res.ok) {
    throw new Error(`Authentication server refused token request (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { token?: unknown };
  if (typeof data.token !== 'string' || !data.token) {
    throw new Error('Authentication server returned invalid session token');
  }
  return data.token;
}

function toPresencePlayer(p: WorldSnapshotPlayer, slot: number): PresencePlayer {
  return {
    sessionId: p.sessionId,
    name: p.name,
    avatar: p.avatar,
    slot,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
  };
}

/** Network lifetime is independent of Player, camera, map streaming and React frames. */
export class MultiplayerSession {
  private snapshot: SessionSnapshot;
  private listeners = new Set<() => void>();
  private generation = 0;
  private room?: AnySessionRoom;
  private legacyConnector?: LegacyConnector;
  private authConnector: AuthoritativeConnector;
  private timeoutMs: number;
  private cancelPending?: () => void;
  private intentSeq = 0;
  private lastMoveSentMs = 0;
  private pendingMoveMs = 0;
  private pendingMoveSumX = 0;
  private pendingMoveSumZ = 0;
  private pendingSprintMs = 0;
  private pendingMoveYaw = 0;
  private unackedMoves: Array<{ seq: number; dx: number; dz: number; sprinting: boolean; dtMs: number }> = [];

  constructor(
    connector?: LegacyConnector,
    timeoutMs = 12000,
    options?: {
      mode?: MultiplayerMode;
      authConnector?: AuthoritativeConnector;
    },
  ) {
    this.legacyConnector = connector;
    this.authConnector = options?.authConnector ?? connectAuthoritativeRoom;
    this.timeoutMs = timeoutMs;
    const defaultMode: MultiplayerMode =
      options?.mode ?? (connector ? 'presence-v1' : resolveDefaultMultiplayerMode());
    this.snapshot = empty(defaultMode);
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setMode = (mode: MultiplayerMode) => {
    if (this.snapshot.status === 'connected' || this.snapshot.status === 'connecting') return;
    this.publish(empty(mode));
  };

  private publish(snapshot: SessionSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  private close(room: AnySessionRoom) {
    room.reconnection.enabled = false;
    void room.leave().catch(() => room.connection.close());
  }

  async join(
    endpoint: string,
    name: string,
    avatar: JoinPresence['avatar'] = 'mint',
    options?: {
      mode?: MultiplayerMode;
      token?: string;
      allowReconnect?: boolean;
    },
  ) {
    const requestedMode = options?.mode ?? this.snapshot.mode;
    this.leave();
    const generation = this.generation;
    void refreshNetworkState();
    if (!isNetworkOnline()) {
      this.publish(
        empty(
          requestedMode,
          'offline',
          'You are offline. Local gameplay remains available; reconnect to join multiplayer.',
        ),
      );
      return;
    }

    this.publish(empty(requestedMode, 'connecting'));
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const url = validateEndpoint(endpoint);
      let pending: Promise<AnySessionRoom>;

      if (requestedMode === 'presence-v1') {
        const connector = this.legacyConnector ?? connectPresenceRoom;
        pending = connector(url, { version: PROTOCOL_VERSION, name, avatar });
      } else {
        const token = options?.token ?? (await fetchGuestSessionToken(url, name, avatar));
        pending = this.authConnector(url, {
          version: AUTHORITATIVE_PROTOCOL_VERSION,
          token,
          avatar,
        });
      }

      // A cancelled or timed-out handshake may still finish: immediately release its seat.
      void pending.then(
        (room) => {
          if (generation !== this.generation) this.close(room);
        },
        () => {},
      );

      const cancelled = new Promise<never>((_, reject) => {
        this.cancelPending = () => reject(new Error('Connection cancelled'));
        timer = setTimeout(
          () => reject(new Error('Connection timed out. Retry or continue offline.')),
          this.timeoutMs,
        );
      });

      const room = await Promise.race([pending, cancelled]);
      if (generation !== this.generation) return;

      room.reconnection.enabled = requestedMode === 'authoritative-v2' && (options?.allowReconnect ?? true);
      this.room = room;
      const current = () => generation === this.generation && this.room === room;

      const disconnected = (code: number) => {
        if (!current()) return;
        this.room = undefined;
        setActiveAuthoritySession('local-offline');
        this.publish(
          empty(
            requestedMode,
            'disconnected',
            `Connection closed (${code}). Local play is still available.`,
          ),
        );
      };

      room.onLeave(disconnected);
      room.onDrop(disconnected);
      room.onError((_code, message) => {
        if (!current()) return;
        this.room = undefined;
        this.close(room);
        setActiveAuthoritySession('local-offline');
        this.publish(empty(requestedMode, 'error', message ?? 'Connection failed'));
      });
      room.onMessage(PROTOCOL_ERROR, () => {});

      if (requestedMode === 'presence-v1') {
        const presenceRoom = room as PresenceRoom;
        const updatePresence = () => {
          if (!current()) return;
          const players: PresencePlayer[] = [];
          presenceRoom.state?.players?.forEach((p) =>
            players.push({
              sessionId: p.sessionId,
              name: p.name,
              avatar: p.avatar,
              slot: p.slot,
              x: p.x,
              y: p.y,
              z: p.z,
              yaw: p.yaw,
            }),
          );
          this.publish({
            ...empty(requestedMode, 'connected'),
            roomId: room.roomId,
            sessionId: room.sessionId,
            players,
          });
        };
        presenceRoom.onStateChange(updatePresence);
        updatePresence();
      } else {
        setActiveAuthoritySession('server-authoritative', 'player');
        this.publish({
          ...empty(requestedMode, 'connected'),
          roomId: room.roomId,
          sessionId: room.sessionId,
          serverRole: 'player',
        });

        room.onMessage(WORLD_MESSAGE_TYPES.worldSnapshot, (payload: unknown) => {
          if (!current()) return;
          const snap = payload as WorldSnapshotPayload;
          if (!snap || typeof snap !== 'object' || !snap.self) return;
          setActiveAuthoritySession('server-authoritative', snap.self.role);
          if (this.unackedMoves.length > 0) {
            this.unackedMoves = this.unackedMoves.filter((m) => m.seq > snap.self.lastAckSeq);
          }

          const players: PresencePlayer[] = [
            toPresencePlayer(snap.self, 0),
            ...(snap.visiblePlayers ?? []).map((p, idx) => toPresencePlayer(p, idx + 1)),
          ];
          const prevEvents = this.snapshot.recentCombatEvents;
          const nextEvents =
            snap.combatEvents && snap.combatEvents.length > 0
              ? [...prevEvents, ...snap.combatEvents].slice(-12)
              : prevEvents;

          this.publish({
            mode: 'authoritative-v2',
            status: 'connected',
            roomId: room.roomId,
            sessionId: room.sessionId,
            serverRole: snap.self.role,
            cellId: snap.cellId,
            serverTick: snap.serverTick,
            selfPlayer: snap.self,
            players,
            ghosts: snap.visibleGhosts ?? [],
            recentCombatEvents: nextEvents,
            lastRejection: this.snapshot.lastRejection,
            error: '',
          });
        });

        room.onMessage(WORLD_MESSAGE_TYPES.intentRejected, (payload: unknown) => {
          if (!current()) return;
          const rej = payload as ServerRejectionPayload;
          this.publish({
            ...this.snapshot,
            lastRejection: rej,
          });
        });
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.generation++;
      this.clearPendingMoves();
      setActiveAuthoritySession('local-offline');
      this.publish(
        empty(
          requestedMode,
          'error',
          error instanceof Error ? error.message : 'Connection failed',
        ),
      );
    } finally {
      clearTimeout(timer);
      if (generation === this.generation) this.cancelPending = undefined;
    }
  }

  private clearPendingMoves(): void {
    this.pendingMoveMs = 0;
    this.pendingMoveSumX = 0;
    this.pendingMoveSumZ = 0;
    this.pendingSprintMs = 0;
    this.pendingMoveYaw = 0;
    this.lastMoveSentMs = 0;
    this.intentSeq = 0;
    this.unackedMoves = [];
  }

  /**
   * Accumulates frame movement intervals across client render frames so 45ms network send
   * throttling never drops elapsed player input time, while staying within server caps.
   */
  sendMoveIntent(
    dx: number,
    dz: number,
    yaw: number,
    sprinting: boolean,
    dtMs: number,
  ): boolean {
    if (this.snapshot.mode !== 'authoritative-v2' || this.snapshot.status !== 'connected' || !this.room) {
      return false;
    }

    const maxStepMs = PLAYER_MOVEMENT_LIMITS.maxStepSec * 1000;
    const cleanDtMs = Number.isFinite(dtMs) ? Math.max(0, Math.min(maxStepMs, dtMs)) : 0;
    const mag = Number.isFinite(dx) && Number.isFinite(dz) ? Math.hypot(dx, dz) : 0;
    const ndx = mag > 1 ? dx / mag : Number.isFinite(dx) ? dx : 0;
    const ndz = mag > 1 ? dz / mag : Number.isFinite(dz) ? dz : 0;

    if (cleanDtMs > 0 && (ndx !== 0 || ndz !== 0)) {
      const addMs = Math.min(cleanDtMs, Math.max(0, maxStepMs - this.pendingMoveMs));
      if (addMs > 0) {
        this.pendingMoveSumX += ndx * addMs;
        this.pendingMoveSumZ += ndz * addMs;
        if (sprinting) this.pendingSprintMs += addMs;
        this.pendingMoveMs += addMs;
      }
      if (Number.isFinite(yaw)) this.pendingMoveYaw = yaw;
    } else if (this.pendingMoveMs < 1) {
      this.pendingMoveMs = 0;
      this.pendingMoveSumX = 0;
      this.pendingMoveSumZ = 0;
      this.pendingSprintMs = 0;
      return false;
    }

    const now = Date.now();
    if (this.lastMoveSentMs > 0 && now - this.lastMoveSentMs < 45) return false;
    if (this.pendingMoveMs < 1) return false;

    const totalMs = this.pendingMoveMs;
    const emitDtMs = Math.max(1, Math.min(maxStepMs, Math.floor(totalMs)));
    const remMs = totalMs - emitDtMs;
    const remRatio = totalMs > 0 ? remMs / totalMs : 0;

    const avgDx = Math.max(-1, Math.min(1, this.pendingMoveSumX / totalMs));
    const avgDz = Math.max(-1, Math.min(1, this.pendingMoveSumZ / totalMs));
    const avgMag = Math.hypot(avgDx, avgDz);
    const emitDx = avgMag > 1 ? avgDx / avgMag : avgDx;
    const emitDz = avgMag > 1 ? avgDz / avgMag : avgDz;
    const emitSprint = this.pendingSprintMs >= totalMs * 0.5;
    const emitYaw = Number.isFinite(yaw) ? yaw : this.pendingMoveYaw;

    this.pendingMoveMs = remMs;
    this.pendingMoveSumX *= remRatio;
    this.pendingMoveSumZ *= remRatio;
    this.pendingSprintMs *= remRatio;

    if (emitDx === 0 && emitDz === 0) return false;

    this.lastMoveSentMs = now;
    const seq = ++this.intentSeq;
    const payload: MoveIntentPayload = {
      dx: emitDx,
      dz: emitDz,
      yaw: emitYaw,
      sprinting: emitSprint,
      dtMs: emitDtMs,
    };
    const envelope: ClientIntentEnvelope<'move', MoveIntentPayload> = {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'movement',
      type: 'move',
      seq,
      clientTimeMs: now,
      payload,
    };
    this.unackedMoves.push({ seq, dx: emitDx, dz: emitDz, sprinting: emitSprint, dtMs: emitDtMs });
    if (this.unackedMoves.length > 32) {
      this.unackedMoves.splice(0, this.unackedMoves.length - 32);
    }
    this.room.send(WORLD_MESSAGE_TYPES.moveIntent, envelope);
    return true;
  }

  /**
   * Computes authoritative server reconciliation target by adding unacknowledged predicted movement
   * on top of the latest confirmed server snapshot position. Returns null when divergence is within tolerance.
   */
  reconcileLocalPosition(localX: number, localZ: number, maxDriftM = 1.75): { x: number; z: number } | null {
    const self = this.snapshot.selfPlayer;
    if (this.snapshot.mode !== 'authoritative-v2' || this.snapshot.status !== 'connected' || !self) {
      return null;
    }
    let predX = self.x;
    let predZ = self.z;
    for (const m of this.unackedMoves) {
      const speed = m.sprinting ? PLAYER_MOVEMENT_LIMITS.runMps : PLAYER_MOVEMENT_LIMITS.walkMps;
      const step = speed * (m.dtMs / 1000);
      predX += m.dx * step;
      predZ += m.dz * step;
    }
    if (this.pendingMoveMs > 0) {
      const pendingSpeed =
        this.pendingSprintMs >= this.pendingMoveMs * 0.5
          ? PLAYER_MOVEMENT_LIMITS.runMps
          : PLAYER_MOVEMENT_LIMITS.walkMps;
      predX += (this.pendingMoveSumX / 1000) * pendingSpeed;
      predZ += (this.pendingMoveSumZ / 1000) * pendingSpeed;
    }
    if (Math.hypot(localX - predX, localZ - predZ) > maxDriftM) {
      return { x: predX, z: predZ };
    }
    return null;
  }

  sendCombatStrike(
    targetId: string,
    targetKind: 'ghost' | 'player',
    abilityId: CombatAbilityId,
    aimYaw: number,
  ): boolean {
    if (this.snapshot.mode !== 'authoritative-v2' || this.snapshot.status !== 'connected' || !this.room) {
      return false;
    }
    const seq = ++this.intentSeq;
    const envelope: ClientIntentEnvelope<'strike', CombatStrikePayload> = {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      domain: 'combat',
      type: 'strike',
      seq,
      clientTimeMs: Date.now(),
      payload: {
        targetId,
        targetKind,
        abilityId,
        aimYaw,
      },
    };
    this.room.send(WORLD_MESSAGE_TYPES.combatStrike, envelope);
    return true;
  }

  leave = () => {
    const curMode = this.snapshot?.mode ?? 'authoritative-v2';
    this.generation++;
    this.cancelPending?.();
    this.cancelPending = undefined;
    this.clearPendingMoves();
    const room = this.room;
    this.room = undefined;
    if (room) this.close(room);
    setActiveAuthoritySession('local-offline');
    this.publish(empty(curMode));
  };
}
