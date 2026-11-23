import {
  BufferGeometry,
  Color,
  DoubleSide,
  Euler,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mobileQuality } from './sceneBudget.ts';
import {
  buildLeafBladeClusterGeometry,
  buildStylizedBranchGeometry,
  buildStylizedLeafClusterGeometry,
  buildStylizedTieredCanopyGeometry,
  buildStylizedTrunkGeometry,
  createStylizedBarkTexture,
} from './stylizedTreeGeometry.ts';
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
  // Village / Ward / Zombie Forest shared stylized sculpted geometries
  readonly largeTrunkGeo: BufferGeometry;
  readonly largeBranchGeo: BufferGeometry;
  readonly largeCrownMainGeo: BufferGeometry;
  readonly largeCrownSideGeo: BufferGeometry;
  readonly canopyTrunkGeo: BufferGeometry;
  readonly canopyBranchGeo: BufferGeometry;
  readonly canopyCrownPrimaryGeo: BufferGeometry;
  readonly canopyCrownSecondaryGeo: BufferGeometry;
  readonly farmTrunkGeo: BufferGeometry;
  readonly farmCanopyGeo: BufferGeometry;
  // Mountain Forest shared stylized sculpted geometries
  readonly mountainTrunkGeo: BufferGeometry;
  readonly mountainPineLowGeo: BufferGeometry;
  readonly mountainPineTopGeo: BufferGeometry;
  readonly mountainBroadCanopyGeo: BufferGeometry;
  readonly mountainGrassTuftGeo: BufferGeometry;
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
let singletonBarkTexture: ReturnType<typeof createStylizedBarkTexture> | null = null;
let cacheCreationCount = 0;

function foliageMaterial(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, vertexColors: true, roughness: 0.9, side: DoubleSide });
}

