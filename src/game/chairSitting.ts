import { useSyncExternalStore } from 'react';
import { angle, farmhouse } from '../data/ward.ts';
import { nankaleinTeaShopData } from '../data/wards/kalayArea1/kalayArea1TeaShop.ts';
import {
  getSpecialActionState,
  loadRawSpecialActionAsset,
  playSpecialAction,
  resolveSpecialActionId,
  stopSpecialAction,
} from './specialActions.ts';

export const CHAIR_SITTING_IDLE_ID = 'sitting-idle';
export const CHAIR_SIT_TO_STAND_ID = 'sit-to-stand';
export const DEFAULT_STAND_HEIGHT = 0.45;
export const PROXIMITY_SIT_DELAY_SEC = 2.0;
export const CHAIR_PROXIMITY_RADIUS = 1.25;
export const STAND_UP_TOTAL_DURATION_SEC = 1.95;
/** sit-to-stand.glb keeps hips seated during 0..0.82s and rises vertically during 0.82..1.60s. */
export const STAND_UP_RISE_START_SEC = 0.82;
export const STAND_UP_RISE_END_SEC = 1.6;
/** Only step out to the collision-free exit spot after the character has stood straight up off the chair. */
export const STAND_UP_EXIT_START_SEC = 1.25;
export const STAND_UP_EXIT_END_SEC = 1.9;
export const STAND_UP_EARLY_WALK_SEC = 1.8;
export const STAND_UP_RE_SIT_COOLDOWN_SEC = 2.5;

export interface ChairSpot {
  id: string;
  x: number;
  z: number;
  /** Exact world Y of the chair's top sitting surface (preferred for authored static chairs). */
  seatTopY?: number;
  /** Seat surface height above local floor (used when seatTopY is not specified). */
  seatHeight: number;
  /** Avatar bodyYaw so the character's back rests against the backrest and front faces away from it. */
  yaw?: number;
  /** Guaranteed collision-free world coordinates to place the player upon standing up. */
  exitX?: number;
  exitZ?: number;
  label?: string;
  type?: 'chair' | 'stool' | 'bench' | 'sofa';
}

export type ChairSittingStatus = 'IDLE' | 'SITTING' | 'STANDING_UP';

export interface ChairSittingSnapshot {
  readonly status: ChairSittingStatus;
  readonly activeChair: ChairSpot | null;
  readonly nearChair: ChairSpot | null;
  readonly nearTime: number;
  /** Signed offset relative to groundY (kept for backwards compatibility and tests). */
  readonly heightOffset: number;
  /** Current world position the player should occupy while SITTING or STANDING_UP. */
  readonly seatPos: { readonly x: number; readonly z: number } | null;
  /** Current target yaw while SITTING or STANDING_UP. */
  readonly seatYaw: number | null;
  /** 0 = fully seated on chair, 1 = fully standing on floor (used to blend seated avatar Y to groundY). */
  readonly standBlend: number;
}

export interface StepChairSittingOptions {
  playerX: number;
  playerZ: number;
  playerMoving: boolean;
  canSit: boolean;
  /** Optional collision predicate so standing up always places the player on a walkable spot. */
  canStand?: (x: number, z: number) => boolean;
  /** Current ground Y under player (used to compute exact heightOffset when seatTopY is present). */
  groundY?: number;
  /** Character height scale (appearance.human.height). Defaults to 1.0. */
  bodyScale?: number;
  /** Character preset ('boy' | 'girl') for exact butt-to-seat contact alignment. */
  preset?: string;
}

/**
 * Transforms local (lx, lz) inside a Three.js `<group position={[gx, 0, gz]} rotation={[0, rot, 0]}>`
 * to world (x, z), matching `Matrix4.makeRotationY(rot)`.
 */
export function localToWorldXZ(
  gx: number,
  gz: number,
  rot: number,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x: gx + lx * c + lz * s,
    z: gz - lx * s + lz * c,
  };
}

