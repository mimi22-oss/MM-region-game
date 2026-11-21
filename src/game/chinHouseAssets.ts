import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
} from 'three';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Chin Traditional Houses & Hornbill Emblems
 * ============================================================================
 * Zero duplicate GPU BufferGeometries, CanvasTextures, or Materials across all
 * Chin ethnic homes in Weipula Terraced Village (or anywhere else on the map).
 */
function createChinFriezeTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Classic Chin textile border: deep black base + crimson band + gold & white diamond motifs
  ctx.fillStyle = '#141518';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#9f1d28';
  ctx.fillRect(0, 10, 256, 44);

  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 8, 256, 3);
  ctx.fillRect(0, 53, 256, 3);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 15, 256, 2);
  ctx.fillRect(0, 47, 256, 2);

  // Repeating woven Chin geometric diamonds across the frieze
  for (let x = 16; x < 256; x += 32) {
    ctx.fillStyle = '#141518';
    ctx.beginPath();
    ctx.moveTo(x, 19);
    ctx.lineTo(x + 11, 32);
    ctx.lineTo(x, 45);
    ctx.lineTo(x - 11, 32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(x, 23);
    ctx.lineTo(x + 7, 32);
    ctx.lineTo(x, 41);
    ctx.lineTo(x - 7, 32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(x, 28);
    ctx.lineTo(x + 3, 32);
    ctx.lineTo(x, 36);
    ctx.lineTo(x - 3, 32);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

export interface ChinHouseAssetCache {
  readonly id: string;
  // Shared Hornbill (အောက်ချင်းငှက်) rooftop emblem geometries
  readonly perchBaseGeo: BoxGeometry;
  readonly perchPostGeo: CylinderGeometry;
  readonly hornbillBodyGeo: SphereGeometry;
  readonly hornbillNeckGeo: CylinderGeometry;
  readonly hornbillHeadGeo: SphereGeometry;
  readonly hornbillCasqueGeo: BoxGeometry;
  readonly hornbillBeakUpperGeo: ConeGeometry;
  readonly hornbillBeakLowerGeo: ConeGeometry;
  readonly hornbillWingGeo: BoxGeometry;
  readonly hornbillWingTipGeo: BoxGeometry;
  readonly hornbillTailGeo: BoxGeometry;
  readonly hornbillTailBandGeo: BoxGeometry;
  // Shared Chin tribal symbol (Mithun horn / gable crest) geometries
  readonly mithunShieldGeo: BoxGeometry;
  readonly mithunHornGeo: TorusGeometry;
  // Shared house detail geometries
  readonly unitBoxGeo: BoxGeometry;
  readonly postGeo: CylinderGeometry;
  readonly flowerBloomGeo: SphereGeometry;
  readonly flagPoleGeo: CylinderGeometry;
  // Shared materials
  readonly hornbillBlackMat: MeshStandardMaterial;
  readonly hornbillWhiteMat: MeshStandardMaterial;
  readonly hornbillBeakGoldMat: MeshStandardMaterial;
  readonly hornbillCasqueOrangeMat: MeshStandardMaterial;
  readonly hornbillEyeMat: MeshStandardMaterial;
  readonly teakDarkMat: MeshStandardMaterial;
  readonly timberMidMat: MeshStandardMaterial;
  readonly verandaDeckMat: MeshStandardMaterial;
  readonly stepRampMat: MeshStandardMaterial;
  readonly parkingStoneMat: MeshStandardMaterial;
  readonly windowDarkMat: MeshStandardMaterial;
  readonly chinFriezeMat: MeshStandardMaterial;
  readonly mithunHornMat: MeshStandardMaterial;
  readonly chinCrimsonMat: MeshStandardMaterial;
  readonly chinGoldMat: MeshStandardMaterial;
  readonly clinicWhiteMat: MeshStandardMaterial;
  readonly clinicRedMat: MeshStandardMaterial;
  readonly stoneChimneyMat: MeshStandardMaterial;
  readonly flagPoleMat: MeshStandardMaterial;
  readonly bloomPinkMat: MeshStandardMaterial;
  readonly bloomGoldMat: MeshStandardMaterial;
  readonly bloomRoseMat: MeshStandardMaterial;
  readonly instancedWallMat: MeshStandardMaterial;
  readonly instancedRoofMat: MeshStandardMaterial;
  readonly terraceDeckMat: MeshStandardMaterial;
  readonly retainingWallMat: MeshStandardMaterial;
  readonly terraceLaneMat: MeshStandardMaterial;
  readonly doorLeafMat: MeshStandardMaterial;
  readonly doorFrameMat: MeshStandardMaterial;
  readonly welcomeMatMat: MeshStandardMaterial;
  readonly yardLawnMat: MeshStandardMaterial;
  readonly wireMeshMat: MeshStandardMaterial;
  readonly fenceSteelMat: MeshStandardMaterial;
  readonly blueFenceMat: MeshStandardMaterial;
  readonly blueFenceCapMat: MeshStandardMaterial;
  readonly friezeTexture: CanvasTexture | null;
}

let singletonChinHouseCache: ChinHouseAssetCache | null = null;

export function getChinHouseAssetCache(): ChinHouseAssetCache {
  if (singletonChinHouseCache) return singletonChinHouseCache;

  const friezeTexture = createChinFriezeTexture();

  singletonChinHouseCache = Object.freeze({
    id: 'chin-house-singleton-cache',

    // Hornbill (အောက်ချင်းငှက်) sculpted parts
    perchBaseGeo: new BoxGeometry(1.15, 0.22, 0.42),
    perchPostGeo: new CylinderGeometry(0.08, 0.12, 0.55, 8),
    hornbillBodyGeo: new SphereGeometry(0.32, 10, 8),
    hornbillNeckGeo: new CylinderGeometry(0.11, 0.15, 0.34, 8),
    hornbillHeadGeo: new SphereGeometry(0.15, 10, 8),
    hornbillCasqueGeo: new BoxGeometry(0.11, 0.14, 0.32),
    hornbillBeakUpperGeo: new ConeGeometry(0.085, 0.58, 7),
    hornbillBeakLowerGeo: new ConeGeometry(0.06, 0.44, 6),
    hornbillWingGeo: new BoxGeometry(0.95, 0.08, 0.42),
    hornbillWingTipGeo: new BoxGeometry(0.38, 0.065, 0.36),
    hornbillTailGeo: new BoxGeometry(0.24, 0.06, 0.78),
    hornbillTailBandGeo: new BoxGeometry(0.25, 0.072, 0.18),

    // Traditional Chin Mithun (နွားနောက်ဦးချို) emblem parts
    mithunShieldGeo: new BoxGeometry(0.68, 0.52, 0.09),
    mithunHornGeo: new TorusGeometry(0.24, 0.042, 6, 12, Math.PI * 0.85),

    // Shared house parts
    unitBoxGeo: new BoxGeometry(1, 1, 1),
    postGeo: new CylinderGeometry(0.2, 0.25, 1.2, 8),
    flowerBloomGeo: new SphereGeometry(0.2, 6, 6),
    flagPoleGeo: new CylinderGeometry(0.07, 0.1, 6.4, 8),

    // Shared materials
    hornbillBlackMat: new MeshStandardMaterial({ color: '#14171c', roughness: 0.58 }),
    hornbillWhiteMat: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.52 }),
    hornbillBeakGoldMat: new MeshStandardMaterial({ color: '#facc15', metalness: 0.18, roughness: 0.38 }),
    hornbillCasqueOrangeMat: new MeshStandardMaterial({ color: '#f97316', metalness: 0.2, roughness: 0.38 }),
    hornbillEyeMat: new MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 }),
    teakDarkMat: new MeshStandardMaterial({ color: '#4a3120', roughness: 0.9 }),
    timberMidMat: new MeshStandardMaterial({ color: '#543621', roughness: 0.86 }),
    verandaDeckMat: new MeshStandardMaterial({ color: '#6a472c', roughness: 0.8 }),
    stepRampMat: new MeshStandardMaterial({ color: '#5d3e26', roughness: 0.85 }),
    parkingStoneMat: new MeshStandardMaterial({ color: '#5c5750', roughness: 0.85 }),
    windowDarkMat: new MeshStandardMaterial({ color: '#2d1c10', roughness: 0.7 }),
    chinFriezeMat: new MeshStandardMaterial({
      color: friezeTexture ? '#ffffff' : '#9f1d28',
      ...(friezeTexture ? { map: friezeTexture } : {}),
      roughness: 0.72,
    }),
    mithunHornMat: new MeshStandardMaterial({ color: '#f5f0e1', roughness: 0.55 }),
    chinCrimsonMat: new MeshStandardMaterial({ color: '#b8382c', roughness: 0.6 }),
    chinGoldMat: new MeshStandardMaterial({ color: '#f0ce35', roughness: 0.42 }),
    clinicWhiteMat: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
    clinicRedMat: new MeshStandardMaterial({ color: '#d92b2b', roughness: 0.4 }),
    stoneChimneyMat: new MeshStandardMaterial({ color: '#5e5953', roughness: 0.9 }),
    flagPoleMat: new MeshStandardMaterial({ color: '#cfd4d8', metalness: 0.7, roughness: 0.3 }),
    bloomPinkMat: new MeshStandardMaterial({ color: '#df4d68', roughness: 0.6 }),
    bloomGoldMat: new MeshStandardMaterial({ color: '#f2b705', roughness: 0.6 }),
    bloomRoseMat: new MeshStandardMaterial({ color: '#e06287', roughness: 0.6 }),
    instancedWallMat: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
    instancedRoofMat: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.62 }),
    terraceDeckMat: new MeshStandardMaterial({ color: '#5c554c', roughness: 0.88 }),
    retainingWallMat: new MeshStandardMaterial({ color: '#4c463e', roughness: 0.95 }),
    terraceLaneMat: new MeshStandardMaterial({ color: '#4a5052', roughness: 0.86 }),
    doorLeafMat: new MeshStandardMaterial({ color: '#7a5438', roughness: 0.68 }),
    doorFrameMat: new MeshStandardMaterial({ color: '#573f30', roughness: 0.78 }),
    welcomeMatMat: new MeshStandardMaterial({ color: '#2d523e', roughness: 0.85 }),
    yardLawnMat: new MeshStandardMaterial({ color: '#8da06b', roughness: 0.92 }),
    wireMeshMat: new MeshStandardMaterial({
      color: '#98abb0',
      metalness: 0.45,
      roughness: 0.4,
      transparent: true,
      opacity: 0.38,
    }),
    fenceSteelMat: new MeshStandardMaterial({ color: '#566366', roughness: 0.65 }),
    blueFenceMat: new MeshStandardMaterial({ color: '#2563a6', metalness: 0.35, roughness: 0.45 }),
    blueFenceCapMat: new MeshStandardMaterial({ color: '#1d4e89', roughness: 0.5 }),
    friezeTexture,
  });

  return singletonChinHouseCache;
}

