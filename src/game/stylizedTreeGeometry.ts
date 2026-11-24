import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  IcosahedronGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ============================================================================
 * Stylized Painterly Sculpted Tree Geometry & Bark Texture Builders (Indexed Low-Poly)
 * ============================================================================
 * - Strictly preserves INDEXED BufferGeometries (never calling `toNonIndexed()`),
 *   reducing GPU vertex/triangle counts by ~94% to prevent WebGL Context Lost / OOM
 *   tab crashes on mobile and desktop browsers.
 * - Matches the reference tree silhouette:
 *   - Warm golden-brown gnarled trunk with flared buttress roots & curved branches
 *   - Lush layered broad-leaf rosette clusters with sunlit lime-green highlights
 *     transitioning through vibrant emerald midtones to deep forest-teal shadows.
 */

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureIndexedAttributes(geo: BufferGeometry): BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const count = geo.getAttribute('position').count;
  if (!geo.getAttribute('uv')) {
    geo.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  return geo;
}

function mergeIndexed(parts: BufferGeometry[]): BufferGeometry {
  for (let i = 0; i < parts.length; i++) {
    ensureIndexedAttributes(parts[i]);
  }
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) {
    parts[i].dispose();
  }
  if (!merged) {
    throw new Error('Failed to merge indexed stylized tree geometry parts');
  }
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Procedural seamless warm golden-brown bark texture with vertical organic grain (64x64 lightweight).
 */
export function createStylizedBarkTexture(): DataTexture {
  const w = 64;
  const h = 64;
  const bytes = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const ridge1 = Math.sin(u * Math.PI * 14 + Math.sin(v * Math.PI * 4) * 0.9);
      const ridge2 = Math.sin(u * Math.PI * 28 - Math.cos(v * Math.PI * 6) * 0.7) * 0.5;
      const knot = Math.sin(u * Math.PI * 6 + v * Math.PI * 2) * 0.25;
      const tone = Math.max(0, Math.min(1, 0.55 + (ridge1 * 0.24 + ridge2 * 0.14 + knot * 0.1)));

      const r = Math.round(182 + tone * 73);
      const g = Math.round(168 + tone * 78);
      const b = Math.round(148 + tone * 74);
      const idx = (y * w + x) * 4;
      bytes[idx] = r;
      bytes[idx + 1] = g;
      bytes[idx + 2] = b;
      bytes[idx + 3] = 255;
    }
  }
  const tex = new DataTexture(bytes, w, h);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.generateMipmaps = true;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function paintBarkVertices(geo: BufferGeometry, halfHeight: number): BufferGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);

  const highlight = new Color('#d69748'); // Sunlit warm golden honey-ochre
  const midtone = new Color('#965b25');   // Rich sculpted golden-brown wood
  const shadow = new Color('#4d290f');    // Deep warm umber crevices & root base
  const out = new Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = norm ? norm.getX(i) : 0;
    const ny = norm ? norm.getY(i) : 0.3;
    const nz = norm ? norm.getZ(i) : 0;

    const sunDot = Math.max(0, Math.min(1, (-nx * 0.58 + ny * 0.42 + nz * 0.38) * 0.5 + 0.5));
    const heightFrac = Math.max(0, Math.min(1, (y + halfHeight) / Math.max(0.01, halfHeight * 2)));
    const furrow = Math.sin(Math.atan2(z, x) * 6 + y * 0.65) * 0.08;
    const shade = Math.max(0, Math.min(1, sunDot * 0.72 + heightFrac * 0.22 + furrow));

    if (shade < 0.48) {
      out.copy(shadow).lerp(midtone, shade / 0.48);
    } else {
      out.copy(midtone).lerp(highlight, (shade - 0.48) / 0.52);
    }
    colors[i * 3] = out.r;
    colors[i * 3 + 1] = out.g;
    colors[i * 3 + 2] = out.b;
  }

  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

export interface StylizedTrunkBranchSpec {
  readonly startYFrac: number;
  readonly angleRad: number;
  readonly reach: number;
  readonly rise: number;
  readonly radius: number;
}

/**
 * Builds an indexed low-poly gnarled sculpted tree trunk centered at y = 0 (`[-height/2, +height/2]`)
 * with 5 flared buttress roots gripping the ground and curved branching limbs (~120 vertices total).
 */
