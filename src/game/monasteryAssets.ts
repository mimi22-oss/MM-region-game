import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

const SQRT1_2 = Math.SQRT1_2;

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Myanmar Theravada Monastery Buildings
 * ============================================================================
 *
 * Guarantees ZERO duplicated GPU BufferGeometries, Materials, or signboard
 * CanvasTextures across every reusable monastery building (`DhammaHall`,
 * `MonksKyaung`, `CeremonialMandap`, `RefectoryAlmsBuilding`, `GoldenStupa`,
 * `BuddhistFlagPole`) placed anywhere on the map.
 *
 * Every shared resource sets `userData.shared = true` so region disposal
 * (`disposePreparedRegion`) leaves the singleton cache intact.
 */

// Authentic Myanmar Theravada Monastery Palette
export const MONASTERY_COLORS = {
  creamWall: '#f4ead2',
  ivoryPlinth: '#e7dcc0',
  warmStone: '#d4c6a3',
  crimsonRoof: '#8f1f24',
  crimsonDark: '#6c1419',
  crimsonPillar: '#9e2329',
  jadeRoof: '#1f5e47',
  jadeDark: '#164534',
  kyaungRoof: '#6e2820',
  kyaungRoofLight: '#7d2f24',
  refectoryRoof: '#8c3b2b',
  refectoryDark: '#63261b',
  teakDark: '#4f2c1b',
  teakMid: '#6b3e26',
  teakWarm: '#825032',
  teakFloor: '#7a4b2c',
  upperFloorWood: '#8c5a37',
  stairWood: '#633820',
  goldBright: '#f2c144',
  goldRich: '#d9a42a',
  goldDeep: '#b37e16',
  windowGlass: '#2a3d45',
  courtyardPave: '#c8be9b',
  courtyardInner: '#b6ac88',
  tileFloor: '#dcd1b2',
  lacquerBlack: '#1b1615',
  lacquerRed: '#a12322',
  brassPot: '#c89b3c',
  ceramicJar: '#6e472b',
  riceSack: '#d6c5a1',
  riceWhite: '#f5f2e6',
  wovenMat: '#c29b59',
  saffronCushion: '#b45309',
  buddhistFlag: ['#1d4ed8', '#facc15', '#dc2626', '#f8fafc', '#f97316'] as const,
} as const;

function markSharedGeo<T extends BufferGeometry>(geo: T): T {
  geo.userData.shared = true;
  return geo;
}

function markSharedMat<T extends Material>(mat: T): T {
  mat.userData.shared = true;
  return mat;
}

export interface MonasteryBuildingAssetCache {
  readonly id: string;
  // Shared unit geometries
  readonly unitBoxGeo: BoxGeometry;
  readonly unitCylGeo: CylinderGeometry;
  readonly unitCyl8Geo: CylinderGeometry;
  readonly unitCone4Geo: ConeGeometry;
  readonly unitCone12Geo: ConeGeometry;
  readonly unitSphereGeo: SphereGeometry;
  readonly unitDomeGeo: SphereGeometry;
  readonly unitPlaneGeo: PlaneGeometry;
  readonly getRoofFrustumGeo: (topRatio: number) => CylinderGeometry;

  // Shared architectural materials
  readonly creamWallMat: MeshStandardMaterial;
  readonly ivoryPlinthMat: MeshStandardMaterial;
  readonly warmStoneMat: MeshStandardMaterial;
  readonly tileFloorMat: MeshStandardMaterial;
  readonly teakFloorMat: MeshStandardMaterial;
  readonly upperFloorWoodMat: MeshStandardMaterial;
  readonly stairWoodMat: MeshStandardMaterial;
  readonly crimsonRoofMat: MeshStandardMaterial;
  readonly crimsonDarkMat: MeshStandardMaterial;
  readonly crimsonPillarMat: MeshStandardMaterial;
  readonly jadeRoofMat: MeshStandardMaterial;
  readonly jadeDarkMat: MeshStandardMaterial;
  readonly kyaungRoofMat: MeshStandardMaterial;
  readonly kyaungRoofLightMat: MeshStandardMaterial;
  readonly refectoryRoofMat: MeshStandardMaterial;
  readonly refectoryDarkMat: MeshStandardMaterial;
  readonly teakDarkMat: MeshStandardMaterial;
  readonly teakMidMat: MeshStandardMaterial;
  readonly teakWarmMat: MeshStandardMaterial;
  readonly goldBrightMat: MeshStandardMaterial;
  readonly goldRichMat: MeshStandardMaterial;
  readonly goldDeepMat: MeshStandardMaterial;
  readonly goldGlowMat: MeshStandardMaterial;
  readonly goldHaloMat: MeshStandardMaterial;
  readonly windowGlassMat: MeshStandardMaterial;
  readonly courtyardPaveMat: MeshStandardMaterial;
  readonly courtyardInnerMat: MeshStandardMaterial;

