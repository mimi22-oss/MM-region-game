import { angle, toWorld, ward } from '../data/ward.ts';
import {
  mountainHeight,
  mountainMeshHeight,
  mountainMeshSurface,
  terrainNoise,
  type MountainMeshSurface,
  type TerrainPeak,
} from './mountainTerrain.ts';
import {
  buildWeipulaRoadSegments,
  WEIPULA_JUNCTION_UV,
  type MountainGrassTuftPlot,
  type MountainTreePlot,
  type PitchedRoadSegment,
  type RoadControlPoint,
} from './weipulaClimb.ts';

export { WEIPULA_JUNCTION_UV } from './weipulaClimb.ts';

/**
 * ============================================================================
 * တောင်ဖီလာတောင် မှ မဟာဝေပုလ္လတောင်တော်အထိ ဆိုင်ကယ်တောင်တက်လမ်း နှင့် တောင်တန်း သဘာဝ/သာသနိက နေရာများ
 * (Taungphila -> Western Mountain Spine -> Maha Weipula Continuous Motorcycle Highway & World)
 * ============================================================================
 *
 * 1. Continuous motorcycle-rideable scenic mountain highway (`grade <= 24%`):
 *    Starts on the flat valley floor west of Myothar (`u=-412, v=-20, y=0.06m`),
 *    passes user's Taungphila landmark (`u=-509.130, v=305.616`), tours Taungphila's
 *    saddles and lakes, rides ALL THE WAY south down the 4.2 km Western Mountain Ridge
 *    Spine (`v = 470 .. 4580`), and joins seamlessly into the Maha Weipula Mountain
 *    Highway (`u=-840, v=4580` -> Base Gate -> 1,320m Maha Weipula Summit)!
 * 2. Deterministically scatters ("seeded random") across the ENTIRE mountain range
 *    from Taungphila Mountain down to Maha Weipula Mountain:
 *    - 14 Natural Mountain Lakes (`တောင်ပေါ် သဘာဝ ရေကန်များ`)
 *    - 1,900+ Forest Trees & Meadow Shrubs (`သစ်ပင် သစ်တောတန်းများ`, pooled via Fixed Object Pool)
 *    - 18 Scenic Mountain Rest Zayats (`တောင်ပေါ် နားနေဇရပ်များ`)
 *    - 12 Secluded Forest Monasteries (`တောရဘုန်းကြီးကျောင်းများ`)
 *    - 16 Mountaintop & Ridge Golden Pagodas (`တောင်ပေါ် ဘုရားစေတီများ`, summit pagodas with 8 weekday shrines)
 */

const allMountainPeaks: readonly TerrainPeak[] = [...ward.mountains, ...ward.weipula.peaks];

export interface MountainLakeSpec {
  readonly id: string;
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly rotation: number;
}

export interface MountainZayatSpec {
  readonly id: string;
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly rotation: number;
  readonly roofColor: string;
}

export interface ForestMonasterySpec {
  readonly id: string;
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly rotation: number;
  readonly scale: number;
}

export interface MountainPagodaSpec {
  readonly id: string;
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly radius: number;
  readonly yaw: number;
  readonly weekdayShrines: boolean;
}

export interface TaungphilaMountainWorld {
  readonly lakes: readonly MountainLakeSpec[];
  readonly zayats: readonly MountainZayatSpec[];
  readonly monasteries: readonly ForestMonasterySpec[];
  readonly pagodas: readonly MountainPagodaSpec[];
}

/** Deterministic PRNG (Mulberry32) for natural organic mountain feature scattering. */
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates the continuous Taungphila -> Western Chin Ridge -> Maha Weipula
 * Scenic Motorcycle Highway waypoints (`v = -20` all the way to `v = 4580`
 * joining directly into `WEIPULA_ROAD_CONTROL_POINTS` at `(-840, 4580)`!).
 */
