import { ward } from '../data/ward.ts';
import { getPagodaShrines, touchesPagodaPlinth, touchesPagodaShrine } from './pagodaLayout.ts';

/**
 * ============================================================================
 * Walk-In 2-Storey Myanmar Monastery Buildings — Single Source of Truth
 * ============================================================================
 *
 * Unifies:
 * 1. Reusable architectural layouts for all 4 Myanmar Theravada monastery
 *    building archetypes (`dhamma`, `quarters`, `mandap`, `refectory`) — each
 *    with open doorways, ground-floor interiors, an interior teak staircase,
 *    and a walkable 2nd floor with an exact stairwell opening!
 * 2. Unified collision (`canStandMonasteryBuildings`) shared across Myothar
 *    Area 5 monastery AND any future monastery registered via
 *    `registerMonasteryBuilding`.
 */

export type MonasteryBuildingKind = 'dhamma' | 'quarters' | 'mandap' | 'refectory';

export interface MonasteryBuildingSpec {
  readonly id: string;
  readonly kind: MonasteryBuildingKind;
  readonly name: string;
  readonly subtitle: string;
  /** World center X/Z */
  readonly x: number;
  readonly z: number;
  /** Local offset inside parent compound (informational) */
  readonly u: number;
  readonly v: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
  readonly roofColor: string;
}

export interface MonasteryRectBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface MonasteryStairLayout {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /** Direction of ascent from 1F to 2F */
  readonly direction: '+z' | '-z' | '+x' | '-x';
  readonly steps: number;
  readonly startY: number;
  readonly endY: number;
  readonly stepRise: number;
  readonly stepTread: number;
  /** Walkable bottom entry point in local building XZ */
  readonly bottomLanding: { readonly x: number; readonly z: number };
  /** Walkable top landing point in local building XZ (on 2F slab) */
  readonly topLanding: { readonly x: number; readonly z: number };
}

export interface MonasteryBuildingLayout {
  readonly kind: MonasteryBuildingKind;
  readonly wallW: number;
  readonly wallD: number;
  readonly wallT: number;
  readonly floor1Y: number;
  readonly wallH1: number;
  readonly floor2Y: number;
  readonly wallH2: number;
  readonly roofBaseY: number;
  readonly stair: MonasteryStairLayout;
  /** Non-overlapping walkable 2nd-floor rectangular slabs framing the exact stairwell hole */
  readonly upperFloorSlabs: readonly MonasteryRectBox[];
  /** Solid wall & fixed interior obstacle boxes in local building XZ */
  readonly obstacles: readonly MonasteryRectBox[];
  /** Walkable front approach & interior entry test points */
  readonly frontEntryPoint: { readonly x: number; readonly z: number };
  readonly interiorCenterPoint: { readonly x: number; readonly z: number };
}

/**
 * Splits a rectangular 2nd-floor footprint into up to 4 non-overlapping slabs
 * framing the exact stairwell hole so raycasts smoothly step down from 2F onto
 * the interior staircase without ever getting trapped on a solid ceiling.
 */
export function buildUpperFloorSlabsWithHole(
  outer: MonasteryRectBox,
  hole: MonasteryRectBox,
): MonasteryRectBox[] {
  const slabs: MonasteryRectBox[] = [];
  const hMinX = Math.max(outer.minX, hole.minX);
  const hMaxX = Math.min(outer.maxX, hole.maxX);
  const hMinZ = Math.max(outer.minZ, hole.minZ);
  const hMaxZ = Math.min(outer.maxZ, hole.maxZ);

  if (hMinX - outer.minX > 0.08) {
    slabs.push({ minX: outer.minX, maxX: hMinX, minZ: outer.minZ, maxZ: outer.maxZ });
  }
  if (outer.maxX - hMaxX > 0.08) {
    slabs.push({ minX: hMaxX, maxX: outer.maxX, minZ: outer.minZ, maxZ: outer.maxZ });
  }
  if (hMinZ - outer.minZ > 0.08) {
    slabs.push({ minX: hMinX, maxX: hMaxX, minZ: outer.minZ, maxZ: hMinZ });
  }
  if (outer.maxZ - hMaxZ > 0.08) {
    slabs.push({ minX: hMinX, maxX: hMaxX, minZ: hMaxZ, maxZ: outer.maxZ });
  }
  return slabs;
}

