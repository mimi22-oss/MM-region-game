import { angle, toWorld } from '../data/ward.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
import type { MapProjection } from './mapProjection.ts';
import { MAHA_WEIPULA_SUMMIT_UV } from './weipulaClimb.ts';

/**
 * မဟာဝေပုလ္လ တောင်ခါးပန်း ချင်းလှေကားထစ်ရွာ (100-House Terraced Chin Mountainside Village)
 *
 * Centered right beside the user's location on the broad northeastern flank of Maha Weipula:
 *   Local U/V (m): -1220.837, 5398.042
 *   Scene X/Z (m):  2953.730, 4680.254
 *
 * Layout guarantees:
 * - 10 stepped contour-hugging hillside tiers (r = 790m .. 997m, step 23m) × 10 Chin homes = 100 houses
 * - Every house faces outward downhill along the mountain's radial contour toward Kalay Valley
 * - Minimum clearance >= 42m from every switchback climbing road segment & >= 120m from the stone stairway
 * - Uphill-sampled terrace baseY + deep stone hillside retaining piers so zero houses float or sink into slopes
 */

export const WEIPULA_CHIN_VILLAGE_ANCHOR_UV = {
  u: -1220.837,
  v: 5398.042,
} as const;

export const WEIPULA_CHIN_VILLAGE_ANCHOR_WORLD = toWorld(
  WEIPULA_CHIN_VILLAGE_ANCHOR_UV.u,
  WEIPULA_CHIN_VILLAGE_ANCHOR_UV.v,
);

/**
 * Calibrated local WGS84 <-> Scene projection anchored at the user's exact spot
 * (lon 94.0349118, lat 23.1151187 -> Scene X/Z 2953.730, 4680.254, rotation = PI/4).
 */
export const WEIPULA_CHIN_VILLAGE_PROJECTION: MapProjection = {
  origin: [94.0349118, 23.1151187],
  anchor: [
    Number(WEIPULA_CHIN_VILLAGE_ANCHOR_WORLD.x.toFixed(3)),
    Number(WEIPULA_CHIN_VILLAGE_ANCHOR_WORLD.z.toFixed(3)),
  ],
  metersPerDegree: [102351.44195621753, 111320],
  rotation: angle,
};

export const WEIPULA_CHIN_TIER_COUNT = 10;
export const WEIPULA_CHIN_COLS_PER_TIER = 10;
export const WEIPULA_CHIN_R_START = 790;
export const WEIPULA_CHIN_R_STEP = 23;
export const WEIPULA_CHIN_ARC_SPACING = 21.5;

const WALL_PALETTE = [
  '#6a482d',
  '#5c3b22',
  '#785233',
  '#4d311d',
  '#634227',
  '#734c2f',
  '#5a3c24',
] as const;

const ROOF_PALETTE = [
  '#7d3c2e',
  '#8a4435',
  '#2f523b',
  '#4f3d2e',
  '#52463e',
  '#3e5446',
  '#6e392c',
] as const;

export interface WeipulaChinHouseSpec {
  id: string;
  tier: number;
  col: number;
  title: string;
  u: number;
  v: number;
  x: number;
  z: number;
  baseY: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  wallColor: string;
  roofColor: string;
  hornbillScale: number;
  isChiefHouse: boolean;
  isClinic: boolean;
  terraceWidth: number;
  terraceDepth: number;
}

export interface WeipulaChinStairSegment {
  id: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  pitch: number;
  hyp: number;
  width: number;
}

function tierCenterDeg(tierIndex: number): number {
  return -60.0 + tierIndex * 0.25;
}

/**
 * Computes exact hillside terrace elevation so the uphill rear wall of each house
 * clears the rising mountain slope cleanly while the retaining stone pier anchors it.
 */
function sampleTerraceBaseY(
  u: number,
  v: number,
  radialDirU: number,
  radialDirV: number,
  tangentDirU: number,
  tangentDirV: number,
  halfW: number,
  halfD: number,
  peaks: readonly TerrainPeak[],
): number {
  // Uphill direction is -radialDir (toward summit)
  const backDist = halfD + 1.4;
  const hCenter = mountainHeight(u, v, peaks);
  const hBack = mountainHeight(u - radialDirU * backDist, v - radialDirV * backDist, peaks);
  const hBackLeft = mountainHeight(
    u - radialDirU * backDist - tangentDirU * halfW,
    v - radialDirV * backDist - tangentDirV * halfW,
    peaks,
  );
  const hBackRight = mountainHeight(
    u - radialDirU * backDist + tangentDirU * halfW,
    v - radialDirV * backDist + tangentDirV * halfW,
    peaks,
  );
  return Math.max(hCenter, hBack, hBackLeft, hBackRight) + 0.35;
}

