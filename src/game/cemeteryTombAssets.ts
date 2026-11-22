import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry,
  ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, MeshStandardMaterial, PlaneGeometry,
  Shape, SphereGeometry, SRGBColorSpace, Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOMB_HEIGHT, TOMB_LENGTH, TOMB_WIDTH } from './cemeteryLayout.ts';

export interface TombPalette {
  readonly body: string;
  readonly accent: string;
}

/**
 * Authentic Myanmar Cemetery Lime-Wash & Masonry Tomb Palette
 */
export const BURMESE_TOMB_PALETTES: readonly TombPalette[] = Object.freeze([
  { body: '#f8fafc', accent: '#1e293b' }, // Pure whitewashed lime + black marble plaque
  { body: '#f1f5f9', accent: '#334155' }, // Soft chalk white + charcoal slate plaque
  { body: '#fef9c3', accent: '#78350f' }, // Warm cream / ochre lime + dark bronze plaque
  { body: '#e0f2fe', accent: '#1e3a5f' }, // Pale sky-blue limewash + deep navy plaque
  { body: '#dcfce7', accent: '#14532d' }, // Celadon pastel green + deep jade plaque
  { body: '#fae8ff', accent: '#4c1d95' }, // Soft lavender white + dark slate plaque
  { body: '#ffedd5', accent: '#7c2d12' }, // Warm sandstone cream + terracotta-brown plaque
  { body: '#e2e8f0', accent: '#0f172a' }, // Weathered stone grey + black granite plaque
  { body: '#ffe4e6', accent: '#881337' }, // Pale rose plaster + deep maroon plaque
  { body: '#f5f5f4', accent: '#292524' }, // Alabaster ivory + dark basalt plaque
]);

export interface CemeteryTombAssetCache {
  readonly id: string;
  /** Single-draw-call merged geometry for realistic Burmese masonry tomb body + stepped headstone */
  readonly burmeseTombBodyGeo: BufferGeometry;
  /** Single-draw-call merged geometry for contrasting marble epitaph tablet + finial + flower offerings */
  readonly burmeseTombAccentGeo: BufferGeometry;
  readonly inscriptionGeo: PlaneGeometry;
  readonly unitBoxGeo: BoxGeometry;
  readonly unitCylGeo: CylinderGeometry;
  readonly unitCone4Geo: ConeGeometry;
  readonly unitSphereGeo: SphereGeometry;
  readonly unitPlaneGeo: PlaneGeometry;
  readonly tombBodyInstancedMat: MeshStandardMaterial;
  readonly tombAccentInstancedMat: MeshStandardMaterial;
  readonly goldMat: MeshStandardMaterial;
  readonly marblePlaqueMat: MeshStandardMaterial;
  readonly vaseMat: MeshStandardMaterial;
  readonly flowerMat: MeshStandardMaterial;
  readonly getBodyMat: (hex: string) => MeshStandardMaterial;
  readonly getEpitaphMat: (title: string, subtitle: string) => MeshStandardMaterial;
  readonly getArchSignMat: (title: string, subtitle: string) => MeshStandardMaterial;
}

let singletonTombCache: CemeteryTombAssetCache | null = null;
const cachedBodyMats = new Map<string, MeshStandardMaterial>();
const cachedEpitaphMats = new Map<string, MeshStandardMaterial>();
const cachedTextures: CanvasTexture[] = [];

export const DEFAULT_TOMB_EPITAPH = ['အမှတ်တရ', 'ကောင်းရာသုဂတိလားပါစေ'] as const;

function tint(geometry: BufferGeometry, color: string) {
  const p = geometry.getAttribute('position'), rgb = new Color(color);
  const values = new Float32Array(p.count * 3);
  for (let i = 0; i < values.length; i += 3) {
    values[i] = rgb.r;
    values[i + 1] = rgb.g;
    values[i + 2] = rgb.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
  return geometry;
}

function merge(parts: BufferGeometry[]) {
  const converted = parts.some(g => !g.index) ? parts.map(g => g.index ? g.toNonIndexed() : g) : parts;
  const result = mergeGeometries(converted)!;
  for (const g of new Set([...parts, ...converted])) g.dispose();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.shared = true;
  return result;
}

function box(x: number, y: number, z: number, w: number, h: number, d: number, shade = '#ffffff') {
  return tint(new BoxGeometry(w, h, d).translate(x, y, z), shade);
}

function pediment(width: number, lowerY: number, crown: number, depth: number, x: number, shade: string) {
  const shape = new Shape();
  shape.moveTo(-width, lowerY);
  shape.lineTo(width, lowerY);
  shape.lineTo(width, crown - .25);
  shape.bezierCurveTo(width, crown - .17, width * .29, crown - .15, 0, crown);
  shape.bezierCurveTo(-width * .29, crown - .15, -width, crown - .17, -width, crown - .25);
  shape.closePath();
  return tint(new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 })
    .rotateY(-Math.PI / 2).translate(x, 0, 0), shade);
}

