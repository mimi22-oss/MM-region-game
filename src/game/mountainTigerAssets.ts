import {
  BufferGeometry, CatmullRomCurve3, Color, DataTexture, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter,
  MeshStandardMaterial, SRGBColorSpace, SphereGeometry, TubeGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TIGER_HEAD = [0, 1.02, .93] as const;
export const TIGER_TAIL = [0, .95, -.83] as const;
export const TIGER_LEGS = [
  { x: -.223, y: .89, z: .55, hind: false, phase: 0 },
  { x: .223, y: .89, z: .55, hind: false, phase: .5 },
  { x: -.226, y: .89, z: -.59, hind: true, phase: .79 },
  { x: .226, y: .89, z: -.59, hind: true, phase: .29 },
] as const;
export const TIGER_ANKLE = [0, -.82, .018] as const;

type Profile = readonly (readonly [axis: number, offset: number, halfX: number, halfOther: number])[];

function loft(rows: Profile, alongTorso: boolean, sides = 20) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const start = rows[0][0], span = rows[rows.length - 1][0] - start;
  for (const [axis, offset, width, depth] of rows) {
    for (let i = 0; i <= sides; i++) {
      const t = i / sides * Math.PI * 2;
      const x = width * Math.cos(t), cross = offset + depth * Math.sin(t);
      positions.push(x, alongTorso ? cross : axis, alongTorso ? axis : cross);
      uv.push((axis - start) / span, i / sides);
    }
  }
  for (let j = 0; j < rows.length - 1; j++) for (let i = 0; i < sides; i++) {
    const a = j * (sides + 1) + i, b = a + sides + 1;
    if (alongTorso) indices.push(a, a + 1, b, a + 1, b + 1, b);
    else indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const normals = geo.getAttribute('normal');
  for (let row = 0; row < rows.length; row++) {
    const a = row * (sides + 1), b = a + sides;
    const n = new Vector3(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize();
    normals.setXYZ(a, n.x, n.y, n.z);
    normals.setXYZ(b, n.x, n.y, n.z);
  }
  geo.userData.shared = true;
  return geo;
}

function createCoatTexture() {
  const w = 320, h = 176;
  const bytes = new Uint8Array(w * h * 4);
  const stripes = [.04, .099, .181, .267, .334, .411, .539, .620, .683, .778, .844, .936, .975];
  const downReach = [.36, .83, .64, .91, .62, .71, .92, .62, .79, .90, .64, .87, .6];
  const base = [[229, 129, 52], [187, 81, 26], [246, 227, 194]];
  for (let y = 0; y < h; y++) {
    const angle = y / (h - 1) * Math.PI * 2;
    const top = Math.sin(angle);
    const belly = Math.max(0, Math.min(1, (-top - .50) / .41));
    const light = Math.max(0, Math.min(1, (top - .33) / .67));
    const flank = (1 - top) / 2;
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      let ink = 0;
      for (let k = 0; k < stripes.length; k++) {
        const wiggle = Math.sin(angle * 2 + k * 1.71) * .012 + Math.sin(angle * 4 + k) * .007;
        const cutoff = downReach[k] + .065 * Math.cos(angle + k * 1.7);
        const taper = Math.max(0, Math.min(1, (cutoff - flank) / .22));
        const width = (.010 + (k % 5) * .0037) * taper;
        const dist = Math.abs(u - stripes[k] - wiggle);
        const core = width === 0 ? 0 : Math.max(0, Math.min(1, (width - dist) * 265));
        ink = Math.max(ink, core);
        if (k % 3 === 1 && flank > .34 && flank < cutoff) {
          const fork = Math.abs(u - stripes[k] - wiggle - (flank - .34) * .078);
          ink = Math.max(ink, Math.max(0, Math.min(1, (width * .43 - fork) * 240)));
        }
      }
      const index = (y * w + x) * 4;
      const fur = Math.sin(x * 19.93 + y * 97.71) * 2.9;
      for (let channel = 0; channel < 3; channel++) {
        const shade = base[0][channel] + (base[1][channel] - base[0][channel]) * light * .8;
        const orange = shade + (base[2][channel] - shade) * belly;
        bytes[index + channel] = (orange + fur) * (1 - ink) + [27, 20, 17][channel] * ink;
      }
      bytes[index + 3] = 255;
    }
  }
  // Match the wrapping edge to avoid a discontinuity down the right side.
  bytes.copyWithin((h - 1) * w * 4, 0, w * 4);
  const texture = new DataTexture(bytes, w, h);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function paint(geometry: BufferGeometry, color: string | ((x: number, y: number, z: number) => string)) {
  const pos = geometry.getAttribute('position'), rgb = new Color();
  const data = new Float32Array(pos.count * 3);
  const solid = typeof color === 'string';
  if (solid) rgb.set(color);
  for (let i = 0; i < pos.count; i++) {
    if (!solid) rgb.set(color(pos.getX(i), pos.getY(i), pos.getZ(i)));
    data.set([rgb.r, rgb.g, rgb.b], i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
  return geometry;
}

function oval(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  return paint(new SphereGeometry(1, 10, 8).scale(w,h,d).translate(x,y,z), color);
}

function merge(parts: BufferGeometry[]) {
  const result = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  result.userData.shared = true;
  return result;
}

function tube(points: [number, number, number][], steps: number, radius: number) {
  return new TubeGeometry(new CatmullRomCurve3(points.map(p => new Vector3(...p))), steps, radius, 6, false);
}

function head() {
  const cream = '#f7e7cf', black = '#251a15';
  const skull = new SphereGeometry(1, 38, 24).scale(.271, .234, .268);
  paint(skull, (x, y, z) => {
    const cheek = Math.abs(x);
    const crown = y + cheek * .28 + Math.sin(z * 22) * .023;
    const foreheadBar = y > .073 && ([.126, .190, .246].some(mark => Math.abs(crown - mark) < .013));
    const jawLine = cheek > .155 && z > -.15 && Math.abs(y + z * .18 + .034 + Math.sin(cheek * 19) * .015) < .019;
    if (foreheadBar || jawLine) return black;
    if (y < -.051 || (z > .135 && cheek > .102 && y < .108)) return cream;
    return y > .12 ? '#c87028' : '#e38b3c';
  });
  const parts = [
    skull,
    oval(0, -.161, .103, .165, .079, .141, '#e8d7b9'),
    oval(0, -.105, .236, .115, .026, .061, black),
    oval(0, .028, .224, .105, .098, .106, '#d48339'),
    oval(0, -.048, .309, .070, .040, .037, '#613f3a'),
    oval(0, -.069, .321, .049, .022, .026, '#422f2b'),
  ];
  for (const sign of [-1, 1]) {
    parts.push(
      oval(sign * .143, .062, .211, .071, .033, .023, black),
      oval(sign * .132, .065, .228, .044, .020, .016, '#bc9246'),
      oval(sign * .126, .066, .242, .016, .014, .008, '#181410'),
      oval(sign * .122, .073, .255, .004, .004, .002, '#ede9d7'),
      oval(sign * .202, .165, -.071, .080, .081, .049, black),
      oval(sign * .207, .168, -.041, .056, .051, .024, '#98776b'),
      oval(sign * .203, .169, -.114, .036, .031, .011, cream),
      oval(sign * .084, -.085, .245, .103, .069, .099, cream),
      oval(sign * .176, -.074, .103, .089, .064, .132, '#f0ddc0'),
    );
    for (let i = 0; i < 3; i++) {
      const y = -.049 - i * .027;
      const start: [number, number, number] = [sign * (.105 + i * .011), y, .328];
      parts.push(oval(...start, .009, .007, .008, '#69513d'));
      parts.push(paint(tube([start, [sign * .209, y + .024, .355], [sign * (.321 + i * .008), y + .016 - i * .012, .289]], 7, .0013), '#efdfc8'));
    }
  }
  return merge(parts);
}

function tail() {
  const shape = tube([[0,0,0], [.013,-.035,-.243], [.020,-.181,-.532], [.058,-.230,-.776], [.151,-.142,-1.031], [.21,-.079,-1.095]], 52, .071);
  const uv = shape.getAttribute('uv'), positions = shape.getAttribute('position');
  const colors = new Float32Array(positions.count * 3), rgb = new Color();
  for (let i = 0; i < positions.count; i++) {
    const t = uv.getX(i);
    const ring = (t + .018 * Math.sin(t * 27)) * 10;
    rgb.set(t > .935 || ring % 1 > .63 ? '#261b15' : t > .72 ? '#d7aa78' : '#d88237');
    colors.set([rgb.r, rgb.g, rgb.b], i * 3);
  }
  shape.setAttribute('color', new Float32BufferAttribute(colors, 3));
  shape.userData.shared = true;
  return shape;
}

function createTigerAssets(id: string) {
  const stripeTexture = createCoatTexture();
  return Object.freeze({
    id,
    stripeTexture,
    bodyGeo: loft([
      [-.922,.898,.014,.022], [-.83,.901,.207,.232], [-.69,.891,.280,.301],
      [-.49,.875,.273,.296], [-.27,.867,.23,.254], [-.035,.875,.235,.262],
      [.25,.900,.288,.317], [.49,.917,.306,.339], [.645,.932,.272,.306],
      [.773,.983,.217,.243], [.872,1.007,.188,.207], [.954,1.022,.076,.093],
    ], true),
    headGeo: head(),
    legGeo: loft([
      [-.843,.008,.023,.028], [-.78,.013,.069,.080], [-.64,-.017,.068,.071],
      [-.44,-.027,.080,.084], [-.24,.016,.102,.126], [.035,0,.122,.148], [.19,.008,.088,.125], [.28,.008,.014,.021],
    ], false, 14),
    hindLegGeo: loft([
      [-.843,.008,.024,.025], [-.78,.015,.067,.067], [-.61,-.075,.070,.082],
      [-.48,-.096,.082,.112], [-.33,.011,.095,.151], [-.105,.066,.147,.185], [.107,.028,.117,.171], [.24,.02,.010,.024],
    ], false, 14),
    pawGeo: merge([
      oval(0,-.02,.041,.094,.047,.119,'#e7be88'),
      ...[-.049,-.017,.019,.053].map((x, i) => oval(x,-.027,.119-(Math.abs(i-1.5)*.009),.023,.028,.046,'#ead4b1')),
    ]),
    tailGeo: tail(),
    coatMat: new MeshStandardMaterial({ map: stripeTexture, roughness: .93 }),
    detailMat: new MeshStandardMaterial({ vertexColors: true, roughness: .92 }),
  });
}

export type MountainTigerAssetCache = ReturnType<typeof createTigerAssets>;
let singletonTigerCache: MountainTigerAssetCache | null = null;
let tigerCacheCreationCount = 0;

export function getMountainTigerAssetCache() {
  return singletonTigerCache ??= createTigerAssets(`mountain-tiger-singleton-${++tigerCacheCreationCount}`);
}

export function getMountainTigerAssetCacheStats() {
  return { initialized: singletonTigerCache !== null, creationCount: tigerCacheCreationCount };
}

export function disposeMountainTigerAssetCache() {
  const c = singletonTigerCache;
  if (!c) return;
  singletonTigerCache = null;
  for (const geometry of [c.bodyGeo, c.headGeo, c.legGeo, c.hindLegGeo, c.pawGeo, c.tailGeo]) geometry.dispose();
  c.stripeTexture.dispose();
  c.coatMat.dispose();
  c.detailMat.dispose();
}
