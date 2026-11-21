import { angle, toWorld } from '../data/ward.ts';

/**
 * ============================================================================
 * Multi-Classroom Walk-In Village Schools — Single Source of Truth
 * ============================================================================
 *
 * Unifies:
 * 1. Exact partitioned multi-classroom architectural layouts (`computeClassroomLayout`),
 * 2. Walk-in wall & open-doorway collision (`canStandWalkInSchoolHalls` + `WALKIN_SCHOOL_HALL_IDS`),
 * 3. Per-classroom interior teacher/student zones (`getHallClassroomZones`) for
 *    50–100 students & teachers per school via the Singleton + Fixed Object Pool.
 */

export type VerandaSide = '+z' | '-z' | '+x' | '-x';

export interface SchoolHallSpec {
  readonly id: string;
  readonly regionId: string;
  readonly schoolZoneId: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly rotation: number;
  readonly wallColor: string;
  readonly roofColor: string;
  /** Which local side has the open veranda & classroom doorways */
  readonly verandaSide: VerandaSide;
  /** Ordered distinct separated classroom labels (e.g. ['KG', 'G-1', 'G-2', 'G-3']) */
  readonly rooms: readonly string[];
  readonly storeys?: 1 | 2;
}

export interface SeparatedClassroomSlot {
  readonly index: number;
  readonly label: string;
  readonly xMin: number;
  readonly xMax: number;
  readonly cx: number;
  readonly roomWidth: number;
  readonly doorX: number;
  readonly doorWidth: number;
  readonly windowX: number;
  readonly windowWidth: number;
}

export interface CanonicalWallBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface ClassroomHallLayout {
  readonly hallLength: number;
  readonly hallDepth: number;
  readonly canonicalRotation: number;
  readonly floorY: number;
  readonly wallHeight: number;
  readonly verandaDepth: number;
  readonly zBack: number;
  readonly zFrontWall: number;
  readonly zVerandaEdge: number;
  readonly wallThickness: number;
  readonly classrooms: readonly SeparatedClassroomSlot[];
  readonly wallObstacles: readonly CanonicalWallBox[];
}

export interface ClassroomNpcSpawnRect {
  readonly roomLabel: string;
  readonly roleKind: 'teacher' | 'student' | 'corridor';
  readonly centerX: number;
  readonly centerZ: number;
  readonly rotation: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly worldY: number;
  readonly facingYaw: number;
}

export const SCHOOL_FLOOR_Y = 0.28;
const WALL_THICKNESS = 0.22;

/**
 * Normalizes any building orientation + verandaSide into a canonical frame where:
 * - `+Z` is the open front veranda / corridor with classroom doors
 * - `-Z` is the rear exterior wall (with windows)
 * - `X` runs along the row of separated classrooms (`-hallLength/2 .. +hallLength/2`)
 */