function buildBurmeseTombBodyGeometry() {
  const roof = new Shape();
  roof.moveTo(-.392, .527);
  roof.bezierCurveTo(-.39, .647, -.236, .765, 0, .779);
  roof.bezierCurveTo(.236, .765, .39, .647, .392, .527);
  roof.closePath();
  return merge([
    box(0, .064, 0, TOMB_LENGTH, .128, TOMB_WIDTH, '#d8d3c8'),
    box(0, .141, 0, 2.06, .026, 1.002),
    box(0, .206, 0, 1.94, .104, .922, '#ebe7dd'),
    box(0, .266, 0, 1.89, .016, .89),
    box(.131, .393, 0, 1.52, .25, .689, '#dedad0'),
    box(.133, .301, 0, 1.58, .06, .754),
    box(.132, .501, 0, 1.61, .051, .790),
    box(.129, .531, 0, 1.55, .026, .756, '#e7e1d5'),
    ...[-1, 1].flatMap(side => [
      box(.207, .394, side * .351, 1.22, .128, .027, '#f2eee5'),
      ...[-.382, .797].map(x => box(x, .397, side * .371, .071, .155, .045)),
    ]),
    tint(new ExtrudeGeometry(roof, { depth: 1.48, bevelEnabled: false, curveSegments: 7 })
      .rotateY(Math.PI / 2).translate(-.585, 0, 0), '#f2ede4'),
    box(-.635, .301, 0, .327, .08, .89),
    pediment(.402, .317, 1.302, .23, -.548, '#eeece6'),
    pediment(.367, .361, 1.304, .019, -.777, '#c8c2b6'),
    pediment(.328, .376, 1.213, .013, -.797, '#fff9eb'),
    box(-.9, .276, 0, .244, .10, .948, '#ede8db'),
  ]);
}

function turn(profile: number[][], sides: number) {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), sides);
}

function buildBurmeseTombAccentGeometry() {
  const vase = [[0,.327],[.044,.327],[.048,.349],[.065,.379],[.073,.416],[.066,.459],[.042,.481],[.049,.495],[.035,.498],[.028,.456],[0,.454]];
  const bud = [[0,1.292],[.080,1.292],[.080,1.312],[.057,1.334],[.074,1.376],[.073,1.41],[.056,1.454],[.035,1.491],[0,TOMB_HEIGHT]];
  const petals = Array.from({ length: 6 }, (_, i) => tint(new SphereGeometry(1, 4, 3)
    .scale(.022,.055,.015).rotateX(-.24).translate(0, 1.379, .060)
    .rotateY(i * Math.PI / 3).translate(-.67, 0, 0), '#e1c08b'));
  const offerings = [-.357, .357].flatMap((z, i) => [
    tint(turn(vase, 7).translate(-.925, 0, z), i === 0 ? '#7d7358' : '#995c45'),
    tint(new CylinderGeometry(.018, .014, .137, 4).translate(-.925, .544, z), '#536742'),
    ...[-.026, .022].map((offset, n) => tint(new SphereGeometry(1, 5, 3)
      .scale(.033, .030, .032).translate(-.925, .594 + n * .043, z + offset), n ? '#f5d468' : '#f0dcba')),
  ]);
  return merge([
    box(-.815, .698, 0, .033, .420, .575, '#181618'),
    tint(turn(bud, 8).translate(-.67, 0, 0), '#c89b59'),
    ...petals,
    ...offerings,
  ]);
}

function createTextPlaqueMaterial(
  title: string,
  subtitle: string,
  bgHex: string,
  borderHex: string,
  textHex: string,
  isEpitaph = false,
): MeshStandardMaterial {
  let map: CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = isEpitaph ? 320 : 512;
    canvas.height = isEpitaph ? 220 : 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const draw = () => {
        ctx.fillStyle = bgHex;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (isEpitaph) {
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#373338';
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(0, 31 + i * 31);
            ctx.bezierCurveTo(115, i * 39, 198, 92 + i * 29, 320, 53 + i * 34);
            ctx.stroke();
          }
        }
        ctx.strokeStyle = borderHex;
        ctx.lineWidth = 6;
        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textHex;
        ctx.font = '700 32px "Myanmar Text", "Padauk", "Noto Sans Myanmar", sans-serif';
        ctx.fillText(title, canvas.width / 2, canvas.height * .37, canvas.width - 36);
        ctx.fillStyle = '#fef3c7';
        ctx.font = '600 22px "Myanmar Text", "Padauk", "Noto Sans Myanmar", sans-serif';
        ctx.fillText(subtitle, canvas.width / 2, canvas.height * .68, canvas.width - 36);
      };
      draw();

      const texture = new CanvasTexture(canvas);
      map = texture;
      map.colorSpace = SRGBColorSpace;
      map.userData.shared = true;
      cachedTextures.push(map);
      if (document.fonts) {
        void Promise.all([
          document.fonts.load('700 32px "Noto Sans Myanmar"', title),
          document.fonts.load('600 22px "Noto Sans Myanmar"', subtitle),
        ]).then(() => { draw(); texture.needsUpdate = true; }).catch(() => {});
      }
    }
  }
  const mat = new MeshStandardMaterial({
    color: map ? '#ffffff' : bgHex,
    ...(map ? { map } : {}),
    roughness: 0.45,
    metalness: 0.15,
  });
  mat.userData.shared = true;
  return mat;
}