function addWallWithOpeningX(
  out: MonasteryRectBox[],
  zCenter: number,
  wallT: number,
  minX: number,
  maxX: number,
  openings: readonly [number, number][],
): void {
  const sorted = [...openings].sort((a, b) => a[0] - b[0]);
  let cursor = minX;
  for (const [oMin, oMax] of sorted) {
    if (oMin - cursor > 0.1) {
      out.push({ minX: cursor, maxX: oMin, minZ: zCenter - wallT / 2, maxZ: zCenter + wallT / 2 });
    }
    cursor = Math.max(cursor, oMax);
  }
  if (maxX - cursor > 0.1) {
    out.push({ minX: cursor, maxX: maxX, minZ: zCenter - wallT / 2, maxZ: zCenter + wallT / 2 });
  }
}

function addWallWithOpeningZ(
  out: MonasteryRectBox[],
  xCenter: number,
  wallT: number,
  minZ: number,
  maxZ: number,
  openings: readonly [number, number][],
): void {
  const sorted = [...openings].sort((a, b) => a[0] - b[0]);
  let cursor = minZ;
  for (const [oMin, oMax] of sorted) {
    if (oMin - cursor > 0.1) {
      out.push({ minX: xCenter - wallT / 2, maxX: xCenter + wallT / 2, minZ: cursor, maxZ: oMin });
    }
    cursor = Math.max(cursor, oMax);
  }
  if (maxZ - cursor > 0.1) {
    out.push({ minX: xCenter - wallT / 2, maxX: xCenter + wallT / 2, minZ: cursor, maxZ: maxZ });
  }
}

/**
 * Deterministic architectural & collision layout shared identically by 3D
 * monastery components and `canStandMonasteryBuildings`.
 */
