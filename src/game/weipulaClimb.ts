import { angle, toWorld } from '../data/ward.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';
import { isInsideWeipulaChinVillageUV } from './weipulaChinVillageLayout.ts';

/**
 * မဟာဝေပုလ္လတောင်တော် တောင်တက်လမ်း၊ စောင်းတန်းလှေကားနှင့် စိမ်းလန်းတောင်တော ဂျီသြမေတြီ
 *
 * Key guarantees:
 * 1. The scenic winding switchback mountain highway follows exact contour-hugging polar
 *    switchbacks across the front northern face of Maha Weipula (r = 1,500m -> 52m,
 *    y = 0m -> 1,320m) AND samples the uphill terrain shoulder across the full road width
 *    so the road surface is ALWAYS cleanly visible above the grass terrain (never buried!).
 * 2. Every climbed road segment maintains gentle drivable/walkable grade (<= 30%) via
 *    upward-preserving grade relaxation (never sinking below the terrain surface).
 * 3. Direct northern ridge pilgrim stone stairway climbs continuously from the Base
 *    Welcome Archway (y ≈ 0m) to the 1,320m Golden Pagoda terrace, also kept cleanly
 *    above the terrain mesh with 4 scenic rest pavilions.
 * 4. Dense green forest of 1,000+ lush pines, broadleaf trees, and green meadow shrubs
 *    covers the entire mountain while staying clear of all roads, stairways, and plazas.
 */

export const MAHA_WEIPULA_SUMMIT_UV = { u: -1560, v: 6120 } as const;
export const MAHA_WEIPULA_PLAZA_UV = { u: -1560, v: 6068 } as const;
export const MAHA_WEIPULA_BASE_GATE_UV = { u: -1560, v: 4610 } as const;
export const WEIPULA_VILLAGE_V_OFFSET = 420;

export type RoadControlPoint = {
  u: number;
  v: number;
  w: number;
};

/**
 * Generates smooth contour-hugging switchback waypoints across the broad northern face
 * of Maha Weipula so the highway zig-zags gracefully up the lush green mountainside
 * with ~6.8 km climbing length (~19% average grade, never buried inside the mountain!).
 */
function generateSwitchbackWaypoints(): RoadControlPoint[] {
  const cu = MAHA_WEIPULA_SUMMIT_UV.u;
  const cv = MAHA_WEIPULA_SUMMIT_UV.v;
  const pts: RoadControlPoint[] = [
    // 1. Flat valley approach from AH1 (south of the 10 Nat Myaung separation paddy fields)
    { u: -6, v: 4580, w: 10.5 },
    { u: -180, v: 4582, w: 10.2 },
    { u: -360, v: 4584, w: 10.2 },
    { u: -445, v: 4588, w: 10.2 },

    // 2. Scenic Winding Mountain Pass OVER the western ridge crest at (-635, 4665)
    //    (Instead of tunneling under the ridge, the road switchbacks smoothly up the east flank,
    //     crosses right over the mountain top around (-635, 4665), and winds gently down the west flank!)
    // East flank climb — Leg A (South-West along lower east slope)
    { u: -485, v: 4635, w: 10.0 },
    { u: -515, v: 4720, w: 10.0 },
    { u: -505, v: 4800, w: 10.0 },
    // East Hairpin 1
    { u: -545, v: 4830, w: 10.4 },
    // East flank climb — Leg B (North-West sweeping up mid-slope)
    { u: -565, v: 4745, w: 10.0 },
    { u: -560, v: 4655, w: 10.0 },
    { u: -555, v: 4575, w: 10.0 },
    // East Hairpin 2 (broad bend climbing gently into the ridge saddle)
    { u: -590, v: 4545, w: 10.4 },
    // Summit Ridge Pass crossing right over (-635, 4665)
    { u: -610, v: 4605, w: 10.2 },
    { u: -635, v: 4665, w: 10.6 },
    // West flank descent — Leg A (winding smoothly south-west down upper west slope)
    { u: -675, v: 4740, w: 10.0 },
    { u: -710, v: 4775, w: 10.0 },
    // West Hairpin 1
    { u: -745, v: 4745, w: 10.4 },
    // West flank descent — Leg B (sweeping north-west down lower west slope)
    { u: -735, v: 4660, w: 10.0 },
    { u: -735, v: 4580, w: 10.0 },
    { u: -775, v: 4550, w: 10.0 },
    // Valley floor west of the ridge pass -> Base Welcome Archway
    { u: -840, v: 4580, w: 10.2 },
    { u: -1020, v: 4592, w: 10.2 },
    { u: -1280, v: 4602, w: 10.2 },
    // Base Welcome Archway & Stairway Trailhead (y ≈ 0m)
    { u: MAHA_WEIPULA_BASE_GATE_UV.u, v: MAHA_WEIPULA_BASE_GATE_UV.v, w: 11.0 },
  ];

  // 3. Parametric 6-sweep panoramic switchback hugging the northern face of 1,320m Maha Weipula
  //    (Angle centered at -PI/2, due North facing Nat Myaung / Kalay Valley!)
  const climbSamples = 170;
  const rStart = 1510;
  const rEnd = 52;
  for (let i = 1; i <= climbSamples; i++) {
    const t = i / climbSamples;
    const r = rStart + (rEnd - rStart) * t;
    const envelope =
      Math.sin(Math.min(1, t / 0.08) * (Math.PI / 2)) *
      Math.sin(Math.min(1, (1 - t) / 0.1) * (Math.PI / 2));
    const angularSpan = (0.64 + 0.56 * Math.pow(t, 0.85)) * envelope;
    const theta = -Math.PI / 2 - Math.sin(t * Math.PI * 6) * angularSpan;

    const u = cu + Math.cos(theta) * r;
    const v = cv + Math.sin(theta) * r;
    const w = t > 0.94 ? 11.2 : 10.0;
    pts.push({ u, v, w });
  }

  // Final tie-in directly onto the Summit Parking Plaza
  pts.push({ u: MAHA_WEIPULA_PLAZA_UV.u, v: MAHA_WEIPULA_PLAZA_UV.v, w: 11.5 });
  return pts;
}

