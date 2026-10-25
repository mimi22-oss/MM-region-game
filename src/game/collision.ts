import { motorcycleRide } from './motorcycleRide.ts';
import { estateFenceBlocks, estatePalms } from "../data/farmEstate.ts";
import { homeGateBlocks } from "./homeAccess.ts";
import {
  farmhouse,
  uShweHouse,
  KALAY_SIGN_HOUSE_ID,
  angle,
} from "../data/ward.ts";
import { driveableCars, carRide } from "./carRide.ts";
import { spatialIndex } from "./spatialIndex.ts";
import { ward } from "../data/ward.ts";
import { kalayVillages } from "../data/villages/index.ts";
import { mangoTrees } from "../data/mangoTrees.ts";
import { tamarindTrees } from "../data/tamarindTrees.ts";
import {
  MOTORCYCLE_X,
  MOTORCYCLE_Z,
  MOTORCYCLE_RADIUS,
} from "../data/motorcycle.ts";
import {
  HAND_PUMP_X,
  HAND_PUMP_Z,
  SPOUT_DX,
  SPOUT_DZ,
  SPOUT_LENGTH,
  HAND_PUMP_RADIUS,
} from "../data/handPumpLongSpout.ts";
import {
  shweMyanmarFuelStation,
  shweMyanmarRiceMill,
  shweMyanmarResidential,
  shweMyanmarVacantLot,
} from "../data/wards/myothar/shweMyanmarArea.ts";
export const PLAYER_RADIUS = 0.4;
const nearbyAreca = spatialIndex(estatePalms, (p) => ({
  x: p.x,
  z: p.z,
  radius: 0.62,
}));
const villageHouses = kalayVillages
  .flatMap((v) => v.houses)
  .filter((h) => h.id !== "way/403027623");
const villageTrees = kalayVillages.flatMap((v) => [
  ...v.trees,
  ...v.largeTrees,
  ...v.farmTrees,
]);
const solidWardHouses = ward.houses.filter(
  (h) =>
    h.id !== farmhouse.id &&
    h.id !== uShweHouse.id &&
    h.id !== KALAY_SIGN_HOUSE_ID,
);
const shweMyanmarBuildings = [
  shweMyanmarFuelStation.office,
  shweMyanmarRiceMill.mainBuilding,
  shweMyanmarRiceMill.storageBuilding,
  shweMyanmarRiceMill.gateOffice,
  shweMyanmarVacantLot.shed,
  shweMyanmarResidential.store,
  ...shweMyanmarResidential.houses,
];
const privateHomeIds = new Set(
  [...solidWardHouses, ...villageHouses].map((h) => h.id),
);
const nearbyBuildings = spatialIndex(
  [
    ...solidWardHouses,
    ...ward.warehouses,
    ...ward.riceMill.buildings,
    ...villageHouses,
    ...shweMyanmarBuildings,
  ],
  (h) => ({
    x: h.x,
    z: h.z,
    radius: Math.hypot(h.width / 2 + 1.6, h.depth / 2 + 2.6) + PLAYER_RADIUS,
  }),
);
const nearbyTrees = spatialIndex(
  [
    ...ward.trees,
    ...ward.farmTrees,
    ...ward.largeTrees,
    ...villageTrees,
    ...mangoTrees,
    ...tamarindTrees,
  ],
  (t) => ({ x: t.x, z: t.z, radius: t.radius + PLAYER_RADIUS }),
);
const mountainObstacles = [...ward.mountains, ...ward.weipula.peaks];
const polylineCanals = [
  ward.crossCanal,
  ...kalayVillages.flatMap((vl) =>
    vl.connectingCanal ? [vl.connectingCanal] : [],
  ),
];