export function computeMonasteryBuildingLayout(
  spec: Pick<MonasteryBuildingSpec, 'kind' | 'width' | 'depth'>,
): MonasteryBuildingLayout {
  const { kind, width, depth } = spec;
  const wallT = 0.34;
  const steps = 16;

  if (kind === 'dhamma') {
    const wallW = width - 1.6; // 23.4m
    const wallD = depth - 2.2; // 16.8m
    const hw = wallW / 2;
    const hd = wallD / 2;
    const floor1Y = 0.88;
    const wallH1 = 3.55;
    const floor2Y = floor1Y + wallH1; // 4.43m
    const wallH2 = 3.15;
    const roofBaseY = floor2Y + wallH2; // 7.58m

    // Interior teak staircase in North-East bay ascending +Z (from front toward center-back)
    const stairMinX = hw - 4.1;
    const stairMaxX = hw - 2.1;
    const stairMinZ = -hd + 2.6;
    const stairMaxZ = stairMinZ + 5.4;
    const stair: MonasteryStairLayout = {
      minX: stairMinX,
      maxX: stairMaxX,
      minZ: stairMinZ,
      maxZ: stairMaxZ,
      direction: '+z',
      steps,
      startY: floor1Y,
      endY: floor2Y,
      stepRise: wallH1 / steps,
      stepTread: (stairMaxZ - stairMinZ) / steps,
      bottomLanding: { x: (stairMinX + stairMaxX) / 2, z: stairMinZ - 0.9 },
      topLanding: { x: (stairMinX + stairMaxX) / 2, z: stairMaxZ + 1.0 },
    };

    const obstacles: MonasteryRectBox[] = [];
    // Front wall (-Z) with wide 4.0m main temple entrance
    addWallWithOpeningX(obstacles, -hd, wallT, -hw, hw, [[-2.0, 2.0]]);
    // Back wall (+Z) solid behind Grand Buddha Altar
    addWallWithOpeningX(obstacles, hd, wallT, -hw, hw, []);
    // West (-X) and East (+X) walls with 3.2m side doorways
    addWallWithOpeningZ(obstacles, -hw, wallT, -hd, hd, [[-1.6, 1.6]]);
    addWallWithOpeningZ(obstacles, hw, wallT, -hd, hd, [[-1.6, 1.6]]);
    // Grand Golden Buddha Shrine Pedestal against back wall
    obstacles.push({ minX: -3.0, maxX: 3.0, minZ: hd - 3.0, maxZ: hd - 0.25 });

    const upperFloorSlabs = buildUpperFloorSlabsWithHole(
      { minX: -hw + 0.15, maxX: hw - 0.15, minZ: -hd + 0.15, maxZ: hd - 0.15 },
      { minX: stairMinX - 0.06, maxX: stairMaxX + 0.06, minZ: stairMinZ - 0.06, maxZ: stairMaxZ },
    );

    return {
      kind,
      wallW,
      wallD,
      wallT,
      floor1Y,
      wallH1,
      floor2Y,
      wallH2,
      roofBaseY,
      stair,
      upperFloorSlabs,
      obstacles,
      frontEntryPoint: { x: 0, z: -hd },
      interiorCenterPoint: { x: 0, z: 0 },
    };
  }

  if (kind === 'quarters') {
    const wallW = width - 2.4; // 24.6m
    const wallD = depth - 2.8; // 11.2m
    const hw = wallW / 2;
    const hd = wallD / 2;
    const floor1Y = 0.66;
    const wallH1 = 3.45;
    const floor2Y = floor1Y + wallH1; // 4.11m
    const wallH2 = 3.2;
    const roofBaseY = floor2Y + wallH2; // 7.31m

    // Interior teak staircase along Rear-East bay ascending +X
    const stairMinX = hw - 8.0;
    const stairMaxX = hw - 2.8;
    const stairMinZ = hd - 2.5;
    const stairMaxZ = hd - 0.5;
    const stair: MonasteryStairLayout = {
      minX: stairMinX,
      maxX: stairMaxX,
      minZ: stairMinZ,
      maxZ: stairMaxZ,
      direction: '+x',
      steps,
      startY: floor1Y,
      endY: floor2Y,
      stepRise: wallH1 / steps,
      stepTread: (stairMaxX - stairMinX) / steps,
      bottomLanding: { x: stairMinX - 1.0, z: (stairMinZ + stairMaxZ) / 2 },
      topLanding: { x: stairMaxX + 1.0, z: (stairMinZ + stairMaxZ) / 2 },
    };

    const obstacles: MonasteryRectBox[] = [];
    // Front wall (-Z) with wide 4.0m main entry facing Dhamma Hall
    addWallWithOpeningX(obstacles, -hd, wallT, -hw, hw, [[-2.0, 2.0]]);
    // Back wall (+Z) solid
    addWallWithOpeningX(obstacles, hd, wallT, -hw, hw, []);
    // West wall (-X) with 3.2m side doorway facing Refectory
    addWallWithOpeningZ(obstacles, -hw, wallT, -hd, hd, [[-1.6, 1.6]]);
    // East wall (+X) solid
    addWallWithOpeningZ(obstacles, hw, wallT, -hd, hd, []);
    // Abbot's scripture shelf & meditation dais in West-rear corner
    obstacles.push({ minX: -hw + 0.9, maxX: -hw + 5.2, minZ: hd - 2.2, maxZ: hd - 0.35 });

    const upperFloorSlabs = buildUpperFloorSlabsWithHole(
      { minX: -hw + 0.15, maxX: hw - 0.15, minZ: -hd + 0.15, maxZ: hd - 0.15 },
      { minX: stairMinX - 0.06, maxX: stairMaxX, minZ: stairMinZ - 0.06, maxZ: stairMaxZ + 0.06 },
    );

    return {
      kind,
      wallW,
      wallD,
      wallT,
      floor1Y,
      wallH1,
      floor2Y,
      wallH2,
      roofBaseY,
      stair,
      upperFloorSlabs,
      obstacles,
      frontEntryPoint: { x: 0, z: -hd },
      interiorCenterPoint: { x: 0, z: -0.6 },
    };
  }

  if (kind === 'mandap') {
    const wallW = width - 1.8; // 17.2m (column/parapet ring)
    const wallD = depth - 1.8; // 18.2m
    const hw = wallW / 2; // 8.6m
    const hd = wallD / 2; // 9.1m
    const floor1Y = 0.88;
    const wallH1 = 3.55;
    const floor2Y = floor1Y + wallH1; // 4.43m
    const wallH2 = 3.05;
    const roofBaseY = floor2Y + wallH2; // 7.48m

    // Interior teak staircase along West bay ascending +Z up to 2nd-floor open balustrade gallery
    const stairMinX = -hw + 1.0;
    const stairMaxX = -hw + 3.0;
    const stairMinZ = -hd + 3.0;
    const stairMaxZ = stairMinZ + 5.2;
    const stair: MonasteryStairLayout = {
      minX: stairMinX,
      maxX: stairMaxX,
      minZ: stairMinZ,
      maxZ: stairMaxZ,
      direction: '+z',
      steps,
      startY: floor1Y,
      endY: floor2Y,
      stepRise: wallH1 / steps,
      stepTread: (stairMaxZ - stairMinZ) / steps,
      bottomLanding: { x: (stairMinX + stairMaxX) / 2, z: stairMinZ - 1.0 },
      topLanding: { x: (stairMinX + stairMaxX) / 2, z: stairMaxZ + 1.0 },
    };

    const obstacles: MonasteryRectBox[] = [];
    // Open pavilion low parapet on Front (-Z) with 5.2m wide open entrance
    addWallWithOpeningX(obstacles, -hd, 0.3, -hw, hw, [[-2.6, 2.6]]);
    // Back (+Z) continuous parapet wall behind altar
    addWallWithOpeningX(obstacles, hd, 0.3, -hw, hw, []);
    // West (-X) continuous parapet wall
    addWallWithOpeningZ(obstacles, -hw, 0.3, -hd, hd, []);
    // East (+X) parapet with 5.2m wide open entrance facing Dhamma Hall
    addWallWithOpeningZ(obstacles, hw, 0.3, -hd, hd, [[-2.6, 2.6]]);
    // Inner Golden Buddha Shrine Pedestal at back (+Z)
    obstacles.push({ minX: -2.8, maxX: 2.8, minZ: hd - 3.9, maxZ: hd - 1.1 });

    const upperFloorSlabs = buildUpperFloorSlabsWithHole(
      { minX: -hw + 0.15, maxX: hw - 0.15, minZ: -hd + 0.15, maxZ: hd - 0.15 },
      { minX: stairMinX - 0.06, maxX: stairMaxX + 0.06, minZ: stairMinZ - 0.06, maxZ: stairMaxZ },
    );

    return {
      kind,
      wallW,
      wallD,
      wallT: 0.3,
      floor1Y,
      wallH1,
      floor2Y,
      wallH2,
      roofBaseY,
      stair,
      upperFloorSlabs,
      obstacles,
      frontEntryPoint: { x: 0, z: -hd },
      interiorCenterPoint: { x: 0.5, z: -0.5 },
    };
  }

  // kind === 'refectory' (ဆွမ်းစားဆောင် နှင့် ဆွမ်းပစ္စည်းများထားရာနေရာ)
  const wallW = width - 1.4; // 20.6m
  const wallD = depth - 1.4; // 10.6m
  const hw = wallW / 2; // 10.3m
  const hd = wallD / 2; // 5.3m
  const floor1Y = 0.66;
  const wallH1 = 3.45;
  const floor2Y = floor1Y + wallH1; // 4.11m
  const wallH2 = 3.1;
  const roofBaseY = floor2Y + wallH2; // 7.21m

  // Interior teak staircase along Rear-East wall ascending +X up to 2nd-floor alms loft & gallery
  const stairMinX = 3.0;
  const stairMaxX = 8.0;
  const stairMinZ = hd - 2.2;
  const stairMaxZ = hd - 0.4;
  const stair: MonasteryStairLayout = {
    minX: stairMinX,
    maxX: stairMaxX,
    minZ: stairMinZ,
    maxZ: stairMaxZ,
    direction: '+x',
    steps,
    startY: floor1Y,
    endY: floor2Y,
    stepRise: wallH1 / steps,
    stepTread: (stairMaxX - stairMinX) / steps,
    bottomLanding: { x: stairMinX - 1.0, z: (stairMinZ + stairMaxZ) / 2 },
    topLanding: { x: stairMaxX + 1.0, z: (stairMinZ + stairMaxZ) / 2 },
  };

  const partitionX = -3.0;
  const obstacles: MonasteryRectBox[] = [];
  // Front wall (-Z): East Wing Dining entrance [0.6..4.2] + West Wing Alms Storage service entrance [-7.6..-5.2]
  addWallWithOpeningX(obstacles, -hd, wallT, -hw, hw, [
    [-7.6, -5.2],
    [0.6, 4.2],
  ]);
  // Back wall (+Z) solid
  addWallWithOpeningX(obstacles, hd, wallT, -hw, hw, []);
  // West wall (-X) solid
  addWallWithOpeningZ(obstacles, -hw, wallT, -hd, hd, []);
  // East wall (+X) with 3.2m wide entrance facing Monks' Quarters
  addWallWithOpeningZ(obstacles, hw, wallT, -hd, hd, [[-1.6, 1.6]]);
  // Interior partition dividing Dining Hall (East) & Alms Supplies Storage Room (West) with wide 3.0m archway!
  addWallWithOpeningZ(obstacles, partitionX, 0.26, -hd, hd, [[-1.4, 1.6]]);

  // West Wing (Alms Supplies Storage) wall-hugging racks & prep counter (center floor remains wide open!)
  obstacles.push({ minX: -hw + 0.25, maxX: -hw + 1.6, minZ: -hd + 0.7, maxZ: hd - 0.7 }); // West alms-bowl & tiffin rack
  obstacles.push({ minX: -hw + 1.9, maxX: partitionX - 0.5, minZ: hd - 1.6, maxZ: hd - 0.3 }); // Rear rice sacks, jars & cauldron counter

  // East Wing (Dining Hall) low Myanmar round dining tables (keeps user point (-1.68, +0.28) & all walkways clear!)
  obstacles.push({ minX: -0.75, maxX: 1.05, minZ: 1.4, maxZ: 3.1 }); // Dining table 1
  obstacles.push({ minX: -0.75, maxX: 1.05, minZ: -3.2, maxZ: -1.5 }); // Dining table 2
  obstacles.push({ minX: 3.85, maxX: 5.65, minZ: -3.2, maxZ: -1.5 }); // Dining table 3

  const upperFloorSlabs = buildUpperFloorSlabsWithHole(
    { minX: -hw + 0.15, maxX: hw - 0.15, minZ: -hd + 0.15, maxZ: hd - 0.15 },
    { minX: stairMinX - 0.06, maxX: stairMaxX, minZ: stairMinZ - 0.06, maxZ: stairMaxZ + 0.06 },
  );

  return {
    kind,
    wallW,
    wallD,
    wallT,
    floor1Y,
    wallH1,
    floor2Y,
    wallH2,
    roofBaseY,
    stair,
    upperFloorSlabs,
    obstacles,
    frontEntryPoint: { x: 2.4, z: -hd },
    interiorCenterPoint: { x: -1.68, z: 0.28 },
  };
}

