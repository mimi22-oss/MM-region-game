import {
  AUTHORITATIVE_HOME_SAFE_ZONE,
  AUTHORITATIVE_PROTOCOL_VERSION,
  COMBAT_ABILITIES,
  DEFAULT_INTEREST_RADIUS_M,
  MAX_VISIBLE_PLAYERS_PER_OBSERVER,
  PLAYER_MOVEMENT_LIMITS,
  WAREHOUSE_GHOST_ENCOUNTER,
  computeWorldCellId,
  distanceToHomeSafeZone,
  isPointInHomeSafeZone,
  type AuthoritativeAvatarStyle,
  type CombatAbilityId,
  type CombatEventRecord,
  type CombatStrikePayload,
  type GhostServerState,
  type IntentRejectReason,
  type MoveIntentPayload,
  type WorldSnapshotGhost,
  type WorldSnapshotPayload,
  type WorldSnapshotPlayer,
} from '../shared/network.ts';
import type { WalkabilityPort } from '../shared/contracts/index.ts';
import type { VerifiedSessionAuth } from './auth.ts';
import { SpatialInterestGrid } from './interestManager.ts';
import { presenceSpawn } from './TownPresenceRoom.ts';

interface QueuedMove {
  readonly seq: number;
  readonly intent: MoveIntentPayload;
}

interface MutablePlayer {
  readonly sessionId: string;
  readonly accountId: string;
  readonly name: string;
  readonly avatar: AuthoritativeAvatarStyle;
  readonly role: 'player' | 'moderator' | 'admin';
  readonly slot: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  inSafeZone: boolean;
  lastAckSeq: number;
  moveQueue: QueuedMove[];
  speedWindowStartMs: number;
  speedWindowDistanceM: number;
  abilityCooldownUntilMs: Record<CombatAbilityId, number>;
}

interface MutableGhost {
  readonly id: string;
  state: GhostServerState;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  targetPlayerId: string | null;
  homeProtected: boolean;
  wanderPhaseRad: number;
  nextAttackAtMs: number;
  respawnRemainingSec: number;
}

export interface SimulationTickMetrics {
  readonly tick: number;
  readonly durationMs: number;
  readonly playerCount: number;
  readonly activeCells: number;
  readonly combatEventCount: number;
}

export interface RejectedIntentOutcome {
  readonly ok: false;
  readonly reason: IntentRejectReason;
  readonly message: string;
}

export interface AcceptedIntentOutcome {
  readonly ok: true;
  readonly event?: CombatEventRecord;
}

function clampWorldCoord(v: number): number {
  const max = PLAYER_MOVEMENT_LIMITS.worldHalfExtentM;
  return Math.max(-max, Math.min(max, v));
}

function homeProtectedSpawn(slot: number): { x: number; y: number; z: number; yaw: number } {
  const angle = (slot % 8) * (Math.PI / 4);
  const r = 3.2;
  return {
    x: AUTHORITATIVE_HOME_SAFE_ZONE.x + Math.cos(angle) * r,
    y: 0.012,
    z: AUTHORITATIVE_HOME_SAFE_ZONE.z + Math.sin(angle) * r,
    yaw: angle,
  };
}

export class WorldSimulation {
  private readonly players = new Map<string, MutablePlayer>();
  private readonly ghost: MutableGhost;
  private readonly playerGrid = new SpatialInterestGrid<MutablePlayer & { readonly id: string }>();
  private readonly ghostGrid = new SpatialInterestGrid<MutableGhost>();
  private readonly walkability?: WalkabilityPort;
  private tickCount = 0;
  private eventSeq = 0;
  private tickEvents: CombatEventRecord[] = [];
  private combatEnabled = true;

  constructor(options?: { walkability?: WalkabilityPort; combatEnabled?: boolean }) {
    this.walkability = options?.walkability;
    this.combatEnabled = options?.combatEnabled ?? true;
    this.ghost = {
      id: WAREHOUSE_GHOST_ENCOUNTER.id,
      state: 'WANDERING',
      x: WAREHOUSE_GHOST_ENCOUNTER.anchorX,
      z: WAREHOUSE_GHOST_ENCOUNTER.anchorZ,
      yaw: 1.186194,
      hp: WAREHOUSE_GHOST_ENCOUNTER.maxHp,
      maxHp: WAREHOUSE_GHOST_ENCOUNTER.maxHp,
      targetPlayerId: null,
      homeProtected: false,
      wanderPhaseRad: 0,
      nextAttackAtMs: 0,
      respawnRemainingSec: 0,
    };
    this.ghostGrid.upsert(this.ghost);
  }

