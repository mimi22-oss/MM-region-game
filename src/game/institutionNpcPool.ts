import { angle, toWorld, ward } from '../data/ward.ts';
import type { TimeMode } from './environmentTime.ts';
import { resolveTimePeriod } from './villageCrowd.ts';
import {
  WALKIN_SCHOOL_HALLS,
  getHallBlackboardAnchors,
  getHallClassroomZones,
  getHallDeskSeats,
  getHallDormitoryZones,
  type ClassroomBlackboardAnchor,
  type ClassroomDeskSeat,
  type ClassroomDormZone,
  type ClassroomNpcSpawnRect,
  type SchoolDormRole,
} from './schoolClassrooms.ts';
import {
  computeClassroomLessonState,
  computeSchoolCommuteProgress,
  resolveSchoolPeriod,
  type ClassroomLessonPhase,
  type ClassroomLessonState,
  type SchoolPeriod,
} from './schoolSchedule.ts';

export {
  computeClassroomLessonState,
  computeSchoolCommuteProgress,
  resolveSchoolPeriod,
  type ClassroomLessonPhase,
  type ClassroomLessonState,
  type SchoolPeriod,
};

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

export const SCHOOL_MIN_STUDENTS = 60;
export const SCHOOL_MAX_STUDENTS = 500;

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

/** True during open Myanmar school hours (morning play, class, lunch break, afternoon play); strictly false in evening & night. */
export function isSchoolOpenHours(minute: number, timeMode?: TimeMode): boolean {
  return resolveSchoolPeriod(minute, timeMode) !== 'closed';
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
 * Every separated classroom (BOTH 1st Floor AND 2nd Floor!) is filled with **EXACTLY 15 students**
 * with **ZERO overlapping seats**, PLUS **1 dedicated teacher per separated classroom** — streamed
 * smoothly through the bounded Singleton + Fixed Object Pool!
 */
export const SCHOOL_INSTITUTION_ZONES: readonly InstitutionZoneSpec[] = [
  // 1. Kanbale Basic Education School (18 classrooms incl. 2F: 270 students = 15/room + 18 teachers = 288)
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
    teacherCount: 18,
    count: 288,
  },
  // 2. Htomar — GTHS (Khamtee) Technical High School (16 classrooms incl. 2F: 240 students = 15/room + 16 teachers = 256)
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
    teacherCount: 16,
    count: 256,
  }),
  // 3. Htomar — Technological University, Kalay (24 classrooms incl. 2F: 360 students = 15/room + 24 teachers = 384)
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
    teacherCount: 24,
    count: 384,
  }),
  // 4. Htomar — BEHS Htomar (16 classrooms: 240 students = 15/room + 16 teachers = 256)
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
    teacherCount: 16,
    count: 256,
  }),
  // 5. Htauk Kyant — BEHS Htauk Kyant (31 classrooms incl. 2F: 465 students = 15/room + 31 teachers = 496)
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
    teacherCount: 31,
    count: 496,
  }),
  // 6. Kyar Inn — BEMS Kyar Inn (22 classrooms: 330 students = 15/room + 22 teachers = 352)
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
    teacherCount: 22,
    count: 352,
  }),
  // 7. Nat Myaung — Primary School (4 classrooms: 60 students = 15/room + 6 teachers = 66)
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
    count: 66,
  }),
  // 8. Nat Myaung — BEHS Nat Myaung (10 classrooms incl. 2F: 150 students = 15/room + 10 teachers = 160)
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
    teacherCount: 10,
    count: 160,
  }),
  // 9. Thar Si — BEHS Thar Si (3 halls, 18 classrooms incl. 2F: 270 students = 15/room + 18 teachers = 288)
  zoneFromUV({
    id: 'school-tharsi-behs',
    regionId: 'tharsi',
    name: 'သာစည် အခြေခံပညာကျောင်း',
    kind: 'school',
    u: -271,
    v: 870,
    walkRects: [
      // South of flagpole plinth in central assembly plaza (clear of plinth -1.6..1.6)
      { minX: -22, maxX: 22, minZ: 4.0, maxZ: 24.0 },
      // North of flagpole plinth toward resting pavilions & entrance walkway
      { minX: -22, maxX: 22, minZ: -26.0, maxZ: -4.0 },
      // Left & right open courtyards flanking flagpole
      { minX: -24, maxX: -4.5, minZ: -12, maxZ: 12 },
      { minX: 4.5, maxX: 24, minZ: -12, maxZ: 12 },
    ],
    teacherCount: 18,
    count: 288,
  }),
  // 10. Myothar Center — BEHS Myothar (3 halls, 16 classrooms incl. 2F: 240 students = 15/room + 16 teachers = 256)
  zoneFromUV({
    id: 'school-myothar-behs',
    regionId: 'myothar',
    name: 'မြို့သာ အခြေခံပညာကျောင်း',
    kind: 'school',
    u: -134,
    v: -926.5,
    walkRects: [
      // East of flagpole plinth toward East Entrance Gate & flanking resting pavilions
      { minX: 4.0, maxX: 24.0, minZ: -12.0, maxZ: 12.0 },
      // West of flagpole plinth toward Main 2F Hall veranda
      { minX: -14.0, maxX: -4.0, minZ: -12.0, maxZ: 12.0 },
      // North & south assembly courtyard clear of flagpole
      { minX: -12.0, maxX: 16.0, minZ: -14.0, maxZ: -4.0 },
      { minX: -12.0, maxX: 16.0, minZ: 4.0, maxZ: 16.0 },
    ],
    teacherCount: 16,
    count: 256,
  }),
];