  // Refectory & Alms supplies materials
  readonly lacquerBlackMat: MeshStandardMaterial;
  readonly lacquerRedMat: MeshStandardMaterial;
  readonly brassPotMat: MeshStandardMaterial;
  readonly ceramicJarMat: MeshStandardMaterial;
  readonly riceSackMat: MeshStandardMaterial;
  readonly riceWhiteMat: MeshStandardMaterial;
  readonly wovenMatMat: MeshStandardMaterial;
  readonly saffronCushionMat: MeshStandardMaterial;

  // Flagpole & 5-color Buddhist flag materials
  readonly flagPoleMat: MeshStandardMaterial;
  readonly buddhistFlagMats: readonly MeshStandardMaterial[];

  // Cached roof material lookup, Burmese signboard plaque lookup & 8 Planetary Day (`နေ့နံ`) plaque lookup
  readonly getRoofMat: (hex: string) => MeshStandardMaterial;
  readonly getSignboardMat: (
    key: string,
    title: string,
    subtitle: string,
    bgTop: string,
    bgBottom: string,
  ) => MeshStandardMaterial | null;
  readonly getPlanetaryPlaqueMat: (dayLabel: string, animalLabel: string) => MeshStandardMaterial;
}

let singletonCache: MonasteryBuildingAssetCache | null = null;
const cachedFrustumGeos = new Map<string, CylinderGeometry>();
const cachedRoofMats = new Map<string, MeshStandardMaterial>();
const cachedSignboardMats = new Map<string, MeshStandardMaterial>();
const cachedSignboardTextures: CanvasTexture[] = [];

function createSignboardMaterial(
  title: string,
  subtitle: string,
  bgTop: string,
  bgBottom: string,
): MeshStandardMaterial | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = MONASTERY_COLORS.goldBright;
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.strokeStyle = MONASTERY_COLORS.goldDeep;
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 30px "Myanmar Text", "Padauk", "Noto Sans Myanmar", sans-serif';
  ctx.fillStyle = '#3a0a0c';
  ctx.fillText(title, canvas.width / 2 + 1.5, 48.5, canvas.width - 42);
  ctx.fillStyle = MONASTERY_COLORS.goldBright;
  ctx.fillText(title, canvas.width / 2, 47, canvas.width - 42);

  ctx.font = '600 19px "Myanmar Text", "Padauk", "Noto Sans Myanmar", sans-serif';
  ctx.fillStyle = '#fff5d6';
  ctx.fillText(subtitle, canvas.width / 2, 92, canvas.width - 42);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.userData.shared = true;
  tex.needsUpdate = true;
  cachedSignboardTextures.push(tex);

  return markSharedMat(
    new MeshStandardMaterial({
      map: tex,
      roughness: 0.38,
      metalness: 0.15,
    }),
  );
}