export function computeClassroomLayout(spec: SchoolHallSpec): ClassroomHallLayout {
  let hallLength = spec.width;
  let hallDepth = spec.depth;
  let rotOffset = 0;

  if (spec.verandaSide === '+z') {
    hallLength = spec.width;
    hallDepth = spec.depth;
    rotOffset = 0;
  } else if (spec.verandaSide === '-z') {
    hallLength = spec.width;
    hallDepth = spec.depth;
    rotOffset = Math.PI;
  } else if (spec.verandaSide === '+x') {
    hallLength = spec.depth;
    hallDepth = spec.width;
    rotOffset = Math.PI / 2;
  } else {
    // '-x'
    hallLength = spec.depth;
    hallDepth = spec.width;
    rotOffset = -Math.PI / 2;
  }

  const canonicalRotation = spec.rotation + rotOffset;
  const verandaDepth = Math.min(2.3, Math.max(1.6, hallDepth * 0.22));
  const zBack = -hallDepth / 2 + WALL_THICKNESS / 2;
  const zVerandaEdge = hallDepth / 2;
  const zFrontWall = zVerandaEdge - verandaDepth;
  const wallHeight = Math.max(3.4, Math.min(4.2, spec.storeys === 2 ? 3.8 : spec.height * 0.62));

  const roomCount = Math.max(1, spec.rooms.length);
  const innerSpan = hallLength - WALL_THICKNESS * 2;
  const roomWidth = innerSpan / roomCount;

  const classrooms: SeparatedClassroomSlot[] = [];
  const wallObstacles: CanonicalWallBox[] = [];
  const halfT = WALL_THICKNESS / 2;

  // 1. Rear exterior wall (solid)
  wallObstacles.push({
    minX: -hallLength / 2,
    maxX: hallLength / 2,
    minZ: zBack - halfT,
    maxZ: zBack + halfT,
  });

  // 2. Left & Right exterior end walls (from rear wall to front corridor wall)
  wallObstacles.push({
    minX: -hallLength / 2,
    maxX: -hallLength / 2 + WALL_THICKNESS,
    minZ: zBack,
    maxZ: zFrontWall + halfT,
  });
  wallObstacles.push({
    minX: hallLength / 2 - WALL_THICKNESS,
    maxX: hallLength / 2,
    minZ: zBack,
    maxZ: zFrontWall + halfT,
  });

  for (let i = 0; i < roomCount; i++) {
    const xMin = -hallLength / 2 + WALL_THICKNESS + i * roomWidth;
    const xMax = xMin + roomWidth;
    const cx = (xMin + xMax) / 2;

    // Wide walk-in open doorway (1.75m, clamped for narrower rooms)
    const doorWidth = Math.min(1.8, Math.max(1.35, roomWidth * 0.28));
    const doorX = roomWidth >= 5.2 ? xMin + doorWidth / 2 + 0.55 : cx;
    const doorMinX = doorX - doorWidth / 2;
    const doorMaxX = doorX + doorWidth / 2;

    const rightWallSpan = xMax - doorMaxX;
    const windowWidth = Math.max(0, Math.min(2.6, rightWallSpan - 0.7));
    const windowX = doorMaxX + rightWallSpan / 2;

    classrooms.push({
      index: i,
      label: spec.rooms[i],
      xMin,
      xMax,
      cx,
      roomWidth,
      doorX,
      doorWidth,
      windowX,
      windowWidth,
    });

    // Interior partition wall separating classroom i from classroom i+1
    if (i < roomCount - 1) {
      wallObstacles.push({
        minX: xMax - halfT,
        maxX: xMax + halfT,
        minZ: zBack,
        maxZ: zFrontWall + halfT,
      });
    }

    // Front corridor wall segments leaving the open classroom doorway clear for walking in!
    if (doorMinX - xMin > 0.12) {
      wallObstacles.push({
        minX: xMin,
        maxX: doorMinX,
        minZ: zFrontWall - halfT,
        maxZ: zFrontWall + halfT,
      });
    }
    if (xMax - doorMaxX > 0.12) {
      wallObstacles.push({
        minX: doorMaxX,
        maxX: xMax,
        minZ: zFrontWall - halfT,
        maxZ: zFrontWall + halfT,
      });
    }
  }

  return {
    hallLength,
    hallDepth,
    canonicalRotation,
    floorY: SCHOOL_FLOOR_Y,
    wallHeight,
    verandaDepth,
    zBack,
    zFrontWall,
    zVerandaEdge,
    wallThickness: WALL_THICKNESS,
    classrooms,
    wallObstacles,
  };
}

/**
 * Generates exact interior teacher + student + corridor zones for a walk-in school hall
 * so teachers stand by each separated classroom's green blackboard and students fill every room!
 */
