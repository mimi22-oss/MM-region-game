import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { mobileQuality } from './sceneBudget.ts';
import { countNearestInRange, FixedObjectPool, updatePooledInstances } from './treeResourcePool.ts';
import {
  getHighlandPlateauAssetCache,
  type HighlandPlateauAssetCache,
} from './highlandPlateauAssets.ts';
import {
  HIGHLAND_HOUSE_DOOR_HALF_W,
  HIGHLAND_HOUSE_FLOOR_HEIGHT,
  HIGHLAND_HOUSE_WALL_THICKNESS,
  type HighlandPlateauCatalog,
} from './highlandPlateauWorld.ts';

/**
 * ============================================================================
 * Fixed Object Pool for 100+ Highland Plateau Villages, Camps, Ponds, Trails,
 * Boulders & Bushes (Strictly Bounded GPU Memory, O(1) Slot Recycling)
 * ============================================================================
 * Even with 108+ highland settlements, 450+ houses, and 10,000+ flora/rocks,
 * GPU draw calls & instance buffers remain strictly capped at fixed pool
 * capacity — recycling distant slots smoothly around camera/player focus.
 */

export interface HighlandPlateauPoolConfig {
  readonly houseCapacity: number;
  readonly campCapacity: number;
  readonly pondCapacity: number;
  readonly trailCapacity: number;
  readonly boulderCapacity: number;
  readonly bushCapacity: number;
  readonly syncMoveThreshold?: number;
  readonly activeRadius?: number;
}

export const DEFAULT_HIGHLAND_PLATEAU_POOL_CONFIG: HighlandPlateauPoolConfig = mobileQuality
  ? {
      houseCapacity: 64,
      campCapacity: 14,
      pondCapacity: 12,
      trailCapacity: 110,
      boulderCapacity: 140,
      bushCapacity: 180,
      syncMoveThreshold: 30,
      activeRadius: 475,
    }
  : {
      houseCapacity: 160,
      campCapacity: 24,
      pondCapacity: 24,
      trailCapacity: 240,
      boulderCapacity: 320,
      bushCapacity: 420,
      syncMoveThreshold: 26,
      activeRadius: 750,
    };

const WALL_TINTS = ['#7a5635', '#66462c', '#8f6944', '#5c3c24', '#9e7c58'] as const;
const ROOF_TINTS = ['#823c2d', '#3e5e46', '#5c493b', '#9a4332'] as const;
const ROCK_TINTS = ['#a79b86', '#918776', '#b8ab93', '#7f786b'] as const;
const BUSH_TINTS = ['#ffffff', '#f5ffea', '#e8f7df', '#fcffea', '#effae4'] as const;

const scratchMat = new Matrix4();
const scratchZeroMat = new Matrix4().makeScale(0, 0, 0);
const scratchPos = new Vector3();
const scratchQuat = new Quaternion();
const scratchScale = new Vector3();
const scratchColor = new Color();
const scratchYAxis = new Vector3(0, 1, 0);
const scratchXAxis = new Vector3(1, 0, 0);
const scratchTiltQuat = new Quaternion();

type ScoredIndex = { idx: number; distSq: number };

function selectNearest<T extends { x: number; z: number }>(
  items: readonly T[],
  focusX: number,
  focusZ: number,
  limit: number,
  scratch: ScoredIndex[],
  radius: number | undefined,
): number {
  const n = items.length;
  if (n === 0 || limit <= 0) return 0;
  if (scratch.length < n) {
    for (let i = scratch.length; i < n; i++) scratch.push({ idx: i, distSq: 0 });
  } else if (scratch.length > n) {
    scratch.length = n;
  }
  for (let i = 0; i < n; i++) {
    const dx = items[i].x - focusX;
    const dz = items[i].z - focusZ;
    scratch[i].idx = i;
    scratch[i].distSq = dx * dx + dz * dz;
  }
  scratch.sort((a, b) => a.distSq - b.distSq);
  return countNearestInRange(scratch, limit, radius);
}

