import {
  CONTRACT_SCHEMA_VERSIONS,
  formatChunkId,
  type ChunkId,
} from './ids.ts';

export const AUTHORITATIVE_PROTOCOL_VERSION = CONTRACT_SCHEMA_VERSIONS.networkAuthoritative;
export const AUTHORITATIVE_WORLD_ROOM = 'town-authoritative-v2';
export const MAX_AUTHORITATIVE_PLAYERS = 64;

export const WORLD_CELL_SIZE_M = 128;
export const DEFAULT_INTEREST_RADIUS_M = 140;
export const CELL_HANDOFF_HYSTERESIS_M = 16;
export const WORLD_TICK_RATE_HZ = 20;
export const WORLD_TICK_MS = 1000 / WORLD_TICK_RATE_HZ;
export const MAX_VISIBLE_PLAYERS_PER_OBSERVER = 24;

export const PLAYER_MOVEMENT_LIMITS = {
  walkMps: 3.2,
  runMps: 9.5,
  maxStepSec: 0.25,
  maxInputQueuePerTick: 8,
  worldHalfExtentM: 2800,
} as const;

export const AUTHORITATIVE_HOME_SAFE_ZONE = {
  x: 174.891,
  z: 183.666,
  radius: 18,
  retreatBuffer: 5,
} as const;

export const WAREHOUSE_GHOST_ENCOUNTER = {
  id: 'warehouse-ghost-1',
  regionId: 'myothar',
  anchorX: 35.149,
  anchorZ: 36.176,
  patrolRadiusM: 68,
  detectRadiusM: 25,
  giveUpDistanceM: 45,
  wanderSpeedMps: 1.5,
  chaseSpeedMps: 4.2,
  grabRangeM: 1.65,
  grabDamage: 34,
  grabCooldownMs: 2500,
  maxHp: 120,
  respawnSec: 8,
  retreatSpeedMps: 2.4,
} as const;

export type CombatAbilityId = 'light-strike' | 'ward-pulse';

export interface CombatAbilitySpec {
  readonly id: CombatAbilityId;
  readonly staminaCost: number;
  readonly cooldownMs: number;
  readonly rangeM: number;
  readonly baseDamage: number;
}

export const COMBAT_ABILITIES: Readonly<Record<CombatAbilityId, CombatAbilitySpec>> = {
  'light-strike': {
    id: 'light-strike',
    staminaCost: 15,
    cooldownMs: 650,
    rangeM: 3.4,
    baseDamage: 24,
  },
  'ward-pulse': {
    id: 'ward-pulse',
    staminaCost: 30,
    cooldownMs: 1800,
    rangeM: 6.5,
    baseDamage: 40,
  },
} as const;

export type AuthoritativeAvatarStyle = 'mint' | 'gold';
export type MultiplayerMode = 'authoritative-v2' | 'presence-v1';

export interface JoinAuthoritativeOptions {
  readonly version: typeof AUTHORITATIVE_PROTOCOL_VERSION;
  readonly token: string;
  readonly avatar: AuthoritativeAvatarStyle;
}

export interface MoveIntentPayload {
  readonly dx: number;
  readonly dz: number;
  readonly yaw: number;
  readonly sprinting: boolean;
  readonly dtMs: number;
}

export interface CombatStrikePayload {
  readonly targetId: string;
  readonly targetKind: 'ghost' | 'player';
  readonly abilityId: CombatAbilityId;
  readonly aimYaw: number;
}

export type GhostServerState =
  | 'WANDERING'
  | 'CHASING'
  | 'GRABBING'
  | 'RETREATING'
  | 'BANISHED';

export interface WorldSnapshotPlayer {
  readonly sessionId: string;
  readonly accountId: string;
  readonly name: string;
  readonly avatar: AuthoritativeAvatarStyle;
  readonly role: 'player' | 'moderator' | 'admin';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly stamina: number;
  readonly maxStamina: number;
  readonly cellId: ChunkId;
  readonly inSafeZone: boolean;
  readonly lastAckSeq: number;
}

export interface WorldSnapshotGhost {
  readonly id: string;
  readonly state: GhostServerState;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly cellId: ChunkId;
  readonly targetPlayerId: string | null;
  readonly homeProtected: boolean;
}

export interface CombatEventRecord {
  readonly eventId: string;
  readonly tick: number;
  readonly attackerId: string;
  readonly attackerKind: 'player' | 'ghost';
  readonly targetId: string;
  readonly targetKind: 'player' | 'ghost';
  readonly abilityId: string;
  readonly damage: number;
  readonly targetHpAfter: number;
  readonly defeated: boolean;
}

export type IntentRejectReason =
  | 'invalid_payload'
  | 'rate_limited'
  | 'speed_clamped'
  | 'out_of_range'
  | 'cooldown'
  | 'insufficient_stamina'
  | 'protected_zone'
  | 'target_not_found'
  | 'player_ko';

export interface ServerRejectionPayload {
  readonly reason: IntentRejectReason;
  readonly domain: string;
  readonly seq?: number;
  readonly message: string;
}