export function disposeChinHouseAssetCache(): void {
  if (!singletonChinHouseCache) return;
  const c = singletonChinHouseCache;
  singletonChinHouseCache = null;
  c.perchBaseGeo.dispose();
  c.perchPostGeo.dispose();
  c.hornbillBodyGeo.dispose();
  c.hornbillNeckGeo.dispose();
  c.hornbillHeadGeo.dispose();
  c.hornbillCasqueGeo.dispose();
  c.hornbillBeakUpperGeo.dispose();
  c.hornbillBeakLowerGeo.dispose();
  c.hornbillWingGeo.dispose();
  c.hornbillWingTipGeo.dispose();
  c.hornbillTailGeo.dispose();
  c.hornbillTailBandGeo.dispose();
  c.mithunShieldGeo.dispose();
  c.mithunHornGeo.dispose();
  c.unitBoxGeo.dispose();
  c.postGeo.dispose();
  c.flowerBloomGeo.dispose();
  c.flagPoleGeo.dispose();
  c.hornbillBlackMat.dispose();
  c.hornbillWhiteMat.dispose();
  c.hornbillBeakGoldMat.dispose();
  c.hornbillCasqueOrangeMat.dispose();
  c.hornbillEyeMat.dispose();
  c.teakDarkMat.dispose();
  c.timberMidMat.dispose();
  c.verandaDeckMat.dispose();
  c.stepRampMat.dispose();
  c.parkingStoneMat.dispose();
  c.windowDarkMat.dispose();
  c.chinFriezeMat.dispose();
  c.mithunHornMat.dispose();
  c.chinCrimsonMat.dispose();
  c.chinGoldMat.dispose();
  c.clinicWhiteMat.dispose();
  c.clinicRedMat.dispose();
  c.stoneChimneyMat.dispose();
  c.flagPoleMat.dispose();
  c.bloomPinkMat.dispose();
  c.bloomGoldMat.dispose();
  c.bloomRoseMat.dispose();
  c.instancedWallMat.dispose();
  c.instancedRoofMat.dispose();
  c.terraceDeckMat.dispose();
  c.retainingWallMat.dispose();
  c.terraceLaneMat.dispose();
  c.doorLeafMat.dispose();
  c.doorFrameMat.dispose();
  c.welcomeMatMat.dispose();
  c.yardLawnMat.dispose();
  c.wireMeshMat.dispose();
  c.fenceSteelMat.dispose();
  c.blueFenceMat.dispose();
  c.blueFenceCapMat.dispose();
  c.friezeTexture?.dispose();
}