export function buildStylizedTrunkGeometry(opts: {
  height: number;
  bottomRadius: number;
  topRadius: number;
  rootSpread?: number;
  branches?: readonly StylizedTrunkBranchSpec[];
  radialSegs?: number;
  heightSegs?: number;
}): BufferGeometry {
  const {
    height,
    bottomRadius,
    topRadius,
    rootSpread = bottomRadius * 2.1,
    branches = [],
    radialSegs = 7,
    heightSegs = 4,
  } = opts;
  const halfH = height * 0.5;
  const parts: BufferGeometry[] = [];

  // 1. Sculpted fluted & gently sinuous main trunk (indexed CylinderGeometry)
  const trunk = new CylinderGeometry(topRadius, bottomRadius * 1.18, height, radialSegs, heightSegs);
  const pos = trunk.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const t = (y + halfH) / height;
    const ang = Math.atan2(z, x);

    const baseFlare = 1 + Math.pow(Math.max(0, 1 - t * 2.6), 2.0) * 0.52;
    const flute = 1 + Math.sin(ang * 5 + t * 1.5) * (0.11 * (1 - t * 0.55));
    const swayX = Math.sin(t * Math.PI * 1.1) * bottomRadius * 0.22;
    const swayZ = Math.cos(t * Math.PI * 0.85) * bottomRadius * 0.12 - bottomRadius * 0.12;

    x = x * baseFlare * flute + swayX;
    z = z * baseFlare * flute + swayZ;
    pos.setXYZ(i, x, y, z);
  }
  trunk.computeVertexNormals();
  parts.push(trunk);

  // 2. Five curved buttress root spurs gripping the ground (indexed bent cones — only 18 verts each!)
  const rootAngles = [0.22, 1.48, 2.76, 4.02, 5.26];
  for (let r = 0; r < rootAngles.length; r++) {
    const a = rootAngles[r];
    const reach = rootSpread * (0.85 + (r % 3) * 0.11);
    const rootH = height * (0.26 + (r % 2) * 0.05);
    const baseR = bottomRadius * (0.42 + (r % 2) * 0.06);
    const rootLen = Math.hypot(reach, rootH);

    const rootGeo = new CylinderGeometry(baseR * 0.22, baseR * 0.92, rootLen, 5, 2);
    const rPos = rootGeo.getAttribute('position');
    const halfLen = rootLen * 0.5;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const u = (vy + halfLen) / Math.max(0.01, rootLen); // 0 at outer tip, 1 at trunk collar
      const arch = Math.sin(u * Math.PI) * baseR * 0.35;
      rPos.setXYZ(i, vx + arch, vy, vz);
    }
    // Tilt outward from trunk collar down to ground toe
    const tilt = Math.atan2(reach, rootH);
    rootGeo.rotateZ(tilt);
    rootGeo.rotateY(-a);
    rootGeo.translate(
      Math.cos(a) * (reach * 0.48),
      -halfH + rootH * 0.42,
      Math.sin(a) * (reach * 0.48),
    );
    rootGeo.computeVertexNormals();
    parts.push(rootGeo);
  }

  // 3. Curved sculpted branching limbs (indexed bent cylinders — only 20 verts each!)
  for (const br of branches) {
    const startY = -halfH + br.startYFrac * height;
    const len = Math.hypot(br.reach, br.rise);
    const limb = new CylinderGeometry(br.radius * 0.52, br.radius, len, 5, 2);
    const bPos = limb.getAttribute('position');
    const halfLen = len * 0.5;
    for (let i = 0; i < bPos.count; i++) {
      const vx = bPos.getX(i);
      const vy = bPos.getY(i);
      const vz = bPos.getZ(i);
      const u = (vy + halfLen) / Math.max(0.01, len);
      const arch = Math.sin(u * Math.PI) * br.radius * 0.45;
      bPos.setXYZ(i, vx - arch, vy, vz);
    }
    const tilt = Math.atan2(br.reach, Math.max(0.1, br.rise));
    limb.rotateZ(-tilt);
    limb.rotateY(-br.angleRad);
    limb.translate(
      Math.cos(br.angleRad) * (br.reach * 0.5),
      startY + br.rise * 0.5,
      Math.sin(br.angleRad) * (br.reach * 0.5),
    );
    limb.computeVertexNormals();
    parts.push(limb);
  }

  const merged = mergeIndexed(parts);
  return paintBarkVertices(merged, halfH);
}

/**
 * Builds a single indexed tapered sculpted branch limb centered at origin along +Y.
 */
export function buildStylizedBranchGeometry(
  topRadius: number,
  bottomRadius: number,
  length: number,
  radialSegs = 6,
): BufferGeometry {
  const halfL = length * 0.5;
  const cyl = new CylinderGeometry(topRadius, bottomRadius, length, radialSegs, 2);
  const pos = cyl.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + halfL) / Math.max(0.01, length);
    const bend = Math.sin(t * Math.PI) * bottomRadius * 0.5;
    pos.setXYZ(i, x + bend, y, z);
  }
  cyl.computeVertexNormals();
  return paintBarkVertices(ensureIndexedAttributes(cyl), halfL);
}

