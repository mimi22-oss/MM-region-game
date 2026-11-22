import { angle } from '../data/ward.ts';

/**
 * ============================================================================
 * Mountain Bridge & Viaduct Fall Detection -> Game Over Physics
 * ============================================================================
 * Detects when the player (walking/jumping on foot, riding a horse, riding a
 * motorcycle, or driving a car) drops off an elevated mountain bridge/viaduct
 * (`>= 5.5m` sudden vertical drop from `>= 6.0m` elevation), runs a short
 * dramatic falling plummet toward the mountainside/valley below, and reports
 * impact so `killPlayerFromBridgeFall` triggers the Game Over screen.
 *
 * Guarantees:
 * - Zero false positives on teleports, vehicle dismounts, hot air balloons,
 *   2-storey indoor floors (~3.5m), or steep normal roads/slopes (<= 0.45m/frame).
 * - Works identically across all 4 ground travel modes: walking, horse,
 *   motorcycle, and car.
 */

export type BridgeFallMode = 'walking' | 'horse' | 'motorcycle' | 'car';

/** Minimum sudden vertical drop (m) off a bridge/cliff edge to trigger lethal fall. */
export const BRIDGE_FALL_MIN_DROP_M = 5.5;
/** Minimum starting elevation (m) above valley floor for a mountain bridge drop. */
export const BRIDGE_FALL_MIN_START_Y_M = 6.0;
/** Minimum vertical drop (m) from takeoff when jumping off a bridge (foot or horse). */
export const BRIDGE_FALL_JUMP_DROP_M = 6.0;
/** Extra safety drop threshold (m) if ever dropping off a tall bridge outside mountain bounds. */
export const BRIDGE_FALL_GLOBAL_DROP_M = 8.0;
/** Downward gravity acceleration during bridge fall plummet (m/s^2). */
export const BRIDGE_FALL_GRAVITY = 18.0;
/** Cap visual fall time so even a 190m Maha Weipula viaduct fall opens Game Over promptly. */
export const BRIDGE_FALL_MAX_DURATION_SEC = 1.85;
/** Max single-frame horizontal displacement considered continuous motion (not a teleport). */
export const BRIDGE_FALL_MAX_CONTINUOUS_STEP_M = 4.8;

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

/**
 * True inside Taungphila Mountain, the Western Mountain Spine Highway,
 * and the entire Maha Weipula Mountain Range (roads, bridges, stairway, summit).
 */
export function isMountainBridgeZone(x: number, z: number): boolean {
  const u = x * cosA - z * sinA;
  const v = x * sinA + z * cosA;
  return v > 4100 || u < -405;
}

export interface BridgeFallRuntime {
  active: boolean;
  triggeredDeath: boolean;
  mode: BridgeFallMode;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  startY: number;
  floorY: number;
  dropMeters: number;
  elapsed: number;
  tumbleProgress: number;
  prevGrounded: boolean;
  prevX: number;
  prevZ: number;
  prevY: number;
  airborneTakeoffY: number | null;
  seq: number;
}

export function createBridgeFallState(): BridgeFallRuntime {
  return {
    active: false,
    triggeredDeath: false,
    mode: 'walking',
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    startY: 0,
    floorY: 0,
    dropMeters: 0,
    elapsed: 0,
    tumbleProgress: 0,
    prevGrounded: false,
    prevX: 0,
    prevZ: 0,
    prevY: 0,
    airborneTakeoffY: null,
    seq: 0,
  };
}

export function resetBridgeFall(bf: BridgeFallRuntime): void {
  bf.active = false;
  bf.triggeredDeath = false;
  bf.vx = 0;
  bf.vy = 0;
  bf.vz = 0;
  bf.elapsed = 0;
  bf.tumbleProgress = 0;
  bf.prevGrounded = false;
  bf.airborneTakeoffY = null;
}

/**
 * Anchors the tracker to a fresh grounded position after teleport, respawn, or dismount
 * so the elevation change is never mistaken for a bridge fall.
 */
