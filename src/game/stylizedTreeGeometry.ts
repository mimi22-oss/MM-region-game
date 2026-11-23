import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ============================================================================
 * Stylized Painterly Sculpted Tree Geometry & Bark Texture Builders
 * ============================================================================
 * Matches the hand-painted stylized tree silhouette:
 * - Warm golden-brown gnarled trunk with flared buttress roots & curved branches
 * - Lush layered broad-leaf rosette clusters with sunlit lime-green highlights
 *   transitioning through vibrant emerald midtones to deep forest-teal shadows.
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

function normalizeGeometry(raw: BufferGeometry): BufferGeometry {
  const g = raw.index ? raw.toNonIndexed() : raw.clone();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  // Ensure UV exists on every merged piece so mergeGeometries never drops attributes
  if (!g.getAttribute('uv')) {
    const count = g.getAttribute('position').count;
    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

function mergeNormalized(parts: BufferGeometry[]): BufferGeometry {
  const normalized = parts.map(normalizeGeometry);
  for (const p of parts) p.dispose();
  return mergeTreeParts(normalized);
}

function mergeTreeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) {
    throw new Error('Failed to merge stylized tree geometry parts');
  }
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/**
 * Procedural seamless warm golden-brown bark texture with vertical organic grain.
 */
export function createStylizedBarkTexture(): DataTexture {
  const w = 128;
  const h = 128;
  const bytes = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const ridge1 = Math.sin(u * Math.PI * 14 + Math.sin(v * Math.PI * 4) * 0.9);
      const ridge2 = Math.sin(u * Math.PI * 28 - Math.cos(v * Math.PI * 6) * 0.7) * 0.5;
      const knot = Math.sin(u * Math.PI * 6 + v * Math.PI * 2) * 0.25;
      const grain = Math.sin(u * Math.PI * 64 + v * Math.PI * 8) * 0.12;
      const tone = Math.max(0, Math.min(1, 0.55 + (ridge1 * 0.24 + ridge2 * 0.14 + knot * 0.1 + grain)));

      // Bright warm beige-to-white multiplier so vertex colors drive the rich golden-brown hue
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

    // Sunlit from upper-left-front just like the reference artwork
    const sunDot = Math.max(0, Math.min(1, (-nx * 0.58 + ny * 0.42 + nz * 0.38) * 0.5 + 0.5));
    const heightFrac = Math.max(0, Math.min(1, (y + halfHeight) / Math.max(0.01, halfHeight * 2)));
    const furrow = Math.sin(Math.atan2(z, x) * 7 + y * 0.65) * 0.08;
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
  readonly startYFrac: number; // 0 = base, 1 = top
  readonly angleRad: number;
  readonly reach: number;
  readonly rise: number;
  readonly radius: number;
}

/**
 * Builds a gnarled sculpted tree trunk centered at y = 0 (`[-height/2, +height/2]`)
 * with 5 curved buttress roots gripping the ground and sculpted branching limbs.
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
    rootSpread = bottomRadius * 2.15,
    branches = [],
    radialSegs = 9,
    heightSegs = 6,
  } = opts;
  const halfH = height * 0.5;
  const parts: BufferGeometry[] = [];

  // 1. Sculpted organically fluted & slightly sinuous main trunk
  const trunk = new CylinderGeometry(topRadius, bottomRadius * 1.18, height, radialSegs, heightSegs);
  const pos = trunk.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const t = (y + halfH) / height; // 0 at base, 1 at top
    const ang = Math.atan2(z, x);

    // Flared root collar at bottom + subtle organic bark ribs + gentle hand-sculpted S-bend
    const baseFlare = 1 + Math.pow(Math.max(0, 1 - t * 2.8), 2.1) * 0.48;
    const flute = 1 + Math.sin(ang * 5 + t * 1.6) * (0.11 * (1 - t * 0.55));
    const swayX = Math.sin(t * Math.PI * 1.15) * bottomRadius * 0.24;
    const swayZ = Math.cos(t * Math.PI * 0.9) * bottomRadius * 0.14 - bottomRadius * 0.14;

    x = x * baseFlare * flute + swayX;
    z = z * baseFlare * flute + swayZ;
    pos.setXYZ(i, x, y, z);
  }
  trunk.computeVertexNormals();
  parts.push(trunk);

  // 2. Five curved sculpted buttress roots gripping the ground (`y = -halfH`)
  const rootCount = 5;
  const rootAngles = [0.22, 1.48, 2.76, 4.02, 5.26];
  for (let r = 0; r < rootCount; r++) {
    const a = rootAngles[r];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const reach = rootSpread * (0.86 + (r % 3) * 0.12);
    const rootH = height * (0.24 + (r % 2) * 0.05);
    const baseR = bottomRadius * (0.44 + (r % 2) * 0.06);

    const curve = new CatmullRomCurve3([
      new Vector3(ca * bottomRadius * 0.35, -halfH + rootH, sa * bottomRadius * 0.35),
      new Vector3(ca * reach * 0.55, -halfH + rootH * 0.36, sa * reach * 0.55),
      new Vector3(ca * reach * 0.92, -halfH + baseR * 0.28, sa * reach * 0.92),
      new Vector3(ca * reach * 1.06, -halfH + baseR * 0.05, sa * reach * 1.06),
    ]);
    const rootTube = new TubeGeometry(curve, 5, baseR, 6, false);
    const rPos = rootTube.getAttribute('position');
    const tip = curve.getPoint(1);
    const start = curve.getPoint(0);
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const distStart = Math.hypot(vx - start.x, vz - start.z);
      const frac = Math.max(0, Math.min(1, distStart / Math.max(0.01, reach)));
      // Taper cleanly toward rounded root toe & keep underside flush with ground
      const taper = 1 - frac * 0.72;
      const center = curve.getPoint(frac);
      const nx = center.x + (vx - center.x) * taper;
      const ny = Math.max(-halfH, center.y + (vy - center.y) * taper);
      const nz = center.z + (vz - center.z) * taper;
      rPos.setXYZ(i, nx, ny, nz);
    }
    // Rounded root toe cap so no hollow open end shows
    const toeCap = new SphereGeometry(baseR * 0.32, 5, 4);
    toeCap.translate(tip.x, Math.max(-halfH + baseR * 0.12, tip.y), tip.z);
    rootTube.computeVertexNormals();
    parts.push(rootTube, toeCap);
  }

  // 3. Curved sculpted branching limbs extending outward
  for (const br of branches) {
    const startY = -halfH + br.startYFrac * height;
    const ca = Math.cos(br.angleRad);
    const sa = Math.sin(br.angleRad);
    const curve = new CatmullRomCurve3([
      new Vector3(ca * topRadius * 0.35, startY, sa * topRadius * 0.35),
      new Vector3(ca * br.reach * 0.56, startY + br.rise * 0.42, sa * br.reach * 0.56),
      new Vector3(ca * br.reach, startY + br.rise, sa * br.reach),
    ]);
    const branchTube = new TubeGeometry(curve, 5, br.radius, 6, false);
    const bPos = branchTube.getAttribute('position');
    for (let i = 0; i < bPos.count; i++) {
      const vx = bPos.getX(i);
      const vy = bPos.getY(i);
      const vz = bPos.getZ(i);
      const frac = Math.max(0, Math.min(1, Math.hypot(vx, vz) / Math.max(0.01, br.reach)));
      const center = curve.getPoint(frac);
      const taper = 1 - frac * 0.48;
      bPos.setXYZ(
        i,
        center.x + (vx - center.x) * taper,
        center.y + (vy - center.y) * taper,
        center.z + (vz - center.z) * taper,
      );
    }
    branchTube.computeVertexNormals();
    parts.push(branchTube);
  }

  const merged = mergeNormalized(parts);
  return paintBarkVertices(merged, halfH);
}

/**
 * Builds a single tapered sculpted branch limb centered at origin along +Y (`[-length/2, +length/2]`).
 */
export function buildStylizedBranchGeometry(
  topRadius: number,
  bottomRadius: number,
  length: number,
  radialSegs = 7,
): BufferGeometry {
  const halfL = length * 0.5;
  const cyl = new CylinderGeometry(topRadius, bottomRadius, length, radialSegs, 4);
  const pos = cyl.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + halfL) / Math.max(0.01, length);
    // Gentle organic arch in the limb
    const bend = Math.sin(t * Math.PI) * bottomRadius * 0.55;
    pos.setXYZ(i, x + bend, y, z);
  }
  cyl.computeVertexNormals();
  return paintBarkVertices(normalizeGeometry(cyl), halfL);
}

