import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mobileQuality } from './sceneBudget.ts';
import type { MountainGrassTuftPlot, MountainTreePlot } from './weipulaClimb.ts';

/**
 * ============================================================================
 * 1. SINGLETON MEMORY REFERENCE CACHE (Zero Geometry / Material Duplication)
 * ============================================================================
 * Guarantees that EVERY tree across all villages, wards, Zombie Forest,
 * Asset Previewer, and Maha Weipula Mountain shares ONE single GPU geometry
 * & material memory reference per part — never allocating duplicate buffers.
 */
export interface TreeAssetCache {
  readonly id: string;
  readonly createdAt: number;
  // Village / Ward / Zombie Forest shared geometries
  readonly largeTrunkGeo: CylinderGeometry;
  readonly largeBranchGeo: CylinderGeometry;
  readonly largeCrownMainGeo: IcosahedronGeometry;
  readonly largeCrownSideGeo: IcosahedronGeometry;
  readonly canopyTrunkGeo: CylinderGeometry;
  readonly canopyBranchGeo: CylinderGeometry;
  readonly canopyCrownPrimaryGeo: IcosahedronGeometry;
  readonly canopyCrownSecondaryGeo: IcosahedronGeometry;
  readonly farmTrunkGeo: CylinderGeometry;
  readonly farmCanopyGeo: IcosahedronGeometry;
  // Mountain Forest shared geometries
  readonly mountainTrunkGeo: CylinderGeometry;
  readonly mountainPineLowGeo: ConeGeometry;
  readonly mountainPineTopGeo: ConeGeometry;
  readonly mountainBroadCanopyGeo: DodecahedronGeometry;
  readonly mountainGrassTuftGeo: DodecahedronGeometry;
  // Shared materials (by reference — never recreated per tree)
  readonly barkLargeMat: MeshStandardMaterial;
  readonly barkCanopyMat: MeshStandardMaterial;
  readonly barkFarmMat: MeshStandardMaterial;
  readonly foliageLargeEvenMat: MeshStandardMaterial;
  readonly foliageLargeOddMat: MeshStandardMaterial;
  readonly foliageLargeSideMat: MeshStandardMaterial;
  readonly foliageCanopyEvenMat: MeshStandardMaterial;
  readonly foliageCanopyOddMat: MeshStandardMaterial;
  readonly foliageCanopySecondaryMat: MeshStandardMaterial;
  readonly foliageFarmMat: MeshStandardMaterial;
  readonly instancedCanopyStandardMat: MeshStandardMaterial;
  readonly mountainBarkMat: MeshLambertMaterial;
  readonly mountainFoliageInstancedMat: MeshLambertMaterial;
}

let singletonTreeCache: TreeAssetCache | null = null;
let cacheCreationCount = 0;

export function getTreeAssetCache(): TreeAssetCache {
  if (singletonTreeCache) return singletonTreeCache;

  const icosaDetail = mobileQuality ? 0 : 1;
  const coneSegs = mobileQuality ? 5 : 6;
  cacheCreationCount += 1;

  singletonTreeCache = Object.freeze({
    id: `tree-singleton-cache-${cacheCreationCount}`,
    createdAt: Date.now(),

    // Village / Ward / Zombie Forest unit-radius trunk & foliage geometries
    largeTrunkGeo: new CylinderGeometry(0.55, 1.0, 11, 10),
    largeBranchGeo: new CylinderGeometry(0.2, 0.45, 5, 7),
    largeCrownMainGeo: new IcosahedronGeometry(6.5, icosaDetail),
    largeCrownSideGeo: new IcosahedronGeometry(3.8, icosaDetail),

    canopyTrunkGeo: new CylinderGeometry(0.32, 1.0, 8, 8),
    canopyBranchGeo: new CylinderGeometry(0.18, 0.35, Math.hypot(9, 4), 7),
    canopyCrownPrimaryGeo: new IcosahedronGeometry(6.3, icosaDetail),
    canopyCrownSecondaryGeo: new IcosahedronGeometry(5.8, icosaDetail),

    farmTrunkGeo: new CylinderGeometry(0.3, 1.0, 11.5, 8),
    farmCanopyGeo: new IcosahedronGeometry(3.6, icosaDetail),

    // Mountain Forest geometries
    mountainTrunkGeo: new CylinderGeometry(0.28, 0.56, 8.2, 6),
    mountainPineLowGeo: new ConeGeometry(3.9, 6.4, coneSegs),
    mountainPineTopGeo: new ConeGeometry(2.7, 5.4, coneSegs),
    mountainBroadCanopyGeo: new DodecahedronGeometry(4.4, 0),
    mountainGrassTuftGeo: new DodecahedronGeometry(1, 0),

    // Shared materials (strictly singletons)
    barkLargeMat: new MeshStandardMaterial({ color: '#71543b', roughness: 1 }),
    barkCanopyMat: new MeshStandardMaterial({ color: '#796043' }),
    barkFarmMat: new MeshStandardMaterial({ color: '#795d3b' }),
    foliageLargeEvenMat: new MeshStandardMaterial({ color: '#567e47', roughness: 1 }),
    foliageLargeOddMat: new MeshStandardMaterial({ color: '#486e40', roughness: 1 }),
    foliageLargeSideMat: new MeshStandardMaterial({ color: '#62874b', roughness: 1 }),
    foliageCanopyEvenMat: new MeshStandardMaterial({ color: '#628850' }),
    foliageCanopyOddMat: new MeshStandardMaterial({ color: '#497954' }),
    foliageCanopySecondaryMat: new MeshStandardMaterial({ color: '#759555' }),
    foliageFarmMat: new MeshStandardMaterial({ color: '#547b48' }),
    instancedCanopyStandardMat: new MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
    mountainBarkMat: new MeshLambertMaterial({ color: '#5e432c' }),
    mountainFoliageInstancedMat: new MeshLambertMaterial({ color: '#ffffff' }),
  });

  return singletonTreeCache;
}