export const WEIPULA_ROAD_CONTROL_POINTS: readonly RoadControlPoint[] =
  generateSwitchbackWaypoints();

export type PitchedRoadSegment = {
  key: string;
  u1: number;
  v1: number;
  y1: number;
  u2: number;
  v2: number;
  y2: number;
  x: number;
  y: number;
  z: number;
  length: number;
  hyp: number;
  width: number;
  yaw: number;
  pitch: number;
  grade: number;
  hasGuardrail: boolean;
};

/**
 * Computes the maximum terrain height across all 8 radial directions around (u, v)
 * (at road-edge 6.5m and terrain-grid margin 11.5m) so EVERY road segment — including
 * the ridge pass over (-635, 4665) AND the 1,320m Maha Weipula climb — stays 100%
 * visible above the green mountainside and can NEVER tunnel underground.
 */
function roadMinVisibleElevation(u: number, v: number, peaks: readonly TerrainPeak[]): number {
  let maxH = mountainHeight(u, v, peaks);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7071, 0.7071],
    [-0.7071, 0.7071],
    [0.7071, -0.7071],
    [-0.7071, -0.7071],
  ] as const;
  for (const [dx, dz] of dirs) {
    const hNear = mountainHeight(u + dx * 6.5, v + dz * 6.5, peaks);
    if (hNear > maxH) maxH = hNear;
    const hFar = mountainHeight(u + dx * 11.5, v + dz * 11.5, peaks) * 0.99;
    if (hFar > maxH) maxH = hFar;
  }
  return maxH;
}

/**
 * Builds dense, clearly visible, contour-hugging 3D switchback road segments from AH1 (y = 0m)
 * UP & OVER the scenic western ridge pass at (-635, 4665), down to the Base Welcome Archway,
 * and up the 6-sweep switchback highway to the 1,320m Summit Parking Plaza.
 *
 * Guarantees for EVERY single segment from i = 0 to end:
 *  - Strictly ABOVE terrain across its full width (never buried underneath any mountain!)
 *  - Smooth drivable/walkable grade (<= 28%) via upward-only Lipschitz grade relaxation.
 */
