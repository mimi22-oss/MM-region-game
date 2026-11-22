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
export type SchoolDormRole = 'teacher-dorm' | 'student-dorm';

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
  /** Ground-floor distinct separated classroom labels (e.g. ['KG', 'G-1', 'G-2', 'G-3']) */
  readonly rooms: readonly string[];
  /** Optional 2nd-floor distinct separated classroom labels for 2-storey halls */
  readonly upperRooms?: readonly string[];
  readonly storeys?: 1 | 2;
  /** Optional boarding dormitory designation (used 16:00–06:29 / evening / night) */
  readonly dormRole?: SchoolDormRole;
}

export interface ClassroomInSessionNotice {
  readonly message: string;
  readonly hallId: string;
  readonly hallName: string;
  readonly hallX: number;
  readonly hallZ: number;
  readonly roomLabel: string;
  readonly seq: number;
}

let schoolClassInSession = false;
let classroomNoticeSeq = 0;
let lastClassroomNoticeAt = 0;
let activeClassroomNotice: ClassroomInSessionNotice | null = null;
const classroomNoticeListeners = new Set<() => void>();

export function setSchoolClassInSession(active: boolean): void {
  schoolClassInSession = active;
}

export function isSchoolClassInSession(): boolean {
  return schoolClassInSession;
}

export function getClassroomNoticeSnapshot(): ClassroomInSessionNotice | null {
  return activeClassroomNotice;
}

export function clearClassroomNotice(): void {
  if (!activeClassroomNotice) return;
  activeClassroomNotice = null;
  for (const fn of classroomNoticeListeners) fn();
}

export function subscribeClassroomNotice(listener: () => void): () => void {
  classroomNoticeListeners.add(listener);
  return () => classroomNoticeListeners.delete(listener);
}

