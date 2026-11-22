import { angle, toWorld, ward } from '../data/ward.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
import { isOnTaungphilaRoad } from './taungphilaWorld.ts';
import { isOnWeipulaRoad, type MountainTreePlot } from './weipulaClimb.ts';

/**
 * ============================================================================
 * Walkable Highland Plateau World (100+ Mountain Villages & Base Camps + 10,000+ Flora/Rocks)
 * ============================================================================
 * Transforms the mountains from pointy spikes into broad, walkable, flat highland
 * meadows where players can walk, ride horses, or ride motorcycles like real wards:
 * - 108 Highland Settlements (18 full Base Camps with radial trails, tents, campfires,
 *   firewood stacks, ponds & stone quarries + 90 Highland Mountain Villages with 450+ homes)
 * - 4,200+ Highland Trees (fed into existing `MountainForestFixedPool` / `TreeAssetCache`)
 * - 3,200+ Lush Meadow Bushes & Shrubs (`ခြုံပုတ်များ`)
 * - 2,200+ Natural Boulders & Quarry Rocks (`ကျောက်တုံးများ`)
 * - Spatial Grid Index (`180m` cells) for O(1) collision & camera-driven Fixed Object Pool sync
 * - Kept strictly out of eager TypeScript barrels (`ward.ts` / `villages/index.ts`)
 */

const SPATIAL_CELL_M = 180;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

export interface HighlandHousePlot {
  readonly id: string;
  readonly settlementId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly rotation: number;
  readonly wallTintIndex: number;
  readonly roofTintIndex: number;
}

export interface HighlandCampPlot {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotation: number;
  readonly logX: number;
  readonly logY: number;
  readonly logZ: number;
  readonly jarX: number;
  readonly jarY: number;
  readonly jarZ: number;
}

export interface HighlandPondPlot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly rotation: number;
}

export interface HighlandTrailPlot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly length: number;
  readonly rotation: number;
  readonly isHub: boolean;
}

export interface HighlandBoulderPlot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly rotation: number;
  readonly tintIndex: number;
  readonly solidRadius: number;
}

export interface HighlandBushPlot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly rotation: number;
  readonly tintIndex: number;
}