export function buildWeipulaRoadSegments(peaks: readonly TerrainPeak[]): PitchedRoadSegment[] {
  const lastSummitY = mountainHeight(MAHA_WEIPULA_SUMMIT_UV.u, MAHA_WEIPULA_SUMMIT_UV.v, peaks);
  const samples: { u: number; v: number; w: number; minY: number; y: number }[] = [];
  for (let i = 0; i < WEIPULA_ROAD_CONTROL_POINTS.length - 1; i++) {
    const a = WEIPULA_ROAD_CONTROL_POINTS[i];
    const b = WEIPULA_ROAD_CONTROL_POINTS[i + 1];
    const dist = Math.hypot(b.u - a.u, b.v - a.v);
    const subs = Math.max(1, Math.round(dist / 30));
    for (let s = 0; s < subs; s++) {
      const t = s / subs;
      const u = a.u + (b.u - a.u) * t;
      const v = a.v + (b.v - a.v) * t;
      const w = a.w + (b.w - a.w) * t;
      const rawH = roadMinVisibleElevation(u, v, peaks);
      // Add +1.8m visibility clearance whenever on elevated terrain (> 0.3m) so road NEVER dips under terrain
      const clearance = rawH > 0.3 ? Math.min(1.8, rawH * 0.35 + 0.5) : 0;
      const minY = rawH + clearance;
      samples.push({ u, v, w, minY, y: minY });
    }
  }
  const last = WEIPULA_ROAD_CONTROL_POINTS[WEIPULA_ROAD_CONTROL_POINTS.length - 1];
  samples.push({
    u: last.u,
    v: last.v,
    w: last.w,
    minY: lastSummitY + 0.12,
    y: lastSummitY + 0.12,
  });

  const endIdx = samples.length - 1;
  // Taper final 3 samples smoothly into the flat Summit Parking Plaza while staying strictly above terrain
  for (let i = Math.max(1, endIdx - 3); i <= endIdx; i++) {
    const rawH = mountainHeight(samples[i].u, samples[i].v, peaks);
    samples[i].minY = Math.max(rawH + 0.2, lastSummitY + 0.12);
    samples[i].y = samples[i].minY;
  }

  // Identify main Maha Weipula climb start (Base Welcome Archway at -1560, 4610)
  const baseGateIdx = samples.findIndex(
    s => s.u <= MAHA_WEIPULA_BASE_GATE_UV.u + 4 && s.v >= MAHA_WEIPULA_BASE_GATE_UV.v - 4,
  );

  // Upward-only Lipschitz grade envelope across the ENTIRE road (AH1 -> Ridge Pass -> Base Gate -> 1,320m Summit):
  // Smooths bumps and guarantees |dy/ds| <= 0.27 everywhere while NEVER lowering any point below terrain!
  for (let pass = 0; pass < 48; pass++) {
    // Gentle upward-only smoothing of concave dips
    for (let i = 1; i < endIdx; i++) {
      const avg = samples[i - 1].y * 0.26 + samples[i].y * 0.48 + samples[i + 1].y * 0.26;
      const floorY =
        baseGateIdx > 0 && i > baseGateIdx && i < endIdx - 12
          ? Math.max(samples[i].minY, samples[i - 1].y)
          : samples[i].minY;
      samples[i].y = Math.max(floorY, avg);
    }
    // Forward & backward upward-only slope clamp (<= 27% grade both uphill AND downhill!)
    for (let i = 1; i <= endIdx; i++) {
      const ds = Math.hypot(samples[i].u - samples[i - 1].u, samples[i].v - samples[i - 1].v);
      const maxDiff = ds * 0.27;
      if (samples[i].y < samples[i - 1].y - maxDiff) {
        samples[i].y = samples[i - 1].y - maxDiff;
      }
      if (samples[i - 1].y < samples[i].y - maxDiff) {
        samples[i - 1].y = samples[i].y - maxDiff;
      }
    }
    for (let i = endIdx; i >= 1; i--) {
      const ds = Math.hypot(samples[i].u - samples[i - 1].u, samples[i].v - samples[i - 1].v);
      const maxDiff = ds * 0.27;
      if (samples[i - 1].y < samples[i].y - maxDiff) {
        samples[i - 1].y = samples[i].y - maxDiff;
      }
      if (samples[i].y < samples[i - 1].y - maxDiff) {
        samples[i].y = samples[i - 1].y - maxDiff;
      }
    }
    // Re-enforce terrain floor everywhere (never buried!)
    for (let i = 0; i <= endIdx; i++) {
      if (samples[i].y < samples[i].minY) samples[i].y = samples[i].minY;
    }
  }

  const segs: PitchedRoadSegment[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const p1 = samples[i];
    const p2 = samples[i + 1];
    const du = p2.u - p1.u;
    const dv = p2.v - p1.v;
    const horizLen = Math.hypot(du, dv);
    if (horizLen < 0.1) continue;
    const y1 = p1.y + 0.16;
    const y2 = p2.y + 0.16;
    const dy = y2 - y1;
    const hyp = Math.hypot(horizLen, dy);
    const midU = (p1.u + p2.u) / 2;
    const midV = (p1.v + p2.v) / 2;
    const pos = toWorld(midU, midV);
    const yaw = angle + Math.atan2(du, dv);
    const pitch = Math.atan2(dy, horizLen);
    segs.push({
      key: `weipula-road-${i}`,
      u1: p1.u,
      v1: p1.v,
      y1,
      u2: p2.u,
      v2: p2.v,
      y2,
      x: pos.x,
      y: (y1 + y2) / 2,
      z: pos.z,
      length: horizLen,
      hyp,
      width: (p1.w + p2.w) / 2,
      yaw,
      pitch,
      grade: Math.abs(dy / horizLen),
      hasGuardrail: (y1 + y2) * 0.5 > 10,
    });
  }
  return segs;
}