/**
 * Converts a local facing vector (fx, fz) inside a Three.js `<group rotation={[0, rot, 0]}>`
 * into avatar `bodyYaw`, where `bodyYaw = 0` faces world `-Z` and forward is `(-sin(yaw), -cos(yaw))`.
 */
export function localDirToBodyYaw(rot: number, fx: number, fz: number): number {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const wfx = fx * c + fz * s;
  const wfz = -fx * s + fz * c;
  return Math.atan2(-wfx, -wfz);
}

/**
 * Returns the exact world Y for `avatar.position.y` so the character's pelvis/thigh underside
 * rests directly on the chair's seat top surface with zero vertical gap.
 */
export function computeSeatedAvatarY(
  chair: ChairSpot,
  groundY: number,
  bodyScale = 1.0,
  preset = 'boy',
): number {
  const seatTopY = chair.seatTopY !== undefined ? chair.seatTopY : groundY + chair.seatHeight;
  // Measured directly from skinned mesh underside of sitting-idle.glb on normalized 1.8m GlbHuman rigs:
  // boy pelvis/thigh underside = 0.345m, girl = 0.295m (scales linearly with appearance.human.height).
  const buttContactLocalY = (preset === 'girl' ? 0.295 : 0.345) * bodyScale;
  return seatTopY - buttContactLocalY;
}

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const customChairRegistry = new Map<string, ChairSpot>();
const npcOccupiedChairs = new Map<string, Set<string>>();
const staticChairCache: ChairSpot[] = [];
let staticChairsInitialized = false;

/** Marks or clears a chair as occupied by an NPC bot (so the player cannot sit on top of them). */
export function setChairOccupiedByNpc(
  chairId: string,
  occupantId: string,
  occupied: boolean,
): void {
  if (occupied) {
    let set = npcOccupiedChairs.get(chairId);
    if (!set) {
      set = new Set();
      npcOccupiedChairs.set(chairId, set);
    }
    set.add(occupantId);
  } else {
    const set = npcOccupiedChairs.get(chairId);
    if (!set) return;
    set.delete(occupantId);
    if (set.size === 0) npcOccupiedChairs.delete(chairId);
  }
}

/** Releases all chairs currently held by `occupantId` (call on unmount or pool slot eviction). */
export function releaseNpcChairOccupant(occupantId: string): void {
  for (const [chairId, set] of npcOccupiedChairs) {
    if (set.delete(occupantId) && set.size === 0) {
      npcOccupiedChairs.delete(chairId);
    }
  }
}

/** Clears all NPC seat occupancy entries (primarily for unit tests). */
export function clearNpcChairOccupancy(): void {
  npcOccupiedChairs.clear();
}

/** Returns true if any NPC bot is currently occupying `chairId`. */
export function isChairOccupiedByNpc(chairId: string): boolean {
  const set = npcOccupiedChairs.get(chairId);
  return Boolean(set && set.size > 0);
}

/** Returns true if the player character is currently sitting on or standing up from `chairId`. */
export function isChairOccupiedByPlayer(chairId: string): boolean {
  return (
    runtime.activeChair?.id === chairId &&
    (runtime.status === 'SITTING' || runtime.status === 'STANDING_UP')
  );
}