export function syncBridgeFallAnchor(
  bf: BridgeFallRuntime,
  x: number,
  y: number,
  z: number,
): void {
  bf.active = false;
  bf.triggeredDeath = false;
  bf.elapsed = 0;
  bf.tumbleProgress = 0;
  bf.airborneTakeoffY = null;
  bf.prevGrounded = true;
  bf.prevX = x;
  bf.prevY = y;
  bf.prevZ = z;
  bf.x = x;
  bf.y = y;
  bf.z = z;
}

export interface BridgeFallCheckParams {
  readonly x: number;
  readonly z: number;
  /** Current walkable ground surface height beneath (x, z). */
  readonly groundY: number;
  /** Current actor vertical height (equals groundY when grounded, higher when jumping). */
  readonly actorY: number;
  readonly yaw: number;
  readonly mode: BridgeFallMode;
  readonly airborne: boolean;
  readonly currentVy?: number;
  /** Frame delta time in seconds (used to estimate outward fall drift). */
  readonly dt: number;
}

/**
 * Checks whether the player just walked, rode, drove, or jumped off an elevated
 * mountain bridge/viaduct. Returns `true` on the frame a lethal bridge fall begins.
 */
export function checkBridgeFallTrigger(
  bf: BridgeFallRuntime,
  params: BridgeFallCheckParams,
): boolean {
  if (bf.active) return false;

  const { x, z, groundY, actorY, yaw, mode, airborne, dt } = params;
  const inMountainZone = isMountainBridgeZone(x, z) || (bf.prevGrounded && isMountainBridgeZone(bf.prevX, bf.prevZ));
  const minDrop = inMountainZone ? BRIDGE_FALL_MIN_DROP_M : BRIDGE_FALL_GLOBAL_DROP_M;
  const minStartY = inMountainZone ? BRIDGE_FALL_MIN_START_Y_M : BRIDGE_FALL_GLOBAL_DROP_M;

  // 1. Track jump takeoff elevation for foot jumps & horse jumps
  if (airborne) {
    if (bf.airborneTakeoffY === null) {
      bf.airborneTakeoffY = bf.prevGrounded ? bf.prevY : Math.max(groundY, actorY);
    }
    const takeoffY = bf.airborneTakeoffY;
    const dropFromTakeoff = takeoffY - actorY;
    const dropToFloor = takeoffY - groundY;
    // Once the jumping player/horse descends well below their bridge takeoff height
    // with a deep chasm beneath, initiate the lethal bridge fall immediately!
    if (
      takeoffY >= minStartY &&
      dropToFloor >= Math.max(BRIDGE_FALL_JUMP_DROP_M, minDrop) &&
      dropFromTakeoff >= 2.2
    ) {
      startFall(bf, {
        x,
        y: actorY,
        z,
        yaw,
        mode,
        startY: takeoffY,
        floorY: groundY,
        dx: x - bf.prevX,
        dz: z - bf.prevZ,
        dt,
        initialVy: Math.min(-2.0, params.currentVy ?? -2.0),
      });
      return true;
    }
    bf.prevX = x;
    bf.prevZ = z;
    return false;
  }

  // 2. Just landed from a jump: check if total drop from takeoff to landing was lethal
  if (bf.airborneTakeoffY !== null) {
    const takeoffY = bf.airborneTakeoffY;
    bf.airborneTakeoffY = null;
    if (takeoffY >= minStartY && takeoffY - groundY >= Math.max(BRIDGE_FALL_JUMP_DROP_M, minDrop)) {
      startFall(bf, {
        x,
        y: Math.max(groundY + 0.5, takeoffY - 2.0),
        z,
        yaw,
        mode,
        startY: takeoffY,
        floorY: groundY,
        dx: x - bf.prevX,
        dz: z - bf.prevZ,
        dt,
        initialVy: -6.0,
      });
      return true;
    }
  }

  // 3. Grounded edge walk/ride/drive-off: sudden vertical drop from elevated bridge deck
  if (bf.prevGrounded) {
    const horizStep = Math.hypot(x - bf.prevX, z - bf.prevZ);
    const verticalDrop = bf.prevY - groundY;
    if (
      horizStep <= BRIDGE_FALL_MAX_CONTINUOUS_STEP_M &&
      bf.prevY >= minStartY &&
      verticalDrop >= minDrop
    ) {
      startFall(bf, {
        x,
        y: bf.prevY,
        z,
        yaw,
        mode,
        startY: bf.prevY,
        floorY: groundY,
        dx: x - bf.prevX,
        dz: z - bf.prevZ,
        dt,
        initialVy: -1.5,
      });
      return true;
    }
  }

  // Normal grounded update
  bf.prevGrounded = true;
  bf.prevX = x;
  bf.prevY = groundY;
  bf.prevZ = z;
  return false;
}