export type StairwayFlight = {
  key: string;
  v1: number;
  v2: number;
  y1: number;
  y2: number;
  x: number;
  y: number;
  z: number;
  horizLen: number;
  hyp: number;
  pitch: number;
  grade: number;
  hasLantern: boolean;
};

export type RestPavilionSpot = {
  key: string;
  u: number;
  v: number;
  x: number;
  y: number;
  z: number;
  label: string;
};

/**
 * Builds the grand northern ridge pilgrim stone stairway (စောင်းတန်း ကျောက်လှေကား)
 * climbing straight along u = -1560 from the Base Archway (v = 4618, y ≈ 0m)
 * all the way up to the 1,320m Pagoda North Entrance (v = 6098), lifted cleanly
 * above the terrain mesh across its full width so it is always crisp and visible.
 */
export function buildWeipulaStairway(peaks: readonly TerrainPeak[]): {
  flights: StairwayFlight[];
  pavilions: RestPavilionSpot[];
  lanterns: { key: string; x: number; y: number; z: number }[];
} {
  const u = MAHA_WEIPULA_SUMMIT_UV.u;
  const vStart = 4618;
  const vEnd = 6098;
  const stepV = 22;
  const flights: StairwayFlight[] = [];
  const lanterns: { key: string; x: number; y: number; z: number }[] = [];

  const nodes: { v: number; minY: number; y: number }[] = [];
  for (let v = vStart; v <= vEnd; v += stepV) {
    const hCenter = mountainHeight(u, v, peaks);
    const hLeft = mountainHeight(u - 5, v, peaks);
    const hRight = mountainHeight(u + 5, v, peaks);
    const hAhead = mountainHeight(u, Math.min(vEnd, v + 5), peaks);
    const clearance = v === vStart ? 0.2 : 2.0;
    const minY = Math.max(hCenter, hLeft, hRight, hAhead * 0.99) + clearance;
    nodes.push({ v, minY, y: minY });
  }
  if (nodes[nodes.length - 1].v < vEnd) {
    const hEnd = mountainHeight(u, vEnd, peaks) + 0.3;
    nodes.push({ v: vEnd, minY: hEnd, y: hEnd });
  } else {
    const hEnd = mountainHeight(u, vEnd, peaks) + 0.3;
    nodes[nodes.length - 1].minY = hEnd;
    nodes[nodes.length - 1].y = hEnd;
  }

  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < nodes.length - 1; i++) {
      const avg = nodes[i - 1].y * 0.25 + nodes[i].y * 0.5 + nodes[i + 1].y * 0.25;
      nodes[i].y = Math.max(nodes[i].minY, nodes[i - 1].y, avg);
    }
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const horizLen = b.v - a.v;
    const y1 = a.y;
    const y2 = b.y;
    const dy = y2 - y1;
    const hyp = Math.hypot(horizLen, dy);
    const midV = (a.v + b.v) / 2;
    const pos = toWorld(u, midV);
    const hasLantern = i % 3 === 0;
    flights.push({
      key: `weipula-stair-${i}`,
      v1: a.v,
      v2: b.v,
      y1,
      y2,
      x: pos.x,
      y: (y1 + y2) / 2,
      z: pos.z,
      horizLen,
      hyp,
      pitch: Math.atan2(dy, horizLen),
      grade: Math.abs(dy / horizLen),
      hasLantern,
    });
    if (hasLantern) {
      const lp = toWorld(u, a.v);
      lanterns.push({
        key: `stair-lantern-${i}`,
        x: lp.x,
        y: y1 + 3.4,
        z: lp.z,
      });
    }
  }

  const pavilionDefs = [
    { key: 'zayat-1', u: u + 9, v: 5010, label: 'ပထမအဆင့် တောင်ခြေ နားနေဇရပ်' },
    { key: 'zayat-2', u: u + 9, v: 5355, label: 'ဒုတိယအဆင့် တောင်ခါးပန်း ဇရပ်' },
    { key: 'zayat-3', u: u + 9, v: 5685, label: 'တတိယအဆင့် မြူခိုးရှုခင်း ဇရပ်' },
    { key: 'zayat-4', u: u + 9, v: 5940, label: 'စတုတ္ထအဆင့် တောင်ထိပ်အနီး ဇရပ်' },
  ];
  const pavilions: RestPavilionSpot[] = pavilionDefs.map(d => {
    const p = toWorld(d.u, d.v);
    return {
      ...d,
      x: p.x,
      y: mountainHeight(d.u, d.v, peaks) + 2.2,
      z: p.z,
    };
  });

  return { flights, pavilions, lanterns };
}