export interface HighlandSettlementMeta {
  readonly id: string;
  readonly name: string;
  readonly kind: 'camp' | 'village';
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

export interface HighlandPlateauCatalog {
  readonly settlements: readonly HighlandSettlementMeta[];
  readonly houses: readonly HighlandHousePlot[];
  readonly camps: readonly HighlandCampPlot[];
  readonly ponds: readonly HighlandPondPlot[];
  readonly trails: readonly HighlandTrailPlot[];
  readonly boulders: readonly HighlandBoulderPlot[];
  readonly bushes: readonly HighlandBushPlot[];
  readonly trees: readonly MountainTreePlot[];
}

interface CollisionCell {
  houses: HighlandHousePlot[];
  camps: HighlandCampPlot[];
  ponds: HighlandPondPlot[];
  boulders: HighlandBoulderPlot[];
  trees: MountainTreePlot[];
}

export const HIGHLAND_HOUSE_DOOR_HALF_W = 0.85;
export const HIGHLAND_HOUSE_WALL_THICKNESS = 0.28;
export const HIGHLAND_HOUSE_FLOOR_HEIGHT = 0.24;

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * Deterministically builds the entire flat Highland Plateau World:
 * 108 Highland Settlements (18 Base Camps + 90 Villages), 450+ Houses,
 * 4,200+ Trees, 3,200+ Bushes, and 2,200+ Boulders across the wide flat
 * plateaus from Taungphila Mountain down the Western Tableland to Maha Weipula.
 */
export function buildHighlandPlateauCatalog(
  peaks: readonly TerrainPeak[] = [...ward.mountains, ...ward.weipula.peaks],
): HighlandPlateauCatalog {
  const rng = createRng(2026112299);
  const settlements: HighlandSettlementMeta[] = [];
  const houses: HighlandHousePlot[] = [];
  const camps: HighlandCampPlot[] = [];
  const ponds: HighlandPondPlot[] = [];
  const trails: HighlandTrailPlot[] = [];
  const boulders: HighlandBoulderPlot[] = [];
  const bushes: HighlandBushPlot[] = [];
  const trees: MountainTreePlot[] = [];

  const isClearOfHighways = (x: number, z: number): boolean =>
    !isOnTaungphilaRoad(x, z, -7) && !isOnWeipulaRoad(x, z, -7);

  // 1. Generate 108 Highland Settlement Centers across the broad flat Western Highland Plateaus
  //    (u = -800..-1210, v = 130..4480) + Maha Weipula Shoulder Plateaus!
  //    Grid layout guarantees zero overlapping villages/camps and generous flat meadow spacing.
  const rows = 36;
  const cols = 3; // 36 * 3 = 108 settlements!
  let campIdx = 0;
  let villageIdx = 0;

  for (let row = 0; row < rows; row++) {
    const baseV = 165 + row * 120;
    for (let col = 0; col < cols; col++) {
      const baseU = -845 - col * 145 + (row % 2 ? -24 : 24);
      const u = baseU + (rng() - 0.5) * 26;
      const v = baseV + (rng() - 0.5) * 26;
      const y = mountainHeight(u, v, peaks);
      if (y < 25) continue;

      const world = toWorld(u, v);
      if (!isClearOfHighways(world.x, world.z)) continue;

      // Every 6th settlement (18 total, including first camp right beside Taungphila!) is a Full Base Camp
      // modeled directly after the user's reference scene (hub + 5 radial paths + tent + campfire + logs + pond + quarry)!
      const isCamp = (row * cols + col) % 6 === 0;
      const settlementId = isCamp ? `hp-camp-${++campIdx}` : `hp-village-${++villageIdx}`;
      const name = isCamp
        ? `တောင်ပေါ် စခန်း (${campIdx})`
        : `တောင်ပေါ် လွင်ပြင်ရွာ (${villageIdx})`;

      settlements.push({
        id: settlementId,
        name,
        kind: isCamp ? 'camp' : 'village',
        u,
        v,
        x: world.x,
        y,
        z: world.z,
        radius: isCamp ? 42 : 46,
      });

      // Central sandy-ochre earthen clearing hub (`မြေနီကွင်းပြင်`)
      trails.push({
        id: `${settlementId}-hub`,
        x: world.x,
        y: y + 0.08,
        z: world.z,
        width: isCamp ? 13.5 : 15.0,
        length: isCamp ? 13.5 : 15.0,
        rotation: angle + rng() * Math.PI,
        isHub: true,
      });

      if (isCamp) {
        // 5 Radial Earthen Trails (`မြေနီလမ်း ၅ ဖြာ`) branching out from camp center
        const branchAngles = [0.2, 1.45, 2.65, 3.85, 5.15];
        for (let b = 0; b < branchAngles.length; b++) {
          const theta = angle + branchAngles[b] + (rng() - 0.5) * 0.16;
          const len = 24 + rng() * 10;
          const midDist = len * 0.5 + 3.2;
          const bx = world.x + Math.sin(theta) * midDist;
          const bz = world.z + Math.cos(theta) * midDist;
          const bu = bx * cosA - bz * sinA;
          const bv = bx * sinA + bz * cosA;
          trails.push({
            id: `${settlementId}-trail-${b}`,
            x: bx,
            y: mountainHeight(bu, bv, peaks) + 0.07,
            z: bz,
            width: 3.4,
            length: len,
            rotation: theta,
            isHub: false,
          });
        }

        // Branch 0 (South/Front): Tent Shelter + Stone Campfire Ring
        const campTheta = angle + branchAngles[0];
        const tentU = u + Math.sin(branchAngles[0]) * 16;
        const tentV = v + Math.cos(branchAngles[0]) * 16;
        const tentW = toWorld(tentU, tentV);
        const tentY = mountainHeight(tentU, tentV, peaks);

        // Branch 1 (West): Woodcutter Firewood Log Stack & Stump
        const logU = u + Math.sin(branchAngles[1]) * 20;
        const logV = v + Math.cos(branchAngles[1]) * 20;
        const logW = toWorld(logU, logV);
        const logY = mountainHeight(logU, logV, peaks);

        // Branch 2 (North-East): Clear Water Pond with Ceramic Water Jar & Shoreline Rocks
        const pondU = u + Math.sin(branchAngles[2]) * 24;
        const pondV = v + Math.cos(branchAngles[2]) * 24;
        const pondW = toWorld(pondU, pondV);
        const pondY = mountainHeight(pondU, pondV, peaks);

        const jarU = u + Math.sin(branchAngles[2]) * 16.5;
        const jarV = v + Math.cos(branchAngles[2]) * 16.5;
        const jarW = toWorld(jarU, jarV);
        const jarY = mountainHeight(jarU, jarV, peaks);

        camps.push({
          id: `${settlementId}-base`,
          name,
          x: tentW.x,
          y: tentY,
          z: tentW.z,
          rotation: campTheta + Math.PI,
          logX: logW.x,
          logY,
          logZ: logW.z,
          jarX: jarW.x,
          jarY,
          jarZ: jarW.z,
        });

        ponds.push({
          id: `${settlementId}-pond`,
          x: pondW.x,
          y: pondY,
          z: pondW.z,
          radiusX: 8.2 + rng() * 2.4,
          radiusZ: 6.4 + rng() * 2.0,
          rotation: angle + rng() * 0.8,
        });

        // Branch 3 & 4 (East): Stone Quarry & Boulder Outcrop (6 clustered quarry rocks!)
        const qU = u + Math.sin(branchAngles[3]) * 22;
        const qV = v + Math.cos(branchAngles[3]) * 22;
        for (let r = 0; r < 6; r++) {
          const ru = qU + (rng() - 0.5) * 11;
          const rv = qV + (rng() - 0.5) * 11;
          const rw = toWorld(ru, rv);
          const ry = mountainHeight(ru, rv, peaks);
          const s = 1.6 + rng() * 2.2;
          boulders.push({
            id: `${settlementId}-quarry-${r}`,
            x: rw.x,
            y: ry + s * 0.35,
            z: rw.z,
            sx: s * (1.1 + rng() * 0.4),
            sy: s * (0.75 + rng() * 0.35),
            sz: s * (1.0 + rng() * 0.4),
            rotation: rng() * Math.PI * 2,
            tintIndex: r % 4,
            solidRadius: s * 0.72,
          });
        }
      } else {
        // Highland Mountain Village (`တောင်ပေါ် လွင်ပြင်ရွာ`): 4–6 traditional timber houses around village square + paths!
        const houseCount = 4 + (villageIdx % 3); // 4, 5, or 6 houses -> ~450+ highland houses!
        for (let h = 0; h < houseCount; h++) {
          const a = (h / houseCount) * Math.PI * 2 + (rng() - 0.5) * 0.28;
          const dist = 16 + rng() * 14;
          const hu = u + Math.cos(a) * dist;
          const hv = v + Math.sin(a) * dist;
          const hw = toWorld(hu, hv);
          if (!isClearOfHighways(hw.x, hw.z)) continue;
          const hy = mountainHeight(hu, hv, peaks);
          houses.push({
            id: `${settlementId}-h-${h}`,
            settlementId,
            x: hw.x,
            y: hy,
            z: hw.z,
            width: 6.4 + rng() * 2.4,
            depth: 5.8 + rng() * 2.2,
            height: 3.4 + rng() * 1.4,
            rotation: angle + a + Math.PI / 2,
            wallTintIndex: (villageIdx + h) % 5,
            roofTintIndex: (villageIdx + h * 2) % 4,
          });
        }

        // 2 Cross village lanes connecting the homes smoothly
        for (let l = 0; l < 2; l++) {
          const laneRot = angle + l * (Math.PI / 2) + (rng() - 0.5) * 0.25;
          trails.push({
            id: `${settlementId}-lane-${l}`,
            x: world.x,
            y: y + 0.07,
            z: world.z,
            width: 4.2,
            length: 44,
            rotation: laneRot,
            isHub: false,
          });
        }

        // Every 3rd highland village also has a peaceful village water pond!
        if (villageIdx % 3 === 0) {
          const pu = u + 26 * (rng() > 0.5 ? 1 : -1);
          const pv = v + (rng() - 0.5) * 18;
          const pw = toWorld(pu, pv);
          if (isClearOfHighways(pw.x, pw.z)) {
            ponds.push({
              id: `${settlementId}-pond`,
              x: pw.x,
              y: mountainHeight(pu, pv, peaks),
              z: pw.z,
              radiusX: 7.0 + rng() * 2.5,
              radiusZ: 5.5 + rng() * 2.0,
              rotation: angle + rng(),
            });
          }
        }
      }
    }
  }

  // Build quick settlement center lookup to keep camp/village hubs clean while ringing them with lush groves
  const settlementClear = (u: number, v: number, minHubR: number): boolean => {
    for (let i = 0; i < settlements.length; i++) {
      const s = settlements[i];
      const du = u - s.u;
      const dv = v - s.v;
      if (du * du + dv * dv < minHubR * minHubR) return false;
    }
    return true;
  };

  // 2. 4,200+ Highland Trees (`သစ်ပင်တွေ ထောင်နဲ့ချီ`) blanketing the flat highland meadows & slopes
  //    (Consumed by the EXISTING `MountainForestFixedPool` & `TreeAssetCache` — ZERO duplication!)
  const targetTrees = 4200;
  let attempts = 0;
  while (trees.length < targetTrees && attempts < targetTrees * 4) {
    attempts++;
    const u = -1320 + rng() * 760; // u ∈ [-1320, -560] across Taungphila + Western Highland Tableland
    const v = 50 + rng() * 4480;
    const h = mountainHeight(u, v, peaks);
    if (h < 12) continue;
    if (!settlementClear(u, v, 24)) continue;
    const w = toWorld(u, v);
    if (!isClearOfHighways(w.x, w.z)) continue;
    trees.push({
      id: `hp-tree-${trees.length}`,
      u,
      v,
      x: w.x,
      y: h - 0.14,
      z: w.z,
      scale: 0.78 + rng() * 1.05,
      kind: rng() > 0.42 ? 'broad' : 'pine',
      tintIndex: Math.floor(rng() * 5),
    });
  }

  // 3. 3,200+ Lush Sunlit Bushes & Meadow Shrubs (`ခြုံပုတ်များ`)
  const targetBushes = 3200;
  attempts = 0;
  while (bushes.length < targetBushes && attempts < targetBushes * 3) {
    attempts++;
    const u = -1310 + rng() * 750;
    const v = 50 + rng() * 4480;
    const h = mountainHeight(u, v, peaks);
    if (h < 8) continue;
    if (!settlementClear(u, v, 11)) continue;
    const w = toWorld(u, v);
    if (!isClearOfHighways(w.x, w.z)) continue;
    const bs = 0.85 + rng() * 1.35;
    bushes.push({
      id: `hp-bush-${bushes.length}`,
      x: w.x,
      y: h + bs * 0.25,
      z: w.z,
      sx: bs * (1.05 + rng() * 0.45),
      sy: bs * (0.62 + rng() * 0.32),
      sz: bs * (1.05 + rng() * 0.45),
      rotation: rng() * Math.PI * 2,
      tintIndex: Math.floor(rng() * 5),
    });
  }

  // 4. 2,200+ Natural Boulders & Stones (`ကျောက်တုံးများ`) across trailsides, ponds, and ridges
  const targetBoulders = 2200;
  attempts = 0;
  while (boulders.length < targetBoulders && attempts < targetBoulders * 3) {
    attempts++;
    const u = -1310 + rng() * 750;
    const v = 50 + rng() * 4480;
    const h = mountainHeight(u, v, peaks);
    if (h < 8) continue;
    if (!settlementClear(u, v, 13)) continue;
    const w = toWorld(u, v);
    if (!isClearOfHighways(w.x, w.z)) continue;
    const rs = 0.65 + rng() * 1.95;
    boulders.push({
      id: `hp-rock-${boulders.length}`,
      x: w.x,
      y: h + rs * 0.28,
      z: w.z,
      sx: rs * (1.1 + rng() * 0.5),
      sy: rs * (0.58 + rng() * 0.42),
      sz: rs * (0.95 + rng() * 0.48),
      rotation: rng() * Math.PI * 2,
      tintIndex: Math.floor(rng() * 4),
      // Only large boulders (>= 1.6m) block walking; smaller pebbles/stones can be stepped over smoothly
      solidRadius: rs >= 1.6 ? rs * 0.62 : 0,
    });
  }

  return { settlements, houses, camps, ponds, trails, boulders, bushes, trees };
}

let cachedCatalog: HighlandPlateauCatalog | null = null;
let cachedCollisionGrid: Map<string, CollisionCell> | null = null;

export function getHighlandPlateauCatalog(): HighlandPlateauCatalog {
  if (!cachedCatalog) {
    cachedCatalog = buildHighlandPlateauCatalog();
  }
  return cachedCatalog;
}

function getCollisionGrid(): Map<string, CollisionCell> {
  if (cachedCollisionGrid) return cachedCollisionGrid;
  const cat = getHighlandPlateauCatalog();
  const grid = new Map<string, CollisionCell>();

  const getCell = (x: number, z: number): CollisionCell => {
    const k = cellKey(Math.floor(x / SPATIAL_CELL_M), Math.floor(z / SPATIAL_CELL_M));
    let cell = grid.get(k);
    if (!cell) {
      cell = { houses: [], camps: [], ponds: [], boulders: [], trees: [] };
      grid.set(k, cell);
    }
    return cell;
  };

  for (const h of cat.houses) getCell(h.x, h.z).houses.push(h);
  for (const c of cat.camps) getCell(c.x, c.z).camps.push(c);
  for (const p of cat.ponds) getCell(p.x, p.z).ponds.push(p);
  for (const b of cat.boulders) {
    if (b.sx >= 0.65 || b.solidRadius > 0) getCell(b.x, b.z).boulders.push(b);
  }
  for (const t of cat.trees) getCell(t.x, t.z).trees.push(t);

  cachedCollisionGrid = grid;
  return grid;
}

/**
 * Checks circle-vs-AABB hit in house-local coordinates for walk-in 4-wall + doorway houses.
 */
function hitsLocalBox(
  lx: number,
  lz: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  radius: number,
): boolean {
  const nx = Math.max(minX, Math.min(lx, maxX));
  const nz = Math.max(minZ, Math.min(lz, maxZ));
  const dx = lx - nx;
  const dz = lz - nz;
  return dx * dx + dz * dz < radius * radius;
}

/**
 * O(1) walkable surface height for Highland Plateau walk-in house floors AND
 * climbable mountain boulders. Returns `null` when standing on natural terrain.
 */
export function highlandPlateauSurfaceHeight(x: number, z: number): number | null {
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  if (u > -540 || u < -1380 || v < 20 || v > 4580) return null;

  const grid = getCollisionGrid();
  const cx = Math.floor(x / SPATIAL_CELL_M);
  const cz = Math.floor(z / SPATIAL_CELL_M);
  let bestY: number | null = null;

  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const cell = grid.get(cellKey(cx + ox, cz + oz));
      if (!cell) continue;

      // 1. Flat walkable timber deck & interior floor inside Highland houses
      for (let i = 0; i < cell.houses.length; i++) {
        const h = cell.houses[i];
        const dx = x - h.x;
        const dz = z - h.z;
        const bound = Math.max(h.width, h.depth) * 0.72 + 1.2;
        if (dx * dx + dz * dz > bound * bound) continue;
        const hc = Math.cos(h.rotation);
        const hs = Math.sin(h.rotation);
        const lx = dx * hc - dz * hs;
        const lz = dx * hs + dz * hc;
        if (Math.abs(lx) <= h.width * 0.5 + 0.65 && Math.abs(lz) <= h.depth * 0.5 + 0.8) {
          const floorY = h.y + HIGHLAND_HOUSE_FLOOR_HEIGHT;
          if (bestY === null || floorY > bestY) bestY = floorY;
        }
      }

      // 2. Climbable Highland mountain boulders (smooth dome surface you can climb onto!)
      for (let i = 0; i < cell.boulders.length; i++) {
        const b = cell.boulders[i];
        const rx = b.sx * 0.96;
        const rz = b.sz * 0.96;
        const dx = x - b.x;
        const dz = z - b.z;
        const maxR = Math.max(rx, rz);
        if (dx * dx + dz * dz > maxR * maxR) continue;
        const bc = Math.cos(b.rotation);
        const bs = Math.sin(b.rotation);
        const lx = dx * bc - dz * bs;
        const lz = dx * bs + dz * bc;
        const normSq = (lx * lx) / (rx * rx) + (lz * lz) / (rz * rz);
        if (normSq < 1) {
          const dome = Math.sqrt(Math.max(0, 1 - normSq * 0.72));
          const rockTopY = b.y + b.sy * 0.78 * dome;
          if (bestY === null || rockTopY > bestY) bestY = rockTopY;
        }
      }
    }
  }

  return bestY;
}