export function getHallClassroomZones(spec: SchoolHallSpec): ClassroomNpcSpawnRect[] {
  const layout = computeClassroomLayout(spec);
  const zones: ClassroomNpcSpawnRect[] = [];
  const roomDepth = layout.zFrontWall - layout.zBack;

  for (const room of layout.classrooms) {
    // Teacher zone near the green blackboard (back-left / rear wall facing students toward +Z)
    zones.push({
      roomLabel: room.label,
      roleKind: 'teacher',
      centerX: spec.x,
      centerZ: spec.z,
      rotation: layout.canonicalRotation,
      minX: room.cx - Math.min(1.2, room.roomWidth * 0.25),
      maxX: room.cx + Math.min(1.2, room.roomWidth * 0.25),
      minZ: layout.zBack + 0.65,
      maxZ: layout.zBack + Math.min(1.65, roomDepth * 0.26),
      worldY: layout.floorY,
      facingYaw: layout.canonicalRotation,
    });

    // Student classroom zone inside the separated room (facing the blackboard at -Z)
    zones.push({
      roomLabel: room.label,
      roleKind: 'student',
      centerX: spec.x,
      centerZ: spec.z,
      rotation: layout.canonicalRotation,
      minX: room.xMin + 0.65,
      maxX: room.xMax - 0.65,
      minZ: layout.zBack + Math.min(2.15, roomDepth * 0.34),
      maxZ: layout.zFrontWall - 0.75,
      worldY: layout.floorY,
      facingYaw: layout.canonicalRotation + Math.PI,
    });
  }

  // Open front veranda / corridor where students & teachers walk between separated classrooms
  zones.push({
    roomLabel: 'Corridor',
    roleKind: 'corridor',
    centerX: spec.x,
    centerZ: spec.z,
    rotation: layout.canonicalRotation,
    minX: -layout.hallLength / 2 + 1.0,
    maxX: layout.hallLength / 2 - 1.0,
    minZ: layout.zFrontWall + 0.55,
    maxZ: layout.zVerandaEdge - 0.55,
    worldY: layout.floorY,
    facingYaw: layout.canonicalRotation,
  });

  return zones;
}

function hallFromUV(
  spec: Omit<SchoolHallSpec, 'x' | 'z' | 'rotation'> & {
    u: number;
    v: number;
    rotation?: number;
  },
): SchoolHallSpec {
  const w = toWorld(spec.u, spec.v);
  return {
    id: spec.id,
    regionId: spec.regionId,
    schoolZoneId: spec.schoolZoneId,
    name: spec.name,
    x: Number(w.x.toFixed(3)),
    z: Number(w.z.toFixed(3)),
    width: spec.width,
    depth: spec.depth,
    height: spec.height,
    rotation: spec.rotation ?? angle,
    wallColor: spec.wallColor,
    roofColor: spec.roofColor,
    verandaSide: spec.verandaSide,
    rooms: spec.rooms,
    storeys: spec.storeys,
  };
}

const htaukKyantSchoolRot = angle + Math.PI / 2;

// Kanbale school anchor & rotation
const KANBALE_SCHOOL_X = 451.73;
const KANBALE_SCHOOL_Z = -569.03;
const KANBALE_SCHOOL_ROT = 2.4226;
function kanbaleHallFromLocal(
  localX: number,
  localZ: number,
  spec: Omit<SchoolHallSpec, 'x' | 'z' | 'rotation' | 'regionId' | 'schoolZoneId'>,
): SchoolHallSpec {
  const c = Math.cos(KANBALE_SCHOOL_ROT);
  const s = Math.sin(KANBALE_SCHOOL_ROT);
  return {
    ...spec,
    regionId: 'kanbale',
    schoolZoneId: 'school-kanbale',
    x: Number((KANBALE_SCHOOL_X + localX * c + localZ * s).toFixed(3)),
    z: Number((KANBALE_SCHOOL_Z - localX * s + localZ * c).toFixed(3)),
    rotation: KANBALE_SCHOOL_ROT,
  };
}

/**
 * ALL Walk-In Multi-Classroom School Halls across every school village.
 * Each major village school campus is scaled to ~20+ house footprints (~975–2,000+ m²)
 * with 12–22 distinct separated classrooms aligned cleanly to village roads & houses.
 */
