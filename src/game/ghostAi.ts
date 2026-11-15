import {HOME_RETREAT,isPlayerHomeProtected,stepHomeRetreat} from './playerHomeProtection.ts';
import type { GhostClipId } from '../animation/ghost/GhostMotionLibrary.ts';
import {
  findWaypointPath,
  isGhostPointWalkable,
  type GhostObstacleBox,
  type GhostRoadCrossingPair,
  type GhostTreeCollider,
  type GhostWarehouseEnvironment,
  type GhostWaypoint,
} from '../data/ghostWarehouseWaypoints.ts';
import type { GhostAudioCue } from './ghostAudio.ts';
import {
  DEFAULT_GHOST_AI_CONFIG,
  rollGhostChaseThreshold,
  type GhostAiConfig,
  type GhostEncounterInteractionState,
  type GhostGrabPhase,
} from './ghostConfig.ts';

export type GhostAiState =
  | 'RETREAT'
  | 'FADE_OUT'
  | 'DORMANT'
  | 'SPAWNING'
  | 'HIDING'
  | 'WANDERING'
  | 'ROAD_CROSSING'
  | 'OBSERVING_PLAYER'
  | 'SCARING'
  | 'FLEEING'
  | 'CHASING'
  | 'GRABBING'
  | 'RECOVERING'
  | 'RETURNING_HOME'
  | 'COOLDOWN'
  | 'DESPAWNING';