export function getMonasteryBuildingAssetCache(): MonasteryBuildingAssetCache {
  if (singletonCache) return singletonCache;

  const C = MONASTERY_COLORS;
  const created: MonasteryBuildingAssetCache = Object.freeze({
    id: 'monastery-building-singleton-cache',

    // Shared unit geometries (created ONCE globally)
    unitBoxGeo: markSharedGeo(new BoxGeometry(1, 1, 1)),
    unitCylGeo: markSharedGeo(new CylinderGeometry(0.5, 0.5, 1, 12)),
    unitCyl8Geo: markSharedGeo(new CylinderGeometry(0.5, 0.5, 1, 8)),
    unitCone4Geo: markSharedGeo(new ConeGeometry(0.5, 1, 4)),
    unitCone12Geo: markSharedGeo(new ConeGeometry(0.5, 1, 12)),
    unitSphereGeo: markSharedGeo(new SphereGeometry(0.5, 12, 10)),
    unitDomeGeo: markSharedGeo(new SphereGeometry(0.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2)),
    unitPlaneGeo: markSharedGeo(new PlaneGeometry(1, 1)),

    getRoofFrustumGeo: (topRatio: number) => {
      const key = topRatio.toFixed(3);
      let geo = cachedFrustumGeos.get(key);
      if (!geo) {
        geo = markSharedGeo(new CylinderGeometry(topRatio * SQRT1_2, SQRT1_2, 1, 4));
        cachedFrustumGeos.set(key, geo);
      }
      return geo;
    },

    // Architectural materials
    creamWallMat: markSharedMat(new MeshStandardMaterial({ color: C.creamWall, roughness: 0.82 })),
    ivoryPlinthMat: markSharedMat(new MeshStandardMaterial({ color: C.ivoryPlinth, roughness: 0.86 })),
    warmStoneMat: markSharedMat(new MeshStandardMaterial({ color: C.warmStone, roughness: 0.9 })),
    tileFloorMat: markSharedMat(new MeshStandardMaterial({ color: C.tileFloor, roughness: 0.72 })),
    teakFloorMat: markSharedMat(new MeshStandardMaterial({ color: C.teakFloor, roughness: 0.68 })),
    upperFloorWoodMat: markSharedMat(new MeshStandardMaterial({ color: C.upperFloorWood, roughness: 0.66 })),
    stairWoodMat: markSharedMat(new MeshStandardMaterial({ color: C.stairWood, roughness: 0.68 })),
    crimsonRoofMat: markSharedMat(new MeshStandardMaterial({ color: C.crimsonRoof, roughness: 0.58, metalness: 0.12 })),
    crimsonDarkMat: markSharedMat(new MeshStandardMaterial({ color: C.crimsonDark, roughness: 0.66 })),
    crimsonPillarMat: markSharedMat(new MeshStandardMaterial({ color: C.crimsonPillar, roughness: 0.46 })),
    jadeRoofMat: markSharedMat(new MeshStandardMaterial({ color: C.jadeRoof, roughness: 0.58, metalness: 0.12 })),
    jadeDarkMat: markSharedMat(new MeshStandardMaterial({ color: C.jadeDark, roughness: 0.68 })),
    kyaungRoofMat: markSharedMat(new MeshStandardMaterial({ color: C.kyaungRoof, roughness: 0.6, metalness: 0.1 })),
    kyaungRoofLightMat: markSharedMat(new MeshStandardMaterial({ color: C.kyaungRoofLight, roughness: 0.58, metalness: 0.1 })),
    refectoryRoofMat: markSharedMat(new MeshStandardMaterial({ color: C.refectoryRoof, roughness: 0.6, metalness: 0.1 })),
    refectoryDarkMat: markSharedMat(new MeshStandardMaterial({ color: C.refectoryDark, roughness: 0.7 })),
    teakDarkMat: markSharedMat(new MeshStandardMaterial({ color: C.teakDark, roughness: 0.72 })),
    teakMidMat: markSharedMat(new MeshStandardMaterial({ color: C.teakMid, roughness: 0.68 })),
    teakWarmMat: markSharedMat(new MeshStandardMaterial({ color: C.teakWarm, roughness: 0.66 })),
    goldBrightMat: markSharedMat(new MeshStandardMaterial({ color: C.goldBright, metalness: 0.6, roughness: 0.28 })),
    goldRichMat: markSharedMat(new MeshStandardMaterial({ color: C.goldRich, metalness: 0.45, roughness: 0.36 })),
    goldDeepMat: markSharedMat(new MeshStandardMaterial({ color: C.goldDeep, metalness: 0.4, roughness: 0.42 })),
    goldGlowMat: markSharedMat(
      new MeshStandardMaterial({
        color: '#fff3b0',
        emissive: C.goldBright,
        emissiveIntensity: 0.35,
        metalness: 0.6,
        roughness: 0.2,
      }),
    ),
    goldHaloMat: markSharedMat(
      new MeshStandardMaterial({
        color: '#ffe580',
        emissive: C.goldBright,
        emissiveIntensity: 0.28,
        metalness: 0.5,
        roughness: 0.25,
      }),
    ),
    windowGlassMat: markSharedMat(new MeshStandardMaterial({ color: C.windowGlass, roughness: 0.32, metalness: 0.18 })),
    courtyardPaveMat: markSharedMat(new MeshStandardMaterial({ color: C.courtyardPave, roughness: 0.9 })),
    courtyardInnerMat: markSharedMat(new MeshStandardMaterial({ color: C.courtyardInner, roughness: 0.88 })),

    // Refectory & Alms supplies materials
    lacquerBlackMat: markSharedMat(new MeshStandardMaterial({ color: C.lacquerBlack, roughness: 0.28, metalness: 0.18 })),
    lacquerRedMat: markSharedMat(new MeshStandardMaterial({ color: C.lacquerRed, roughness: 0.34, metalness: 0.14 })),
    brassPotMat: markSharedMat(new MeshStandardMaterial({ color: C.brassPot, roughness: 0.3, metalness: 0.65 })),
    ceramicJarMat: markSharedMat(new MeshStandardMaterial({ color: C.ceramicJar, roughness: 0.48, metalness: 0.08 })),
    riceSackMat: markSharedMat(new MeshStandardMaterial({ color: C.riceSack, roughness: 0.92 })),
    riceWhiteMat: markSharedMat(new MeshStandardMaterial({ color: C.riceWhite, roughness: 0.85 })),
    wovenMatMat: markSharedMat(new MeshStandardMaterial({ color: C.wovenMat, roughness: 0.88 })),
    saffronCushionMat: markSharedMat(new MeshStandardMaterial({ color: C.saffronCushion, roughness: 0.82 })),

    flagPoleMat: markSharedMat(new MeshStandardMaterial({ color: '#f5f3ea', roughness: 0.4, metalness: 0.2 })),
    buddhistFlagMats: Object.freeze(
      C.buddhistFlag.map((hex) => markSharedMat(new MeshStandardMaterial({ color: hex, roughness: 0.65 }))),
    ),

    getRoofMat: (hex: string) => {
      if (hex === C.crimsonRoof) return created.crimsonRoofMat;
      if (hex === C.jadeRoof) return created.jadeRoofMat;
      if (hex === C.kyaungRoof) return created.kyaungRoofMat;
      if (hex === C.kyaungRoofLight) return created.kyaungRoofLightMat;
      if (hex === C.refectoryRoof) return created.refectoryRoofMat;
      let mat = cachedRoofMats.get(hex);
      if (!mat) {
        mat = markSharedMat(new MeshStandardMaterial({ color: hex, roughness: 0.58, metalness: 0.12 }));
        cachedRoofMats.set(hex, mat);
      }
      return mat;
    },

    getSignboardMat: (
      key: string,
      title: string,
      subtitle: string,
      bgTop: string,
      bgBottom: string,
    ) => {
      const fullKey = `${key}|${title}|${subtitle}|${bgTop}|${bgBottom}`;
      const existing = cachedSignboardMats.get(fullKey);
      if (existing) return existing;
      const mat = createSignboardMaterial(title, subtitle, bgTop, bgBottom);
      if (mat) cachedSignboardMats.set(fullKey, mat);
      return mat;
    },

    getPlanetaryPlaqueMat: (dayLabel: string, animalLabel: string) => {
      const key = `planet|${dayLabel}|${animalLabel}`;
      const existing = cachedSignboardMats.get(key);
      if (existing) return existing;
      const mat =
        createSignboardMaterial(dayLabel, animalLabel, '#6c1419', '#3a090c') ??
        created.crimsonDarkMat;
      cachedSignboardMats.set(key, mat);
      return mat;
    },
  });

  singletonCache = created;
  return created;
}