// Farmhouse walk-in character home collision setup
// Main house expanded to width=12m (lx=-6..6), depth=10m (lz=-5..5).
// Giant kitchen lean-to annex on LEFT side: width=9m (lx=6..15), depth=8m (lz=-4..4).
// Compound fences (Wire mesh on left at lx=18, right at lx=-9, back at lz=-7.5, front gate at lz=7.5).
const farmhouseData = farmhouse;
const fhC = Math.cos(farmhouseData.rotation);
const fhS = Math.sin(farmhouseData.rotation);
const farmhouseObstacles = [
  // Furniture
  { minX: -1.3, maxX: 1.3, minZ: -0.8, maxZ: 0.8 }, // Central Dining Table
  { minX: 1.5, maxX: 4.0, minZ: -4.9, maxZ: -4.2 }, // TV Console
  { minX: 1.5, maxX: 4.0, minZ: -2.7, maxZ: -1.8 }, // Sofa
  { minX: -5.8, maxX: -3.2, minZ: -3.8, maxZ: -1.2 }, // Bed
  { minX: -5.8, maxX: -3.5, minZ: 1.2, maxZ: 3.2 }, // Computer Desk
  // Kitchen furniture in the giant left-side annex
  { minX: 7.0, maxX: 14.0, minZ: -3.9, maxZ: -3.0 }, // Kitchen Cooking Counter
  { minX: 9.5, maxX: 12.0, minZ: -0.6, maxZ: 0.6 }, // Kitchen Island Prep Table
  { minX: 14.0, maxX: 14.9, minZ: 2.5, maxZ: 3.6 }, // Refrigerator
  // Main house outer walls (lx=-6.0..6.0, lz=-5.0..5.0)
  { minX: -6.0, maxX: 6.0, minZ: -5.2, maxZ: -4.8 }, // Back Wall
  { minX: -6.2, maxX: -5.8, minZ: -5.0, maxZ: 5.0 }, // Right Outer Wall
  { minX: 1.2, maxX: 6.0, minZ: 4.8, maxZ: 5.2 }, // Front Wall Left Section
  { minX: -6.0, maxX: -1.2, minZ: 4.8, maxZ: 5.2 }, // Front Wall Right Section
  // Left dividing wall (with connecting archway at lz=-1.2..1.8)
  { minX: 5.8, maxX: 6.2, minZ: -5.0, maxZ: -1.2 }, // Left Wall Back Section
  { minX: 5.8, maxX: 6.2, minZ: 1.8, maxZ: 5.0 }, // Left Wall Front Section
  // Kitchen Annex Outer Walls (lx=6.0..15.0, lz=-4.0..4.0)
  { minX: 14.8, maxX: 15.2, minZ: -4.0, maxZ: 4.0 }, // Kitchen Left Outer Wall
  { minX: 6.0, maxX: 15.0, minZ: -4.2, maxZ: -3.8 }, // Kitchen Back Outer Wall
  { minX: 6.0, maxX: 15.0, minZ: 3.8, maxZ: 4.2 }, // Kitchen Front Outer Wall
  // Compound Fences (Wire Mesh on sides and back, clear of kitchen annex)
  { minX: 17.8, maxX: 18.2, minZ: -7.5, maxZ: 7.5 }, // Left Wire Mesh Fence (3m clear of kitchen!)
  { minX: -9.2, maxX: -8.8, minZ: -7.5, maxZ: 7.5 }, // Right Wire Mesh Fence
  { minX: -9.0, maxX: 18.0, minZ: -7.7, maxZ: -7.3 }, // Back Wire Mesh Fence
  { minX: -9.0, maxX: -1.7, minZ: 7.3, maxZ: 7.7 }, // Front Fence Right Section
  { minX: 1.7, maxX: 18.0, minZ: 7.3, maxZ: 7.7 }, // Front Fence Left Section
];

// Two-room toilet block (၂ ခန်းတွဲ အိမ်သာ) collision setup at (130.464, 277.362)
const toiletPos = { x: 130.464, z: 277.362 };
const toiletRot = angle + Math.PI;
const tC = Math.cos(toiletRot);
const tS = Math.sin(toiletRot);
const toiletObstacles = [
  // Outer walls & center partition
  { minX: -1.7, maxX: 1.7, minZ: -1.1, maxZ: -0.9 }, // Back wall
  { minX: -1.7, maxX: -1.5, minZ: -1.0, maxZ: 1.0 }, // Left wall
  { minX: 1.5, maxX: 1.7, minZ: -1.0, maxZ: 1.0 }, // Right wall
  { minX: -0.1, maxX: 0.1, minZ: -1.0, maxZ: 1.0 }, // Center dividing wall
  // Front wall jambs (door openings at lx=-0.8 and lx=0.8)
  { minX: -1.7, maxX: -1.35, minZ: 0.9, maxZ: 1.1 }, // Left front jamb
  { minX: -0.25, maxX: 0.25, minZ: 0.9, maxZ: 1.1 }, // Center front jamb
  { minX: 1.35, maxX: 1.7, minZ: 0.9, maxZ: 1.1 }, // Right front jamb
  // Interior fixtures (swapped: water tub in Room 1 on Left, commode in Room 2 on Right)
  { minX: -1.55, maxX: -1.0, minZ: -0.95, maxZ: -0.45 }, // Water tub in Room 1 (Left)
  { minX: 0.5, maxX: 1.1, minZ: -0.95, maxZ: -0.45 }, // Commode in Room 2 (Right)
];

