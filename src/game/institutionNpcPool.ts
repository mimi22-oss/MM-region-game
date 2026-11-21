import { angle, toWorld } from '../data/ward.ts';
import type { TimeMode } from './environmentTime.ts';
import { resolveTimePeriod } from './villageCrowd.ts';
import {
  WALKIN_SCHOOL_HALLS,
  getHallClassroomZones,
  type ClassroomNpcSpawnRect,
} from './schoolClassrooms.ts';

/**
 * ============================================================================
 * Christian Church Clergy & Village School Students/Teachers Pool Engine
 * (Singleton Memory Reference Cache + Fixed Object Pool)
 * ============================================================================
 *
 * Pure TypeScript simulation layer covering:
 * - ALL 8 Christian churches across Tharyargone, Kyar Inn, and Si Thar:
 *   Catholic Priests (`ဖာသာ/ဆရာတော်`), Catholic Sisters (`မာသာ/ဆရာတော်မ`),
 *   and Protestant Pastors & Lady Pastors (`သင်းအုပ်ဆရာတော် / ဆရာတော်မ`).
 * - ALL 8 Village Schools across Kanbale, Htomar, Htauk Kyant, Kyar Inn, and Nat Myaung:
 *   Myanmar School Teachers (`ဆရာ / ဆရာမ`) & Students (`ကျောင်းသား / ကျောင်းသူ`)
 *   in crisp white-and-green uniforms (`အဖြူ + အစိမ်း`).
 * - Time-of-day schedule:
 *   - Schools (`isSchoolOpenHours`): VISIBLE & active during `morning` & `day`;
 *     strictly HIDDEN during `evening` & `night`!
 *   - Churches (`isChurchServiceHours`): VISIBLE during `morning`, `day`, & `evening`;
 *     quiet/hidden at `night`.
 */

export type InstitutionKind = 'church' | 'school';

export type InstitutionNpcRole =
  | 'catholic-priest'
  | 'catholic-sister'
  | 'pastor-man'
  | 'pastor-woman'
  | 'teacher-man'
  | 'teacher-woman'
  | 'student-boy'
  | 'student-girl';

export interface InstitutionWalkRect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const SCHOOL_MIN_STUDENTS = 50;
export const SCHOOL_MAX_STUDENTS = 100;

export interface InstitutionZoneSpec {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly kind: InstitutionKind;
  readonly denomination?: 'catholic' | 'protestant';
  /** Anchor center in world XZ */
  readonly centerX: number;
  readonly centerZ: number;
  /** Local walk coordinate frame rotation (default = `angle`) */
  readonly rotation: number;
  /** Non-clipping open yard/plaza rectangles in local rotated coordinates around (centerX, centerZ) */
  readonly walkRects: readonly InstitutionWalkRect[];
  /** Total count for churches; for schools = studentCount + teacherCount */
  readonly count: number;
  /** For schools: explicit teacher count (paired with 50..100 students) */
  readonly teacherCount?: number;
}

/** True ONLY during morning & daytime; returns false in evening and night so school NPCs hide. */
export function isSchoolOpenHours(minute: number, timeMode?: TimeMode): boolean {
  const period = resolveTimePeriod(minute, timeMode);
  return period === 'morning' || period === 'day';
}

/** True during morning, daytime, and evening service hours; quiet at night. */
export function isChurchServiceHours(minute: number, timeMode?: TimeMode): boolean {
  const period = resolveTimePeriod(minute, timeMode);
  return period === 'morning' || period === 'day' || period === 'evening';
}

function zoneFromUV(
  spec: Omit<InstitutionZoneSpec, 'centerX' | 'centerZ' | 'rotation'> & {
    u: number;
    v: number;
    rotation?: number;
  },
): InstitutionZoneSpec {
  const w = toWorld(spec.u, spec.v);
  return {
    id: spec.id,
    regionId: spec.regionId,
    name: spec.name,
    kind: spec.kind,
    denomination: spec.denomination,
    centerX: Number(w.x.toFixed(3)),
    centerZ: Number(w.z.toFixed(3)),
    rotation: spec.rotation ?? angle,
    walkRects: spec.walkRects,
    count: spec.count,
    teacherCount: spec.teacherCount,
  };
}

/**
 * All 8 Christian Churches across the entire map.
 * Walk rects are placed strictly on open church plazas / courtyards clear of sanctuary walls.
 */