function triggerClassroomInSessionNotice(spec: SchoolHallSpec, roomLabel: string): void {
  const now = Date.now();
  if (now - lastClassroomNoticeAt < 1800) return;
  lastClassroomNoticeAt = now;
  classroomNoticeSeq += 1;
  activeClassroomNotice = {
    message: `စာသင်နေပါသည် (${roomLabel}) — နားချိန်မှသာ စာသင်ခန်းထဲ ဝင်နိုင်ပါမည်`,
    hallId: spec.id,
    hallName: spec.name,
    hallX: spec.x,
    hallZ: spec.z,
    roomLabel,
    seq: classroomNoticeSeq,
  };
  for (const fn of classroomNoticeListeners) fn();
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
  readonly upperFloorY: number;
  readonly wallHeight: number;
  readonly verandaDepth: number;
  readonly zBack: number;
  readonly zFrontWall: number;
  readonly zVerandaEdge: number;
  readonly wallThickness: number;
  readonly classrooms: readonly SeparatedClassroomSlot[];
  readonly upperClassrooms: readonly SeparatedClassroomSlot[];
  readonly wallObstacles: readonly CanonicalWallBox[];
  /** Staircase parameters for 2-storey halls (mounted cleanly on the +X veranda side!) */
  readonly stairStartX: number;
  readonly stairRunLength: number;
  readonly stairCenterZ: number;
  readonly stairWidth: number;
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

export interface ClassroomDeskSeat {
  readonly hallId: string;
  readonly schoolZoneId: string;
  readonly regionId: string;
  readonly storey: 0 | 1;
  readonly roomIndex: number;
  readonly roomLabel: string;
  readonly roomSeed: number;
  readonly anchorX: number;
  readonly anchorZ: number;
  readonly rotation: number;
  readonly lx: number;
  readonly lz: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
  /** Facing toward the green blackboard (-Z in canonical hall coordinates) */
  readonly facingYaw: number;
}

export interface ClassroomBlackboardAnchor {
  readonly id: string;
  readonly hallId: string;
  readonly schoolZoneId: string;
  readonly regionId: string;
  readonly storey: 0 | 1;
  readonly roomIndex: number;
  readonly roomLabel: string;
  readonly roomSeed: number;
  readonly anchorX: number;
  readonly anchorZ: number;
  readonly rotation: number;
  /** Canonical local X of the room's blackboard center */
  readonly boardLx: number;
  /** Canonical local Z of the writable green surface (+0.02m proud of board) */
  readonly boardSurfaceLz: number;
  /** World XYZ of the blackboard center */
  readonly boardWorldX: number;
  readonly boardWorldY: number;
  readonly boardWorldZ: number;
  /** Writable green surface dimensions (m) */
  readonly boardWidth: number;
  readonly boardHeight: number;
  /** Teacher standing Z right in front of the blackboard (writing/erasing) */
  readonly teacherBoardLz: number;
  /** Teacher waiting Z facing the seated class (explaining / transitioning) */
  readonly teacherWaitLz: number;
  /** Teacher wooden chair canonical local X (behind teacher's desk facing students) */
  readonly teacherChairLx: number;
  /** Teacher wooden chair canonical local Z (behind teacher's desk facing students) */
  readonly teacherChairLz: number;
  readonly floorY: number;
}

export const SCHOOL_FLOOR_Y = 0.28;
export const STUDENTS_PER_CLASSROOM = 15;
export const STUDENT_DESK = { topY: .75, thickness: .06, depth: .46, benchOffset: .42 } as const;
const WALL_THICKNESS = 0.22;

export interface ClassroomDeskRowSpec {
  readonly deskX: number;
  readonly deskZ: number;
  readonly deskW: number;
  readonly seatFracs: readonly number[];
}

/**
 * Single source of truth for classroom wooden desk & bench placement (`3 rows × (3 + 2) = 15 seats/room`).
 * Shared identically by `<SchoolClassroomHall>` (3D benches) and `getHallDeskSeats` (student seat coordinates)
 * so all 15 students per room sit cleanly on wooden benches with generous spacing and ZERO overlap.
 */
export function computeClassroomDeskSpecs(
  room: Pick<SeparatedClassroomSlot, 'cx' | 'roomWidth'>,
  roomDepth: number,
  zBack: number,
): ClassroomDeskRowSpec[] {
  const desks: ClassroomDeskRowSpec[] = [];
  const deskRows = 3;
  const rowPitch = Math.min(1.42, Math.max(1.06, (roomDepth - 2.85) / deskRows));
  const innerW = Math.max(3.4, room.roomWidth - 0.6);
  const deskWLeft = Math.min(2.46, innerW * 0.53);
  const deskWRight = Math.min(1.68, innerW * 0.36);
  const aisle = Math.min(0.85, Math.max(0.36, innerW - deskWLeft - deskWRight));
  const groupSpan = deskWLeft + aisle + deskWRight;
  const leftStart = room.cx - groupSpan / 2;
  const leftDeskX = leftStart + deskWLeft / 2;
  const rightDeskX = leftStart + deskWLeft + aisle + deskWRight / 2;

  for (let rIdx = 0; rIdx < deskRows; rIdx++) {
    const deskZ = zBack + 2.22 + rIdx * rowPitch;
    // Left bench: 3 students side-by-side; Right bench: 2 students side-by-side -> 5/row × 3 rows = 15/room!
    desks.push({
      deskX: leftDeskX,
      deskZ,
      deskW: deskWLeft,
      seatFracs: [-0.33, 0, 0.33],
    });
    desks.push({
      deskX: rightDeskX,
      deskZ,
      deskW: deskWRight,
      seatFracs: [-0.25, 0.25],
    });
  }
  return desks;
}

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

  const upperLabels =
    spec.storeys === 2
      ? (spec.upperRooms && spec.upperRooms.length === classrooms.length
          ? spec.upperRooms
          : spec.rooms.map(r => `2F-${r}`))
      : [];
  const upperClassrooms: SeparatedClassroomSlot[] = upperLabels.map((label, idx) => ({
    ...classrooms[idx],
    label,
  }));
  const upperFloorY = Number((SCHOOL_FLOOR_Y + wallHeight + 0.18).toFixed(3));
  const stairRunLength = Math.min(7.2, Math.max(5.6, hallLength * 0.34));
  const stairStartX = hallLength / 2 - stairRunLength - 1.2;
  const stairWidth = 1.65;
  const stairCenterZ = zVerandaEdge + stairWidth / 2 + 0.08;

  return {
    hallLength,
    hallDepth,
    canonicalRotation,
    floorY: SCHOOL_FLOOR_Y,
    upperFloorY,
    wallHeight,
    verandaDepth,
    zBack,
    zFrontWall,
    zVerandaEdge,
    wallThickness: WALL_THICKNESS,
    classrooms,
    upperClassrooms,
    wallObstacles,
    stairStartX,
    stairRunLength,
    stairCenterZ,
    stairWidth,
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

function hashRoomKey(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 997;
}

export interface ClassroomDormZone {
  readonly hallId: string;
  readonly schoolZoneId: string;
  readonly dormRole: SchoolDormRole;
  readonly centerX: number;
  readonly centerZ: number;
  readonly rotation: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly worldY: number;
}

/**
 * Generates boarding dormitory hangout zones (open veranda + interior floor on 1F/2F)
 * for halls designated as `'teacher-dorm'` or `'student-dorm'`.
 */
export function getHallDormitoryZones(spec: SchoolHallSpec): ClassroomDormZone[] {
  if (!spec.dormRole) return [];
  const layout = computeClassroomLayout(spec);
  const zones: ClassroomDormZone[] = [];
  const storeys: { floorY: number; rooms: readonly SeparatedClassroomSlot[] }[] = [
    { floorY: layout.floorY, rooms: layout.classrooms },
  ];
  if (layout.upperClassrooms.length > 0) {
    storeys.push({ floorY: layout.upperFloorY, rooms: layout.upperClassrooms });
  }
  for (const st of storeys) {
    // Veranda lounge strip
    zones.push({
      hallId: spec.id,
      schoolZoneId: spec.schoolZoneId,
      dormRole: spec.dormRole,
      centerX: spec.x,
      centerZ: spec.z,
      rotation: layout.canonicalRotation,
      minX: -layout.hallLength / 2 + 1.0,
      maxX: layout.hallLength / 2 - 1.0,
      minZ: layout.zFrontWall + 0.5,
      maxZ: layout.zVerandaEdge - 0.5,
      worldY: st.floorY,
    });
    // Interior dorm rooms
    for (const room of st.rooms) {
      zones.push({
        hallId: spec.id,
        schoolZoneId: spec.schoolZoneId,
        dormRole: spec.dormRole,
        centerX: spec.x,
        centerZ: spec.z,
        rotation: layout.canonicalRotation,
        minX: room.xMin + 0.65,
        maxX: room.xMax - 0.65,
        minZ: layout.zBack + 0.9,
        maxZ: layout.zFrontWall - 0.85,
        worldY: st.floorY,
      });
    }
  }
  return zones;
}

/**
 * Computes exact seated student bench coordinates matching `<SchoolClassroomHall>`'s
 * 3D wooden desk & bench rows across BOTH Ground Floor (`storey: 0`) AND 2nd Floor (`storey: 1`)
 * so every seated student sits cleanly ON a unique bench facing the blackboard with ZERO overlap!
 */
export function getHallDeskSeats(spec: SchoolHallSpec): ClassroomDeskSeat[] {
  const layout = computeClassroomLayout(spec);
  const seats: ClassroomDeskSeat[] = [];
  const roomDepth = layout.zFrontWall - layout.zBack;
  const c = Math.cos(layout.canonicalRotation);
  const s = Math.sin(layout.canonicalRotation);
  const facingYaw = layout.canonicalRotation + Math.PI;

  const floors: { storey: 0 | 1; floorY: number; rooms: readonly SeparatedClassroomSlot[] }[] = [
    { storey: 0, floorY: layout.floorY, rooms: layout.classrooms },
  ];
  if (layout.upperClassrooms.length > 0) {
    floors.push({ storey: 1, floorY: layout.upperFloorY, rooms: layout.upperClassrooms });
  }

  for (const fl of floors) {
    for (const room of fl.rooms) {
      const roomSeed = hashRoomKey(`${spec.id}:f${fl.storey}:${room.index}:${room.label}`);
      const deskSpecs = computeClassroomDeskSpecs(room, roomDepth, layout.zBack);

      for (const desk of deskSpecs) {
        for (const frac of desk.seatFracs) {
          const lx = desk.deskX + frac * desk.deskW;
          const lz = desk.deskZ + STUDENT_DESK.benchOffset;
          seats.push({
            hallId: spec.id,
            schoolZoneId: spec.schoolZoneId,
            regionId: spec.regionId,
            storey: fl.storey,
            roomIndex: room.index,
            roomLabel: room.label,
            roomSeed,
            anchorX: spec.x,
            anchorZ: spec.z,
            rotation: layout.canonicalRotation,
            lx,
            lz,
            worldX: spec.x + lx * c + lz * s,
            worldY: fl.floorY,
            worldZ: spec.z - lx * s + lz * c,
            facingYaw,
          });
        }
      }
    }
  }

  return seats;
}

/**
 * Computes exact green blackboard surface anchors for live chalk writing / erasing overlays
 * AND exact teacher standing positions for EVERY separated classroom on BOTH 1st & 2nd floors!
 */
export function getHallBlackboardAnchors(spec: SchoolHallSpec): ClassroomBlackboardAnchor[] {
  const layout = computeClassroomLayout(spec);
  const anchors: ClassroomBlackboardAnchor[] = [];
  const c = Math.cos(layout.canonicalRotation);
  const s = Math.sin(layout.canonicalRotation);
  const boardSurfaceLz = layout.zBack + layout.wallThickness / 2 + 0.115;
  const teacherBoardLz = layout.zBack + layout.wallThickness / 2 + 0.56;
  const teacherWaitLz = layout.zBack + layout.wallThickness / 2 + 1.25;

  const floors: { storey: 0 | 1; floorY: number; rooms: readonly SeparatedClassroomSlot[] }[] = [
    { storey: 0, floorY: layout.floorY, rooms: layout.classrooms },
  ];
  if (layout.upperClassrooms.length > 0) {
    floors.push({ storey: 1, floorY: layout.upperFloorY, rooms: layout.upperClassrooms });
  }

  for (const fl of floors) {
    for (const room of fl.rooms) {
      const roomSeed = hashRoomKey(`${spec.id}:f${fl.storey}:${room.index}:${room.label}`);
      const boardWidth = Math.min(3.2, room.roomWidth * 0.5);
      const boardHeight = 1.18;
      const lx = room.cx;
      const lz = boardSurfaceLz;
      const teacherChairLx = room.cx - Math.min(0.9, room.roomWidth * 0.15);
      const teacherChairLz = layout.zBack + 0.91;

      anchors.push({
        id: fl.storey === 0 ? `${spec.id}-board-${room.index}` : `${spec.id}-f2-board-${room.index}`,
        hallId: spec.id,
        schoolZoneId: spec.schoolZoneId,
        regionId: spec.regionId,
        storey: fl.storey,
        roomIndex: room.index,
        roomLabel: room.label,
        roomSeed,
        anchorX: spec.x,
        anchorZ: spec.z,
        rotation: layout.canonicalRotation,
        boardLx: lx,
        boardSurfaceLz: lz,
        boardWorldX: spec.x + lx * c + lz * s,
        boardWorldY: fl.floorY + 1.75,
        boardWorldZ: spec.z - lx * s + lz * c,
        boardWidth,
        boardHeight,
        teacherBoardLz,
        teacherWaitLz,
        teacherChairLx,
        teacherChairLz,
        floorY: fl.floorY,
      });
    }
  }

  return anchors;
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
    upperRooms: spec.upperRooms,
    storeys: spec.storeys,
    dormRole: spec.dormRole,
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
    name: 'အလက ကြာအင်း ရုံးခန်းနှင့် ဆရာအဆောင်',
    u: 25,
    v: 3824,
    width: 14,
    depth: 10.5,
    height: 5.5,
    wallColor: '#dad3c2',
    roofColor: '#984a3b',
    verandaSide: '+z',
    rooms: ['ရုံးခန်း', 'ဆရာခန်း'],
    dormRole: 'teacher-dorm',
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
    name: 'အလက ကြာအင်း အရှေ့တောင် ကျောင်းသားအဆောင်',
    u: 116,
    v: 3882,
    width: 10.5,
    depth: 20,
    height: 6,
    wallColor: '#e5dfd2',
    roofColor: '#963e32',
    verandaSide: '-x',
    rooms: ['သိပ္ပံခန်း', 'ခန်းမ'],
    dormRole: 'student-dorm',
  }),
  hallFromUV({
    id: 'ki-school-south-hall',
    regionId: 'kyarinn',
    schoolZoneId: 'school-kyarinn-bems',
    name: 'အလက ကြာအင်း တောင်ဘက် စာသင်နှင့် အိပ်ဆောင်',
    u: 62,
    v: 3876,
    width: 44,
    depth: 10.5,
    height: 6.5,
    wallColor: '#e4decb',
    roofColor: '#2f6a4f',
    verandaSide: '-z',
    rooms: ['G-10A', 'G-10B', 'G-11A', 'G-11B', 'ကွန်ပျူတာ'],
    dormRole: 'student-dorm',
  }),

  // =========================================================================
  // 2. ထောက်ကြန့်ရွာ — အထက ထောက်ကြန့် (6 halls, 2F walk-in + boarding dorms!)
  // =========================================================================
  hallFromUV({
    id: 'hk-landmark-school-main',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် ပင်မ ၂ ထပ် ကျောင်းဆောင်ကြီး',
    u: -106,
    v: 3280,
    width: 44,
    depth: 13,
    height: 8.5,
    rotation: htaukKyantSchoolRot,
    wallColor: '#e2dbcc',
    roofColor: '#9e4536',
    verandaSide: '+z',
    rooms: ['ရုံးခန်း', 'G-10A', 'G-10B', 'G-11A', 'G-11B', 'G-12A'],
    upperRooms: ['2F-G10C', '2F-G11C', '2F-G12B', '2F-G12C', '2F-Bio', '2F-Eco'],
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
    name: 'အထက ထောက်ကြန့် တောင်ဘက် ကျောင်းသားအဆောင်',
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
    dormRole: 'student-dorm',
  }),
  hallFromUV({
    id: 'hk-landmark-school-wing',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် ကျောင်းသူအဆောင်',
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
    dormRole: 'student-dorm',
  }),
  hallFromUV({
    id: 'hk-school-east-annex',
    regionId: 'htaukkyant',
    schoolZoneId: 'school-htaukkyant-behs',
    name: 'အထက ထောက်ကြန့် ဆရာ/ဆရာမ အဆောင်',
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
    dormRole: 'teacher-dorm',
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
  // 3. ထိုမာရွာ — အထက-ထိုမာ (4 halls, teacher dorm + student dorm)
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
    name: 'အထက-ထိုမာ · တောင်ဘက် ကျောင်းသားအဆောင်',
    u: 361,
    v: 1852,
    width: 34,
    depth: 10,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#964638',
    verandaSide: '-z',
    rooms: ['G-7', 'G-8', 'G-9', 'G-10'],
    dormRole: 'student-dorm',
  }),
  hallFromUV({
    id: 'htomar-campus-behs-lab',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-behs',
    name: 'အထက-ထိုမာ · ဆရာ/ဆရာမ အဆောင်',
    u: 403,
    v: 1852,
    width: 34,
    depth: 10,
    height: 6.5,
    wallColor: '#e5dfd2',
    roofColor: '#964638',
    verandaSide: '-z',
    rooms: ['G-11', 'G-12', 'သိပ္ပံခန်း', 'စာကြည့်တိုက်'],
    dormRole: 'teacher-dorm',
  }),

  // =========================================================================
  // 4. ထိုမာရွာ — GTHS (Khamtee) & Technological University, Kalay (2F walk-in + dorms)
  // =========================================================================
  hallFromUV({
    id: 'htomar-campus-gths-main',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-gths',
    name: 'GTHS (Khamtee) · ပင်မ ၂ ထပ် စာသင်ဆောင်',
    u: -94,
    v: 1742,
    width: 26,
    depth: 11,
    height: 7.4,
    wallColor: '#e7d7b4',
    roofColor: '#8b5545',
    verandaSide: '-z',
    rooms: ['Civil-1', 'EC-1', 'EP-1', 'Mech-1'],
    upperRooms: ['2F-Civil', '2F-EC', '2F-EP', '2F-Mech'],
    storeys: 2,
  }),
  hallFromUV({
    id: 'htomar-campus-gths-west-1',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-gths',
    name: 'GTHS (Khamtee) · ဆရာ/ဆရာမ အဆောင်',
    u: -154,
    v: 1676,
    width: 28,
    depth: 10,
    height: 6.8,
    wallColor: '#dde5dc',
    roofColor: '#6d9178',
    verandaSide: '+z',
    rooms: ['Lab-A', 'Lab-B', 'IT-1', 'IT-2'],
    dormRole: 'teacher-dorm',
  }),
  hallFromUV({
    id: 'htomar-campus-gths-west-2',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-gths',
    name: 'GTHS (Khamtee) · ကျောင်းသား/ကျောင်းသူ အဆောင်',
    u: -154,
    v: 1742,
    width: 28,
    depth: 10,
    height: 6.8,
    wallColor: '#dde5dc',
    roofColor: '#6d9178',
    verandaSide: '-z',
    rooms: ['Civil-2', 'EC-2', 'EP-2', 'Mech-2'],
    dormRole: 'student-dorm',
  }),
  hallFromUV({
    id: 'htomar-campus-tu-north-wing',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-tu-kalay',
    name: 'TU Kalay · မြောက်ဘက် ၂ ထပ် ဆရာအဆောင်နှင့် စာသင်ဆောင်',
    u: -196,
    v: 1796,
    width: 48,
    depth: 11,
    height: 7.4,
    wallColor: '#e8d8b8',
    roofColor: '#bc4b3c',
    verandaSide: '+z',
    rooms: ['Civil', 'Mech', 'EP', 'EC', 'IT', 'Arch'],
    upperRooms: ['2F-CE', '2F-ME', '2F-EP', '2F-EC', '2F-IT', '2F-Arch'],
    storeys: 2,
    dormRole: 'teacher-dorm',
  }),
  hallFromUV({
    id: 'htomar-campus-tu-south-wing',
    regionId: 'htomar',
    schoolZoneId: 'school-htomar-tu-kalay',
    name: 'TU Kalay · တောင်ဘက် ၂ ထပ် ကျောင်းသားအဆောင်နှင့် စာသင်ဆောင်',
    u: -196,
    v: 1864,
    width: 48,
    depth: 11,
    height: 7.4,
    wallColor: '#e8d8b8',
    roofColor: '#bc4b3c',
    verandaSide: '-z',
    rooms: ['Math', 'Phys', 'Chem', 'Eng', 'Myan', 'Lab'],
    upperRooms: ['2F-M2', '2F-P2', '2F-C2', '2F-E2', '2F-My2', '2F-Lab'],
    storeys: 2,
    dormRole: 'student-dorm',
  }),

  // =========================================================================
  // 5. ကံပုလဲရွာ — ကံပုလဲ အခြေခံပညာကျောင်း (2F walk-in + teacher dorm + student dorm)
  // =========================================================================
  kanbaleHallFromLocal(2.5, 1.5, {
    id: 'kanbale-school-main-hall',
    name: 'ကံပုလဲကျောင်း · ပင်မ ၂ ထပ် စာသင်ဆောင်ကြီး',
    width: 34,
    depth: 10.5,
    height: 8.0,
    wallColor: '#f8fafc',
    roofColor: '#1b4332',
    verandaSide: '-z',
    rooms: ['ရုံးခန်း', 'KG', 'G-1', 'G-2', 'G-3'],
    upperRooms: ['2F-G4', '2F-G5', '2F-G6', '2F-G7', '2F-G8'],
    storeys: 2,
  }),
  kanbaleHallFromLocal(-10.5, -15.5, {
    id: 'kanbale-school-left-wing',
    name: 'ကံပုလဲကျောင်း · ကျောင်းသား/ကျောင်းသူ အဆောင်',
    width: 9.5,
    depth: 24,
    height: 5.8,
    wallColor: '#f8fafc',
    roofColor: '#1b4332',
    verandaSide: '+x',
    rooms: ['G-4', 'G-5', 'G-6', 'G-7'],
    dormRole: 'student-dorm',
  }),
  kanbaleHallFromLocal(15.5, -15.5, {
    id: 'kanbale-school-right-wing',
    name: 'ကံပုလဲကျောင်း · ဆရာ/ဆရာမ အဆောင်',
    width: 9.5,
    depth: 24,
    height: 5.8,
    wallColor: '#f8fafc',
    roofColor: '#1b4332',
    verandaSide: '-x',
    rooms: ['G-8', 'G-9', 'G-10', 'သိပ္ပံခန်း'],
    dormRole: 'teacher-dorm',
  }),

  // =========================================================================
  // 6. နတ်မြောင်းရွာ — အမက နတ်မြောင်း & အထက နတ်မြောင်း (2F walk-in!)
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
    name: 'အထက-နတ်မြောင်း (၂ ထပ် အထက်တန်းကျောင်း)',
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
    upperRooms: ['2F-G11A', '2F-G11B', '2F-G12A', '2F-G12B', '2F-Lab'],
    storeys: 2,
  },

  // =========================================================================
  // 7. သာစည်ရွာ — သာစည် အခြေခံပညာကျောင်း (3 halls, 18 classrooms incl. 2F!)
  //    Centered around Ward 6 school plot (u = -271, v = 880) facing Main Road
  // =========================================================================
  hallFromUV({
    id: 'tharsi-school-main-hall',
    regionId: 'tharsi',
    schoolZoneId: 'school-tharsi-behs',
    name: 'သာစည်ကျောင်း · ပင်မ ၂ ထပ် စာသင်ဆောင်ကြီး',
    u: -271,
    v: 906,
    width: 38,
    depth: 11,
    height: 8.0,
    wallColor: '#ece5d3',
    roofColor: '#2f6a4f',
    verandaSide: '-z',
    rooms: ['ရုံးခန်း', 'G-6', 'G-7', 'G-8', 'G-9'],
    upperRooms: ['2F-G10A', '2F-G10B', '2F-G11A', '2F-G11B', '2F-G12'],
    storeys: 2,
  }),
  hallFromUV({
    id: 'tharsi-school-west-hall',
    regionId: 'tharsi',
    schoolZoneId: 'school-tharsi-behs',
    name: 'သာစည်ကျောင်း · အနောက်ဘက် မူလတန်းဆောင်',
    u: -305,
    v: 868,
    width: 10.5,
    depth: 36,
    height: 6.2,
    wallColor: '#ece5d3',
    roofColor: '#984a3b',
    verandaSide: '+x',
    rooms: ['KG', 'G-1', 'G-2', 'G-3'],
  }),
  hallFromUV({
    id: 'tharsi-school-east-hall',
    regionId: 'tharsi',
    schoolZoneId: 'school-tharsi-behs',
    name: 'သာစည်ကျောင်း · အရှေ့ဘက် အလယ်တန်းဆောင်',
    u: -237,
    v: 868,
    width: 10.5,
    depth: 36,
    height: 6.2,
    wallColor: '#ece5d3',
    roofColor: '#984a3b',
    verandaSide: '-x',
    rooms: ['G-4', 'G-5', 'သိပ္ပံခန်း', 'စာကြည့်တိုက်'],
  }),

  // =========================================================================
  // 8. မြို့သာရပ်ကွက် အလယ် — မြို့သာ အခြေခံပညာကျောင်း (3 halls, 16 classrooms incl. 2F!)
  //    East-facing U-quadrangle opening directly to East Gate (u=-103.25, v=-926.55) & road way/239609161
  // =========================================================================
  hallFromUV({
    id: 'myothar-school-main-hall',
    regionId: 'myothar',
    schoolZoneId: 'school-myothar-behs',
    name: 'မြို့သာကျောင်း · ပင်မ ၂ ထပ် စာသင်ဆောင်ကြီး',
    u: -157,
    v: -924,
    width: 10.5,
    depth: 36,
    height: 8.0,
    wallColor: '#ece5d3',
    roofColor: '#2f6a4f',
    verandaSide: '+x',
    rooms: ['ရုံးခန်း', 'G-6', 'G-7', 'G-8', 'G-9'],
    upperRooms: ['2F-G10A', '2F-G10B', '2F-G11A', '2F-G11B', '2F-G12'],
    storeys: 2,
  }),
  hallFromUV({
    id: 'myothar-school-west-hall',
    regionId: 'myothar',
    schoolZoneId: 'school-myothar-behs',
    name: 'မြို့သာကျောင်း · မြောက်ဘက် မူလတန်းဆောင်',
    u: -132,
    v: -947,
    width: 26,
    depth: 9.5,
    height: 6.0,
    wallColor: '#ece5d3',
    roofColor: '#984a3b',
    verandaSide: '+z',
    rooms: ['KG', 'G-1', 'G-2'],
  }),
  hallFromUV({
    id: 'myothar-school-east-hall',
    regionId: 'myothar',
    schoolZoneId: 'school-myothar-behs',
    name: 'မြို့သာကျောင်း · တောင်ဘက် အလယ်တန်းဆောင်',
    u: -132,
    v: -901,
    width: 26,
    depth: 9.5,
    height: 6.0,
    wallColor: '#ece5d3',
    roofColor: '#984a3b',
    verandaSide: '-z',
    rooms: ['G-3', 'G-4', 'G-5'],
  }),
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
 * Exact walk-in wall & doorway collision check for ALL multi-classroom school halls (1F & 2F).
 * - During **recess / break / lunch / closed**: open doorways (`1.8m`) and separated classrooms
 *   are freely walkable on BOTH Ground Floor and 2nd Floor!
 * - During **active class time (`schoolClassInSession === true`)**: exterior veranda & stairs
 *   remain 100% walkable, while classroom doorways & interiors block entry and trigger a brief
 *   Myanmar toast notice ("စာသင်နေပါသည် — နားချိန်မှသာ စာသင်ခန်းထဲ ဝင်နိုင်ပါမည်")!
 */