function paintFoliageClusterVertices(
  geo: BufferGeometry,
  radius: number,
  centerY = 0,
): BufferGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);

  const deepForest = new Color('#0c4c2d');  // Rich dark teal-forest underside shadow
  const midEmerald = new Color('#219638');  // Lush vibrant emerald mid-canopy
  const brightLime = new Color('#84de35');  // Sunlit spring yellow-lime outer leaf tips
  const out = new Color();

  const invR = 1 / Math.max(0.01, radius);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) - centerY;
    const z = pos.getZ(i);
    const nx = norm ? norm.getX(i) : 0;
    const ny = norm ? norm.getY(i) : 1;
    const nz = norm ? norm.getZ(i) : 0;

    const sunDot = Math.max(0, Math.min(1, (-nx * 0.45 + ny * 0.72 + nz * 0.28) * 0.5 + 0.5));
    const heightFrac = Math.max(0, Math.min(1, (y * invR + 0.85) / 1.75));
    const radialOut = Math.max(0, Math.min(1, Math.hypot(x, y * 0.85, z) * invR));
    const leafRipple = Math.sin(x * 2.1 + y * 1.7 - z * 1.9) * 0.05;

    const shade = Math.max(
      0,
      Math.min(1, sunDot * 0.42 + heightFrac * 0.36 + radialOut * 0.24 - 0.06 + leafRipple),
    );

    if (shade < 0.52) {
      out.copy(deepForest).lerp(midEmerald, shade / 0.52);
    } else {
      out.copy(midEmerald).lerp(brightLime, (shade - 0.52) / 0.48);
    }

    colors[i * 3] = out.r;
    colors[i * 3 + 1] = out.g;
    colors[i * 3 + 2] = out.b;
  }

  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/**
 * Builds an indexed low-poly sculpted foliage puff made of overlapping broad-leaf rosettes
 * (~180–260 indexed vertices per puff instead of 4,500+ non-indexed vertices!).
 */
export function buildStylizedLeafClusterGeometry(opts: {
  radius: number;
  heightScale?: number;
  lobes?: number;
  seed?: number;
  lowPoly?: boolean;
}): BufferGeometry {
  const {
    radius,
    heightScale = 0.84,
    lobes = 10,
    seed = 101,
    lowPoly = false,
  } = opts;
  const rng = createRng(seed);
  const parts: BufferGeometry[] = [];
  const effectiveLobes = Math.min(lobes, lowPoly ? 7 : 11);
  const wSegs = lowPoly ? 4 : 5;
  const hSegs = lowPoly ? 3 : 4;

  // Inner shaded core
  const core = new SphereGeometry(radius * 0.68, wSegs, hSegs);
  core.scale(1.0, heightScale * 0.92, 1.0);
  parts.push(core);

  // Overlapping broad-leaf rosette pillows distributed via golden-angle spiral
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < effectiveLobes; i++) {
    const frac = (i + 0.5) / effectiveLobes;
    const yUnit = 1 - frac * 1.58;
    const ringR = Math.sqrt(Math.max(0.05, 1 - Math.min(0.95, yUnit * yUnit)));
    const theta = i * goldenAngle + (rng() - 0.5) * 0.32;

    const radialPush = radius * (0.5 + rng() * 0.22);
    const lx = Math.cos(theta) * ringR * radialPush;
    const ly = yUnit * radius * heightScale * (0.68 + rng() * 0.14);
    const lz = Math.sin(theta) * ringR * radialPush;

    const tuftR = radius * (0.38 + rng() * 0.14) * (yUnit > 0.35 ? 0.92 : 1.06);
    const lobe = new SphereGeometry(tuftR, wSegs, hSegs);
    lobe.scale(1.26, 0.74, 1.14);
    lobe.rotateZ(-Math.cos(theta) * 0.36);
    lobe.rotateX(Math.sin(theta) * 0.36);
    lobe.rotateY(theta);
    lobe.translate(lx, ly, lz);
    parts.push(lobe);
  }

  const merged = mergeIndexed(parts);
  return paintFoliageClusterVertices(merged, radius * 1.02, 0);
}

/**
 * Builds an indexed low-poly broad-leaf rosette foliage cluster (used by village/ward/farm trees)
 * with overlapping sculpted leaf-blade pillows and zero non-indexed vertex explosion.
 */
