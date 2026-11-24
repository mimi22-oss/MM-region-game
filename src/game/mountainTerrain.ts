import { BufferGeometry, Float32BufferAttribute, Color } from "three";
import { mobileQuality } from "./sceneBudget.ts";

export const MOUNTAIN_TILE_SIZE = 240;
/** Shared foreground tessellation step used by RidgeSurface AND mountain wildlife grounding. */
export const FOREGROUND_MOUNTAIN_STEP = mobileQuality ? 30 : 20;

export interface MountainMeshSurface {
  y: number;
  du: number;
  dv: number;
  slope: number;
}

export type TerrainPeak = {
  u: number;
  v: number;
  radius: number;
  height: number;
  plateau?: number;
  skirtPower?: number;
  obstacleRadius?: number;
  /** Preferred direction of the ridge in local U/V radians, along the mountain's flank. */
  ridgeAxis?: number;
  ridgeRelief?: number;
  /** Existing houses are surveyed to this sector's original ground profile. */
  protectedTerraces?: { plateau: number };
};
const smooth = (t: number) => t * t * (3 - 2 * t);
function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
export function terrainNoise(x: number, z: number) {
  const a = Math.floor(x),
    b = Math.floor(z),
    u = smooth(x - a),
    v = smooth(z - b);
  return (
    (hash(a, b) * (1 - u) + hash(a + 1, b) * u) * (1 - v) +
    (hash(a, b + 1) * (1 - u) + hash(a + 1, b + 1) * u) * v
  );
}
function smax(a: number, b: number, k = 8) {
  const d = Math.max(k - Math.abs(a - b), 0);
  return Math.max(a, b) + (d * d) / (4 * k);
}
/**
 * Natural climbable mountain terrain model:
 * Builds broad, gently flaring forested foothills that rise smoothly along radial mountain
 * ridges and gullies up to a sculpted summit crown (with optional small pagoda plateau).
 */
export function mountainHeight(
  u: number,
  v: number,
  peaks: readonly TerrainPeak[],
) {
  let totalH = 0;
  for (const p of peaks) {
    const dx = (u - p.u) / p.radius,
      dz = (v - p.v) / p.radius,
      r = Math.hypot(dx, dz);
    if (r >= 1) continue;

    // Default small rounded summit crown (0.14); callers can set plateau explicitly
    const plateauRatio = p.plateau ?? 0.14;
    if (r <= plateauRatio) {
      totalH = totalH === 0 ? p.height : smax(totalH, p.height, 10);
      continue;
    }
    const skirtPower = p.skirtPower ?? 1.25;
    const t = (r - plateauRatio) / (1 - plateauRatio);
    const topFactor = Math.pow(1 - smooth(t), skirtPower);

    // Subtle organic surface undulation scaled gently by peak height so summits stay exact
    const flankMask = Math.sin(t * Math.PI);
    const heightScale = Math.min(1.15, Math.max(0.35, p.height / 140));
    const roll1 =
      Math.sin(u / 34 + terrainNoise(u / 72, v / 72) * 1.8) *
      Math.cos(v / 30) *
      1.8;
    const roll2 = (terrainNoise(u / 20, v / 20) - 0.5) * 2.2;
    const undulation = (roll1 + roll2) * topFactor * flankMask * heightScale;

    // Natural radial mountain spurs & shallow forested valleys along the flanks
    const azimuth = Math.atan2(dz, dx);
    const spurPrimary = Math.sin(azimuth * 5 + terrainNoise(u / 95, v / 95) * 2.4);
    const spurSecondary = Math.cos(azimuth * 8 - terrainNoise(u / 52, v / 52) * 1.9);
    const axis = azimuth - (p.ridgeAxis ?? 0);
    const principalSpur = Math.cos(2 * axis + .3 * Math.sin(r * 8)) * .68 + Math.cos(3 * axis - 1.1) * .32;
    const ridgeFactor = 1 + (.067 * spurPrimary + .026 * spurSecondary + (p.ridgeRelief ?? 0) * principalSpur) * flankMask;
    let shape = (p.height * topFactor + undulation) * ridgeFactor;
    if (p.protectedTerraces) {
      const metres = r * p.radius;
      const protection = smooth(Math.max(0, Math.min(1, (metres - 675) / 62, (1090 - metres) / 46,
        (azimuth + 1.32) / .08, (-.73 - azimuth) / .10)));
      const originalPlateau = p.protectedTerraces.plateau;
      const originalT = (r - originalPlateau) / (1 - originalPlateau);
      const originalHeight = Math.pow(1 - smooth(originalT), skirtPower);
      const oldRoll = (roll1 + roll2) * originalHeight * Math.min(1, (r - originalPlateau * .5) / .18) * heightScale;
      const oldShape = (p.height * originalHeight + oldRoll) *
        (1 + (.075 * spurPrimary + .035 * spurSecondary) * Math.sin(originalT * Math.PI));
      shape += (oldShape - shape) * protection;
    }
    const peakH = Math.max(0, shape);
    totalH = totalH === 0 ? peakH : smax(totalH, peakH, 10);
  }
  return totalH;
}
/**
 * Samples the EXACT rendered triangle plane height and slope gradient `(du, dv)` of the
 * tiled `buildMountainTiles(peaks, step)` mesh at `(u, v)`.
 * Using this instead of raw analytical `mountainHeight` eliminates multi-meter floating or
 * sinking gaps between wildlife/props and the tessellated 20m/30m mountain surface.
 */
