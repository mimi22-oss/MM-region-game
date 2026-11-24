import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { angle, toWorld, ward } from '../data/ward.ts';
import { canStandHighlandPlateau, highlandTreeBlocks } from './highlandPlateauWorld.ts';
import {
  clearWildlifeActors,
  computeWildlifeAvoidance,
  isWildlifeStepClear,
  removeWildlifeActor,
  upsertWildlifeActor,
  type AvoidanceOut,
} from './mountainWildlifeAvoidance.ts';
import { buildMountainDeerSpawns, type MountainDeerSpawn } from './mountainDeerPool.ts';
import { buildMountainRabbitSpawns, type MountainRabbitSpawn } from './mountainRabbitPool.ts';
import {
  TIGER_AGGRO_RADIUS_M,
  TIGER_ATTACK_DELAY_MAX_SEC,
  TIGER_ATTACK_DELAY_MIN_SEC,
  TIGER_COLLAPSE_HIDE_SEC,
  TIGER_GIVEUP_RADIUS_M,
  TIGER_HIT_RANGE_M,
  TIGER_POUNCE_RANGE_M,
  TIGER_POUNCE_SEC,
  TIGER_TELEGRAPH_SEC,
  TIGER_WARN_RADIUS_M,
  applyTigerAttackToPlayer,
  getCombatTiger,
  markCombatTigerSlotActive,
  markCombatTigerSlotInactive,
  playTigerCombatRoar,
  registerMountainTigerSpawns,
} from './mountainTigerCombat.ts';
import {
  FOREGROUND_MOUNTAIN_STEP,
  mountainMeshSurface,
  mountainSlopePitchRoll,
  type MountainMeshSurface,
  type TerrainPeak,
} from './mountainTerrain.ts';
import {
  getMountainTigerAssetCache,
  TIGER_ANKLE,
  TIGER_HEAD,
  TIGER_LEGS,
  TIGER_TAIL,
  type MountainTigerAssetCache,
} from './mountainTigerAssets.ts';
import { mobileQuality } from './sceneBudget.ts';
import { canStandTaungphilaFeatures, isOnTaungphilaRoad } from './taungphilaWorld.ts';
import { countNearestInRange, FixedObjectPool, updatePooledInstances } from './treeResourcePool.ts';
import { isOnWeipulaRoad } from './weipulaClimb.ts';

/**
 * ============================================================================
 * Mountain Tigers Regional Territory Spawner & Animated Fixed Object Pool
 * (`တောင်ပေါ် ကျားကြီးများ — ၂ ကောင် တစ်နေရာ နှင့် ၁ ကောင် တစ်နေရာ`)
 * ============================================================================
 * Guarantees:
 * - Territories are a deterministic mix of 2-tiger pairs (`pair`, spaced 3.5–5m
 *   apart) and 1-tiger solitary dens (`solo`).
 * - EVERY tiger spawn sits STRICTLY >= TIGER_PREY_MIN_SEPARATION_M (20m) away
 *   from BOTH mountain rabbits AND mountain deer herds!
 * - Strictly clear of highways, ponds, building interiors, and peak center cores.
 * - Uses Singleton Memory Reference Cache + Fixed Object Pool (zero duplication).
 */

export const TIGER_PREY_MIN_SEPARATION_M = 20;
export const TIGER_PAIR_MIN_DIST_M = 3.5;
export const TIGER_PAIR_MAX_DIST_M = 5.0;
export const TIGER_WANDER_MAX_RADIUS_M = 12;

export interface MountainTigerSpawn {
  readonly id: string;
  readonly territoryId: string;
  readonly groupKind: 'pair' | 'solo';
  readonly homeU: number;
  readonly homeV: number;
  readonly homeX: number;
  readonly homeZ: number;
  readonly homeY: number;
  readonly homeDu: number;
  readonly homeDv: number;
  readonly wanderRadius: number;
  readonly coatTintIndex: number;
  readonly scale: number;
  readonly phaseOffset: number;
}

export interface MountainTigerCombatContext {
  readonly playerX: number;
  readonly playerY: number;
  readonly playerZ: number;
  readonly canEngage: boolean;
  readonly cameraX?: number;
  readonly cameraZ?: number;
}

export interface TigerHpBarAnchor {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
}

interface ActiveTigerRuntime {
  spawnIdx: number;
  x: number;
  y: number;
  z: number;
  groundDu: number;
  groundDv: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  state: 'prowl' | 'rest' | 'warn' | 'chase' | 'telegraph' | 'pounce' | 'stagger' | 'defeated';
  stateTimer: number;
  attackDelay: number;
  pounceElapsed: number;
  pounceDirX: number;
  pounceDirZ: number;
  pounceHitChecked: boolean;
  pounceLiftY: number;
  collapseBlend: number;
  warnRoared: boolean;
  gaitPhase: number;
  restBlend: number;
  speed: number;
}

export interface MountainTigerPoolConfig {
  readonly capacity: number;
  readonly syncMoveThreshold?: number;
  readonly activeRadius?: number;
}

export const DEFAULT_MOUNTAIN_TIGER_POOL_CONFIG: MountainTigerPoolConfig = mobileQuality
  ? { capacity: 8, syncMoveThreshold: 24, activeRadius: 195 }
  : { capacity: 16, syncMoveThreshold: 20, activeRadius: 260 };