function localToWorld(
  originX: number,
  originZ: number,
  rotation: number,
  u: number,
  v: number,
): { x: number; z: number } {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return {
    x: originX + u * c + v * s,
    z: originZ - u * s + v * c,
  };
}

const DEFAULT_SUBTITLE = 'မြို့သာ နယ်မြေ(၅) ဘုန်းတော်ကြီးကျောင်း';

const MYOTHAR_KIND_MAP: Record<string, MonasteryBuildingKind> = {
  mandap: 'mandap',
  dhamma: 'dhamma',
  quarters: 'quarters',
  refectory: 'refectory',
};

const MYOTHAR_TITLE_MAP: Record<string, string> = {
  mandap: 'သိမ်မဏ္ဍပ် · ဇရပ်',
  dhamma: 'ဓမ္မာရုံ',
  quarters: 'ဘုန်းကြီးကျောင်းဆောင်',
  refectory: 'ဆွမ်းစားဆောင် · ဆွမ်းပစ္စည်းခန်း',
};

export const MYOTHAR_MONASTERY_BUILDINGS: readonly MonasteryBuildingSpec[] =
  ward.monastery.buildings.map((b) => {
    const pos = localToWorld(ward.monastery.x, ward.monastery.z, ward.monastery.rotation, b.u, b.v);
    const kind: MonasteryBuildingKind = MYOTHAR_KIND_MAP[b.id] ?? 'dhamma';
    return {
      id: `myothar-monastery-${b.id}`,
      kind,
      name: MYOTHAR_TITLE_MAP[b.id] ?? b.name,
      subtitle: DEFAULT_SUBTITLE,
      x: pos.x,
      z: pos.z,
      u: b.u,
      v: b.v,
      width: b.width,
      depth: b.depth,
      rotation: ward.monastery.rotation,
      roofColor: b.roof,
    };
  });