export const CHURCH_INSTITUTION_ZONES: readonly InstitutionZoneSpec[] = [
  // 1. Tharyargone — St. Assumption Catholic Church (sanctuary 12x17 at (-147,2718), tower at (-147,2708))
  zoneFromUV({
    id: 'church-tharyargone-st-assumption',
    regionId: 'tharyargone',
    name: 'စိန့်အဆမ်းရှင်း ကာသိုလိတ် ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'catholic',
    u: -147,
    v: 2716,
    walkRects: [
      { minX: 7.5, maxX: 14.5, minZ: -9.5, maxZ: 9.5 },
      { minX: -14.5, maxX: -7.5, minZ: -9.5, maxZ: 9.5 },
      { minX: -12, maxX: 12, minZ: -13.5, maxZ: -11.2 },
    ],
    count: 6,
  }),
  // 2. Tharyargone — Kingdom Hall (14x12 at (-235, 2716), yard 22x18)
  zoneFromUV({
    id: 'church-tharyargone-kingdom-hall',
    regionId: 'tharyargone',
    name: 'Kingdom Hall · သာယာကုန်း',
    kind: 'church',
    denomination: 'protestant',
    u: -235,
    v: 2716,
    walkRects: [
      { minX: 7.8, maxX: 10.6, minZ: -7.5, maxZ: 7.5 },
      { minX: -10.5, maxX: 10.5, minZ: -9.2, maxZ: -6.8 },
    ],
    count: 4,
  }),
  // 3. Kyar Inn — Kyarinn Baptist Church (22x16 at (-60, 3745))
  zoneFromUV({
    id: 'church-kyarinn-baptist',
    regionId: 'kyarinn',
    name: 'ကြာအင်း နှစ်ခြင်းအသင်းတော် ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'protestant',
    u: -60,
    v: 3745,
    walkRects: [
      { minX: -16.5, maxX: -12.4, minZ: -8.0, maxZ: 8.0 },
      { minX: -11, maxX: 11, minZ: 9.5, maxZ: 12.5 },
    ],
    count: 5,
  }),
  // 4. Kyar Inn — IBC Kyarinn (20x14 at (-76, 3920))
  zoneFromUV({
    id: 'church-kyarinn-ibc',
    regionId: 'kyarinn',
    name: 'IBC ကြာအင်း ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'protestant',
    u: -76,
    v: 3920,
    walkRects: [
      { minX: -15.5, maxX: -11.4, minZ: -7.0, maxZ: 7.0 },
      { minX: -10, maxX: 10, minZ: 8.4, maxZ: 11.4 },
    ],
    count: 5,
  }),
  // 5. Kyar Inn — CJC Church Kyar Inn (18x14 at (-146, 3890))
  zoneFromUV({
    id: 'church-kyarinn-cjc',
    regionId: 'kyarinn',
    name: 'CJC ကြာအင်း ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'protestant',
    u: -146,
    v: 3890,
    walkRects: [
      { minX: -14.5, maxX: -10.4, minZ: -7.0, maxZ: 7.0 },
      { minX: -9, maxX: 9, minZ: 8.4, maxZ: 11.2 },
    ],
    count: 4,
  }),
  // 6. Kyar Inn — St. Peter Catholic Church (24x16 at (58, 3945))
  zoneFromUV({
    id: 'church-kyarinn-st-peter',
    regionId: 'kyarinn',
    name: 'စိန့်ပီတာ ကာသိုလိတ် ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'catholic',
    u: 58,
    v: 3945,
    walkRects: [
      { minX: -17.5, maxX: -13.4, minZ: -8.0, maxZ: 8.0 },
      { minX: -12, maxX: 12, minZ: 9.5, maxZ: 12.6 },
    ],
    count: 6,
  }),
  // 7. Si Thar — Sitha Baptist Church (7.4x5 at (-100, 4056.5))
  zoneFromUV({
    id: 'church-sithar-baptist',
    regionId: 'sithar',
    name: 'စည်သာ နှစ်ခြင်းအသင်းတော် ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'protestant',
    u: -100,
    v: 4056.5,
    walkRects: [
      { minX: -4.4, maxX: 4.4, minZ: 3.2, maxZ: 5.2 },
      { minX: -4.4, maxX: 4.4, minZ: -5.2, maxZ: -3.2 },
    ],
    count: 4,
  }),
  // 8. Si Thar — United Pentecostal Church of Sitha (7.2x4.8 at (-124, 4064.5))
  zoneFromUV({
    id: 'church-sithar-pentecostal',
    regionId: 'sithar',
    name: 'စည်သာ ပင်တေကုတ္တေ ဘုရားကျောင်း',
    kind: 'church',
    denomination: 'protestant',
    u: -124,
    v: 4064.5,
    walkRects: [
      { minX: -4.2, maxX: 4.2, minZ: 3.1, maxZ: 5.0 },
      { minX: -4.2, maxX: 4.2, minZ: -5.0, maxZ: -3.1 },
    ],
    count: 4,
  }),
];