export interface WorldSnapshotPayload {
  readonly protocolVersion: typeof AUTHORITATIVE_PROTOCOL_VERSION;
  readonly serverTick: number;
  readonly serverTimeMs: number;
  readonly cellId: ChunkId;
  readonly interestRadiusM: number;
  readonly self: WorldSnapshotPlayer;
  readonly visiblePlayers: readonly WorldSnapshotPlayer[];
  readonly visibleGhosts: readonly WorldSnapshotGhost[];
  readonly combatEvents: readonly CombatEventRecord[];
}

export const WORLD_MESSAGE_TYPES = {
  moveIntent: 'move-intent',
  combatStrike: 'combat-strike',
  worldSnapshot: 'world-snapshot',
  intentRejected: 'intent-rejected',
} as const;

export function computeWorldCellCoord(
  x: number,
  z: number,
  cellSizeM: number = WORLD_CELL_SIZE_M,
): { cx: number; cz: number } {
  return {
    cx: Math.floor(x / cellSizeM),
    cz: Math.floor(z / cellSizeM),
  };
}

export function computeWorldCellId(
  x: number,
  z: number,
  level: 0 | 1 | 2 | 3 = 0,
): ChunkId {
  const { cx, cz } = computeWorldCellCoord(x, z);
  return formatChunkId('world', level, cx, cz);
}

export function distanceToHomeSafeZone(x: number, z: number): number {
  return (
    Math.hypot(x - AUTHORITATIVE_HOME_SAFE_ZONE.x, z - AUTHORITATIVE_HOME_SAFE_ZONE.z) -
    AUTHORITATIVE_HOME_SAFE_ZONE.radius
  );
}

export function isPointInHomeSafeZone(x: number, z: number, bufferM = 0): boolean {
  return distanceToHomeSafeZone(x, z) <= bufferM + 1e-6;
}

const JOIN_ALLOWED_KEYS = new Set(['version', 'token', 'avatar']);
const MOVE_ALLOWED_KEYS = new Set(['dx', 'dz', 'yaw', 'sprinting', 'dtMs']);
const STRIKE_ALLOWED_KEYS = new Set(['targetId', 'targetKind', 'abilityId', 'aimYaw']);

export function parseJoinAuthoritativeOptions(value: unknown): JoinAuthoritativeOptions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((k) => !JOIN_ALLOWED_KEYS.has(k))) return null;
  if (v.version !== AUTHORITATIVE_PROTOCOL_VERSION) return null;
  if (typeof v.token !== 'string' || v.token.trim().length < 16 || v.token.length > 2048) return null;
  const avatar: AuthoritativeAvatarStyle = v.avatar === 'gold' ? 'gold' : 'mint';
  if (v.avatar !== undefined && v.avatar !== 'mint' && v.avatar !== 'gold') return null;
  return {
    version: AUTHORITATIVE_PROTOCOL_VERSION,
    token: v.token.trim(),
    avatar,
  };
}

export function parseMoveIntentPayload(value: unknown): MoveIntentPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((k) => !MOVE_ALLOWED_KEYS.has(k))) return null;
  if (
    typeof v.dx !== 'number' ||
    typeof v.dz !== 'number' ||
    typeof v.yaw !== 'number' ||
    typeof v.dtMs !== 'number' ||
    typeof v.sprinting !== 'boolean'
  ) {
    return null;
  }
  if (
    !Number.isFinite(v.dx) ||
    !Number.isFinite(v.dz) ||
    !Number.isFinite(v.yaw) ||
    !Number.isFinite(v.dtMs)
  ) {
    return null;
  }
  // Reject non-unit spoofed velocity components and absurd delta steps
  if (Math.abs(v.dx) > 1.05 || Math.abs(v.dz) > 1.05) return null;
  if (v.dtMs <= 0 || v.dtMs > 500) return null;

  const mag = Math.hypot(v.dx, v.dz);
  const dx = mag > 1 ? v.dx / mag : v.dx;
  const dz = mag > 1 ? v.dz / mag : v.dz;

  return {
    dx,
    dz,
    yaw: v.yaw,
    sprinting: v.sprinting,
    dtMs: v.dtMs,
  };
}

export function parseCombatStrikePayload(value: unknown): CombatStrikePayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((k) => !STRIKE_ALLOWED_KEYS.has(k))) return null;
  if (typeof v.targetId !== 'string' || !/^[a-z0-9:_-]{2,80}$/i.test(v.targetId)) return null;
  if (v.targetKind !== 'ghost' && v.targetKind !== 'player') return null;
  if (v.abilityId !== 'light-strike' && v.abilityId !== 'ward-pulse') return null;
  if (typeof v.aimYaw !== 'number' || !Number.isFinite(v.aimYaw)) return null;
  return {
    targetId: v.targetId,
    targetKind: v.targetKind,
    abilityId: v.abilityId,
    aimYaw: v.aimYaw,
  };
}