const TIGER_COAT_TINTS = ['#ffffff', '#f5e4d2', '#ffe9d6'] as const;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically scatters wild mountain tiger territories — alternating
 * 2-tiger pairs (`၂ ကောင် တစ်နေရာ`, 3.5–5m apart) and 1-tiger solitary dens
 * (`၁ ကောင် တစ်နေရာ`) — across mountain zones STRICTLY >= 20m away from
 * EVERY rabbit AND EVERY deer herd!
 */
export function buildMountainTigerSpawns(
  peaks: readonly TerrainPeak[] = [...ward.mountains, ...ward.weipula.peaks],
  rabbitSpawns: readonly MountainRabbitSpawn[] = buildMountainRabbitSpawns(peaks),
  deerSpawns: readonly MountainDeerSpawn[] = buildMountainDeerSpawns(peaks),
): MountainTigerSpawn[] {
  const rng = createRng(2026112288);
  const spawns: MountainTigerSpawn[] = [];
  const territoryCenters: Array<{ x: number; z: number }> = [];

  const minPreyDistSq = TIGER_PREY_MIN_SEPARATION_M * TIGER_PREY_MIN_SEPARATION_M;
  const minTerritoryGapSq = 110 * 110;

  const isFarFromAllPrey = (x: number, z: number): boolean => {
    for (let i = 0; i < rabbitSpawns.length; i++) {
      const dx = x - rabbitSpawns[i].homeX;
      const dz = z - rabbitSpawns[i].homeZ;
      if (dx * dx + dz * dz < minPreyDistSq) return false;
    }
    for (let i = 0; i < deerSpawns.length; i++) {
      const dx = x - deerSpawns[i].homeX;
      const dz = z - deerSpawns[i].homeZ;
      if (dx * dx + dz * dz < minPreyDistSq) return false;
    }
    return true;
  };

  const MAX_TIGER_SPAWN_SLOPE = 0.55;

  const isValidTigerSpot = (
    u: number,
    v: number,
  ): { ok: boolean; x: number; z: number; y: number; du: number; dv: number } => {
    const surf = mountainMeshSurface(u, v, peaks);
    const y = surf.y;
    if (y < 14 || surf.slope > MAX_TIGER_SPAWN_SLOPE) return { ok: false, x: 0, z: 0, y: 0, du: 0, dv: 0 };
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const obsR = (p.obstacleRadius ?? p.radius) + 2.0;
      const du = u - p.u;
      const dv = v - p.v;
      if (du * du + dv * dv < obsR * obsR) return { ok: false, x: 0, z: 0, y: 0, du: 0, dv: 0 };
    }
    const w = toWorld(u, v);
    if (isOnTaungphilaRoad(w.x, w.z, -8) || isOnWeipulaRoad(w.x, w.z, -8)) {
      return { ok: false, x: 0, z: 0, y: 0, du: 0, dv: 0 };
    }
    if (!canStandTaungphilaFeatures(w.x, w.z, 1.2, false)) {
      return { ok: false, x: 0, z: 0, y: 0, du: 0, dv: 0 };
    }
    if (!canStandHighlandPlateau(w.x, w.z, 1.2, false) || highlandTreeBlocks(w.x, w.z, 0.9)) {
      return { ok: false, x: 0, z: 0, y: 0, du: 0, dv: 0 };
    }
    if (!isFarFromAllPrey(w.x, w.z)) {
      return { ok: false, x: 0, z: 0, y: 0, du: 0, dv: 0 };
    }
    return { ok: true, x: w.x, z: w.z, y, du: surf.du, dv: surf.dv };
  };

  // Mountain tiger territories kept strictly >= 20m from every rabbit & deer:
  // 1. Taungphila & Highland Outer Wilds (quiet clearings away from prey herds)
  // 2. Far-West Alpine Chin Massif (west & south-west of Maha Weipula)
  // 3. Deep East Chin Range Peaks (east of AH1 & Maha Weipula pass)
  // 4. Outer Far-West Highland Rim
  // 5. High Maha Weipula Southern/Upper Alpine Ridges
  const territoryZones: Array<{
    name: string;
    targetTerritories: number;
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
  }> = [
    { name: 'taungphila-wilds', targetTerritories: 4, uMin: -720, uMax: -460, vMin: 40, vMax: 480 },
    { name: 'highland-wilds', targetTerritories: 8, uMin: -1280, uMax: -740, vMin: 140, vMax: 4460 },
    { name: 'far-west-alpine', targetTerritories: 8, uMin: -3350, uMax: -2320, vMin: 5650, vMax: 6950 },
    { name: 'east-chin-range', targetTerritories: 8, uMin: 240, uMax: 1880, vMin: 4820, vMax: 5950 },
    { name: 'outer-west-rim', targetTerritories: 6, uMin: -1430, uMax: -1290, vMin: 260, vMax: 4380 },
    { name: 'weipula-upper-flank', targetTerritories: 4, uMin: -2200, uMax: -800, vMin: 5780, vMax: 6750 },
  ];

  let territoryNum = 0;

  for (const zone of territoryZones) {
    let addedTerritories = 0;
    let attempts = 0;
    while (addedTerritories < zone.targetTerritories && attempts < zone.targetTerritories * 56) {
      attempts++;
      const u = zone.uMin + rng() * (zone.uMax - zone.uMin);
      const v = zone.vMin + rng() * (zone.vMax - zone.vMin);
      const center = isValidTigerSpot(u, v);
      if (!center.ok) continue;

      // Keep tiger territories well-spaced from each other
      let tooClose = false;
      for (let i = 0; i < territoryCenters.length; i++) {
        const dx = center.x - territoryCenters[i].x;
        const dz = center.z - territoryCenters[i].z;
        if (dx * dx + dz * dz < minTerritoryGapSq) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Alternate strictly between 2-tiger Pair (`၂ ကောင် တစ်နေရာ`) & 1-tiger Solo (`၁ ကောင် တစ်နေရာ`)!
      const isPair = territoryNum % 2 === 0;
      const territoryId = `tiger-territory-${zone.name}-${++territoryNum}`;

      if (isPair) {
        // Place mate strictly 3.5–5.0m away in the exact same territory (also verified >= 20m from prey!)
        let mateSpot: { ok: boolean; x: number; z: number; y: number; du: number; dv: number } = {
          ok: false,
          x: 0,
          z: 0,
          y: 0,
          du: 0,
          dv: 0,
        };
        let mateU = u;
        let mateV = v;
        for (let mTry = 0; mTry < 16; mTry++) {
          const ang = rng() * Math.PI * 2;
          const dist =
            TIGER_PAIR_MIN_DIST_M + rng() * (TIGER_PAIR_MAX_DIST_M - TIGER_PAIR_MIN_DIST_M);
          mateU = u + Math.cos(ang) * dist;
          mateV = v + Math.sin(ang) * dist;
          mateSpot = isValidTigerSpot(mateU, mateV);
          if (mateSpot.ok) break;
        }
        if (!mateSpot.ok) continue;

        territoryCenters.push({ x: center.x, z: center.z });
        spawns.push(
          {
            id: `mtn-tiger-${territoryId}-a`,
            territoryId,
            groupKind: 'pair',
            homeU: u,
            homeV: v,
            homeX: center.x,
            homeZ: center.z,
            homeY: center.y,
            homeDu: center.du,
            homeDv: center.dv,
            wanderRadius: 6 + rng() * 4,
            coatTintIndex: 0,
            scale: 1.06 + rng() * 0.14,
            phaseOffset: rng() * Math.PI * 2,
          },
          {
            id: `mtn-tiger-${territoryId}-b`,
            territoryId,
            groupKind: 'pair',
            homeU: mateU,
            homeV: mateV,
            homeX: mateSpot.x,
            homeZ: mateSpot.z,
            homeY: mateSpot.y,
            homeDu: mateSpot.du,
            homeDv: mateSpot.dv,
            wanderRadius: 6 + rng() * 4,
            coatTintIndex: 1,
            scale: 0.96 + rng() * 0.12,
            phaseOffset: rng() * Math.PI * 2,
          },
        );
      } else {
        territoryCenters.push({ x: center.x, z: center.z });
        spawns.push({
          id: `mtn-tiger-${territoryId}-solo`,
          territoryId,
          groupKind: 'solo',
          homeU: u,
          homeV: v,
          homeX: center.x,
          homeZ: center.z,
          homeY: center.y,
          homeDu: center.du,
          homeDv: center.dv,
          wanderRadius: 7 + rng() * 4,
          coatTintIndex: territoryNum % TIGER_COAT_TINTS.length,
          scale: 1.1 + rng() * 0.14,
          phaseOffset: rng() * Math.PI * 2,
        });
      }

      addedTerritories++;
    }
  }

  return spawns;
}