function buildStaticChairs(): ChairSpot[] {
  const chairs: ChairSpot[] = [];

  // 1. Nankalein Tea Shop (48 Stools across 12 Tables)
  // Rendered inside <group position={[shop.x, 0, shop.z]} rotation={[0, shop.rotation, 0]}>
  // Each stool seat mesh is at y=0.42, height=0.04 => seatTopY = 0.44
  const shop = nankaleinTeaShopData;
  for (const table of shop.tables) {
    const floorY = table.isOutdoor ? shop.outdoor.floorY : shop.indoor.floorY;
    const seatTopY = 0.44;
    const seatHeight = seatTopY - floorY;

    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const ang = (sIdx * Math.PI) / 2;
      const sx = Math.cos(ang) * 0.95;
      const sz = Math.sin(ang) * 0.95;
      const pos = localToWorldXZ(shop.x, shop.z, shop.rotation, table.du + sx, table.dv + sz);
      // Exit just outside the stool away from the table center
      const exit = localToWorldXZ(
        shop.x,
        shop.z,
        shop.rotation,
        table.du + Math.cos(ang) * 1.45,
        table.dv + Math.sin(ang) * 1.45,
      );
      // Face inward toward the table center (-sx, -sz)
      const facingYaw = localDirToBodyYaw(shop.rotation, -sx, -sz);

      chairs.push({
        id: `tea-stool-${table.id}-${sIdx}`,
        x: pos.x,
        z: pos.z,
        seatTopY,
        seatHeight,
        yaw: facingYaw,
        exitX: exit.x,
        exitZ: exit.z,
        label: `Tea Stool (${table.id})`,
        type: 'stool',
      });
    }
  }

  // 2. Farmhouse (Dining Chairs, Kitchen Stools, Living Room Sofa, Swivel Desk Chair)
  // Rendered inside <group position={[h.x, 0, h.z]} rotation={[0, houseVisualRotation(h), 0]}>
  // Wooden floor top = 0.18; living room rug top = 0.1845
  const fh = farmhouse;
  const fhRot =
    angle + (fh.x * Math.cos(angle) - fh.z * Math.sin(angle) > 0 ? -Math.PI / 2 : Math.PI / 2);

  // 2a. 6 Dining Chairs around table at (0, 0)
  // Seat box: y=0.46, h=0.05 => seatTopY = 0.485 (0.305 above floor 0.18)
  // Dining table collider: minZ=-0.8, maxZ=+0.8 (+ PLAYER_RADIUS 0.35 => blocked in -1.15..+1.15)
  for (const lx of [-0.7, 0, 0.7]) {
    // South chair at lz=-0.85, backrest at lz=-1.04 (-Z), faces +Z (toward table)
    const sPos = localToWorldXZ(fh.x, fh.z, fhRot, lx, -0.85);
    const sExit = localToWorldXZ(fh.x, fh.z, fhRot, lx, -1.45);
    chairs.push({
      id: `farmhouse-dining-s-${lx}`,
      x: sPos.x,
      z: sPos.z,
      seatTopY: 0.485,
      seatHeight: 0.305,
      yaw: localDirToBodyYaw(fhRot, 0, 1),
      exitX: sExit.x,
      exitZ: sExit.z,
      label: 'Farmhouse Dining Chair',
      type: 'chair',
    });

    // North chair at lz=+0.85, backrest at lz=+1.04 (+Z), faces -Z (toward table)
    const nPos = localToWorldXZ(fh.x, fh.z, fhRot, lx, 0.85);
    const nExit = localToWorldXZ(fh.x, fh.z, fhRot, lx, 1.45);
    chairs.push({
      id: `farmhouse-dining-n-${lx}`,
      x: nPos.x,
      z: nPos.z,
      seatTopY: 0.485,
      seatHeight: 0.305,
      yaw: localDirToBodyYaw(fhRot, 0, -1),
      exitX: nExit.x,
      exitZ: nExit.z,
      label: 'Farmhouse Dining Chair',
      type: 'chair',
    });
  }

  // 2b. Living Room 3-Seater Sofa at [2.6, 0.48, -2.4], box height=0.44 => seatTopY = 0.70
  // Backrest at local z=+0.38 (lz=-2.02), front edge at lz=-2.875. Faces -Z (toward coffee table & TV).
  // Sit at lz=-2.56 so back rests against backrest/pillows and knees clear front edge (-2.875).
  // Sofa collider: minZ=-2.7, maxZ=-1.8 (+ PLAYER_RADIUS 0.35 => blocked in -3.05..-1.45); exit in front at lz=-3.18.
  for (const [idx, lx] of [
    ['left', 1.9],
    ['center', 2.6],
    ['right', 3.3],
  ] as const) {
    const sofaPos = localToWorldXZ(fh.x, fh.z, fhRot, lx, -2.56);
    const sofaExit = localToWorldXZ(fh.x, fh.z, fhRot, lx, -3.18);
    chairs.push({
      id: idx === 'center' ? 'farmhouse-sofa' : `farmhouse-sofa-${idx}`,
      x: sofaPos.x,
      z: sofaPos.z,
      seatTopY: 0.7,
      seatHeight: 0.5155,
      yaw: localDirToBodyYaw(fhRot, 0, -1),
      exitX: sofaExit.x,
      exitZ: sofaExit.z,
      label: 'Farmhouse Sofa',
      type: 'sofa',
    });
  }

  // 2c. Computer Swivel Desk Chair: workstation at [-3.8, 0, 2.2], chair at [+0.65, 0, 0] => lx=-3.15, lz=2.2
  // Backrest at +X side (lx=-2.91), monitor/desk at -X side (lx=-3.8). Faces -X.
  // Seat box: y=0.48, h=0.08 => seatTopY = 0.52 (0.34 above floor 0.18).
  // Desk collider: maxX=-3.5 (+ PLAYER_RADIUS 0.35 => blocked up to -3.15); exit behind chair at lx=-2.45.
  const deskChairPos = localToWorldXZ(fh.x, fh.z, fhRot, -3.12, 2.2);
  const deskChairExit = localToWorldXZ(fh.x, fh.z, fhRot, -2.45, 2.2);
  chairs.push({
    id: 'farmhouse-desk-chair',
    x: deskChairPos.x,
    z: deskChairPos.z,
    seatTopY: 0.52,
    seatHeight: 0.34,
    yaw: localDirToBodyYaw(fhRot, -1, 0),
    exitX: deskChairExit.x,
    exitZ: deskChairExit.z,
    label: 'Farmhouse Swivel Desk Chair',
    type: 'chair',
  });

  // 2d. 4 Kitchen Island Wooden Stools at [10.5 ± 0.7, 0, ±1.0]
  // Seat cylinder: y=0.46, h=0.05 => seatTopY = 0.485 (0.305 above floor 0.18)
  // Kitchen Island collider: minZ=-0.6, maxZ=+0.6 (+ PLAYER_RADIUS 0.35 => blocked in -0.95..+0.95)
  for (const ox of [-0.7, 0.7]) {
    const lx = 10.5 + ox;
    for (const lz of [-1.0, 1.0]) {
      const stoolPos = localToWorldXZ(fh.x, fh.z, fhRot, lx, lz);
      const stoolExit = localToWorldXZ(fh.x, fh.z, fhRot, lx, lz < 0 ? -1.55 : 1.55);
      chairs.push({
        id: `farmhouse-kitchen-stool-${ox}-${lz}`,
        x: stoolPos.x,
        z: stoolPos.z,
        seatTopY: 0.485,
        seatHeight: 0.305,
        yaw: localDirToBodyYaw(fhRot, 0, lz < 0 ? 1 : -1),
        exitX: stoolExit.x,
        exitZ: stoolExit.z,
        label: 'Farmhouse Kitchen Stool',
        type: 'stool',
      });
    }
  }

  // 3. Cemetery Zayat Resting Benches (2 long benches, 3 seat positions each)
  // Zayat origin: lx = -len/2 + 14 = -73.5 along cemetery rot=-0.39889,
  // rendered inside <group position={[zayatPos.x, 0, zayatPos.z]} rotation={[0, -rot, 0]}>
  // Plinth top = 0.44; bench mesh y=0.68, h=0.12 => seatTopY = 0.74 (0.30 above plinth)
  const cemeteryCx = 60.32856;
  const cemeteryCz = -410.0967;
  const cemeteryRot = -0.39889;
  const zayatLx = -87.5 + 14;
  const zayatX = cemeteryCx + zayatLx * Math.cos(cemeteryRot);
  const zayatZ = cemeteryCz + zayatLx * Math.sin(cemeteryRot);
  const zayatGroupRot = -cemeteryRot;

  for (const bz of [-2.55, 2.55]) {
    const faceZ = bz < 0 ? 1 : -1;
    const exitZ = bz < 0 ? -1.75 : 1.75;
    for (const bx of [-2.0, 0, 2.0]) {
      const bPos = localToWorldXZ(zayatX, zayatZ, zayatGroupRot, bx, bz);
      const bExit = localToWorldXZ(zayatX, zayatZ, zayatGroupRot, bx, exitZ);
      chairs.push({
        id: bx === 0 ? `cemetery-bench-${bz < 0 ? -2.6 : 2.6}` : `cemetery-bench-${bz < 0 ? -2.6 : 2.6}-${bx}`,
        x: bPos.x,
        z: bPos.z,
        seatTopY: 0.74,
        seatHeight: 0.3,
        yaw: localDirToBodyYaw(zayatGroupRot, 0, faceZ),
        exitX: bExit.x,
        exitZ: bExit.z,
        label: 'Cemetery Resting Bench',
        type: 'bench',
      });
    }
  }

  return chairs;
}