export function getTreeAssetCacheStats() {
  return {
    initialized: singletonTreeCache !== null,
    creationCount: cacheCreationCount,
    geometryCount: singletonTreeCache ? 15 : 0,
    materialCount: singletonTreeCache ? 13 : 0,
  };
}

/** Disposes the singleton GPU resources cleanly (e.g. during full teardown or tests). */
export function disposeTreeAssetCache(): void {
  if (!singletonTreeCache) return;
  const c = singletonTreeCache;
  singletonTreeCache = null;
  c.largeTrunkGeo.dispose();
  c.largeBranchGeo.dispose();
  c.largeCrownMainGeo.dispose();
  c.largeCrownSideGeo.dispose();
  c.canopyTrunkGeo.dispose();
  c.canopyBranchGeo.dispose();
  c.canopyCrownPrimaryGeo.dispose();
  c.canopyCrownSecondaryGeo.dispose();
  c.farmTrunkGeo.dispose();
  c.farmCanopyGeo.dispose();
  c.mountainTrunkGeo.dispose();
  c.mountainPineLowGeo.dispose();
  c.mountainPineTopGeo.dispose();
  c.mountainBroadCanopyGeo.dispose();
  c.mountainGrassTuftGeo.dispose();
  c.barkLargeMat.dispose();
  c.barkCanopyMat.dispose();
  c.barkFarmMat.dispose();
  c.foliageLargeEvenMat.dispose();
  c.foliageLargeOddMat.dispose();
  c.foliageLargeSideMat.dispose();
  c.foliageCanopyEvenMat.dispose();
  c.foliageCanopyOddMat.dispose();
  c.foliageCanopySecondaryMat.dispose();
  c.foliageFarmMat.dispose();
  c.instancedCanopyStandardMat.dispose();
  c.mountainBarkMat.dispose();
  c.mountainFoliageInstancedMat.dispose();
}

/**
 * ============================================================================
 * 2. FIXED OBJECT POOL (Bounded Pre-Allocated Slot Recycling, Zero Churn)
 * ============================================================================
 * Pre-allocates a strictly fixed array of `capacity` reusable slots ONCE.
 * Active visible entities acquire/recycle slots in O(1) without ever cloning
 * or growing memory past `capacity`.
 */
export type FixedPoolSlot<T> = {
  readonly index: number;
  ownerId: string | null;
  value: T;
};

export type FixedPoolMetrics = {
  capacity: number;
  activeCount: number;
  freeCount: number;
  totalAcquires: number;
  totalRecycles: number;
};

export class FixedObjectPool<T> {
  readonly capacity: number;
  private readonly slots: FixedPoolSlot<T>[];
  private readonly freeIndices: number[];
  private readonly activeById = new Map<string, number>();
  private totalAcquires = 0;
  private totalRecycles = 0;