function generateTaungphilaToWeipulaWaypoints(): RoadControlPoint[] {
  const pts: RoadControlPoint[] = [
    // 1. Flat valley approach (`y = 0m`) staying cleanly east of all foothill skirts (`u >= -438`)
    { u: -406, v: -210, w: 9.0 },
    { u: -409, v: -115, w: 8.8 },
    { u: -412, v: -20, w: 8.8 },
    { u: -420, v: 85, w: 8.6 },
    { u: -428, v: 190, w: 8.4 },
    { u: -436, v: 292, w: 8.4 },
    // 2. Smooth direct climb west into user's Taungphila spot (-509.130, 305.616)
    { u: -468, v: 300, w: 8.4 },
    { u: -504, v: 306, w: 8.4 },
    // 3. Sweeping outside peak 4 (`-520, 400`) around the southern foothill skirt into the central saddle valley
    { u: -472, v: 350, w: 8.0 },
    { u: -450, v: 416, w: 8.0 },
    { u: -482, v: 468, w: 8.2 },
    { u: -538, v: 476, w: 8.4 },
    { u: -578, v: 446, w: 7.8 },
    // 4. Scenic central Taungphila saddle valley (`u ≈ -580`) passing forest monasteries & lakes
    { u: -582, v: 392, w: 7.8 },
    { u: -580, v: 332, w: 7.8 },
    { u: -578, v: 272, w: 8.0 },
    { u: -582, v: 212, w: 7.8 },
    { u: -580, v: 152, w: 7.8 },
    { u: -576, v: 92, w: 7.8 },
    // 5. Northern broad hairpin sweeping around peak 0 & peak 5
    { u: -556, v: 26, w: 8.4 },
    { u: -598, v: 18, w: 8.4 },
    { u: -644, v: 46, w: 7.8 },
    // 6. Western high-flank scenic ride along Taungphila Ridge Overlooks
    { u: -682, v: 102, w: 7.6 },
    { u: -688, v: 168, w: 7.6 },
    { u: -686, v: 232, w: 7.6 },
    { u: -684, v: 298, w: 7.6 },
    { u: -682, v: 368, w: 7.8 },
    { u: -692, v: 445, w: 8.0 },
  ];

  // 7. Continuous 4.1 km Scenic Western Mountain Spine Highway (`v = 540 .. 4380`)
  //    Weaves smoothly along the western ridge flank (`u ≈ -692..-722`), staying clear
  //    of all eastern villages (`u <= -680`) AND all `u = -630` ridge peak centers!
  for (let v = 540; v <= 4380; v += 140) {
    const wave = Math.sin(v * 0.0045) * 16 + Math.cos(v * 0.009) * 8;
    const u = -704 + wave;
    pts.push({ u, v, w: 8.0 });
  }

  // 8. Seamless mountain junction directly into Maha Weipula Highway at user's exact point
  //    `Local U/V = (-772.322, 4552.174)` (`Scene X/Z = 2672.759, 3764.988`)!
  pts.push(
    { u: -746, v: 4445, w: 8.6 },
    { u: -764, v: 4502, w: 9.2 },
    { u: WEIPULA_JUNCTION_UV.u, v: WEIPULA_JUNCTION_UV.v, w: 10.0 },
  );

  return pts;
}

export const TAUNGPHILA_ROAD_CONTROL_POINTS: readonly RoadControlPoint[] =
  generateTaungphilaToWeipulaWaypoints();

/** True when world (x, z) lies on the Taungphila -> Western Mountain Spine -> Weipula highway deck. */
export function isOnTaungphilaRoad(x: number, z: number, margin = 0): boolean {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = x * c - z * s;
  const v = x * s + z * c;
  if (u < -810 || u > -400 || v < -225 || v > 4570) return false;
  for (let i = 1; i < TAUNGPHILA_ROAD_CONTROL_POINTS.length; i++) {
    const a = TAUNGPHILA_ROAD_CONTROL_POINTS[i - 1];
    const b = TAUNGPHILA_ROAD_CONTROL_POINTS[i];
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const t = Math.max(0, Math.min(1, ((u - a.u) * du + (v - a.v) * dv) / Math.max(0.001, du * du + dv * dv)));
    const halfWidth = (a.w + (b.w - a.w) * t) / 2 - margin;
    if (halfWidth > 0 && (u - a.u - du * t) ** 2 + (v - a.v - dv * t) ** 2 < halfWidth ** 2) {
      return true;
    }
  }
  return false;
}

function taungphilaMinVisibleElevation(u: number, v: number, peaks: readonly TerrainPeak[]): number {
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
    const hNear = mountainHeight(u + dx * 4.5, v + dz * 4.5, peaks);
    if (hNear > maxH) maxH = hNear;
    const hFar = mountainHeight(u + dx * 7.5, v + dz * 7.5, peaks) * 0.985;
    if (hFar > maxH) maxH = hFar;
  }
  return maxH;
}

/**
 * Builds dense, contour-hugging 3D motorcycle switchback road segments from
 * Taungphila Mountain ALL THE WAY to the Maha Weipula Mountain Highway with
 * exact upward-only Lipschitz grade clamping (`|dy/ds| <= 0.24`), ensuring
 * motorcycles ride smoothly everywhere and road decks never dip underground.
 */