export function getAllChairSpots(): ChairSpot[] {
  if (!staticChairsInitialized) {
    staticChairCache.push(...buildStaticChairs());
    staticChairsInitialized = true;
  }
  return [...staticChairCache, ...Array.from(customChairRegistry.values())];
}

export function registerChairSpot(chair: ChairSpot): void {
  customChairRegistry.set(chair.id, chair);
}

export function unregisterChairSpot(id: string): void {
  customChairRegistry.delete(id);
}

export function findNearbyChair(
  playerX: number,
  playerZ: number,
  maxDistance = CHAIR_PROXIMITY_RADIUS,
  options?: { includeOccupied?: boolean },
): ChairSpot | null {
  const chairs = getAllChairSpots();
  const includeOccupied = Boolean(options?.includeOccupied);
  let nearest: ChairSpot | null = null;
  let minDistSq = maxDistance * maxDistance;

  for (const chair of chairs) {
    if (!includeOccupied && isChairOccupiedByNpc(chair.id)) continue;
    const dx = chair.x - playerX;
    const dz = chair.z - playerZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      nearest = chair;
    }
  }

  return nearest;
}

export function isChairSittingMotionId(id: string | null | undefined): boolean {
  if (!id) return false;
  const resolved = resolveSpecialActionId(id);
  return resolved === CHAIR_SITTING_IDLE_ID || resolved === CHAIR_SIT_TO_STAND_ID;
}