const scratchMat = new Matrix4();
const scratchZeroMat = new Matrix4().makeScale(0, 0, 0);
const scratchPos = new Vector3();
const scratchOffset = new Vector3();
const scratchQuat = new Quaternion();
const scratchLocalQuat = new Quaternion();
const scratchScale = new Vector3();
const scratchEuler = new Euler();
const scratchColor = new Color();
const scratchSurface: MountainMeshSurface = { y: 0, du: 0, dv: 0, slope: 0 };
const scratchTilt = { pitch: 0, roll: 0 };
const MAX_TIGER_STEP_SLOPE_RUNTIME = 0.62;

type ScoredIdx = { idx: number; distSq: number };

export class MountainTigerFixedPool {
  readonly cache: MountainTigerAssetCache;
  readonly config: MountainTigerPoolConfig;
  readonly spawns: readonly MountainTigerSpawn[];
  readonly pool: FixedObjectPool<ActiveTigerRuntime>;

  private readonly bodyMesh: InstancedMesh;
  private readonly headMesh: InstancedMesh;
  private readonly tailMesh: InstancedMesh;
  private readonly legMeshes: readonly InstancedMesh[];
  private readonly pawMeshes: readonly InstancedMesh[];
  private readonly parts: readonly InstancedMesh[];

  private lastFocusX = Number.NaN;
  private lastFocusZ = Number.NaN;
  private elapsed = 0;
  private readonly scored: ScoredIdx[] = [];
  private readonly desiredIds: string[] = [];
  private readonly desiredById = new Map<string, number>();

