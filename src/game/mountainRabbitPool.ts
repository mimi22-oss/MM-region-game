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
import {
  RABBIT_COAT_COLORS,
  getMountainRabbitAssetCache,
  type MountainRabbitAssetCache,
} from './mountainRabbitAssets.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
import { mobileQuality } from './sceneBudget.ts';
import { canStandTaungphilaFeatures, isOnTaungphilaRoad } from './taungphilaWorld.ts';
import { FixedObjectPool } from './treeResourcePool.ts';
import { isOnWeipulaRoad } from './weipulaClimb.ts';

/**
 * ============================================================================
 * Mountain Rabbits Regional Spawner & Animated Fixed Object Pool
 * (`တောင်ပေါ် ယုန်ကလေးများ — Singleton Cache + Fixed Object Pool`)
 * ============================================================================
 * Scatters 300 wild mountain rabbits across all 4 mountain zones (Taungphila,
 * Western Highland Plateaus/Camps, Western Spine, and Maha Weipula foothills)
 * in cute family warrens of 2–4 rabbits, rendered via strictly bounded fixed
 * InstancedMesh slots recycled in O(1) around the camera/player focus.
 */

export type MountainRabbitZone =
  | 'taungphila'
  | 'highland-plateau'
  | 'western-spine'
  | 'maha-weipula';

export interface MountainRabbitSpawn {
  readonly id: string;
  readonly zone: MountainRabbitZone;
  readonly homeU: number;
  readonly homeV: number;
  readonly homeX: number;
  readonly homeZ: number;
  readonly homeY: number;
  readonly wanderRadius: number;
  readonly coatIndex: number;
  readonly scale: number;
  readonly phaseOffset: number;
}

interface ActiveRabbitRuntime {
  spawnIdx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  state: 'idle' | 'hopping';
  stateTimer: number;
  hopPhase: number;
  hopDuration: number;
  speed: number;
}

export interface MountainRabbitPoolConfig {
  readonly capacity: number;
  readonly syncMoveThreshold?: number;
}

export const DEFAULT_MOUNTAIN_RABBIT_POOL_CONFIG: MountainRabbitPoolConfig = mobileQuality
  ? { capacity: 18, syncMoveThreshold: 18 }
  : { capacity: 36, syncMoveThreshold: 16 };

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

function isValidRabbitMeadow(u: number, v: number, peaks: readonly TerrainPeak[]): { ok: boolean; x: number; z: number; y: number } {
  const y = mountainHeight(u, v, peaks);
  if (y < 6) return { ok: false, x: 0, z: 0, y: 0 };
  for (let i = 0; i < peaks.length; i++) {
    const p = peaks[i];
    const obsR = (p.obstacleRadius ?? p.radius) + 1.0;
    const du = u - p.u;
    const dv = v - p.v;
    if (du * du + dv * dv < obsR * obsR) return { ok: false, x: 0, z: 0, y: 0 };
  }
  const w = toWorld(u, v);
  if (isOnTaungphilaRoad(w.x, w.z, -4) || isOnWeipulaRoad(w.x, w.z, -4)) {
    return { ok: false, x: 0, z: 0, y: 0 };
  }
  if (!canStandTaungphilaFeatures(w.x, w.z, 0.6, false)) {
    return { ok: false, x: 0, z: 0, y: 0 };
  }
  if (!canStandHighlandPlateau(w.x, w.z, 0.6, false)) {
    return { ok: false, x: 0, z: 0, y: 0 };
  }
  return { ok: true, x: w.x, z: w.z, y };
}

/**
 * Deterministically scatters 300 cute mountain rabbits in small meadow family
 * groups (2–4 rabbits) across all 4 mountain areas.
 */
