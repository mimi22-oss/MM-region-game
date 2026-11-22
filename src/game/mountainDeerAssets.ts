import {
  BufferGeometry, CapsuleGeometry, CatmullRomCurve3, Color, Float32BufferAttribute,
  LatheGeometry, MeshLambertMaterial, MeshStandardMaterial, SphereGeometry,
  TubeGeometry, Vector2, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Mountain Deer (`တောင်ပေါ် သမင်များ`)
 * ============================================================================
 * Zero geometry or material duplication: every pooled wild mountain deer AND
 * every standalone editor-placed deer shares ONE single GPU resource set.
 */

export interface MountainDeerAssetCache {
  readonly id: string;
  readonly bodyGeo: CapsuleGeometry;
  readonly neckGeo: BufferGeometry;
  readonly headGeo: SphereGeometry;
  readonly muzzleGeo: BufferGeometry;
  readonly earGeo: BufferGeometry;
  readonly legGeo: BufferGeometry;
  readonly tailGeo: BufferGeometry;
  readonly antlerMainGeo: BufferGeometry;
  readonly hindLegGeo: BufferGeometry;
  readonly eyeGeo: SphereGeometry;
  readonly coatInstancedMat: MeshLambertMaterial;
  readonly creamBellyMat: MeshStandardMaterial;
  readonly antlerMat: MeshStandardMaterial;
  readonly darkHoofEyeMat: MeshStandardMaterial;
}

let singletonDeerCache: MountainDeerAssetCache | null = null;
let deerCacheCreationCount = 0;

export const DEER_COAT_COLORS = [
  '#d9b785', // Light golden tan
  '#c9a270', // Warm fawn
  '#e2c79b', // Pale tawny brown
  '#d5b28d', // Sandy beige
] as const;

function shadeFur<T extends BufferGeometry>(geometry: T, lightAt: (y: number, z: number) => number): T {
  const points = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < points.count; i++) {
    const light = lightAt(points.getY(i), points.getZ(i));
    colors.push(light, light * .96, light * .89);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

// Rings specify height, width and fore/aft bend. The hoof is integrated into the lower rings.
function deerLeg(hind: boolean) {
  const rings = [
    [-.46, .004, .017], [-.451, .037, .02], [-.393, .036, .014], [-.372, .023, .006],
    [-.245, .023, hind ? -.039 : -.008], [-.135, .034, hind ? -.079 : .004],
    [.005, .049, hind ? -.035 : .011], [.224, .077, hind ? .051 : .012],
    [.398, .089, hind ? .062 : .023], [.45, .008, hind ? .057 : .021],
  ];
  const geo = new LatheGeometry(rings.map(([y, width]) => new Vector2(width, y)), 10);
  const p = geo.getAttribute('position');
  const palette = new Color();
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const [, , bend] = rings[i % rings.length];
    const y = p.getY(i);
    p.setZ(i, p.getZ(i) * (y < -.37 ? 1.43 : 1.17) + bend);
    palette.set(y < -.381 ? '#524239' : y < -.32 ? '#9d896f' : '#eee0c7');
    colors.push(palette.r, palette.g, palette.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function antler() {
  const parts = [
    [[0, 0, 0], [.012, .13, -.033], [.012, .32, -.073], [-.019, .48, -.022], [-.014, .61, .081]],
    [[.007, .132, -.033], [.016, .186, .055], [.02, .247, .139]],
    [[.007, .315, -.071], [.013, .396, .006], [.017, .448, .079]],
  ].map((points, i) => {
    const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
    const geometry = new TubeGeometry(curve, 12, i === 0 ? .024 : .014, 7, false);
    const positions = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let j = 0; j < positions.count; j++) {
      const t = uv.getX(j);
      const center = curve.getPointAt(t);
      const taper = Math.max(.08, (1 - t) ** .64);
      positions.setXYZ(j, center.x + (positions.getX(j) - center.x) * taper,
        center.y + (positions.getY(j) - center.y) * taper, center.z + (positions.getZ(j) - center.z) * taper);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

function deerMuzzle() {
  const jaw = new SphereGeometry(1, 14, 10).scale(.087, .153, .087).translate(0, -.02, 0);
  const nose = new SphereGeometry(1, 10, 8).scale(.065, .038, .066).translate(0, .117, .034);
  const parts = [jaw, nose];
  const color = new Color();
  for (const [i, part] of parts.entries()) {
    const p = part.getAttribute('position'), data: number[] = [];
    for (let j = 0; j < p.count; j++) {
      color.set(i === 1 ? '#58443c' : p.getZ(j) > .015 ? '#fff6de' : '#c1a389');
      data.push(color.r, color.g, color.b);
    }
    part.setAttribute('color', new Float32BufferAttribute(data, 3));
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return geometry;
}

export function getMountainDeerAssetCache(): MountainDeerAssetCache {
  if (singletonDeerCache) return singletonDeerCache;

  deerCacheCreationCount += 1;

  singletonDeerCache = Object.freeze({
    id: `mountain-deer-singleton-${deerCacheCreationCount}`,
    bodyGeo: shadeFur(new CapsuleGeometry(.32, .79, 7, 18).scale(1, 1, .88),
      (_, z) => .90 - z * .28),
    neckGeo: shadeFur(new LatheGeometry([
      new Vector2(.06, -.34), new Vector2(.182, -.27), new Vector2(.124, -.08),
      new Vector2(.08, .21), new Vector2(.055, .34),
    ], 14), (_, z) => .86 + z * .50),
    headGeo: shadeFur(new SphereGeometry(.155, 16, 12), y => .90 - y * .65),
    muzzleGeo: deerMuzzle(),
    earGeo: shadeFur(new SphereGeometry(1, 12, 10).scale(.071, .124, .035).rotateX(-.15),
      (y, z) => .71 + z * 4.1 - y * .72),
    legGeo: deerLeg(false),
    hindLegGeo: deerLeg(true),
    tailGeo: new SphereGeometry(1, 12, 8).scale(.075,.115,.048),
    antlerMainGeo: antler(),
    eyeGeo: new SphereGeometry(.027, 10, 8).scale(.8,1,1),

    coatInstancedMat: new MeshLambertMaterial({ color: '#ffffff', vertexColors: true }),
    creamBellyMat: new MeshStandardMaterial({ color: '#f3e6cf', roughness: 0.9 }),
    antlerMat: new MeshStandardMaterial({ color: '#b7a68d', roughness: 0.75 }),
    darkHoofEyeMat: new MeshStandardMaterial({ color: '#221c18', roughness: 0.35 }),
  });

  return singletonDeerCache;
}

export function getMountainDeerAssetCacheStats() {
  return {
    initialized: singletonDeerCache !== null,
    creationCount: deerCacheCreationCount,
  };
}

export function disposeMountainDeerAssetCache(): void {
  if (!singletonDeerCache) return;
  const c = singletonDeerCache;
  singletonDeerCache = null;
  c.bodyGeo.dispose();
  c.neckGeo.dispose();
  c.headGeo.dispose();
  c.muzzleGeo.dispose();
  c.earGeo.dispose();
  c.legGeo.dispose();
  c.tailGeo.dispose();
  c.antlerMainGeo.dispose();
  c.hindLegGeo.dispose();
  c.eyeGeo.dispose();
  c.coatInstancedMat.dispose();
  c.creamBellyMat.dispose();
  c.antlerMat.dispose();
  c.darkHoofEyeMat.dispose();
}