export function getCemeteryTombAssetCache(): CemeteryTombAssetCache {
  if (singletonTombCache) return singletonTombCache;

  const markGeo = <T extends BufferGeometry>(g: T): T => {
    g.userData.shared = true;
    return g;
  };
  const markMat = <T extends MeshStandardMaterial>(m: T): T => {
    m.userData.shared = true;
    return m;
  };

  const created: CemeteryTombAssetCache = Object.freeze({
    id: 'cemetery-tomb-singleton-cache',
    burmeseTombBodyGeo: buildBurmeseTombBodyGeometry(),
    burmeseTombAccentGeo: buildBurmeseTombAccentGeometry(),
    inscriptionGeo: markGeo(new PlaneGeometry(.540, .386).rotateY(-Math.PI / 2).translate(-.833, .698, 0)),
    unitBoxGeo: markGeo(new BoxGeometry(1, 1, 1)),
    unitCylGeo: markGeo(new CylinderGeometry(0.5, 0.5, 1, 10)),
    unitCone4Geo: markGeo(new ConeGeometry(0.5, 1, 4)),
    unitSphereGeo: markGeo(new SphereGeometry(0.5, 10, 8)),
    unitPlaneGeo: markGeo(new PlaneGeometry(1, 1)),
    tombBodyInstancedMat: markMat(new MeshStandardMaterial({ roughness: .86, vertexColors: true })),
    tombAccentInstancedMat: markMat(new MeshStandardMaterial({ roughness: .59, vertexColors: true })),
    goldMat: markMat(new MeshStandardMaterial({ color: '#eab308', metalness: 0.55, roughness: 0.28 })),
    marblePlaqueMat: markMat(new MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.18 })),
    vaseMat: markMat(new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.55 })),
    flowerMat: markMat(new MeshStandardMaterial({ color: '#facc15', roughness: 0.6 })),

    getBodyMat: (hex: string) => {
      let m = cachedBodyMats.get(hex);
      if (!m) {
        m = markMat(new MeshStandardMaterial({ color: hex, roughness: .86, vertexColors: true }));
        cachedBodyMats.set(hex, m);
      }
      return m;
    },

    getEpitaphMat: (title: string, subtitle: string) => {
      const key = `epitaph|${title}|${subtitle}`;
      let m = cachedEpitaphMats.get(key);
      if (!m) {
        m = createTextPlaqueMaterial(title, subtitle, '#141315', '#897968', '#eee0c4', true);
        cachedEpitaphMats.set(key, m);
      }
      return m;
    },

    getArchSignMat: (title: string, subtitle: string) => {
      const key = `arch|${title}|${subtitle}`;
      let m = cachedEpitaphMats.get(key);
      if (!m) {
        m = createTextPlaqueMaterial(title, subtitle, '#7f1d1d', '#f59e0b', '#fde047');
        cachedEpitaphMats.set(key, m);
      }
      return m;
    },
  });

  singletonTombCache = created;
  return created;
}

export function disposeCemeteryTombAssetCache(): void {
  if (!singletonTombCache) return;
  const c = singletonTombCache;
  singletonTombCache = null;

  c.burmeseTombBodyGeo.dispose();
  c.burmeseTombAccentGeo.dispose();
  c.inscriptionGeo.dispose();
  c.unitBoxGeo.dispose();
  c.unitCylGeo.dispose();
  c.unitCone4Geo.dispose();
  c.unitSphereGeo.dispose();
  c.unitPlaneGeo.dispose();
  c.tombBodyInstancedMat.dispose();
  c.tombAccentInstancedMat.dispose();
  c.goldMat.dispose();
  c.marblePlaqueMat.dispose();
  c.vaseMat.dispose();
  c.flowerMat.dispose();

  for (const m of cachedBodyMats.values()) m.dispose();
  cachedBodyMats.clear();
  for (const m of cachedEpitaphMats.values()) m.dispose();
  cachedEpitaphMats.clear();
  for (const t of cachedTextures) t.dispose();
  cachedTextures.length = 0;
}