export function buildMountainRabbitSpawns(
  peaks: readonly TerrainPeak[] = [...ward.mountains, ...ward.weipula.peaks],
): MountainRabbitSpawn[] {
  const rng = createRng(2026112242);
  const spawns: MountainRabbitSpawn[] = [];

  const zones: Array<{
    zone: MountainRabbitZone;
    targetCount: number;
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
  }> = [
    // 1. Taungphila Mountain foothills, saddles & flat plateau crowns
    { zone: 'taungphila', targetCount: 48, uMin: -690, uMax: -470, vMin: 35, vMax: 470 },
    // 2. Broad Western Highland Plateaus (108 base camps & mountain villages)
    { zone: 'highland-plateau', targetCount: 152, uMin: -1240, uMax: -760, vMin: 110, vMax: 4460 },
    // 3. Scenic Western Mountain Spine meadows
    { zone: 'western-spine', targetCount: 52, uMin: -755, uMax: -565, vMin: 480, vMax: 4480 },
    // 4. Maha Weipula Mountain foothills & shoulder plateaus
    { zone: 'maha-weipula', targetCount: 48, uMin: -2220, uMax: -840, vMin: 4620, vMax: 5650 },
  ];

  for (const cfg of zones) {
    let added = 0;
    let attempts = 0;
    while (added < cfg.targetCount && attempts < cfg.targetCount * 12) {
      attempts++;
      const centerU = cfg.uMin + rng() * (cfg.uMax - cfg.uMin);
      const centerV = cfg.vMin + rng() * (cfg.vMax - cfg.vMin);
      const baseCheck = isValidRabbitMeadow(centerU, centerV, peaks);
      if (!baseCheck.ok) continue;

      // Spawn a cute little warren/group of 2 to 4 rabbits hopping near each other!
      const groupSize = Math.min(cfg.targetCount - added, 2 + Math.floor(rng() * 3));
      for (let g = 0; g < groupSize; g++) {
        const ou = g === 0 ? 0 : (rng() - 0.5) * 9;
        const ov = g === 0 ? 0 : (rng() - 0.5) * 9;
        const u = centerU + ou;
        const v = centerV + ov;
        const spot = g === 0 ? baseCheck : isValidRabbitMeadow(u, v, peaks);
        if (!spot.ok) continue;
        spawns.push({
          id: `mtn-rabbit-${cfg.zone}-${spawns.length}`,
          zone: cfg.zone,
          homeU: u,
          homeV: v,
          homeX: spot.x,
          homeZ: spot.z,
          homeY: spot.y,
          wanderRadius: 6 + rng() * 7,
          coatIndex: Math.floor(rng() * RABBIT_COAT_COLORS.length),
          scale: 0.85 + rng() * 0.38,
          phaseOffset: rng() * Math.PI * 2,
        });
        added++;
      }
    }
  }

  return spawns;
}

// Zero-GC scratch objects shared across all animation frames
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

export class MountainRabbitFixedPool {
  readonly cache: MountainRabbitAssetCache;
  readonly config: MountainRabbitPoolConfig;
  readonly spawns: readonly MountainRabbitSpawn[];
  readonly pool: FixedObjectPool<ActiveRabbitRuntime>;

  // Strictly bounded GPU InstancedMeshes backed by Singleton Cache references
  readonly bodyMesh: InstancedMesh;
  readonly headMesh: InstancedMesh;
  readonly earLeftMesh: InstancedMesh;
  readonly earRightMesh: InstancedMesh;
  readonly earInnerLeftMesh: InstancedMesh;
  readonly earInnerRightMesh: InstancedMesh;
  readonly tailMesh: InstancedMesh;
  readonly pawLeftMesh: InstancedMesh;
  readonly pawRightMesh: InstancedMesh;
  readonly eyeLeftMesh: InstancedMesh;
  readonly eyeRightMesh: InstancedMesh;
  readonly noseMesh: InstancedMesh;

  private lastFocusX = Number.NaN;
  private lastFocusZ = Number.NaN;
  private elapsed = 0;
  private readonly scored: ScoredIdx[] = [];
  private readonly desiredIds: string[] = [];
  private readonly desiredById = new Map<string, number>();