  constructor(capacity: number, factory: (index: number) => T) {
    this.capacity = Math.max(0, Math.floor(capacity));
    this.slots = new Array(this.capacity);
    this.freeIndices = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.slots[i] = { index: i, ownerId: null, value: factory(i) };
      // Pop from end gives indices 0, 1, 2, ... in ascending order
      this.freeIndices[this.capacity - 1 - i] = i;
    }
  }

  get activeCount(): number {
    return this.activeById.size;
  }

  get freeCount(): number {
    return this.freeIndices.length;
  }

  getSlot(ownerId: string): FixedPoolSlot<T> | undefined {
    const idx = this.activeById.get(ownerId);
    return idx === undefined ? undefined : this.slots[idx];
  }

  getSlotByIndex(index: number): FixedPoolSlot<T> {
    return this.slots[index];
  }

  acquire(ownerId: string): FixedPoolSlot<T> | null {
    const existingIdx = this.activeById.get(ownerId);
    if (existingIdx !== undefined) return this.slots[existingIdx];
    if (this.freeIndices.length === 0) return null;
    const idx = this.freeIndices.pop()!;
    const slot = this.slots[idx];
    const wasRecycled = this.totalAcquires >= this.capacity;
    slot.ownerId = ownerId;
    this.activeById.set(ownerId, idx);
    this.totalAcquires += 1;
    if (wasRecycled) this.totalRecycles += 1;
    return slot;
  }

  release(ownerId: string, onRelease?: (slot: FixedPoolSlot<T>) => void): boolean {
    const idx = this.activeById.get(ownerId);
    if (idx === undefined) return false;
    this.activeById.delete(ownerId);
    const slot = this.slots[idx];
    slot.ownerId = null;
    onRelease?.(slot);
    this.freeIndices.push(idx);
    return true;
  }

  /**
   * Reconciles active pool slots against `desiredIds` (capped at `capacity`):
   *  1) Releases slots whose ownerId is no longer in `desiredSet` (freeing them for reuse)
   *  2) Acquires recycled slots for newly visible ownerIds and invokes `onAssign`
   */
  syncActive(
    desiredIds: readonly string[],
    onAssign: (slot: FixedPoolSlot<T>, desiredIndex: number) => void,
    onRelease?: (slot: FixedPoolSlot<T>) => void,
  ): { assigned: number; released: number } {
    const limit = Math.min(this.capacity, desiredIds.length);
    const desiredSet = new Set<string>();
    for (let i = 0; i < limit; i++) desiredSet.add(desiredIds[i]);

    let released = 0;
    for (const activeId of [...this.activeById.keys()]) {
      if (!desiredSet.has(activeId)) {
        if (this.release(activeId, onRelease)) released += 1;
      }
    }

    let assigned = 0;
    for (let i = 0; i < limit; i++) {
      const id = desiredIds[i];
      if (!this.activeById.has(id)) {
        const slot = this.acquire(id);
        if (slot) {
          onAssign(slot, i);
          assigned += 1;
        }
      }
    }
    return { assigned, released };
  }

  forEachActive(fn: (slot: FixedPoolSlot<T>) => void): void {
    for (const idx of this.activeById.values()) {
      fn(this.slots[idx]);
    }
  }

  clear(onRelease?: (slot: FixedPoolSlot<T>) => void): void {
    for (const idx of this.activeById.values()) {
      const slot = this.slots[idx];
      slot.ownerId = null;
      onRelease?.(slot);
      this.freeIndices.push(idx);
    }
    this.activeById.clear();
  }

  metrics(): FixedPoolMetrics {
    return {
      capacity: this.capacity,
      activeCount: this.activeById.size,
      freeCount: this.freeIndices.length,
      totalAcquires: this.totalAcquires,
      totalRecycles: this.totalRecycles,
    };
  }
}

/**
 * ============================================================================
 * 3. FIXED MOUNTAIN FOREST OBJECT POOL (Zero-Allocation Camera-Driven Recycling)
 * ============================================================================
 * Keeps a strictly fixed number of pre-allocated GPU InstancedMesh slots backed
 * by the Singleton Cache geometries & materials, recycling distant slots as the
 * camera/player moves around Maha Weipula Mountain.
 */
export type MountainForestPoolConfig = {
  pineCapacity: number;
  broadCapacity: number;
  grassCapacity: number;
  syncMoveThreshold?: number;
};

export const DEFAULT_MOUNTAIN_FOREST_POOL_CONFIG: MountainForestPoolConfig = mobileQuality
  ? { pineCapacity: 240, broadCapacity: 160, grassCapacity: 180, syncMoveThreshold: 32 }
  : { pineCapacity: 520, broadCapacity: 320, grassCapacity: 360, syncMoveThreshold: 28 };