export const ALL_INSTITUTION_ZONES: readonly InstitutionZoneSpec[] = [
  ...CHURCH_INSTITUTION_ZONES,
  ...SCHOOL_INSTITUTION_ZONES,
];

export type SchoolMemberActivity =
  | 'none'
  | 'commute-to-school'
  | 'commute-home'
  | 'teaching-write'
  | 'teaching-sit-rest'
  | 'teaching-wait'
  | 'teaching-erase'
  | 'teaching-explain'
  | 'student-copy'
  | 'play'
  | 'lunch'
  | 'dorm-life';

export interface SchoolDormResidence {
  readonly hallId: string;
  readonly dormRole: SchoolDormRole;
  readonly anchorX: number;
  readonly anchorZ: number;
  readonly rotation: number;
  readonly worldY: number;
  readonly rect: InstitutionWalkRect;
  lx: number;
  lz: number;
  targetLx: number;
  targetLz: number;
}

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
  /** Village residential home origin (used during 06:30–07:00 commute-to-school & 15:30–16:00 commute-home) */
  readonly homeX: number;
  readonly homeZ: number;
  /** Default/break walk coordinate frame anchor (yard/corridor/church plaza) */
  readonly anchorX: number;
  readonly anchorZ: number;
  readonly anchorRotation: number;
  readonly breakWorldY: number;
  readonly insideClassroom: boolean;
  readonly roomLabel?: string;
  readonly roomSeed: number;
  /** Optional assigned blackboard anchor for classroom teachers during `'class'` */
  readonly boardAnchor?: ClassroomBlackboardAnchor;
  /** Optional exact desk seat for classroom students during `'class'` */
  readonly deskSeat?: ClassroomDeskSeat;
  /** Optional on-campus boarding dormitory residence (`ကျောင်းအိပ်ကျောင်းစား`) used 16:00–06:29 / evening / night */
  readonly dormHome?: SchoolDormResidence;
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
  /** Live schedule-driven classroom activity & pose state */
  classActivity: SchoolMemberActivity;
  lessonPhase: ClassroomLessonPhase;
  seated: boolean;
  lessonCursorX: number;
  lessonCursorY: number;
}

export interface PooledChalkboardSlot {
  readonly slotIndex: number;
  anchor: ClassroomBlackboardAnchor | null;
  lesson: ClassroomLessonState | null;
}

export const ALL_CLASSROOM_BLACKBOARDS: readonly ClassroomBlackboardAnchor[] =
  WALKIN_SCHOOL_HALLS.flatMap(h => getHallBlackboardAnchors(h));

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

function collectNearbyVillageHomes(
  regionId: string,
  schoolX: number,
  schoolZ: number,
): { x: number; z: number }[] {
  const village = ward.villages.find(v => v.id === regionId);
  const homes: { x: number; z: number; distSq: number }[] = [];
  if (village && village.houses.length > 0) {
    for (const h of village.houses) {
      if (
        h.id.includes('school') ||
        h.id.includes('church') ||
        h.id.includes('pagoda') ||
        h.id.includes('monastery') ||
        h.id.includes('landmark') ||
        h.id.includes('campus') ||
        h.id.includes('lake')
      ) {
        continue;
      }
      const dx = h.x - schoolX;
      const dz = h.z - schoolZ;
      const dSq = dx * dx + dz * dz;
      if (dSq >= 32 * 32 && dSq <= 190 * 190) {
        homes.push({ x: h.x, z: h.z, distSq: dSq });
      }
    }
    homes.sort((a, b) => a.distSq - b.distSq);
  }
  if (homes.length >= 12) {
    return homes.slice(0, 48).map(({ x, z }) => ({ x, z }));
  }
  // Fallback for streamed villages (e.g. Kanbale): neighborhood residential perimeter 45m..110m around school
  return Array.from({ length: 24 }, (_, idx) => {
    const theta = (idx / 24) * Math.PI * 2;
    const dist = 48 + (idx % 4) * 16;
    return {
      x: schoolX + Math.cos(theta) * dist,
      z: schoolZ + Math.sin(theta) * dist,
    };
  });
}

/**
 * Interleaves unique desk seats round-robin across EVERY separated classroom (1F & 2F)
 * so students fill every room evenly with strictly 1 student per unique seat (ZERO overlap!).
 */
