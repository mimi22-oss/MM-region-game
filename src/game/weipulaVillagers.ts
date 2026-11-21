import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { angle, toWorld } from '../data/ward.ts';
import { WEIPULA_VILLAGE_V_OFFSET } from './weipulaClimb.ts';
import { npcCroppedHairGeometry, npcHeadGeometry, npcLowerLegGeometry, npcShoeGeometry, npcSleeveGeometry } from './npcAnatomy.ts';

/**
 * ဝေပုလ္လ လှေကားထစ်ရွာ နေထိုင်သူ သူနာပြုများနှင့် ချင်းလူမျိုးစု ရွာသူရွာသားများ
 * (Weipula Terraced Mountain Village — Nurses & Chin Ethnic Villagers)
 *
 * Uses a strict Singleton Memory Reference Cache (`getWeipulaVillagerCache()`) for all
 * geometries, procedural Chin woven textile textures, and materials so 59 residents
 * across all 8 village houses create ZERO duplicate GPU geometries or materials.
 */

export type WeipulaVillagerKind =
  | 'nurse'
  | 'chin-woman'
  | 'chin-man'
  | 'chin-elder'
  | 'chin-kid';

export type WeipulaHouseSpec = {
  id: string;
  tierIndex: 0 | 1 | 2 | 3;
  title: string;
  u: number;
  v: number;
  width: number;
  depth: number;
  terraceV: number;
  residentCount: number; // Strictly 5..10 per house
  isClinic?: boolean;
  isTeaShop?: boolean;
  isChiefHouse?: boolean;
};

const V_OFF = WEIPULA_VILLAGE_V_OFFSET;

export const WEIPULA_VILLAGE_HOUSES: readonly WeipulaHouseSpec[] = [
  // Tier 1 (v_terrace = 4800)
  {
    id: 'weipula-house-t1-west',
    tierIndex: 0,
    title: 'တောင်စောင်း ပန်းဥယျာဉ်အိမ်',
    u: -345,
    v: 4382 + V_OFF,
    width: 8.0,
    depth: 7.0,
    terraceV: 4380 + V_OFF,
    residentCount: 7,
  },
  {
    id: 'weipula-house-t1-east',
    tierIndex: 0,
    title: 'တောင်သူ စိုက်ပျိုးရေးအိမ်',
    u: -326,
    v: 4382 + V_OFF,
    width: 8.5,
    depth: 7.5,
    terraceV: 4380 + V_OFF,
    residentCount: 6,
  },
  // Tier 2 (v_terrace = 4827)
  {
    id: 'weipula-house-t2-west',
    tierIndex: 1,
    title: 'ချင်းရိုးရာ ယက္ကန်းအိမ်',
    u: -345,
    v: 4409 + V_OFF,
    width: 8.0,
    depth: 7.5,
    terraceV: 4407 + V_OFF,
    residentCount: 8,
  },
  {
    id: 'weipula-house-t2-east',
    tierIndex: 1,
    title: 'တောင်ပေါ် နှစ်ထပ် ပျဉ်ထောင်အိမ်ကြီး',
    u: -326,
    v: 4409 + V_OFF,
    width: 9.0,
    depth: 8.0,
    terraceV: 4407 + V_OFF,
    residentCount: 9,
  },
  // Tier 3 (v_terrace = 4854)
  {
    id: 'weipula-house-t3-west',
    tierIndex: 2,
    title: 'ဝေပုလ္လ ရှုခင်းသာ လက်ဖက်ရည်ဆိုင်',
    u: -345,
    v: 4436 + V_OFF,
    width: 11.5,
    depth: 8.5,
    terraceV: 4434 + V_OFF,
    residentCount: 8,
    isTeaShop: true,
  },
  {
    id: 'weipula-house-t3-east',
    tierIndex: 2,
    title: 'တောင်စောင်း ဧည့်ရိပ်သာ',
    u: -325,
    v: 4436 + V_OFF,
    width: 8.0,
    depth: 7.5,
    terraceV: 4434 + V_OFF,
    residentCount: 6,
  },
  // Tier 4 (v_terrace = 4881 — Village Chief & Rural Mountain Clinic)
  {
    id: 'weipula-house-t4-west',
    tierIndex: 3,
    title: 'ရွာသူကြီး အိမ်',
    u: -345,
    v: 4463 + V_OFF,
    width: 9.5,
    depth: 8.5,
    terraceV: 4461 + V_OFF,
    residentCount: 7,
    isChiefHouse: true,
  },
  {
    id: 'weipula-house-t4-east',
    tierIndex: 3,
    title: 'တောင်ပေါ် ကျေးလက်ဆေးပေးခန်း',
    u: -325,
    v: 4463 + V_OFF,
    width: 8.5,
    depth: 7.5,
    terraceV: 4461 + V_OFF,
    residentCount: 8,
    isClinic: true,
  },
];

