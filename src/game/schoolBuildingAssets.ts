import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Multi-Classroom Village School Halls
 * ============================================================================
 *
 * Guarantees ZERO duplicated BufferGeometries or base Materials across every
 * walk-in multi-classroom school hall in Kyar Inn, Htauk Kyant, Htomar,
 * Kanbale, and Nat Myaung.
 */

export interface SchoolBuildingAssetCache {
  readonly unitBoxGeo: BoxGeometry;
  readonly unitCylGeo: CylinderGeometry;
  readonly plinthMat: MeshStandardMaterial;
  readonly floorMat: MeshStandardMaterial;
  readonly corridorFloorMat: MeshStandardMaterial;
  readonly partitionWallMat: MeshStandardMaterial;
  readonly wallTrimMat: MeshStandardMaterial;
  readonly pillarMat: MeshStandardMaterial;
  readonly doorFrameMat: MeshStandardMaterial;
  readonly doorLeafMat: MeshStandardMaterial;
  readonly windowGlassMat: MeshStandardMaterial;
  readonly windowFrameMat: MeshStandardMaterial;
  readonly chalkboardMat: MeshStandardMaterial;
  readonly chalkboardFrameMat: MeshStandardMaterial;
  readonly chalkTrayMat: MeshStandardMaterial;
  readonly deskTopMat: MeshStandardMaterial;
  readonly deskFrameMat: MeshStandardMaterial;
  readonly teacherDeskMat: MeshStandardMaterial;
  readonly bookRedMat: MeshStandardMaterial;
  readonly bookBlueMat: MeshStandardMaterial;
  readonly bookGreenMat: MeshStandardMaterial;
  readonly bookOchreMat: MeshStandardMaterial;
  readonly bookPageMat: MeshStandardMaterial;
  readonly signboardBgMat: MeshStandardMaterial;
  readonly signboardGoldMat: MeshStandardMaterial;
  readonly getWallMat: (hex: string) => MeshStandardMaterial;
  readonly getRoofMat: (hex: string) => MeshStandardMaterial;
  readonly getRoomPlaqueMat: (label: string) => MeshStandardMaterial;
}

let singletonCache: SchoolBuildingAssetCache | null = null;
const cachedWallMats = new Map<string, MeshStandardMaterial>();
const cachedRoofMats = new Map<string, MeshStandardMaterial>();
const cachedPlaqueMats = new Map<string, MeshStandardMaterial>();
const cachedPlaqueTextures: CanvasTexture[] = [];

function makeRoomPlaqueMaterial(label: string): MeshStandardMaterial {
  let map: CanvasTexture | undefined;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, 256, 96);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 6;
      ctx.strokeRect(5, 5, 246, 86);
      ctx.fillStyle = '#fef9c3';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 50, 224);
      map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      cachedPlaqueTextures.push(map);
    }
  }
  return new MeshStandardMaterial({
    color: map ? '#ffffff' : '#14532d',
    map,
    roughness: 0.65,
  });
}