function startFall(
  bf: BridgeFallRuntime,
  init: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    mode: BridgeFallMode;
    startY: number;
    floorY: number;
    dx: number;
    dz: number;
    dt: number;
    initialVy: number;
  },
): void {
  const safeDt = Math.max(0.016, Math.min(0.1, init.dt || 0.016));
  let vx = init.dx / safeDt;
  let vz = init.dz / safeDt;
  const hSpeed = Math.hypot(vx, vz);
  if (hSpeed > 7.5) {
    vx = (vx / hSpeed) * 7.5;
    vz = (vz / hSpeed) * 7.5;
  } else if (hSpeed < 1.8) {
    // Gentle outward drift off the bridge edge along facing direction
    vx = -Math.sin(init.yaw) * 2.4;
    vz = -Math.cos(init.yaw) * 2.4;
  }

  bf.active = true;
  bf.triggeredDeath = false;
  bf.mode = init.mode;
  bf.x = init.x;
  bf.y = init.y;
  bf.z = init.z;
  bf.vx = vx;
  bf.vy = init.initialVy;
  bf.vz = vz;
  bf.yaw = init.yaw;
  bf.startY = init.startY;
  bf.floorY = init.floorY;
  bf.dropMeters = Math.max(1, Math.round(init.startY - init.floorY));
  bf.elapsed = 0;
  bf.tumbleProgress = 0;
  bf.prevGrounded = false;
  bf.airborneTakeoffY = null;
  bf.seq += 1;
}

export interface BridgeFallStepResult {
  readonly impacted: boolean;
  readonly dropMeters: number;
  readonly mode: BridgeFallMode;
  readonly seq: number;
}

/**
 * Advances an active bridge fall plummet under gravity until impact with the
 * mountainside/valley below (or `BRIDGE_FALL_MAX_DURATION_SEC` on high viaducts).
 */
export function stepBridgeFall(
  bf: BridgeFallRuntime,
  rawDt: number,
  groundHeightAt: (x: number, z: number) => number,
): BridgeFallStepResult {
  if (!bf.active) {
    return { impacted: false, dropMeters: bf.dropMeters, mode: bf.mode, seq: bf.seq };
  }
  const dt = Math.min(0.05, Math.max(0, rawDt));
  if (dt <= 0) {
    return { impacted: false, dropMeters: bf.dropMeters, mode: bf.mode, seq: bf.seq };
  }

  bf.elapsed += dt;
  const damp = Math.exp(-dt * 1.15);
  bf.vx *= damp;
  bf.vz *= damp;
  bf.x += bf.vx * dt;
  bf.z += bf.vz * dt;
  bf.vy -= BRIDGE_FALL_GRAVITY * dt;
  bf.y += bf.vy * dt;

  // Sample terrain below (cap at startY - 2 so horizontal drift never snaps back onto the bridge)
  const rawFloor = groundHeightAt(bf.x, bf.z);
  const floorY = rawFloor < bf.startY - 2.0 ? rawFloor : bf.floorY;
  bf.floorY = floorY;
  bf.dropMeters = Math.max(bf.dropMeters, Math.round(bf.startY - floorY));
  bf.tumbleProgress = Math.min(1, bf.elapsed / 0.7);

  if (bf.y <= floorY || bf.elapsed >= BRIDGE_FALL_MAX_DURATION_SEC) {
    if (bf.y < floorY) bf.y = floorY;
    bf.vx = 0;
    bf.vz = 0;
    bf.vy = 0;
    bf.tumbleProgress = 1;
    if (!bf.triggeredDeath) {
      bf.triggeredDeath = true;
      return { impacted: true, dropMeters: bf.dropMeters, mode: bf.mode, seq: bf.seq };
    }
  }

  return { impacted: false, dropMeters: bf.dropMeters, mode: bf.mode, seq: bf.seq };
}