  setCombatEnabled(enabled: boolean): void {
    this.combatEnabled = enabled;
  }

  addPlayer(
    sessionId: string,
    auth: VerifiedSessionAuth,
    slot: number,
  ): WorldSnapshotPlayer {
    const spawn = presenceSpawn(slot);
    const player: MutablePlayer = {
      sessionId,
      accountId: auth.accountId,
      name: auth.displayName,
      avatar: auth.avatar,
      role: auth.role,
      slot,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      yaw: spawn.yaw,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      inSafeZone: this.isProtected(spawn.x, spawn.z),
      lastAckSeq: 0,
      moveQueue: [],
      speedWindowStartMs: 0,
      speedWindowDistanceM: 0,
      abilityCooldownUntilMs: { 'light-strike': 0, 'ward-pulse': 0 },
    };
    this.players.set(sessionId, player);
    this.syncPlayerToGrid(player);
    return this.toPlayerSnapshot(player);
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
    this.playerGrid.remove(sessionId);
    if (this.ghost.targetPlayerId === sessionId) {
      this.ghost.targetPlayerId = null;
    }
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getOccupiedSlots(): Set<number> {
    const out = new Set<number>();
    for (const p of this.players.values()) out.add(p.slot);
    return out;
  }

  getActiveCellCount(): number {
    return this.playerGrid.getActiveCellCount();
  }

  /** Test/server-admin helper for deterministic placement in multi-cell & safe-zone tests. */
  placeEntityForServerTest(
    targetId: string,
    x: number,
    z: number,
  ): boolean {
    if (targetId === this.ghost.id) {
      this.ghost.x = clampWorldCoord(x);
      this.ghost.z = clampWorldCoord(z);
      this.ghostGrid.upsert(this.ghost);
      return true;
    }
    const p = this.players.get(targetId);
    if (!p) return false;
    p.x = clampWorldCoord(x);
    p.z = clampWorldCoord(z);
    p.inSafeZone = this.isProtected(p.x, p.z);
    this.syncPlayerToGrid(p);
    return true;
  }

  private isProtected(x: number, z: number, bufferM = 0): boolean {
    if (this.walkability?.isHomeProtected) {
      return this.walkability.isHomeProtected(x, z, bufferM);
    }
    return isPointInHomeSafeZone(x, z, bufferM);
  }

  private isWalkable(x: number, z: number): boolean {
    if (this.walkability && !this.walkability.isPointWalkable(x, z)) {
      return false;
    }
    return true;
  }

  /**
   * Samples N+1 evenly-spaced points along the segment (x1,z1)→(x2,z2) and
   * returns false if any sample lands on an impassable cell.
   * Falls through to true when no walkability provider is wired (offline / test default).
   * F02 fix: used to block ghost grabs across walls/barriers.
   */
  private isSegmentWalkable(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    steps = 6,
  ): boolean {
    if (!this.walkability) return true;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.walkability.isPointWalkable(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) {
        return false;
      }
    }
    return true;
  }

  private syncPlayerToGrid(p: MutablePlayer): void {
    this.playerGrid.upsert(Object.assign(p, { id: p.sessionId }));
  }

  enqueueMoveIntent(
    sessionId: string,
    seq: number,
    intent: MoveIntentPayload,
  ): RejectedIntentOutcome | AcceptedIntentOutcome {
    const player = this.players.get(sessionId);
    if (!player) {
      return { ok: false, reason: 'target_not_found', message: 'Player session not active' };
    }
    if (seq <= player.lastAckSeq) {
      return { ok: true };
    }
    if (player.moveQueue.length >= PLAYER_MOVEMENT_LIMITS.maxInputQueuePerTick) {
      return { ok: false, reason: 'rate_limited', message: 'Move input queue limit exceeded' };
    }
    player.moveQueue.push({ seq, intent });
    return { ok: true };
  }

