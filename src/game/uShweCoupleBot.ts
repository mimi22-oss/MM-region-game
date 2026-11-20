export type CoupleRole = 'uncle' | 'auntie';

export type CoupleBotPhase =
  | 'SITTING'
  | 'STANDING_UP'
  | 'WALKING_TO_HOUSE'
  | 'OPENING_DOOR_ENTER'
  | 'ENTERING_HOUSE'
  | 'INSIDE_HOUSE'
  | 'OPENING_DOOR_EXIT'
  | 'WALKING_TO_CHAIR'
  | 'SITTING_DOWN';

export interface LocalPoint2D {
  readonly x: number;
  readonly z: number;
}

export interface ChairConfig {
  readonly id: string;
  readonly role: CoupleRole;
  readonly x: number;
  readonly z: number;
  /** Local floor elevation under the chair (U Shwe veranda top = 0.16m). */
  readonly floorY: number;
  /** Chair seat top height above local floorY. */
  readonly seatHeight: number;
  /** Local Y rotation (rad) where local +Z is the chair's front facing direction. */
  readonly yaw: number;
  /** Clear standing spot directly in front of the chair. */
  readonly standSpot: LocalPoint2D;
}

export interface CoupleBotState {
  readonly role: CoupleRole;
  phase: CoupleBotPhase;
  x: number;
  y: number;
  z: number;
  /** Local Y rotation (rad), where 0 faces +Z and atan2(dx, dz) faces (dx, dz). */
  yaw: number;
  /** 1 = fully seated on chair, 0 = fully standing/walking. */
  sitBlend: number;
  /** 0..1 right-hand reach blend while opening the front door. */
  doorReachBlend: number;
  /** Phase countdown timer (seconds). */
  phaseTimer: number;
  /** Total duration of current timed phase (seconds). */
  phaseDuration: number;
  /** Current target waypoint index along the active route. */
  waypointIndex: number;
  /** Accumulated walking distance (meters) for procedural stride phase. */
  walkDistance: number;
  /** Current horizontal walking speed (m/s). */
  speed: number;
  /** Visible in the scene (false while resting deep inside behind the closed door). */
  visible: boolean;
  /** Deterministic pseudo-random seed for natural timing variety. */
  seed: number;
  /** Elapsed local time (seconds) for idle breathing/head-turning. */
  elapsed: number;
}

/** Veranda platform top Y inside UShweHouse local space. */
export const VERANDA_FLOOR_Y = 0.16;
/** Ground floor level inside U Shwe's main building behind the front door. */
export const HOUSE_INTERIOR_FLOOR_Y = 0.28;
/** Front door center in UShweHouse local coordinates (front = depth/2 = 4.5). */
export const U_SHWE_DOOR_LOCAL: LocalPoint2D = { x: 0, z: 4.55 };
/** Minimum door openness (0..1) required before either bot steps through the doorway. */
export const DOOR_OPEN_PASS_THRESHOLD = 0.92;
/** Standing spot directly centered outside the double front doors. */
export const DOOR_OUTSIDE_WAIT_SPOT: LocalPoint2D = { x: 0, z: 5.18 };
/** Inside vestibule spot centered behind the double front doors. */
export const DOOR_INSIDE_SPOT: LocalPoint2D = { x: 0, z: 3.55 };

/**
 * Two wooden/rattan armchairs placed on the right side of U Shwe House's veranda
 * (under the shaded awning, clear of the customer dining table at (2.2, 5.85) and side fence at x=4.7).
 */
export const U_SHWE_COUPLE_CHAIRS: Record<CoupleRole, ChairConfig> = {
  uncle: {
    id: 'u-shwe-uncle-chair',
    role: 'uncle',
    x: 4.05,
    z: 5.15,
    floorY: VERANDA_FLOOR_Y,
    seatHeight: 0.44,
    yaw: Math.atan2(-0.97, 0.24),
    standSpot: { x: 3.49, z: 5.29 },
  },
  auntie: {
    id: 'u-shwe-auntie-chair',
    role: 'auntie',
    x: 4.05,
    z: 6.28,
    floorY: VERANDA_FLOOR_Y,
    seatHeight: 0.41,
    yaw: Math.atan2(-0.985, -0.17),
    standSpot: { x: 3.48, z: 6.18 },
  },
};