export const WALKIN_SCHOOL_HALLS: readonly SchoolHallSpec[] = [
  // =========================================================================
  // 1. ကြာအင်းချင်းရွာ — အလက ကြာအင်း (6 halls, 1,932 m² ≈ 40 houses, 22 separated rooms)
  // =========================================================================
  hallFromUV({
    id: 'ki-school-office',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း ရုံးခန်းဆောင်',
    u: 25,
    v: 3824,
    width: 14,
    depth: 10.5,
    height: 5.5,
    wallColor: '#dad3c2',
    roofColor: '#984a3b',
    verandaSide: '+z',
    rooms: ['ရုံးခန်း', 'ဆရာခန်း'],
  }),
  hallFromUV({
    id: 'ki-school-north-hall-1',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း မြောက်ဘက်ဆောင် ၁',
    u: 52,
    v: 3824,
    width: 34,
    depth: 10.5,
    height: 6.5,
    wallColor: '#e4decb',
    roofColor: '#7fa2b2',
    verandaSide: '+z',
    rooms: ['KG', 'G-1', 'G-2', 'G-3'],
  }),
  hallFromUV({
    id: 'ki-school-north-hall-2',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း မြောက်ဘက်ဆောင် ၂',
    u: 89,
    v: 3824,
    width: 34,
    depth: 10.5,
    height: 6.5,
    wallColor: '#e4decb',
    roofColor: '#7fa2b2',
    verandaSide: '+z',
    rooms: ['G-4', 'G-5', 'G-6', 'G-7'],
  }),
  hallFromUV({
    id: 'ki-school-east-hall',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း အရှေ့ဘက် ပင်မဆောင်',
    u: 116,
    v: 3851,
    width: 10.5,
    depth: 38,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#963e32',
    verandaSide: '-x',
    rooms: ['G-8A', 'G-8B', 'G-9A', 'G-9B', 'စာကြည့်တိုက်'],
  }),
  hallFromUV({
    id: 'ki-school-east-wing',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း အရှေ့တောင်ဆောင်',
    u: 116,
    v: 3882,
    width: 10.5,
    depth: 20,
    height: 6,
    wallColor: '#e5dfd2',
    roofColor: '#963e32',
    verandaSide: '-x',
    rooms: ['သိပ္ပံခန်း', 'ခန်းမ'],
  }),
  hallFromUV({
    id: 'ki-school-south-hall',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း တောင်ဘက် စာသင်ဆောင်',
    u: 62,
    v: 3876,
    width: 44,
    depth: 10.5,
    height: 6.5,
    wallColor: '#e4decb',
    roofColor: '#2f6a4f',
    verandaSide: '-z',
    rooms: ['G-10A', 'G-10B', 'G-11A', 'G-11B', 'ကွန်ပျူတာ'],
  }),

  // =========================================================================
  // 2. ထောက်ကြန့်ရွာ — အထက ထောက်ကြန့် (6 halls, 1,979 m² ≈ 40 houses, 22 separated rooms)
  // =========================================================================
  hallFromUV({
    id: 'hk-landmark-school-main',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် ပင်မကျောင်းဆောင်ကြီး',
    u: -106,
    v: 3280,
    width: 44,
    depth: 13,
    height: 8.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#e2dbcc',
    roofColor: '#9e4536',
    verandaSide: '+z',
    rooms: ['ရုံးခန်း', 'G-10A', 'G-10B', 'G-11A', 'G-11B', 'G-12'],
    storeys: 2,
  }),
  hallFromUV({
    id: 'hk-school-west-wing',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် မြောက်ဘက် စာသင်ဆောင်',
    u: -78,
    v: 3253,
    width: 10,
    depth: 36,
    height: 6.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#ded8c8',
    roofColor: '#9a4838',
    verandaSide: '+x',
    rooms: ['KG', 'G-1', 'G-2', 'G-3', 'G-4'],
  }),
  hallFromUV({
    id: 'hk-school-east-wing',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် တောင်ဘက် စာသင်ဆောင်',
    u: -78,
    v: 3307,
    width: 10,
    depth: 36,
    height: 6.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#ded8c8',
    roofColor: '#9c4939',
    verandaSide: '-x',
    rooms: ['G-5', 'G-6', 'G-7', 'G-8A', 'G-8B'],
  }),
  hallFromUV({
    id: 'hk-landmark-school-wing',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် စာသင်ဆောင်ရှည်',
    u: -78,
    v: 3326,
    width: 10,
    depth: 38,
    height: 6.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#e5dfd2',
    roofColor: '#7fa2b0',
    verandaSide: '-x',
    rooms: ['G-9A', 'G-9B', 'စာကြည့်တိုက်', 'ခန်းမ'],
  }),
  hallFromUV({
    id: 'hk-school-east-annex',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် အရှေ့ဘက် အဆောင်',
    u: -40,
    v: 3318,
    width: 8,
    depth: 26,
    height: 5.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#ded8c8',
    roofColor: '#9a4838',
    verandaSide: '-x',
    rooms: ['ကွန်ပျူတာ', 'အနုပညာ', 'ဆရာခန်း'],
  }),
  hallFromUV({
    id: 'hk-school-lab-building',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် သိပ္ပံလက်တွေ့ဆောင်',
    u: -108,
    v: 3244,
    width: 11,
    depth: 9,
    height: 5.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#ded8c8',
    roofColor: '#96a2aa',
    verandaSide: '+z',
    rooms: ['ဓာတုဗေဒ', 'ရူပဗေဒ'],
  }),

  // =========================================================================
  // 3. ထိုမာရွာ — အထက-ထိုမာ (4 halls, 1,360 m² ≈ 28 houses, 16 separated rooms)
  // =========================================================================
  hallFromUV({
    id: 'htomar-campus-behs-main',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-behs',
    name: 'အထက-ထိုမာ · မြောက်ဘက် ပင်မစာသင်ဆောင်',
    u: 361,
    v: 1808,
    width: 34,
    depth: 10,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#2f6a4f',
    verandaSide: '+z',
    rooms: ['ရုံးခန်း', 'KG', 'G-1', 'G-2'],
  }),
  hallFromUV({
    id: 'htomar-campus-behs-east',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-behs',
    name: 'အထက-ထိုမာ · အရှေ့မြောက် စာသင်ဆောင်',
    u: 403,
    v: 1808,
    width: 34,
    depth: 10,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#2f6a4f',
    verandaSide: '+z',
    rooms: ['G-3', 'G-4', 'G-5', 'G-6'],
  }),
  hallFromUV({
    id: 'htomar-campus-behs-south',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-behs',
    name: 'အထက-ထိုမာ · တောင်ဘက် စာသင်ဆောင်',
    u: 361,
    v: 1852,
    width: 34,
    depth: 10,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#964638',
    verandaSide: '-z',
    rooms: ['G-7', 'G-8', 'G-9', 'G-10'],
  }),
  hallFromUV({
    id: 'htomar-campus-behs-lab',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-behs',
    name: 'အထက-ထိုမာ · အရှေ့တောင် အထက်တန်းဆောင်',
    u: 403,
    v: 1852,
    width: 34,
    depth: 10,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#964638',
    verandaSide: '-z',
    rooms: ['G-11', 'G-12', 'သိပ္ပံခန်း', 'စာကြည့်တိုက်'],
  }),

  // =========================================================================
  // 4. ထိုမာရွာ — GTHS (Khamtee) & Technological University, Kalay Main Classroom Halls
  // =========================================================================
  hallFromUV({
    id: 'htomar-campus-gths-main',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-gths',
    name: 'GTHS (Khamtee) · ပင်မစာသင်ဆောင်',
    u: -94,
    v: 1742,
    width: 26,
    depth: 11,
    height: 7.4,
    wallColor: '#e7d7b4',
    roofColor: '#8b5545',
    verandaSide: '-z',
    rooms: ['Civil-1', 'EC-1', 'EP-1', 'Mech-1'],
    storeys: 2,
  }),
  hallFromUV({
    id: 'htomar-campus-gths-west-1',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-gths',
    name: 'GTHS (Khamtee) · အနောက်မြောက် စာသင်ဆောင်',
    u: -154,
    v: 1676,
    width: 28,
    depth: 10,
    height: 6.8,
    wallColor: '#dde5dc',
    roofColor: '#6d9178',
    verandaSide: '+z',
    rooms: ['Lab-A', 'Lab-B', 'IT-1', 'IT-2'],
  }),
  hallFromUV({
    id: 'htomar-campus-gths-west-2',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-gths',
    name: 'GTHS (Khamtee) · အနောက်တောင် စာသင်ဆောင်',
    u: -154,
    v: 1742,
    width: 28,
    depth: 10,
    height: 6.8,
    wallColor: '#dde5dc',
    roofColor: '#6d9178',
    verandaSide: '-z',
    rooms: ['Civil-2', 'EC-2', 'EP-2', 'Mech-2'],
  }),
  hallFromUV({
    id: 'htomar-campus-tu-north-wing',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-tu-kalay',
    name: 'Technological University, Kalay · မြောက်ဘက် ဘေးဆောင်ရှည်',
    u: -196,
    v: 1796,
    width: 48,
    depth: 11,
    height: 7.4,
    wallColor: '#e8d8b8',
    roofColor: '#bc4b3c',
    verandaSide: '+z',
    rooms: ['Civil', 'Mech', 'EP', 'EC', 'IT', 'Arch'],
    storeys: 2,
  }),
  hallFromUV({
    id: 'htomar-campus-tu-south-wing',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-tu-kalay',
    name: 'Technological University, Kalay · တောင်ဘက် ဘေးဆောင်ရှည်',
    u: -196,
    v: 1864,
    width: 48,
    depth: 11,
    height: 7.4,
    wallColor: '#e8d8b8',
    roofColor: '#bc4b3c',
    verandaSide: '-z',
    rooms: ['Math', 'Phys', 'Chem', 'Eng', 'Myan', 'Lab'],
    storeys: 2,
  }),

  // =========================================================================
  // 5. ကံပုလဲရွာ — ကံပုလဲ အခြေခံပညာကျောင်း (3 large halls, ~992 m² ≈ 20.3 houses, 13 rooms)
  // =========================================================================
  kanbaleHallFromLocal(2.5, 1.5, {
    id: 'kanbale-school-main-hall',
    name: 'ကံပုလဲကျောင်း · ပင်မစာသင်ဆောင်ကြီး',
    width: 34,
    depth: 10.5,
    height: 8.0,
    wallColor: '#f8fafc',
    roofColor: '#1b4332',
    verandaSide: '-z',
    rooms: ['ရုံးခန်း', 'KG', 'G-1', 'G-2', 'G-3'],
    storeys: 2,
  }),
  kanbaleHallFromLocal(-10.5, -15.5, {
    id: 'kanbale-school-left-wing',
    name: 'ကံပုလဲကျောင်း · လက်ဝဲဘက် စာသင်ဆောင်',
    width: 9.5,
    depth: 24,
    height: 5.8,
    wallColor: '#f8fafc',
    roofColor: '#1b4332',
    verandaSide: '+x',
    rooms: ['G-4', 'G-5', 'G-6', 'G-7'],
  }),
  kanbaleHallFromLocal(15.5, -15.5, {
    id: 'kanbale-school-right-wing',
    name: 'ကံပုလဲကျောင်း · လက်ယာဘက် စာသင်ဆောင်',
    width: 9.5,
    depth: 24,
    height: 5.8,
    wallColor: '#f8fafc',
    roofColor: '#1b4332',
    verandaSide: '-x',
    rooms: ['G-8', 'G-9', 'G-10', 'သိပ္ပံခန်း'],
  }),

  // =========================================================================
  // 6. နတ်မြောင်းရွာ — အမက နတ်မြောင်း & အထက နတ်မြောင်း (Walk-in separated classrooms)
  // =========================================================================
  {
    id: 'natmyaung-primary-school',
    regionId: 'natmyaung',
    schoolZoneId: 'school-natmyaung-primary',
    name: 'နတ်မြောင်း အခြေခံပညာ မူလတန်းကျောင်း',
    x: 3017.22,
    z: 2915.4,
    width: 18,
    depth: 9.5,
    height: 5.6,
    rotation: 0.7853981633974483,
    wallColor: '#f0ede1',
    roofColor: '#8b3a2b',
    verandaSide: '+z',
    rooms: ['KG', 'G-1', 'G-2', 'G-3'],
  },
  {
    id: 'natmyaung-high-school',
    regionId: 'natmyaung',
    schoolZoneId: 'school-natmyaung-high',
    name: 'အထက-နတ်မြောင်း (အခြေခံပညာ အထက်တန်းကျောင်း)',
    x: 2940.15,
    z: 2959.95,
    width: 24,
    depth: 10.5,
    height: 7.4,
    rotation: 0.7853981633974483,
    wallColor: '#f5f2eb',
    roofColor: '#2d5475',
    verandaSide: '+z',
    rooms: ['G-6', 'G-7', 'G-8', 'G-9', 'G-10'],
    storeys: 2,
  },
];