export const MYOTHAR_MONASTERY_STUPAS = ward.monastery.stupas;
const stupaShrines = MYOTHAR_MONASTERY_STUPAS.flatMap(p => getPagodaShrines(p, ward.monastery.rotation));

export const MYOTHAR_FLAGPOLE_LOCAL = { x: 14.8, z: -11.2 } as const;
const MYOTHAR_FLAGPOLE_WORLD = localToWorld(
  ward.monastery.x,
  ward.monastery.z,
  ward.monastery.rotation,
  MYOTHAR_FLAGPOLE_LOCAL.x,
  MYOTHAR_FLAGPOLE_LOCAL.z,
);

interface PreparedMonasteryCollider {
  readonly id: string;
  readonly spec: MonasteryBuildingSpec;
  readonly layout: MonasteryBuildingLayout;
  readonly cosR: number;
  readonly sinR: number;
  readonly boundR: number;
}

function prepareCollider(spec: MonasteryBuildingSpec): PreparedMonasteryCollider {
  const layout = computeMonasteryBuildingLayout(spec);
  return {
    id: spec.id,
    spec,
    layout,
    cosR: Math.cos(spec.rotation),
    sinR: Math.sin(spec.rotation),
    boundR: Math.hypot(spec.width / 2, spec.depth / 2) + 2.0,
  };
}