  applyCombatStrike(
    sessionId: string,
    strike: CombatStrikePayload,
    nowMs: number = Date.now(),
  ): RejectedIntentOutcome | AcceptedIntentOutcome {
    if (!this.combatEnabled) {
      return { ok: false, reason: 'invalid_payload', message: 'Combat disabled in current slice' };
    }
    const attacker = this.players.get(sessionId);
    if (!attacker) {
      return { ok: false, reason: 'target_not_found', message: 'Attacker session missing' };
    }
    if (attacker.hp <= 0) {
      return { ok: false, reason: 'player_ko', message: 'Cannot act while incapacitated' };
    }

    const spec = COMBAT_ABILITIES[strike.abilityId];
    if (nowMs < attacker.abilityCooldownUntilMs[strike.abilityId]) {
      return { ok: false, reason: 'cooldown', message: `${spec.id} is on server cooldown` };
    }
    if (attacker.stamina < spec.staminaCost) {
      return {
        ok: false,
        reason: 'insufficient_stamina',
        message: `Need ${spec.staminaCost} stamina`,
      };
    }

    attacker.yaw = strike.aimYaw;

    if (strike.targetKind === 'ghost') {
      if (strike.targetId !== this.ghost.id || this.ghost.state === 'BANISHED') {
        return { ok: false, reason: 'target_not_found', message: 'Ghost target unavailable' };
      }
      const dist = Math.hypot(this.ghost.x - attacker.x, this.ghost.z - attacker.z);
      if (dist > spec.rangeM) {
        return {
          ok: false,
          reason: 'out_of_range',
          message: `Ghost is ${dist.toFixed(1)}m away (max ${spec.rangeM}m)`,
        };
      }

      attacker.stamina = Math.max(0, attacker.stamina - spec.staminaCost);
      attacker.abilityCooldownUntilMs[strike.abilityId] = nowMs + spec.cooldownMs;
      this.ghost.hp = Math.max(0, this.ghost.hp - spec.baseDamage);
      const defeated = this.ghost.hp === 0;
      if (defeated) {
        this.ghost.state = 'BANISHED';
        this.ghost.targetPlayerId = null;
        this.ghost.respawnRemainingSec = WAREHOUSE_GHOST_ENCOUNTER.respawnSec;
      } else if (strike.abilityId === 'ward-pulse') {
        // Ward pulse pushes ghost briefly into retreat away from attacker
        this.ghost.state = 'RETREATING';
      }

      const ev = this.recordCombatEvent({
        attackerId: attacker.sessionId,
        attackerKind: 'player',
        targetId: this.ghost.id,
        targetKind: 'ghost',
        abilityId: spec.id,
        damage: spec.baseDamage,
        targetHpAfter: this.ghost.hp,
        defeated,
      });
      return { ok: true, event: ev };
    }

    // PvP target validation
    if (strike.targetId === sessionId) {
      return { ok: false, reason: 'invalid_payload', message: 'Cannot strike self' };
    }
    const target = this.players.get(strike.targetId);
    if (!target || target.hp <= 0) {
      return { ok: false, reason: 'target_not_found', message: 'Player target unavailable' };
    }
    if (attacker.inSafeZone || target.inSafeZone) {
      return {
        ok: false,
        reason: 'protected_zone',
        message: 'Safe-zone home protection blocks PvP combat',
      };
    }

    const dist = Math.hypot(target.x - attacker.x, target.z - attacker.z);
    if (dist > spec.rangeM) {
      return {
        ok: false,
        reason: 'out_of_range',
        message: `Target is ${dist.toFixed(1)}m away (max ${spec.rangeM}m)`,
      };
    }

    attacker.stamina = Math.max(0, attacker.stamina - spec.staminaCost);
    attacker.abilityCooldownUntilMs[strike.abilityId] = nowMs + spec.cooldownMs;
    target.hp = Math.max(0, target.hp - spec.baseDamage);
    const targetHpAfter = target.hp;
    const defeated = targetHpAfter === 0;
    if (defeated) {
      this.respawnPlayerAtProtectedHome(target);
    }

    const ev = this.recordCombatEvent({
      attackerId: attacker.sessionId,
      attackerKind: 'player',
      targetId: target.sessionId,
      targetKind: 'player',
      abilityId: spec.id,
      damage: spec.baseDamage,
      targetHpAfter,
      defeated,
    });
    return { ok: true, event: ev };
  }