  constructor(
    spawns: readonly MountainRabbitSpawn[],
    config: MountainRabbitPoolConfig = DEFAULT_MOUNTAIN_RABBIT_POOL_CONFIG,
  ) {
    this.cache = getMountainRabbitAssetCache();
    this.config = config;
    this.spawns = spawns;

    const cap = Math.min(config.capacity, Math.max(1, spawns.length));
    this.pool = new FixedObjectPool<ActiveRabbitRuntime>(cap, () => ({
      spawnIdx: -1,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      targetX: 0,
      targetZ: 0,
      state: 'idle',
      stateTimer: 1.5,
      hopPhase: 0,
      hopDuration: 0.44,
      speed: 2.2,
    }));

    const c = this.cache;
    this.bodyMesh = new InstancedMesh(c.bodyGeo, c.furInstancedMat, cap);
    this.headMesh = new InstancedMesh(c.headGeo, c.furInstancedMat, cap);
    this.earLeftMesh = new InstancedMesh(c.earOuterGeo, c.furInstancedMat, cap);
    this.earRightMesh = new InstancedMesh(c.earOuterGeo, c.furInstancedMat, cap);
    this.earInnerLeftMesh = new InstancedMesh(c.earInnerGeo, c.pinkInnerMat, cap);
    this.earInnerRightMesh = new InstancedMesh(c.earInnerGeo, c.pinkInnerMat, cap);
    this.tailMesh = new InstancedMesh(c.tailGeo, c.tailWhiteMat, cap);
    this.pawLeftMesh = new InstancedMesh(c.pawGeo, c.furInstancedMat, cap);
    this.pawRightMesh = new InstancedMesh(c.pawGeo, c.furInstancedMat, cap);
    this.eyeLeftMesh = new InstancedMesh(c.eyeGeo, c.eyeDarkMat, cap);
    this.eyeRightMesh = new InstancedMesh(c.eyeGeo, c.eyeDarkMat, cap);
    this.noseMesh = new InstancedMesh(c.noseGeo, c.pinkInnerMat, cap);

    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.count = cap;
      for (let i = 0; i < cap; i++) m.setMatrixAt(i, scratchZeroMat);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  meshes(): readonly InstancedMesh[] {
    return [
      this.bodyMesh,
      this.headMesh,
      this.earLeftMesh,
      this.earRightMesh,
      this.earInnerLeftMesh,
      this.earInnerRightMesh,
      this.tailMesh,
      this.pawLeftMesh,
      this.pawRightMesh,
      this.eyeLeftMesh,
      this.eyeRightMesh,
      this.noseMesh,
    ];
  }

  private hideSlot(idx: number): void {
    for (const m of this.meshes()) {
      m.setMatrixAt(idx, scratchZeroMat);
    }
  }

  private applyCoatColor(idx: number, coatIndex: number): void {
    scratchColor.set(RABBIT_COAT_COLORS[coatIndex % RABBIT_COAT_COLORS.length]);
    this.bodyMesh.setColorAt(idx, scratchColor);
    this.headMesh.setColorAt(idx, scratchColor);
    this.earLeftMesh.setColorAt(idx, scratchColor);
    this.earRightMesh.setColorAt(idx, scratchColor);
    this.pawLeftMesh.setColorAt(idx, scratchColor);
    this.pawRightMesh.setColorAt(idx, scratchColor);
  }

  syncToFocus(focusX: number, focusZ: number, force = false): boolean {
    const threshold = this.config.syncMoveThreshold ?? 16;
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
        r.targetX = sp.homeX + Math.sin(sp.phaseOffset) * 3.5;
        r.targetZ = sp.homeZ + Math.cos(sp.phaseOffset) * 3.5;
        r.state = srcIdx % 2 === 0 ? 'hopping' : 'idle';
        r.stateTimer = 0.8 + (srcIdx % 5) * 0.55;
        r.hopPhase = (srcIdx * 0.27) % 1;
        r.hopDuration = 0.42 + (srcIdx % 3) * 0.05;
        r.speed = 2.0 + (srcIdx % 4) * 0.35;
        upsertWildlifeActor(sp.id, 'rabbit', r.x, r.z, 0.5 * sp.scale);
        this.applyCoatColor(slot.index, sp.coatIndex);
        this.writeSlotMatrices(slot.index, r, sp, 0);
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

  /**
   * Advances hopping & nibbling animations for all currently active pooled rabbits.
   */
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
      const selfRadius = 0.5 * sp.scale;

      computeWildlifeAvoidance(sp.id, r.x, r.z, selfRadius, focusX, focusZ, avoid);

      // Playful shy hop away if player approaches within 5.5m or another animal crowds this rabbit
      const distToFocus = Math.hypot(r.x - focusX, r.z - focusZ);
      if ((distToFocus < 5.5 || avoid.blocked) && r.state === 'idle') {
        const fleeAngle = avoid.blocked
          ? Math.atan2(avoid.steerX, avoid.steerZ)
          : Math.atan2(r.x - focusX, r.z - focusZ) + Math.sin(sp.phaseOffset) * 0.5;
        r.targetX = sp.homeX + Math.sin(fleeAngle) * sp.wanderRadius * 0.85;
        r.targetZ = sp.homeZ + Math.cos(fleeAngle) * sp.wanderRadius * 0.85;
        r.state = 'hopping';
        r.stateTimer = 1.6;
        r.hopPhase = 0;
      }

      let hopLift = 0;
      let pitch = 0;

      if (r.state === 'hopping') {
        r.hopPhase += dt / r.hopDuration;
        if (r.hopPhase >= 1) {
          r.hopPhase %= 1;
        }
        const hopSin = Math.sin(r.hopPhase * Math.PI);
        hopLift = hopSin * 0.34 * sp.scale;
        pitch = Math.cos(r.hopPhase * Math.PI) * 0.28;

        const dx = r.targetX - r.x;
        const dz = r.targetZ - r.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.35 || avoid.blocked) {
          const goalDirX = dist > 0.01 ? dx / dist : 0;
          const goalDirZ = dist > 0.01 ? dz / dist : 0;
          const blendX = goalDirX + avoid.steerX * 1.4;
          const blendZ = goalDirZ + avoid.steerZ * 1.4;
          const desiredYaw = Math.atan2(blendX, blendZ);
          let diff = desiredYaw - r.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          r.yaw += diff * Math.min(1, dt * 8.5);

          const stepDist = Math.min(Math.max(dist, 0.6), r.speed * (0.45 + 0.85 * hopSin) * dt);
          const tryAngles = [0, 0.75, -0.75, 1.45, -1.45];
          let moved = false;
          for (let a = 0; a < tryAngles.length; a++) {
            const yawTry = r.yaw + tryAngles[a];
            const nx = r.x + Math.sin(yawTry) * stepDist;
            const nz = r.z + Math.cos(yawTry) * stepDist;
            if (
              !isOnTaungphilaRoad(nx, nz, -2) &&
              !isOnWeipulaRoad(nx, nz, -2) &&
              canStandHighlandPlateau(nx, nz, 0.35, false) &&
              !highlandTreeBlocks(nx, nz, 0.35) &&
              isWildlifeStepClear(sp.id, nx, nz, selfRadius, focusX, focusZ)
            ) {
              r.x = nx;
              r.z = nz;
              if (a > 0) r.yaw = yawTry;
              const nu = nx * cosA - nz * sinA;
              const nv = nx * sinA + nz * cosA;
              r.y = mountainHeight(nu, nv, peaks);
              moved = true;
              break;
            }
          }
          if (!moved) {
            r.state = 'idle';
            r.stateTimer = 1.2;
          }
        } else {
          r.state = 'idle';
          r.stateTimer = 1.4 + ((r.spawnIdx * 37 + Math.floor(this.elapsed * 3)) % 5) * 0.65;
          r.hopPhase = 0;
        }
      } else {
        // Gentle idle nibbling & ear twitching
        r.stateTimer -= dt;
        if (r.stateTimer <= 0) {
          const nextAngle = sp.phaseOffset + this.elapsed * 1.17 + r.spawnIdx * 1.618;
          const radius = sp.wanderRadius * (0.35 + ((r.spawnIdx * 13) % 7) * 0.09);
          r.targetX = sp.homeX + Math.sin(nextAngle) * radius;
          r.targetZ = sp.homeZ + Math.cos(nextAngle) * radius;
          r.state = 'hopping';
          r.hopPhase = 0;
        }
      }

      upsertWildlifeActor(sp.id, 'rabbit', r.x, r.z, selfRadius);
      this.writeSlotMatrices(slot.index, r, sp, hopLift, pitch);
      updatedAny = true;
    });

    if (updatedAny) {
      for (const m of this.meshes()) {
        m.instanceMatrix.needsUpdate = true;
      }
    }
  }

  private writeSlotMatrices(
    idx: number,
    r: ActiveRabbitRuntime,
    sp: MountainRabbitSpawn,
    hopLift: number,
    pitch = 0,
  ): void {
    const s = sp.scale;
    const earTwitch = Math.sin(this.elapsed * 4.2 + sp.phaseOffset) * 0.08;
    const nibbleBob = r.state === 'idle' ? Math.sin(this.elapsed * 5.0 + sp.phaseOffset) * 0.018 : 0;

    // Base rabbit transform (+Z is forward)
    scratchEuler.set(-pitch, r.yaw, 0, 'YXZ');
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
      scratchPos.set(r.x + scratchOffset.x, r.y + hopLift + scratchOffset.y, r.z + scratchOffset.z);
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

    // Plump rabbit body
    placePart(this.bodyMesh, 0, 0.24, -0.02, 0.92, 0.88, 1.32);
    // Cute rounded head
    placePart(this.headMesh, 0, 0.4 + nibbleBob, 0.24, 1.0, 0.94, 1.08);
    // Upright long ears + soft pink inner ear strips
    placePart(this.earLeftMesh, -0.068, 0.56 + nibbleBob, 0.21, 1, 1, 1, -0.14 + earTwitch, 0, 0.16);
    placePart(this.earRightMesh, 0.068, 0.56 + nibbleBob, 0.21, 1, 1, 1, -0.14 - earTwitch, 0, -0.16);
    placePart(this.earInnerLeftMesh, -0.066, 0.56 + nibbleBob, 0.23, 1, 1, 1, -0.14 + earTwitch, 0, 0.16);
    placePart(this.earInnerRightMesh, 0.066, 0.56 + nibbleBob, 0.23, 1, 1, 1, -0.14 - earTwitch, 0, -0.16);
    // Fluffy white cotton pom-pom tail
    placePart(this.tailMesh, 0, 0.23, -0.429, 1.05, 1.05, 1.05);
    const tuck = Math.min(.06, hopLift / s * .36);
    placePart(this.pawLeftMesh, -0.12, 0.066 + tuck, 0.157 - tuck, 1.0, 0.72, 1.45, -tuck * 6);
    placePart(this.pawRightMesh, 0.12, 0.066 + tuck, 0.157 - tuck, 1.0, 0.72, 1.45, -tuck * 6);
    // Dark glossy eyes + tiny pink nose
    placePart(this.eyeLeftMesh, -0.127, 0.431 + nibbleBob, 0.306, 1, 1, 1);
    placePart(this.eyeRightMesh, 0.127, 0.431 + nibbleBob, 0.306, 1, 1, 1);
    placePart(this.noseMesh, 0, 0.38 + nibbleBob, 0.447, 1.1, 0.9, 0.9);
  }

  metrics() {
    return this.pool.metrics();
  }

  disposePool(): void {
    clearWildlifeActors('rabbit');
    this.pool.clear();
    for (const m of this.meshes()) {
      m.dispose();
    }
  }
}