export const WALKIN_SCHOOL_HALL_BY_ID: ReadonlyMap<string, SchoolHallSpec> = new Map(
  WALKIN_SCHOOL_HALLS.map(h => [h.id, h]),
);

export const WALKIN_SCHOOL_HALL_IDS: ReadonlySet<string> = new Set(
  WALKIN_SCHOOL_HALLS.map(h => h.id),
);

interface PreparedHallCollider {
  readonly spec: SchoolHallSpec;
  readonly layout: ClassroomHallLayout;
  readonly cosR: number;
  readonly sinR: number;
  readonly boundR: number;
}

const PREPARED_HALL_COLLIDERS: readonly PreparedHallCollider[] = WALKIN_SCHOOL_HALLS.map(spec => {
  const layout = computeClassroomLayout(spec);
  return {
    spec,
    layout,
    cosR: Math.cos(layout.canonicalRotation),
    sinR: Math.sin(layout.canonicalRotation),
    boundR: Math.hypot(layout.hallLength / 2, layout.hallDepth / 2) + 1.5,
  };
});

/**
 * Exact walk-in wall & doorway collision check for ALL multi-classroom school halls.
 * Allows walking up onto the open veranda and straight through every classroom's open
 * doorway (`1.8m`) into each separated classroom, while blocking exterior & partition walls.
 */
