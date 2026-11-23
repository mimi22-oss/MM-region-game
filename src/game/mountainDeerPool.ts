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
  DEER_COAT_COLORS,
  getMountainDeerAssetCache,
  type MountainDeerAssetCache,
} from './mountainDeerAssets.ts';
import type { MountainRabbitZone } from './mountainRabbitPool.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
import { mobileQuality } from './sceneBudget.ts';
import { canStandTaungphilaFeatures, isOnTaungphilaRoad } from './taungphilaWorld.ts';
import { countNearestInRange, FixedObjectPool, updatePooledInstances } from './treeResourcePool.ts';
import { isOnWeipulaRoad } from './weipulaClimb.ts';

/**
 * ============================================================================
 * Mountain Deer Regional Herd Spawner & Animated Fixed Object Pool
 * (`တောင်ပေါ် သမင်အုပ်များ — Singleton Cache + Fixed Object Pool`)
 * ============================================================================
 * Scatters 180 graceful Burmese highland deer (antlered stags, does & fawns)
 * in herds of 2–4 across all 4 mountain regions, grazing, looking around, and
 * bounding gracefully across the flat highland meadows using bounded fixed GPU
 * InstancedMesh slots recycled in O(1) around the camera/player focus.
 */

export type MountainDeerZone = MountainRabbitZone;

export interface MountainDeerSpawn {
  readonly id: string;
  readonly zone: MountainDeerZone;
  readonly homeU: number;
  readonly homeV: number;
  readonly homeX: number;
  readonly homeZ: number;
  readonly homeY: number;
  readonly wanderRadius: number;
  readonly coatIndex: number;
  readonly hasAntlers: boolean;
  readonly scale: number;
  readonly phaseOffset: number;
}

interface ActiveDeerRuntime {
  spawnIdx: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  state: 'graze' | 'alert' | 'walk';
  stateTimer: number;
  gaitPhase: number;
  grazeBlend: number;
  speed: number;
}

export interface MountainDeerPoolConfig {
  readonly capacity: number;
  readonly syncMoveThreshold?: number;
  readonly activeRadius?: number;
}

export const DEFAULT_MOUNTAIN_DEER_POOL_CONFIG: MountainDeerPoolConfig = mobileQuality
  ? { capacity: 14, syncMoveThreshold: 22, activeRadius: 145 }
  : { capacity: 28, syncMoveThreshold: 18, activeRadius: 205 };

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

function isValidDeerMeadow(
  u: number,
  v: number,
  peaks: readonly TerrainPeak[],
): { ok: boolean; x: number; z: number; y: number } {
  const y = mountainHeight(u, v, peaks);
  if (y < 8) return { ok: false, x: 0, z: 0, y: 0 };
  for (let i = 0; i < peaks.length; i++) {
    const p = peaks[i];
    const obsR = (p.obstacleRadius ?? p.radius) + 1.5;
    const du = u - p.u;
    const dv = v - p.v;
    if (du * du + dv * dv < obsR * obsR) return { ok: false, x: 0, z: 0, y: 0 };
  }
  const w = toWorld(u, v);
  if (isOnTaungphilaRoad(w.x, w.z, -5) || isOnWeipulaRoad(w.x, w.z, -5)) {
    return { ok: false, x: 0, z: 0, y: 0 };
  }
  if (!canStandTaungphilaFeatures(w.x, w.z, 0.9, false)) {
    return { ok: false, x: 0, z: 0, y: 0 };
  }
  if (!canStandHighlandPlateau(w.x, w.z, 0.9, false)) {
    return { ok: false, x: 0, z: 0, y: 0 };
  }
  return { ok: true, x: w.x, z: w.z, y };
}

/**
 * Deterministically scatters 180 wild mountain deer in herds of 2–4 (stag + does/fawn)
 * across all 4 mountain zones.
 */
