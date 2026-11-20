/**
 * Singleton flyweight GPU geometry, texture, and material cache shared by memory
 * reference across U Shwe House AND every pooled residential house bot in the world.
 *
 * Zero per-house BufferGeometry, CanvasTexture, or MeshStandardMaterial allocation!
 */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { garmentGeometry } from './characterClothing.ts';

type Point3 = [number, number, number];

/** Builds a smooth elliptical loft (matching ProceduralHuman's tailored clothing technique). */
function loft(rows: Point3[], segments = 20): BufferGeometry {
  const profile = new CatmullRomCurve3(rows.map((r) => new Vector3(...r)));
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const steps = Math.max(16, rows.length * 4);
  const ascending = rows[rows.length - 1][1] > rows[0][1];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = profile.getPoint(t);
    for (let j = 0; j <= segments; j++) {
      const phi = (j / segments) * Math.PI * 2;
      vertices.push(
        Math.cos(phi) * Math.max(0.001, p.x),
        p.y,
        Math.sin(phi) * Math.max(0.001, p.z),
      );
      uvs.push(j / segments, t);
      if (i < steps && j < segments) {
        const k = i * (segments + 1) + j;
        if (ascending) {
          indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
        } else {
          indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Adds cylindrical UVs to garmentGeometry('longyi') so woven Paso/Htamein textures map cleanly. */
function buildTexturedLongyiShell(): BufferGeometry {
  const g = garmentGeometry('longyi');
  const pos = g.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanY = Math.max(0.001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    uvs[i * 2] = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
    uvs[i * 2 + 1] = (y - minY) / spanY;
  }
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return g;
}

function createPasoTexture(base: string, band: string, dark: string, thread: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = band;
    ctx.fillRect(0, y, 128, 6);
    ctx.fillStyle = dark;
    ctx.fillRect(0, y + 9, 128, 2);
    ctx.fillStyle = thread;
    ctx.fillRect(0, y + 7, 128, 1);
  }
  for (let x = 0; x < 128; x += 16) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = band;
    ctx.fillRect(x, 0, 5, 128);
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = thread;
    ctx.fillRect(x + 7, 0, 1, 128);
    ctx.globalAlpha = 1;
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createHtameinTexture(base: string, sheen: string, border: string, wave: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = sheen;
    ctx.fillRect(0, y, 128, 2);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = border;
  ctx.fillRect(0, 100, 128, 14);
  ctx.fillStyle = base;
  ctx.fillRect(0, 103, 128, 8);
  ctx.strokeStyle = wave;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= 128; x += 4) {
    const wy = 107 + Math.sin((x / 128) * Math.PI * 12) * 2.6;
    if (x === 0) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

export interface OutfitMaterials {
  readonly outerGarment: MeshStandardMaterial;
  readonly innerShirt: MeshStandardMaterial;
  readonly trim: MeshStandardMaterial;
  readonly longyi: MeshStandardMaterial;
  readonly longyiBand: MeshStandardMaterial;
  readonly sandal: MeshStandardMaterial;
}

export interface KidOutfitMaterials {
  readonly top: MeshStandardMaterial;
  readonly collar: MeshStandardMaterial;
  readonly bottom: MeshStandardMaterial;
  readonly shoe: MeshStandardMaterial;
  readonly ribbon: MeshStandardMaterial;
}

export interface ElderBotSharedGeometries {
  readonly unitBox: BoxGeometry;
  readonly unitSphere: SphereGeometry;
  readonly unitCyl: CylinderGeometry;
  readonly longyiShell: BufferGeometry;
  readonly uncleTorso: BufferGeometry;
  readonly auntieTorso: BufferGeometry;
  readonly kidTorso: BufferGeometry;
  readonly kidDressSkirt: BufferGeometry;
  readonly upperSleeve: BufferGeometry;
  readonly lowerSleeve: BufferGeometry;
  readonly hairCapUncle: SphereGeometry;
  readonly hairCapAuntie: SphereGeometry;
  readonly glassesLens: TorusGeometry;
}

export interface ElderBotResourceCache {
  readonly geo: ElderBotSharedGeometries;
  readonly uncleOutfits: readonly OutfitMaterials[];
  readonly auntieOutfits: readonly OutfitMaterials[];
  readonly boyOutfits: readonly KidOutfitMaterials[];
  readonly girlOutfits: readonly KidOutfitMaterials[];
  readonly kidStools: readonly MeshStandardMaterial[];
  readonly skins: readonly MeshStandardMaterial[];
  readonly hairs: readonly MeshStandardMaterial[];
  readonly hairGrey: MeshStandardMaterial;
  readonly eyeWhite: MeshStandardMaterial;
  readonly eyeDark: MeshStandardMaterial;
  readonly mouthUncle: MeshStandardMaterial;
  readonly mouthAuntie: MeshStandardMaterial;
  readonly goldAccent: MeshStandardMaterial;
  readonly thanaka: MeshStandardMaterial;
  readonly jasmine: MeshStandardMaterial;
  readonly chairTeakDark: MeshStandardMaterial;
  readonly chairTeakMid: MeshStandardMaterial;
  readonly chairTeakFrame: MeshStandardMaterial;
  readonly chairRattan: MeshStandardMaterial;
  readonly chairSlat: MeshStandardMaterial;
  readonly doorWood: MeshStandardMaterial;
  readonly doorPanel: MeshStandardMaterial;
  readonly doorKnob: MeshStandardMaterial;
  readonly doorBackdrop: MeshStandardMaterial;
  readonly gateBlue: MeshStandardMaterial;
  readonly gateTrim: MeshStandardMaterial;
  readonly trousersDark: MeshStandardMaterial;
  readonly sneakerWhite: MeshStandardMaterial;
}

const UNCLE_PALETTE_SPECS = [
  // 0: U Shwe signature warm sand Taikpon + indigo-teal Paso
  { outer: '#8d735b', trim: '#6f5844', inner: '#f7f3e8', pasoBase: '#254252', pasoBand: '#31576b', pasoDark: '#1b313e', thread: '#d6c092', band: '#3d5f73', sandal: '#5a3b26' },
  // 1: Olive-khaki Taikpon + forest green plaid Paso
  { outer: '#6e7355', trim: '#53583f', inner: '#f4f0e4', pasoBase: '#254032', pasoBand: '#355c47', pasoDark: '#182b21', thread: '#d9c598', band: '#3c634d', sandal: '#4d3320' },
  // 2: Charcoal-slate Taikpon + maroon-plum Paso
  { outer: '#4b5563', trim: '#374151', inner: '#f8fafc', pasoBase: '#4a2532', pasoBand: '#663445', pasoDark: '#331721', thread: '#dbb98c', band: '#6e3a4b', sandal: '#3b2820' },
  // 3: Classic cream-ivory Taikpon + royal navy Paso
  { outer: '#d6cbb5', trim: '#b8aa91', inner: '#ffffff', pasoBase: '#1f3654', pasoBand: '#2d4d75', pasoDark: '#14243a', thread: '#e0cfa2', band: '#345882', sandal: '#573923' },
  // 4: Warm terracotta-brown Taikpon + espresso-check Paso
  { outer: '#8a5640', trim: '#6b412f', inner: '#f6efe2', pasoBase: '#3d352e', pasoBand: '#574c42', pasoDark: '#26211c', thread: '#d4b483', band: '#5c5044', sandal: '#472c1c' },
  // 5: Dusty steel-blue Taikpon + dark charcoal-teal Paso
  { outer: '#516c80', trim: '#3c5263', inner: '#f4f6f8', pasoBase: '#263c44', pasoBand: '#36545f', pasoDark: '#19282e', thread: '#d1be94', band: '#3e5e69', sandal: '#4a3222' },
  // 6: Sage-grey Taikpon + earthy rust-check Paso
  { outer: '#6f7f78', trim: '#56645e', inner: '#f5f2ea', pasoBase: '#573329', pasoBand: '#734538', pasoDark: '#3d221b', thread: '#e0c492', band: '#7a4b3d', sandal: '#4d3020' },
  // 7: Deep mocha Taikpon + emerald-teal Paso
  { outer: '#5c4638', trim: '#453328', inner: '#f7f1e3', pasoBase: '#1f4b46', pasoBand: '#2d665f', pasoDark: '#14332f', thread: '#dfc78e', band: '#347068', sandal: '#3f281b' },
] as const;

const AUNTIE_PALETTE_SPECS = [
  // 0: U Shwe Daw Lay signature rose-maroon Yin-Bone + burgundy-gold Htamein
  { outer: '#9e4866', trim: '#803550', inner: '#f3e7d3', htaBase: '#5e2340', sheen: '#82385c', border: '#c9973e', wave: '#f0cc75', sandal: '#5b2833' },
  // 1: Jade-teal Yin-Bone + navy-gold Htamein
  { outer: '#2d7d76', trim: '#215e59', inner: '#eef5f2', htaBase: '#223859', sheen: '#325280', border: '#cfa042', wave: '#f5d47a', sandal: '#382a38' },
  // 2: Warm mustard-gold Yin-Bone + deep plum-gold Htamein
  { outer: '#b58938', trim: '#8f6b28', inner: '#fcf6e6', htaBase: '#4f2447', sheen: '#703565', border: '#d9ab4c', wave: '#fae08c', sandal: '#4d2b24' },
  // 3: Soft lavender-plum Yin-Bone + indigo-silver Htamein
  { outer: '#7e5a8a', trim: '#62446c', inner: '#f4eef7', htaBase: '#2b2e59', sheen: '#414682', border: '#c4b8d4', wave: '#ede6f5', sandal: '#452b3b' },
  // 4: Coral-peach Yin-Bone + forest-gold Htamein
  { outer: '#c46d5e', trim: '#9e5346', inner: '#fdf1ec', htaBase: '#264a38', sheen: '#386b51', border: '#d4a34a', wave: '#f5d882', sandal: '#542f26' },
  // 5: Sky-indigo Yin-Bone + royal crimson-gold Htamein
  { outer: '#4b739c', trim: '#385878', inner: '#edf4fa', htaBase: '#6b2135', sheen: '#94314c', border: '#d6a444', wave: '#f5d37d', sandal: '#4f222c' },
  // 6: Cream-ivory Yin-Bone + emerald-gold Htamein
  { outer: '#e2d7c1', trim: '#c4b79e', inner: '#ffffff', htaBase: '#1f5947', sheen: '#2e7d65', border: '#d4a34a', wave: '#fae08c', sandal: '#4a3525' },
  // 7: Mint-sage Yin-Bone + terracotta-gold Htamein
  { outer: '#588c6e', trim: '#416b53', inner: '#eff7f2', htaBase: '#6e3528', sheen: '#944a39', border: '#d9a94c', wave: '#f7db86', sandal: '#4f2d22' },
] as const;

const BOY_PALETTE_SPECS = [
  { top: '#2b7cc4', collar: '#e0f2fe', bottom: '#1e3a5f', shoe: '#e2e8f0', ribbon: '#38bdf8' },
  { top: '#d94848', collar: '#fee2e2', bottom: '#273647', shoe: '#f8fafc', ribbon: '#f87171' },
  { top: '#2a9d6e', collar: '#dcfce7', bottom: '#473f36', shoe: '#f1f5f9', ribbon: '#4ade80' },
  { top: '#e09b2d', collar: '#fef3c7', bottom: '#2d3b4e', shoe: '#e2e8f0', ribbon: '#fbbf24' },
  { top: '#e06d44', collar: '#ffedd5', bottom: '#364552', shoe: '#f8fafc', ribbon: '#fb923c' },
  { top: '#4358b8', collar: '#e0e7ff', bottom: '#574c3f', shoe: '#f1f5f9', ribbon: '#818cf8' },
  { top: '#1e9e96', collar: '#ccfbf1', bottom: '#263847', shoe: '#e2e8f0', ribbon: '#2dd4bf' },
  { top: '#7c5cbf', collar: '#ede9fe', bottom: '#333d4b', shoe: '#f8fafc', ribbon: '#a78bfa' },
] as const;

const GIRL_PALETTE_SPECS = [
  { top: '#e0628c', collar: '#fff1f5', bottom: '#c44572', shoe: '#f8e6ee', ribbon: '#f472b6' },
  { top: '#3aa3b8', collar: '#ecfeff', bottom: '#267f94', shoe: '#eef9fb', ribbon: '#67e8f9' },
  { top: '#e3b33b', collar: '#fefce8', bottom: '#c48f22', shoe: '#fef9e7', ribbon: '#fde047' },
  { top: '#9b6bc7', collar: '#f5f0ff', bottom: '#784ba3', shoe: '#f3edfa', ribbon: '#c084fc' },
  { top: '#e67c63', collar: '#fff3ef', bottom: '#c45b45', shoe: '#fdeee9', ribbon: '#fca5a5' },
  { top: '#46ad78', collar: '#ecfdf5', bottom: '#2f855a', shoe: '#ecfaf2', ribbon: '#6ee7b7' },
  { top: '#d64550', collar: '#fff1f2', bottom: '#a82c38', shoe: '#fcecef', ribbon: '#fda4af' },
  { top: '#6380d1', collar: '#eff6ff', bottom: '#435ea8', shoe: '#edf2fc', ribbon: '#93c5fd' },
] as const;

let cachedResources: ElderBotResourceCache | null = null;

/**
 * Returns the global flyweight cache of geometries, textures, and materials.
 * Created once and shared by reference across U Shwe House + all pooled houses.
 */
export function getElderBotResourceCache(): ElderBotResourceCache {
  if (cachedResources) return cachedResources;

  const mat = (color: string, roughness = 0.78, metalness = 0.02) => {
    const m = new MeshStandardMaterial({ color, roughness, metalness });
    m.userData.shared = true;
    return m;
  };

  const geo: ElderBotSharedGeometries = {
    unitBox: new BoxGeometry(1, 1, 1),
    unitSphere: new SphereGeometry(1, 12, 10),
    unitCyl: new CylinderGeometry(1, 1, 1, 12),
    longyiShell: buildTexturedLongyiShell(),
    uncleTorso: loft([
      [0.01, -0.05, 0.01],
      [0.192, -0.04, 0.145],
      [0.184, 0.08, 0.138],
      [0.182, 0.22, 0.136],
      [0.194, 0.37, 0.134],
      [0.188, 0.47, 0.122],
      [0.105, 0.515, 0.095],
      [0.001, 0.52, 0.001],
    ]),
    auntieTorso: loft([
      [0.01, -0.03, 0.01],
      [0.17, -0.02, 0.13],
      [0.156, 0.11, 0.12],
      [0.164, 0.27, 0.125],
      [0.174, 0.42, 0.118],
      [0.155, 0.48, 0.108],
      [0.088, 0.51, 0.085],
      [0.001, 0.515, 0.001],
    ]),
    kidTorso: loft([
      [0.01, -0.02, 0.01],
      [0.165, -0.01, 0.125],
      [0.16, 0.14, 0.122],
      [0.168, 0.32, 0.122],
      [0.16, 0.45, 0.112],
      [0.088, 0.5, 0.085],
      [0.001, 0.505, 0.001],
    ]),
    kidDressSkirt: garmentGeometry('dress'),
    upperSleeve: loft(
      [
        [0.01, 0.03, 0.01],
        [0.06, 0.0, 0.058],
        [0.056, -0.12, 0.055],
        [0.05, -0.25, 0.05],
        [0.01, -0.27, 0.01],
      ],
      14,
    ),
    lowerSleeve: loft(
      [
        [0.01, 0.015, 0.01],
        [0.048, 0.0, 0.048],
        [0.043, -0.1, 0.043],
        [0.039, -0.18, 0.039],
        [0.01, -0.19, 0.01],
      ],
      14,
    ),
    hairCapUncle: new SphereGeometry(0.132, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairCapAuntie: new SphereGeometry(0.133, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.64),
    glassesLens: new TorusGeometry(0.028, 0.0032, 6, 14),
  };

  for (const g of Object.values(geo)) {
    g.userData.shared = true;
  }

  const uncleOutfits: OutfitMaterials[] = UNCLE_PALETTE_SPECS.map((s) => {
    const tex = createPasoTexture(s.pasoBase, s.pasoBand, s.pasoDark, s.thread);
    const longyi = new MeshStandardMaterial({
      color: tex ? '#ffffff' : s.pasoBase,
      map: tex ?? undefined,
      roughness: 0.84,
    });
    longyi.userData.shared = true;
    return {
      outerGarment: mat(s.outer, 0.82),
      innerShirt: mat(s.inner, 0.72),
      trim: mat(s.trim, 0.84),
      longyi,
      longyiBand: mat(s.band, 0.82),
      sandal: mat(s.sandal, 0.85),
    };
  });

  const auntieOutfits: OutfitMaterials[] = AUNTIE_PALETTE_SPECS.map((s) => {
    const tex = createHtameinTexture(s.htaBase, s.sheen, s.border, s.wave);
    const longyi = new MeshStandardMaterial({
      color: tex ? '#ffffff' : s.htaBase,
      map: tex ?? undefined,
      roughness: 0.82,
    });
    longyi.userData.shared = true;
    return {
      outerGarment: mat(s.outer, 0.74),
      innerShirt: mat(s.inner, 0.76),
      trim: mat(s.trim, 0.78),
      longyi,
      longyiBand: mat(s.border, 0.74),
      sandal: mat(s.sandal, 0.85),
    };
  });

  const boyOutfits: KidOutfitMaterials[] = BOY_PALETTE_SPECS.map((s) => ({
    top: mat(s.top, 0.72),
    collar: mat(s.collar, 0.68),
    bottom: mat(s.bottom, 0.8),
    shoe: mat(s.shoe, 0.65),
    ribbon: mat(s.ribbon, 0.6),
  }));

  const girlOutfits: KidOutfitMaterials[] = GIRL_PALETTE_SPECS.map((s) => ({
    top: mat(s.top, 0.7),
    collar: mat(s.collar, 0.66),
    bottom: mat(s.bottom, 0.74),
    shoe: mat(s.shoe, 0.62),
    ribbon: mat(s.ribbon, 0.55),
  }));

  cachedResources = {
    geo,
    uncleOutfits,
    auntieOutfits,
    boyOutfits,
    girlOutfits,
    kidStools: [
      mat('#0891b2', 0.6), // turquoise
      mat('#dc2626', 0.6), // ruby red
      mat('#65a30d', 0.6), // lime green
      mat('#d97706', 0.6), // warm amber
    ],
    skins: [
      mat('#c8926b', 0.72),
      mat('#d4a07a', 0.7),
      mat('#b7805a', 0.74),
      mat('#dcad88', 0.7),
    ],
    hairs: [
      mat('#333036', 0.82), // dark charcoal elder hair
      mat('#525056', 0.8), // salt-and-pepper
      mat('#8f939c', 0.78), // silver-grey elder
    ],
    hairGrey: mat('#c2c6ce', 0.8),
    eyeWhite: mat('#faf7f0', 0.25),
    eyeDark: mat('#1a1618', 0.2),
    mouthUncle: mat('#7f493b', 0.75),
    mouthAuntie: mat('#9d4e4a', 0.72),
    goldAccent: mat('#d4af37', 0.34, 0.52),
    thanaka: mat('#f0e0a0', 0.85),
    jasmine: mat('#faf6ec', 0.65),
    chairTeakDark: mat('#52331c', 0.8),
    chairTeakMid: mat('#5c3a21', 0.78),
    chairTeakFrame: mat('#6b4426', 0.75),
    chairRattan: mat('#c9a878', 0.88),
    chairSlat: mat('#b99463', 0.85),
    doorWood: mat('#6b4832', 0.5),
    doorPanel: mat('#7d563c', 0.55),
    doorKnob: mat('#f5cb55', 0.3, 0.55),
    doorBackdrop: mat('#a98c68', 0.85),
    gateBlue: mat('#2b6cb0', 0.45, 0.35),
    gateTrim: mat('#1d4e89', 0.5, 0.3),
    trousersDark: mat('#273342', 0.8),
    sneakerWhite: mat('#eef2f6', 0.62),
  };

  return cachedResources;
}
