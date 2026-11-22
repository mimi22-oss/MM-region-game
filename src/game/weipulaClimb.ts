import { angle, toWorld, ward } from '../data/ward.ts';
import { mountainHeight, terrainNoise, type TerrainPeak } from './mountainTerrain.ts';
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
export const WEIPULA_JUNCTION_UV = { u: -772.322, v: 4552.174 } as const;
export const WEIPULA_VILLAGE_V_OFFSET = 420;
const routePeaks = [...ward.mountains, ...ward.weipula.peaks];

export type RoadControlPoint = {
  u: number;
  v: number;
  w: number;
};

/**
 * The approach crosses the low western ridge. On the main face the route follows
 * successively higher contours, turning gradually between traverses.
 */
function generateSwitchbackWaypoints(): RoadControlPoint[] {
  const cu = MAHA_WEIPULA_SUMMIT_UV.u;
  const cv = MAHA_WEIPULA_SUMMIT_UV.v;
  const pts: RoadControlPoint[] = [
    // 1. Flat valley approach from AH1 (south of the 10 Nat Myaung separation paddy fields)
    { u: -6, v: 4580, w: 10.5 },
    { u: -101, v: 4580, w: 10.2 },
    { u: -192, v: 4470, w: 10.2 },
    { u: -253, v: 4382, w: 10.2 },
    { u: -348, v: 4355, w: 10.2 },
    { u: -462, v: 4407, w: 10.2 },

    // 2. Scenic Winding Mountain Pass OVER the western ridge crest at (-635, 4665)
    //    (Instead of tunneling under the ridge, the road switchbacks smoothly up the east flank,
    //     crosses right over the mountain top around (-635, 4665), and winds gently down the west flank!)
    // East flank climb — Leg A (South-West along lower east slope)
    { u: -477, v: 4520, w: 10.0 },
    { u: -470, v: 4630, w: 10.0 },
    { u: -495, v: 4730, w: 10.0 },
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
    { ...WEIPULA_JUNCTION_UV, w: 10.0 },
    // Valley floor west of the ridge pass -> Base Welcome Archway
    { u: -840, v: 4580, w: 10.2 },
    { u: -895, v: 4630, w: 10.2 },
    { u: -1020, v: 4656, w: 10.2 },
    { u: -1280, v: 4661, w: 10.2 },
    { u: -1450, v: 4640, w: 10.2 },
    // Base Welcome Archway & Stairway Trailhead (y ≈ 0m)
    { u: MAHA_WEIPULA_BASE_GATE_UV.u, v: MAHA_WEIPULA_BASE_GATE_UV.v, w: 11.0 },
  ];

  const traverses = 29;
  const divisions = 14;
  const climbStart = pts.length;
  const summitHeight = mountainHeight(cu, cv, routePeaks);
  for (let leg = 0; leg < traverses; leg++) {
    for (let i = leg === 0 ? 1 : 0; i < divisions; i++) {
      const t = i / divisions;
      const sweep = t ** 3 * (10 - 15 * t + 6 * t * t);
      const climb = leg + t + .13 * Math.sin(t * Math.PI * 2);
      // The narrow stretch below the settlement has smaller height gains and more turns.
      const progress = climb <= 5 ? climb * .18 / 5
        : climb <= 20 ? .18 + (climb - 5) * .45 / 15
          : .63 + (climb - 20) * .37 / (traverses - 20);
      const turn = Math.min(1, progress / .043, (1 - progress) / .038);
      // The existing Chin settlement occupies the northeastern mid-slope.
      const villageBand = Math.max(0, Math.min(1, (progress - .09) / .07, (.62 - progress) / .09));
      const span = .79 - .53 * villageBand * villageBand * (3 - 2 * villageBand);
      const heading = -Math.PI / 2 + (.029 + (leg % 2 ? 1 - sweep : sweep) * span) * turn;
      const du = Math.cos(heading), dv = Math.sin(heading);
      const targetHeight = summitHeight * progress;
      // Solve along the ray on the northern/eastern face, outside the neighbouring western shoulder.
      let inner = 52, outer = 1510;
      for (let pass = 0; pass < 18; pass++) {
        const radius = (inner + outer) / 2;
        if (mountainHeight(cu + du * radius, cv + dv * radius, routePeaks) >= targetHeight) inner = radius;
        else outer = radius;
      }
      const radius = (inner + outer) / 2;
      const w = progress > .98 ? 11.2 : 6.6 + 3.6 * Math.pow(Math.sin(Math.PI * t), .6);
      pts.push({ u: cu + du * radius, v: cv + dv * radius, w });
    }
  }

  // Smooth the plotted contours through short bends where the terrace sector changes profile.
  for (let pass = 0; pass < 3; pass++) {
    const plotted = pts.slice();
    for (let i = climbStart + 1; i < pts.length - 1; i++) {
      const before = plotted[i - 1], point = plotted[i], after = plotted[i + 1];
      pts[i] = {
        ...point,
        u: .64 * point.u + .18 * (before.u + after.u),
        v: .64 * point.v + .18 * (before.v + after.v),
      };
    }
  }

  // Final tie-in directly onto the Summit Parking Plaza
  pts.push({ u: MAHA_WEIPULA_PLAZA_UV.u, v: MAHA_WEIPULA_PLAZA_UV.v, w: 11.5 });
  return pts;
}