export function canStandWalkInSchoolHalls(
  x: number,
  z: number,
  playerRadius = 0.4,
  emitNotice = true,
): boolean {
  for (let i = 0; i < PREPARED_HALL_COLLIDERS.length; i++) {
    const entry = PREPARED_HALL_COLLIDERS[i];
    const dx = x - entry.spec.x;
    const dz = z - entry.spec.z;
    if (dx * dx + dz * dz > entry.boundR * entry.boundR) continue;

    const lx = dx * entry.cosR - dz * entry.sinR;
    const lz = dx * entry.sinR + dz * entry.cosR;
    const layout = entry.layout;

    // During active class time, block entering classroom doorways/interiors (leaving veranda & stairs walkable!)
    if (
      schoolClassInSession &&
      lx >= -layout.hallLength / 2 - playerRadius &&
      lx <= layout.hallLength / 2 + playerRadius &&
      lz >= layout.zBack - playerRadius &&
      lz <= layout.zFrontWall + playerRadius + 0.12
    ) {
      if (emitNotice) {
        // Find nearest classroom label for the transient toast message
        const room =
          layout.classrooms.find(r => lx >= r.xMin - 0.5 && lx <= r.xMax + 0.5) ??
          layout.classrooms[0];
        triggerClassroomInSessionNotice(entry.spec, room?.label ?? 'စာသင်ခန်း');
      }
      return false;
    }

    const obstacles = layout.wallObstacles;
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
 * Checks whether the player's own movement target `(x, z)` is blocked by a locked
 * classroom during active class time and emits the transient notice ONLY for the player.
 */
export function notifyBlockedClassroomAt(x: number, z: number, playerRadius = 0.4): boolean {
  if (!schoolClassInSession) return false;
  for (let i = 0; i < PREPARED_HALL_COLLIDERS.length; i++) {
    const entry = PREPARED_HALL_COLLIDERS[i];
    const dx = x - entry.spec.x;
    const dz = z - entry.spec.z;
    if (dx * dx + dz * dz > entry.boundR * entry.boundR) continue;

    const lx = dx * entry.cosR - dz * entry.sinR;
    const lz = dx * entry.sinR + dz * entry.cosR;
    const layout = entry.layout;
    if (
      lx >= -layout.hallLength / 2 - playerRadius &&
      lx <= layout.hallLength / 2 + playerRadius &&
      lz >= layout.zBack - playerRadius &&
      lz <= layout.zFrontWall + playerRadius + 0.12
    ) {
      const room =
        layout.classrooms.find(r => lx >= r.xMin - 0.5 && lx <= r.xMax + 0.5) ??
        layout.classrooms[0];
      triggerClassroomInSessionNotice(entry.spec, room?.label ?? 'စာသင်ခန်း');
      return true;
    }
  }
  return false;
}

/**
 * If the player happens to already be standing inside a classroom when the class bell rings
 * (`schoolClassInSession === true`), gently steps them onto the open veranda right outside the door
 * and shows the transient Burmese class-in-session toast so they can never get trapped indoors.
 */
export function evictFromLockedClassroom(x: number, z: number): { x: number; z: number } | null {
  if (!schoolClassInSession) return null;
  for (let i = 0; i < PREPARED_HALL_COLLIDERS.length; i++) {
    const entry = PREPARED_HALL_COLLIDERS[i];
    const dx = x - entry.spec.x;
    const dz = z - entry.spec.z;
    if (dx * dx + dz * dz > entry.boundR * entry.boundR) continue;

    const lx = dx * entry.cosR - dz * entry.sinR;
    const lz = dx * entry.sinR + dz * entry.cosR;
    const layout = entry.layout;

    if (
      lx >= -layout.hallLength / 2 &&
      lx <= layout.hallLength / 2 &&
      lz >= layout.zBack &&
      lz <= layout.zFrontWall + 0.3
    ) {
      const room =
        layout.classrooms.find(r => lx >= r.xMin - 0.5 && lx <= r.xMax + 0.5) ??
        layout.classrooms[0];
      triggerClassroomInSessionNotice(entry.spec, room?.label ?? 'စာသင်ခန်း');
      const exitLx = room ? room.doorX : lx;
      const exitLz = layout.zFrontWall + Math.min(1.15, layout.verandaDepth * 0.55);
      return {
        x: entry.spec.x + exitLx * entry.cosR + exitLz * entry.sinR,
        z: entry.spec.z - exitLx * entry.sinR + exitLz * entry.cosR,
      };
    }
  }
  return null;
}

/**
 * Finds the nearest walk-in school hall if `(x, z)` is inside or looking closely at any school campus.
 * Used by the HUD to hide `.ghost-hud-container` and show the live school clock & schedule pill instead.
 */
export function findNearestSchoolHall(
  x: number,
  z: number,
  margin = 48,
): SchoolHallSpec | null {
  let best: SchoolHallSpec | null = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < PREPARED_HALL_COLLIDERS.length; i++) {
    const entry = PREPARED_HALL_COLLIDERS[i];
    const dx = x - entry.spec.x;
    const dz = z - entry.spec.z;
    const distSq = dx * dx + dz * dz;
    const maxR = entry.boundR + margin;
    if (distSq <= maxR * maxR && distSq < bestDistSq) {
      bestDistSq = distSq;
      best = entry.spec;
    }
  }
  return best;
}

/**
 * Returns total walk-in classroom building area (m²) & separated classroom count (1F + 2F) for a given school zone.
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
    const layout = computeClassroomLayout(h);
    roomCount += layout.classrooms.length + layout.upperClassrooms.length;
    floorAreaSqM += h.width * h.depth * (h.storeys === 2 ? 1.5 : 1);
  }
  return {
    hallCount: halls.length,
    roomCount,
    floorAreaSqM: Math.round(floorAreaSqM),
    houseEquivalents: Number((floorAreaSqM / 48.75).toFixed(1)),
  };
}