const PINE_GREENS = ['#2a7d3b', '#348f44', '#236e34', '#3fa04d', '#2e843f'] as const;
const TOP_GREENS = ['#43a84e', '#4fb557', '#389643', '#59be5d', '#47ad52'] as const;
const BROAD_GREENS = ['#3a9142', '#47a34b', '#2e7e38', '#52b053', '#3e9946'] as const;
const GRASS_GREENS = ['#54a842', '#64ba4c', '#48993b', '#72c456', '#4ea340'] as const;

// Pre-allocated zero-GC scratch math objects shared across all pool sync passes
const scratchMat = new Matrix4();
const scratchZeroMat = new Matrix4().makeScale(0, 0, 0);
const scratchPos = new Vector3();
const scratchQuat = new Quaternion();
const scratchScale = new Vector3();
const scratchEuler = new Euler();
const scratchColor = new Color();
const scratchYAxis = new Vector3(0, 1, 0);

type ScoredIndex = { idx: number; distSq: number };

function selectNearestIndices<T extends { x: number; z: number }>(
  items: readonly T[],
  focusX: number,
  focusZ: number,
  limit: number,
  scratchScored: ScoredIndex[],
): number {
  const n = items.length;
  if (n === 0 || limit <= 0) return 0;
  if (scratchScored.length < n) {
    for (let i = scratchScored.length; i < n; i++) {
      scratchScored.push({ idx: i, distSq: 0 });
    }
  }
  for (let i = 0; i < n; i++) {
    const dx = items[i].x - focusX;
    const dz = items[i].z - focusZ;
    scratchScored[i].idx = i;
    scratchScored[i].distSq = dx * dx + dz * dz;
  }
  // Truncate sort view to active items count without reallocating array
  const activeSlice = scratchScored.slice(0, n);
  activeSlice.sort((a, b) => a.distSq - b.distSq);
  const take = Math.min(limit, n);
  for (let i = 0; i < take; i++) {
    scratchScored[i] = activeSlice[i];
  }
  return take;
}

export class MountainForestFixedPool {
  readonly cache: TreeAssetCache;
  readonly config: MountainForestPoolConfig;
  readonly pinePool: FixedObjectPool<number>;
  readonly broadPool: FixedObjectPool<number>;
  readonly grassPool: FixedObjectPool<number>;

  readonly pines: readonly MountainTreePlot[];
  readonly broads: readonly MountainTreePlot[];
  readonly grassTufts: readonly MountainGrassTuftPlot[];

  // Fixed pre-allocated GPU InstancedMeshes backed strictly by Singleton Cache references
  readonly pineTrunkMesh: InstancedMesh;
  readonly pineLowMesh: InstancedMesh;
  readonly pineTopMesh: InstancedMesh;
  readonly broadTrunkMesh: InstancedMesh;
  readonly broadCanopyMesh: InstancedMesh;
  readonly grassMesh: InstancedMesh;

  private lastFocusX = Number.NaN;
  private lastFocusZ = Number.NaN;
  private readonly pineScored: ScoredIndex[] = [];
  private readonly broadScored: ScoredIndex[] = [];
  private readonly grassScored: ScoredIndex[] = [];
  private readonly desiredIdsScratch: string[] = [];
  private readonly desiredIndexById = new Map<string, number>();