export function buildMountainDeerSpawns(
  peaks: readonly TerrainPeak[] = [...ward.mountains, ...ward.weipula.peaks],
): MountainDeerSpawn[] {
  const rng = createRng(2026112277);
  const spawns: MountainDeerSpawn[] = [];

  const zones: Array<{
    zone: MountainDeerZone;
    targetCount: number;
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
  }> = [
    { zone: 'taungphila', targetCount: 30, uMin: -690, uMax: -475, vMin: 40, vMax: 470 },
    { zone: 'highland-plateau', targetCount: 90, uMin: -1240, uMax: -765, vMin: 120, vMax: 4460 },
    { zone: 'western-spine', targetCount: 30, uMin: -755, uMax: -565, vMin: 490, vMax: 4480 },
    { zone: 'maha-weipula', targetCount: 30, uMin: -2220, uMax: -840, vMin: 4620, vMax: 5650 },
  ];

  for (const cfg of zones) {
    let added = 0;
    let attempts = 0;
    while (added < cfg.targetCount && attempts < cfg.targetCount * 14) {
      attempts++;
      const centerU = cfg.uMin + rng() * (cfg.uMax - cfg.uMin);
      const centerV = cfg.vMin + rng() * (cfg.vMax - cfg.vMin);
      const baseCheck = isValidDeerMeadow(centerU, centerV, peaks);
      if (!baseCheck.ok) continue;

      // Herd of 2 to 4 deer (first is a proud antlered stag, followed by does & a smaller fawn!)
      const herdSize = Math.min(cfg.targetCount - added, 2 + Math.floor(rng() * 3));
      for (let g = 0; g < herdSize; g++) {
        const ou = g === 0 ? 0 : (rng() - 0.5) * 14;
        const ov = g === 0 ? 0 : (rng() - 0.5) * 14;
        const u = centerU + ou;
        const v = centerV + ov;
        const spot = g === 0 ? baseCheck : isValidDeerMeadow(u, v, peaks);
        if (!spot.ok) continue;
        const isStag = g === 0;
        const isFawn = g === herdSize - 1 && herdSize >= 3;
        spawns.push({
          id: `mtn-deer-${cfg.zone}-${spawns.length}`,
          zone: cfg.zone,
          homeU: u,
          homeV: v,
          homeX: spot.x,
          homeZ: spot.z,
          homeY: spot.y,
          wanderRadius: 10 + rng() * 10,
          coatIndex: isFawn ? 3 : Math.floor(rng() * 3),
          hasAntlers: isStag,
          scale: isStag ? 1.06 + rng() * 0.14 : isFawn ? 0.68 + rng() * 0.1 : 0.9 + rng() * 0.12,
          phaseOffset: rng() * Math.PI * 2,
        });
        added++;
      }
    }
  }

  return spawns;
}

const scratchMat = new Matrix4();
const scratchZeroMat = new Matrix4().makeScale(0, 0, 0);
const scratchPos = new Vector3();
const scratchOffset = new Vector3();
const headOffset = new Vector3();
const headRotation = new Quaternion();
const scratchQuat = new Quaternion();
const scratchLocalQuat = new Quaternion();
const scratchScale = new Vector3();
const scratchEuler = new Euler();
const scratchColor = new Color();

type ScoredIdx = { idx: number; distSq: number };

export class MountainDeerFixedPool {
  readonly cache: MountainDeerAssetCache;
  readonly config: MountainDeerPoolConfig;
  readonly spawns: readonly MountainDeerSpawn[];
  readonly pool: FixedObjectPool<ActiveDeerRuntime>;

  readonly bodyMesh: InstancedMesh;
  readonly neckMesh: InstancedMesh;
  readonly headMesh: InstancedMesh;
  readonly muzzleMesh: InstancedMesh;
  readonly earLeftMesh: InstancedMesh;
  readonly earRightMesh: InstancedMesh;
  readonly tailMesh: InstancedMesh;
  readonly legFLMesh: InstancedMesh;
  readonly legFRMesh: InstancedMesh;
  readonly legBLMesh: InstancedMesh;
  readonly legBRMesh: InstancedMesh;
  readonly antlerLeftMesh: InstancedMesh;
  readonly antlerRightMesh: InstancedMesh;
  readonly eyeLeftMesh: InstancedMesh;
  readonly eyeRightMesh: InstancedMesh;

  private lastFocusX = Number.NaN;
  private lastFocusZ = Number.NaN;
  private elapsed = 0;
  private readonly scored: ScoredIdx[] = [];
  private readonly desiredIds: string[] = [];
  private readonly desiredById = new Map<string, number>();

