import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from 'three';
import { getWeipulaVillagerCache, type WeipulaVillagerCache } from './weipulaVillagers.ts';

/**
 * ============================================================================
 * Singleton Memory Reference Cache for Christian Clergy & Village School NPCs
 * ============================================================================
 * Strictly reuses all shared articulated body/limb BufferGeometries & skin/hair
 * materials from `getWeipulaVillagerCache()` (ZERO duplicate body geometries!),
 * adding ONLY the dedicated Christian vestment & Myanmar school uniform assets once.
 */

export interface InstitutionNpcAssetCache {
  readonly id: string;
  readonly base: WeipulaVillagerCache;
  // Shared accessory geometries
  readonly collarGeo: CylinderGeometry;
  readonly veilGeo: BoxGeometry;
  readonly wimpleGeo: CylinderGeometry;
  readonly bibleGeo: BoxGeometry;
  readonly backpackGeo: BoxGeometry;
  readonly crossVGeo: BoxGeometry;
  readonly crossHGeo: BoxGeometry;
  // Christian Clergy materials (Catholic Priest/Sister & Protestant Pastor/Lady Pastor)
  readonly cassockBlackMat: MeshStandardMaterial;
  readonly cassockWhiteMat: MeshStandardMaterial;
  readonly clericalCollarMat: MeshStandardMaterial;
  readonly stoleGoldMat: MeshStandardMaterial;
  readonly stoleCrimsonMat: MeshStandardMaterial;
  readonly sisterHabitMat: MeshStandardMaterial;
  readonly sisterVeilTrimMat: MeshStandardMaterial;
  readonly crossGoldMat: MeshStandardMaterial;
  readonly bibleCoverMat: MeshStandardMaterial;
  // Myanmar School Uniform materials (အဖြူ + အစိမ်း)
  readonly schoolWhiteMat: MeshStandardMaterial;
  readonly schoolGreenMat: MeshStandardMaterial;
  readonly teacherBagMat: MeshStandardMaterial;
  readonly studentBackpackMats: readonly MeshStandardMaterial[];
}

let singletonInstitutionCache: InstitutionNpcAssetCache | null = null;

export function getInstitutionNpcCache(): InstitutionNpcAssetCache {
  if (singletonInstitutionCache) return singletonInstitutionCache;

  const base = getWeipulaVillagerCache();

  const created: InstitutionNpcAssetCache = Object.freeze({
    id: 'institution-npc-singleton-cache',
    base,

    // Accessory geometries (created ONCE globally)
    collarGeo: new CylinderGeometry(0.072, 0.078, 0.065, 10),
    veilGeo: new BoxGeometry(0.32, 0.36, 0.24),
    wimpleGeo: new CylinderGeometry(0.168, 0.175, 0.09, 10),
    bibleGeo: new BoxGeometry(0.11, 0.16, 0.045),
    backpackGeo: new BoxGeometry(0.26, 0.34, 0.14),
    crossVGeo: new BoxGeometry(0.024, 0.14, 0.018),
    crossHGeo: new BoxGeometry(0.092, 0.024, 0.018),

    // Christian clergy vestments
    cassockBlackMat: new MeshStandardMaterial({ color: '#171a21', roughness: 0.78 }),
    cassockWhiteMat: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.62 }),
    clericalCollarMat: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.45 }),
    stoleGoldMat: new MeshStandardMaterial({ color: '#eab308', metalness: 0.22, roughness: 0.42 }),
    stoleCrimsonMat: new MeshStandardMaterial({ color: '#991b1b', roughness: 0.62 }),
    sisterHabitMat: new MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 }),
    sisterVeilTrimMat: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 }),
    crossGoldMat: new MeshStandardMaterial({ color: '#facc15', metalness: 0.48, roughness: 0.32 }),
    bibleCoverMat: new MeshStandardMaterial({ color: '#3f1d2b', roughness: 0.7 }),

    // Myanmar school uniform (အဖြူအင်္ကျီ + အစိမ်းပုဆိုး/ထဘီ)
    schoolWhiteMat: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.65 }),
    schoolGreenMat: new MeshStandardMaterial({ color: '#166534', roughness: 0.78 }),
    teacherBagMat: new MeshStandardMaterial({ color: '#5c3a21', roughness: 0.75 }),
    studentBackpackMats: [
      new MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.72 }),
      new MeshStandardMaterial({ color: '#b91c1c', roughness: 0.72 }),
      new MeshStandardMaterial({ color: '#ca8a04', roughness: 0.72 }),
    ],
  });

  singletonInstitutionCache = created;
  return created;
}

export function disposeInstitutionNpcCache(): void {
  if (!singletonInstitutionCache) return;
  const c = singletonInstitutionCache;
  singletonInstitutionCache = null;
  c.collarGeo.dispose();
  c.veilGeo.dispose();
  c.wimpleGeo.dispose();
  c.bibleGeo.dispose();
  c.backpackGeo.dispose();
  c.crossVGeo.dispose();
  c.crossHGeo.dispose();
  c.cassockBlackMat.dispose();
  c.cassockWhiteMat.dispose();
  c.clericalCollarMat.dispose();
  c.stoleGoldMat.dispose();
  c.stoleCrimsonMat.dispose();
  c.sisterHabitMat.dispose();
  c.sisterVeilTrimMat.dispose();
  c.crossGoldMat.dispose();
  c.bibleCoverMat.dispose();
  c.schoolWhiteMat.dispose();
  c.schoolGreenMat.dispose();
  c.teacherBagMat.dispose();
  c.studentBackpackMats.forEach(m => m.dispose());
}