export function mountainMeshSurface(
  u: number,
  v: number,
  peaks: readonly TerrainPeak[],
  step = FOREGROUND_MOUNTAIN_STEP,
  out: MountainMeshSurface = { y: 0, du: 0, dv: 0, slope: 0 },
): MountainMeshSurface {
  const size = MOUNTAIN_TILE_SIZE;
  const n = Math.round(size / step);
  const spacing = size / n;
  const tx = Math.floor(u / size);
  const tz = Math.floor(v / size);
  const u0 = tx * size;
  const v0 = tz * size;
  const lx = (u - u0) / spacing;
  const lz = (v - v0) / spacing;
  const ix = Math.min(n - 1, Math.max(0, Math.floor(lx)));
  const iz = Math.min(n - 1, Math.max(0, Math.floor(lz)));
  const fx = Math.min(1, Math.max(0, lx - ix));
  const fz = Math.min(1, Math.max(0, lz - iz));

  const ua = u0 + ix * spacing;
  const va = v0 + iz * spacing;
  const ha = mountainHeight(ua, va, peaks);
  const hb = mountainHeight(ua + spacing, va, peaks);
  const hc = mountainHeight(ua, va + spacing, peaks);
  const hd = mountainHeight(ua + spacing, va + spacing, peaks);

  if (Math.max(ha, hb, hc, hd) < 0.01) {
    out.y = 0;
    out.du = 0;
    out.dv = 0;
    out.slope = 0;
    return out;
  }

  // Matches buildMountainTiles indices: (a, c, b) for fx + fz <= 1, (b, c, d) for fx + fz > 1
  if (fx + fz <= 1) {
    out.y = ha + fx * (hb - ha) + fz * (hc - ha);
    out.du = (hb - ha) / spacing;
    out.dv = (hc - ha) / spacing;
  } else {
    out.y = hd + (1 - fx) * (hc - hd) + (1 - fz) * (hb - hd);
    out.du = (hd - hc) / spacing;
    out.dv = (hd - hb) / spacing;
  }
  out.slope = Math.hypot(out.du, out.dv);
  return out;
}

export function mountainMeshHeight(
  u: number,
  v: number,
  peaks: readonly TerrainPeak[],
  step = FOREGROUND_MOUNTAIN_STEP,
): number {
  return mountainMeshSurface(u, v, peaks, step).y;
}

/**
 * Converts local mountain triangle gradient `(du, dv)` into animal-local Euler pitch & roll
 * for `'YXZ'` rotation so all four feet/paws stay planted on sloped ground.
 */
export function mountainSlopePitchRoll(
  du: number,
  dv: number,
  cosA: number,
  sinA: number,
  yaw: number,
  out: { pitch: number; roll: number },
  maxRad = 0.44,
): { pitch: number; roll: number } {
  const gx = du * cosA + dv * sinA;
  const gz = -du * sinA + dv * cosA;
  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const sFwd = gx * sinY + gz * cosY;
  const sRight = gx * cosY - gz * sinY;
  out.pitch = Math.max(-maxRad, Math.min(maxRad, -Math.atan(sFwd)));
  out.roll = Math.max(-maxRad, Math.min(maxRad, Math.atan(sRight)));
  return out;
}