export function disposeMonasteryBuildingAssetCache(): void {
  if (!singletonCache) return;
  const c = singletonCache;
  singletonCache = null;

  c.unitBoxGeo.dispose();
  c.unitCylGeo.dispose();
  c.unitCyl8Geo.dispose();
  c.unitCone4Geo.dispose();
  c.unitCone12Geo.dispose();
  c.unitSphereGeo.dispose();
  c.unitDomeGeo.dispose();
  c.unitPlaneGeo.dispose();

  for (const g of cachedFrustumGeos.values()) g.dispose();
  cachedFrustumGeos.clear();

  c.creamWallMat.dispose();
  c.ivoryPlinthMat.dispose();
  c.warmStoneMat.dispose();
  c.tileFloorMat.dispose();
  c.teakFloorMat.dispose();
  c.upperFloorWoodMat.dispose();
  c.stairWoodMat.dispose();
  c.crimsonRoofMat.dispose();
  c.crimsonDarkMat.dispose();
  c.crimsonPillarMat.dispose();
  c.jadeRoofMat.dispose();
  c.jadeDarkMat.dispose();
  c.kyaungRoofMat.dispose();
  c.kyaungRoofLightMat.dispose();
  c.refectoryRoofMat.dispose();
  c.refectoryDarkMat.dispose();
  c.teakDarkMat.dispose();
  c.teakMidMat.dispose();
  c.teakWarmMat.dispose();
  c.goldBrightMat.dispose();
  c.goldRichMat.dispose();
  c.goldDeepMat.dispose();
  c.goldGlowMat.dispose();
  c.goldHaloMat.dispose();
  c.windowGlassMat.dispose();
  c.courtyardPaveMat.dispose();
  c.courtyardInnerMat.dispose();
  c.lacquerBlackMat.dispose();
  c.lacquerRedMat.dispose();
  c.brassPotMat.dispose();
  c.ceramicJarMat.dispose();
  c.riceSackMat.dispose();
  c.riceWhiteMat.dispose();
  c.wovenMatMat.dispose();
  c.saffronCushionMat.dispose();
  c.flagPoleMat.dispose();
  c.buddhistFlagMats.forEach((m) => m.dispose());

  for (const m of cachedRoofMats.values()) m.dispose();
  cachedRoofMats.clear();
  for (const m of cachedSignboardMats.values()) m.dispose();
  cachedSignboardMats.clear();
  for (const t of cachedSignboardTextures) t.dispose();
  cachedSignboardTextures.length = 0;
}