export class HighlandPlateauFixedPool {
  readonly cache: HighlandPlateauAssetCache;
  readonly config: HighlandPlateauPoolConfig;
  readonly catalog: HighlandPlateauCatalog;

  readonly housePool: FixedObjectPool<number>;
  readonly campPool: FixedObjectPool<number>;
  readonly pondPool: FixedObjectPool<number>;
  readonly trailPool: FixedObjectPool<number>;
  readonly boulderPool: FixedObjectPool<number>;
  readonly bushPool: FixedObjectPool<number>;

  // Strictly bounded InstancedMeshes backed by Singleton Cache references
  // Walk-in Highland House perimeter walls (4 sides + open doorway + lintel + timber door frame)
  readonly houseBackWallMesh: InstancedMesh;
  readonly houseLeftWallMesh: InstancedMesh;
  readonly houseRightWallMesh: InstancedMesh;
  readonly houseFrontLeftWallMesh: InstancedMesh;
  readonly houseFrontRightWallMesh: InstancedMesh;
  readonly houseDoorLintelMesh: InstancedMesh;
  readonly houseDoorFrameLeftMesh: InstancedMesh;
  readonly houseDoorFrameRightMesh: InstancedMesh;
  readonly houseRoofMesh: InstancedMesh;
  readonly houseDeckMesh: InstancedMesh;
  readonly campTentMesh: InstancedMesh;
  readonly campFireRingMesh: InstancedMesh;
  readonly campFlameMesh: InstancedMesh;
  readonly campLogMesh: InstancedMesh;
  readonly campJarMesh: InstancedMesh;
  readonly pondRimMesh: InstancedMesh;
  readonly pondWaterMesh: InstancedMesh;
  readonly trailHubMesh: InstancedMesh;
  readonly trailStripMesh: InstancedMesh;
  readonly boulderMesh: InstancedMesh;
  readonly bushMesh: InstancedMesh;

  private lastFocusX = Number.NaN;
  private lastFocusZ = Number.NaN;
  private readonly scoredScratch: ScoredIndex[] = [];
  private readonly desiredIdsScratch: string[] = [];
  private readonly desiredIndexById = new Map<string, number>();