function paintFoliageClusterVertices(
  geo: BufferGeometry,
  radius: number,
  centerY = 0,
): BufferGeometry {
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);

  // Exact hand-painted stylized foliage palette from the reference tree image
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

    // Upper-left directional sunlight + outer leaf tip glow + inner core occlusion
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

// The outline runs from the stem around the blade to the tip and back.
// x measures width, y runs along the blade, and z lifts the midrib.
const LEAF_VERTICES = [
  [0, 0, 0],
  [0.29, 0.15, 0.02],
  [0.43, 0.44, 0.04],
  [0.36, 0.72, 0.06],
  [0.19, 0.93, 0.09],
  [0.02, 1, 0.16],
  [-0.19, 0.93, 0.10],
  [-0.37, 0.72, 0.07],
  [-0.43, 0.44, 0.05],
  [-0.31, 0.16, 0.02],
  [0.02, 0.48, 0.17],
] as const;
const MOBILE_LEAF_VERTICES = [0, 2, 3, 4, 5, 6, 7, 8, 10].map((i) => LEAF_VERTICES[i]);

export function buildLeafBladeClusterGeometry({
  radius,
  heightScale = 0.84,
  lobes: sprays,
  seed,
  lowPoly,
}: {
  radius: number;
  heightScale?: number;
  lobes: number;
  seed: number;
  lowPoly: boolean;
}): BufferGeometry {
  const rng = createRng(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const center = new Vector3();
  const normal = new Vector3();
  const tangent = new Vector3();
  const bitangent = new Vector3();
  const along = new Vector3();
  const across = new Vector3();
  const stem = new Vector3();
  const point = new Vector3();
  const up = new Vector3(0, 1, 0);
  const shade = new Color('#12583a');
  const green = new Color('#30943e');
  const sunlit = new Color('#83c738');
  const bladeColor = new Color();
  const vertexColor = new Color();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const leavesPerSpray = lowPoly ? 4 : 5;
  const leafVertices = lowPoly ? MOBILE_LEAF_VERTICES : LEAF_VERTICES;
  const outlineCount = leafVertices.length - 1;

  for (let spray = 0; spray < sprays; spray++) {
    const height = 1 - (spray + 0.5) / sprays * 1.94;
    const ring = Math.sqrt(1 - height * height);
    const azimuth = spray * goldenAngle + (rng() - 0.5) * 0.34;
    const depth = radius * (0.55 + rng() * 0.15 + Math.cos(azimuth * 3 + height * 4) * 0.06);
    center.set(Math.cos(azimuth) * ring, height * heightScale, Math.sin(azimuth) * ring).multiplyScalar(depth);
    normal.set(center.x, center.y / (heightScale * heightScale), center.z).normalize();
    tangent.crossVectors(up, normal).normalize();
    bitangent.crossVectors(normal, tangent);
    const spin = rng() * Math.PI * 2;

    for (let leaf = 0; leaf < leavesPerSpray; leaf++) {
      const angle = spin + leaf * Math.PI * 2 / leavesPerSpray + (rng() - 0.5) * 0.3;
      along.copy(tangent).multiplyScalar(Math.cos(angle)).addScaledVector(bitangent, Math.sin(angle));
      along.addScaledVector(normal, rng() * 0.38 - 0.16).normalize();
      across.crossVectors(along, normal).normalize();
      stem.copy(center).addScaledVector(along, -radius * (0.025 + rng() * 0.075));
      stem.addScaledVector(normal, radius * (rng() - 0.5) * 0.1);
      const length = radius * (0.25 + rng() * 0.14) * (lowPoly ? 1.15 : 1);
      const width = length * (0.85 + rng() * 0.22);
      const light = 0.53 + height * 0.23 - normal.x * 0.16 + (rng() - 0.5) * 0.44;
      if (light < 0.5) {
        bladeColor.copy(shade).lerp(green, Math.max(0, light) * 2);
      } else {
        bladeColor.copy(green).lerp(sunlit, Math.min(1, (light - 0.5) * 2));
      }

      const base = positions.length / 3;
      for (const [x, y, ridge] of leafVertices) {
        point.copy(stem).addScaledVector(across, x * width)
          .addScaledVector(along, y * length)
          .addScaledVector(normal, ridge * length);
        positions.push(point.x, point.y, point.z);
        // A lighter ridge and tip keep adjacent blades legible where they overlap.
        vertexColor.copy(bladeColor).multiplyScalar(0.70 + y * 0.29 + ridge * 1.32);
        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
      }
      for (let edge = 0; edge < outlineCount; edge++) {
        indices.push(base + outlineCount, base + edge, base + (edge + 1) % outlineCount);
      }
    }
  }

  const blades = new BufferGeometry();
  blades.setAttribute('position', new Float32BufferAttribute(positions, 3));
  blades.setAttribute('color', new Float32BufferAttribute(colors, 3));
  blades.setAttribute('uv', new Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  blades.setIndex(indices);
  blades.computeVertexNormals();

  // A recessed interior carries the leaf colors through gaps between the sprays.
  const core = new SphereGeometry(radius * 0.56, lowPoly ? 8 : 10, lowPoly ? 6 : 8);
  core.scale(1, heightScale, 1);
  const corePositions = core.getAttribute('position');
  const coreColors = new Float32Array(corePositions.count * 3);
  for (let i = 0; i < corePositions.count; i++) {
    const x = corePositions.getX(i) / radius;
    const y = corePositions.getY(i) / radius;
    const z = corePositions.getZ(i) / radius;
    const mottling = Math.sin(x * 23 - y * 12) * Math.cos(z * 22 + y * 14);
    vertexColor.copy(shade).lerp(green, 0.3 + y * 0.24 + mottling * 0.19);
    vertexColor.toArray(coreColors, i * 3);
  }
  core.setAttribute('color', new Float32BufferAttribute(coreColors, 3));
  return mergeTreeParts([core, blades]);
}

/**
 * Builds a rich, sculpted stylized foliage puff made of overlapping broad-leaf lobes/rosettes
 * around a shaded inner core — never a plain geometric sphere or spike!
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
    lobes = 20,
    seed = 101,
    lowPoly = false,
  } = opts;
  const rng = createRng(seed);
  const parts: BufferGeometry[] = [];
  const wSegs = lowPoly ? 5 : 6;
  const hSegs = lowPoly ? 4 : 5;

  // Dense inner shaded leaf core so no gaps show between outer leaf tufts
  const core = new SphereGeometry(radius * 0.66, wSegs, hSegs);
  core.scale(1.0, heightScale * 0.92, 1.0);
  parts.push(core);

  // Overlapping plump broad-leaf rosette pillows distributed via golden-angle Fibonacci spiral
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < lobes; i++) {
    const frac = (i + 0.5) / lobes;
    // Concentrate lush leafy tufts across the dome, sides, and rounded lower rim
    const yUnit = 1 - frac * 1.62; // +0.95 (crown crest) down to -0.62 (underside skirt)
    const ringR = Math.sqrt(Math.max(0.04, 1 - Math.min(0.96, yUnit * yUnit)));
    const theta = i * goldenAngle + (rng() - 0.5) * 0.35;

    const radialPush = radius * (0.52 + rng() * 0.24);
    const lx = Math.cos(theta) * ringR * radialPush;
    const ly = yUnit * radius * heightScale * (0.68 + rng() * 0.16);
    const lz = Math.sin(theta) * ringR * radialPush;

    // Each sculpted leaf tuft is slightly wider/flattened like an overlapping leafy rosette
    const tuftR = radius * (0.32 + rng() * 0.14) * (yUnit > 0.35 ? 0.9 : 1.05);
    const lobe = new SphereGeometry(tuftR, wSegs, hSegs);
    lobe.scale(1.24, 0.72, 1.12);
    // Tilt leaf cluster gently outward from canopy center
    lobe.rotateZ(-Math.cos(theta) * 0.38);
    lobe.rotateX(Math.sin(theta) * 0.38);
    lobe.rotateY(theta);
    lobe.translate(lx, ly, lz);
    parts.push(lobe);
  }

  const merged = mergeNormalized(parts);
  return paintFoliageClusterVertices(merged, radius * 1.02, 0);
}

/**
 * Builds a complete multi-tiered asymmetric stylized canopy (4 lush leaf-rosette clouds:
 * towering billowing main crown + lower-left tuft + center-front tuft + mid-right tuft)
 * matching the exact iconic silhouette of the reference tree image!
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
  const mainLobes = leafBlades ? (lowPoly ? 22 : 40) : (lowPoly ? 14 : 22);
  const tuftLobes = leafBlades ? (lowPoly ? 16 : 29) : (lowPoly ? 9 : 13);
  const buildCluster = leafBlades ? buildLeafBladeClusterGeometry : buildStylizedLeafClusterGeometry;

  if (includeTopCrown) {
    // 1. Billowing asymmetric main crown dome
    const main = buildCluster({
      radius: 2.85 * scale,
      heightScale: 0.92,
      lobes: mainLobes,
      seed: seed + 1,
      lowPoly,
    });
    main.translate(0.18 * scale, 1.65 * scale, -0.08 * scale);
    parts.push(main);

    // 2. Upper-left sunlit leafy crest puff
    const crest = buildCluster({
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
    // 3. Lower-left extending branch puff (matches lower-left branch in image)
    const leftTuft = buildCluster({
      radius: 1.72 * scale,
      heightScale: 0.78,
      lobes: tuftLobes,
      seed: seed + 33,
      lowPoly,
    });
    leftTuft.translate(-2.45 * scale, -1.25 * scale, 0.45 * scale);
    parts.push(leftTuft);

    // 4. Mid-right lush branch puff
    const rightTuft = buildCluster({
      radius: 1.9 * scale,
      heightScale: 0.8,
      lobes: tuftLobes,
      seed: seed + 51,
      lowPoly,
    });
    rightTuft.translate(2.15 * scale, -0.55 * scale, 0.25 * scale);
    parts.push(rightTuft);

    // 5. Center-front low leafy pocket hugging the trunk fork
    const frontTuft = buildCluster({
      radius: 1.55 * scale,
      heightScale: 0.72,
      lobes: tuftLobes,
      seed: seed + 79,
      lowPoly,
    });
    frontTuft.translate(-0.45 * scale, -1.55 * scale, 1.35 * scale);
    parts.push(frontTuft);
  }

  return mergeTreeParts(parts);
}