export function getSchoolBuildingAssetCache(): SchoolBuildingAssetCache {
  if (singletonCache) return singletonCache;

  const created: SchoolBuildingAssetCache = Object.freeze({
    unitBoxGeo: new BoxGeometry(1, 1, 1),
    unitCylGeo: new CylinderGeometry(0.5, 0.5, 1, 8),
    plinthMat: new MeshStandardMaterial({ color: '#c8c2b4', roughness: 0.92 }),
    floorMat: new MeshStandardMaterial({ color: '#ddd7c8', roughness: 0.85 }),
    corridorFloorMat: new MeshStandardMaterial({ color: '#d0cab9', roughness: 0.88 }),
    partitionWallMat: new MeshStandardMaterial({ color: '#efe9d8', roughness: 0.88 }),
    wallTrimMat: new MeshStandardMaterial({ color: '#b7ab94', roughness: 0.82 }),
    pillarMat: new MeshStandardMaterial({ color: '#f5f2ea', roughness: 0.78 }),
    doorFrameMat: new MeshStandardMaterial({ color: '#5c3c22', roughness: 0.75 }),
    doorLeafMat: new MeshStandardMaterial({ color: '#7a4f2d', roughness: 0.72 }),
    windowGlassMat: new MeshStandardMaterial({
      color: '#7ea8c2',
      roughness: 0.25,
      metalness: 0.2,
    }),
    windowFrameMat: new MeshStandardMaterial({ color: '#f2efe6', roughness: 0.75 }),
    chalkboardMat: new MeshStandardMaterial({ color: '#1b3b2a', roughness: 0.85 }),
    chalkboardFrameMat: new MeshStandardMaterial({ color: '#6b4423', roughness: 0.75 }),
    chalkTrayMat: new MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.6 }),
    deskTopMat: new MeshStandardMaterial({ color: '#b5844c', roughness: 0.7 }),
    deskFrameMat: new MeshStandardMaterial({ color: '#4c3520', roughness: 0.8 }),
    teacherDeskMat: new MeshStandardMaterial({ color: '#7d502b', roughness: 0.68 }),
    bookRedMat: new MeshStandardMaterial({ color: '#8f2d2d', roughness: 0.72 }),
    bookBlueMat: new MeshStandardMaterial({ color: '#244b7a', roughness: 0.72 }),
    bookGreenMat: new MeshStandardMaterial({ color: '#245c3c', roughness: 0.72 }),
    bookOchreMat: new MeshStandardMaterial({ color: '#b47824', roughness: 0.72 }),
    bookPageMat: new MeshStandardMaterial({ color: '#f3eedc', roughness: 0.85 }),
    signboardBgMat: new MeshStandardMaterial({ color: '#14532d', roughness: 0.6 }),
    signboardGoldMat: new MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.4,
      metalness: 0.3,
    }),
    getWallMat: (hex: string) => {
      let m = cachedWallMats.get(hex);
      if (!m) {
        m = new MeshStandardMaterial({ color: hex, roughness: 0.85 });
        cachedWallMats.set(hex, m);
      }
      return m;
    },
    getRoofMat: (hex: string) => {
      let m = cachedRoofMats.get(hex);
      if (!m) {
        m = new MeshStandardMaterial({ color: hex, roughness: 0.68 });
        cachedRoofMats.set(hex, m);
      }
      return m;
    },
    getRoomPlaqueMat: (label: string) => {
      let m = cachedPlaqueMats.get(label);
      if (!m) {
        m = makeRoomPlaqueMaterial(label);
        cachedPlaqueMats.set(label, m);
      }
      return m;
    },
  });

  singletonCache = created;
  return created;
}

export function disposeSchoolBuildingAssetCache(): void {
  if (!singletonCache) return;
  const c = singletonCache;
  singletonCache = null;

  c.unitBoxGeo.dispose();
  c.unitCylGeo.dispose();
  c.plinthMat.dispose();
  c.floorMat.dispose();
  c.corridorFloorMat.dispose();
  c.partitionWallMat.dispose();
  c.wallTrimMat.dispose();
  c.pillarMat.dispose();
  c.doorFrameMat.dispose();
  c.doorLeafMat.dispose();
  c.windowGlassMat.dispose();
  c.windowFrameMat.dispose();
  c.chalkboardMat.dispose();
  c.chalkboardFrameMat.dispose();
  c.chalkTrayMat.dispose();
  c.deskTopMat.dispose();
  c.deskFrameMat.dispose();
  c.teacherDeskMat.dispose();
  c.bookRedMat.dispose();
  c.bookBlueMat.dispose();
  c.bookGreenMat.dispose();
  c.bookOchreMat.dispose();
  c.bookPageMat.dispose();
  c.signboardBgMat.dispose();
  c.signboardGoldMat.dispose();

  for (const m of cachedWallMats.values()) m.dispose();
  cachedWallMats.clear();
  for (const m of cachedRoofMats.values()) m.dispose();
  cachedRoofMats.clear();
  for (const m of cachedPlaqueMats.values()) m.dispose();
  cachedPlaqueMats.clear();
  for (const t of cachedPlaqueTextures) t.dispose();
  cachedPlaqueTextures.length = 0;
}