/**
 * Picks a guaranteed walkable exit spot around `chair` so standing up never traps the player
 * inside chair/table/sofa colliders.
 */
export function resolveStandUpExitSpot(
  chair: ChairSpot,
  entrySpot: { x: number; z: number } | null,
  canStand?: (x: number, z: number) => boolean,
): { x: number; z: number } {
  const isFree = (x: number, z: number) => (!canStand ? true : canStand(x, z));

  // 1. Prefer the exact valid spot the player walked in from (if still close & clear)
  if (entrySpot) {
    const dist = Math.hypot(entrySpot.x - chair.x, entrySpot.z - chair.z);
    if (dist >= 0.35 && dist <= 1.8 && isFree(entrySpot.x, entrySpot.z)) {
      return { x: entrySpot.x, z: entrySpot.z };
    }
  }

  // 2. Use the chair's authored exit spot if clear
  if (chair.exitX !== undefined && chair.exitZ !== undefined && isFree(chair.exitX, chair.exitZ)) {
    return { x: chair.exitX, z: chair.exitZ };
  }

  // 3. Radial fallback search around the chair starting from forward/backward/side directions
  const baseYaw = chair.yaw ?? 0;
  const forwardX = -Math.sin(baseYaw);
  const forwardZ = -Math.cos(baseYaw);
  const baseAngle = Math.atan2(forwardZ, forwardX);
  for (const radius of [0.65, 0.95, 1.25, 1.55, 1.9]) {
    for (let i = 0; i < 16; i++) {
      // Alternate forward, backward, sides
      const step = i === 0 ? 0 : i === 1 ? Math.PI : (i * Math.PI) / 8;
      const a = baseAngle + step;
      const cx = chair.x + Math.cos(a) * radius;
      const cz = chair.z + Math.sin(a) * radius;
      if (isFree(cx, cz)) {
        return { x: cx, z: cz };
      }
    }
  }

  // Last resort: authored exit or small step back
  if (chair.exitX !== undefined && chair.exitZ !== undefined) {
    return { x: chair.exitX, z: chair.exitZ };
  }
  return { x: chair.x - forwardX * 0.7, z: chair.z - forwardZ * 0.7 };
}