  constructor(
    spawns: readonly MountainTigerSpawn[],
    config: MountainTigerPoolConfig = DEFAULT_MOUNTAIN_TIGER_POOL_CONFIG,
  ) {
    this.cache = getMountainTigerAssetCache();
    this.config = config;
    this.spawns = spawns;
    registerMountainTigerSpawns(spawns);

    const cap = Math.min(config.capacity, Math.max(1, spawns.length));
    this.pool = new FixedObjectPool<ActiveTigerRuntime>(cap, () => ({
      spawnIdx: -1,
      x: 0,
      y: 0,
      z: 0,
      groundDu: 0,
      groundDv: 0,
      yaw: 0,
      targetX: 0,
      targetZ: 0,
      state: 'prowl',
      stateTimer: 2.5,
      attackDelay: 1.2,
      pounceElapsed: 0,
      pounceDirX: 0,
      pounceDirZ: 1,
      pounceHitChecked: false,
      pounceLiftY: 0,
      collapseBlend: 0,
      warnRoared: false,
      gaitPhase: 0,
      restBlend: 0,
      speed: 1.8,
    }));

    const c = this.cache;
    this.bodyMesh = new InstancedMesh(c.bodyGeo, c.coatMat, cap);
    this.headMesh = new InstancedMesh(c.headGeo, c.detailMat, cap);
    this.tailMesh = new InstancedMesh(c.tailGeo, c.detailMat, cap);
    this.legMeshes = TIGER_LEGS.map(({ hind }) =>
      new InstancedMesh(hind ? c.hindLegGeo : c.legGeo, c.coatMat, cap),
    );
    this.pawMeshes = TIGER_LEGS.map(() => new InstancedMesh(c.pawGeo, c.detailMat, cap));
    this.parts = [this.bodyMesh, this.headMesh, this.tailMesh, ...this.legMeshes, ...this.pawMeshes];

    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.count = 0;
      m.visible = false;
      for (let i = 0; i < cap; i++) m.setMatrixAt(i, scratchZeroMat);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  meshes(): readonly InstancedMesh[] {
    return this.parts;
  }

  private hideSlot(idx: number): void {
    for (const m of this.meshes()) m.setMatrixAt(idx, scratchZeroMat);
  }

  private applyCoatTint(idx: number, tintIndex: number): void {
    scratchColor.set(TIGER_COAT_TINTS[tintIndex % TIGER_COAT_TINTS.length]);
    this.bodyMesh.setColorAt(idx, scratchColor);
    for (const leg of this.legMeshes) leg.setColorAt(idx, scratchColor);
  }

  syncToFocus(focusX: number, focusZ: number, force = false): boolean {
    const threshold = this.config.syncMoveThreshold ?? 20;
    if (
      !force &&
      Number.isFinite(this.lastFocusX) &&
      Math.hypot(focusX - this.lastFocusX, focusZ - this.lastFocusZ) < threshold
    ) {
      return false;
    }
    this.lastFocusX = focusX;
    this.lastFocusZ = focusZ;

    const n = this.spawns.length;
    if (this.scored.length < n) {
      for (let i = this.scored.length; i < n; i++) this.scored.push({ idx: i, distSq: 0 });
    } else if (this.scored.length > n) {
      this.scored.length = n;
    }
    for (let i = 0; i < n; i++) {
      const dx = this.spawns[i].homeX - focusX;
      const dz = this.spawns[i].homeZ - focusZ;
      this.scored[i].idx = i;
      this.scored[i].distSq = dx * dx + dz * dz;
    }
    this.scored.sort((a, b) => a.distSq - b.distSq);

    const take = countNearestInRange(this.scored, this.pool.capacity, this.config.activeRadius);
    this.desiredIds.length = take;
    this.desiredById.clear();
    for (let i = 0; i < take; i++) {
      const srcIdx = this.scored[i].idx;
      const id = this.spawns[srcIdx].id;
      this.desiredIds[i] = id;
      this.desiredById.set(id, srcIdx);
    }

    const { assigned, released } = this.pool.syncActive(
      this.desiredIds,
      (slot) => {
        const srcIdx = this.desiredById.get(slot.ownerId!)!;
        const sp = this.spawns[srcIdx];
        const r = slot.value;
        const combat = getCombatTiger(sp.id);
        r.spawnIdx = srcIdx;
        r.x = sp.homeX;
        r.y = sp.homeY;
        r.z = sp.homeZ;
        r.groundDu = sp.homeDu;
        r.groundDv = sp.homeDv;
        r.yaw = sp.phaseOffset;
        r.targetX = sp.homeX + Math.sin(sp.phaseOffset) * 5;
        r.targetZ = sp.homeZ + Math.cos(sp.phaseOffset) * 5;
        r.state = combat && !combat.alive ? 'defeated' : srcIdx % 2 === 0 ? 'prowl' : 'rest';
        r.stateTimer = 2.5 + (srcIdx % 4) * 1.1;
        r.attackDelay = TIGER_ATTACK_DELAY_MIN_SEC + (srcIdx % 3) * 0.45;
        r.pounceElapsed = 0;
        r.pounceDirX = 0;
        r.pounceDirZ = 1;
        r.pounceHitChecked = false;
        r.pounceLiftY = 0;
        r.collapseBlend = combat && !combat.alive ? 1 : 0;
        r.warnRoared = false;
        r.gaitPhase = (srcIdx * 0.23) % 1;
        r.restBlend = r.state === 'rest' ? 1 : 0;
        r.speed = 1.65 + (srcIdx % 3) * 0.28;
        if (combat && !combat.alive && combat.defeatedTimer >= TIGER_COLLAPSE_HIDE_SEC) {
          removeWildlifeActor(sp.id);
          markCombatTigerSlotInactive(sp.id);
          this.hideSlot(slot.index);
        } else {
          upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, 1.2 * sp.scale);
          markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
          this.applyCoatTint(slot.index, sp.coatTintIndex);
          this.writeSlotMatrices(slot.index, r, sp);
        }
      },
      (slot) => {
        if (slot.value.spawnIdx >= 0) {
          const id = this.spawns[slot.value.spawnIdx].id;
          removeWildlifeActor(id);
          markCombatTigerSlotInactive(id);
        }
        slot.value.spawnIdx = -1;
        this.hideSlot(slot.index);
      },
    );

    if (assigned > 0 || released > 0) {
      updatePooledInstances(this.meshes(), this.pool.renderCount);
    }
    return true;
  }