export type WeipulaVillagerZone = 'street' | 'courtyard' | 'veranda' | 'front';

export type WeipulaVillagerDescriptor = {
  id: string;
  houseId: string;
  houseTitle: string;
  tierIndex: 0 | 1 | 2 | 3;
  kind: WeipulaVillagerKind;
  label: string;
  zone: WeipulaVillagerZone;
  outfitIndex: number;
  skinIndex: number;
  scale: number;
  /** Local terrace UV anchor and patrol bounds */
  homeU: number;
  homeV: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  /** Vertical offset above tier baseY (0.20 on terrace/street, 0.85 on house veranda) */
  yOffset: number;
  /** Walking speed in m/s (0.55..1.15 for walkers, 0 for veranda hosts) */
  walkSpeed: number;
  /** Initial facing yaw offset relative to village angle */
  idleYawOffset: number;
  phaseOffset: number;
};

export type WeipulaVillagerRuntime = {
  desc: WeipulaVillagerDescriptor;
  u: number;
  v: number;
  targetU: number;
  targetV: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  walkDist: number;
  pauseTimer: number;
  elapsed: number;
  seed: number;
};

function labelForKind(kind: WeipulaVillagerKind): string {
  switch (kind) {
    case 'nurse':
      return 'ကျေးလက် သူနာပြုဆရာမ';
    case 'chin-woman':
      return 'ချင်းရိုးရာ အမျိုးသမီး';
    case 'chin-man':
      return 'ချင်းရိုးရာ အမျိုးသား';
    case 'chin-elder':
      return 'ချင်းရွာလူကြီး';
    case 'chin-kid':
      return 'ချင်းကလေးငယ်';
  }
}