interface InternalChairRuntime {
  status: ChairSittingStatus;
  activeChair: ChairSpot | null;
  nearChair: ChairSpot | null;
  nearTime: number;
  heightOffset: number;
  seatPos: { x: number; z: number } | null;
  seatYaw: number | null;
  standBlend: number;
  entrySpot: { x: number; z: number } | null;
  exitSpot: { x: number; z: number } | null;
  standingUpTimer: number;
  cooldownChairId: string | null;
  cooldownTimer: number;
}

const runtime: InternalChairRuntime = {
  status: 'IDLE',
  activeChair: null,
  nearChair: null,
  nearTime: 0,
  heightOffset: 0,
  seatPos: null,
  seatYaw: null,
  standBlend: 1,
  entrySpot: null,
  exitSpot: null,
  standingUpTimer: 0,
  cooldownChairId: null,
  cooldownTimer: 0,
};

let snapshot: ChairSittingSnapshot = {
  status: runtime.status,
  activeChair: runtime.activeChair,
  nearChair: runtime.nearChair,
  nearTime: runtime.nearTime,
  heightOffset: runtime.heightOffset,
  seatPos: runtime.seatPos,
  seatYaw: runtime.seatYaw,
  standBlend: runtime.standBlend,
};

const listeners = new Set<() => void>();

function syncSnapshot(force = false): void {
  const changed =
    force ||
    snapshot.status !== runtime.status ||
    snapshot.activeChair?.id !== runtime.activeChair?.id ||
    snapshot.nearChair?.id !== runtime.nearChair?.id ||
    Math.abs(snapshot.nearTime - runtime.nearTime) > 0.05 ||
    Math.abs(snapshot.heightOffset - runtime.heightOffset) > 0.002 ||
    Math.abs(snapshot.standBlend - runtime.standBlend) > 0.005 ||
    snapshot.seatYaw !== runtime.seatYaw ||
    snapshot.seatPos?.x !== runtime.seatPos?.x ||
    snapshot.seatPos?.z !== runtime.seatPos?.z;

  if (!changed) return;

  snapshot = {
    status: runtime.status,
    activeChair: runtime.activeChair,
    nearChair: runtime.nearChair,
    nearTime: runtime.nearTime,
    heightOffset: runtime.heightOffset,
    seatPos: runtime.seatPos ? { ...runtime.seatPos } : null,
    seatYaw: runtime.seatYaw,
    standBlend: runtime.standBlend,
  };

  for (const listener of listeners) {
    listener();
  }
}

export function sitOnChair(
  chair: ChairSpot,
  entrySpot?: { x: number; z: number },
  groundY?: number,
  bodyScale = 1.0,
  preset = 'boy',
): boolean {
  if (isChairOccupiedByNpc(chair.id)) {
    return false;
  }
  runtime.status = 'SITTING';
  runtime.activeChair = chair;
  runtime.entrySpot = entrySpot ? { ...entrySpot } : null;
  runtime.exitSpot = null;
  runtime.seatPos = { x: chair.x, z: chair.z };
  runtime.seatYaw = chair.yaw ?? null;
  runtime.standBlend = 0;
  runtime.heightOffset =
    groundY !== undefined
      ? computeSeatedAvatarY(chair, groundY, bodyScale, preset) - groundY
      : chair.seatHeight - DEFAULT_STAND_HEIGHT;
  runtime.standingUpTimer = 0;
  runtime.nearTime = 0;
  runtime.cooldownChairId = null;
  runtime.cooldownTimer = 0;
  playSpecialAction(CHAIR_SITTING_IDLE_ID, { loop: true, force: true });
  if (typeof window !== 'undefined') {
    // Preload sit-to-stand GLB while seated so standing up transitions immediately with zero fetch lag
    void loadRawSpecialActionAsset(CHAIR_SIT_TO_STAND_ID).catch(() => {});
  }
  syncSnapshot(true);
  return true;
}