/**
 * All 8 Village Schools across Kanbale, Htomar, Htauk Kyant, Kyar Inn, and Nat Myaung.
 * Every village school has **50–100 students** (`54..88`) PLUS **6–12 teachers** distributed across
 * BOTH their walk-in separated classrooms (`WALKIN_SCHOOL_HALLS`) AND their open schoolyards!
 */
export const SCHOOL_INSTITUTION_ZONES: readonly InstitutionZoneSpec[] = [
  // 1. Kanbale Basic Education School (13 separated classrooms, 62 students + 8 teachers = 70)
  {
    id: 'school-kanbale',
    regionId: 'kanbale',
    name: 'ကံပုလဲ အခြေခံပညာကျောင်း',
    kind: 'school',
    centerX: 451.73,
    centerZ: -569.03,
    rotation: 2.4226,
    walkRects: [
      { minX: -4.2, maxX: 9.2, minZ: -9.0, maxZ: -5.2 },
      { minX: -4.0, maxX: 10.0, minZ: -21.0, maxZ: -13.5 },
    ],
    teacherCount: 8,
    count: 70,
  },
  // 2. Htomar — GTHS (Khamtee) Technical High School (12 walk-in classrooms, 68 students + 10 teachers = 78)
  zoneFromUV({
    id: 'school-htomar-gths',
    regionId: 'htomar',
    name: 'အစိုးရနည်းပညာ အထက်တန်းကျောင်း (ခန္တီး)',
    kind: 'school',
    u: -96,
    v: 1710,
    walkRects: [
      { minX: -32, maxX: 28, minZ: -18, maxZ: 18 },
    ],
    teacherCount: 10,
    count: 78,
  }),
  // 3. Htomar — Technological University, Kalay (12 walk-in lecture halls, 76 students + 10 teachers = 86)
  zoneFromUV({
    id: 'school-htomar-tu-kalay',
    regionId: 'htomar',
    name: 'နည်းပညာတက္ကသိုလ် (ကလေး)',
    kind: 'school',
    u: -102,
    v: 1830,
    walkRects: [
      { minX: -36, maxX: 34, minZ: -22, maxZ: 22 },
    ],
    teacherCount: 10,
    count: 86,
  }),
  // 4. Htomar — BEHS Htomar (expanded 20-house-scale 4-hall complex, 16 classrooms, 66 students + 10 teachers = 76)
  zoneFromUV({
    id: 'school-htomar-behs',
    regionId: 'htomar',
    name: 'အထက-ထိုမာ',
    kind: 'school',
    u: 382,
    v: 1830,
    walkRects: [
      { minX: -36, maxX: 36, minZ: -14.0, maxZ: -5.5 },
      { minX: -36, maxX: 36, minZ: 5.5, maxZ: 14.0 },
    ],
    teacherCount: 10,
    count: 76,
  }),
  // 5. Htauk Kyant — BEHS Htauk Kyant (6 halls, 22 separated classrooms, 84 students + 12 teachers = 96)
  zoneFromUV({
    id: 'school-htaukkyant-behs',
    regionId: 'htaukkyant',
    name: 'အထက ထောက်ကြန့်',
    kind: 'school',
    u: -42,
    v: 3270,
    walkRects: [
      { minX: -16, maxX: 16, minZ: -12, maxZ: 12 },
    ],
    teacherCount: 12,
    count: 96,
  }),
  // 6. Kyar Inn — BEMS Kyar Inn (6 halls, 22 separated classrooms, 82 students + 12 teachers = 94)
  zoneFromUV({
    id: 'school-kyarinn-bems',
    regionId: 'kyarinn',
    name: 'အလက ကြာအင်း',
    kind: 'school',
    u: 68,
    v: 3850,
    walkRects: [
      { minX: -32, maxX: 28, minZ: -16, maxZ: 16 },
    ],
    teacherCount: 12,
    count: 94,
  }),
  // 7. Nat Myaung — Primary School (4 separated classrooms, 54 students + 6 teachers = 60)
  zoneFromUV({
    id: 'school-natmyaung-primary',
    regionId: 'natmyaung',
    name: 'အမက နတ်မြောင်း',
    kind: 'school',
    u: 72,
    v: 4195,
    walkRects: [
      { minX: -9, maxX: 9, minZ: -7.5, maxZ: -5.6 },
      { minX: -9, maxX: 9, minZ: 5.6, maxZ: 8.0 },
    ],
    teacherCount: 6,
    count: 60,
  }),
  // 8. Nat Myaung — BEHS Nat Myaung (5 separated classrooms × 2 storeys, 62 students + 8 teachers = 70)
  zoneFromUV({
    id: 'school-natmyaung-high',
    regionId: 'natmyaung',
    name: 'အထက နတ်မြောင်း',
    kind: 'school',
    u: -14,
    v: 4172,
    walkRects: [
      { minX: -11, maxX: 11, minZ: -8.5, maxZ: -6.2 },
      { minX: -11, maxX: 11, minZ: 6.2, maxZ: 8.8 },
    ],
    teacherCount: 8,
    count: 70,
  }),
];