  constructor(
    trees: readonly MountainTreePlot[],
    grassTufts: readonly MountainGrassTuftPlot[],
    config: MountainForestPoolConfig = DEFAULT_MOUNTAIN_FOREST_POOL_CONFIG,
  ) {
    this.cache = getTreeAssetCache();
    this.config = config;

    this.pines = trees.filter(t => t.kind === 'pine');
    this.broads = trees.filter(t => t.kind === 'broad');
    this.grassTufts = grassTufts;

    const pineCap = Math.min(config.pineCapacity, Math.max(1, this.pines.length));
    const broadCap = Math.min(config.broadCapacity, Math.max(1, this.broads.length));
    const grassCap = Math.min(config.grassCapacity, Math.max(1, this.grassTufts.length));

    this.pinePool = new FixedObjectPool<number>(pineCap, i => i);
    this.broadPool = new FixedObjectPool<number>(broadCap, i => i);
    this.grassPool = new FixedObjectPool<number>(grassCap, i => i);

    // Allocate fixed GPU instance buffers ONCE using Singleton Cache references
    this.pineTrunkMesh = new InstancedMesh(this.cache.mountainTrunkGeo, this.cache.mountainBarkMat, pineCap);
    this.pineLowMesh = new InstancedMesh(this.cache.mountainPineLowGeo, this.cache.mountainFoliageInstancedMat, pineCap);
    this.pineTopMesh = new InstancedMesh(this.cache.mountainPineTopGeo, this.cache.mountainFoliageInstancedMat, pineCap);
    this.broadTrunkMesh = new InstancedMesh(this.cache.mountainTrunkGeo, this.cache.mountainBarkMat, broadCap);
    this.broadCanopyMesh = new InstancedMesh(this.cache.mountainBroadCanopyGeo, this.cache.mountainFoliageInstancedMat, broadCap);
    this.grassMesh = new InstancedMesh(this.cache.mountainGrassTuftGeo, this.cache.mountainFoliageInstancedMat, grassCap);

    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.count = m.instanceMatrix.count;
      // Hide all pre-allocated pool slots until acquired
      for (let i = 0; i < m.instanceMatrix.count; i++) {
        m.setMatrixAt(i, scratchZeroMat);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  }

  meshes(): readonly InstancedMesh[] {
    return [
      this.pineTrunkMesh,
      this.pineLowMesh,
      this.pineTopMesh,
      this.broadTrunkMesh,
      this.broadCanopyMesh,
      this.grassMesh,
    ];
  }

  /**
   * Synchronizes the fixed pool slots to the camera/player focus position.
   * Skips work completely when focus has moved less than `syncMoveThreshold` meters.
   */
  syncToFocus(focusX: number, focusZ: number, force = false): boolean {
    const threshold = this.config.syncMoveThreshold ?? 28;
    if (
      !force &&
      Number.isFinite(this.lastFocusX) &&
      Math.hypot(focusX - this.lastFocusX, focusZ - this.lastFocusZ) < threshold
    ) {
      return false;
    }
    this.lastFocusX = focusX;
    this.lastFocusZ = focusZ;

    this.syncPines(focusX, focusZ);
    this.syncBroads(focusX, focusZ);
    this.syncGrass(focusX, focusZ);
    return true;
  }

  private syncPines(focusX: number, focusZ: number): void {
    const take = selectNearestIndices(this.pines, focusX, focusZ, this.pinePool.capacity, this.pineScored);
    this.desiredIdsScratch.length = take;
    this.desiredIndexById.clear();
    for (let i = 0; i < take; i++) {
      const srcIdx = this.pineScored[i].idx;
      const id = this.pines[srcIdx].id;
      this.desiredIdsScratch[i] = id;
      this.desiredIndexById.set(id, srcIdx);
    }

    const { assigned, released } = this.pinePool.syncActive(
      this.desiredIdsScratch,
      slot => {
        const srcIdx = this.desiredIndexById.get(slot.ownerId!)!;
        const t = this.pines[srcIdx];
        scratchQuat.setFromAxisAngle(scratchYAxis, (srcIdx * 2.13) % (Math.PI * 2));
        scratchScale.set(t.scale, t.scale, t.scale);

        scratchMat.compose(scratchPos.set(t.x, t.y + 4.0 * t.scale, t.z), scratchQuat, scratchScale);
        this.pineTrunkMesh.setMatrixAt(slot.index, scratchMat);

        scratchMat.compose(scratchPos.set(t.x, t.y + 7.2 * t.scale, t.z), scratchQuat, scratchScale);
        this.pineLowMesh.setMatrixAt(slot.index, scratchMat);
        this.pineLowMesh.setColorAt(slot.index, scratchColor.set(PINE_GREENS[t.tintIndex % PINE_GREENS.length]));

        scratchMat.compose(scratchPos.set(t.x, t.y + 11.4 * t.scale, t.z), scratchQuat, scratchScale);
        this.pineTopMesh.setMatrixAt(slot.index, scratchMat);
        this.pineTopMesh.setColorAt(slot.index, scratchColor.set(TOP_GREENS[t.tintIndex % TOP_GREENS.length]));
      },
      slot => {
        this.pineTrunkMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.pineLowMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.pineTopMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );

    if (assigned > 0 || released > 0) {
      this.pineTrunkMesh.instanceMatrix.needsUpdate = true;
      this.pineLowMesh.instanceMatrix.needsUpdate = true;
      this.pineTopMesh.instanceMatrix.needsUpdate = true;
      if (this.pineLowMesh.instanceColor) this.pineLowMesh.instanceColor.needsUpdate = true;
      if (this.pineTopMesh.instanceColor) this.pineTopMesh.instanceColor.needsUpdate = true;
    }
  }

  private syncBroads(focusX: number, focusZ: number): void {
    const take = selectNearestIndices(this.broads, focusX, focusZ, this.broadPool.capacity, this.broadScored);
    this.desiredIdsScratch.length = take;
    this.desiredIndexById.clear();
    for (let i = 0; i < take; i++) {
      const srcIdx = this.broadScored[i].idx;
      const id = this.broads[srcIdx].id;
      this.desiredIdsScratch[i] = id;
      this.desiredIndexById.set(id, srcIdx);
    }

    const { assigned, released } = this.broadPool.syncActive(
      this.desiredIdsScratch,
      slot => {
        const srcIdx = this.desiredIndexById.get(slot.ownerId!)!;
        const t = this.broads[srcIdx];
        scratchQuat.setFromAxisAngle(scratchYAxis, (srcIdx * 1.91) % (Math.PI * 2));

        scratchMat.compose(
          scratchPos.set(t.x, t.y + 4.0 * t.scale, t.z),
          scratchQuat,
          scratchScale.set(t.scale, t.scale, t.scale),
        );
        this.broadTrunkMesh.setMatrixAt(slot.index, scratchMat);

        scratchMat.compose(
          scratchPos.set(t.x, t.y + 8.4 * t.scale, t.z),
          scratchQuat,
          scratchScale.set(t.scale * 1.15, t.scale * 0.92, t.scale * 1.15),
        );
        this.broadCanopyMesh.setMatrixAt(slot.index, scratchMat);
        this.broadCanopyMesh.setColorAt(slot.index, scratchColor.set(BROAD_GREENS[t.tintIndex % BROAD_GREENS.length]));
      },
      slot => {
        this.broadTrunkMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.broadCanopyMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );

    if (assigned > 0 || released > 0) {
      this.broadTrunkMesh.instanceMatrix.needsUpdate = true;
      this.broadCanopyMesh.instanceMatrix.needsUpdate = true;
      if (this.broadCanopyMesh.instanceColor) this.broadCanopyMesh.instanceColor.needsUpdate = true;
    }
  }

  private syncGrass(focusX: number, focusZ: number): void {
    const take = selectNearestIndices(this.grassTufts, focusX, focusZ, this.grassPool.capacity, this.grassScored);
    this.desiredIdsScratch.length = take;
    this.desiredIndexById.clear();
    for (let i = 0; i < take; i++) {
      const srcIdx = this.grassScored[i].idx;
      const id = this.grassTufts[srcIdx].id;
      this.desiredIdsScratch[i] = id;
      this.desiredIndexById.set(id, srcIdx);
    }

    const { assigned, released } = this.grassPool.syncActive(
      this.desiredIdsScratch,
      slot => {
        const srcIdx = this.desiredIndexById.get(slot.ownerId!)!;
        const g = this.grassTufts[srcIdx];
        scratchQuat.setFromAxisAngle(scratchYAxis, g.rotY);
        scratchMat.compose(scratchPos.set(g.x, g.y, g.z), scratchQuat, scratchScale.set(g.sx, g.sy, g.sz));
        this.grassMesh.setMatrixAt(slot.index, scratchMat);
        this.grassMesh.setColorAt(slot.index, scratchColor.set(GRASS_GREENS[g.tintIndex % GRASS_GREENS.length]));
      },
      slot => {
        this.grassMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );

    if (assigned > 0 || released > 0) {
      this.grassMesh.instanceMatrix.needsUpdate = true;
      if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
    }
  }

  metrics() {
    return {
      pines: this.pinePool.metrics(),
      broads: this.broadPool.metrics(),
      grass: this.grassPool.metrics(),
      totalFixedSlots:
        this.pinePool.capacity + this.broadPool.capacity + this.grassPool.capacity,
      totalActiveSlots:
        this.pinePool.activeCount + this.broadPool.activeCount + this.grassPool.activeCount,
    };
  }

  /**
   * Releases pool instance buffers cleanly on unmount WITHOUT disposing
   * the shared Singleton Cache geometries/materials!
   */
  disposePool(): void {
    this.pinePool.clear();
    this.broadPool.clear();
    this.grassPool.clear();
    for (const m of this.meshes()) {
      m.dispose();
    }
  }
}

export { scratchEuler };