const registeredColliders: PreparedMonasteryCollider[] = MYOTHAR_MONASTERY_BUILDINGS.map(prepareCollider);

/** Register an additional reusable monastery building anywhere on the map for walk-in collision. */
export function registerMonasteryBuilding(spec: MonasteryBuildingSpec): void {
  const idx = registeredColliders.findIndex((c) => c.id === spec.id);
  const prepared = prepareCollider(spec);
  if (idx >= 0) registeredColliders[idx] = prepared;
  else registeredColliders.push(prepared);
}

/** Release a dynamically registered monastery building collider when its tile unloads. */
export function unregisterMonasteryBuilding(id: string): void {
  const idx = registeredColliders.findIndex((c) => c.id === id);
  if (idx >= 0) registeredColliders.splice(idx, 1);
}

/**
 * Exact walk-in wall, doorway, interior obstacle, stupa & flagpole collision
 * check for all registered Myanmar Theravada monastery buildings.
 */
export function canStandMonasteryBuildings(x: number, z: number, playerRadius = 0.4): boolean {
  // 1. Walk-in 2-storey monastery buildings (walls & fixed furniture block; doorways, floors & stairs are walkable)
  for (let i = 0; i < registeredColliders.length; i++) {
    const entry = registeredColliders[i];
    const dx = x - entry.spec.x;
    const dz = z - entry.spec.z;
    if (dx * dx + dz * dz > entry.boundR * entry.boundR) continue;

    const lx = dx * entry.cosR - dz * entry.sinR;
    const lz = dx * entry.sinR + dz * entry.cosR;
    const obstacles = entry.layout.obstacles;
    for (let j = 0; j < obstacles.length; j++) {
      const obs = obstacles[j];
      const nx = Math.max(obs.minX, Math.min(lx, obs.maxX));
      const nz = Math.max(obs.minZ, Math.min(lz, obs.maxZ));
      const ddx = lx - nx;
      const ddz = lz - nz;
      if (ddx * ddx + ddz * ddz < playerRadius * playerRadius) {
        return false;
      }
    }
  }

  for (const stupa of MYOTHAR_MONASTERY_STUPAS) {
    if (touchesPagodaPlinth(x, z, playerRadius, stupa)) return false;
  }
  for (const shrine of stupaShrines) {
    if (touchesPagodaShrine(x, z, playerRadius, shrine)) return false;
  }

  // 3. Theravada Buddhist Flagpole Plinth
  const fx = x - MYOTHAR_FLAGPOLE_WORLD.x;
  const fz = z - MYOTHAR_FLAGPOLE_WORLD.z;
  const fr = 0.55 + playerRadius;
  if (fx * fx + fz * fz < fr * fr) return false;

  return true;
}
