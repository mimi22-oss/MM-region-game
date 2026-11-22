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
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
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
import { FixedObjectPool } from './treeResourcePool.ts';
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
  readonly wanderRadius: number;
  readonly coatTintIndex: number;
  readonly scale: number;
  readonly phaseOffset: number;
}

interface ActiveTigerRuntime {
  spawnIdx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  state: 'prowl' | 'rest';
  stateTimer: number;
  gaitPhase: number;
  restBlend: number;
  speed: number;
}

export interface MountainTigerPoolConfig {
  readonly capacity: number;
  readonly syncMoveThreshold?: number;
}

export const DEFAULT_MOUNTAIN_TIGER_POOL_CONFIG: MountainTigerPoolConfig = mobileQuality
  ? { capacity: 8, syncMoveThreshold: 24 }
  : { capacity: 16, syncMoveThreshold: 20 };

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

  const isValidTigerSpot = (
    u: number,
    v: number,
  ): { ok: boolean; x: number; z: number; y: number } => {
    const y = mountainHeight(u, v, peaks);
    if (y < 14) return { ok: false, x: 0, z: 0, y: 0 };
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const obsR = (p.obstacleRadius ?? p.radius) + 2.0;
      const du = u - p.u;
      const dv = v - p.v;
      if (du * du + dv * dv < obsR * obsR) return { ok: false, x: 0, z: 0, y: 0 };
    }
    const w = toWorld(u, v);
    if (isOnTaungphilaRoad(w.x, w.z, -8) || isOnWeipulaRoad(w.x, w.z, -8)) {
      return { ok: false, x: 0, z: 0, y: 0 };
    }
    if (!canStandTaungphilaFeatures(w.x, w.z, 1.2, false)) {
      return { ok: false, x: 0, z: 0, y: 0 };
    }
    if (!canStandHighlandPlateau(w.x, w.z, 1.2, false)) {
      return { ok: false, x: 0, z: 0, y: 0 };
    }
    if (!isFarFromAllPrey(w.x, w.z)) {
      return { ok: false, x: 0, z: 0, y: 0 };
    }
    return { ok: true, x: w.x, z: w.z, y };
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
    while (addedTerritories < zone.targetTerritories && attempts < zone.targetTerritories * 28) {
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
        let mateSpot: { ok: boolean; x: number; z: number; y: number } = { ok: false, x: 0, z: 0, y: 0 };
        let mateU = u;
        let mateV = v;
        for (let mTry = 0; mTry < 12; mTry++) {
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

    const cap = Math.min(config.capacity, Math.max(1, spawns.length));
    this.pool = new FixedObjectPool<ActiveTigerRuntime>(cap, () => ({
      spawnIdx: -1,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      targetX: 0,
      targetZ: 0,
      state: 'prowl',
      stateTimer: 2.5,
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
      m.count = cap;
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

    const take = Math.min(this.pool.capacity, n);
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
        r.spawnIdx = srcIdx;
        r.x = sp.homeX;
        r.y = sp.homeY;
        r.z = sp.homeZ;
        r.yaw = sp.phaseOffset;
        r.targetX = sp.homeX + Math.sin(sp.phaseOffset) * 5;
        r.targetZ = sp.homeZ + Math.cos(sp.phaseOffset) * 5;
        r.state = srcIdx % 2 === 0 ? 'prowl' : 'rest';
        r.stateTimer = 2.5 + (srcIdx % 4) * 1.1;
        r.gaitPhase = (srcIdx * 0.23) % 1;
        r.restBlend = r.state === 'rest' ? 1 : 0;
        r.speed = 1.65 + (srcIdx % 3) * 0.28;
        upsertWildlifeActor(sp.id, 'tiger', r.x, r.z, 1.2 * sp.scale);
        this.applyCoatTint(slot.index, sp.coatTintIndex);
        this.writeSlotMatrices(slot.index, r, sp);
      },
      (slot) => {
        if (slot.value.spawnIdx >= 0) {
          removeWildlifeActor(this.spawns[slot.value.spawnIdx].id);
        }
        slot.value.spawnIdx = -1;
        this.hideSlot(slot.index);
      },
    );

    if (assigned > 0 || released > 0) {
      for (const m of this.meshes()) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
    return true;
  }

  step(
    rawDt: number,
    focusX: number,
    focusZ: number,
    peaks: readonly TerrainPeak[],
  ): void {
    const dt = Math.min(0.05, Math.max(0, rawDt));
    this.syncToFocus(focusX, focusZ);
    if (dt <= 0 || this.pool.activeCount === 0) return;

    this.elapsed += dt;
    let updatedAny = false;
    const avoid: AvoidanceOut = { steerX: 0, steerZ: 0, blocked: false };

    this.pool.forEachActive((slot) => {
      const r = slot.value;
      if (r.spawnIdx < 0) return;
      const sp = this.spawns[r.spawnIdx];
      const selfRadius = 1.2 * sp.scale;

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
          let diff = desiredYaw - r.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          r.yaw += diff * Math.min(1, dt * 4.4);

          const stepDist = Math.min(Math.max(dist, 0.8), r.speed * dt);
          const tryAngles = [0, 0.75, -0.75, 1.4, -1.4];
          let moved = false;
          for (let a = 0; a < tryAngles.length; a++) {
            const yawTry = r.yaw + tryAngles[a];
            const nx = r.x + Math.sin(yawTry) * stepDist;
            const nz = r.z + Math.cos(yawTry) * stepDist;
            // Strictly remain inside territory patrol radius & never clip through mate/other wildlife!
            if (
              Math.hypot(nx - sp.homeX, nz - sp.homeZ) <= sp.wanderRadius &&
              !isOnTaungphilaRoad(nx, nz, -4) &&
              !isOnWeipulaRoad(nx, nz, -4) &&
              canStandHighlandPlateau(nx, nz, 0.8, false) &&
              !highlandTreeBlocks(nx, nz, 0.65) &&
              isWildlifeStepClear(sp.id, nx, nz, selfRadius, focusX, focusZ)
            ) {
              r.x = nx;
              r.z = nz;
              if (a > 0) r.yaw = yawTry;
              const nu = nx * cosA - nz * sinA;
              const nv = nx * sinA + nz * cosA;
              r.y = mountainHeight(nu, nv, peaks);
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
      this.writeSlotMatrices(slot.index, r, sp);
      updatedAny = true;
    });

    if (updatedAny) {
      for (const m of this.meshes()) m.instanceMatrix.needsUpdate = true;
    }
  }

  private writeSlotMatrices(idx: number, r: ActiveTigerRuntime, sp: MountainTigerSpawn): void {
    const s = sp.scale;
    const prowling = r.state === 'prowl';
    const crouchDrop = r.restBlend * .24;
    const gait = r.gaitPhase * Math.PI * 2;
    const bodyBob = prowling ? Math.cos(gait * 2) * .018 : 0;
    const tailSway = Math.sin(this.elapsed * 2.4 + sp.phaseOffset) * 0.34;
    const headScan = r.state === 'rest' ? Math.sin(this.elapsed * 1.2 + sp.phaseOffset) * 0.32 : 0;

    scratchEuler.set(0, r.yaw, 0, 'YXZ');
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
        r.y + scratchOffset.y,
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
      1, 1, 1, r.restBlend * .08, headScan);
    placePart(this.tailMesh, TIGER_TAIL[0], TIGER_TAIL[1] + bodyBob - crouchDrop, TIGER_TAIL[2],
      1, 1, 1, tailSway * .18, tailSway);

    const legScale = 1 - crouchDrop / -TIGER_ANKLE[1];
    for (const [i, leg] of TIGER_LEGS.entries()) {
      const cycle = gait + leg.phase * Math.PI * 2;
      const swing = prowling ? Math.sin(cycle) * .26 : 0;
      const lift = prowling ? Math.max(0, Math.cos(cycle)) * .10 : 0;
      const pitch = swing + r.restBlend * (leg.hind ? .18 : -.18);
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