export const WEIPULA_ROAD_CONTROL_POINTS: readonly RoadControlPoint[] =
  generateSwitchbackWaypoints();

export function isOnWeipulaRoad(x: number, z: number, margin = 0) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const u = x * c - z * s, v = x * s + z * c;
  if (u < -1590 || u > 3 || v < 4340 || v > 6080) return false;
  for (let i = 1; i < WEIPULA_ROAD_CONTROL_POINTS.length; i++) {
    const a = WEIPULA_ROAD_CONTROL_POINTS[i - 1], b = WEIPULA_ROAD_CONTROL_POINTS[i];
    const du = b.u - a.u, dv = b.v - a.v;
    const t = Math.max(0, Math.min(1, ((u - a.u) * du + (v - a.v) * dv) / Math.max(.001, du * du + dv * dv)));
    const halfWidth = (a.w + (b.w - a.w) * t) / 2 - margin;
    if (halfWidth > 0 && (u - a.u - du * t) ** 2 + (v - a.v - dv * t) ** 2 < halfWidth ** 2) return true;
  }
  return false;
}

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
 * and up the contour traverses to the 1,320m Summit Parking Plaza.
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
    samples[i].minY = Math.max(rawH + 0.2, lastSummitY + 0.2);
    samples[i].y = samples[i].minY;
  }

  // Identify main Maha Weipula climb start (Base Welcome Archway at -1560, 4610)
  const baseGateIdx = samples.findIndex(
    s => Math.hypot(s.u - MAHA_WEIPULA_BASE_GATE_UV.u, s.v - MAHA_WEIPULA_BASE_GATE_UV.v) < .01,
  );

  // Upward-only Lipschitz grade envelope across the ENTIRE road (AH1 -> Ridge Pass -> Base Gate -> 1,320m Summit):
  // Smooths bumps and guarantees |dy/ds| <= 0.27 everywhere while NEVER lowering any point below terrain!
  for (let pass = 0; pass < 6; pass++) {
    // Gentle upward-only smoothing of concave dips
    for (let i = 1; i < endIdx; i++) {
      if (i === baseGateIdx) continue;
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

  const addRow = (id: string, peak: TerrainPeak, radius: number, count: number, row: number) => {
    for (let i = 0; i < count; i++) {
      // Keep the same row and tree positions on desktop and phone.
      if (mobile && i % 2 !== 0) continue;
      const t = i * Math.PI * 2 / count + row * .23;
      const wave = Math.sin(t * 3 + row * .37) * .061 + Math.sin(t * 5 - row * .41) * .031;
      const r = radius * (1 + wave);
      const u = peak.u + Math.cos(t) * r;
      const v = peak.v + Math.sin(t) * r;
      if (v < 4440 || Math.abs(u) < 29) continue;
      if (Math.hypot(u - cu, v - cv) < 76 || Math.hypot(u - MAHA_WEIPULA_PLAZA_UV.u, v - MAHA_WEIPULA_PLAZA_UV.v) < 47) continue;
      if (Math.abs(u - cu) < 19 && v >= 4590 && v <= 6110) continue;
      if (u >= -375 && u <= -297 && v >= 4760 && v <= 4920) continue;
      if (isInsideWeipulaChinVillageUV(u, v, 13) || distToRoadUV(u, v) < 20) continue;
      const h = mountainHeight(u, v, peaks);
      if (h < 1.4 || h > peak.height * .99) continue;
      const slope = Math.max(
        Math.abs(mountainHeight(u + 5, v, peaks) - mountainHeight(u - 5, v, peaks)),
        Math.abs(mountainHeight(u, v + 5, peaks) - mountainHeight(u, v - 5, peaks)),
      ) / 10;
      if (slope > 1.95) continue;

      const variation = terrainNoise(u / 37, v / 47);
      const pos = toWorld(u, v);
      trees.push({
        id: `weipula-${id}-row-${row}-${i}`,
        u, v, ...pos,
        y: h - .84,
        scale: .86 + variation * .83 + Math.min(.38, peak.radius / 3400),
        kind: h > 620 ? (i % 5 < 4 ? 'pine' : 'broad') : (i % 5 === 0 ? 'pine' : 'broad'),
        tintIndex: (i + row * 3) % 5,
      });
    }
  };

  const main = peaks.find(p => p.u === cu && p.v === cv);
  if (main) {
    const beltRadii = Array.from({ length: 27 }, (_, i) => 1460 - 51 * i);
    beltRadii.forEach((r, row) => addRow('main', main, r, Math.max(32, Math.round(r * .1)), row));
  }
  // Smaller, separate bands follow the contours of adjoining peaks and ridge shoulders.
  const shoulders = peaks.filter(p => p !== main && p.v >= 4510);
  for (const [i, peak] of shoulders.entries()) {
    if (main && Math.hypot(peak.u - main.u, peak.v - main.v) < main.radius * .67) continue;
    const belts = peak.radius > 400 ? [.82, .64, .45, .27] : [.76, .55, .33];
    belts.forEach((fraction, row) => {
      const radius = peak.radius * fraction;
      addRow(`shoulder-${i}`, peak, radius, Math.max(9, Math.round(radius * .074)), row);
    });
  }

  // Lush green meadow shrubs & hillside grass clusters blanketing slopes between trees
  const tuftCount = Math.round(580 * (mobile ? .55 : 1));
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