export function canStandWalkInSchoolHalls(x: number, z: number, playerRadius = 0.4): boolean {
  for (let i = 0; i < PREPARED_HALL_COLLIDERS.length; i++) {
    const entry = PREPARED_HALL_COLLIDERS[i];
    const dx = x - entry.spec.x;
    const dz = z - entry.spec.z;
    if (dx * dx + dz * dz > entry.boundR * entry.boundR) continue;

    const lx = dx * entry.cosR - dz * entry.sinR;
    const lz = dx * entry.sinR + dz * entry.cosR;
    const obstacles = entry.layout.wallObstacles;
    for (let j = 0; j < obstacles.length; j++) {
      const obs = obstacles[j];
      const nx = Math.max(obs.minX, Math.min(lx, obs.maxX));
      const nz = Math.max(obs.minZ, Math.min(lz, obs.maxZ));
      const ddx = lx - nx;
      const ddz = lz - nz;
      if (ddx * ddx + ddz * ddz < playerRadius * playerRadius) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Returns total walk-in classroom building area (m²) & separated classroom count for a given school zone.
 */
export function getSchoolCampusMetrics(schoolZoneId: string): {
  hallCount: number;
  roomCount: number;
  floorAreaSqM: number;
  houseEquivalents: number;
} {
  const halls = WALKIN_SCHOOL_HALLS.filter(h => h.schoolZoneId === schoolZoneId);
  let roomCount = 0;
  let floorAreaSqM = 0;
  for (const h of halls) {
    roomCount += h.rooms.length;
    floorAreaSqM += h.width * h.depth * (h.storeys === 2 ? 1.5 : 1);
  }
  return {
    hallCount: halls.length,
    roomCount,
    floorAreaSqM: Math.round(floorAreaSqM),
    houseEquivalents: Number((floorAreaSqM / 48.75).toFixed(1)),
  };
}