/** Small teak tea/betel side table nestled between the couple's two armchairs. */
export const U_SHWE_SIDE_TABLE_LOCAL = { x: 4.12, y: VERANDA_FLOOR_Y, z: 5.71 };

/**
 * Obstacle-free veranda waypoints from each chair's standSpot up to DOOR_OUTSIDE_WAIT_SPOT.
 * Bots stop at DOOR_OUTSIDE_WAIT_SPOT, wait for the front door to swing open, then cross inside.
 */
export const PATH_TO_DOOR: Record<CoupleRole, readonly LocalPoint2D[]> = {
  uncle: [
    U_SHWE_COUPLE_CHAIRS.uncle.standSpot,
    { x: 3.48, z: 6.95 },
    { x: 3.38, z: 7.56 },
    { x: 0.42, z: 7.56 },
    { x: 0.14, z: 6.35 },
    DOOR_OUTSIDE_WAIT_SPOT,
  ],
  auntie: [
    U_SHWE_COUPLE_CHAIRS.auntie.standSpot,
    { x: 3.52, z: 7.0 },
    { x: 3.48, z: 7.78 },
    { x: 0.2, z: 7.78 },
    { x: 0.08, z: 6.35 },
    DOOR_OUTSIDE_WAIT_SPOT,
  ],
};

/** Full path from chair into house (used for clearance validation). */
export const PATH_TO_HOUSE: Record<CoupleRole, readonly LocalPoint2D[]> = {
  uncle: [...PATH_TO_DOOR.uncle, DOOR_INSIDE_SPOT],
  auntie: [...PATH_TO_DOOR.auntie, DOOR_INSIDE_SPOT],
};

/** Full return path from inside house back out through open door to chair's standSpot. */
export const PATH_TO_CHAIR: Record<CoupleRole, readonly LocalPoint2D[]> = {
  uncle: [DOOR_INSIDE_SPOT, ...[...PATH_TO_DOOR.uncle].reverse()],
  auntie: [DOOR_INSIDE_SPOT, ...[...PATH_TO_DOOR.auntie].reverse()],
};