/** Connected tiled heightfield, vertex colors and shared-edge normals; no tree meshes. */
export function buildMountainTiles(
  peaks: readonly TerrainPeak[],
  step = 10,
  haze = 0,
) {
  const size = MOUNTAIN_TILE_SIZE,
    n = Math.round(size / step),
    spacing = size / n,
    tiles = new Set<string>();
  for (const p of peaks)
    for (
      let x = Math.floor((p.u - p.radius) / size);
      x <= Math.floor((p.u + p.radius) / size);
      x++
    )
      for (
        let z = Math.floor((p.v - p.radius) / size);
        z <= Math.floor((p.v + p.radius) / size);
        z++
      )
        tiles.add(`${x},${z}`);
  const valleyGrass = new Color("#6b8a4e"),
    meadowGreen = new Color("#617f48"),
    lushForest = new Color("#304c37"),
    sunlitGrass = new Color("#8d9a57"),
    highlandGreen = new Color("#4c694d"),
    exposedRock = new Color("#837e66"),
    blue = new Color("#87a8c3");
  return [...tiles]
    .map((key) => {
      const [tx, tz] = key.split(",").map(Number),
        u0 = tx * size,
        v0 = tz * size;
      const nearby = peaks.filter(
        (p) =>
          p.u + p.radius >= u0 - 2 &&
          p.u - p.radius <= u0 + size + 2 &&
          p.v + p.radius >= v0 - 2 &&
          p.v - p.radius <= v0 + size + 2,
      );
      const positions: number[] = [],
        colors: number[] = [],
        normals: number[] = [],
        indices: number[] = [],
        heights: number[] = [];
      for (let z = 0; z <= n; z++)
        for (let x = 0; x <= n; x++) {
          const u = u0 + x * spacing,
            v = v0 + z * spacing,
            h = mountainHeight(u, v, nearby);
          heights.push(h);
          positions.push(x * spacing, h, z * spacing);
          const dx =
              (mountainHeight(u + 1, v, nearby) -
                mountainHeight(u - 1, v, nearby)) /
              2,
            dz =
              (mountainHeight(u, v + 1, nearby) -
                mountainHeight(u, v - 1, nearby)) /
              2,
            len = Math.hypot(dx, 1, dz);
          normals.push(-dx / len, 1 / len, -dz / len);
          const slope = Math.hypot(dx, dz);
          const noise =
            terrainNoise(u / 34, v / 34) * 0.6 +
            terrainNoise(u / 11, v / 11) * 0.4;
          const patchNoise = terrainNoise(u / 85, v / 85);
          const midBlend = smooth(Math.min(1, Math.max(0, (h - 25) / 260)));
          const highBlend = smooth(Math.min(1, Math.max(0, (h - 520) / 680)));
          const c = valleyGrass
            .clone()
            .lerp(meadowGreen, midBlend * 0.72)
            .lerp(lushForest, patchNoise * .64)
            .lerp(sunlitGrass, noise * .32)
            .lerp(highlandGreen, highBlend * 0.48);
          const strata = terrainNoise(u / 45 + h / 58, v / 83);
          const slopeAccent = smooth(Math.min(1, Math.max(0, (slope - .53) / 1.2))) * (.22 + strata * .62);
          c.lerp(exposedRock, slopeAccent);
          c.lerp(blue, haze);
          colors.push(c.r, c.g, c.b);
        }
      for (let z = 0; z < n; z++)
        for (let x = 0; x < n; x++) {
          const a = z * (n + 1) + x,
            b = a + 1,
            c = a + n + 1,
            d = c + 1;
          if (Math.max(heights[a], heights[b], heights[c], heights[d]) < 0.01)
            continue;
          indices.push(a, c, b, b, c, d);
        }
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      return { key, u: u0, v: v0, geometry };
    })
    .filter((tile) => {
      if (tile.geometry.index!.count) return true;
      tile.geometry.dispose();
      return false;
    });
}