export function buildLeafBladeClusterGeometry(opts: {
  radius: number;
  heightScale?: number;
  lobes?: number;
  seed?: number;
  lowPoly?: boolean;
}): BufferGeometry {
  const {
    radius,
    heightScale = 0.84,
    lobes = 16,
    seed = 101,
    lowPoly = false,
  } = opts;
  const rng = createRng(seed);
  const parts: BufferGeometry[] = [];
  const effectiveLobes = Math.min(lobes, lowPoly ? 10 : 16);
  const wSegs = lowPoly ? 4 : 5;
  const hSegs = lowPoly ? 3 : 4;

  // Inner shaded core
  const core = new SphereGeometry(radius * 0.64, wSegs, hSegs);
  core.scale(1.0, heightScale * 0.9, 1.0);
  parts.push(core);

  // Overlapping broad-leaf blade rosettes distributed around the crown
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < effectiveLobes; i++) {
    const frac = (i + 0.5) / effectiveLobes;
    const yUnit = 1 - frac * 1.62;
    const ringR = Math.sqrt(Math.max(0.05, 1 - Math.min(0.95, yUnit * yUnit)));
    const theta = i * goldenAngle + (rng() - 0.5) * 0.28;

    const radialPush = radius * (0.52 + rng() * 0.22);
    const lx = Math.cos(theta) * ringR * radialPush;
    const ly = yUnit * radius * heightScale * (0.7 + rng() * 0.14);
    const lz = Math.sin(theta) * ringR * radialPush;

    const bladeR = radius * (0.36 + rng() * 0.14) * (yUnit > 0.35 ? 0.9 : 1.06);
    const blade = new SphereGeometry(bladeR, wSegs, hSegs);
    // Flattened ovate broad-leaf blade proportions
    blade.scale(1.34, 0.58, 1.12);
    blade.rotateZ(-Math.cos(theta) * 0.42);
    blade.rotateX(Math.sin(theta) * 0.42);
    blade.rotateY(theta);
    blade.translate(lx, ly, lz);
    parts.push(blade);
  }

  const merged = mergeIndexed(parts);
  return paintFoliageClusterVertices(merged, radius * 1.02, 0);
}

/**
 * Builds an indexed multi-tiered asymmetric stylized canopy (towering main crown +
 * lower-left tuft + center-front tuft + mid-right tuft) with minimal vertex count.
 */
export function buildStylizedTieredCanopyGeometry(opts: {
  scale: number;
  lowPoly?: boolean;
  seed?: number;
  includeTopCrown?: boolean;
  includeLowerTufts?: boolean;
  leafBlades?: boolean;
}): BufferGeometry {
  const {
    scale,
    lowPoly = false,
    seed = 777,
    includeTopCrown = true,
    includeLowerTufts = true,
    leafBlades = false,
  } = opts;
  const parts: BufferGeometry[] = [];
  const mainLobes = lowPoly ? 6 : 9;
  const tuftLobes = lowPoly ? 4 : 6;
  const clusterBuilder = leafBlades
    ? buildLeafBladeClusterGeometry
    : buildStylizedLeafClusterGeometry;

  if (includeTopCrown) {
    const main = clusterBuilder({
      radius: 2.85 * scale,
      heightScale: 0.92,
      lobes: mainLobes,
      seed: seed + 1,
      lowPoly,
    });
    main.translate(0.18 * scale, 1.65 * scale, -0.08 * scale);
    parts.push(main);

    const crest = clusterBuilder({
      radius: 1.95 * scale,
      heightScale: 0.82,
      lobes: tuftLobes,
      seed: seed + 17,
      lowPoly,
    });
    crest.translate(-1.35 * scale, 1.1 * scale, 0.55 * scale);
    parts.push(crest);
  }

  if (includeLowerTufts) {
    const leftTuft = clusterBuilder({
      radius: 1.72 * scale,
      heightScale: 0.78,
      lobes: tuftLobes,
      seed: seed + 33,
      lowPoly,
    });
    leftTuft.translate(-2.45 * scale, -1.25 * scale, 0.45 * scale);
    parts.push(leftTuft);

    const rightTuft = clusterBuilder({
      radius: 1.9 * scale,
      heightScale: 0.8,
      lobes: tuftLobes,
      seed: seed + 51,
      lowPoly,
    });
    rightTuft.translate(2.15 * scale, -0.55 * scale, 0.25 * scale);
    parts.push(rightTuft);

    const frontTuft = clusterBuilder({
      radius: 1.55 * scale,
      heightScale: 0.72,
      lobes: tuftLobes,
      seed: seed + 79,
      lowPoly,
    });
    frontTuft.translate(-0.45 * scale, -1.55 * scale, 1.35 * scale);
    parts.push(frontTuft);
  }

  return mergeIndexed(parts);
}