  constructor(
    catalog: HighlandPlateauCatalog,
    config: HighlandPlateauPoolConfig = DEFAULT_HIGHLAND_PLATEAU_POOL_CONFIG,
  ) {
    this.cache = getHighlandPlateauAssetCache();
    this.config = config;
    this.catalog = catalog;

    const houseCap = Math.min(config.houseCapacity, Math.max(1, catalog.houses.length));
    const campCap = Math.min(config.campCapacity, Math.max(1, catalog.camps.length));
    const pondCap = Math.min(config.pondCapacity, Math.max(1, catalog.ponds.length));
    const trailCap = Math.min(config.trailCapacity, Math.max(1, catalog.trails.length));
    const boulderCap = Math.min(config.boulderCapacity, Math.max(1, catalog.boulders.length));
    const bushCap = Math.min(config.bushCapacity, Math.max(1, catalog.bushes.length));

    this.housePool = new FixedObjectPool<number>(houseCap, (i) => i);
    this.campPool = new FixedObjectPool<number>(campCap, (i) => i);
    this.pondPool = new FixedObjectPool<number>(pondCap, (i) => i);
    this.trailPool = new FixedObjectPool<number>(trailCap, (i) => i);
    this.boulderPool = new FixedObjectPool<number>(boulderCap, (i) => i);
    this.bushPool = new FixedObjectPool<number>(bushCap, (i) => i);

    const ch = this.cache.chinHouseCache;
    const tr = this.cache.treeCache;
    const mo = this.cache.monasteryCache;

    // Walk-in Houses reuse ChinHouseAssetCache geometries & materials directly (zero duplication!)
    this.houseBackWallMesh = new InstancedMesh(ch.unitBoxGeo, ch.instancedWallMat, houseCap);
    this.houseLeftWallMesh = new InstancedMesh(ch.unitBoxGeo, ch.instancedWallMat, houseCap);
    this.houseRightWallMesh = new InstancedMesh(ch.unitBoxGeo, ch.instancedWallMat, houseCap);
    this.houseFrontLeftWallMesh = new InstancedMesh(ch.unitBoxGeo, ch.instancedWallMat, houseCap);
    this.houseFrontRightWallMesh = new InstancedMesh(ch.unitBoxGeo, ch.instancedWallMat, houseCap);
    this.houseDoorLintelMesh = new InstancedMesh(ch.unitBoxGeo, ch.instancedWallMat, houseCap);
    this.houseDoorFrameLeftMesh = new InstancedMesh(ch.unitBoxGeo, ch.doorFrameMat, houseCap);
    this.houseDoorFrameRightMesh = new InstancedMesh(ch.unitBoxGeo, ch.doorFrameMat, houseCap);
    this.houseRoofMesh = new InstancedMesh(this.cache.houseRoofGeo, ch.instancedRoofMat, houseCap);
    this.houseDeckMesh = new InstancedMesh(ch.unitBoxGeo, ch.verandaDeckMat, houseCap);

    // Base Camps (Tent + Stone Campfire Ring + Flame + Firewood Log Stack + Water Jar)
    this.campTentMesh = new InstancedMesh(this.cache.tentRoofGeo, this.cache.tentCanvasMat, campCap);
    this.campFireRingMesh = new InstancedMesh(this.cache.campfireRingGeo, this.cache.campfireStoneMat, campCap);
    this.campFlameMesh = new InstancedMesh(this.cache.campfireFlameGeo, this.cache.campfireFlameMat, campCap);
    this.campLogMesh = new InstancedMesh(this.cache.firewoodLogGeo, this.cache.firewoodMat, campCap);
    this.campJarMesh = new InstancedMesh(this.cache.waterJarGeo, mo.ceramicJarMat, campCap);

    // Ponds (Shoreline Rim + Shimmering Water)
    this.pondRimMesh = new InstancedMesh(this.cache.pondRimGeo, mo.warmStoneMat, pondCap);
    this.pondWaterMesh = new InstancedMesh(this.cache.pondWaterGeo, this.cache.pondWaterMat, pondCap);

    // Warm Sandy Earthen Trails & Camp Hubs
    this.trailHubMesh = new InstancedMesh(this.cache.trailHubGeo, this.cache.trailDirtMat, trailCap);
    this.trailStripMesh = new InstancedMesh(this.cache.trailStripGeo, this.cache.trailDirtMat, trailCap);

    // Natural Boulders & Lush Meadow Bushes (Bushes reuse TreeAssetCache singleton!)
    this.boulderMesh = new InstancedMesh(this.cache.boulderGeo, this.cache.boulderInstancedMat, boulderCap);
    this.bushMesh = new InstancedMesh(tr.mountainGrassTuftGeo, tr.mountainFoliageInstancedMat, bushCap);

    for (const m of this.meshes()) {
      m.frustumCulled = false;
      m.count = 0;
      m.visible = false;
      for (let i = 0; i < m.instanceMatrix.count; i++) {
        m.setMatrixAt(i, scratchZeroMat);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  }

  meshes(): readonly InstancedMesh[] {
    return [
      this.houseBackWallMesh,
      this.houseLeftWallMesh,
      this.houseRightWallMesh,
      this.houseFrontLeftWallMesh,
      this.houseFrontRightWallMesh,
      this.houseDoorLintelMesh,
      this.houseDoorFrameLeftMesh,
      this.houseDoorFrameRightMesh,
      this.houseRoofMesh,
      this.houseDeckMesh,
      this.campTentMesh,
      this.campFireRingMesh,
      this.campFlameMesh,
      this.campLogMesh,
      this.campJarMesh,
      this.pondRimMesh,
      this.pondWaterMesh,
      this.trailHubMesh,
      this.trailStripMesh,
      this.boulderMesh,
      this.bushMesh,
    ];
  }

  syncToFocus(focusX: number, focusZ: number, force = false): boolean {
    const threshold = this.config.syncMoveThreshold ?? 26;
    if (
      !force &&
      Number.isFinite(this.lastFocusX) &&
      Math.hypot(focusX - this.lastFocusX, focusZ - this.lastFocusZ) < threshold
    ) {
      return false;
    }
    this.lastFocusX = focusX;
    this.lastFocusZ = focusZ;

    this.syncHouses(focusX, focusZ);
    this.syncCamps(focusX, focusZ);
    this.syncPonds(focusX, focusZ);
    this.syncTrails(focusX, focusZ);
    this.syncBoulders(focusX, focusZ);
    this.syncBushes(focusX, focusZ);
    return true;
  }

  private fillDesired<T extends { id: string; x: number; z: number }>(
    items: readonly T[],
    focusX: number,
    focusZ: number,
    cap: number,
  ): void {
    const take = selectNearest(items, focusX, focusZ, cap, this.scoredScratch, this.config.activeRadius);
    this.desiredIdsScratch.length = take;
    this.desiredIndexById.clear();
    for (let i = 0; i < take; i++) {
      const srcIdx = this.scoredScratch[i].idx;
      const id = items[srcIdx].id;
      this.desiredIdsScratch[i] = id;
      this.desiredIndexById.set(id, srcIdx);
    }
  }

  private syncHouses(focusX: number, focusZ: number): void {
    const list = this.catalog.houses;
    this.fillDesired(list, focusX, focusZ, this.housePool.capacity);
    const { assigned, released } = this.housePool.syncActive(
      this.desiredIdsScratch,
      (slot) => {
        const h = list[this.desiredIndexById.get(slot.ownerId!)!];
        scratchQuat.setFromAxisAngle(scratchYAxis, h.rotation);
        const hc = Math.cos(h.rotation);
        const hs = Math.sin(h.rotation);
        const floorH = HIGHLAND_HOUSE_FLOOR_HEIGHT;
        const wallBaseY = h.y + floorH;
        const t = HIGHLAND_HOUSE_WALL_THICKNESS;
        const halfW = h.width * 0.5;
        const halfD = h.depth * 0.5;
        const doorHalfW = Math.min(HIGHLAND_HOUSE_DOOR_HALF_W, halfW - t - 0.35);
        const doorH = Math.min(2.25, h.height - 0.45);
        const sideFrontW = Math.max(0.4, halfW - doorHalfW);
        const sideFrontCenterX = doorHalfW + sideFrontW * 0.5;

        const placeHousePart = (
          mesh: InstancedMesh,
          lx: number,
          wy: number,
          lz: number,
          sx: number,
          sy: number,
          sz: number,
        ) => {
          // Local (lx, lz) -> World using exact inverse of collision transform:
          // wx = h.x + lx*cos + lz*sin, wz = h.z - lx*sin + lz*cos
          const wx = h.x + lx * hc + lz * hs;
          const wz = h.z - lx * hs + lz * hc;
          scratchMat.compose(
            scratchPos.set(wx, wy, wz),
            scratchQuat,
            scratchScale.set(sx, sy, sz),
          );
          mesh.setMatrixAt(slot.index, scratchMat);
        };

        // Low step-up timber veranda & interior floor deck (`0.24m` above ground)
        placeHousePart(this.houseDeckMesh, 0, h.y + floorH * 0.5, 0, h.width + 1.2, floorH, h.depth + 1.4);

        // 4 Perimeter Timber Walls with Open Front Doorway (`1.7m` wide, `2.25m` tall)
        const wallMidY = wallBaseY + h.height * 0.5;
        placeHousePart(this.houseBackWallMesh, 0, wallMidY, -halfD + t * 0.5, h.width, h.height, t);
        placeHousePart(this.houseLeftWallMesh, -halfW + t * 0.5, wallMidY, 0, t, h.height, h.depth);
        placeHousePart(this.houseRightWallMesh, halfW - t * 0.5, wallMidY, 0, t, h.height, h.depth);
        placeHousePart(this.houseFrontLeftWallMesh, -sideFrontCenterX, wallMidY, halfD - t * 0.5, sideFrontW, h.height, t);
        placeHousePart(this.houseFrontRightWallMesh, sideFrontCenterX, wallMidY, halfD - t * 0.5, sideFrontW, h.height, t);

        const lintelH = Math.max(0.35, h.height - doorH);
        placeHousePart(
          this.houseDoorLintelMesh,
          0,
          wallBaseY + doorH + lintelH * 0.5,
          halfD - t * 0.5,
          doorHalfW * 2,
          lintelH,
          t,
        );
        // Dark timber doorway jamb posts framing the open entrance
        placeHousePart(this.houseDoorFrameLeftMesh, -doorHalfW + 0.06, wallBaseY + doorH * 0.5, halfD - t * 0.5, 0.14, doorH, t + 0.08);
        placeHousePart(this.houseDoorFrameRightMesh, doorHalfW - 0.06, wallBaseY + doorH * 0.5, halfD - t * 0.5, 0.14, doorH, t + 0.08);

        scratchColor.set(WALL_TINTS[h.wallTintIndex % WALL_TINTS.length]);
        this.houseBackWallMesh.setColorAt(slot.index, scratchColor);
        this.houseLeftWallMesh.setColorAt(slot.index, scratchColor);
        this.houseRightWallMesh.setColorAt(slot.index, scratchColor);
        this.houseFrontLeftWallMesh.setColorAt(slot.index, scratchColor);
        this.houseFrontRightWallMesh.setColorAt(slot.index, scratchColor);
        this.houseDoorLintelMesh.setColorAt(slot.index, scratchColor);

        // Pitched hipped Burmese/Chin roof
        scratchTiltQuat.setFromAxisAngle(scratchYAxis, h.rotation + Math.PI / 4);
        scratchMat.compose(
          scratchPos.set(h.x, wallBaseY + h.height + 1.25, h.z),
          scratchTiltQuat,
          scratchScale.set(h.width * 1.18, 2.55, h.depth * 1.18),
        );
        this.houseRoofMesh.setMatrixAt(slot.index, scratchMat);
        this.houseRoofMesh.setColorAt(slot.index, scratchColor.set(ROOF_TINTS[h.roofTintIndex % ROOF_TINTS.length]));
      },
      (slot) => {
        this.houseDeckMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseBackWallMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseLeftWallMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseRightWallMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseFrontLeftWallMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseFrontRightWallMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseDoorLintelMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseDoorFrameLeftMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseDoorFrameRightMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.houseRoofMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );
    if (assigned > 0 || released > 0) {
      updatePooledInstances([
        this.houseBackWallMesh,
        this.houseLeftWallMesh,
        this.houseRightWallMesh,
        this.houseFrontLeftWallMesh,
        this.houseFrontRightWallMesh,
        this.houseDoorLintelMesh,
        this.houseDeckMesh,
        this.houseDoorFrameLeftMesh,
        this.houseDoorFrameRightMesh,
        this.houseRoofMesh,
      ], this.housePool.renderCount);
    }
  }

  private syncCamps(focusX: number, focusZ: number): void {
    const list = this.catalog.camps;
    this.fillDesired(list, focusX, focusZ, this.campPool.capacity);
    const { assigned, released } = this.campPool.syncActive(
      this.desiredIdsScratch,
      (slot) => {
        const c = list[this.desiredIndexById.get(slot.ownerId!)!];
        scratchQuat.setFromAxisAngle(scratchYAxis, c.rotation + Math.PI / 4);

        // Camp shelter tent (`စခန်းတဲ`)
        scratchMat.compose(
          scratchPos.set(c.x, c.y + 1.5, c.z),
          scratchQuat,
          scratchScale.set(1.15, 1.05, 1.15),
        );
        this.campTentMesh.setMatrixAt(slot.index, scratchMat);

        // Stone campfire ring right in front of tent (`မီးဖိုဝိုင်း`)
        const fx = c.x + Math.sin(c.rotation) * 4.2;
        const fz = c.z + Math.cos(c.rotation) * 4.2;
        scratchTiltQuat.setFromAxisAngle(scratchXAxis, Math.PI / 2);
        scratchMat.compose(
          scratchPos.set(fx, c.y + 0.22, fz),
          scratchTiltQuat,
          scratchScale.set(1, 1, 1),
        );
        this.campFireRingMesh.setMatrixAt(slot.index, scratchMat);

        scratchQuat.setFromAxisAngle(scratchYAxis, c.rotation);
        scratchMat.compose(
          scratchPos.set(fx, c.y + 0.62, fz),
          scratchQuat,
          scratchScale.set(1, 1, 1),
        );
        this.campFlameMesh.setMatrixAt(slot.index, scratchMat);

        // Stacked firewood logs (`ထင်းပုံ`)
        scratchTiltQuat.setFromAxisAngle(scratchXAxis, Math.PI / 2);
        scratchMat.compose(
          scratchPos.set(c.logX, c.logY + 0.32, c.logZ),
          scratchTiltQuat,
          scratchScale.set(2.1, 1.25, 1.8),
        );
        this.campLogMesh.setMatrixAt(slot.index, scratchMat);

        // Ceramic water jar beside the pond path (`ရေအိုး`)
        scratchMat.compose(
          scratchPos.set(c.jarX, c.jarY + 0.48, c.jarZ),
          scratchQuat,
          scratchScale.set(1.15, 1.35, 1.15),
        );
        this.campJarMesh.setMatrixAt(slot.index, scratchMat);
      },
      (slot) => {
        this.campTentMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.campFireRingMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.campFlameMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.campLogMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.campJarMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );
    if (assigned > 0 || released > 0) {
      updatePooledInstances([
        this.campTentMesh, this.campFireRingMesh, this.campFlameMesh, this.campLogMesh, this.campJarMesh,
      ], this.campPool.renderCount);
    }
  }

  private syncPonds(focusX: number, focusZ: number): void {
    const list = this.catalog.ponds;
    this.fillDesired(list, focusX, focusZ, this.pondPool.capacity);
    const { assigned, released } = this.pondPool.syncActive(
      this.desiredIdsScratch,
      (slot) => {
        const p = list[this.desiredIndexById.get(slot.ownerId!)!];
        scratchQuat.setFromAxisAngle(scratchYAxis, p.rotation);
        scratchMat.compose(
          scratchPos.set(p.x, p.y + 0.08, p.z),
          scratchQuat,
          scratchScale.set(p.radiusX, 1, p.radiusZ),
        );
        this.pondRimMesh.setMatrixAt(slot.index, scratchMat);
        scratchMat.compose(
          scratchPos.set(p.x, p.y + 0.25, p.z),
          scratchQuat,
          scratchScale.set(p.radiusX, 1, p.radiusZ),
        );
        this.pondWaterMesh.setMatrixAt(slot.index, scratchMat);
      },
      (slot) => {
        this.pondRimMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.pondWaterMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );
    if (assigned > 0 || released > 0) {
      updatePooledInstances([this.pondRimMesh, this.pondWaterMesh], this.pondPool.renderCount);
    }
  }

  private syncTrails(focusX: number, focusZ: number): void {
    const list = this.catalog.trails;
    this.fillDesired(list, focusX, focusZ, this.trailPool.capacity);
    const { assigned, released } = this.trailPool.syncActive(
      this.desiredIdsScratch,
      (slot) => {
        const t = list[this.desiredIndexById.get(slot.ownerId!)!];
        scratchQuat.setFromAxisAngle(scratchYAxis, t.rotation);
        if (t.isHub) {
          scratchMat.compose(
            scratchPos.set(t.x, t.y, t.z),
            scratchQuat,
            scratchScale.set(t.width, 1, t.length),
          );
          this.trailHubMesh.setMatrixAt(slot.index, scratchMat);
          this.trailStripMesh.setMatrixAt(slot.index, scratchZeroMat);
        } else {
          scratchMat.compose(
            scratchPos.set(t.x, t.y, t.z),
            scratchQuat,
            scratchScale.set(t.width, 1, t.length),
          );
          this.trailStripMesh.setMatrixAt(slot.index, scratchMat);
          this.trailHubMesh.setMatrixAt(slot.index, scratchZeroMat);
        }
      },
      (slot) => {
        this.trailHubMesh.setMatrixAt(slot.index, scratchZeroMat);
        this.trailStripMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );
    if (assigned > 0 || released > 0) {
      updatePooledInstances([this.trailHubMesh, this.trailStripMesh], this.trailPool.renderCount);
    }
  }

  private syncBoulders(focusX: number, focusZ: number): void {
    const list = this.catalog.boulders;
    this.fillDesired(list, focusX, focusZ, this.boulderPool.capacity);
    const { assigned, released } = this.boulderPool.syncActive(
      this.desiredIdsScratch,
      (slot) => {
        const b = list[this.desiredIndexById.get(slot.ownerId!)!];
        scratchQuat.setFromAxisAngle(scratchYAxis, b.rotation);
        scratchMat.compose(
          scratchPos.set(b.x, b.y, b.z),
          scratchQuat,
          scratchScale.set(b.sx, b.sy, b.sz),
        );
        this.boulderMesh.setMatrixAt(slot.index, scratchMat);
        this.boulderMesh.setColorAt(slot.index, scratchColor.set(ROCK_TINTS[b.tintIndex % ROCK_TINTS.length]));
      },
      (slot) => {
        this.boulderMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );
    if (assigned > 0 || released > 0) {
      updatePooledInstances([this.boulderMesh], this.boulderPool.renderCount);
    }
  }

  private syncBushes(focusX: number, focusZ: number): void {
    const list = this.catalog.bushes;
    this.fillDesired(list, focusX, focusZ, this.bushPool.capacity);
    const { assigned, released } = this.bushPool.syncActive(
      this.desiredIdsScratch,
      (slot) => {
        const g = list[this.desiredIndexById.get(slot.ownerId!)!];
        scratchQuat.setFromAxisAngle(scratchYAxis, g.rotation);
        scratchMat.compose(
          scratchPos.set(g.x, g.y, g.z),
          scratchQuat,
          scratchScale.set(g.sx, g.sy, g.sz),
        );
        this.bushMesh.setMatrixAt(slot.index, scratchMat);
        this.bushMesh.setColorAt(slot.index, scratchColor.set(BUSH_TINTS[g.tintIndex % BUSH_TINTS.length]));
      },
      (slot) => {
        this.bushMesh.setMatrixAt(slot.index, scratchZeroMat);
      },
    );
    if (assigned > 0 || released > 0) {
      updatePooledInstances([this.bushMesh], this.bushPool.renderCount);
    }
  }

  metrics() {
    return {
      houses: this.housePool.metrics(),
      camps: this.campPool.metrics(),
      ponds: this.pondPool.metrics(),
      trails: this.trailPool.metrics(),
      boulders: this.boulderPool.metrics(),
      bushes: this.bushPool.metrics(),
      totalFixedSlots:
        this.housePool.capacity +
        this.campPool.capacity +
        this.pondPool.capacity +
        this.trailPool.capacity +
        this.boulderPool.capacity +
        this.bushPool.capacity,
      totalActiveSlots:
        this.housePool.activeCount +
        this.campPool.activeCount +
        this.pondPool.activeCount +
        this.trailPool.activeCount +
        this.boulderPool.activeCount +
        this.bushPool.activeCount,
    };
  }

  disposePool(): void {
    this.housePool.clear();
    this.campPool.clear();
    this.pondPool.clear();
    this.trailPool.clear();
    this.boulderPool.clear();
    this.bushPool.clear();
    for (const m of this.meshes()) {
      m.dispose();
    }
  }
}