export const ALL_INSTITUTION_ZONES: readonly InstitutionZoneSpec[] = [
  ...CHURCH_INSTITUTION_ZONES,
  ...SCHOOL_INSTITUTION_ZONES,
];

export interface InstitutionNpcMemberState {
  readonly id: string;
  readonly zoneId: string;
  readonly zoneIndex: number;
  readonly regionId: string;
  readonly institutionKind: InstitutionKind;
  readonly role: InstitutionNpcRole;
  readonly skinIndex: number;
  readonly backpackIndex: number;
  readonly scale: number;
  readonly walkSpeed: number;
  readonly phaseOffset: number;
  /** Local coordinate frame anchor (either school/church yard OR a specific separated classroom hall!) */
  readonly anchorX: number;
  readonly anchorZ: number;
  readonly anchorRotation: number;
  readonly insideClassroom: boolean;
  readonly roomLabel?: string;
  readonly rect: InstitutionWalkRect;
  lx: number;
  lz: number;
  targetLx: number;
  targetLz: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
  speed: number;
  walkDist: number;
  elapsed: number;
  pauseTimer: number;
  seed: number;
}

function nextLcg(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

function frameLocalToWorld(
  anchorX: number,
  anchorZ: number,
  rotation: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return {
    x: anchorX + lx * c + lz * s,
    z: anchorZ - lx * s + lz * c,
  };
}

export function institutionRoleToNpcRole(
  role: InstitutionNpcRole,
): 'uncle' | 'auntie' | 'boy' | 'girl' {
  if (role === 'student-boy') return 'boy';
  if (role === 'student-girl') return 'girl';
  if (role === 'catholic-sister' || role === 'pastor-woman' || role === 'teacher-woman') {
    return 'auntie';
  }
  return 'uncle';
}

export function buildInstitutionNpcRoster(
  zones: readonly InstitutionZoneSpec[] = ALL_INSTITUTION_ZONES,
): InstitutionNpcMemberState[] {
  const members: InstitutionNpcMemberState[] = [];

  // Precompute separated classroom interior rects per school zone from WALKIN_SCHOOL_HALLS
  const classroomZonesBySchool = new Map<
    string,
    {
      teachers: ClassroomNpcSpawnRect[];
      students: ClassroomNpcSpawnRect[];
      corridors: ClassroomNpcSpawnRect[];
    }
  >();
  for (const hall of WALKIN_SCHOOL_HALLS) {
    let bucket = classroomZonesBySchool.get(hall.schoolZoneId);
    if (!bucket) {
      bucket = { teachers: [], students: [], corridors: [] };
      classroomZonesBySchool.set(hall.schoolZoneId, bucket);
    }
    for (const cz of getHallClassroomZones(hall)) {
      if (cz.roleKind === 'teacher') bucket.teachers.push(cz);
      else if (cz.roleKind === 'student') bucket.students.push(cz);
      else bucket.corridors.push(cz);
    }
  }

  for (let zi = 0; zi < zones.length; zi++) {
    const z = zones[zi];
    let seed = (Math.imul(zi + 13, 2654435761) ^ 0x51a9c2) >>> 0;
    const teacherQuota = z.kind === 'school' ? (z.teacherCount ?? Math.max(4, Math.round(z.count * 0.12))) : 0;
    const roomBuckets = z.kind === 'school' ? classroomZonesBySchool.get(z.id) : undefined;

    for (let mi = 0; mi < z.count; mi++) {
      let r1: number;
      let r2: number;
      let r3: number;
      [seed, r1] = nextLcg(seed);
      [seed, r2] = nextLcg(seed);
      [seed, r3] = nextLcg(seed);

      let role: InstitutionNpcRole;
      if (z.kind === 'church') {
        if (z.denomination === 'catholic') {
          role = mi % 2 === 0 ? 'catholic-priest' : 'catholic-sister';
        } else {
          role = mi % 2 === 0 ? 'pastor-man' : 'pastor-woman';
        }
      } else if (mi < teacherQuota) {
        role = mi % 3 === 1 ? 'teacher-man' : 'teacher-woman';
      } else {
        role = (mi - teacherQuota) % 2 === 0 ? 'student-girl' : 'student-boy';
      }

      const isStudent = role === 'student-boy' || role === 'student-girl';
      const isTeacher = role === 'teacher-man' || role === 'teacher-woman';
      const isWoman =
        role === 'catholic-sister' ||
        role === 'pastor-woman' ||
        role === 'teacher-woman' ||
        role === 'student-girl';

      const scale = isStudent
        ? 0.74 + r3 * 0.11
        : isWoman
          ? 0.95 + r3 * 0.05
          : 1.02 + r3 * 0.06;

      // Choose placement:
      // - School Teachers: ~80% inside separated classrooms by the blackboard, ~20% supervising yard
      // - School Students (50..100): ~55% inside separated classrooms, ~15% on corridor veranda, ~30% on yard/field
      let anchorX = z.centerX;
      let anchorZ = z.centerZ;
      let anchorRotation = z.rotation;
      let worldY = 0.06;
      let insideClassroom = false;
      let roomLabel: string | undefined;
      let rect: InstitutionWalkRect = z.walkRects[mi % z.walkRects.length];
      let initialYaw = z.rotation + (r2 - 0.5) * Math.PI * 2;

      if (roomBuckets && isTeacher && roomBuckets.teachers.length > 0 && mi < teacherQuota - 2) {
        const cr = roomBuckets.teachers[mi % roomBuckets.teachers.length];
        anchorX = cr.centerX;
        anchorZ = cr.centerZ;
        anchorRotation = cr.rotation;
        worldY = cr.worldY;
        insideClassroom = true;
        roomLabel = cr.roomLabel;
        rect = { minX: cr.minX, maxX: cr.maxX, minZ: cr.minZ, maxZ: cr.maxZ };
        initialYaw = cr.facingYaw;
      } else if (roomBuckets && isStudent && roomBuckets.students.length > 0) {
        const studentIdx = mi - teacherQuota;
        const bucketMod = studentIdx % 10;
        if (bucketMod < 6) {
          // Inside separated classroom studying/moving around desks
          const cr = roomBuckets.students[studentIdx % roomBuckets.students.length];
          anchorX = cr.centerX;
          anchorZ = cr.centerZ;
          anchorRotation = cr.rotation;
          worldY = cr.worldY;
          insideClassroom = true;
          roomLabel = cr.roomLabel;
          rect = { minX: cr.minX, maxX: cr.maxX, minZ: cr.minZ, maxZ: cr.maxZ };
          initialYaw = cr.facingYaw;
        } else if (bucketMod === 6 && roomBuckets.corridors.length > 0) {
          // Walking along open front corridor between separated classrooms
          const cr = roomBuckets.corridors[studentIdx % roomBuckets.corridors.length];
          anchorX = cr.centerX;
          anchorZ = cr.centerZ;
          anchorRotation = cr.rotation;
          worldY = cr.worldY;
          insideClassroom = false;
          roomLabel = cr.roomLabel;
          rect = { minX: cr.minX, maxX: cr.maxX, minZ: cr.minZ, maxZ: cr.maxZ };
        }
      }

      const lx = rect.minX + r1 * Math.max(0.2, rect.maxX - rect.minX);
      const lz = rect.minZ + r2 * Math.max(0.2, rect.maxZ - rect.minZ);
      const w = frameLocalToWorld(anchorX, anchorZ, anchorRotation, lx, lz);

      const walkSpeed = insideClassroom
        ? isTeacher
          ? 0.34 + r3 * 0.14
          : 0.28 + r3 * 0.18
        : isStudent
          ? 0.92 + r3 * 0.34
          : z.kind === 'church'
            ? 0.48 + r3 * 0.2
            : 0.62 + r3 * 0.24;

      members.push({
        id: `${z.id}-${role}-${mi + 1}`,
        zoneId: z.id,
        zoneIndex: zi,
        regionId: z.regionId,
        institutionKind: z.kind,
        role,
        skinIndex: (zi + mi) % 3,
        backpackIndex: mi % 3,
        scale: Number(scale.toFixed(3)),
        walkSpeed: Number(walkSpeed.toFixed(3)),
        phaseOffset: r1 * Math.PI * 2,
        anchorX,
        anchorZ,
        anchorRotation,
        insideClassroom,
        roomLabel,
        rect,
        lx,
        lz,
        targetLx: lx,
        targetLz: lz,
        worldX: w.x,
        worldY,
        worldZ: w.z,
        yaw: initialYaw,
        speed: 0,
        walkDist: 0,
        elapsed: r1 * 8,
        pauseTimer: insideClassroom ? 2.5 + r2 * 4.5 : 0.5 + r2 * 2.4,
        seed: (seed ^ (mi * 7919 + 31)) >>> 0,
      });
    }
  }

  return members;
}

export interface PooledInstitutionSlot {
  readonly slotIndex: number;
  member: InstitutionNpcMemberState | null;
}

/**
 * Fixed Object Pool controller for Christian Church Clergy & Village School Teachers/Students.
 * - Pre-allocates `capacity` slots ONCE (ZERO dynamic allocation or object duplication).
 * - Automatically hides ALL school students & teachers in `evening` & `night`!
 * - Protects combat-engaged slots from mid-fight eviction via `isSlotLocked`.
 */
export class InstitutionNpcFixedPoolController {
  readonly zones: readonly InstitutionZoneSpec[];
  readonly members: InstitutionNpcMemberState[];
  readonly capacity: number;
  readonly activeRadius: number;
  readonly slots: PooledInstitutionSlot[];

  private assigned = new Set<InstitutionNpcMemberState>();
  private rebalanceTimer = 0;

  constructor(
    capacity: number,
    activeRadius = 175,
    zones: readonly InstitutionZoneSpec[] = ALL_INSTITUTION_ZONES,
  ) {
    this.zones = zones;
    this.members = buildInstitutionNpcRoster(zones);
    this.capacity = Math.max(1, capacity);
    this.activeRadius = activeRadius;
    this.slots = Array.from({ length: this.capacity }, (_, slotIndex) => ({
      slotIndex,
      member: null,
    }));
  }

  rebalance(
    focusX: number,
    focusZ: number,
    activeRegions: readonly string[],
    schoolOpen: boolean,
    churchOpen: boolean,
    isSlotLocked?: (slotIndex: number) => boolean,
  ): void {
    const activeSet = new Set(activeRegions);
    const maxDistSq = this.activeRadius * this.activeRadius;

    // Collect eligible members from active regions & open time-of-day institutions
    const candidates: { m: InstitutionNpcMemberState; distSq: number }[] = [];
    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      if (!activeSet.has(m.regionId)) continue;
      if (m.institutionKind === 'school' && !schoolOpen) continue;
      if (m.institutionKind === 'church' && !churchOpen) continue;
      const dx = m.worldX - focusX;
      const dz = m.worldZ - focusZ;
      const distSq = dx * dx + dz * dz;
      if (distSq <= maxDistSq) {
        candidates.push({ m, distSq });
      }
    }
    candidates.sort((a, b) => a.distSq - b.distSq);

    const desired: InstitutionNpcMemberState[] = [];
    for (let i = 0; i < candidates.length && desired.length < this.capacity; i++) {
      desired.push(candidates[i].m);
    }
    const desiredSet = new Set(desired);

    // 1. Release slots no longer eligible (always release school NPCs immediately when school closes!)
    for (let si = 0; si < this.slots.length; si++) {
      const slot = this.slots[si];
      if (!slot.member) continue;
      const forceHideSchool = slot.member.institutionKind === 'school' && !schoolOpen;
      const forceHideChurch = slot.member.institutionKind === 'church' && !churchOpen;
      if (!forceHideSchool && !forceHideChurch && isSlotLocked && isSlotLocked(si)) continue;
      if (forceHideSchool || forceHideChurch || !desiredSet.has(slot.member)) {
        this.assigned.delete(slot.member);
        slot.member = null;
      }
    }

    // 2. Fill open slots with nearest eligible clergy / students / teachers
    let idx = 0;
    for (let si = 0; si < this.slots.length && idx < desired.length; si++) {
      if (this.slots[si].member !== null) continue;
      while (idx < desired.length && this.assigned.has(desired[idx])) idx++;
      if (idx >= desired.length) break;
      const m = desired[idx++];
      this.slots[si].member = m;
      this.assigned.add(m);
    }
  }

  private stepMember(m: InstitutionNpcMemberState, dt: number): void {
    m.elapsed += dt;

    if (m.pauseTimer > 0) {
      m.pauseTimer -= dt;
      m.speed = 0;
      if (m.pauseTimer <= 0) {
        let r1: number;
        let r2: number;
        [m.seed, r1] = nextLcg(m.seed);
        [m.seed, r2] = nextLcg(m.seed);
        m.targetLx = m.rect.minX + r1 * Math.max(0.2, m.rect.maxX - m.rect.minX);
        m.targetLz = m.rect.minZ + r2 * Math.max(0.2, m.rect.maxZ - m.rect.minZ);
      }
      return;
    }

    const dx = m.targetLx - m.lx;
    const dz = m.targetLz - m.lz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      m.speed = 0;
      let rWait: number;
      [m.seed, rWait] = nextLcg(m.seed);
      m.pauseTimer = m.insideClassroom
        ? 3.2 + rWait * 5.0
        : m.institutionKind === 'church'
          ? 2.2 + rWait * 3.8
          : 1.0 + rWait * 2.4;
      return;
    }

    const step = Math.min(dist, m.walkSpeed * dt);
    const nx = dx / dist;
    const nz = dz / dist;
    m.lx = Math.max(m.rect.minX, Math.min(m.rect.maxX, m.lx + nx * step));
    m.lz = Math.max(m.rect.minZ, Math.min(m.rect.maxZ, m.lz + nz * step));
    m.speed = step / Math.max(0.001, dt);
    m.walkDist += step;

    const w = frameLocalToWorld(m.anchorX, m.anchorZ, m.anchorRotation, m.lx, m.lz);
    m.worldX = w.x;
    m.worldZ = w.z;

    const targetYaw = m.anchorRotation + Math.atan2(nx, nz);
    let diff = targetYaw - m.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    m.yaw += diff * Math.min(1, dt * 6.5);
  }

  update(
    focusX: number,
    focusZ: number,
    dt: number,
    activeRegions: readonly string[],
    minute: number,
    timeMode: TimeMode | undefined,
    forceRebalance = false,
    isSlotLocked?: (slotIndex: number) => boolean,
  ): { schoolOpen: boolean; churchOpen: boolean } {
    const clampedDt = Math.min(0.08, Math.max(0, dt));
    const schoolOpen = isSchoolOpenHours(minute, timeMode);
    const churchOpen = isChurchServiceHours(minute, timeMode);

    this.rebalanceTimer -= clampedDt;
    if (forceRebalance || this.rebalanceTimer <= 0) {
      this.rebalance(focusX, focusZ, activeRegions, schoolOpen, churchOpen, isSlotLocked);
      this.rebalanceTimer = 0.35;
    }

    for (let si = 0; si < this.slots.length; si++) {
      const m = this.slots[si].member;
      if (!m) continue;
      if (isSlotLocked && isSlotLocked(si)) {
        m.elapsed += clampedDt;
        continue;
      }
      this.stepMember(m, clampedDt);
    }

    return { schoolOpen, churchOpen };
  }

  dispose(): void {
    this.assigned.clear();
    for (const s of this.slots) s.member = null;
  }
}