export function canStandToilet(x: number, z: number): boolean {
  const dx = x - toiletPos.x,
    dz = z - toiletPos.z;
  const lx = dx * tC - dz * tS,
    lz = dx * tS + dz * tC;
  if (Math.abs(lx) > 3 || Math.abs(lz) > 3) return true;
  for (const obs of toiletObstacles) {
    const nx = Math.max(obs.minX, Math.min(lx, obs.maxX));
    const nz = Math.max(obs.minZ, Math.min(lz, obs.maxZ));
    if (Math.hypot(lx - nx, lz - nz) < PLAYER_RADIUS) return false;
  }
  return true;
}

function canStandFarmhouse(x: number, z: number): boolean {
  const dx = x - farmhouseData.x,
    dz = z - farmhouseData.z;
  const lx = dx * fhC - dz * fhS,
    lz = dx * fhS + dz * fhC;
  if (Math.abs(lx) > 22 || lz < -12 || lz > 12) return true;
  for (const obs of farmhouseObstacles) {
    const nx = Math.max(obs.minX, Math.min(lx, obs.maxX));
    const nz = Math.max(obs.minZ, Math.min(lz, obs.maxZ));
    if (Math.hypot(lx - nx, lz - nz) < PLAYER_RADIUS) return false;
  }
  return true;
}

// U Shwe House & Snack Shop collision setup
const uShweData = uShweHouse;
const usC = Math.cos(uShweData.rotation);
const usS = Math.sin(uShweData.rotation);

export function canStandUShweHouse(x: number, z: number): boolean {
  const dx = x - uShweData.x,
    dz = z - uShweData.z;
  const lx = dx * usC - dz * usS,
    lz = dx * usS + dz * usC;
  if (Math.abs(lx) > 8 || Math.abs(lz) > 8) return true;

  // 1. Main 2-storey house building (width 10m: lx=-5..5, depth 9m: lz=-4.5..4.5)
  if (
    Math.abs(lx) < 5.0 + PLAYER_RADIUS &&
    lz > -4.5 - PLAYER_RADIUS &&
    lz < 4.5 + PLAYER_RADIUS
  )
    return false;

  // 2. Snack serving counter (lx=-3.8..-1.0, lz=5.4..6.1)
  if (
    lx > -3.8 - PLAYER_RADIUS &&
    lx < -1.0 + PLAYER_RADIUS &&
    lz > 5.4 - PLAYER_RADIUS &&
    lz < 6.1 + PLAYER_RADIUS
  )
    return false;

  // 3. Cooking corner / Mohinga cauldron (lx=-4.5..-3.5, lz=4.5..5.6)
  if (
    lx > -4.5 - PLAYER_RADIUS &&
    lx < -3.5 + PLAYER_RADIUS &&
    lz > 4.5 &&
    lz < 5.6 + PLAYER_RADIUS
  )
    return false;

  // 4. Customer dining table (center at lx=2.2, lz=5.85, radius=0.6)
  if (Math.hypot(lx - 2.2, lz - 5.85) < 0.6 + PLAYER_RADIUS) return false;

  // 5. Annex side fence borders (lx=-4.7 and lx=4.7, lz=4.5..7.2)
  if (Math.abs(lx + 4.7) < 0.15 + PLAYER_RADIUS && lz > 4.5 && lz < 7.2)
    return false;
  if (Math.abs(lx - 4.7) < 0.15 + PLAYER_RADIUS && lz > 4.5 && lz < 7.2)
    return false;

  return true;
}

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);
const mountainVillageHouses = [
  // House 1 & 2 (Tier 1)
  { minU: -349, maxU: -341, minV: 4372.5, maxV: 4379.5 },
  { minU: -330.2, maxU: -321.8, minV: 4372.2, maxV: 4379.8 },
  // House 3 & 4 (Tier 2)
  { minU: -349, maxU: -341, minV: 4397.2, maxV: 4404.8 },
  { minU: -330.5, maxU: -321.5, minV: 4397, maxV: 4405 },
  // House 5 & Tea shop counter (Tier 3)
  { minU: -328, maxU: -320, minV: 4422.2, maxV: 4429.8 },
  { minU: -347, maxU: -341, minV: 4423, maxV: 4427 },
  // House 6 & 7 (Tier 4)
  { minU: -348.8, maxU: -339.2, minV: 4446.8, maxV: 4455.2 },
  { minU: -328.2, maxU: -319.8, minV: 4447.2, maxV: 4454.8 },
];