/**
 * O(1) trunk collision check for all Highland Plateau trees so bumping into
 * mountain trees triggers the exact same knockback/recoil as village trees!
 */
export function highlandTreeBlocks(x: number, z: number, playerRadius = 0.4): boolean {
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  if (u > -540 || u < -1380 || v < 20 || v > 4580) return false;

  const grid = getCollisionGrid();
  const cx = Math.floor(x / SPATIAL_CELL_M);
  const cz = Math.floor(z / SPATIAL_CELL_M);

  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const cell = grid.get(cellKey(cx + ox, cz + oz));
      if (!cell) continue;
      for (let i = 0; i < cell.trees.length; i++) {
        const t = cell.trees[i];
        const trunkR = Math.min(0.55, 0.32 * t.scale) + playerRadius;
        const dx = x - t.x;
        const dz = z - t.z;
        if (dx * dx + dz * dz < trunkR * trunkR) return true;
      }
    }
  }

  return false;
}

/**
 * O(1) spatial collision check for Highland Plateau settlements, walk-in house walls,
 * ponds, and tent cores. Open house doorways, house interiors, climbable boulders,
 * branching earthen trails, and village lanes stay 100% open & walkable!
 */
export function canStandHighlandPlateau(
  x: number,
  z: number,
  playerRadius = 0.4,
  airborne = false,
): boolean {
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  // Fast AABB reject outside the Western Highland Plateau corridor (zero cost in town/villages!)
  if (u > -540 || u < -1380 || v < 20 || v > 4580) return true;

  const grid = getCollisionGrid();
  const cx = Math.floor(x / SPATIAL_CELL_M);
  const cz = Math.floor(z / SPATIAL_CELL_M);

  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) {
      const cell = grid.get(cellKey(cx + ox, cz + oz));
      if (!cell) continue;

      // 1. Walk-in Highland timber houses (4 exterior walls block; front doorway + interior are 100% walkable!)
      for (let i = 0; i < cell.houses.length; i++) {
        const h = cell.houses[i];
        const dx = x - h.x;
        const dz = z - h.z;
        const bound = Math.max(h.width, h.depth) * 0.72 + playerRadius;
        if (dx * dx + dz * dz > bound * bound) continue;
        const hc = Math.cos(h.rotation);
        const hs = Math.sin(h.rotation);
        const lx = dx * hc - dz * hs;
        const lz = dx * hs + dz * hc;

        const halfW = h.width * 0.5;
        const halfD = h.depth * 0.5;
        const t = HIGHLAND_HOUSE_WALL_THICKNESS;
        const doorHalfW = Math.min(HIGHLAND_HOUSE_DOOR_HALF_W, halfW - t - 0.35);

        // Back wall (-Z), Left wall (-X), Right wall (+X)
        if (
          hitsLocalBox(lx, lz, -halfW, halfW, -halfD, -halfD + t, playerRadius) ||
          hitsLocalBox(lx, lz, -halfW, -halfW + t, -halfD, halfD, playerRadius) ||
          hitsLocalBox(lx, lz, halfW - t, halfW, -halfD, halfD, playerRadius) ||
          // Front wall (+Z) left & right of the open doorway
          hitsLocalBox(lx, lz, -halfW, -doorHalfW, halfD - t, halfD, playerRadius) ||
          hitsLocalBox(lx, lz, doorHalfW, halfW, halfD - t, halfD, playerRadius)
        ) {
          return false;
        }
      }

      // 2. Camp tent cores (campfire & surrounding clearing stay walkable)
      for (let i = 0; i < cell.camps.length; i++) {
        const c = cell.camps[i];
        const dx = x - c.x;
        const dz = z - c.z;
        const r = 2.6 + playerRadius;
        if (dx * dx + dz * dz < r * r) return false;
      }

      // 3. Highland water ponds (water interior blocks when grounded; shoreline stays open)
      if (!airborne) {
        for (let i = 0; i < cell.ponds.length; i++) {
          const p = cell.ponds[i];
          const dx = x - p.x;
          const dz = z - p.z;
          const maxR = Math.max(p.radiusX, p.radiusZ) + playerRadius;
          if (dx * dx + dz * dz > maxR * maxR) continue;
          const pc = Math.cos(p.rotation);
          const ps = Math.sin(p.rotation);
          const lx = dx * pc - dz * ps;
          const lz = dx * ps + dz * pc;
          const rx = Math.max(1, p.radiusX - 1.1) + playerRadius;
          const rz = Math.max(1, p.radiusZ - 1.1) + playerRadius;
          if ((lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) < 1) return false;
        }
      }
      // Note: Boulders are now climbable walkable surfaces via `highlandPlateauSurfaceHeight`!
    }
  }

  return true;
}