export function buildTaungphilaRoadSegments(
  peaks: readonly TerrainPeak[] = allMountainPeaks,
): PitchedRoadSegment[] {
  const samples: { u: number; v: number; w: number; minY: number; y: number }[] = [];
  for (let i = 0; i < TAUNGPHILA_ROAD_CONTROL_POINTS.length - 1; i++) {
    const a = TAUNGPHILA_ROAD_CONTROL_POINTS[i];
    const b = TAUNGPHILA_ROAD_CONTROL_POINTS[i + 1];
    const dist = Math.hypot(b.u - a.u, b.v - a.v);
    const stepLen = 16;
    const subs = Math.max(2, Math.round(dist / stepLen));
    for (let s = 0; s < subs; s++) {
      const t = s / subs;
      const u = a.u + (b.u - a.u) * t;
      const v = a.v + (b.v - a.v) * t;
      const w = a.w + (b.w - a.w) * t;
      const rawH = taungphilaMinVisibleElevation(u, v, peaks);
      const clearance = rawH > 0.25 ? Math.min(1.35, rawH * 0.25 + 0.35) : 0.06;
      const minY = rawH + clearance;
      samples.push({ u, v, w, minY, y: minY });
    }
  }
  const last = TAUNGPHILA_ROAD_CONTROL_POINTS[TAUNGPHILA_ROAD_CONTROL_POINTS.length - 1];
  // Match exact elevation of the Maha Weipula Mountain Highway at the junction (`-772.322, 4552.174`)
  const weipulaSegs = buildWeipulaRoadSegments(peaks);
  let junctionY = taungphilaMinVisibleElevation(last.u, last.v, peaks) + 0.35;
  let bestDist = Infinity;
  for (let i = 0; i < weipulaSegs.length; i++) {
    const s = weipulaSegs[i];
    const du = s.u2 - s.u1;
    const dv = s.v2 - s.v1;
    const t = Math.max(0, Math.min(1, ((last.u - s.u1) * du + (last.v - s.v1) * dv) / Math.max(0.001, du * du + dv * dv)));
    const d = Math.hypot(last.u - (s.u1 + du * t), last.v - (s.v1 + dv * t));
    if (d < bestDist) {
      bestDist = d;
      junctionY = s.y1 + (s.y2 - s.y1) * t;
    }
  }
  samples.push({
    u: last.u,
    v: last.v,
    w: last.w,
    minY: junctionY,
    y: junctionY,
  });

  // Anchor start on flat valley floor (`y = 0.06`)
  samples[0].minY = 0.06;
  samples[0].y = 0.06;

  const endIdx = samples.length - 1;
  // Exact upward-only Lipschitz grade envelope (`|dy/ds| <= 0.24`):
  // 2 gentle smoothing passes on elevated hills followed by exact forward + backward slope clamps
  // guarantees `y >= minY`, `|dy/ds| <= 0.24` everywhere, and keeps both flat ends flush on ground!
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < endIdx; i++) {
      if (samples[i].minY <= 0.25) continue;
      const avg = samples[i - 1].y * 0.25 + samples[i].y * 0.5 + samples[i + 1].y * 0.25;
      samples[i].y = Math.max(samples[i].minY, avg);
    }
  }
  for (let i = 1; i <= endIdx; i++) {
    const ds = Math.hypot(samples[i].u - samples[i - 1].u, samples[i].v - samples[i - 1].v);
    const maxDiff = ds * 0.24;
    if (samples[i].y < samples[i - 1].y - maxDiff) samples[i].y = samples[i - 1].y - maxDiff;
  }
  for (let i = endIdx; i >= 1; i--) {
    const ds = Math.hypot(samples[i].u - samples[i - 1].u, samples[i].v - samples[i - 1].v);
    const maxDiff = ds * 0.24;
    if (samples[i - 1].y < samples[i].y - maxDiff) samples[i - 1].y = samples[i].y - maxDiff;
  }

  const segments: PitchedRoadSegment[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const p1 = toWorld(a.u, a.v);
    const p2 = toWorld(b.u, b.v);
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const dy = b.y - a.y;
    const hyp = Math.hypot(length, dy);
    const grade = Math.abs(dy) / length;
    segments.push({
      key: `taungphila-road-${i}`,
      u1: a.u,
      v1: a.v,
      y1: a.y,
      u2: b.u,
      v2: b.v,
      y2: b.y,
      x: (p1.x + p2.x) / 2,
      y: (a.y + b.y) / 2,
      z: (p1.z + p2.z) / 2,
      length,
      hyp,
      width: (a.w + b.w) / 2,
      yaw: Math.atan2(dx, dz),
      pitch: Math.atan2(dy, length),
      grade,
      hasGuardrail: (a.y + b.y) * 0.5 > 8,
    });
  }
  return segments;
}