function deterministicFrac(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Generates the full deterministic household roster across all 8 Weipula Village houses
 * (strictly 5..10 residents per house = 59 total: Rural Clinic Nurses + visiting Nurses +
 * Chin ethnic elders, men, women weavers, and children).
 */
export function createWeipulaVillagerRoster(): WeipulaVillagerDescriptor[] {
  const roster: WeipulaVillagerDescriptor[] = [];
  let seq = 0;

  for (let hi = 0; hi < WEIPULA_VILLAGE_HOUSES.length; hi++) {
    const h = WEIPULA_VILLAGE_HOUSES[hi];
    const halfW = h.width / 2;
    const halfD = h.depth / 2;
    const isWest = h.u < -335;

    for (let mi = 0; mi < h.residentCount; mi++) {
      seq++;
      const f1 = deterministicFrac(seq * 1.37 + hi * 11.3);
      const f2 = deterministicFrac(seq * 2.91 + mi * 7.1);

      // Assign authentic household roles:
      // - Rural Clinic (Tier 4 East): 5 Nurses + 3 Chin clinic patients/helpers
      // - Other houses: Chin elders, women, men, children + 1 visiting community nurse on Tier 1 & Tier 3
      let kind: WeipulaVillagerKind;
      if (h.isClinic) {
        kind = mi < 5 ? 'nurse' : mi === 5 ? 'chin-elder' : mi === 6 ? 'chin-woman' : 'chin-kid';
      } else if (h.isChiefHouse) {
        const roles: WeipulaVillagerKind[] = [
          'chin-elder',
          'chin-woman',
          'chin-man',
          'chin-woman',
          'chin-man',
          'chin-kid',
          'chin-kid',
        ];
        kind = roles[mi % roles.length];
      } else if (h.isTeaShop) {
        const roles: WeipulaVillagerKind[] = [
          'chin-woman',
          'chin-man',
          'nurse', // Visiting clinic nurse taking a tea break
          'chin-elder',
          'chin-man',
          'chin-woman',
          'chin-kid',
          'chin-man',
        ];
        kind = roles[mi % roles.length];
      } else {
        const roles: WeipulaVillagerKind[] = [
          'chin-man',
          'chin-woman',
          'chin-elder',
          'chin-kid',
          'chin-woman',
          'chin-man',
          'chin-kid',
          'chin-woman',
          'nurse', // Visiting community health nurse on household rounds
        ];
        kind = roles[(mi + hi) % roles.length];
      }

      // Distribute household members across 4 non-clipping walkable zones around their house:
      //  - 'veranda': standing & greeting on the raised timber front veranda (yOffset = 0.85)
      //  - 'front': front yard / step apron right outside the house entrance (yOffset = 0.20)
      //  - 'courtyard': open central plaza between west & east houses (u ∈ [-339, -331], yOffset = 0.20)
      //  - 'street': paved terrace avenue on north side of the terrace (v ∈ [terraceV - 7.6, terraceV - 3.6])
      let zone: WeipulaVillagerZone;
      let homeU: number;
      let homeV: number;
      let minU: number;
      let maxU: number;
      let minV: number;
      let maxV: number;
      let yOffset = 0.2;
      let walkSpeed = 0.68 + f1 * 0.34;
      let idleYawOffset = Math.PI;

      if (mi === 0 && !h.isTeaShop) {
        // Veranda host standing on front deck
        zone = 'veranda';
        homeU = h.u + (f1 - 0.5) * Math.max(2.0, h.width - 3.2);
        homeV = h.v + halfD - 1.1;
        minU = h.u - halfW + 1.4;
        maxU = h.u + halfW - 1.4;
        minV = homeV - 0.35;
        maxV = homeV + 0.35;
        yOffset = 0.85;
        walkSpeed = 0.26;
        idleYawOffset = 0; // Face outward from veranda
      } else if (mi === 1 || mi === 2) {
        // Central courtyard right between west & east houses (including right in front of Clinic!)
        zone = 'courtyard';
        const laneShift = isWest ? -1.4 : 1.4;
        homeU = -335 + laneShift + (f1 - 0.5) * 2.8;
        homeV = h.terraceV + (mi === 1 ? -1.2 : 2.8) + (f2 - 0.5) * 1.8;
        minU = -338.8;
        maxU = -331.2;
        minV = h.terraceV - 7.4;
        maxV = h.terraceV + 6.8;
        yOffset = 0.2;
        idleYawOffset = isWest ? Math.PI / 2 : -Math.PI / 2;
      } else if (mi === 3 || mi === 4) {
        // North paved terrace street in front of the terrace houses
        zone = 'street';
        homeU = h.u + (f1 - 0.5) * 8.5;
        homeV = h.terraceV - 5.4 + (f2 - 0.5) * 2.4;
        minU = -354.0;
        maxU = -316.0;
        minV = h.terraceV - 7.6;
        maxV = h.terraceV - 3.6;
        yOffset = 0.22;
        idleYawOffset = f1 > 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        // Front apron / side yard outside the house & clinic entrance
        zone = 'front';
        const frontV = h.v + halfD + 1.25;
        const clampedFrontV = Math.min(h.terraceV + 8.1, frontV);
        homeU = h.u + (f1 - 0.5) * (h.width - 1.0);
        homeV = clampedFrontV;
        minU = Math.max(-354.0, h.u - halfW - 1.2);
        maxU = Math.min(-316.0, h.u + halfW + 1.2);
        minV = Math.min(clampedFrontV, h.terraceV + 7.2);
        maxV = Math.min(h.terraceV + 8.3, clampedFrontV + 0.8);
        yOffset = 0.2;
        walkSpeed = 0.45 + f2 * 0.25;
        idleYawOffset = 0;
      }

      const scale =
        kind === 'chin-kid'
          ? 0.68 + f2 * 0.1
          : kind === 'chin-elder'
            ? 0.93 + f2 * 0.06
            : 0.95 + f2 * 0.09;

      roster.push({
        id: `${h.id}-res-${mi}`,
        houseId: h.id,
        houseTitle: h.title,
        tierIndex: h.tierIndex,
        kind,
        label: labelForKind(kind),
        zone,
        outfitIndex: (seq + hi) % 4,
        skinIndex: seq % 3,
        scale,
        homeU,
        homeV,
        minU,
        maxU,
        minV,
        maxV,
        yOffset,
        walkSpeed,
        idleYawOffset,
        phaseOffset: f1 * Math.PI * 2,
      });
    }
  }

  return roster;
}

export function createWeipulaVillagerRuntime(desc: WeipulaVillagerDescriptor): WeipulaVillagerRuntime {
  const pos = toWorld(desc.homeU, desc.homeV);
  const seed = Math.abs(Math.sin(desc.phaseOffset * 17.3 + desc.homeU * 0.13)) * 1000;
  return {
    desc,
    u: desc.homeU,
    v: desc.homeV,
    targetU: desc.homeU,
    targetV: desc.homeV,
    x: pos.x,
    z: pos.z,
    yaw: angle + desc.idleYawOffset,
    speed: 0,
    walkDist: 0,
    pauseTimer: 0.6 + (seed % 3.2),
    elapsed: desc.phaseOffset,
    seed,
  };
}

function nextRand(state: WeipulaVillagerRuntime): number {
  state.seed = (state.seed * 1664525 + 1013904223) % 4294967296;
  return state.seed / 4294967296;
}

/**
 * Pure per-frame villager AI update keeping every nurse & Chin resident smoothly
 * walking, pausing to chat, and safely inside their walkable terrace/veranda zone.
 */
export function stepWeipulaVillager(state: WeipulaVillagerRuntime, dt: number): void {
  const clampedDt = Math.min(0.1, Math.max(0, dt));
  state.elapsed += clampedDt;
  const d = state.desc;

  if (state.pauseTimer > 0) {
    state.pauseTimer -= clampedDt;
    state.speed = 0;
    if (state.pauseTimer <= 0) {
      const r1 = nextRand(state);
      const r2 = nextRand(state);
      state.targetU = d.minU + r1 * Math.max(0.2, d.maxU - d.minU);
      state.targetV = d.minV + r2 * Math.max(0.2, d.maxV - d.minV);
    }
    return;
  }

  const du = state.targetU - state.u;
  const dv = state.targetV - state.v;
  const dist = Math.hypot(du, dv);
  if (dist < 0.25) {
    state.speed = 0;
    state.pauseTimer = 1.8 + nextRand(state) * 3.8;
    return;
  }

  const step = Math.min(dist, d.walkSpeed * clampedDt);
  const nx = du / dist;
  const nz = dv / dist;
  state.u = Math.max(d.minU, Math.min(d.maxU, state.u + nx * step));
  state.v = Math.max(d.minV, Math.min(d.maxV, state.v + nz * step));
  state.speed = step / Math.max(0.001, clampedDt);
  state.walkDist += step;

  const world = toWorld(state.u, state.v);
  state.x = world.x;
  state.z = world.z;
  // Convert local UV heading into world Three.js Y yaw
  const targetYaw = angle + Math.atan2(nx, nz);
  let diff = targetYaw - state.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  state.yaw += diff * Math.min(1, clampedDt * 6.5);
}

/**
 * ============================================================================
 * SINGLETON MEMORY REFERENCE CACHE FOR WEIPULA NURSES & CHIN VILLAGERS
 * ============================================================================
 * Creates procedural Chin traditional woven handloom CanvasTextures, Nurse uniform
 * materials with crisp Red Cross emblem, and shared human body geometries ONCE.
 */
function createChinWovenTexture(
  baseHex: string,
  stripeHex: string,
  diamondHex: string,
  accentHex: string,
): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  // Horizontal Chin traditional woven bands
  for (let y = 0; y < 128; y += 24) {
    ctx.fillStyle = stripeHex;
    ctx.fillRect(0, y, 128, 8);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, y + 8, 128, 2);
    ctx.fillRect(0, y + 18, 128, 2);
    // Iconic Chin woven diamond motifs along band
    ctx.fillStyle = diamondHex;
    for (let x = 8; x < 128; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, y + 1);
      ctx.lineTo(x + 5, y + 4);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 5, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

export interface WeipulaVillagerCache {
  readonly id: string;
  // Shared body & accessory geometries
  readonly headGeo: typeof npcHeadGeometry;
  readonly hairCapGeo: typeof npcCroppedHairGeometry;
  readonly hairBunGeo: SphereGeometry;
  readonly neckGeo: CylinderGeometry;
  readonly torsoGeo: CylinderGeometry;
  readonly longyiGeo: CylinderGeometry;
  readonly armGeo: typeof npcSleeveGeometry;
  readonly legGeo: typeof npcLowerLegGeometry;
  readonly shoeGeo: typeof npcShoeGeometry;
  readonly sashGeo: BoxGeometry;
  readonly nurseCapGeo: BoxGeometry;
  readonly crossHGeo: BoxGeometry;
  readonly crossVGeo: BoxGeometry;
  readonly medBagGeo: BoxGeometry;
  readonly chinHeadbandGeo: TorusGeometry;
  // Shared materials
  readonly skinMats: readonly MeshStandardMaterial[];
  readonly hairDarkMat: MeshStandardMaterial;
  readonly hairSilverMat: MeshStandardMaterial;
  readonly shoeDarkMat: MeshStandardMaterial;
  readonly nurseWhiteMat: MeshStandardMaterial;
  readonly nurseLongyiMat: MeshStandardMaterial;
  readonly redCrossMat: MeshStandardMaterial;
  readonly medBagMat: MeshStandardMaterial;
  readonly chinTopMats: readonly MeshStandardMaterial[];
  readonly chinWeaveMats: readonly MeshStandardMaterial[];
  readonly chinGoldSashMat: MeshStandardMaterial;
  readonly chinHeadbandMat: MeshStandardMaterial;
  readonly textures: readonly CanvasTexture[];
}

let singletonVillagerCache: WeipulaVillagerCache | null = null;

export function getWeipulaVillagerCache(): WeipulaVillagerCache {
  if (singletonVillagerCache) return singletonVillagerCache;

  const texDefs: [string, string, string, string][] = [
    ['#18181b', '#9f1d28', '#facc15', '#f8fafc'], // Classic Chin Black-Crimson-Gold
    ['#1e3a5f', '#b91c1c', '#fde047', '#e2e8f0'], // Chin Indigo-Red-Gold
    ['#14532d', '#991b1b', '#facc15', '#fef3c7'], // Chin Emerald-Crimson-Gold
    ['#6b1623', '#111827', '#f59e0b', '#f8fafc'], // Chin Ceremonial Maroon-Black-Amber
  ];
  const textures: CanvasTexture[] = [];
  const chinWeaveMats = texDefs.map(([base, stripe, diamond, accent]) => {
    const tex = createChinWovenTexture(base, stripe, diamond, accent);
    if (tex) textures.push(tex);
    return new MeshStandardMaterial({
      color: tex ? '#ffffff' : stripe,
      map: tex ?? undefined,
      roughness: 0.84,
    });
  });

  const chinTopColors = ['#991b1b', '#1e293b', '#166534', '#7f1d1d'];
  const chinTopMats = chinTopColors.map(
    color => new MeshStandardMaterial({ color, roughness: 0.8 }),
  );

  const skinMats = ['#e0b08b', '#d49e76', '#e8be9c'].map(
    color => new MeshStandardMaterial({ color, roughness: 0.72 }),
  );

  singletonVillagerCache = Object.freeze({
    id: 'weipula-villager-singleton-cache',
    headGeo: npcHeadGeometry,
    hairCapGeo: npcCroppedHairGeometry,
    hairBunGeo: new SphereGeometry(0.068, 8, 6),
    neckGeo: new CylinderGeometry(0.055, 0.062, 0.09, 8),
    torsoGeo: new CylinderGeometry(0.18, 0.16, 0.5, 10),
    longyiGeo: new CylinderGeometry(0.165, 0.195, 0.72, 10),
    armGeo: npcSleeveGeometry,
    legGeo: npcLowerLegGeometry,
    shoeGeo: npcShoeGeometry,
    sashGeo: new BoxGeometry(0.075, 0.52, 0.34),
    nurseCapGeo: new BoxGeometry(0.24, 0.095, 0.12),
    crossHGeo: new BoxGeometry(0.068, 0.02, 0.016),
    crossVGeo: new BoxGeometry(0.02, 0.068, 0.016),
    medBagGeo: new BoxGeometry(0.12, 0.18, 0.24),
    chinHeadbandGeo: new TorusGeometry(0.155, 0.024, 6, 14),

    skinMats,
    hairDarkMat: new MeshStandardMaterial({ color: '#1b1817', roughness: 0.85 }),
    hairSilverMat: new MeshStandardMaterial({ color: '#c4c7cc', roughness: 0.8 }),
    shoeDarkMat: new MeshStandardMaterial({ color: '#2b221e', roughness: 0.9 }),
    nurseWhiteMat: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.55 }),
    nurseLongyiMat: new MeshStandardMaterial({ color: '#b91c1c', roughness: 0.72 }),
    redCrossMat: new MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 }),
    medBagMat: new MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.5 }),
    chinTopMats,
    chinWeaveMats,
    chinGoldSashMat: new MeshStandardMaterial({ color: '#e11d48', roughness: 0.72 }),
    chinHeadbandMat: new MeshStandardMaterial({ color: '#facc15', roughness: 0.55 }),
    textures,
  });

  return singletonVillagerCache;
}

export function disposeWeipulaVillagerCache(): void {
  if (!singletonVillagerCache) return;
  const c = singletonVillagerCache;
  singletonVillagerCache = null;
  c.hairBunGeo.dispose();
  c.neckGeo.dispose();
  c.torsoGeo.dispose();
  c.longyiGeo.dispose();
  c.sashGeo.dispose();
  c.nurseCapGeo.dispose();
  c.crossHGeo.dispose();
  c.crossVGeo.dispose();
  c.medBagGeo.dispose();
  c.chinHeadbandGeo.dispose();
  c.skinMats.forEach(m => m.dispose());
  c.hairDarkMat.dispose();
  c.hairSilverMat.dispose();
  c.shoeDarkMat.dispose();
  c.nurseWhiteMat.dispose();
  c.nurseLongyiMat.dispose();
  c.redCrossMat.dispose();
  c.medBagMat.dispose();
  c.chinTopMats.forEach(m => m.dispose());
  c.chinWeaveMats.forEach(m => m.dispose());
  c.chinGoldSashMat.dispose();
  c.chinHeadbandMat.dispose();
  c.textures.forEach(t => t.dispose());
}