function canStandMountainVillage(x: number, z: number): boolean {
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  if (v < 4360 || v > 4470 || u < -360 || u > -310) return true;
  for (const h of mountainVillageHouses) {
    if (
      u >= h.minU - PLAYER_RADIUS &&
      u <= h.maxU + PLAYER_RADIUS &&
      v >= h.minV - PLAYER_RADIUS &&
      v <= h.maxV + PLAYER_RADIUS
    ) {
      return false;
    }
  }
  return true;
}

export function canStand(x: number, z: number): boolean {
  if (
    homeGateBlocks(x, z) ||
    estateFenceBlocks(x, z) ||
    nearbyAreca(x, z).some((p) => Math.hypot(x - p.x, z - p.z) < 0.62)
  )
    return false;
  const c = Math.cos(ward.canal.rotation),
    s = Math.sin(ward.canal.rotation);
  const u = x * c - z * s,
    v = x * s + z * c;
  for (const water of [ward.canal, ...ward.drains]) {
    const centerV = water.x * s + water.z * c,
      localV = v - centerV;
    if (
      Math.abs(u - water.u) < water.width / 2 + PLAYER_RADIUS &&
      Math.abs(localV) < water.depth / 2 + PLAYER_RADIUS &&
      !water.bridges.some((b) => Math.abs(localV - b) < 2.5 - PLAYER_RADIUS)
    )
      return false;
  }
  for (const poly of polylineCanals) {
    const onBridge = poly.bridges.some(
      (b) =>
        Math.abs(u - b.u) < b.width / 2 - PLAYER_RADIUS &&
        Math.abs(v - b.v) < b.depth / 2 - PLAYER_RADIUS,
    );
    if (!onBridge)
      for (let i = 1; i < poly.points.length; i++) {
        const [a, b] = poly.points[i - 1],
          [d, e] = poly.points[i],
          du = d - a,
          dv = e - b;
        const t = Math.max(
          0,
          Math.min(1, ((u - a) * du + (v - b) * dv) / (du * du + dv * dv)),
        );
        if (
          Math.hypot(u - a - t * du, v - b - t * dv) <
          poly.depth / 2 + PLAYER_RADIUS
        )
          return false;
      }
  }
  for (const village of kalayVillages) {
    const ew = village.canal;
    if (
      ew &&
      u >= ew.uMin - PLAYER_RADIUS &&
      u <= ew.uMax + PLAYER_RADIUS &&
      Math.abs(v - ew.v) < ew.width / 2 + PLAYER_RADIUS
    ) {
      const onEwBridge = ew.bridges.some(
        (b) => Math.abs(u - b.u) < b.width / 2 - PLAYER_RADIUS,
      );
      if (!onEwBridge) return false;
    }
    if (village.ponds) {
      for (const p of village.ponds) {
        const dx = x - p.x,
          dz = z - p.z;
        const lx = dx * c - dz * s,
          lz = dx * s + dz * c;
        if (
          Math.abs(lx) < p.width / 2 + PLAYER_RADIUS &&
          Math.abs(lz) < p.depth / 2 + PLAYER_RADIUS
        )
          return false;
      }
    }
  }
  const pond = ward.pond,
    px = x - pond.x,
    pz = z - pond.z;
  if (
    Math.abs(px * c - pz * s) < pond.width / 2 + PLAYER_RADIUS &&
    Math.abs(px * s + pz * c) < pond.depth / 2 + PLAYER_RADIUS
  )
    return false;
  const m = ward.monastery,
    dx = x - m.x,
    dz = z - m.z;
  const mu = dx * c - dz * s,
    mv = dx * s + dz * c;
  for (const b of m.buildings)
    if (
      Math.abs(mu - b.u) < b.width / 2 + PLAYER_RADIUS &&
      Math.abs(mv - b.v) < b.depth / 2 + PLAYER_RADIUS
    )
      return false;
  for (const p of m.stupas)
    if (Math.hypot(mu - p.u, mv - p.v) < p.radius + PLAYER_RADIUS) return false;
  if (
    mountainObstacles.some((m) => {
      const obstacleRadius =
        (m as { obstacleRadius?: number }).obstacleRadius ?? m.radius;
      return Math.hypot(x - m.x, z - m.z) < obstacleRadius + PLAYER_RADIUS;
    })
  )
    return false;
  for (const car of driveableCars) {
    if (car.id === carRide.carId) continue;
    const dx = x - car.x,
      dz = z - car.z,
      c = Math.cos(car.yaw),
      s = Math.sin(car.yaw);
    if (
      Math.abs(dx * c - dz * s) < (car.width * car.size) / 2 + PLAYER_RADIUS &&
      Math.abs(dx * s + dz * c) < (car.depth * car.size) / 2 + PLAYER_RADIUS
    )
      return false;
  }
  const edge = ward.size / 2 - PLAYER_RADIUS;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) > edge ||
    Math.abs(z) > edge
  )
    return false;
  if (!canStandFarmhouse(x, z)) return false;
  if (!canStandToilet(x, z)) return false;
  if (!canStandUShweHouse(x, z)) return false;
  if (!canStandMountainVillage(x, z)) return false;
  if (Math.hypot(x - 295.571, z - 261.63) < 2.4 + PLAYER_RADIUS) return false;
  if (Math.hypot(x - 109.721, z - 284.313) < 0.42 + PLAYER_RADIUS) return false;
  if (
    !motorcycleRide.riding && Math.hypot(x - motorcycleRide.x, z - motorcycleRide.z) <
    MOTORCYCLE_RADIUS + PLAYER_RADIUS
  )
    return false;
  if (
    Math.hypot(x - HAND_PUMP_X, z - HAND_PUMP_Z) <
    HAND_PUMP_RADIUS + PLAYER_RADIUS
  )
    return false;
  const spoutLenSq = SPOUT_LENGTH * SPOUT_LENGTH;
  const tSpout = Math.max(
    0,
    Math.min(
      1,
      ((x - HAND_PUMP_X) * SPOUT_DX + (z - HAND_PUMP_Z) * SPOUT_DZ) /
        spoutLenSq,
    ),
  );
  if (tSpout > 0.05 && tSpout < 0.94) {
    const pipeX = HAND_PUMP_X + tSpout * SPOUT_DX;
    const pipeZ = HAND_PUMP_Z + tSpout * SPOUT_DZ;
    if (Math.hypot(x - pipeX, z - pipeZ) < 0.2 + PLAYER_RADIUS) return false;
  }
  for (const h of nearbyBuildings(x, z)) {
    const dx = x - h.x,
      dz = z - h.z,
      c = Math.cos(h.rotation),
      s = Math.sin(h.rotation);
    const lx = dx * c - dz * s,
      lz = dx * s + dz * c;
    if (
      privateHomeIds.has(h.id) &&
      Math.abs(lx) < h.width / 2 + 1.6 + PLAYER_RADIUS &&
      lz > -h.depth / 2 - 1.5 - PLAYER_RADIUS &&
      lz < h.depth / 2 + 2.6 + PLAYER_RADIUS
    )
      return false;
    const nx = Math.max(-h.width / 2 - 0.6, Math.min(lx, h.width / 2 + 0.6));
    const nz = Math.max(-h.depth / 2 - 0.6, Math.min(lz, h.depth / 2 + 2.6));
    if (Math.hypot(lx - nx, lz - nz) < PLAYER_RADIUS) return false;
  }
  return !nearbyTrees(x, z).some(
    (t) => Math.hypot(x - t.x, z - t.z) < t.radius + PLAYER_RADIUS,
  );
}
export function move(
  position: { x: number; z: number },
  dx: number,
  dz: number,
  clear:(x:number,z:number)=>boolean=canStand,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  for (let i = 0; i < steps; i++) {
    if (clear(position.x + dx / steps, position.z)) position.x += dx / steps;
    if (clear(position.x, position.z + dz / steps)) position.z += dz / steps;
  }
}