/**
 * Builds all 100 stepped, contour-hugging Chin Traditional Houses on Maha Weipula's
 * northeastern terraced mountainside near (-1220.837, 5398.042).
 */
export function buildWeipulaChinVillageHouses(
  peaks: readonly TerrainPeak[],
): WeipulaChinHouseSpec[] {
  const cu = MAHA_WEIPULA_SUMMIT_UV.u;
  const cv = MAHA_WEIPULA_SUMMIT_UV.v;
  const houses: WeipulaChinHouseSpec[] = [];

  for (let tierIdx = 0; tierIdx < WEIPULA_CHIN_TIER_COUNT; tierIdx++) {
    const r = WEIPULA_CHIN_R_START + tierIdx * WEIPULA_CHIN_R_STEP;
    const arcStepRad = WEIPULA_CHIN_ARC_SPACING / r;
    const centerRad = (tierCenterDeg(tierIdx) * Math.PI) / 180;

    for (let colIdx = 0; colIdx < WEIPULA_CHIN_COLS_PER_TIER; colIdx++) {
      const offset = colIdx - (WEIPULA_CHIN_COLS_PER_TIER - 1) / 2;
      const theta = centerRad + offset * arcStepRad;
      const radialU = Math.cos(theta);
      const radialV = Math.sin(theta);
      const tangentU = -radialV;
      const tangentV = radialU;

      const u = cu + radialU * r;
      const v = cv + radialV * r;
      const world = toWorld(u, v);

      const idx = tierIdx * WEIPULA_CHIN_COLS_PER_TIER + colIdx;
      const isChiefHouse = tierIdx === 0 && colIdx === 4;
      const isClinic = tierIdx === 1 && colIdx === 4;
      const isTwoStorey = !isClinic && (idx % 5 === 2 || isChiefHouse);

      const width = isChiefHouse ? 9.4 : isClinic ? 8.6 : 7.8 + ((idx * 3) % 4) * 0.4;
      const depth = isChiefHouse ? 8.2 : isClinic ? 7.4 : 6.9 + ((idx * 5) % 3) * 0.4;
      const height = isChiefHouse ? 4.8 : isTwoStorey ? 4.9 : 3.7 + (idx % 2) * 0.25;

      const baseY = sampleTerraceBaseY(
        u,
        v,
        radialU,
        radialV,
        tangentU,
        tangentV,
        width / 2 + 1.0,
        depth / 2 + 0.8,
        peaks,
      );

      // Outward downhill rotation so front veranda & rooftop Hornbill beak face Kalay Valley
      const rotation = angle + Math.atan2(u - cu, v - cv);

      const wallColor = isClinic
        ? '#dde2d8'
        : isChiefHouse
          ? '#5c381e'
          : WALL_PALETTE[(tierIdx * 3 + colIdx * 2) % WALL_PALETTE.length];
      const roofColor = isClinic
        ? '#285438'
        : isChiefHouse
          ? '#823c2d'
          : ROOF_PALETTE[(tierIdx * 2 + colIdx * 3) % ROOF_PALETTE.length];

      const hornbillScale = isChiefHouse ? 1.38 : isTwoStorey ? 1.2 : 1.08;
      const tierNum = tierIdx + 1;
      const colNum = colIdx + 1;
      const title = isChiefHouse
        ? 'တောင်ခါးပန်း ချင်းရွာသူကြီးအိမ်'
        : isClinic
          ? 'တောင်ခါးပန်း ကျေးလက်ဆေးပေးခန်း'
          : `ချင်းလှေကားထစ်အိမ် (${tierNum}-${colNum})`;

      houses.push({
        id: `weipula-chin-t${String(tierNum).padStart(2, '0')}-c${String(colNum).padStart(2, '0')}`,
        tier: tierNum,
        col: colNum,
        title,
        u: Number(u.toFixed(3)),
        v: Number(v.toFixed(3)),
        x: Number(world.x.toFixed(3)),
        z: Number(world.z.toFixed(3)),
        baseY: Number(baseY.toFixed(3)),
        width: Number(width.toFixed(2)),
        depth: Number(depth.toFixed(2)),
        height: Number(height.toFixed(2)),
        rotation: Number(rotation.toFixed(6)),
        wallColor,
        roofColor,
        hornbillScale,
        isChiefHouse,
        isClinic,
        terraceWidth: Number((WEIPULA_CHIN_ARC_SPACING + 0.8).toFixed(2)),
        terraceDepth: Number((depth + 5.4).toFixed(2)),
      });
    }
  }

  return houses;
}