function distToTaungphilaRoadUV(u: number, v: number): number {
  let minDist = Infinity;
  for (let i = 1; i < TAUNGPHILA_ROAD_CONTROL_POINTS.length; i++) {
    const a = TAUNGPHILA_ROAD_CONTROL_POINTS[i - 1];
    const b = TAUNGPHILA_ROAD_CONTROL_POINTS[i];
    const du = b.u - a.u;
    const dv = b.v - a.v;
    const t = Math.max(
      0,
      Math.min(1, ((u - a.u) * du + (v - a.v) * dv) / Math.max(0.001, du * du + dv * dv)),
    );
    const d = Math.hypot(u - (a.u + du * t), v - (a.v + dv * t));
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Deterministically generates ("seeded random") natural mountain lakes, zayats,
 * forest monasteries, and golden pagodas all the way from Taungphila Mountain
 * across the entire Western Chin Mountain Spine right into Maha Weipula Mountain,
 * strictly clear of all roads, villages, and the user's spawn/approach spot.
 */
export function buildTaungphilaMountainWorld(
  peaks: readonly TerrainPeak[] = allMountainPeaks,
): TaungphilaMountainWorld {
  const rng = createRng(20261122);
  const jitter = (span: number) => (rng() - 0.5) * span;

  // 1. Scenic Natural Mountain Lakes (`တောင်ပေါ် သဘာဝ ရေကန်များ`, 14 lakes from Taungphila -> Weipula)
  const lakeSeeds = [
    // Taungphila Mountain lakes
    { id: 'tp-lake-foothill', name: 'တောင်ဖီလာ တောင်ခြေရေကန်', u: -472, v: 218, rx: 13, rz: 9.5 },
    { id: 'tp-lake-saddle', name: 'တောင်ဖီလာ တောင်ကြားရေကန်', u: -604, v: 266, rx: 12, rz: 9 },
    { id: 'tp-lake-north', name: 'တောင်ဖီလာ မြောက်ဘက်ရေကန်', u: -556, v: 132, rx: 10.5, rz: 8 },
    { id: 'tp-lake-south', name: 'တောင်ဖီလာ တောင်ဘက်ရေကန်', u: -626, v: 492, rx: 13, rz: 9.5 },
    // Western Mountain Spine lakes (`v = 780 .. 4340`, strictly west of highway/villages)
    { id: 'wr-lake-1', name: 'အနောက်တောင်တန်း ရေကန် (၁)', u: -748, v: 785, rx: 14, rz: 10 },
    { id: 'wr-lake-2', name: 'အနောက်တောင်တန်း ရေကန် (၂)', u: -754, v: 1245, rx: 14, rz: 10 },
    { id: 'wr-lake-3', name: 'အနောက်တောင်တန်း ရေကန် (၃)', u: -746, v: 1740, rx: 15, rz: 10.5 },
    { id: 'wr-lake-4', name: 'အနောက်တောင်တန်း ရေကန် (၄)', u: -752, v: 2260, rx: 13.5, rz: 9.5 },
    { id: 'wr-lake-5', name: 'အနောက်တောင်တန်း ရေကန် (၅)', u: -748, v: 2790, rx: 14.5, rz: 10 },
    { id: 'wr-lake-6', name: 'အနောက်တောင်တန်း ရေကန် (၆)', u: -754, v: 3310, rx: 14, rz: 10 },
    { id: 'wr-lake-7', name: 'အနောက်တောင်တန်း ရေကန် (၇)', u: -748, v: 3840, rx: 15, rz: 10.5 },
    { id: 'wr-lake-8', name: 'အနောက်တောင်တန်း ရေကန် (၈)', u: -746, v: 4320, rx: 14, rz: 10 },
    // Maha Weipula Mountain foothill alpine lakes (clear of highway, gate & Chin villages)
    { id: 'wp-lake-east', name: 'ဝေပုလ္လ တောင်ခြေရေကန် (အရှေ့)', u: -1085, v: 4725, rx: 16, rz: 11 },
    { id: 'wp-lake-west', name: 'ဝေပုလ္လ တောင်ခြေရေကန် (အနောက်)', u: -1835, v: 4740, rx: 16, rz: 11.5 },
  ];
  const lakes: MountainLakeSpec[] = lakeSeeds.map((s) => {
    const u = s.u + jitter(6);
    const v = s.v + jitter(6);
    const w = toWorld(u, v);
    const y = mountainMeshHeight(u, v, peaks);
    return {
      id: s.id,
      name: s.name,
      u,
      v,
      x: w.x,
      z: w.z,
      y,
      radiusX: s.rx + jitter(1.8),
      radiusZ: s.rz + jitter(1.4),
      rotation: angle + jitter(0.6),
    };
  });

  // 2. Scenic Mountain Rest Pavilions / Zayats (`တောင်ပေါ် ဇရပ်များ`, 18 zayats from Taungphila -> Weipula)
  const zayatSeeds = [
    // Taungphila Mountain zayats
    { id: 'tp-zayat-trailhead', name: 'တောင်ဖီလာ အဝင်ဇရပ်', u: -462, v: 318 },
    { id: 'tp-zayat-lake', name: 'တောင်ခြေရေကန် ဇရပ်', u: -454, v: 244 },
    { id: 'tp-zayat-saddle', name: 'တောင်ကြား နားနေဇရပ်', u: -560, v: 288 },
    { id: 'tp-zayat-north', name: 'မြောက်တောင်စောင်း ဇရပ်', u: -562, v: 74 },
    { id: 'tp-zayat-west', name: 'အနောက်တောင်ခါးပန်း ဇရပ်', u: -706, v: 196 },
    { id: 'tp-zayat-south', name: 'တောင်ဘက် ရှုခင်းသာဇရပ်', u: -632, v: 432 },
    // Western Mountain Spine roadside rest zayats (`v = 640 .. 4460`, safely offset ~22m from road centerline)
    { id: 'wr-zayat-1', name: 'တောင်တန်း နားနေဇရပ် (၁)', u: -662, v: 640 },
    { id: 'wr-zayat-2', name: 'တောင်တန်း နားနေဇရပ် (၂)', u: -666, v: 1060 },
    { id: 'wr-zayat-3', name: 'တောင်တန်း နားနေဇရပ် (၃)', u: -664, v: 1520 },
    { id: 'wr-zayat-4', name: 'တောင်တန်း နားနေဇရပ် (၄)', u: -668, v: 1980 },
    { id: 'wr-zayat-5', name: 'တောင်တန်း နားနေဇရပ် (၅)', u: -664, v: 2460 },
    { id: 'wr-zayat-6', name: 'တောင်တန်း နားနေဇရပ် (၆)', u: -666, v: 2940 },
    { id: 'wr-zayat-7', name: 'တောင်တန်း နားနေဇရပ် (၇)', u: -664, v: 3420 },
    { id: 'wr-zayat-8', name: 'တောင်တန်း နားနေဇရပ် (၈)', u: -666, v: 3900 },
    { id: 'wr-zayat-9', name: 'တောင်တန်း နားနေဇရပ် (၉)', u: -668, v: 4360 },
    { id: 'wr-zayat-10', name: 'ဝေပုလ္လလမ်းဆုံ နားနေဇရပ်', u: -820, v: 4545 },
    // Maha Weipula foothill approach zayats
    { id: 'wp-zayat-east', name: 'ဝေပုလ္လ တောင်ခြေဇရပ် (အရှေ့)', u: -1155, v: 4630 },
    { id: 'wp-zayat-west', name: 'ဝေပုလ္လ တောင်ခြေဇရပ် (အနောက်)', u: -1735, v: 4660 },
  ];
  const zayatRoofs = ['#8f1f24', '#1f5e47', '#7d2f24'];
  const zayats: MountainZayatSpec[] = zayatSeeds.map((s, idx) => {
    const u = s.u + jitter(3.5);
    const v = s.v + jitter(3.5);
    const w = toWorld(u, v);
    const y = mountainMeshHeight(u, v, peaks);
    return {
      id: s.id,
      name: s.name,
      u,
      v,
      x: w.x,
      z: w.z,
      y,
      rotation: angle + jitter(0.5),
      roofColor: zayatRoofs[idx % zayatRoofs.length],
    };
  });

  // 3. Secluded Forest Monasteries (`တောရဘုန်းကြီးကျောင်းများ`, 12 monasteries from Taungphila -> Weipula)
  const monasterySeeds = [
    // Taungphila Mountain forest monasteries
    { id: 'tp-forest-monastery-1', name: 'တောင်ဖီလာ တောရဘုန်းကြီးကျောင်း (မြောက်)', u: -556, v: 186, scale: 1.0 },
    { id: 'tp-forest-monastery-2', name: 'တောင်ဖီလာ တောရဘုန်းကြီးကျောင်း (တောင်)', u: -556, v: 368, scale: 0.96 },
    { id: 'tp-forest-monastery-3', name: 'တောင်ဖီလာ တောင်ခြေ တောရကျောင်း', u: -486, v: 118, scale: 0.92 },
    // Western Mountain Spine forest monasteries (`v = 885 .. 4220`, cleanly east of highway at `u ≈ -655`, west of all villages!)
    { id: 'wr-forest-monastery-1', name: 'အနောက်တောင်တန်း တောရကျောင်း (၁)', u: -658, v: 885, scale: 0.96 },
    { id: 'wr-forest-monastery-2', name: 'အနောက်တောင်တန်း တောရကျောင်း (၂)', u: -660, v: 1450, scale: 0.95 },
    { id: 'wr-forest-monastery-3', name: 'အနောက်တောင်တန်း တောရကျောင်း (၃)', u: -658, v: 2040, scale: 0.98 },
    { id: 'wr-forest-monastery-4', name: 'အနောက်တောင်တန်း တောရကျောင်း (၄)', u: -660, v: 2620, scale: 0.95 },
    { id: 'wr-forest-monastery-5', name: 'အနောက်တောင်တန်း တောရကျောင်း (၅)', u: -658, v: 3190, scale: 0.96 },
    { id: 'wr-forest-monastery-6', name: 'အနောက်တောင်တန်း တောရကျောင်း (၆)', u: -660, v: 3740, scale: 0.98 },
    { id: 'wr-forest-monastery-7', name: 'အနောက်တောင်တန်း တောရကျောင်း (၇)', u: -658, v: 4240, scale: 0.95 },
    // Maha Weipula Mountain foothill forest monasteries
    { id: 'wp-forest-monastery-east', name: 'ဝေပုလ္လ တောင်ခြေ တောရဘုန်းကြီးကျောင်း (အရှေ့)', u: -1010, v: 4680, scale: 1.05 },
    { id: 'wp-forest-monastery-west', name: 'ဝေပုလ္လ တောင်ခြေ တောရဘုန်းကြီးကျောင်း (အနောက်)', u: -1895, v: 4695, scale: 1.05 },
  ];
  const monasteries: ForestMonasterySpec[] = monasterySeeds.map((s) => {
    const u = s.u + jitter(3.5);
    const v = s.v + jitter(3.5);
    const w = toWorld(u, v);
    const y = mountainMeshHeight(u, v, peaks);
    return {
      id: s.id,
      name: s.name,
      u,
      v,
      x: w.x,
      z: w.z,
      y,
      rotation: angle + jitter(0.35),
      scale: s.scale,
    };
  });

  // 4. Mountaintop & Ridge Golden Pagodas (`တောင်ပေါ် ဘုရားစေတီများ`, 16 pagodas from Taungphila -> Weipula)
  const pagodaSeeds = [
    // Taungphila Mountain peaks
    { id: 'tp-pagoda-summit', name: 'တောင်ဖီလာတောင်ထိပ် စေတီတော်ကြီး', u: -630, v: 340, radius: 4.8, weekdayShrines: true },
    { id: 'tp-pagoda-central', name: 'တောင်ဖီလာ အလယ်တောင်ထိပ် စေတီတော်', u: -520, v: 230, radius: 3.8, weekdayShrines: true },
    { id: 'tp-pagoda-west-mid', name: 'တောင်ဖီလာ အနောက်တောင်ထိပ် စေတီတော်', u: -630, v: 220, radius: 3.5, weekdayShrines: false },
    { id: 'tp-pagoda-north', name: 'တောင်ဖီလာ မြောက်တောင်ထိပ် စေတီတော်', u: -520, v: 60, radius: 3.2, weekdayShrines: false },
    { id: 'tp-pagoda-south', name: 'တောင်ဖီလာ တောင်ဘက်တောင်ထိပ် စေတီတော်', u: -520, v: 400, radius: 3.0, weekdayShrines: false },
    // Western Mountain Spine peaks (`u = -630, v = 710 .. 4550`)
    { id: 'wr-pagoda-1', name: 'အနောက်တောင်တန်း စေတီတော် (၁)', u: -630, v: 710, radius: 3.6, weekdayShrines: false },
    { id: 'wr-pagoda-2', name: 'အနောက်တောင်တန်း စေတီတော် (၂)', u: -630, v: 1190, radius: 3.6, weekdayShrines: false },
    { id: 'wr-pagoda-3', name: 'အနောက်တောင်တန်း စေတီတော် (၃)', u: -630, v: 1790, radius: 3.8, weekdayShrines: false },
    { id: 'wr-pagoda-4', name: 'အနောက်တောင်တန်း စေတီတော် (၄)', u: -630, v: 2270, radius: 4.4, weekdayShrines: true },
    { id: 'wr-pagoda-5', name: 'အနောက်တောင်တန်း စေတီတော် (၅)', u: -630, v: 2750, radius: 3.6, weekdayShrines: false },
    { id: 'wr-pagoda-6', name: 'အနောက်တောင်တန်း စေတီတော် (၆)', u: -630, v: 3230, radius: 3.8, weekdayShrines: false },
    { id: 'wr-pagoda-7', name: 'အနောက်တောင်တန်း စေတီတော် (၇)', u: -630, v: 3710, radius: 4.4, weekdayShrines: true },
    { id: 'wr-pagoda-8', name: 'အနောက်တောင်တန်း စေတီတော် (၈)', u: -630, v: 4190, radius: 3.8, weekdayShrines: false },
    { id: 'wr-pagoda-9', name: 'ဝေပုလ္လတောင်ကြား စေတီတော်', u: -630, v: 4550, radius: 4.0, weekdayShrines: false },
    // Flanking Maha Weipula Mountain Range peaks
    { id: 'wp-pagoda-west-shoulder', name: 'ဝေပုလ္လ အနောက်တောင်စွယ် စေတီတော်', u: -2140, v: 5260, radius: 5.0, weekdayShrines: true },
    { id: 'wp-pagoda-east-shoulder', name: 'ဝေပုလ္လ အရှေ့တောင်စွယ် စေတီတော်', u: 320, v: 4920, radius: 4.6, weekdayShrines: true },
  ];
  const pagodas: MountainPagodaSpec[] = pagodaSeeds.map((s) => {
    const w = toWorld(s.u, s.v);
    const y = mountainMeshHeight(s.u, s.v, peaks);
    return {
      id: s.id,
      name: s.name,
      u: s.u,
      v: s.v,
      x: w.x,
      z: w.z,
      y,
      radius: s.radius,
      yaw: angle,
      weekdayShrines: s.weekdayShrines,
    };
  });

  return { lakes, zayats, monasteries, pagodas };
}

export const TAUNGPHILA_MOUNTAIN_WORLD: TaungphilaMountainWorld =
  buildTaungphilaMountainWorld(allMountainPeaks);

/**
 * Generates lush random forest trees & mountain meadow grass blanketing
 * Taungphila Mountain AND the ENTIRE 4.3 km Western Mountain Spine all the way
 * to Maha Weipula Mountain (`v = -25 .. 4850`), fed directly into the shared
 * `MountainForestFixedPool` (Singleton Memory Reference Cache + Fixed Object Pool).
 */
export function buildTaungphilaSlopeFlora(
  peaks: readonly TerrainPeak[],
  mobile = false,
): { trees: MountainTreePlot[]; grassTufts: MountainGrassTuftPlot[] } {
  const rng = createRng(771122);
  const trees: MountainTreePlot[] = [];
  const grassTufts: MountainGrassTuftPlot[] = [];
  const world = TAUNGPHILA_MOUNTAIN_WORLD;

  const isClearForTree = (u: number, v: number): boolean => {
    if (distToTaungphilaRoadUV(u, v) < 9.5) return false;
    // Keep user approach spot clear
    if (Math.hypot(u - -509.13, v - 305.616) < 10) return false;
    for (const lk of world.lakes) {
      if (Math.hypot(u - lk.u, v - lk.v) < Math.max(lk.radiusX, lk.radiusZ) + 4.5) return false;
    }
    for (const z of world.zayats) {
      if (Math.hypot(u - z.u, v - z.v) < 8.5) return false;
    }
    for (const m of world.monasteries) {
      if (Math.hypot(u - m.u, v - m.v) < 15.5) return false;
    }
    for (const p of world.pagodas) {
      if (Math.hypot(u - p.u, v - p.v) < p.radius * 2.1 + 4) return false;
    }
    return true;
  };

  const surfScratch: MountainMeshSurface = { y: 0, du: 0, dv: 0, slope: 0 };

  // A. Dense forest belts over Taungphila Mountain (`u ∈ [-710, -430], v ∈ [-25, 495]`)
  const tpTreeTarget = mobile ? 380 : 680;
  let attempts = 0;
  while (trees.length < tpTreeTarget && attempts < tpTreeTarget * 12) {
    attempts++;
    const u = -710 + rng() * 280;
    const v = -25 + rng() * 520;
    const surf = mountainMeshSurface(u, v, peaks, undefined, surfScratch);
    const h = surf.y;
    if (h < 1.2 || surf.slope > 1.35) continue;
    if (terrainNoise(u / 48, v / 48) < 0.24 && rng() > 0.35) continue;
    if (!isClearForTree(u, v)) continue;
    const w = toWorld(u, v);
    const scale = 0.85 + rng() * 1.05;
    const rootEmbed = Math.max(0.38 * scale, surf.slope * 1.75 * scale);
    trees.push({
      id: `tp-tree-${trees.length}`,
      u,
      v,
      x: w.x,
      y: h - rootEmbed,
      z: w.z,
      scale,
      kind: (h > 70 ? rng() > 0.28 : rng() > 0.55) ? 'pine' : 'broad',
      tintIndex: Math.floor(rng() * 5),
    });
  }

  // B. Continuous lush forest belts along the ENTIRE Western Chin Ridge Spine (`v = 495 .. 4820`) right into Weipula!
  const ridgeTreeTarget = trees.length + (mobile ? 560 : 1220);
  attempts = 0;
  while (trees.length < ridgeTreeTarget && attempts < 16000) {
    attempts++;
    const u = -770 + rng() * 260;
    const v = 495 + rng() * 4325;
    const surf = mountainMeshSurface(u, v, peaks, undefined, surfScratch);
    const h = surf.y;
    if (h < 4.0 || surf.slope > 1.35) continue;
    if (!isClearForTree(u, v)) continue;
    const w = toWorld(u, v);
    const scale = 0.95 + rng() * 1.15;
    const rootEmbed = Math.max(0.38 * scale, surf.slope * 1.75 * scale);
    trees.push({
      id: `wr-tree-${trees.length}`,
      u,
      v,
      x: w.x,
      y: h - rootEmbed,
      z: w.z,
      scale,
      kind: rng() > 0.32 ? 'pine' : 'broad',
      tintIndex: Math.floor(rng() * 5),
    });
  }

  // C. Meadow grass & mountain shrubs from Taungphila Mountain down the Western Spine to Weipula
  const grassTarget = mobile ? 420 : 920;
  attempts = 0;
  while (grassTufts.length < grassTarget && attempts < grassTarget * 8) {
    attempts++;
    const u = -760 + rng() * 320;
    const v = -25 + rng() * 4720;
    const surf = mountainMeshSurface(u, v, peaks, undefined, surfScratch);
    const h = surf.y;
    if (h < 0.6 || surf.slope > 1.15) continue;
    if (distToTaungphilaRoadUV(u, v) < 6.5) continue;
    const w = toWorld(u, v);
    const gs = 0.7 + rng() * 0.95;
    const sx = gs * (0.9 + rng() * 0.35);
    const sy = gs * (0.55 + rng() * 0.35);
    const sz = gs * (0.9 + rng() * 0.35);
    const tuftEmbed = Math.max(0.22 * gs, Math.max(sx, sz) * surf.slope * 0.55);
    grassTufts.push({
      id: `tp-grass-${grassTufts.length}`,
      x: w.x,
      y: h - tuftEmbed,
      z: w.z,
      sx,
      sy,
      sz,
      rotY: rng() * Math.PI * 2,
      tintIndex: Math.floor(rng() * 5),
    });
  }

  return { trees, grassTufts };
}

/**
 * Collision check for Taungphila Mountain -> Western Mountain Spine -> Maha Weipula features:
 * - Deep mountain lake water blocks walking/riding when `!airborne` (shorelines stay open)
 * - Mountaintop pagoda cores & forest monastery building cores block entry while
 *   ALL switchback highway segments, Zayat decks, viewpoints, and user spot (-143.906, 576.112) stay 100% rideable!
 */
export function canStandTaungphilaFeatures(
  x: number,
  z: number,
  playerRadius = 0.4,
  airborne = false,
): boolean {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const u = x * c - z * s;
  const v = x * s + z * c;
  // Fast AABB reject outside Taungphila, Western Mountain Spine & Weipula flanking peaks
  if ((u > -410 && v < 4550) || u < -2260 || u > 420 || v < -60 || v > 5450) return true;

  const world = TAUNGPHILA_MOUNTAIN_WORLD;

  // 1. Mountain lakes (water interior blocks when not airborne)
  if (!airborne) {
    for (let i = 0; i < world.lakes.length; i++) {
      const lk = world.lakes[i];
      const dx = x - lk.x;
      const dz = z - lk.z;
      const maxR = Math.max(lk.radiusX, lk.radiusZ) + playerRadius;
      if (dx * dx + dz * dz > maxR * maxR) continue;
      const lc = Math.cos(lk.rotation);
      const ls = Math.sin(lk.rotation);
      const lx = dx * lc - dz * ls;
      const lz = dx * ls + dz * lc;
      const rx = Math.max(1, lk.radiusX - 1.0) + playerRadius;
      const rz = Math.max(1, lk.radiusZ - 1.0) + playerRadius;
      if ((lx * lx) / (rx * rx) + (lz * lz) / (rz * rz) < 1) return false;
    }
  }

  // 2. Mountain pagoda plinth cores (approaches stay wide open)
  for (let i = 0; i < world.pagodas.length; i++) {
    const p = world.pagodas[i];
    const r = p.radius * 0.92 + playerRadius;
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < r * r) return false;
  }

  // 3. Forest monastery main timber hall core (courtyard terrace stays walkable)
  for (let i = 0; i < world.monasteries.length; i++) {
    const m = world.monasteries[i];
    const dx = x - m.x;
    const dz = z - m.z;
    if (dx * dx + dz * dz > 180) continue;
    const mc = Math.cos(m.rotation);
    const ms = Math.sin(m.rotation);
    const lx = dx * mc - dz * ms;
    const lz = dx * ms + dz * mc;
    const halfW = 4.6 * m.scale + playerRadius;
    const halfD = 3.4 * m.scale + playerRadius;
    if (Math.abs(lx) < halfW && Math.abs(lz) < halfD) return false;
  }

  return true;
}