  private respawnPlayerAtProtectedHome(player: MutablePlayer): void {
    const safeSpawn = homeProtectedSpawn(player.slot);
    player.x = safeSpawn.x;
    player.y = safeSpawn.y;
    player.z = safeSpawn.z;
    player.yaw = safeSpawn.yaw;
    player.hp = player.maxHp;
    player.stamina = player.maxStamina;
    player.inSafeZone = this.isProtected(player.x, player.z);
    player.moveQueue = [];
    this.syncPlayerToGrid(player);
  }

  private recordCombatEvent(
    ev: Omit<CombatEventRecord, 'eventId' | 'tick'>,
  ): CombatEventRecord {
    const full: CombatEventRecord = {
      eventId: `cev_${++this.eventSeq}`,
      tick: this.tickCount,
      ...ev,
    };
    this.tickEvents.push(full);
    return full;
  }

  private processPlayerMovements(dtSec: number, nowMs: number): RejectedIntentOutcome[] {
    const rejections: RejectedIntentOutcome[] = [];
    for (const player of this.players.values()) {
      // Passive stamina recovery
      if (player.stamina < player.maxStamina) {
        player.stamina = Math.min(player.maxStamina, player.stamina + 14 * dtSec);
      }

      if (player.moveQueue.length === 0) continue;

      if (nowMs - player.speedWindowStartMs >= 1000) {
        player.speedWindowStartMs = nowMs;
        player.speedWindowDistanceM = 0;
      }

      for (const queued of player.moveQueue) {
        player.lastAckSeq = Math.max(player.lastAckSeq, queued.seq);
        const { dx, dz, yaw, sprinting, dtMs } = queued.intent;
        player.yaw = yaw;

        if (dx === 0 && dz === 0) continue;

        const stepSec = Math.min(PLAYER_MOVEMENT_LIMITS.maxStepSec, dtMs / 1000);
        const wantsSprint = sprinting && player.stamina > 1;
        const speed = wantsSprint ? PLAYER_MOVEMENT_LIMITS.runMps : PLAYER_MOVEMENT_LIMITS.walkMps;
        const plannedStep = speed * stepSec;
        const maxBudgetRemaining = Math.max(
          0,
          PLAYER_MOVEMENT_LIMITS.runMps * 1.15 - player.speedWindowDistanceM,
        );
        const allowedStep = Math.min(plannedStep, maxBudgetRemaining);

        if (plannedStep > 0.05 && allowedStep < plannedStep * 0.5) {
          rejections.push({
            ok: false,
            reason: 'speed_clamped',
            message: 'Movement budget exceeded per-second server limit',
          });
        }

        if (allowedStep > 0) {
          const nextX = clampWorldCoord(player.x + dx * allowedStep);
          const nextZ = clampWorldCoord(player.z + dz * allowedStep);
          if (this.isWalkable(nextX, nextZ)) {
            player.x = nextX;
            player.z = nextZ;
            player.speedWindowDistanceM += allowedStep;
            if (wantsSprint) {
              player.stamina = Math.max(0, player.stamina - 8 * stepSec);
            }
          }
        }
      }

      player.inSafeZone = this.isProtected(player.x, player.z);
      player.moveQueue = [];
      this.syncPlayerToGrid(player);
    }
    return rejections;
  }