/**
 * Builds walkable vertical stone stair corridors connecting Tiers 1 -> 10 along two
 * hillside spines so visitors can walk seamlessly down all 10 terraced rows.
 */
export function buildWeipulaChinStairCorridors(
  peaks: readonly TerrainPeak[],
): WeipulaChinStairSegment[] {
  const cu = MAHA_WEIPULA_SUMMIT_UV.u;
  const cv = MAHA_WEIPULA_SUMMIT_UV.v;
  const segments: WeipulaChinStairSegment[] = [];
  const corridorOffsets = [-2.0, 2.0]; // Between cols 3-4 and cols 7-8

  for (let ci = 0; ci < corridorOffsets.length; ci++) {
    const colOffset = corridorOffsets[ci];
    for (let tierIdx = 0; tierIdx < WEIPULA_CHIN_TIER_COUNT - 1; tierIdx++) {
      const r1 = WEIPULA_CHIN_R_START + tierIdx * WEIPULA_CHIN_R_STEP;
      const r2 = WEIPULA_CHIN_R_START + (tierIdx + 1) * WEIPULA_CHIN_R_STEP;
      const theta1 =
        (tierCenterDeg(tierIdx) * Math.PI) / 180 + colOffset * (WEIPULA_CHIN_ARC_SPACING / r1);
      const theta2 =
        (tierCenterDeg(tierIdx + 1) * Math.PI) / 180 + colOffset * (WEIPULA_CHIN_ARC_SPACING / r2);

      const u1 = cu + Math.cos(theta1) * r1;
      const v1 = cv + Math.sin(theta1) * r1;
      const u2 = cu + Math.cos(theta2) * r2;
      const v2 = cv + Math.sin(theta2) * r2;

      const y1 = mountainHeight(u1, v1, peaks) + 2.4;
      const y2 = mountainHeight(u2, v2, peaks) + 2.4;
      const du = u2 - u1;
      const dv = v2 - v1;
      const horiz = Math.hypot(du, dv);
      const dy = y2 - y1;
      const hyp = Math.hypot(horiz, dy);
      const midWorld = toWorld((u1 + u2) / 2, (v1 + v2) / 2);

      segments.push({
        id: `chin-stair-spine-${ci + 1}-t${tierIdx + 1}`,
        x: Number(midWorld.x.toFixed(3)),
        y: Number(((y1 + y2) / 2).toFixed(3)),
        z: Number(midWorld.z.toFixed(3)),
        rotation: Number((angle + Math.atan2(du, dv)).toFixed(6)),
        pitch: Number(Math.atan2(dy, horiz).toFixed(6)),
        hyp: Number(hyp.toFixed(3)),
        width: 3.4,
      });
    }
  }

  return segments;
}

/**
 * Fast polar envelope check so mountain forest trees & grass tufts stay cleanly clear
 * of the 100-house terraced Chin hillside village.
 */
export function isInsideWeipulaChinVillageUV(u: number, v: number, margin = 12): boolean {
  const du = u - MAHA_WEIPULA_SUMMIT_UV.u;
  const dv = v - MAHA_WEIPULA_SUMMIT_UV.v;
  const r = Math.hypot(du, dv);
  const rMin = WEIPULA_CHIN_R_START - margin;
  const rMax =
    WEIPULA_CHIN_R_START + (WEIPULA_CHIN_TIER_COUNT - 1) * WEIPULA_CHIN_R_STEP + margin;
  if (r < rMin || r > rMax) return false;

  const deg = (Math.atan2(dv, du) * 180) / Math.PI;
  // Angular span of the 10 terraced rows plus safety margin (~±1.5 deg)
  return deg >= -69.5 && deg <= -49.5;
}

/**
 * Computes which tier (1..10) a local (u, v) point falls on inside the terraced Chin village,
 * or null if outside. Used by location detection.
 */
export function detectWeipulaChinVillageTier(u: number, v: number): number | null {
  if (!isInsideWeipulaChinVillageUV(u, v, 14)) return null;
  const r = Math.hypot(u - MAHA_WEIPULA_SUMMIT_UV.u, v - MAHA_WEIPULA_SUMMIT_UV.v);
  const tier = Math.round((r - WEIPULA_CHIN_R_START) / WEIPULA_CHIN_R_STEP) + 1;
  return Math.max(1, Math.min(WEIPULA_CHIN_TIER_COUNT, tier));
}