const STAND_TRANSITION_SEC = 0.85;
const SIT_TRANSITION_SEC = 0.85;
const DOOR_WAIT_MIN_SEC = 0.55;
const WALK_SPEED_MPS: Record<CoupleRole, number> = {
  uncle: 0.94,
  auntie: 0.86,
};

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function nextRand(state: CoupleBotState): number {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

/** Shortest signed angle delta from currentYaw to targetYaw in [-PI, PI]. */
export function shortestAngleDelta(currentYaw: number, targetYaw: number): number {
  let delta = (targetYaw - currentYaw) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Computes exact local ground Y at local Z in U Shwe House space so feet never float or sink:
 * - Front street apron (z >= 7.35): 0.0m
 * - Veranda platform (4.70 <= z <= 7.10): 0.16m
 * - House interior floor (z <= 4.35): 0.28m
 */
export function uShweLocalFloorY(z: number): number {
  if (z >= 7.35) return 0;
  if (z > 7.1) {
    return VERANDA_FLOOR_Y * (1 - smoothstep01((z - 7.1) / 0.25));
  }
  if (z >= 4.7) return VERANDA_FLOOR_Y;
  if (z > 4.35) {
    return (
      VERANDA_FLOOR_Y +
      (HOUSE_INTERIOR_FLOOR_Y - VERANDA_FLOOR_Y) * smoothstep01((4.7 - z) / 0.35)
    );
  }
  return HOUSE_INTERIOR_FLOOR_Y;
}

/** Creates initial state for Uncle or Auntie, both starting seated on their chairs. */
export function createCoupleBotState(role: CoupleRole): CoupleBotState {
  const chair = U_SHWE_COUPLE_CHAIRS[role];
  const initialSitSec = role === 'uncle' ? 8.5 : 17.0;
  return {
    role,
    phase: 'SITTING',
    x: chair.x,
    y: chair.floorY,
    z: chair.z,
    yaw: chair.yaw,
    sitBlend: 1,
    doorReachBlend: 0,
    phaseTimer: initialSitSec,
    phaseDuration: initialSitSec,
    waypointIndex: 0,
    walkDistance: 0,
    speed: 0,
    visible: true,
    seed: role === 'uncle' ? 202605 : 202609,
    elapsed: role === 'uncle' ? 0 : 1.7,
  };
}

/**
 * Advances door openness smoothly toward target (0 = closed, 1 = wide open).
 * Opens swiftly (~0.55s) and closes gently (~0.75s) once nobody is in the doorway.
 */
export function stepDoorOpen(currentOpen: number, targetOpen: number, rawDt: number): number {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return currentOpen;
  const rate = targetOpen > currentOpen ? 2.4 : 1.7;
  if (targetOpen > currentOpen) {
    return Math.min(targetOpen, currentOpen + rate * dt);
  }
  return Math.max(targetOpen, currentOpen - rate * dt);
}

/**
 * Returns target front-door openness (0 = closed, 1 = open) based on both bots' states.
 * Door opens when either bot pauses at the doorway to enter/exit, stays wide open while
 * they walk through the threshold, and closes once they are clear.
 */
export function computeDoorTargetOpen(uncle: CoupleBotState, auntie: CoupleBotState): number {
  for (const bot of [uncle, auntie]) {
    if (
      bot.phase === 'OPENING_DOOR_ENTER' ||
      bot.phase === 'ENTERING_HOUSE' ||
      bot.phase === 'OPENING_DOOR_EXIT'
    ) {
      return 1;
    }
    if (bot.phase === 'WALKING_TO_CHAIR' && bot.z < 5.05) {
      return 1;
    }
  }
  return 0;
}

/** True when Uncle or Auntie is physically occupying their veranda armchair. */
export function isCoupleBotOccupyingSeat(phase: CoupleBotPhase): boolean {
  return phase === 'SITTING' || phase === 'STANDING_UP' || phase === 'SITTING_DOWN';
}

/** Advances one couple bot state by `rawDt` seconds, respecting current `doorOpen` (0..1). */
export function stepCoupleBot(
  state: CoupleBotState,
  rawDt: number,
  doorOpen = 1,
  seatBlockedByPlayer = false,
): void {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return;

  state.elapsed += dt;
  const chair = U_SHWE_COUPLE_CHAIRS[state.role];

  // Smoothly decay door-reach arm pose unless actively opening the door
  const targetReach = state.phase === 'OPENING_DOOR_ENTER' ? 1 : 0;
  state.doorReachBlend += (targetReach - state.doorReachBlend) * (1 - Math.exp(-dt * 9));

  if (state.phase === 'SITTING') {
    state.x = chair.x;
    state.z = chair.z;
    state.y = chair.floorY;
    state.yaw = chair.yaw;
    state.sitBlend = 1;
    state.speed = 0;
    state.visible = true;
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = 'STANDING_UP';
      state.phaseDuration = STAND_TRANSITION_SEC;
      state.phaseTimer = STAND_TRANSITION_SEC;
    }
    return;
  }

  if (state.phase === 'STANDING_UP') {
    state.phaseTimer = Math.max(0, state.phaseTimer - dt);
    const t = smoothstep01(1 - state.phaseTimer / state.phaseDuration);
    state.sitBlend = 1 - t;
    state.x = chair.x + (chair.standSpot.x - chair.x) * t;
    state.z = chair.z + (chair.standSpot.z - chair.z) * t;
    state.y = uShweLocalFloorY(state.z);
    state.yaw = chair.yaw;
    state.speed = 0.25 * Math.sin(t * Math.PI);
    state.visible = true;
    if (state.phaseTimer <= 0) {
      state.phase = 'WALKING_TO_HOUSE';
      state.waypointIndex = 1; // index 0 is standSpot
      state.sitBlend = 0;
    }
    return;
  }

  if (state.phase === 'WALKING_TO_HOUSE') {
    const route = PATH_TO_DOOR[state.role];
    const target = route[Math.min(state.waypointIndex, route.length - 1)];
    const dx = target.x - state.x;
    const dz = target.z - state.z;
    const dist = Math.hypot(dx, dz);
    const maxStep = WALK_SPEED_MPS[state.role] * dt;

    if (dist > 0.001) {
      const step = Math.min(dist, maxStep);
      state.x += (dx / dist) * step;
      state.z += (dz / dist) * step;
      state.walkDistance += step;
      state.speed = step / dt;
      const targetYaw = Math.atan2(dx, dz);
      state.yaw += shortestAngleDelta(state.yaw, targetYaw) * (1 - Math.exp(-dt * 8.5));
    } else {
      state.speed = 0;
    }

    state.y = uShweLocalFloorY(state.z);
    state.sitBlend = 0;
    state.visible = true;

    if (dist <= maxStep + 0.03) {
      state.x = target.x;
      state.z = target.z;
      state.y = uShweLocalFloorY(state.z);
      state.waypointIndex += 1;

      if (state.waypointIndex >= route.length) {
        // Stop outside the closed door and wait for it to open before walking inside
        state.phase = 'OPENING_DOOR_ENTER';
        state.phaseDuration = DOOR_WAIT_MIN_SEC;
        state.phaseTimer = DOOR_WAIT_MIN_SEC;
        state.speed = 0;
      }
    }
    return;
  }

  if (state.phase === 'OPENING_DOOR_ENTER') {
    state.x = DOOR_OUTSIDE_WAIT_SPOT.x;
    state.z = DOOR_OUTSIDE_WAIT_SPOT.z;
    state.y = uShweLocalFloorY(state.z);
    state.speed = 0;
    state.sitBlend = 0;
    state.visible = true;
    // Face directly toward the front door (-Z => yaw = PI)
    state.yaw += shortestAngleDelta(state.yaw, Math.PI) * (1 - Math.exp(-dt * 10));
    state.phaseTimer = Math.max(0, state.phaseTimer - dt);

    // Only walk inside AFTER the door has genuinely swung wide open!
    if (state.phaseTimer <= 0 && doorOpen >= DOOR_OPEN_PASS_THRESHOLD) {
      state.phase = 'ENTERING_HOUSE';
      state.yaw = Math.PI;
    }
    return;
  }

  if (state.phase === 'ENTERING_HOUSE') {
    const dx = DOOR_INSIDE_SPOT.x - state.x;
    const dz = DOOR_INSIDE_SPOT.z - state.z;
    const dist = Math.hypot(dx, dz);
    const maxStep = WALK_SPEED_MPS[state.role] * dt;

    if (dist > 0.001) {
      const step = Math.min(dist, maxStep);
      state.x += (dx / dist) * step;
      state.z += (dz / dist) * step;
      state.walkDistance += step;
      state.speed = step / dt;
      const targetYaw = Math.atan2(dx, dz);
      state.yaw += shortestAngleDelta(state.yaw, targetYaw) * (1 - Math.exp(-dt * 10));
    } else {
      state.speed = 0;
    }

    state.y = uShweLocalFloorY(state.z);
    state.sitBlend = 0;
    state.visible = true;

    if (dist <= maxStep + 0.03) {
      const staySec = 7.5 + nextRand(state) * 5.5;
      state.x = DOOR_INSIDE_SPOT.x;
      state.z = DOOR_INSIDE_SPOT.z;
      state.y = uShweLocalFloorY(state.z);
      state.phase = 'INSIDE_HOUSE';
      state.phaseDuration = staySec;
      state.phaseTimer = staySec;
      state.speed = 0;
      state.visible = false;
    }
    return;
  }

  if (state.phase === 'INSIDE_HOUSE') {
    state.visible = false;
    state.speed = 0;
    state.sitBlend = 0;
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.x = DOOR_INSIDE_SPOT.x;
      state.z = DOOR_INSIDE_SPOT.z;
      state.y = uShweLocalFloorY(state.z);
      state.yaw = 0; // face +Z (out the doorway)
      state.phase = 'OPENING_DOOR_EXIT';
      state.phaseDuration = DOOR_WAIT_MIN_SEC;
      state.phaseTimer = DOOR_WAIT_MIN_SEC;
      state.visible = true; // visible inside the warm vestibule as door swings open!
    }
    return;
  }

  if (state.phase === 'OPENING_DOOR_EXIT') {
    state.x = DOOR_INSIDE_SPOT.x;
    state.z = DOOR_INSIDE_SPOT.z;
    state.y = uShweLocalFloorY(state.z);
    state.yaw = 0;
    state.speed = 0;
    state.sitBlend = 0;
    state.visible = true;
    state.phaseTimer = Math.max(0, state.phaseTimer - dt);

    // Wait until the door has swung wide open before stepping out onto the veranda!
    if (state.phaseTimer <= 0 && doorOpen >= DOOR_OPEN_PASS_THRESHOLD) {
      state.phase = 'WALKING_TO_CHAIR';
      state.waypointIndex = 1; // index 0 is DOOR_INSIDE_SPOT, index 1 is DOOR_OUTSIDE_WAIT_SPOT
    }
    return;
  }

  if (state.phase === 'WALKING_TO_CHAIR') {
    const route = PATH_TO_CHAIR[state.role];
    const target = route[Math.min(state.waypointIndex, route.length - 1)];
    const dx = target.x - state.x;
    const dz = target.z - state.z;
    const dist = Math.hypot(dx, dz);
    const maxStep = WALK_SPEED_MPS[state.role] * dt;

    if (dist > 0.001) {
      const step = Math.min(dist, maxStep);
      state.x += (dx / dist) * step;
      state.z += (dz / dist) * step;
      state.walkDistance += step;
      state.speed = step / dt;
      const targetYaw = Math.atan2(dx, dz);
      state.yaw += shortestAngleDelta(state.yaw, targetYaw) * (1 - Math.exp(-dt * 8.5));
    } else {
      state.speed = 0;
    }

    state.y = uShweLocalFloorY(state.z);
    state.sitBlend = 0;
    state.visible = true;

    if (dist <= maxStep + 0.03) {
      state.x = target.x;
      state.z = target.z;
      state.y = uShweLocalFloorY(state.z);

      if (state.waypointIndex >= route.length - 1) {
        if (seatBlockedByPlayer) {
          state.speed = 0;
          state.yaw += shortestAngleDelta(state.yaw, chair.yaw) * (1 - Math.exp(-dt * 8));
          return;
        }
        state.phase = 'SITTING_DOWN';
        state.phaseDuration = SIT_TRANSITION_SEC;
        state.phaseTimer = SIT_TRANSITION_SEC;
        state.speed = 0;
      } else {
        state.waypointIndex += 1;
      }
    }
    return;
  }

  if (state.phase === 'SITTING_DOWN') {
    state.phaseTimer = Math.max(0, state.phaseTimer - dt);
    const t = smoothstep01(1 - state.phaseTimer / state.phaseDuration);
    state.sitBlend = t;
    state.x = chair.standSpot.x + (chair.x - chair.standSpot.x) * t;
    state.z = chair.standSpot.z + (chair.z - chair.standSpot.z) * t;
    state.y = chair.floorY;
    state.yaw += shortestAngleDelta(state.yaw, chair.yaw) * (1 - Math.exp(-dt * 10));
    state.speed = 0.2 * Math.sin(t * Math.PI);
    state.visible = true;

    if (state.phaseTimer <= 0) {
      const sitSec = 11.0 + nextRand(state) * 8.0;
      state.phase = 'SITTING';
      state.phaseDuration = sitSec;
      state.phaseTimer = sitSec;
      state.x = chair.x;
      state.z = chair.z;
      state.y = chair.floorY;
      state.yaw = chair.yaw;
      state.sitBlend = 1;
      state.speed = 0;
    }
  }
}