export function getTreeAssetCache(): TreeAssetCache {
  if (singletonTreeCache) return singletonTreeCache;

  const lowPoly = mobileQuality;
  cacheCreationCount += 1;
  singletonBarkTexture = createStylizedBarkTexture();

  singletonTreeCache = Object.freeze({
    id: `tree-singleton-cache-${cacheCreationCount}`,
    createdAt: Date.now(),

    // Village / Ward / Zombie Forest sculpted trunks (with 5 flared buttress roots + curved limbs) & layered leafy tufts
    largeTrunkGeo: buildStylizedTrunkGeometry({
      height: 11,
      bottomRadius: 1.0,
      topRadius: 0.56,
      rootSpread: 2.35,
      radialSegs: lowPoly ? 7 : 9,
      heightSegs: lowPoly ? 4 : 6,
      branches: [
        { startYFrac: 0.65, angleRad: Math.PI * 0.66, reach: 2.4, rise: 1.7, radius: 0.38 },
        { startYFrac: 0.78, angleRad: Math.PI * 1.18, reach: 2.1, rise: 3.1, radius: 0.39 },
      ],
    }),
    largeBranchGeo: buildStylizedBranchGeometry(0.22, 0.46, 5, lowPoly ? 6 : 7),
    largeCrownMainGeo: buildLeafBladeClusterGeometry({
      radius: 6.2,
      heightScale: 0.88,
      lobes: lowPoly ? 26 : 47,
      seed: 101,
      lowPoly,
    }),
    largeCrownSideGeo: buildLeafBladeClusterGeometry({
      radius: 3.8,
      heightScale: 0.82,
      lobes: lowPoly ? 19 : 34,
      seed: 202,
      lowPoly,
    }),

    canopyTrunkGeo: buildStylizedTrunkGeometry({
      height: 8,
      bottomRadius: 0.92,
      topRadius: 0.42,
      rootSpread: 2.1,
      radialSegs: lowPoly ? 7 : 9,
      heightSegs: lowPoly ? 4 : 5,
    }),
    canopyBranchGeo: buildStylizedBranchGeometry(0.2, 0.38, Math.hypot(9, 4), lowPoly ? 6 : 7),
    canopyCrownPrimaryGeo: buildLeafBladeClusterGeometry({
      radius: 6.0,
      heightScale: 0.82,
      lobes: lowPoly ? 24 : 43,
      seed: 303,
      lowPoly,
    }),
    canopyCrownSecondaryGeo: buildLeafBladeClusterGeometry({
      radius: 5.3,
      heightScale: 0.84,
      lobes: lowPoly ? 19 : 34,
      seed: 404,
      lowPoly,
    }),

    farmTrunkGeo: buildStylizedTrunkGeometry({
      height: 13.8,
      bottomRadius: 0.85,
      topRadius: 0.38,
      rootSpread: 1.95,
      radialSegs: lowPoly ? 7 : 8,
      heightSegs: lowPoly ? 4 : 5,
      branches: [
        { startYFrac: 0.56, angleRad: Math.PI * 0.95, reach: 4.8, rise: 2.7, radius: 0.34 },
        { startYFrac: 0.62, angleRad: 0.12, reach: 4.6, rise: 2.9, radius: 0.31 },
        { startYFrac: 0.61, angleRad: Math.PI * 0.58, reach: 2.9, rise: 2.1, radius: 0.26 },
      ],
    }),
    farmCanopyGeo: buildStylizedTieredCanopyGeometry({
      scale: 1.42,
      lowPoly,
      seed: 505,
      leafBlades: true,
    }),

    // Mountain stands repeat hundreds of crowns, so use the lighter sculpted foliage meshes.
    mountainTrunkGeo: buildStylizedTrunkGeometry({
      height: 8.2,
      bottomRadius: 0.72,
      topRadius: 0.36,
      rootSpread: 1.72,
      radialSegs: lowPoly ? 6 : 8,
      heightSegs: lowPoly ? 4 : 5,
      branches: [
        { startYFrac: 0.45, angleRad: Math.PI * 0.92, reach: 2.35, rise: 0.85, radius: 0.26 },
        { startYFrac: 0.58, angleRad: -0.15, reach: 2.2, rise: 1.2, radius: 0.24 },
        { startYFrac: 0.72, angleRad: Math.PI * 0.72, reach: 1.45, rise: 1.15, radius: 0.22 },
      ],
    }),
    mountainPineLowGeo: buildStylizedTieredCanopyGeometry({
      scale: 1.05,
      lowPoly: true,
      seed: 606,
      includeTopCrown: false,
      includeLowerTufts: true,
    }),
    mountainPineTopGeo: buildStylizedTieredCanopyGeometry({
      scale: 1.05,
      lowPoly: true,
      seed: 707,
      includeTopCrown: true,
      includeLowerTufts: false,
    }),
    mountainBroadCanopyGeo: buildStylizedTieredCanopyGeometry({
      scale: 1.22,
      lowPoly: true,
      seed: 808,
      includeTopCrown: true,
      includeLowerTufts: true,
    }),
    mountainGrassTuftGeo: buildStylizedLeafClusterGeometry({
      radius: 1.0,
      heightScale: 0.78,
      lobes: lowPoly ? 6 : 9,
      seed: 909,
      lowPoly: true,
    }),

    // Shared painterly materials (vertexColors: true drives the golden-brown bark & lime->emerald->forest foliage!)
    barkLargeMat: new MeshStandardMaterial({ color: '#ffffff', map: singletonBarkTexture, vertexColors: true, roughness: 0.94 }),
    barkCanopyMat: new MeshStandardMaterial({ color: '#fbf4ea', map: singletonBarkTexture, vertexColors: true, roughness: 0.94 }),
    barkFarmMat: new MeshStandardMaterial({ color: '#f7efe3', map: singletonBarkTexture, vertexColors: true, roughness: 0.94 }),
    foliageLargeEvenMat: foliageMaterial('#ffffff'),
    foliageLargeOddMat: foliageMaterial('#ebf8e4'),
    foliageLargeSideMat: foliageMaterial('#f7ffec'),
    foliageCanopyEvenMat: foliageMaterial('#ffffff'),
    foliageCanopyOddMat: foliageMaterial('#e6f5e1'),
    foliageCanopySecondaryMat: foliageMaterial('#f8ffeb'),
    foliageFarmMat: foliageMaterial('#ffffff'),
    instancedCanopyStandardMat: foliageMaterial('#ffffff'),
    mountainBarkMat: new MeshLambertMaterial({ color: '#ffffff', map: singletonBarkTexture, vertexColors: true }),
    mountainFoliageInstancedMat: new MeshLambertMaterial({ color: '#ffffff', vertexColors: true }),
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
  if (singletonBarkTexture) {
    singletonBarkTexture.dispose();
    singletonBarkTexture = null;
  }
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

  get renderCount(): number {
    // Active indices can be sparse after releases. Keep the last live slot in the draw range.
    let count = 0;
    for (const index of this.activeById.values()) count = Math.max(count, index + 1);
    return count;
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
  activeRadius?: number;
};

export const DEFAULT_MOUNTAIN_FOREST_POOL_CONFIG: MountainForestPoolConfig = mobileQuality
  ? { pineCapacity: 128, broadCapacity: 80, grassCapacity: 120, syncMoveThreshold: 32, activeRadius: 550 }
  : { pineCapacity: 240, broadCapacity: 144, grassCapacity: 240, syncMoveThreshold: 28, activeRadius: 850 };

// Gentle bright tint multipliers so baked lime->emerald->deep-forest vertex colors shine vividly!
const PINE_GREENS = ['#ffffff', '#f3ffe9', '#e8f9df', '#fcffe8', '#edf8e3'] as const;
const TOP_GREENS = ['#ffffff', '#f7ffec', '#eefbe4', '#fdffea', '#f2fde8'] as const;
const BROAD_GREENS = ['#ffffff', '#f4ffea', '#e8f7df', '#fbffe8', '#effae5'] as const;
const GRASS_GREENS = ['#ffffff', '#f4ffea', '#e8f9df', '#fbffe9', '#eefbe4'] as const;

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

export function countNearestInRange(
  scored: readonly { distSq: number }[],
  limit: number,
  radius = Infinity,
): number {
  const maxDistanceSq = radius * radius;
  const maxCount = Math.min(limit, scored.length);
  let count = 0;
  while (count < maxCount && scored[count].distSq <= maxDistanceSq) count++;
  return count;
}

export function updatePooledInstances(meshes: readonly InstancedMesh[], count: number): void {
  for (const mesh of meshes) {
    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function selectNearestIndices<T extends { x: number; z: number }>(
  items: readonly T[],
  focusX: number,
  focusZ: number,
  limit: number,
  scratchScored: ScoredIndex[],
  radius: number | undefined,
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
  scratchScored.length = n;
  scratchScored.sort((a, b) => a.distSq - b.distSq);
  return countNearestInRange(scratchScored, limit, radius);
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
      m.count = 0;
      m.visible = false;
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
    const take = selectNearestIndices(this.pines, focusX, focusZ, this.pinePool.capacity, this.pineScored, this.config.activeRadius);
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

        scratchMat.compose(scratchPos.set(t.x, t.y + 4.1 * t.scale, t.z), scratchQuat, scratchScale);
        this.pineTrunkMesh.setMatrixAt(slot.index, scratchMat);

        scratchMat.compose(scratchPos.set(t.x, t.y + 6.9 * t.scale, t.z), scratchQuat, scratchScale);
        this.pineLowMesh.setMatrixAt(slot.index, scratchMat);
        this.pineLowMesh.setColorAt(slot.index, scratchColor.set(PINE_GREENS[t.tintIndex % PINE_GREENS.length]));

        scratchMat.compose(scratchPos.set(t.x, t.y + 8.1 * t.scale, t.z), scratchQuat, scratchScale);
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
      updatePooledInstances([this.pineTrunkMesh, this.pineLowMesh, this.pineTopMesh], this.pinePool.renderCount);
    }
  }

  private syncBroads(focusX: number, focusZ: number): void {
    const take = selectNearestIndices(this.broads, focusX, focusZ, this.broadPool.capacity, this.broadScored, this.config.activeRadius);
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
          scratchPos.set(t.x, t.y + 4.1 * t.scale, t.z),
          scratchQuat,
          scratchScale.set(t.scale, t.scale, t.scale),
        );
        this.broadTrunkMesh.setMatrixAt(slot.index, scratchMat);

        scratchMat.compose(
          scratchPos.set(t.x, t.y + 7.4 * t.scale, t.z),
          scratchQuat,
          scratchScale.set(t.scale * 1.08, t.scale * 1.02, t.scale * 1.08),
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
      updatePooledInstances([this.broadTrunkMesh, this.broadCanopyMesh], this.broadPool.renderCount);
    }
  }

  private syncGrass(focusX: number, focusZ: number): void {
    const take = selectNearestIndices(this.grassTufts, focusX, focusZ, this.grassPool.capacity, this.grassScored, this.config.activeRadius);
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
      updatePooledInstances([this.grassMesh], this.grassPool.renderCount);
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