function interleaveSeatsAcrossRooms(seats: readonly ClassroomDeskSeat[]): ClassroomDeskSeat[] {
  const byRoom = new Map<string, ClassroomDeskSeat[]>();
  const roomOrder: string[] = [];
  for (const s of seats) {
    const key = `${s.hallId}:f${s.storey}:r${s.roomIndex}`;
    let list = byRoom.get(key);
    if (!list) {
      list = [];
      byRoom.set(key, list);
      roomOrder.push(key);
    }
    list.push(s);
  }
  const result: ClassroomDeskSeat[] = [];
  let maxDepth = 0;
  for (const list of byRoom.values()) {
    if (list.length > maxDepth) maxDepth = list.length;
  }
  for (let slotIdx = 0; slotIdx < maxDepth; slotIdx++) {
    for (const rk of roomOrder) {
      const list = byRoom.get(rk)!;
      if (slotIdx < list.length) {
        result.push(list[slotIdx]);
      }
    }
  }
  return result;
}

export function buildInstitutionNpcRoster(
  zones: readonly InstitutionZoneSpec[] = ALL_INSTITUTION_ZONES,
): InstitutionNpcMemberState[] {
  const members: InstitutionNpcMemberState[] = [];

  // Precompute separated classroom blackboards (1F+2F), round-robin interleaved unique seats (1F+2F),
  // corridors, and boarding dormitory zones per school zone
  const schoolAssetsByZone = new Map<
    string,
    {
      boards: ClassroomBlackboardAnchor[];
      seats: ClassroomDeskSeat[];
      corridors: ClassroomNpcSpawnRect[];
      teacherDorms: ClassroomDormZone[];
      studentDorms: ClassroomDormZone[];
    }
  >();
  for (const hall of WALKIN_SCHOOL_HALLS) {
    let bucket = schoolAssetsByZone.get(hall.schoolZoneId);
    if (!bucket) {
      bucket = { boards: [], seats: [], corridors: [], teacherDorms: [], studentDorms: [] };
      schoolAssetsByZone.set(hall.schoolZoneId, bucket);
    }
    bucket.boards.push(...getHallBlackboardAnchors(hall));
    bucket.seats.push(...getHallDeskSeats(hall));
    for (const cz of getHallClassroomZones(hall)) {
      if (cz.roleKind === 'corridor') bucket.corridors.push(cz);
    }
    for (const dz of getHallDormitoryZones(hall)) {
      if (dz.dormRole === 'teacher-dorm') bucket.teacherDorms.push(dz);
      else bucket.studentDorms.push(dz);
    }
  }
  for (const bucket of schoolAssetsByZone.values()) {
    bucket.seats = interleaveSeatsAcrossRooms(bucket.seats);
  }

  for (let zi = 0; zi < zones.length; zi++) {
    const z = zones[zi];
    let seed = (Math.imul(zi + 13, 2654435761) ^ 0x51a9c2) >>> 0;
    const assets = z.kind === 'school' ? schoolAssetsByZone.get(z.id) : undefined;
    const teacherQuota =
      z.kind === 'school'
        ? Math.max(z.teacherCount ?? Math.max(4, Math.round(z.count * 0.12)), assets?.boards.length ?? 0)
        : 0;
    const villageHomes =
      z.kind === 'school' ? collectNearbyVillageHomes(z.regionId, z.centerX, z.centerZ) : [];

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

      // Break / play / lunch yard or corridor home rectangle
      let anchorX = z.centerX;
      let anchorZ = z.centerZ;
      let anchorRotation = z.rotation;
      let breakWorldY = 0.06;
      let rect: InstitutionWalkRect = z.walkRects[mi % z.walkRects.length];

      // Classroom assignment for `'class'` period (1 teacher per room, even seats across ALL 1F+2F rooms, 0 overlap!)
      let boardAnchor: ClassroomBlackboardAnchor | undefined;
      let deskSeat: ClassroomDeskSeat | undefined;
      let dormHome: SchoolDormResidence | undefined;
      let insideClassroom = false;
      let roomLabel: string | undefined;
      let roomSeed = (zi * 31 + mi) % 997;

      if (assets && isTeacher) {
        // Strictly 1 dedicated teacher per separated classroom (Ground Floor AND 2nd Floor!)
        if (mi < assets.boards.length) {
          boardAnchor = assets.boards[mi];
          insideClassroom = true;
          roomLabel = boardAnchor.roomLabel;
          roomSeed = boardAnchor.roomSeed;
        }
        // Boarding teachers reside in the campus Teachers' Dormitory (`ဆရာ/ဆရာမ အဆောင်`) 16:00–06:29
        if (assets.teacherDorms.length > 0 && mi < Math.min(8, Math.max(4, Math.ceil(teacherQuota * 0.4)))) {
          const dz = assets.teacherDorms[mi % assets.teacherDorms.length];
          const dlx = dz.minX + r1 * Math.max(0.2, dz.maxX - dz.minX);
          const dlz = dz.minZ + r2 * Math.max(0.2, dz.maxZ - dz.minZ);
          dormHome = {
            hallId: dz.hallId,
            dormRole: 'teacher-dorm',
            anchorX: dz.centerX,
            anchorZ: dz.centerZ,
            rotation: dz.rotation,
            worldY: dz.worldY,
            rect: { minX: dz.minX, maxX: dz.maxX, minZ: dz.minZ, maxZ: dz.maxZ },
            lx: dlx,
            lz: dlz,
            targetLx: dlx,
            targetLz: dlz,
          };
        }
        if (assets.corridors.length > 0 && mi % 2 === 0) {
          const corr = assets.corridors[mi % assets.corridors.length];
          anchorX = corr.centerX;
          anchorZ = corr.centerZ;
          anchorRotation = corr.rotation;
          breakWorldY = corr.worldY;
          rect = { minX: corr.minX, maxX: corr.maxX, minZ: corr.minZ, maxZ: corr.maxZ };
        }
      } else if (assets && isStudent && assets.seats.length > 0) {
        const studentIdx = mi - teacherQuota;
        // STRICT 1-to-1 unique desk seat assignment across ALL 1F + 2F rooms (ZERO overlap!)
        if (studentIdx < assets.seats.length) {
          deskSeat = assets.seats[studentIdx];
          insideClassroom = true;
          roomLabel = deskSeat.roomLabel;
          roomSeed = deskSeat.roomSeed;
        }
        // Boarding students reside in the campus Students' Dormitory (`ကျောင်းသား/ကျောင်းသူ အဆောင်`) 16:00–06:29
        if (assets.studentDorms.length > 0 && studentIdx < 24) {
          const dz = assets.studentDorms[studentIdx % assets.studentDorms.length];
          const dlx = dz.minX + r1 * Math.max(0.2, dz.maxX - dz.minX);
          const dlz = dz.minZ + r2 * Math.max(0.2, dz.maxZ - dz.minZ);
          dormHome = {
            hallId: dz.hallId,
            dormRole: 'student-dorm',
            anchorX: dz.centerX,
            anchorZ: dz.centerZ,
            rotation: dz.rotation,
            worldY: dz.worldY,
            rect: { minX: dz.minX, maxX: dz.maxX, minZ: dz.minZ, maxZ: dz.maxZ },
            lx: dlx,
            lz: dlz,
            targetLx: dlx,
            targetLz: dlz,
          };
        }
        if (assets.corridors.length > 0 && studentIdx % 5 === 0) {
          const corr = assets.corridors[studentIdx % assets.corridors.length];
          anchorX = corr.centerX;
          anchorZ = corr.centerZ;
          anchorRotation = corr.rotation;
          breakWorldY = corr.worldY;
          rect = { minX: corr.minX, maxX: corr.maxX, minZ: corr.minZ, maxZ: corr.maxZ };
        }
      }

      const lx = rect.minX + r1 * Math.max(0.2, rect.maxX - rect.minX);
      const lz = rect.minZ + r2 * Math.max(0.2, rect.maxZ - rect.minZ);
      const breakWorld = frameLocalToWorld(anchorX, anchorZ, anchorRotation, lx, lz);

      // Default spawn coordinates start at classroom seat/board if assigned (updated live every frame by period!)
      const startX = deskSeat
        ? deskSeat.worldX
        : boardAnchor
          ? frameLocalToWorld(
              boardAnchor.anchorX,
              boardAnchor.anchorZ,
              boardAnchor.rotation,
              boardAnchor.boardLx,
              boardAnchor.teacherBoardLz,
            ).x
          : breakWorld.x;
      const startZ = deskSeat
        ? deskSeat.worldZ
        : boardAnchor
          ? frameLocalToWorld(
              boardAnchor.anchorX,
              boardAnchor.anchorZ,
              boardAnchor.rotation,
              boardAnchor.boardLx,
              boardAnchor.teacherBoardLz,
            ).z
          : breakWorld.z;
      const startY = deskSeat
        ? deskSeat.worldY
        : boardAnchor
          ? boardAnchor.floorY
          : breakWorldY;
      const initialYaw = deskSeat
        ? deskSeat.facingYaw
        : boardAnchor
          ? boardAnchor.rotation + Math.PI
          : z.rotation + (r2 - 0.5) * Math.PI * 2;

      const walkSpeed = isStudent
        ? 0.96 + r3 * 0.36
        : z.kind === 'church'
          ? 0.48 + r3 * 0.2
          : 0.62 + r3 * 0.24;

      const homePt =
        villageHomes.length > 0
          ? villageHomes[mi % villageHomes.length]
          : { x: breakWorld.x, z: breakWorld.z };

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
        homeX: homePt.x,
        homeZ: homePt.z,
        anchorX,
        anchorZ,
        anchorRotation,
        breakWorldY,
        insideClassroom,
        roomLabel,
        roomSeed,
        boardAnchor,
        deskSeat,
        dormHome,
        rect,
        lx,
        lz,
        targetLx: lx,
        targetLz: lz,
        worldX: startX,
        worldY: startY,
        worldZ: startZ,
        yaw: initialYaw,
        speed: 0,
        walkDist: 0,
        elapsed: r1 * 8,
        pauseTimer: 0.5 + r2 * 2.4,
        seed: (seed ^ (mi * 7919 + 31)) >>> 0,
        classActivity: deskSeat ? 'student-copy' : boardAnchor ? 'teaching-write' : 'none',
        lessonPhase: 'writing',
        seated: Boolean(deskSeat),
        lessonCursorX: 0,
        lessonCursorY: 0,
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
  readonly boardCapacity: number;
  readonly activeRadius: number;
  readonly slots: PooledInstitutionSlot[];
  readonly boardSlots: PooledChalkboardSlot[];

  private assigned = new Set<InstitutionNpcMemberState>();
  private rebalanceTimer = 0;
  private lessonClock = 0;
  private lastSchoolPeriod: SchoolPeriod | null = null;

  constructor(
    capacity: number,
    activeRadius = 175,
    zones: readonly InstitutionZoneSpec[] = ALL_INSTITUTION_ZONES,
    boardCapacity = 24,
  ) {
    this.zones = zones;
    this.members = buildInstitutionNpcRoster(zones);
    this.capacity = Math.max(1, capacity);
    this.boardCapacity = Math.max(1, boardCapacity);
    this.activeRadius = activeRadius;
    this.slots = Array.from({ length: this.capacity }, (_, slotIndex) => ({
      slotIndex,
      member: null,
    }));
    this.boardSlots = Array.from({ length: this.boardCapacity }, (_, slotIndex) => ({
      slotIndex,
      anchor: null,
      lesson: null,
    }));
  }

  /** Computes the live world position of a member for the current school period (commute, class, play, lunch). */
  private syncMemberPeriodPosition(
    m: InstitutionNpcMemberState,
    schoolPeriod: SchoolPeriod,
    minute: number,
    timeMode: TimeMode | undefined,
  ): void {
    if (m.institutionKind !== 'school') return;

    // 0. Boarding school dormitories (`ကျောင်းအိပ်ကျောင်းစား`) during 16:00–06:29 / evening / night!
    if (schoolPeriod === 'closed' && m.dormHome) {
      const dh = m.dormHome;
      const dw = frameLocalToWorld(dh.anchorX, dh.anchorZ, dh.rotation, dh.lx, dh.lz);
      m.worldX = dw.x;
      m.worldY = dh.worldY;
      m.worldZ = dw.z;
      m.seated = false;
      m.classActivity = 'dorm-life';
      return;
    }

    // 1. Morning commute from village homes -> school (06:30–07:00) OR afternoon commute home (15:30–16:00)
    if (schoolPeriod === 'commute-to-school' || schoolPeriod === 'commute-home') {
      const { atSchool, progress } = computeSchoolCommuteProgress(minute, timeMode, m.seed);
      const schoolPt = frameLocalToWorld(m.anchorX, m.anchorZ, m.anchorRotation, m.lx, m.lz);
      m.seated = false;

      if (schoolPeriod === 'commute-to-school' && atSchool) {
        // Already arrived at school before 07:00 -> play on the schoolyard!
        m.classActivity = 'play';
        m.worldX = schoolPt.x;
        m.worldY = m.breakWorldY;
        m.worldZ = schoolPt.z;
        return;
      }

      const tx = m.homeX + (schoolPt.x - m.homeX) * progress;
      const tz = m.homeZ + (schoolPt.z - m.homeZ) * progress;
      const dirX = schoolPeriod === 'commute-to-school' ? schoolPt.x - m.homeX : m.homeX - schoolPt.x;
      const dirZ = schoolPeriod === 'commute-to-school' ? schoolPt.z - m.homeZ : m.homeZ - schoolPt.z;
      m.worldX = tx;
      m.worldY = 0.06;
      m.worldZ = tz;
      if (Math.hypot(dirX, dirZ) > 0.01) {
        m.yaw = Math.atan2(dirX, dirZ);
      }
      m.classActivity = schoolPeriod;
      m.speed = progress > 0 && progress < 1 ? m.walkSpeed * 1.15 : 0;
      return;
    }

    if (schoolPeriod === 'class') {
      if (m.deskSeat) {
        m.worldX = m.deskSeat.worldX;
        m.worldY = m.deskSeat.worldY;
        m.worldZ = m.deskSeat.worldZ;
        m.yaw = m.deskSeat.facingYaw;
        m.seated = true;
        m.speed = 0;
        m.classActivity = 'student-copy';
        m.lessonPhase = computeClassroomLessonState(this.lessonClock, m.deskSeat.roomSeed).phase;
        return;
      }
      if (m.boardAnchor) {
        const ba = m.boardAnchor;
        const lesson = computeClassroomLessonState(this.lessonClock, ba.roomSeed);
        m.lessonPhase = lesson.phase;
        m.lessonCursorX = lesson.cursorNormX;
        m.lessonCursorY = lesson.cursorNormY;
        m.seated = false;

        let targetLx = ba.boardLx;
        let targetLz = ba.teacherWaitLz;
        let targetYaw = ba.rotation;
        let teacherSpeed = 0;

        if (lesson.phase === 'writing') {
          targetLx = ba.boardLx + lesson.cursorNormX * (ba.boardWidth * 0.84);
          targetLz = ba.teacherBoardLz;
          targetYaw = ba.rotation + Math.PI;
          m.classActivity = 'teaching-write';
          teacherSpeed = 0.25;
        } else if (lesson.phase === 'erasing') {
          targetLx = ba.boardLx + lesson.cursorNormX * (ba.boardWidth * 0.84);
          targetLz = ba.teacherBoardLz;
          targetYaw = ba.rotation + Math.PI;
          m.classActivity = 'teaching-erase';
          teacherSpeed = 0.28;
        } else if (lesson.phase === 'waiting-copy') {
          // After writing on the blackboard:
          // 1. Walk over to the wooden chair behind the stacked-book teacher's desk (0.00..0.14)
          // 2. Sit down resting on the chair, turning head left & right watching students copy (0.14..0.86)
          // 3. Stand back up and walk over to the blackboard ready to erase (0.86..1.00)
          const p = lesson.phaseProgress;
          if (p < 0.14) {
            const u = p / 0.14;
            targetLx = ba.boardLx + (ba.teacherChairLx - ba.boardLx) * u;
            targetLz = ba.teacherBoardLz + (ba.teacherChairLz - ba.teacherBoardLz) * u;
            targetYaw = ba.rotation + Math.atan2(ba.teacherChairLx - ba.boardLx, ba.teacherChairLz - ba.teacherBoardLz);
            m.classActivity = 'teaching-wait';
            m.seated = false;
            teacherSpeed = 0.65;
          } else if (p <= 0.86) {
            targetLx = ba.teacherChairLx;
            targetLz = ba.teacherChairLz;
            targetYaw = ba.rotation; // Facing +Z toward all seated students!
            m.classActivity = 'teaching-sit-rest';
            m.seated = true;
            teacherSpeed = 0;
          } else {
            const u = (p - 0.86) / 0.14;
            targetLx = ba.teacherChairLx + (ba.boardLx - ba.teacherChairLx) * u;
            targetLz = ba.teacherChairLz + (ba.teacherBoardLz - ba.teacherChairLz) * u;
            targetYaw = ba.rotation + Math.atan2(ba.boardLx - ba.teacherChairLx, ba.teacherBoardLz - ba.teacherChairLz);
            m.classActivity = 'teaching-wait';
            m.seated = false;
            teacherSpeed = 0.65;
          }
        } else {
          targetLx = ba.boardLx;
          targetLz = ba.teacherWaitLz;
          targetYaw = ba.rotation;
          m.classActivity = 'teaching-explain';
          teacherSpeed = 0;
        }
        const w = frameLocalToWorld(ba.anchorX, ba.anchorZ, ba.rotation, targetLx, targetLz);
        m.worldX = w.x;
        m.worldY = ba.floorY;
        m.worldZ = w.z;
        m.yaw = targetYaw;
        m.speed = teacherSpeed;
        return;
      }
    }

    // Playtime (`morning-play`, `afternoon-play`) or `lunch-break` -> step out onto yard & veranda!
    m.seated = false;
    m.classActivity = schoolPeriod === 'lunch-break' ? 'lunch' : 'play';
    const bw = frameLocalToWorld(m.anchorX, m.anchorZ, m.anchorRotation, m.lx, m.lz);
    m.worldX = bw.x;
    m.worldY = m.breakWorldY;
    m.worldZ = bw.z;
  }

  rebalance(
    focusX: number,
    focusZ: number,
    activeRegions: readonly string[],
    schoolPeriod: SchoolPeriod,
    churchOpen: boolean,
    isSlotLocked?: (slotIndex: number) => boolean,
    minute = 780,
    timeMode?: TimeMode,
    periodChanged = false,
  ): void {
    const schoolOpen = schoolPeriod !== 'closed';
    const activeSet = new Set(activeRegions);
    const maxDistSq = this.activeRadius * this.activeRadius;

    // Collect eligible members from active regions & open time-of-day institutions.
    // During `closed` (04:00 PM – 06:29 AM / evening / night), ALL school students, teachers,
    // and live chalkboard overlays are strictly HIDDEN (`0` active)!
    const candidates: { m: InstitutionNpcMemberState; distSq: number; sortKey: number }[] = [];
    for (let i = 0; i < this.members.length; i++) {
      const m = this.members[i];
      if (!activeSet.has(m.regionId)) continue;
      if (m.institutionKind === 'school' && !schoolOpen) continue;
      if (m.institutionKind === 'church' && !churchOpen) continue;
      if (m.institutionKind === 'school' && (periodChanged || !this.assigned.has(m))) {
        this.syncMemberPeriodPosition(m, schoolPeriod, minute, timeMode);
      }
      const dx = m.worldX - focusX;
      const dz = m.worldZ - focusZ;
      const distSq = dx * dx + dz * dz;
      if (distSq <= maxDistSq) {
        // Guarantee every nearby active classroom's dedicated teacher is never bumped by front-row students!
        const sortKey =
          schoolPeriod === 'class' && m.boardAnchor ? Math.max(0, distSq - 256) : distSq;
        candidates.push({ m, distSq, sortKey });
      }
    }
    candidates.sort((a, b) => a.sortKey - b.sortKey);

    const desired: InstitutionNpcMemberState[] = [];
    for (let i = 0; i < candidates.length && desired.length < this.capacity; i++) {
      desired.push(candidates[i].m);
    }
    const desiredSet = new Set(desired);

    // 1. Release slots no longer eligible (immediately hide ALL school NPCs when school is closed!)
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

    // 3. Rebalance Fixed Pool of Live Animated Chalkboard Overlays for nearby active classrooms
    if (schoolPeriod === 'class') {
      const boardCandidates: { anchor: ClassroomBlackboardAnchor; distSq: number }[] = [];
      for (let i = 0; i < ALL_CLASSROOM_BLACKBOARDS.length; i++) {
        const ba = ALL_CLASSROOM_BLACKBOARDS[i];
        if (!activeSet.has(ba.regionId)) continue;
        const dx = ba.boardWorldX - focusX;
        const dz = ba.boardWorldZ - focusZ;
        const distSq = dx * dx + dz * dz;
        if (distSq <= maxDistSq) {
          boardCandidates.push({ anchor: ba, distSq });
        }
      }
      boardCandidates.sort((a, b) => a.distSq - b.distSq);
      for (let bi = 0; bi < this.boardSlots.length; bi++) {
        const bs = this.boardSlots[bi];
        if (bi < boardCandidates.length) {
          bs.anchor = boardCandidates[bi].anchor;
          bs.lesson = computeClassroomLessonState(this.lessonClock, bs.anchor.roomSeed);
        } else {
          bs.anchor = null;
          bs.lesson = null;
        }
      }
    } else {
      for (let bi = 0; bi < this.boardSlots.length; bi++) {
        this.boardSlots[bi].anchor = null;
        this.boardSlots[bi].lesson = null;
      }
    }
  }

  private stepMember(
    m: InstitutionNpcMemberState,
    dt: number,
    schoolPeriod: SchoolPeriod,
    minute: number,
    timeMode: TimeMode | undefined,
  ): void {
    m.elapsed += dt;

    // Boarding dormitory life (`ကျောင်းအိပ်ကျောင်းစား`) during 16:00–06:29 / evening / night!
    if (m.institutionKind === 'school' && schoolPeriod === 'closed' && m.dormHome) {
      const dh = m.dormHome;
      m.seated = false;
      m.classActivity = 'dorm-life';
      m.worldY = dh.worldY;
      if (m.pauseTimer > 0) {
        m.pauseTimer -= dt;
        m.speed = 0;
        if (m.pauseTimer <= 0) {
          let r1: number;
          let r2: number;
          [m.seed, r1] = nextLcg(m.seed);
          [m.seed, r2] = nextLcg(m.seed);
          dh.targetLx = dh.rect.minX + r1 * Math.max(0.2, dh.rect.maxX - dh.rect.minX);
          dh.targetLz = dh.rect.minZ + r2 * Math.max(0.2, dh.rect.maxZ - dh.rect.minZ);
        }
        const dw = frameLocalToWorld(dh.anchorX, dh.anchorZ, dh.rotation, dh.lx, dh.lz);
        m.worldX = dw.x;
        m.worldZ = dw.z;
        return;
      }
      const ddx = dh.targetLx - dh.lx;
      const ddz = dh.targetLz - dh.lz;
      const dDist = Math.hypot(ddx, ddz);
      if (dDist < 0.25) {
        m.speed = 0;
        let rWait: number;
        [m.seed, rWait] = nextLcg(m.seed);
        m.pauseTimer = 3.2 + rWait * 5.0;
        const dw = frameLocalToWorld(dh.anchorX, dh.anchorZ, dh.rotation, dh.lx, dh.lz);
        m.worldX = dw.x;
        m.worldZ = dw.z;
        return;
      }
      const dStep = Math.min(dDist, m.walkSpeed * 0.45 * dt);
      const dnx = ddx / dDist;
      const dnz = ddz / dDist;
      dh.lx = Math.max(dh.rect.minX, Math.min(dh.rect.maxX, dh.lx + dnx * dStep));
      dh.lz = Math.max(dh.rect.minZ, Math.min(dh.rect.maxZ, dh.lz + dnz * dStep));
      m.speed = dStep / Math.max(0.001, dt);
      m.walkDist += dStep;
      const dw = frameLocalToWorld(dh.anchorX, dh.anchorZ, dh.rotation, dh.lx, dh.lz);
      m.worldX = dw.x;
      m.worldZ = dw.z;
      const dTargetYaw = dh.rotation + Math.atan2(dnx, dnz);
      let dDiff = dTargetYaw - m.yaw;
      while (dDiff > Math.PI) dDiff -= Math.PI * 2;
      while (dDiff < -Math.PI) dDiff += Math.PI * 2;
      m.yaw += dDiff * Math.min(1, dt * 5.5);
      return;
    }

    // Morning commute from homes to school (06:30–07:00) or going home after 15:30
    if (
      m.institutionKind === 'school' &&
      (schoolPeriod === 'commute-to-school' || schoolPeriod === 'commute-home')
    ) {
      const { atSchool } = computeSchoolCommuteProgress(minute, timeMode, m.seed);
      if (!(schoolPeriod === 'commute-to-school' && atSchool)) {
        this.syncMemberPeriodPosition(m, schoolPeriod, minute, timeMode);
        if (m.speed > 0.05) {
          m.walkDist += m.speed * dt;
        }
        return;
      }
    }

    // During `'class'`, classroom teachers run the live Write -> Sit at Desk Chair Watching Students -> Stand & Erase -> Explain cycle
    // and classroom students sit at their exact desks copying from the green blackboard!
    if (m.institutionKind === 'school' && schoolPeriod === 'class' && (m.boardAnchor || m.deskSeat)) {
      this.syncMemberPeriodPosition(m, schoolPeriod, minute, timeMode);
      if (m.speed > 0.05) {
        m.walkDist += m.speed * dt;
      }
      return;
    }

    m.seated = false;
    if (m.institutionKind === 'school') {
      m.classActivity = schoolPeriod === 'lunch-break' ? 'lunch' : 'play';
      m.worldY = m.breakWorldY;
    } else {
      m.classActivity = 'none';
    }

    const isStudent = m.role === 'student-boy' || m.role === 'student-girl';
    const speedScale =
      m.institutionKind === 'school'
        ? schoolPeriod === 'lunch-break'
          ? 0.55
          : isStudent
            ? 1.35
            : 0.9
        : 1.0;

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
      const w = frameLocalToWorld(m.anchorX, m.anchorZ, m.anchorRotation, m.lx, m.lz);
      m.worldX = w.x;
      m.worldZ = w.z;
      return;
    }

    const dx = m.targetLx - m.lx;
    const dz = m.targetLz - m.lz;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.25) {
      m.speed = 0;
      let rWait: number;
      [m.seed, rWait] = nextLcg(m.seed);
      m.pauseTimer =
        m.institutionKind === 'church'
          ? 2.2 + rWait * 3.8
          : schoolPeriod === 'lunch-break'
            ? 2.6 + rWait * 4.2
            : 0.45 + rWait * 1.4;
      return;
    }

    const step = Math.min(dist, m.walkSpeed * speedScale * dt);
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
  ): { schoolOpen: boolean; churchOpen: boolean; schoolPeriod: SchoolPeriod } {
    const clampedDt = Math.min(0.08, Math.max(0, dt));
    this.lessonClock += clampedDt;

    const schoolPeriod = resolveSchoolPeriod(minute, timeMode);
    const schoolOpen = schoolPeriod !== 'closed';
    const churchOpen = isChurchServiceHours(minute, timeMode);
    const periodChanged = this.lastSchoolPeriod !== schoolPeriod;
    this.lastSchoolPeriod = schoolPeriod;

    this.rebalanceTimer -= clampedDt;
    if (forceRebalance || periodChanged || this.rebalanceTimer <= 0) {
      this.rebalance(
        focusX,
        focusZ,
        activeRegions,
        schoolPeriod,
        churchOpen,
        isSlotLocked,
        minute,
        timeMode,
        periodChanged,
      );
      this.rebalanceTimer = 0.35;
    }

    for (let si = 0; si < this.slots.length; si++) {
      const m = this.slots[si].member;
      if (!m) continue;
      if (isSlotLocked && isSlotLocked(si)) {
        m.elapsed += clampedDt;
        continue;
      }
      this.stepMember(m, clampedDt, schoolPeriod, minute, timeMode);
    }

    // Update live chalk progress on all active pooled blackboards
    if (schoolPeriod === 'class') {
      for (let bi = 0; bi < this.boardSlots.length; bi++) {
        const bs = this.boardSlots[bi];
        if (bs.anchor) {
          bs.lesson = computeClassroomLessonState(this.lessonClock, bs.anchor.roomSeed);
        }
      }
    }

    return { schoolOpen, churchOpen, schoolPeriod };
  }

  dispose(): void {
    this.assigned.clear();
    for (const s of this.slots) s.member = null;
    for (const bs of this.boardSlots) {
      bs.anchor = null;
      bs.lesson = null;
    }
  }
}