  private stepGhost(dtSec: number, nowMs: number): void {
    const g = this.ghost;
    const cfg = WAREHOUSE_GHOST_ENCOUNTER;

    if (g.state === 'BANISHED') {
      g.respawnRemainingSec -= dtSec;
      g.targetPlayerId = null;
      if (g.respawnRemainingSec <= 0) {
        g.state = 'WANDERING';
        g.hp = g.maxHp;
        g.x = cfg.anchorX;
        g.z = cfg.anchorZ;
        g.homeProtected = this.isProtected(g.x, g.z, AUTHORITATIVE_HOME_SAFE_ZONE.retreatBuffer);
        this.ghostGrid.upsert(g);
      }
      return;
    }

    const nearby = this.playerGrid.queryRadius(g.x, g.z, cfg.giveUpDistanceM);
    let target: MutablePlayer | null = null;
    let bestDist = Infinity;
    let anyProtectedNear = false;

    for (const p of nearby) {
      if (p.hp <= 0) continue;
      const d = Math.hypot(p.x - g.x, p.z - g.z);
      if (p.inSafeZone) {
        if (d <= cfg.detectRadiusM) anyProtectedNear = true;
        continue;
      }
      const limit = g.targetPlayerId === p.sessionId ? cfg.giveUpDistanceM : cfg.detectRadiusM;
      if (d <= limit && d < bestDist) {
        bestDist = d;
        target = p;
      }
    }

    const insideProtectionBuffer = this.isProtected(
      g.x,
      g.z,
      AUTHORITATIVE_HOME_SAFE_ZONE.retreatBuffer,
    );
    g.homeProtected = insideProtectionBuffer || (target === null && anyProtectedNear);

    if (insideProtectionBuffer) {
      g.state = 'RETREATING';
      g.targetPlayerId = null;
      const awayX = g.x - AUTHORITATIVE_HOME_SAFE_ZONE.x;
      const awayZ = g.z - AUTHORITATIVE_HOME_SAFE_ZONE.z;
      const len = Math.hypot(awayX, awayZ) || 1;
      const nx = g.x + (awayX / len) * cfg.retreatSpeedMps * dtSec;
      const nz = g.z + (awayZ / len) * cfg.retreatSpeedMps * dtSec;
      if (distanceToHomeSafeZone(nx, nz) >= distanceToHomeSafeZone(g.x, g.z) - 1e-6) {
        g.x = nx;
        g.z = nz;
        g.yaw = Math.atan2(awayX, awayZ);
      }
      this.ghostGrid.upsert(g);
      return;
    }

    if (target) {
      g.targetPlayerId = target.sessionId;
      const dx = target.x - g.x;
      const dz = target.z - g.z;
      const dist = Math.hypot(dx, dz) || 1;
      g.yaw = Math.atan2(dx, dz);

      if (dist <= cfg.grabRangeM) {
        // F02: check that no impassable barrier lies between ghost and player.
        // If the grab corridor is blocked, treat the state as CHASING so the
        // ghost tries to path around rather than dealing damage through walls.
        if (!this.isSegmentWalkable(g.x, g.z, target.x, target.z)) {
          g.state = 'CHASING';
        } else {
          g.state = 'GRABBING';
          if (nowMs >= g.nextAttackAtMs) {
            g.nextAttackAtMs = nowMs + cfg.grabCooldownMs;
            target.hp = Math.max(0, target.hp - cfg.grabDamage);
            const targetHpAfter = target.hp;
            const defeated = targetHpAfter === 0;
            if (defeated) {
              this.respawnPlayerAtProtectedHome(target);
              g.targetPlayerId = null;
              g.state = 'WANDERING';
            }
            this.recordCombatEvent({
              attackerId: g.id,
              attackerKind: 'ghost',
              targetId: target.sessionId,
              targetKind: 'player',
              abilityId: 'ghost-grab',
              damage: cfg.grabDamage,
              targetHpAfter,
              defeated,
            });
          }
        }
      } else {
        g.state = 'CHASING';
        const step = Math.min(dist, cfg.chaseSpeedMps * dtSec);
        const nx = g.x + (dx / dist) * step;
        const nz = g.z + (dz / dist) * step;
        if (this.isProtected(nx, nz, AUTHORITATIVE_HOME_SAFE_ZONE.retreatBuffer)) {
          g.state = 'RETREATING';
          g.targetPlayerId = null;
        } else if (this.isWalkable(nx, nz)) {
          g.x = nx;
          g.z = nz;
        }
      }
    } else {
      g.targetPlayerId = null;
      g.state = 'WANDERING';
      g.wanderPhaseRad = (g.wanderPhaseRad + 0.35 * dtSec) % (Math.PI * 2);
      const orbitR = 9;
      const tx = cfg.anchorX + Math.cos(g.wanderPhaseRad) * orbitR;
      const tz = cfg.anchorZ + Math.sin(g.wanderPhaseRad) * orbitR;
      const dx = tx - g.x;
      const dz = tz - g.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, cfg.wanderSpeedMps * dtSec);
        const nx = g.x + (dx / d) * step;
        const nz = g.z + (dz / d) * step;
        if (!this.isProtected(nx, nz, AUTHORITATIVE_HOME_SAFE_ZONE.retreatBuffer)) {
          g.x = nx;
          g.z = nz;
          g.yaw = Math.atan2(dx, dz);
        }
      }
    }

    this.ghostGrid.upsert(g);
  }

  /**
   * Advances one authoritative simulation tick, enforcing movement caps, Ghost AI +
   * safe-zone protection, spatial grid indexing, and per-tick tick-budget profiling.
   */
  stepTick(dtSec: number, nowMs: number = Date.now()): SimulationTickMetrics {
    const startNs = performance.now();
    this.tickCount += 1;
    const boundedDt = Math.max(0.001, Math.min(PLAYER_MOVEMENT_LIMITS.maxStepSec, dtSec));

    this.processPlayerMovements(boundedDt, nowMs);
    this.stepGhost(boundedDt, nowMs);

    const combatEventCount = this.tickEvents.length;
    const durationMs = performance.now() - startNs;
    return {
      tick: this.tickCount,
      durationMs,
      playerCount: this.players.size,
      activeCells: this.playerGrid.getActiveCellCount(),
      combatEventCount,
    };
  }

  flushTickEvents(): CombatEventRecord[] {
    const out = this.tickEvents;
    this.tickEvents = [];
    return out;
  }

  buildSnapshotForPlayer(
    sessionId: string,
    tickEvents: readonly CombatEventRecord[],
    nowMs: number = Date.now(),
    interestRadiusM: number = DEFAULT_INTEREST_RADIUS_M,
  ): WorldSnapshotPayload | null {
    const self = this.players.get(sessionId);
    if (!self) return null;

    const visiblePlayersRaw = this.playerGrid.queryRadius(
      self.x,
      self.z,
      interestRadiusM,
      sessionId,
      MAX_VISIBLE_PLAYERS_PER_OBSERVER,
    );
    const visibleGhostsRaw = this.ghostGrid.queryRadius(self.x, self.z, interestRadiusM);

    const visiblePlayerIds = new Set<string>([sessionId, ...visiblePlayersRaw.map((p) => p.sessionId)]);
    const visibleGhostIds = new Set<string>(visibleGhostsRaw.map((g) => g.id));

    const scopedEvents = tickEvents.filter(
      (ev) =>
        visiblePlayerIds.has(ev.attackerId) ||
        visiblePlayerIds.has(ev.targetId) ||
        visibleGhostIds.has(ev.attackerId) ||
        visibleGhostIds.has(ev.targetId),
    );

    const selfSnap = this.toPlayerSnapshot(self);
    return {
      protocolVersion: AUTHORITATIVE_PROTOCOL_VERSION,
      serverTick: this.tickCount,
      serverTimeMs: nowMs,
      cellId: selfSnap.cellId,
      interestRadiusM,
      self: selfSnap,
      visiblePlayers: visiblePlayersRaw.map((p) => this.toPlayerSnapshot(p)),
      visibleGhosts: visibleGhostsRaw.map((g) => ({
        id: g.id,
        state: g.state,
        x: g.x,
        z: g.z,
        yaw: g.yaw,
        hp: g.hp,
        maxHp: g.maxHp,
        cellId: computeWorldCellId(g.x, g.z),
        targetPlayerId: g.targetPlayerId,
        homeProtected: g.homeProtected,
      })),
      combatEvents: scopedEvents,
    };
  }

  private toPlayerSnapshot(p: MutablePlayer): WorldSnapshotPlayer {
    return {
      sessionId: p.sessionId,
      accountId: p.accountId,
      name: p.name,
      avatar: p.avatar,
      role: p.role,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      hp: Math.round(p.hp),
      maxHp: p.maxHp,
      stamina: Math.round(p.stamina),
      maxStamina: p.maxStamina,
      cellId: computeWorldCellId(p.x, p.z),
      inSafeZone: p.inSafeZone,
      lastAckSeq: p.lastAckSeq,
    };
  }
}