export function standUpFromChair(canStand?: (x: number, z: number) => boolean): void {
  if (runtime.status !== 'SITTING' || !runtime.activeChair) return;
  runtime.status = 'STANDING_UP';
  runtime.standingUpTimer = 0;
  runtime.standBlend = 0;
  runtime.exitSpot = resolveStandUpExitSpot(runtime.activeChair, runtime.entrySpot, canStand);
  runtime.seatPos = { x: runtime.activeChair.x, z: runtime.activeChair.z };
  runtime.seatYaw = runtime.activeChair.yaw ?? null;
  playSpecialAction(CHAIR_SIT_TO_STAND_ID, { loop: false, force: true });
  syncSnapshot(true);
}

export function resetChairSitting(): void {
  const currentAction = getSpecialActionState().activeActionId;
  if (isChairSittingMotionId(currentAction)) {
    stopSpecialAction(true);
  }
  runtime.status = 'IDLE';
  runtime.activeChair = null;
  runtime.nearChair = null;
  runtime.nearTime = 0;
  runtime.heightOffset = 0;
  runtime.seatPos = null;
  runtime.seatYaw = null;
  runtime.standBlend = 1;
  runtime.entrySpot = null;
  runtime.exitSpot = null;
  runtime.standingUpTimer = 0;
  runtime.cooldownChairId = null;
  runtime.cooldownTimer = 0;
  syncSnapshot(true);
}