  step(
    rawDt: number,
    focusX: number,
    focusZ: number,
    peaks: readonly TerrainPeak[],
    combatCtx?: MountainTigerCombatContext,
  ): void {
    const dt = Math.min(0.05, Math.max(0, rawDt));
    this.syncToFocus(focusX, focusZ);
    if (dt <= 0 || this.pool.activeCount === 0) return;

    this.elapsed += dt;
    let updatedAny = false;
    const avoid: AvoidanceOut = { steerX: 0, steerZ: 0, blocked: false };

    const turnToward = (r: ActiveTigerRuntime, desiredYaw: number, rate: number) => {
      let diff = desiredYaw - r.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      r.yaw += diff * Math.min(1, dt * rate);
    };

    const sampleDelay = () =>
      TIGER_ATTACK_DELAY_MIN_SEC +
      Math.random() * (TIGER_ATTACK_DELAY_MAX_SEC - TIGER_ATTACK_DELAY_MIN_SEC);

    this.pool.forEachActive((slot) => {
      const r = slot.value;
      if (r.spawnIdx < 0) return;
      const sp = this.spawns[r.spawnIdx];
      // Skip per-frame animation & GPU matrix uploads when tiger is far outside visible range (> 260m)
      const dxFocus = r.x - focusX;
      const dzFocus = r.z - focusZ;
      if (dxFocus * dxFocus + dzFocus * dzFocus > 260 * 260) return;
      const selfRadius = 1.2 * sp.scale;
      const combat = getCombatTiger(sp.id);

      // Handle defeated tiger collapse & clean hiding
      if (combat && !combat.alive) {
        if (r.state !== 'defeated') {
          r.state = 'defeated';
          r.pounceLiftY = 0;
          removeWildlifeActor(sp.id);
          markCombatTigerSlotInactive(sp.id);
        }
        combat.defeatedTimer += dt;
        r.collapseBlend = Math.min(1, combat.defeatedTimer / 0.55);
        if (combat.defeatedTimer >= TIGER_COLLAPSE_HIDE_SEC) {
          this.hideSlot(slot.index);
        } else {
          this.writeSlotMatrices(slot.index, r, sp);
        }
        updatedAny = true;
        return;
      }

      if (combat) {
        if (combat.aggroTimer > 0) combat.aggroTimer = Math.max(0, combat.aggroTimer - dt);
        if (combat.hitFlashTimer > 0) combat.hitFlashTimer = Math.max(0, combat.hitFlashTimer - dt);
        if (combat.staggerTimer > 0) {
          combat.staggerTimer = Math.max(0, combat.staggerTimer - dt);
          if (r.state !== 'stagger') {
            r.state = 'stagger';
            r.pounceLiftY = 0;
            r.pounceElapsed = 0;
            r.attackDelay = Math.max(r.attackDelay, 0.9);
          }
        }
      }

      // Open-world combat AI when player context is provided
      const px = combatCtx ? combatCtx.playerX : focusX;
      const py = combatCtx ? combatCtx.playerY : r.y;
      const pz = combatCtx ? combatCtx.playerZ : focusZ;
      const dxP = px - r.x;
      const dzP = pz - r.z;
      const distToPlayer = Math.hypot(dxP, dzP);
      const distFromHome = Math.hypot(r.x - sp.homeX, r.z - sp.homeZ);
      const playerOnBoulderOrHigh = combatCtx ? py > r.y + 0.65 : false;
      const canEngage = Boolean(combatCtx?.canEngage);
      const aggroActive = Boolean(combat && combat.aggroTimer > 0);

      if (r.state === 'stagger') {
        r.pounceLiftY = 0;
        r.restBlend += (0.45 - r.restBlend) * Math.min(1, dt * 8);
        if (!combat || combat.staggerTimer <= 0) {
          r.state = canEngage && (distToPlayer <= TIGER_AGGRO_RADIUS_M || aggroActive) ? 'chase' : 'prowl';
        }
        upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, selfRadius);
        markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
        this.writeSlotMatrices(slot.index, r, sp);
        updatedAny = true;
        return;
      }

      if (canEngage && (distToPlayer <= TIGER_WARN_RADIUS_M || aggroActive) && distFromHome <= TIGER_GIVEUP_RADIUS_M) {
        const yawToPlayer = Math.atan2(dxP, dzP);

        if (r.state === 'pounce') {
          r.pounceElapsed += dt;
          const pt = Math.min(1, r.pounceElapsed / TIGER_POUNCE_SEC);
          r.pounceLiftY = Math.sin(Math.PI * pt) * 0.68;
          r.restBlend += (0.15 - r.restBlend) * Math.min(1, dt * 10);
          turnToward(r, Math.atan2(r.pounceDirX, r.pounceDirZ), 12);

          const lungeStep = 7.6 * dt;
          const nx = r.x + r.pounceDirX * lungeStep;
          const nz = r.z + r.pounceDirZ * lungeStep;
          const nu = nx * cosA - nz * sinA;
          const nv = nx * sinA + nz * cosA;
          const surf = mountainMeshSurface(nu, nv, peaks, FOREGROUND_MOUNTAIN_STEP, scratchSurface);
          if (
            surf.y >= 12 &&
            surf.slope <= MAX_TIGER_STEP_SLOPE_RUNTIME &&
            canStandHighlandPlateau(nx, nz, 0.75, false) &&
            !highlandTreeBlocks(nx, nz, 0.55) &&
            !isOnTaungphilaRoad(nx, nz, -4) &&
            !isOnWeipulaRoad(nx, nz, -4)
          ) {
            r.x = nx;
            r.z = nz;
            r.y = surf.y;
            r.groundDu = surf.du;
            r.groundDv = surf.dv;
          }

          if (!r.pounceHitChecked && pt >= 0.45) {
            r.pounceHitChecked = true;
            const hitDist = Math.hypot(px - r.x, pz - r.z);
            const verticalGap = Math.abs(py - r.y);
            if (hitDist <= TIGER_HIT_RANGE_M && verticalGap <= 0.85) {
              applyTigerAttackToPlayer({
                tigerId: sp.id,
                tigerX: r.x,
                tigerZ: r.z,
                playerX: px,
                playerZ: pz,
                cameraX: combatCtx?.cameraX,
                cameraZ: combatCtx?.cameraZ,
              });
            }
          }

          if (pt >= 1) {
            r.state = 'chase';
            r.pounceElapsed = 0;
            r.pounceLiftY = 0;
            r.attackDelay = sampleDelay();
          }

          upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, selfRadius);
          markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
          this.writeSlotMatrices(slot.index, r, sp);
          updatedAny = true;
          return;
        }

        if (r.state === 'telegraph') {
          r.stateTimer -= dt;
          r.pounceLiftY = 0;
          r.restBlend += (0.85 - r.restBlend) * Math.min(1, dt * 10);
          turnToward(r, yawToPlayer, 10);
          if (playerOnBoulderOrHigh || distToPlayer > TIGER_POUNCE_RANGE_M + 2.2) {
            r.state = 'chase';
            r.attackDelay = 0.7;
          } else if (r.stateTimer <= 0) {
            r.state = 'pounce';
            r.pounceElapsed = 0;
            r.pounceHitChecked = false;
            const len = Math.max(0.001, distToPlayer);
            r.pounceDirX = dxP / len;
            r.pounceDirZ = dzP / len;
            playTigerCombatRoar(0.86);
          }
          upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, selfRadius);
          markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
          this.writeSlotMatrices(slot.index, r, sp);
          updatedAny = true;
          return;
        }

        // Entering warning zone (16m..24m) before full aggro
        if (distToPlayer > TIGER_AGGRO_RADIUS_M && !aggroActive) {
          r.state = 'warn';
          r.pounceLiftY = 0;
          r.restBlend += (0.55 - r.restBlend) * Math.min(1, dt * 4.5);
          turnToward(r, yawToPlayer, 6);
          if (!r.warnRoared) {
            r.warnRoared = true;
            playTigerCombatRoar(0.75);
          }
          upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, selfRadius);
          markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
          this.writeSlotMatrices(slot.index, r, sp);
          updatedAny = true;
          return;
        }