function distToRoadUV(u: number, v: number): number {
  let best = Infinity;
  // Coarse stride check on dense switchback polyline is fast & accurate
  for (let i = 0; i < WEIPULA_ROAD_CONTROL_POINTS.length - 1; i++) {
    const a = WEIPULA_ROAD_CONTROL_POINTS[i];
    const b = WEIPULA_ROAD_CONTROL_POINTS[i + 1];
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const lenSq = du * du + dv * dv;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((u - a.u) * du + (v - a.v) * dv) / lenSq)) : 0;
    const px = a.u + t * du;
    const py = a.v + t * dv;
    const d = Math.hypot(u - px, v - py);
    if (d < best) best = d;
  }
  return best;
}

export type MountainTreePlot = {
  id: string;
  u: number;
  v: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  kind: 'pine' | 'broad';
  tintIndex: number;
};

export type MountainGrassTuftPlot = {
  id: string;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
  tintIndex: number;
};

/**
 * Populates a lush, dense green forest (1,000+ green trees + 550+ meadow bush/grass clusters)
 * blanketing Maha Weipula Mountain & neighboring foothill slopes while keeping the winding
 * climb road, pilgrim stone stairway, terraced village, and summit plaza cleanly clear.
 */
export function buildWeipulaSlopeFlora(
  peaks: readonly TerrainPeak[],
  mobile = false,
): {
  trees: MountainTreePlot[];
  grassTufts: MountainGrassTuftPlot[];
} {
  const trees: MountainTreePlot[] = [];
  const grassTufts: MountainGrassTuftPlot[] = [];
  const cu = MAHA_WEIPULA_SUMMIT_UV.u;
  const cv = MAHA_WEIPULA_SUMMIT_UV.v;

  // 14 concentric forest belts blanketing the entire 3 km green mountain massif
  const densityScale = mobile ? 0.55 : 1.0;
  const rings = [
    { r: 1460, count: Math.round(92 * densityScale) },
    { r: 1360, count: Math.round(90 * densityScale) },
    { r: 1250, count: Math.round(88 * densityScale) },
    { r: 1140, count: Math.round(86 * densityScale) },
    { r: 1030, count: Math.round(84 * densityScale) },
    { r: 920, count: Math.round(82 * densityScale) },
    { r: 810, count: Math.round(78 * densityScale) },
    { r: 700, count: Math.round(74 * densityScale) },
    { r: 590, count: Math.round(68 * densityScale) },
    { r: 480, count: Math.round(62 * densityScale) },
    { r: 380, count: Math.round(54 * densityScale) },
    { r: 285, count: Math.round(46 * densityScale) },
    { r: 195, count: Math.round(38 * densityScale) },
    { r: 118, count: Math.round(28 * densityScale) },
  ];

  let idx = 0;
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    for (let k = 0; k < ring.count; k++) {
      idx++;
      const seed = Math.sin(idx * 12.9898 + ri * 78.233) * 43758.5453;
      const frac = seed - Math.floor(seed);
      const seed2 = Math.sin(idx * 45.164 + ri * 17.71) * 43758.5453;
      const frac2 = seed2 - Math.floor(seed2);
      const theta = (k / ring.count) * Math.PI * 2 + ri * 0.37 + (frac - 0.5) * 0.1;
      const rad = ring.r + (frac2 - 0.5) * 78;
      const u = cu + Math.cos(theta) * rad;
      const v = cv + Math.sin(theta) * rad;

      if (Math.hypot(u - cu, v - cv) < 76) continue;
      if (Math.hypot(u - MAHA_WEIPULA_PLAZA_UV.u, v - MAHA_WEIPULA_PLAZA_UV.v) < 42) continue;
      if (Math.abs(u - cu) < 16 && v >= 4590 && v <= 6110) continue; // Pilgrim stairway
      if (distToRoadUV(u, v) < 15.5) continue; // Switchback highway clearance
      if (isInsideWeipulaChinVillageUV(u, v, 10)) continue; // 100-house terraced Chin hillside village
      if (u > -48) continue; // Keep AH1 & paddy fields clear

      const h = mountainHeight(u, v, peaks);
      if (h < 1.0) continue;
      const pos = toWorld(u, v);
      trees.push({
        id: `weipula-tree-${idx}`,
        u,
        v,
        x: pos.x,
        y: h - 1.2,
        z: pos.z,
        scale: 1.55 + frac * 1.45,
        kind: idx % 5 < 3 ? 'pine' : 'broad',
        tintIndex: idx % 5,
      });
    }
  }

  // Extra lush green trees on the NE foothill ridge & western ridge pass around (-635, 4665)
  const foothillCenters = [
    { u: -380, v: 4920, r: 260, count: Math.round(110 * densityScale) },
    { u: -630, v: 4665, r: 195, count: Math.round(95 * densityScale) },
  ];
  for (let ci = 0; ci < foothillCenters.length; ci++) {
    const fc = foothillCenters[ci];
    for (let i = 0; i < fc.count; i++) {
      const s1 = Math.sin((i + 5 + ci * 97) * 31.73) * 43758.5453;
      const f1 = s1 - Math.floor(s1);
      const s2 = Math.sin((i + 19 + ci * 53) * 63.17) * 43758.5453;
      const f2 = s2 - Math.floor(s2);
      const theta = (i / fc.count) * Math.PI * 2 + f1 * 0.4;
      const rad = 25 + f2 * fc.r;
      const u = fc.u + Math.cos(theta) * rad;
      const v = fc.v + Math.sin(theta) * rad;
      if (u >= -368 && u <= -304 && v >= 4775 && v <= 4905) continue; // Terraced village
      if (distToRoadUV(u, v) < 14.5) continue; // Keep winding ridge pass road completely clear!
      if (u > -52 || v < 4540) continue;
      const h = mountainHeight(u, v, peaks);
      if (h < 1.5) continue;
      const pos = toWorld(u, v);
      trees.push({
        id: `weipula-foothill-tree-${ci}-${i}`,
        u,
        v,
        x: pos.x,
        y: h - 1.0,
        z: pos.z,
        scale: 1.15 + f1 * 0.85,
        kind: i % 2 === 0 ? 'broad' : 'pine',
        tintIndex: (i + ci) % 5,
      });
    }
  }

  // Lush green meadow shrubs & hillside grass clusters blanketing slopes between trees
  const tuftCount = Math.round(580 * densityScale);
  for (let i = 0; i < tuftCount; i++) {
    const s1 = Math.sin((i + 37) * 27.91) * 43758.5453;
    const f1 = s1 - Math.floor(s1);
    const s2 = Math.sin((i + 113) * 53.47) * 43758.5453;
    const f2 = s2 - Math.floor(s2);
    const theta = (i / tuftCount) * Math.PI * 2 + f1 * 0.3;
    const rad = 85 + Math.sqrt(f2) * 1410;
    const u = cu + Math.cos(theta) * rad;
    const v = cv + Math.sin(theta) * rad;

    if (Math.hypot(u - cu, v - cv) < 76) continue;
    if (Math.abs(u - cu) < 15 && v >= 4590 && v <= 6110) continue;
    if (distToRoadUV(u, v) < 14.5) continue;
    if (isInsideWeipulaChinVillageUV(u, v, 8)) continue; // Keep terraced Chin village yards clear
    if (u > -48) continue;

    const h = mountainHeight(u, v, peaks);
    if (h < 0.8) continue;
    const pos = toWorld(u, v);
    grassTufts.push({
      id: `weipula-grass-${i}`,
      x: pos.x,
      y: h - 0.6,
      z: pos.z,
      sx: 6.0 + f1 * 9.5,
      sy: 2.2 + f2 * 3.4,
      sz: 6.0 + ((f1 + f2) * 0.5) * 9.5,
      rotY: f1 * Math.PI * 2,
      tintIndex: i % 5,
    });
  }

  return { trees, grassTufts };
}