export function stepChairSitting(
  dt: number,
  options: StepChairSittingOptions,
): ChairSittingSnapshot {
  const {
    playerX,
    playerZ,
    playerMoving,
    canSit,
    canStand,
    groundY,
    bodyScale = 1.0,
    preset = 'boy',
  } = options;

  if (!canSit && runtime.status !== 'IDLE') {
    resetChairSitting();
    return snapshot;
  }

  // State: SITTING
  if (runtime.status === 'SITTING') {
    if (playerMoving) {
      standUpFromChair(canStand);
      return snapshot;
    }

    const curAction = getSpecialActionState();
    if (curAction.activeActionId !== CHAIR_SITTING_IDLE_ID) {
      playSpecialAction(CHAIR_SITTING_IDLE_ID, { loop: true, force: true });
    }

    if (runtime.activeChair) {
      runtime.seatPos = { x: runtime.activeChair.x, z: runtime.activeChair.z };
      runtime.seatYaw = runtime.activeChair.yaw ?? null;
      runtime.standBlend = 0;
      runtime.heightOffset =
        groundY !== undefined
          ? computeSeatedAvatarY(runtime.activeChair, groundY, bodyScale, preset) - groundY
          : runtime.activeChair.seatHeight - DEFAULT_STAND_HEIGHT;
    }
    syncSnapshot();
    return snapshot;
  }

  // State: STANDING_UP
  if (runtime.status === 'STANDING_UP') {
    const chair = runtime.activeChair;
    const exit = runtime.exitSpot ?? (chair ? { x: chair.x, z: chair.z } : { x: playerX, z: playerZ });
    runtime.standingUpTimer += Math.max(0, dt);

    // Match sit-to-stand.glb hip rise curve:
    // 0..0.82s: still seated directly on chair (zero gap / zero horizontal slide)
    // 0.82..1.60s: rise straight up off the chair
    // 1.25..1.90s: once upright, glide smoothly out to the collision-free exit spot
    const riseProgress = smoothstep01(
      (runtime.standingUpTimer - STAND_UP_RISE_START_SEC) /
        (STAND_UP_RISE_END_SEC - STAND_UP_RISE_START_SEC),
    );
    const exitProgress = smoothstep01(
      (runtime.standingUpTimer - STAND_UP_EXIT_START_SEC) /
        (STAND_UP_EXIT_END_SEC - STAND_UP_EXIT_START_SEC),
    );
    runtime.standBlend = riseProgress;

    if (chair) {
      runtime.seatPos = {
        x: chair.x + (exit.x - chair.x) * exitProgress,
        z: chair.z + (exit.z - chair.z) * exitProgress,
      };
      runtime.seatYaw = chair.yaw ?? null;
      const seatedOffset =
        groundY !== undefined
          ? computeSeatedAvatarY(chair, groundY, bodyScale, preset) - groundY
          : chair.seatHeight - DEFAULT_STAND_HEIGHT;
      runtime.heightOffset = (1 - riseProgress) * seatedOffset;
    }

    const curAction = getSpecialActionState();
    const isStillPlayingStand =
      curAction.activeActionId === CHAIR_SIT_TO_STAND_ID && curAction.status !== 'error';
    const doneStanding =
      runtime.standingUpTimer >= STAND_UP_TOTAL_DURATION_SEC ||
      (playerMoving && runtime.standingUpTimer >= STAND_UP_EARLY_WALK_SEC) ||
      (!isStillPlayingStand && runtime.standingUpTimer > 0.6);

    if (doneStanding) {
      if (isStillPlayingStand) {
        stopSpecialAction();
      }
      runtime.cooldownChairId = chair?.id ?? null;
      runtime.cooldownTimer = STAND_UP_RE_SIT_COOLDOWN_SEC;
      runtime.status = 'IDLE';
      runtime.activeChair = null;
      runtime.seatPos = { x: exit.x, z: exit.z };
      runtime.seatYaw = null;
      runtime.standBlend = 1;
      runtime.heightOffset = 0;
      runtime.standingUpTimer = 0;
      runtime.nearTime = 0;
      runtime.entrySpot = null;
      runtime.exitSpot = null;
    }

    syncSnapshot(true);
    return snapshot;
  }

  // Clear one-frame handoff seatPos once back in IDLE
  if (runtime.seatPos !== null) {
    runtime.seatPos = null;
  }

  // Decay post-standup re-sit cooldown
  if (runtime.cooldownTimer > 0) {
    runtime.cooldownTimer = Math.max(0, runtime.cooldownTimer - Math.max(0, dt));
  }

  // State: IDLE - Check proximity and accumulate nearTime
  const nearby = findNearbyChair(playerX, playerZ);
  runtime.nearChair = nearby;

  if (runtime.cooldownChairId) {
    if (!nearby || nearby.id !== runtime.cooldownChairId) {
      runtime.cooldownChairId = null;
      runtime.cooldownTimer = 0;
    } else if (runtime.cooldownTimer <= 0 && !playerMoving) {
      // Allow re-sitting if player waited past cooldown
      runtime.cooldownChairId = null;
    }
  }

  if (nearby && canSit && !playerMoving && nearby.id !== runtime.cooldownChairId) {
    runtime.nearTime += Math.max(0, dt);
    if (runtime.nearTime >= PROXIMITY_SIT_DELAY_SEC) {
      sitOnChair(nearby, { x: playerX, z: playerZ }, groundY, bodyScale, preset);
      return snapshot;
    }
  } else {
    runtime.nearTime = 0;
  }

  syncSnapshot();
  return snapshot;
}

export function getChairSittingState(): ChairSittingSnapshot {
  return snapshot;
}

export function subscribeChairSitting(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChairSitting(): ChairSittingSnapshot {
  return useSyncExternalStore(subscribeChairSitting, getChairSittingState, getChairSittingState);
}