        // Active chase!
        if (r.state !== 'chase') {
          r.state = 'chase';
          r.attackDelay = Math.max(0.75, sampleDelay() * 0.75);
          if (!r.warnRoared) {
            r.warnRoared = true;
            playTigerCombatRoar(0.82);
          }
        }
        r.pounceLiftY = 0;
        r.restBlend += (0 - r.restBlend) * Math.min(1, dt * 6);
        r.attackDelay = Math.max(0, r.attackDelay - dt);

        if (distToPlayer <= TIGER_POUNCE_RANGE_M && !playerOnBoulderOrHigh && r.attackDelay <= 0) {
          r.state = 'telegraph';
          r.stateTimer = TIGER_TELEGRAPH_SEC;
          playTigerCombatRoar(0.8);
        } else {
          computeWildlifeAvoidance(sp.id, r.x, r.z, selfRadius, px, pz, avoid);
          const stopDist = playerOnBoulderOrHigh ? 2.8 : 2.15;
          if (distToPlayer > stopDist) {
            const goalDirX = dxP / Math.max(0.001, distToPlayer);
            const goalDirZ = dzP / Math.max(0.001, distToPlayer);
            const blendX = goalDirX + avoid.steerX * 0.85;
            const blendZ = goalDirZ + avoid.steerZ * 0.85;
            turnToward(r, Math.atan2(blendX, blendZ), 7.5);

            const chaseSpeed = sp.groupKind === 'solo' ? 5.6 : 5.2;
            const stepDist = Math.min(distToPlayer - stopDist + 0.15, chaseSpeed * dt);
            const tryAngles = [0, 0.55, -0.55, 1.1, -1.1];
            for (let a = 0; a < tryAngles.length; a++) {
              const yawTry = r.yaw + tryAngles[a];
              const nx = r.x + Math.sin(yawTry) * stepDist;
              const nz = r.z + Math.cos(yawTry) * stepDist;
              const nu = nx * cosA - nz * sinA;
              const nv = nx * sinA + nz * cosA;
              const surf = mountainMeshSurface(nu, nv, peaks, FOREGROUND_MOUNTAIN_STEP, scratchSurface);
              if (
                surf.y >= 12 &&
                surf.slope <= MAX_TIGER_STEP_SLOPE_RUNTIME &&
                Math.hypot(nx - sp.homeX, nz - sp.homeZ) <= TIGER_GIVEUP_RADIUS_M &&
                canStandHighlandPlateau(nx, nz, 0.8, false) &&
                !highlandTreeBlocks(nx, nz, 0.6) &&
                !isOnTaungphilaRoad(nx, nz, -4) &&
                !isOnWeipulaRoad(nx, nz, -4)
              ) {
                r.x = nx;
                r.z = nz;
                if (a > 0) r.yaw = yawTry;
                r.y = surf.y;
                r.groundDu = surf.du;
                r.groundDv = surf.dv;
                r.gaitPhase = (r.gaitPhase + stepDist * 0.85) % 1;
                break;
              }
            }
          } else {
            // Circle/face player while waiting out attackDelay or while player stands safely on boulder/inside house
            turnToward(r, yawToPlayer, 8);
          }
        }

        upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, selfRadius);
        markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
        this.writeSlotMatrices(slot.index, r, sp);
        updatedAny = true;
        return;
      }

      // Reset combat states back to normal territory patrol once player leaves territory
      if (r.state !== 'prowl' && r.state !== 'rest') {
        r.state = 'prowl';
        r.targetX = sp.homeX;
        r.targetZ = sp.homeZ;
        r.pounceLiftY = 0;
        r.warnRoared = false;
      } else if (distToPlayer > TIGER_WARN_RADIUS_M + 4) {
        r.warnRoared = false;
      }

      computeWildlifeAvoidance(sp.id, r.x, r.z, selfRadius, focusX, focusZ, avoid);

      const targetRest = r.state === 'rest' ? 1 : 0;
      r.restBlend += (targetRest - r.restBlend) * Math.min(1, dt * 2.8);

      if (r.state === 'prowl') {
        const dx = r.targetX - r.x;
        const dz = r.targetZ - r.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.55 || avoid.blocked) {
          const goalDirX = dist > 0.01 ? dx / dist : 0;
          const goalDirZ = dist > 0.01 ? dz / dist : 0;
          const blendX = goalDirX + avoid.steerX * 1.6;
          const blendZ = goalDirZ + avoid.steerZ * 1.6;
          const desiredYaw = Math.atan2(blendX, blendZ);
          turnToward(r, desiredYaw, 4.4);

          const stepDist = Math.min(Math.max(dist, 0.8), r.speed * dt);
          const tryAngles = [0, 0.75, -0.75, 1.4, -1.4];
          let moved = false;
          for (let a = 0; a < tryAngles.length; a++) {
            const yawTry = r.yaw + tryAngles[a];
            const nx = r.x + Math.sin(yawTry) * stepDist;
            const nz = r.z + Math.cos(yawTry) * stepDist;
            const nu = nx * cosA - nz * sinA;
            const nv = nx * sinA + nz * cosA;
            const surf = mountainMeshSurface(nu, nv, peaks, FOREGROUND_MOUNTAIN_STEP, scratchSurface);
            // Strictly remain inside territory patrol radius & never walk onto sheer cliffs or clip wildlife!
            if (
              surf.y >= 12 &&
              surf.slope <= MAX_TIGER_STEP_SLOPE_RUNTIME &&
              Math.hypot(nx - sp.homeX, nz - sp.homeZ) <= Math.max(sp.wanderRadius, distFromHome + 0.5) &&
              !isOnTaungphilaRoad(nx, nz, -4) &&
              !isOnWeipulaRoad(nx, nz, -4) &&
              canStandHighlandPlateau(nx, nz, 0.8, false) &&
              !highlandTreeBlocks(nx, nz, 0.65) &&
              isWildlifeStepClear(sp.id, nx, nz, selfRadius, focusX, focusZ)
            ) {
              r.x = nx;
              r.z = nz;
              if (a > 0) r.yaw = yawTry;
              r.y = surf.y;
              r.groundDu = surf.du;
              r.groundDv = surf.dv;
              r.gaitPhase = (r.gaitPhase + stepDist * 0.72) % 1;
              moved = true;
              break;
            }
          }
          if (!moved) {
            r.state = 'rest';
            r.stateTimer = 2.6;
          }
        } else {
          r.state = 'rest';
          r.stateTimer = 3.0 + (r.spawnIdx % 4) * 1.1;
        }
      } else {
        r.stateTimer -= dt;
        if (r.stateTimer <= 0 || avoid.blocked) {
          const nextAng = avoid.blocked
            ? Math.atan2(avoid.steerX, avoid.steerZ)
            : sp.phaseOffset + this.elapsed * 0.45 + r.spawnIdx * 1.93;
          const rad = sp.wanderRadius * (0.4 + ((r.spawnIdx * 11) % 6) * 0.1);
          r.targetX = sp.homeX + Math.sin(nextAng) * rad;
          r.targetZ = sp.homeZ + Math.cos(nextAng) * rad;
          r.state = 'prowl';
        }
      }

      upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, selfRadius);
      markCombatTigerSlotActive(sp.id, r.x, r.y, r.z, r.yaw);
      this.writeSlotMatrices(slot.index, r, sp);
      updatedAny = true;
    });

    if (updatedAny) {
      for (const m of this.meshes()) m.instanceMatrix.needsUpdate = true;
    }
  }

  /** Collects live tigers currently in combat or wounded so the scene can render overhead 3D HP bars. */
  collectCombatHpBars(out: TigerHpBarAnchor[]): TigerHpBarAnchor[] {
    out.length = 0;
    this.pool.forEachActive((slot) => {
      const r = slot.value;
      if (r.spawnIdx < 0) return;
      const sp = this.spawns[r.spawnIdx];
      const combat = getCombatTiger(sp.id);
      if (!combat || !combat.alive) return;
      const inCombat =
        combat.hp < combat.maxHp ||
        r.state === 'warn' ||
        r.state === 'chase' ||
        r.state === 'telegraph' ||
        r.state === 'pounce' ||
        r.state === 'stagger';
      if (!inCombat) return;
      out.push({
        id: sp.id,
        x: r.x,
        y: r.y + 1.55 * sp.scale + r.pounceLiftY,
        z: r.z,
        hp: combat.hp,
        maxHp: combat.maxHp,
      });
    });
    return out;
  }

  private writeSlotMatrices(idx: number, r: ActiveTigerRuntime, sp: MountainTigerSpawn): void {
    const s = sp.scale;
    const moving = r.state === 'prowl' || r.state === 'chase';
    const pouncing = r.state === 'pounce';
    const defeated = r.state === 'defeated';
    const crouchDrop = r.restBlend * 0.24 + (defeated ? r.collapseBlend * 0.42 : 0);
    const gait = r.gaitPhase * Math.PI * 2;
    const bodyBob = moving ? Math.cos(gait * 2) * (r.state === 'chase' ? 0.036 : 0.018) : 0;
    const tailSway = defeated ? 0 : Math.sin(this.elapsed * (r.state === 'chase' || r.state === 'telegraph' ? 5.2 : 2.4) + sp.phaseOffset) * 0.34;
    const headScan = r.state === 'rest' ? Math.sin(this.elapsed * 1.2 + sp.phaseOffset) * 0.32 : 0;
    const bodyPitch = pouncing ? -0.28 : r.state === 'telegraph' ? 0.14 : r.state === 'stagger' ? -0.18 : 0;
    const bodyRoll = defeated ? r.collapseBlend * (Math.PI * 0.48) : 0;

    const tilt = mountainSlopePitchRoll(r.groundDu, r.groundDv, cosA, sinA, r.yaw, scratchTilt, 0.44);
    scratchEuler.set(tilt.pitch + bodyPitch, r.yaw, tilt.roll + bodyRoll, 'YXZ');
    scratchQuat.setFromEuler(scratchEuler);

    const placePart = (
      mesh: InstancedMesh,
      lx: number,
      ly: number,
      lz: number,
      sx: number,
      sy: number,
      sz: number,
      rx = 0,
      ry = 0,
      rz = 0,
    ) => {
      scratchOffset.set(lx * s, ly * s, lz * s).applyQuaternion(scratchQuat);
      scratchPos.set(
        r.x + scratchOffset.x,
        r.y + r.pounceLiftY + scratchOffset.y,
        r.z + scratchOffset.z,
      );
      if (rx !== 0 || ry !== 0 || rz !== 0) {
        scratchEuler.set(rx, ry, rz, 'YXZ');
        scratchLocalQuat.setFromEuler(scratchEuler);
        scratchLocalQuat.premultiply(scratchQuat);
        scratchMat.compose(scratchPos, scratchLocalQuat, scratchScale.set(sx * s, sy * s, sz * s));
      } else {
        scratchMat.compose(scratchPos, scratchQuat, scratchScale.set(sx * s, sy * s, sz * s));
      }
      mesh.setMatrixAt(idx, scratchMat);
    };

    placePart(this.bodyMesh, 0, bodyBob - crouchDrop, 0, 1, 1, 1);
    placePart(this.headMesh, TIGER_HEAD[0], TIGER_HEAD[1] + bodyBob - crouchDrop, TIGER_HEAD[2],
      1, 1, 1, r.restBlend * 0.08, headScan);
    placePart(this.tailMesh, TIGER_TAIL[0], TIGER_TAIL[1] + bodyBob - crouchDrop, TIGER_TAIL[2],
      1, 1, 1, tailSway * 0.18, tailSway);

    const legScale = Math.max(0.55, 1 - crouchDrop / -TIGER_ANKLE[1]);
    for (const [i, leg] of TIGER_LEGS.entries()) {
      const cycle = gait + leg.phase * Math.PI * 2;
      const swing = pouncing
        ? leg.hind ? 0.52 : -0.58
        : moving
          ? Math.sin(cycle) * (r.state === 'chase' ? 0.42 : 0.26)
          : 0;
      const lift = pouncing
        ? 0.14
        : moving
          ? Math.max(0, Math.cos(cycle)) * (r.state === 'chase' ? 0.16 : 0.1)
          : 0;
      const pitch = swing + r.restBlend * (leg.hind ? 0.18 : -0.18);
      const ankleY = TIGER_ANKLE[1] * legScale;
      const ankleZ = TIGER_ANKLE[2];
      // Shorten/lift the foot on the return stroke while keeping the planted paw at ground level.
      const legY = leg.y + lift - crouchDrop + ankleY * (1 - Math.cos(pitch)) + ankleZ * Math.sin(pitch);
      const footZ = leg.z + Math.sin(pitch) * ankleY + Math.cos(pitch) * ankleZ;
      placePart(this.legMeshes[i], leg.x, legY, leg.z, 1, legScale, 1, pitch);
      placePart(this.pawMeshes[i], leg.x, leg.y + TIGER_ANKLE[1] + lift, footZ, 1, 1, 1);
    }
  }

  metrics() {
    return this.pool.metrics();
  }

  disposePool(): void {
    clearWildlifeActors('tiger');
    this.pool.clear();
    for (const m of this.meshes()) m.dispose();
  }
}