export interface GhostTrafficSample {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export interface GhostAiStepInput {
  readonly dt: number;
  readonly activeBySchedule: boolean;
  readonly playerX: number;
  readonly playerZ: number;
  readonly playerInVehicle?: boolean;
  readonly traffic?: readonly GhostTrafficSample[];
  readonly walkCheck?: (x: number, z: number) => boolean;
}

export interface GhostClipDirective {
  readonly clipId: GhostClipId;
  readonly loop: boolean;
  readonly speedScale: number;
}

export interface GhostAiAudioEvent {
  readonly seq: number;
  readonly cue: GhostAudioCue;
}

export interface GhostAiSnapshot {
  readonly state: GhostAiState;
  readonly attackEnabled:boolean;
  readonly collisionEnabled:boolean;
  readonly homeProtected:boolean;
  readonly playerKilled:boolean;
  readonly chaseSpeed:number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly opacity: number;
  readonly visible: boolean;
  readonly activeClip: GhostClipDirective;
  readonly currentWaypointId: string;
  readonly targetWaypointId: string;
  readonly scareTriggerCount: number;
  readonly crossingCount: number;
  readonly fallTriggerCount: number;
  readonly encounterCount: number;
  readonly chaseThreshold: number;
  readonly encounterCycleCount: number;
  readonly chaseTriggerCount: number;
  readonly grabCount: number;
  readonly playerInsideEncounterZone: boolean;
  readonly audioCue: GhostAiAudioEvent | null;
  readonly grabInteraction: Readonly<GhostEncounterInteractionState>;
  readonly distToPlayerM: number;
  readonly hasLineOfSight: boolean;
}

/** Deterministic PRNG step (LCG) for reproducible AI variation across runs & unit tests. */
function nextRand(seed: number): { seed: number; value: number } {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { seed: next, value: next / 4294967296 };
}

function normalizeAngle(rad: number): number {
  let a = rad;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function rotateTowardAngle(current: number, target: number, maxStep: number): number {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

/** Exact 2D ray-vs-OBB slab intersection test for warehouse/building wall sight blocking. */
export function segmentIntersectsObstacleBox(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  box: GhostObstacleBox,
): boolean {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);

  const dax = ax - box.x;
  const daz = az - box.z;
  const dbx = bx - box.x;
  const dbz = bz - box.z;

  const lax = dax * cos - daz * sin;
  const laz = dax * sin + daz * cos;
  const lbx = dbx * cos - dbz * sin;
  const lbz = dbx * sin + dbz * cos;

  const dx = lbx - lax;
  const dz = lbz - laz;
  const hw = box.halfW;
  const hd = box.halfD;

  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-8) {
    if (lax < -hw || lax > hw) return false;
  } else {
    let t1 = (-hw - lax) / dx;
    let t2 = (hw - lax) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  if (Math.abs(dz) < 1e-8) {
    if (laz < -hd || laz > hd) return false;
  } else {
    let t1 = (-hd - laz) / dz;
    let t2 = (hd - laz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return tMin <= tMax;
}

export function hasWarehouseLineOfSight(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  obstacles: readonly GhostObstacleBox[],
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    const box = obstacles[i];
    if (!box.blocksSight) continue;
    if (segmentIntersectsObstacleBox(fromX, fromZ, toX, toZ, box)) {
      return false;
    }
  }
  return true;
}

/**
 * Pure TypeScript 11-state Autonomous Night Ghost AI controller.
 * Manages deterministic state transitions, obstacle/tree avoidance, vehicle-aware road crossing,
 * LOS scare behavior, and zero-allocation per-frame stepping.
 */
export class GhostAiController {
  private readonly env: GhostWarehouseEnvironment;
  private readonly cfg: GhostAiConfig;
  private readonly thresholdRng: () => number;

  private state: GhostAiState = 'DORMANT';
  private x: number;
  private z: number;
  private yaw = 0;
  private opacity = 0;
  private chaseSpeed=0;
  private directPath=false;
  private playerKilled=false;
  private originalSpawnId:string;
  private hasSpawned=false;
  private safeCooldown=false;
  private homeProtected=false;
  private fadeStartOpacity=1;
  private retreatMotion={x:0,z:0};
  private seed: number;

  private homeWaypointId: string;
  private currentWaypointId: string;
  private targetWaypointId: string;
  private pathQueue: string[] = [];

  private stateTimer = 0;
  private stateDuration = 0;
  private scareCooldownTimer = 0;
  private encounterCooldownTimer = 0;
  private roadCrossTimer: number;

  private encounterCount = 0;
  private chaseThreshold: number;
  private encounterCycleCount = 1;
  private playerInsideEncounterZone = false;
  private cyclePendingReset = false;

  private scareSubPhase: 'freaky' | 'laugh' = 'freaky';
  private hideClipChoice: 'dig' | 'depressed' = 'depressed';
  private fleeClipChoice: 'flee_01' | 'flee_02' = 'flee_01';
  private chaseClipChoice: 'flee_01' | 'flee_02' = 'flee_01';
  private roadCrossClipChoice: 'flee_01' | 'flee_02' = 'flee_01';
  private roadCrossStage: 'approach-curb' | 'wait-traffic' | 'crossing' = 'approach-curb';
  private activeCrossing: GhostRoadCrossingPair | null = null;
  private crossingExitCurbId = '';
  private trafficWaitElapsed = 0;

  private grabPhase: GhostGrabPhase = 'none';
  private grabSeq = 0;
  private grabFallProgress = 0;
  private chasePathRefreshTimer = 0;

  private fleeFallenThisCycle = false;
  private fleeSubPhase: 'run' | 'fall' = 'run';

  private progressCheckTimer = 0;
  private progressCheckX = 0;
  private progressCheckZ = 0;

  private scareTriggerCount = 0;
  private crossingCount = 0;
  private fallTriggerCount = 0;
  private chaseTriggerCount = 0;
  private grabCount = 0;
  private audioSeq = 0;
  private lastAudioCue: GhostAiAudioEvent | null = null;
  private lastDistToPlayer = 999;
  private lastHasLos = false;

  constructor(
    env: GhostWarehouseEnvironment,
    config: GhostAiConfig = DEFAULT_GHOST_AI_CONFIG,
    initialSeed = 424242,
    thresholdRng: () => number = Math.random,
  ) {
    this.env = env;
    this.cfg = {...config,hideDurationRangeSec:[...config.hideDurationRangeSec],observeDurationRangeSec:[...config.observeDurationRangeSec],roadCrossCooldownRangeSec:[...config.roadCrossCooldownRangeSec]};
    this.seed = initialSeed >>> 0;
    this.thresholdRng = thresholdRng;
    this.chaseThreshold = rollGhostChaseThreshold(this.thresholdRng);
    const defaultHome = this.pickBestHomeWaypoint(env.anchor.x, env.anchor.z, 999, 999);
    this.originalSpawnId=defaultHome.id;
    this.homeWaypointId = defaultHome.id;
    this.currentWaypointId = defaultHome.id;
    this.targetWaypointId = defaultHome.id;
    this.x = defaultHome.x;
    this.z = defaultHome.z;
    this.roadCrossTimer = this.randRange(
      Math.min(4, config.roadCrossCooldownRangeSec[0]),
      Math.min(10, config.roadCrossCooldownRangeSec[1]),
    );
  }

  private emitAudioCue(cue: GhostAudioCue): void {
    this.audioSeq += 1;
    this.lastAudioCue = { seq: this.audioSeq, cue };
  }

  private effectiveExitRadiusM(): number {
    return Math.max(this.cfg.encounterEntryRadiusM + 2, this.cfg.encounterExitRadiusM);
  }

  private isEncounterBusyState(state: GhostAiState): boolean {
    return (
      state === 'RETREAT' || state === 'FADE_OUT' ||
      state === 'DORMANT' ||
      state === 'SPAWNING' ||
      state === 'DESPAWNING' ||
      state === 'SCARING' ||
      state === 'FLEEING' ||
      state === 'CHASING' ||
      state === 'GRABBING' ||
      state === 'RECOVERING' ||
      state === 'RETURNING_HOME' ||
      state === 'COOLDOWN'
    );
  }

  private resetEncounterCycle(distToPlayer?: number): void {
    this.encounterCount = 0;
    this.cyclePendingReset = false;
    this.encounterCycleCount += 1;
    this.chaseThreshold = rollGhostChaseThreshold(this.thresholdRng);
    if (typeof distToPlayer === 'number') {
      this.playerInsideEncounterZone = distToPlayer < this.effectiveExitRadiusM();
    } else {
      this.playerInsideEncounterZone = false;
    }
  }

  private rand(): number {
    const r = nextRand(this.seed);
    this.seed = r.seed;
    return r.value;
  }

  private randRange(min: number, max: number): number {
    return min + (max - min) * this.rand();
  }

  private pickRandomFrom<T>(items: readonly T[]): T {
    const idx = Math.min(items.length - 1, Math.floor(this.rand() * items.length));
    return items[idx];
  }

  private pickBestHomeWaypoint(
    anchorX: number,
    anchorZ: number,
    playerX: number,
    playerZ: number,
  ): GhostWaypoint {
    const candidates = this.env.hidingIds
      .map((id) => this.env.waypointById.get(id))
      .filter((w): w is GhostWaypoint => Boolean(w));
    const list = candidates.length > 0 ? candidates : this.env.waypoints;

    let best = list[0];
    let bestScore = Infinity;
    for (const node of list) {
      const distAnchor = Math.hypot(node.x - anchorX, node.z - anchorZ);
      const distPlayer = Math.hypot(node.x - playerX, node.z - playerZ);
      const tooClosePenalty =
        distPlayer < Math.max(this.cfg.minSpawnPlayerClearanceM, this.cfg.encounterEntryRadiusM + 2)
          ? 150
          : 0;
      const roleBonus = node.role === 'hiding' ? -8 : node.role === 'dark-corner' ? 12 : 0;
      const randomSpread = this.rand() * 24;
      const score = distAnchor * 0.35 + tooClosePenalty + roleBonus + randomSpread;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  private pickNearbyPatrolWaypoint(excludeId?: string): GhostWaypoint {
    const cur = this.env.waypointById.get(this.currentWaypointId);
    const preferredIds = cur && cur.links.length > 0 ? cur.links : this.env.patrolIds;
    const candidates = preferredIds
      .filter((id) => id !== excludeId)
      .map((id) => this.env.waypointById.get(id))
      .filter((w): w is GhostWaypoint => w !== undefined && w.role !== 'road-curb');

    if (candidates.length > 0) return this.pickRandomFrom(candidates);

    const patrolNodes = this.env.patrolIds
      .map((id) => this.env.waypointById.get(id))
      .filter((w): w is GhostWaypoint => w !== undefined && w.id !== excludeId);
    return patrolNodes.length > 0 ? this.pickRandomFrom(patrolNodes) : this.env.waypoints[0];
  }

  private pickEscapeWaypoint(playerX: number, playerZ: number): GhostWaypoint {
    const candidates = this.env.hidingIds
      .map((id) => this.env.waypointById.get(id))
      .filter((w): w is GhostWaypoint => Boolean(w));
    const list = candidates.length > 0 ? candidates : this.env.waypoints;

    let best = list[0];
    let bestScore = -Infinity;
    for (const node of list) {
      const distPlayer = Math.hypot(node.x - playerX, node.z - playerZ);
      const distAnchor = Math.hypot(node.x - this.env.anchor.x, node.z - this.env.anchor.z);
      const inPatrolPenalty = distAnchor > this.cfg.patrolRadiusM ? -80 : 0;
      const score = distPlayer - Math.hypot(node.x - this.x, node.z - this.z) * 0.25 + inPatrolPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  private setTargetWaypoint(goal: GhostWaypoint): void {
    const nearestCur = this.findNearestWaypoint(this.x, this.z);
    this.currentWaypointId = nearestCur.id;
    this.targetWaypointId = goal.id;
    const rawPath = findWaypointPath(this.env, nearestCur.id, goal.id);
    this.pathQueue = rawPath.slice(1);
    this.resetProgressWatch();
  }

  private findNearestWaypoint(px: number, pz: number): GhostWaypoint {
    let best = this.env.waypoints[0];
    let bestDistSq = Infinity;
    for (let i = 0; i < this.env.waypoints.length; i++) {
      const w = this.env.waypoints[i];
      const dx = w.x - px;
      const dz = w.z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = w;
      }
    }
    return best;
  }

  private resetProgressWatch(): void {
    this.progressCheckTimer = 0;
    this.progressCheckX = this.x;
    this.progressCheckZ = this.z;
  }

  private transitionTo(next: GhostAiState, opts?: { duration?: number }): void {
    if(next!=='CHASING')this.chaseSpeed=0;
    this.state = next;
    this.stateTimer = 0;
    this.stateDuration = opts?.duration ?? 0;
    this.resetProgressWatch();

    switch (next) {
      case 'RETREAT':
      case 'FADE_OUT':
        this.pathQueue=[];this.grabPhase='none';this.grabFallProgress=0;this.lastAudioCue=null;this.playerKilled=false;
        this.grabSeq++;this.safeCooldown=true;this.fadeStartOpacity=this.opacity;
        break;
      case 'DORMANT':
        this.opacity = 0;
        this.pathQueue = [];
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        break;
      case 'SPAWNING':
        this.opacity = 0.02;
        this.hideClipChoice = this.rand() < 0.45 ? 'dig' : 'depressed';
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        break;
      case 'HIDING': {
        const node = this.findNearestWaypoint(this.x, this.z);
        this.hideClipChoice = node.preferredClip ?? (this.rand() < 0.4 ? 'dig' : 'depressed');
        this.stateDuration =
          opts?.duration ??
          this.randRange(this.cfg.hideDurationRangeSec[0], this.cfg.hideDurationRangeSec[1]);
        this.opacity = 1;
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        break;
      }
      case 'WANDERING': {
        const dest = this.pickNearbyPatrolWaypoint(this.currentWaypointId);
        this.setTargetWaypoint(dest);
        this.stateDuration = this.randRange(6, 12);
        this.opacity = 1;
        break;
      }
      case 'ROAD_CROSSING': {
        this.opacity = 1;
        this.roadCrossClipChoice = this.rand() < 0.3 ? 'flee_02' : 'flee_01';
        this.trafficWaitElapsed = 0;
        const crossings = this.env.roadCrossings;
        if (crossings.length === 0) {
          this.transitionTo('WANDERING');
          return;
        }
        // Pick nearest crossing pair and orient entry curb on the ghost's current road side.
        let chosen = crossings[0];
        let minScore = Infinity;
        for (const pair of crossings) {
          const d = Math.hypot(pair.midX - this.x, pair.midZ - this.z);
          if (d < minScore) {
            minScore = d;
            chosen = pair;
          }
        }
        const west = this.env.waypointById.get(chosen.westCurbId)!;
        const east = this.env.waypointById.get(chosen.eastCurbId)!;
        const dWest = Math.hypot(west.x - this.x, west.z - this.z);
        const dEast = Math.hypot(east.x - this.x, east.z - this.z);
        const entryCurb = dWest <= dEast ? west : east;
        const exitCurb = dWest <= dEast ? east : west;
        this.activeCrossing = chosen;
        this.crossingExitCurbId = exitCurb.id;
        this.roadCrossStage = 'approach-curb';
        this.setTargetWaypoint(entryCurb);
        this.roadCrossTimer = this.randRange(
          this.cfg.roadCrossCooldownRangeSec[0],
          this.cfg.roadCrossCooldownRangeSec[1],
        );
        break;
      }
      case 'OBSERVING_PLAYER':
        this.opacity = 1;
        this.pathQueue = [];
        this.stateDuration =
          opts?.duration ??
          this.randRange(this.cfg.observeDurationRangeSec[0], this.cfg.observeDurationRangeSec[1]);
        break;
      case 'SCARING':
        this.opacity = 1;
        this.pathQueue = [];
        this.scareSubPhase = 'freaky';
        this.stateDuration = this.cfg.scareDurationSec;
        this.scareTriggerCount++;
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        this.emitAudioCue('scream');
        break;
      case 'FLEEING':
        this.opacity = 1;
        this.fleeSubPhase = 'run';
        this.fleeClipChoice = this.rand() < 0.35 ? 'flee_02' : 'flee_01';
        this.fleeFallenThisCycle = false;
        this.stateDuration = this.cfg.fleeDurationSec;
        this.encounterCooldownTimer = Math.max(
          this.encounterCooldownTimer,
          this.cfg.encounterCooldownSec,
        );
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        break;
      case 'CHASING':
        this.cyclePendingReset=true;
        this.opacity = 1;
        this.pathQueue = [];
        this.chasePathRefreshTimer = 0;
        this.chaseClipChoice = this.rand() < 0.45 ? 'flee_02' : 'flee_01';
        this.stateDuration = this.cfg.maxChaseDurationSec;
        this.chaseTriggerCount += 1;
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        break;
      case 'GRABBING':
        this.playerKilled=false;
        this.opacity = 1;
        this.pathQueue = [];
        this.grabPhase = 'neck-grab';
        this.grabSeq += 1;
        this.grabFallProgress = 0;
        this.stateDuration = this.cfg.grabHoldDurationSec;
        this.grabCount += 1;
        this.emitAudioCue('grab-impact');
        break;
      case 'RECOVERING':
        this.opacity = 1;
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        this.stateDuration = this.cfg.recoverDurationSec;
        break;
      case 'RETURNING_HOME': {
        this.opacity = 1;
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        const home = this.env.waypointById.get(this.homeWaypointId) ?? this.findNearestWaypoint(this.x, this.z);
        this.setTargetWaypoint(home);
        break;
      }
      case 'COOLDOWN':
        this.opacity = 1;
        this.pathQueue = [];
        this.hideClipChoice = 'depressed';
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        this.stateDuration = Math.max(
          0.35,
          this.scareCooldownTimer,
          this.encounterCooldownTimer,
        );
        break;
      case 'DESPAWNING':
        this.pathQueue = [];
        this.grabPhase = 'none';
        this.grabFallProgress = 0;
        this.stateDuration = this.cfg.despawnDurationSec;
        break;
    }
  }

  /**
   * Checks if any tracked vehicle/robot is approaching the road crossing corridor closely enough
   * that entering the road lane would risk overlapping traffic.
   */
  private isTrafficBlockingCrossing(
    entryX: number,
    entryZ: number,
    exitX: number,
    exitZ: number,
    traffic: readonly GhostTrafficSample[] | undefined,
  ): boolean {
    if (!traffic || traffic.length === 0) return false;
    const midX = (entryX + exitX) * 0.5;
    const midZ = (entryZ + exitZ) * 0.5;
    const roadDirX = exitX - entryX;
    const roadDirZ = exitZ - entryZ;
    const crossLen = Math.hypot(roadDirX, roadDirZ) || 1;
    const nx = roadDirX / crossLen;
    const nz = roadDirZ / crossLen;
    // Tangent along road direction
    const tx = -nz;
    const tz = nx;

    for (let i = 0; i < traffic.length; i++) {
      const car = traffic[i];
      const dx = midX - car.x;
      const dz = midZ - car.z;
      const alongRoad = Math.abs(dx * tx + dz * tz);
      const acrossRoad = Math.abs(dx * nx + dz * nz);
      if (acrossRoad > crossLen * 0.5 + 1.2) continue;
      if (alongRoad < this.cfg.vehicleSafetyDistanceM + car.halfDepth) {
        // Also check whether car forward heading (-sin(yaw), -cos(yaw)) is heading toward crossing or right on it
        const fvx = -Math.sin(car.yaw);
        const fvz = -Math.cos(car.yaw);
        const closingDot = dx * fvx + dz * fvz;
        if (alongRoad < car.halfDepth + 3.2 || closingDot > 0) {
          return true;
        }
      }
    }
    return false;
  }

  private traversable(ax:number,az:number,bx:number,bz:number,walk:(x:number,z:number)=>boolean){
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.25));
    for(let i=0;i<=steps;i++)if(!walk(ax+(bx-ax)*i/steps,az+(bz-az)*i/steps))return false;
    return true;
  }

  /** Steers smoothly toward target point while applying gentle tree avoidance + walkable sliding. */
  private steerToward(
    targetX: number,
    targetZ: number,
    speedMps: number,
    dt: number,
    walkCheck: (x: number, z: number) => boolean,
  ): boolean {
    const toX = targetX - this.x;
    const toZ = targetZ - this.z;
    const dist = Math.hypot(toX, toZ);
    if (dist < 0.45) return true;

    let dirX = toX / dist;
    let dirZ = toZ / dist;

    // Gentle local avoidance around roadside/compound tree trunks
    const trees = this.env.treeColliders;
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const avoidR = t.radius + 1.45;
      const dx = this.x - t.x;
      const dz = this.z - t.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.0001 && dSq < avoidR * avoidR) {
        const d = Math.sqrt(dSq);
        const strength = (avoidR - d) / avoidR;
        dirX += (dx / d) * strength * 1.1;
        dirZ += (dz / d) * strength * 1.1;
      }
    }

    const norm = Math.hypot(dirX, dirZ) || 1;
    dirX /= norm;
    dirZ /= norm;

    const step = Math.min(dist, speedMps * dt);
    const stepX = dirX * step;
    const stepZ = dirZ * step;

    const subSteps = Math.max(1, Math.ceil(step / 0.16));
    const sx = stepX / subSteps;
    const sz = stepZ / subSteps;

    for (let i = 0; i < subSteps; i++) {
      if (walkCheck(this.x + sx, this.z)) {
        this.x += sx;
      }
      if (walkCheck(this.x, this.z + sz)) {
        this.z += sz;
      }
    }

    // Clamp softly to zone patrol disk so runaway avoidance stays inside haunt area
    const offX = this.x - this.env.anchor.x;
    const offZ = this.z - this.env.anchor.z;
    const offDist = Math.hypot(offX, offZ);
    if (this.state!=='CHASING'&&offDist > this.cfg.patrolRadiusM + 8) {
      const clampScale = (this.cfg.patrolRadiusM + 8) / offDist;
      const x=this.env.anchor.x+offX*clampScale,z=this.env.anchor.z+offZ*clampScale;
      if(this.traversable(this.x,this.z,x,z,walkCheck)){this.x=x;this.z=z;}
    }

    const targetYaw = Math.atan2(dirX, dirZ);
    this.yaw = rotateTowardAngle(this.yaw, targetYaw, this.cfg.turnRateRadPerSec * dt);
    return Math.hypot(targetX - this.x, targetZ - this.z) < 0.45;
  }

  private followCurrentPath(
    speedMps: number,
    dt: number,
    walkCheck: (x: number, z: number) => boolean,
  ): boolean {
    if (this.pathQueue.length === 0) return true;
    const nextNodeId = this.pathQueue[0];
    const nextNode = this.env.waypointById.get(nextNodeId);
    if (!nextNode) {
      this.pathQueue.shift();
      return this.pathQueue.length === 0;
    }

    this.currentWaypointId = nextNode.id;
    const reached = this.steerToward(nextNode.x, nextNode.z, speedMps, dt, walkCheck);
    if (reached || Math.hypot(nextNode.x - this.x, nextNode.z - this.z) < 0.55) {
      this.pathQueue.shift();
    }

    // Anti-stuck safeguard
    this.progressCheckTimer += dt;
    if (this.progressCheckTimer >= 2.8) {
      const movedDist = Math.hypot(this.x - this.progressCheckX, this.z - this.progressCheckZ);
      this.progressCheckTimer = 0;
      this.progressCheckX = this.x;
      this.progressCheckZ = this.z;
      if (movedDist < 0.25 && speedMps > 0.2) {
        this.pathQueue = [];
        return true;
      }
    }
    return this.pathQueue.length === 0;
  }

  private canSensePlayer(dist: number, playerX: number, playerZ: number): { detected: boolean; los: boolean } {
    if (dist > this.cfg.loseSightRadiusM) {
      return { detected: false, los: false };
    }
    const los = hasWarehouseLineOfSight(this.x, this.z, playerX, playerZ, this.env.obstacleBoxes);
    if (dist <= this.cfg.closeScareRadiusM && los) {
      return { detected: true, los: true };
    }
    return {
      detected: dist <= this.cfg.detectRadiusM && los,
      los,
    };
  }

  public getActiveClipDirective(): GhostClipDirective {
    switch (this.state) {
      case 'RETREAT':
      case 'FADE_OUT':
        return {clipId:'depressed',loop:true,speedScale:.7};
      case 'DORMANT':
      case 'DESPAWNING':
      case 'OBSERVING_PLAYER':
      case 'COOLDOWN':
        return { clipId: 'depressed', loop: true, speedScale: 0.95 };
      case 'SPAWNING':
      case 'HIDING':
        return { clipId: this.hideClipChoice, loop: true, speedScale: 1.0 };
      case 'WANDERING':
        return { clipId: 'depressed', loop: true, speedScale: 1.15 };
      case 'ROAD_CROSSING':
        if (this.roadCrossStage !== 'crossing') {
          return { clipId: 'depressed', loop: true, speedScale: 1.1 };
        }
        return {
          clipId: this.roadCrossClipChoice,
          loop: true,
          speedScale: this.roadCrossClipChoice === 'flee_01' ? 1.55 : 1.4,
        };
      case 'SCARING':
        return this.scareSubPhase === 'laugh'
          ? { clipId: 'laugh_01', loop: false, speedScale: 1.05 }
          : { clipId: 'freaky', loop: true, speedScale: 1.12 };
      case 'FLEEING':
        if (this.fleeSubPhase === 'fall') {
          return { clipId: 'fall', loop: false, speedScale: 1.05 };
        }
        return {
          clipId: this.fleeClipChoice,
          loop: true,
          speedScale: this.fleeClipChoice === 'flee_01' ? 1.65 : 1.45,
        };
      case 'CHASING':
        return {
          clipId: this.chaseClipChoice,
          loop: true,
          speedScale:Math.max(.25,this.chaseSpeed/(this.chaseClipChoice==='flee_01'?3.6:4.1)),
        };
      case 'GRABBING':
        return this.grabPhase === 'player-fall'
          ? { clipId: 'laugh_01', loop: false, speedScale: 1.05 }
          : { clipId: 'freaky', loop: true, speedScale: 1.2 };
      case 'RECOVERING':
      case 'RETURNING_HOME':
        return { clipId: 'flee_01', loop: true, speedScale: 1.0 };
    }
  }

  private tryHandleProximityEncounter(
    distToPlayer: number,
    los: boolean,
    input: GhostAiStepInput,
  ): boolean {
    if (this.isEncounterBusyState(this.state)) return false;

    if(input.playerInVehicle||!los||distToPlayer>(this.state==='OBSERVING_PLAYER'?this.cfg.loseSightRadiusM:this.cfg.detectRadiusM))return false;
    const observation=this.cfg.observeBeforeChaseSec??0;
    if(observation>0&&this.state!=='OBSERVING_PLAYER'){this.transitionTo('OBSERVING_PLAYER',{duration:observation});return true;}
    if(this.state==='OBSERVING_PLAYER'&&this.stateTimer<observation)return true;
    this.encounterCount++;
    this.playerInsideEncounterZone=true;
    this.transitionTo('CHASING');
    // The old random threshold may vary the chase presentation, never detection eligibility.
    if(this.encounterCount>0&&this.encounterCount%this.chaseThreshold===0)this.chaseClipChoice='flee_02';
    return true;
  }

  public step(input: GhostAiStepInput): GhostAiSnapshot {
    const dt = Math.max(0, Math.min(0.05, input.dt));
    const walkCheck = input.walkCheck ?? isGhostPointWalkable;

    const distToPlayer = Math.hypot(input.playerX - this.x, input.playerZ - this.z);
    const distFromAnchor = Math.hypot(
      input.playerX - this.env.anchor.x,
      input.playerZ - this.env.anchor.z,
    );
    const distFromZone =
      this.env.measureDistanceFromZone?.(input.playerX, input.playerZ) ?? distFromAnchor;
    this.lastDistToPlayer = distToPlayer;

    if (this.scareCooldownTimer > 0) {
      this.scareCooldownTimer = Math.max(0, this.scareCooldownTimer - dt);
    }
    if (this.encounterCooldownTimer > 0) {
      this.encounterCooldownTimer = Math.max(0, this.encounterCooldownTimer - dt);
    }
    if (this.roadCrossTimer > 0 && this.state !== 'DORMANT') {
      this.roadCrossTimer = Math.max(0, this.roadCrossTimer - dt);
    }

    // Highest priority: evaluated before schedule activation, sensing, windup or catch checks.
    this.homeProtected=isPlayerHomeProtected(input.playerX,input.playerZ);
    const buffered=isPlayerHomeProtected(input.playerX,input.playerZ,HOME_RETREAT.buffer);
    if(this.homeProtected){
      this.grabPhase='none';this.grabFallProgress=0;this.lastAudioCue=null;this.playerKilled=false;
      this.playerInsideEncounterZone=true;
      if(this.state==='DORMANT'&&!this.safeCooldown){this.safeCooldown=true;this.transitionTo('COOLDOWN');this.opacity=0;this.stateDuration=HOME_RETREAT.cooldownSec;}
      if(this.state!=='DORMANT'&&this.state!=='RETREAT'&&this.state!=='FADE_OUT'&&!(this.state==='COOLDOWN'&&this.safeCooldown))this.transitionTo('RETREAT');
    }
    if(this.state==='RETREAT'||this.state==='FADE_OUT'){
      this.stateTimer+=dt;
      this.yaw=rotateTowardAngle(this.yaw,Math.atan2(input.playerX-this.x,input.playerZ-this.z),this.cfg.turnRateRadPerSec*dt);
      if(this.state==='FADE_OUT'||this.stateTimer>=HOME_RETREAT.faceSec){
        this.retreatMotion.x=this.x;this.retreatMotion.z=this.z;
        stepHomeRetreat(this.retreatMotion,input.playerX,input.playerZ,dt,walkCheck);
        this.x=this.retreatMotion.x;this.z=this.retreatMotion.z;
      }
      if(this.state==='RETREAT'&&this.stateTimer>=HOME_RETREAT.faceSec+HOME_RETREAT.backSec)this.transitionTo('FADE_OUT');
      else if(this.state==='FADE_OUT'){
        const t=Math.min(1,this.stateTimer/HOME_RETREAT.fadeSec);
        this.opacity=this.fadeStartOpacity*(1-t*t*(3-2*t));
        if(t>=1){
          this.transitionTo('COOLDOWN');this.opacity=0;this.stateDuration=HOME_RETREAT.cooldownSec;
          const spawn=this.env.waypointById.get(this.originalSpawnId)!;
          if(walkCheck(spawn.x,spawn.z)){this.x=spawn.x;this.z=spawn.z;}
        }
      }
      return this.getSnapshot();
    }
    if(this.safeCooldown){
      this.opacity=0;this.stateTimer+=dt;
      if(buffered||this.stateTimer<HOME_RETREAT.cooldownSec)return this.getSnapshot();
      const spawn=this.env.waypointById.get(this.originalSpawnId)!;
      if(!walkCheck(spawn.x,spawn.z)||isPlayerHomeProtected(spawn.x,spawn.z,HOME_RETREAT.buffer))return this.getSnapshot();
      this.x=spawn.x;this.z=spawn.z;this.currentWaypointId=spawn.id;this.homeWaypointId=spawn.id;
      this.safeCooldown=false;this.resetEncounterCycle(distToPlayer);this.transitionTo('SPAWNING');
      if(!input.activeBySchedule)this.transitionTo('DORMANT');
      return this.getSnapshot();
    }
    if(this.homeProtected)return this.getSnapshot();

    // Global schedule exit: fade smoothly out unless already DORMANT.
    if (!input.activeBySchedule) {
      if (this.state !== 'DORMANT' && this.state !== 'DESPAWNING') {
        this.transitionTo('DESPAWNING');
      }
    } else if (this.state === 'DORMANT' && distFromZone <= this.cfg.assetLoadDistanceM) {
      const home = this.pickBestHomeWaypoint(
        this.env.anchor.x,
        this.env.anchor.z,
        input.playerX,
        input.playerZ,
      );
      if(!this.hasSpawned){this.originalSpawnId=home.id;this.hasSpawned=true;}
      this.homeWaypointId = home.id;
      this.currentWaypointId = home.id;
      this.targetWaypointId = home.id;
      this.x = home.x;
      this.z = home.z;
      this.yaw = Math.atan2(
        this.env.anchor.x - this.x,
        this.env.anchor.z - this.z,
      );
      const spawnDistToPlayer = Math.hypot(input.playerX - this.x, input.playerZ - this.z);
      this.playerInsideEncounterZone = spawnDistToPlayer < this.cfg.encounterEntryRadiusM;
      this.transitionTo('SPAWNING');
    }

    const updatedDistToPlayer = Math.hypot(input.playerX - this.x, input.playerZ - this.z);
    this.lastDistToPlayer = updatedDistToPlayer;

    // Distance CPU suspension when player leaves Warehouse Area completely.
    if (
      this.state !== 'DORMANT' &&
      this.state !== 'DESPAWNING' &&
      this.state !== 'GRABBING' &&
      updatedDistToPlayer > this.cfg.aiSuspendDistanceM &&
      distFromZone > this.cfg.aiSuspendDistanceM
    ) {
      this.lastHasLos = false;
      return this.getSnapshot();
    }

    const { detected, los } = this.canSensePlayer(updatedDistToPlayer, input.playerX, input.playerZ);
    this.lastHasLos = los;
    this.stateTimer += dt;
    if(detected&&['HIDING','WANDERING','OBSERVING_PLAYER','ROAD_CROSSING'].includes(this.state))
      this.tryHandleProximityEncounter(updatedDistToPlayer,los,input);

    // Update hysteresis when zone was entered previously and previous encounter + cooldown completed.
    if (
      this.playerInsideEncounterZone &&
      !this.isEncounterBusyState(this.state) &&
      this.state !== 'FLEEING' &&
      this.state !== 'RETURNING_HOME' &&
      this.state !== 'DORMANT' &&
      this.state !== 'SPAWNING' &&
      this.state !== 'DESPAWNING' &&
      this.encounterCooldownTimer <= 0 &&
      updatedDistToPlayer >= this.effectiveExitRadiusM()
    ) {
      this.playerInsideEncounterZone = false;
    }

    switch (this.state) {
      case 'DORMANT':
        break;

      case 'SPAWNING': {
        const progress = Math.min(1, this.stateTimer / Math.max(0.1, this.cfg.spawnDurationSec));
        this.opacity = progress;
        if (progress >= 1) {
          this.transitionTo('HIDING');
        }
        break;
      }

      case 'DESPAWNING': {
        const progress = Math.min(1, this.stateTimer / Math.max(0.1, this.cfg.despawnDurationSec));
        this.opacity = Math.max(0, 1 - progress);
        if (progress >= 1) {
          if (this.encounterCount > 0 || this.cyclePendingReset) {
            this.resetEncounterCycle();
          }
          this.transitionTo('DORMANT');
        }
        break;
      }

      case 'HIDING': {
        if (this.tryHandleProximityEncounter(updatedDistToPlayer, los, input)) {
          break;
        }
        if (detected && !this.playerInsideEncounterZone && this.encounterCooldownTimer <= 0) {
          this.transitionTo('OBSERVING_PLAYER');
          break;
        }
        if (this.stateTimer >= this.stateDuration) {
          if (this.roadCrossTimer <= 0 && this.env.roadCrossings.length > 0) {
            this.transitionTo('ROAD_CROSSING');
          } else {
            this.transitionTo('WANDERING');
          }
        }
        break;
      }

      case 'WANDERING': {
        if (this.tryHandleProximityEncounter(updatedDistToPlayer, los, input)) {
          break;
        }
        if (detected && !this.playerInsideEncounterZone && this.encounterCooldownTimer <= 0) {
          this.transitionTo('OBSERVING_PLAYER');
          break;
        }
        const pathDone = this.followCurrentPath(this.cfg.wanderSpeedMps, dt, walkCheck);
        if (pathDone || this.stateTimer >= this.stateDuration) {
          if (this.roadCrossTimer <= 0 && this.env.roadCrossings.length > 0 && this.rand() < 0.45) {
            this.transitionTo('ROAD_CROSSING');
          } else {
            this.transitionTo('HIDING');
          }
        }
        break;
      }

      case 'ROAD_CROSSING': {
        const crossing = this.activeCrossing;
        const exitCurb = this.env.waypointById.get(this.crossingExitCurbId);
        if (!crossing || !exitCurb) {
          this.transitionTo('WANDERING');
          break;
        }
        const entryCurbId =
          exitCurb.id === crossing.eastCurbId ? crossing.westCurbId : crossing.eastCurbId;
        const entryCurb = this.env.waypointById.get(entryCurbId);
        if (!entryCurb) {
          this.transitionTo('WANDERING');
          break;
        }

        if (this.roadCrossStage === 'approach-curb') {
          const atCurb = this.followCurrentPath(this.cfg.wanderSpeedMps * 1.25, dt, walkCheck);
          const distToCurb = Math.hypot(entryCurb.x - this.x, entryCurb.z - this.z);
          if (distToCurb < 0.9) {
            this.roadCrossStage = 'wait-traffic';
            this.trafficWaitElapsed = 0;
          } else if (atCurb) {
            // Reached end of path early (blocked): safely return to hiding rather than cutting diagonally.
            this.transitionTo('HIDING');
          }
        } else if (this.roadCrossStage === 'wait-traffic') {
          this.yaw = rotateTowardAngle(
            this.yaw,
            Math.atan2(exitCurb.x - this.x, exitCurb.z - this.z),
            this.cfg.turnRateRadPerSec * dt,
          );
          const blocked = this.isTrafficBlockingCrossing(
            entryCurb.x,
            entryCurb.z,
            exitCurb.x,
            exitCurb.z,
            input.traffic,
          );
          this.trafficWaitElapsed += dt;
          if (!blocked || this.trafficWaitElapsed >= 3.2) {
            this.roadCrossStage = 'crossing';
            this.crossingCount++;
          }
        } else {
          // Sprint straight across AH1 road to exit curb, ignoring wander interruptions.
          const arrived = this.steerToward(
            exitCurb.x,
            exitCurb.z,
            this.cfg.roadCrossSpeedMps,
            dt,
            walkCheck,
          );
          if (arrived || Math.hypot(exitCurb.x - this.x, exitCurb.z - this.z) < 0.75) {
            this.currentWaypointId = exitCurb.id;
            const shelter =
              this.env.waypointById
                .get(exitCurb.id)
                ?.links.map((id) => this.env.waypointById.get(id))
                .find((n): n is GhostWaypoint => Boolean(n && n.role !== 'road-curb')) ?? exitCurb;
            this.homeWaypointId = shelter.id;
            this.transitionTo('RETURNING_HOME');
          }
        }
        break;
      }

      case 'OBSERVING_PLAYER': {
        this.yaw = rotateTowardAngle(
          this.yaw,
          Math.atan2(input.playerX - this.x, input.playerZ - this.z),
          this.cfg.turnRateRadPerSec * dt,
        );
        if (this.tryHandleProximityEncounter(distToPlayer, los, input)) {
          break;
        }
        if (!los || distToPlayer > this.cfg.loseSightRadiusM) {
          this.transitionTo('HIDING');
          break;
        }
        if (this.stateTimer >= this.stateDuration) {
          this.transitionTo('HIDING');
        }
        break;
      }

      case 'SCARING': {
        this.yaw = rotateTowardAngle(
          this.yaw,
          Math.atan2(input.playerX - this.x, input.playerZ - this.z),
          this.cfg.turnRateRadPerSec * dt,
        );
        if (this.scareSubPhase === 'freaky' && this.stateTimer >= this.cfg.scareDurationSec) {
          this.scareSubPhase = 'laugh';
          this.stateTimer = 0;
          this.stateDuration = this.cfg.laughDurationSec;
          this.emitAudioCue('evil-laugh');
        } else if (this.scareSubPhase === 'laugh' && this.stateTimer >= this.cfg.laughDurationSec) {
          this.transitionTo('CHASING');
        }
        break;
      }

      case 'FLEEING': {
        if (this.pathQueue.length === 0 && this.fleeSubPhase === 'run') {
          const esc = this.pickEscapeWaypoint(input.playerX, input.playerZ);
          this.homeWaypointId = esc.id;
          this.setTargetWaypoint(esc);
        }
        if (this.fleeSubPhase === 'fall') {
          if (this.stateTimer >= this.cfg.fallDurationSec) {
            this.fleeSubPhase = 'run';
            this.transitionTo('RETURNING_HOME');
          }
          break;
        }
        if (
          !this.fleeFallenThisCycle &&
          this.stateTimer > 0.7 &&
          this.stateTimer < 1.3 &&
          distToPlayer > 4 &&
          this.rand() < this.cfg.fallTriggerChance * dt * 2.5
        ) {
          this.fleeFallenThisCycle = true;
          this.fleeSubPhase = 'fall';
          this.stateTimer = 0;
          this.fallTriggerCount++;
          break;
        }
        const done = this.followCurrentPath(this.cfg.fleeSpeedMps, dt, walkCheck);
        if (done || this.stateTimer >= this.stateDuration) {
          this.transitionTo('RETURNING_HOME');
        }
        break;
      }

      case 'CHASING': {
        if (!input.playerInVehicle && los && distToPlayer <= this.cfg.grabRangeM&&this.traversable(this.x,this.z,input.playerX,input.playerZ,walkCheck)) {
          this.yaw = Math.atan2(input.playerX - this.x, input.playerZ - this.z);
          this.transitionTo('GRABBING');
          break;
        }
        if (
          input.playerInVehicle ||
          distToPlayer > this.cfg.chaseGiveUpDistanceM ||
          this.stateTimer >= this.cfg.maxChaseDurationSec
        ) {
          const esc = this.pickEscapeWaypoint(input.playerX, input.playerZ);
          this.homeWaypointId = esc.id;
          this.transitionTo('RECOVERING');
          this.setTargetWaypoint(esc);
          break;
        }
        this.chaseSpeed=Math.min(this.cfg.chaseSpeedMps,this.chaseSpeed+(this.cfg.chaseAccelerationMps2??8)*dt);
        this.chasePathRefreshTimer-=dt;
        if(this.chasePathRefreshTimer<=0){this.chasePathRefreshTimer=.3;this.directPath=los&&this.traversable(this.x,this.z,input.playerX,input.playerZ,walkCheck);}
        if (this.directPath&&los) {
          this.steerToward(input.playerX, input.playerZ, this.chaseSpeed, dt, walkCheck);
        } else {

          if (this.pathQueue.length === 0 || this.stateTimer% .3<dt) {
            this.chasePathRefreshTimer = 0.45;
            const playerNode = this.findNearestWaypoint(input.playerX, input.playerZ);
            this.setTargetWaypoint(playerNode);
          }
          if (this.pathQueue.length > 0) {
            this.followCurrentPath(this.chaseSpeed, dt, walkCheck);
          } else {
            this.steerToward(input.playerX, input.playerZ, this.chaseSpeed, dt, walkCheck);
          }
        }
        break;
      }

      case 'GRABBING': {
        const toPlayerX = input.playerX - this.x;
        const toPlayerZ = input.playerZ - this.z;
        if (distToPlayer > 0.05) {
          this.yaw = rotateTowardAngle(
            this.yaw,
            Math.atan2(toPlayerX, toPlayerZ),
            this.cfg.turnRateRadPerSec * 1.6 * dt,
          );
        }
        // Contact locks the interaction in place. Invalid contact cancels pending attack.
        if(!los||input.playerInVehicle||distToPlayer>this.cfg.grabRangeM+.8||!this.traversable(this.x,this.z,input.playerX,input.playerZ,walkCheck)){
          this.transitionTo('RECOVERING');break;
        }
        if (this.grabPhase === 'neck-grab') {
          if (this.stateTimer >= this.cfg.grabHoldDurationSec) {
            this.grabPhase = 'player-fall';
            this.grabSeq += 1;
            this.grabFallProgress = 0;
            this.stateTimer = 0;
            this.stateDuration = this.cfg.playerFallDurationSec;
            this.emitAudioCue('evil-laugh');
          }
        } else if (this.grabPhase === 'player-fall') {
          this.grabFallProgress = Math.min(
            1,
            this.stateTimer / Math.max(0.2, this.cfg.playerFallDurationSec * 0.45),
          );
          if (this.stateTimer >= this.cfg.playerFallDurationSec) {
            this.playerKilled=true;
            const esc = this.pickEscapeWaypoint(input.playerX, input.playerZ);
            this.homeWaypointId = esc.id;
            this.transitionTo('RECOVERING');
            this.setTargetWaypoint(esc);
          }
        }
        break;
      }

      case 'RECOVERING': {
        const escDone = this.followCurrentPath(this.cfg.returnSpeedMps, dt, walkCheck);
        if (escDone || this.stateTimer >= this.cfg.recoverDurationSec) {
          this.scareCooldownTimer = Math.max(this.scareCooldownTimer, this.cfg.cooldownDurationSec);
          this.encounterCooldownTimer = Math.max(
            this.encounterCooldownTimer,
            this.cfg.encounterCooldownSec,
          );
          this.transitionTo('COOLDOWN');
        }
        break;
      }

      case 'RETURNING_HOME': {
        const homeArrived = this.followCurrentPath(this.cfg.returnSpeedMps, dt, walkCheck);
        if (homeArrived || this.stateTimer >= 12) {
          if (this.encounterCooldownTimer > 0.35 || this.scareCooldownTimer > 0.35) {
            this.transitionTo('COOLDOWN');
          } else {
            this.transitionTo('HIDING');
          }
        }
        break;
      }

      case 'COOLDOWN': {
        if (
          (this.encounterCooldownTimer <= 0 && this.scareCooldownTimer <= 0) ||
          this.stateTimer >= this.stateDuration
        ) {
          this.encounterCooldownTimer = 0;
          this.scareCooldownTimer = 0;
          if (this.cyclePendingReset) {
            this.resetEncounterCycle(distToPlayer);
          }
          this.transitionTo('HIDING');
        }
        break;
      }
    }

    return this.getSnapshot();
  }

  /** Programmatic trigger helper for automated verification tests and dev diagnostics. */
  public forceStateForTest(nextState: GhostAiState): void {
    this.transitionTo(nextState);
  }

  public getSnapshot(): GhostAiSnapshot {
    return {
      state: this.state,
      homeProtected:this.homeProtected,
      playerKilled:this.playerKilled,
      chaseSpeed:this.chaseSpeed,
      attackEnabled:!this.homeProtected&&!this.safeCooldown&&(this.state==='CHASING'||this.state==='GRABBING'),
      collisionEnabled:!this.safeCooldown&&this.state!=='DORMANT'&&this.state!=='DESPAWNING',
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      opacity: this.opacity,
      visible: this.state !== 'DORMANT' && this.opacity > 0.01,
      activeClip: this.getActiveClipDirective(),
      currentWaypointId: this.currentWaypointId,
      targetWaypointId: this.targetWaypointId,
      scareTriggerCount: this.scareTriggerCount,
      crossingCount: this.crossingCount,
      fallTriggerCount: this.fallTriggerCount,
      encounterCount: this.encounterCount,
      chaseThreshold: this.chaseThreshold,
      encounterCycleCount: this.encounterCycleCount,
      chaseTriggerCount: this.chaseTriggerCount,
      grabCount: this.grabCount,
      playerInsideEncounterZone: this.playerInsideEncounterZone,
      audioCue: this.lastAudioCue,
      grabInteraction: {
        active: this.state === 'GRABBING' && this.grabPhase !== 'none',
        phase: this.state === 'GRABBING' ? this.grabPhase : 'none',
        seq: this.grabSeq,
        ghostX: this.x,
        ghostZ: this.z,
        fallProgress: this.state === 'GRABBING' ? this.grabFallProgress : 0,
      },
      distToPlayerM: this.lastDistToPlayer,
      hasLineOfSight: this.lastHasLos,
    };
  }
}