  constructor(
    spawns: readonly MountainDeerSpawn[],
    config: MountainDeerPoolConfig = DEFAULT_MOUNTAIN_DEER_POOL_CONFIG,
  ) {
    this.cache = getMountainDeerAssetCache();
    this.config = config;
    this.spawns = spawns;

    const cap = Math.min(config.capacity, Math.max(1, spawns.length));
    this.pool = new FixedObjectPool<ActiveDeerRuntime>(cap, () => ({
      spawnIdx: -1,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      targetX: 0,
      targetZ: 0,
      state: 'graze',
      stateTimer: 2.0,
      gaitPhase: 0,
      grazeBlend: 1,
      speed: 2.0,
    }));

    const c = this.cache;
    this.bodyMesh = new InstancedMesh(c.bodyGeo, c.coatInstancedMat, cap);
    this.neckMesh = new InstancedMesh(c.neckGeo, c.coatInstancedMat, cap);
    this.headMesh = new InstancedMesh(c.headGeo, c.coatInstancedMat, cap);
    this.muzzleMesh = new InstancedMesh(c.muzzleGeo, c.coatInstancedMat, cap);
    this.earLeftMesh = new InstancedMesh(c.earGeo, c.coatInstancedMat, cap);
    this.earRightMesh = new InstancedMesh(c.earGeo, c.coatInstancedMat, cap);
    this.tailMesh = new InstancedMesh(c.tailGeo, c.creamBellyMat, cap);
    this.legFLMesh = new InstancedMesh(c.legGeo, c.coatInstancedMat, cap);
    this.legFRMesh = new InstancedMesh(c.legGeo, c.coatInstancedMat, cap);
    this.legBLMesh = new InstancedMesh(c.hindLegGeo, c.coatInstancedMat, cap);
    this.legBRMesh = new InstancedMesh(c.hindLegGeo, c.coatInstancedMat, cap);
    this.antlerLeftMesh = new InstancedMesh(c.antlerMainGeo, c.antlerMat, cap);
    this.antlerRightMesh = new InstancedMesh(c.antlerMainGeo, c.antlerMat, cap);
    this.eyeLeftMesh = new InstancedMesh(c.eyeGeo, c.darkHoofEyeMat, cap);
    this.eyeRightMesh = new InstancedMesh(c.eyeGeo, c.darkHoofEyeMat, cap);

    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.count = 0;
      m.visible = false;
      for (let i = 0; i < cap; i++) m.setMatrixAt(i, scratchZeroMat);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  meshes(): readonly InstancedMesh[] {
    return [
      this.bodyMesh,
      this.neckMesh,
      this.headMesh,
      this.muzzleMesh,
      this.earLeftMesh,
      this.earRightMesh,
      this.tailMesh,
      this.legFLMesh,
      this.legFRMesh,
      this.legBLMesh,
      this.legBRMesh,
      this.antlerLeftMesh,
      this.antlerRightMesh,
      this.eyeLeftMesh,
      this.eyeRightMesh,
    ];
  }

  private hideSlot(idx: number): void {
    for (const m of this.meshes()) m.setMatrixAt(idx, scratchZeroMat);
  }

  private applyCoatColor(idx: number, coatIndex: number): void {
    scratchColor.set(DEER_COAT_COLORS[coatIndex % DEER_COAT_COLORS.length]);
    this.bodyMesh.setColorAt(idx, scratchColor);
    this.neckMesh.setColorAt(idx, scratchColor);
    this.headMesh.setColorAt(idx, scratchColor);
    this.muzzleMesh.setColorAt(idx, scratchColor);
    this.earLeftMesh.setColorAt(idx, scratchColor);
    this.earRightMesh.setColorAt(idx, scratchColor);
    this.legFLMesh.setColorAt(idx, scratchColor);
    this.legFRMesh.setColorAt(idx, scratchColor);
    this.legBLMesh.setColorAt(idx, scratchColor);
    this.legBRMesh.setColorAt(idx, scratchColor);
  }

  syncToFocus(focusX: number, focusZ: number, force = false): boolean {
    const threshold = this.config.syncMoveThreshold ?? 18;
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
        r.spawnIdx = srcIdx;
        r.x = sp.homeX;
        r.y = sp.homeY;
        r.z = sp.homeZ;
        r.yaw = sp.phaseOffset;
        r.targetX = sp.homeX + Math.sin(sp.phaseOffset) * 5;
        r.targetZ = sp.homeZ + Math.cos(sp.phaseOffset) * 5;
        r.state = srcIdx % 3 === 0 ? 'walk' : srcIdx % 3 === 1 ? 'graze' : 'alert';
        r.stateTimer = 1.6 + (srcIdx % 5) * 0.7;
        r.gaitPhase = (srcIdx * 0.31) % 1;
        r.grazeBlend = r.state === 'graze' ? 1 : 0;
        r.speed = 1.9 + (srcIdx % 3) * 0.45;
        upsertWildlifeActor(sp.id, 'deer', r.x, r.z, 0.95 * sp.scale);
        this.applyCoatColor(slot.index, sp.coatIndex);
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
      updatePooledInstances(this.meshes(), this.pool.renderCount);
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
      const selfRadius = 0.95 * sp.scale;

      computeWildlifeAvoidance(sp.id, r.x, r.z, selfRadius, focusX, focusZ, avoid);

      // Graceful shy trot away when player gets within 8.5m or another animal crowds this deer
      const distToFocus = Math.hypot(r.x - focusX, r.z - focusZ);
      if ((distToFocus < 8.5 || avoid.blocked) && r.state !== 'walk') {
        const fleeAngle = avoid.blocked
          ? Math.atan2(avoid.steerX, avoid.steerZ)
          : Math.atan2(r.x - focusX, r.z - focusZ) + Math.sin(sp.phaseOffset) * 0.35;
        r.targetX = sp.homeX + Math.sin(fleeAngle) * sp.wanderRadius * 0.9;
        r.targetZ = sp.homeZ + Math.cos(fleeAngle) * sp.wanderRadius * 0.9;
        r.state = 'walk';
        r.speed = avoid.blocked ? 2.4 : 3.6;
        r.stateTimer = 2.4;
      }

      const targetGraze = r.state === 'graze' ? 1 : 0;
      r.grazeBlend += (targetGraze - r.grazeBlend) * Math.min(1, dt * 3.5);

      if (r.state === 'walk') {
        const dx = r.targetX - r.x;
        const dz = r.targetZ - r.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.5 || avoid.blocked) {
          const goalDirX = dist > 0.01 ? dx / dist : 0;
          const goalDirZ = dist > 0.01 ? dz / dist : 0;
          const blendX = goalDirX + avoid.steerX * 1.5;
          const blendZ = goalDirZ + avoid.steerZ * 1.5;
          const desiredYaw = Math.atan2(blendX, blendZ);
          let diff = desiredYaw - r.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          r.yaw += diff * Math.min(1, dt * 5.8);

          const stepDist = Math.min(Math.max(dist, 0.8), r.speed * dt);
          const tryAngles = [0, 0.7, -0.7, 1.35, -1.35];
          let moved = false;
          for (let a = 0; a < tryAngles.length; a++) {
            const yawTry = r.yaw + tryAngles[a];
            const nx = r.x + Math.sin(yawTry) * stepDist;
            const nz = r.z + Math.cos(yawTry) * stepDist;
            if (
              !isOnTaungphilaRoad(nx, nz, -2.5) &&
              !isOnWeipulaRoad(nx, nz, -2.5) &&
              canStandHighlandPlateau(nx, nz, 0.5, false) &&
              !highlandTreeBlocks(nx, nz, 0.5) &&
              isWildlifeStepClear(sp.id, nx, nz, selfRadius, focusX, focusZ)
            ) {
              r.x = nx;
              r.z = nz;
              if (a > 0) r.yaw = yawTry;
              const nu = nx * cosA - nz * sinA;
              const nv = nx * sinA + nz * cosA;
              r.y = mountainHeight(nu, nv, peaks);
              r.gaitPhase = (r.gaitPhase + stepDist * 0.95) % 1;
              moved = true;
              break;
            }
          }
          if (!moved) {
            r.state = 'alert';
            r.stateTimer = 2.0;
          }
        } else {
          r.state = (r.spawnIdx + Math.floor(this.elapsed)) % 2 === 0 ? 'graze' : 'alert';
          r.stateTimer = 2.4 + (r.spawnIdx % 4) * 0.9;
          r.speed = 1.9 + (r.spawnIdx % 3) * 0.4;
        }
      } else {
        r.stateTimer -= dt;
        if (r.stateTimer <= 0) {
          if (r.state === 'graze' && (r.spawnIdx + Math.floor(this.elapsed)) % 2 === 0) {
            r.state = 'alert';
            r.stateTimer = 1.8 + (r.spawnIdx % 3) * 0.6;
          } else {
            const nextAngle = sp.phaseOffset + this.elapsed * 0.68 + r.spawnIdx * 1.41;
            const rad = sp.wanderRadius * (0.35 + ((r.spawnIdx * 17) % 7) * 0.09);
            r.targetX = sp.homeX + Math.sin(nextAngle) * rad;
            r.targetZ = sp.homeZ + Math.cos(nextAngle) * rad;
            r.state = 'walk';
            r.speed = 1.9 + (r.spawnIdx % 3) * 0.4;
          }
        }
      }

      upsertWildlifeActor(sp.id, 'deer', r.x, r.z, selfRadius);
      this.writeSlotMatrices(slot.index, r, sp);
      updatedAny = true;
    });

    if (updatedAny) {
      for (const m of this.meshes()) m.instanceMatrix.needsUpdate = true;
    }
  }

  private writeSlotMatrices(idx: number, r: ActiveDeerRuntime, sp: MountainDeerSpawn): void {
    const s = sp.scale;
    const walking = r.state === 'walk';
    const swing = walking ? Math.sin(r.gaitPhase * Math.PI * 2) * 0.42 : 0;
    const bounce = walking ? Math.abs(Math.sin(r.gaitPhase * Math.PI * 2)) * 0.08 * s : 0;
    const grazePitch = r.grazeBlend * 0.95; // Smoothly bows neck down to graze!
    const headLook = r.state === 'alert' ? Math.sin(this.elapsed * 1.8 + sp.phaseOffset) * 0.25 : 0;

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
      scratchPos.set(r.x + scratchOffset.x, r.y + bounce + scratchOffset.y, r.z + scratchOffset.z);
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

    // Graceful horizontal torso (+Z forward)
    placePart(this.bodyMesh, 0, 1.02, 0, 0.96, 1.0, 0.94, Math.PI / 2, 0, 0);

    // 4 slender animated legs
    placePart(this.legFLMesh, -0.18, 0.46, 0.42, 1, 1, 1, swing, 0, 0);
    placePart(this.legFRMesh, 0.18, 0.46, 0.42, 1, 1, 1, -swing, 0, 0);
    placePart(this.legBLMesh, -0.18, 0.46, -0.44, 1, 1, 1, -swing, 0, 0);
    placePart(this.legBRMesh, 0.18, 0.46, -0.44, 1, 1, 1, swing, 0, 0);

    // Fluffy cream deer tail
    placePart(this.tailMesh, 0, 1.01, -0.697, 1, 1, 1, -0.85, 0, 0);

    // Neck + Head + Muzzle + Ears + Eyes + Optional Stag Antlers (pivot from shoulder)
    const neckPitch = 0.34 + grazePitch;
    const shoulderY = 1.14;
    const shoulderZ = 0.48;
    const neckLen = 0.54;
    const neckMidY = shoulderY + Math.cos(neckPitch) * (neckLen * 0.5);
    const neckMidZ = shoulderZ + Math.sin(neckPitch) * (neckLen * 0.5);
    const headY = shoulderY + Math.cos(neckPitch) * neckLen;
    const headZ = shoulderZ + Math.sin(neckPitch) * neckLen + 0.08;

    placePart(this.neckMesh, 0, neckMidY, neckMidZ, 1, 1, 1, neckPitch, headLook * 0.4, 0);
    const headPitch = grazePitch * .45;
    headRotation.setFromEuler(scratchEuler.set(headPitch, headLook, 0, 'YXZ'));
    const facePart = (mesh: InstancedMesh, x: number, y: number, z: number, rx = 0, rz = 0) => {
      headOffset.set(x, y, z).applyQuaternion(headRotation);
      placePart(mesh, headOffset.x, headY + headOffset.y, headZ + headOffset.z,
        1, 1, 1, headPitch + rx, headLook, rz);
    };
    placePart(this.headMesh, 0, headY, headZ, .92, .94, 1.18, headPitch, headLook);
    facePart(this.muzzleMesh, 0, -.045, .174, Math.PI / 2 + .12);
    facePart(this.earLeftMesh, -.137, .114, -.041, -.22, .69);
    facePart(this.earRightMesh, .137, .114, -.041, -.22, -.69);
    facePart(this.eyeLeftMesh, -.126, .034, .098);
    facePart(this.eyeRightMesh, .126, .034, .098);

    if (sp.hasAntlers) {
      facePart(this.antlerLeftMesh, -.076, .115, -.03, -.17, .37);
      facePart(this.antlerRightMesh, .076, .115, -.03, -.17, -.37);
    } else {
      this.antlerLeftMesh.setMatrixAt(idx, scratchZeroMat);
      this.antlerRightMesh.setMatrixAt(idx, scratchZeroMat);
    }
  }

  metrics() {
    return this.pool.metrics();
  }

  disposePool(): void {
    clearWildlifeActors('deer');
    this.pool.clear();
    for (const m of this.meshes()) m.dispose();
  }
}
