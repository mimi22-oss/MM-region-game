/**
 * Shared, allocation-free resident bot engine (အိမ်နေလူကြီး Bot များ).
 *
 * One pure state machine drives every resident: the U Shwe couple and every generic house
 * household reuse the same code path. Layouts are plain data objects in house-local space
 * (+Z points out of the front door) and are shared by reference between households with the
 * same porch shape, so thousands of houses cost only a few small layout objects.
 *
 * Cycle: SITTING → STANDING_UP → WALKING_TO_HOUSE → OPENING_DOOR_ENTER (waits until the door
 * is genuinely open) → ENTERING_HOUSE → INSIDE_HOUSE → OPENING_DOOR_EXIT (waits for door) →
 * WALKING_TO_CHAIR → SITTING_DOWN → SITTING.
 */

export type ResidentRole = 'uncle' | 'auntie' | 'boy' | 'girl';

export type ResidentPhase =
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

export interface ResidentSeat {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Local floor elevation under the seat. */
  readonly floorY: number;
  /** Seat top height above floorY. */
  readonly seatHeight: number;
  /** Local Y rotation where local +Z is the seat's facing direction. */
  readonly yaw: number;
  /** Clear standing spot directly in front of the seat. */
  readonly standSpot: LocalPoint2D;
}

export interface ResidentLayout {
  readonly seats: readonly ResidentSeat[];
  /** Spot outside the door where a resident waits for the door to open (outside the leaf sweep). */
  readonly doorOutside: LocalPoint2D;
  /** Spot inside/at the doorway where the resident disappears into the house. */
  readonly doorInside: LocalPoint2D;
  /** Per seat: [standSpot, ...waypoints, doorOutside]. */
  readonly pathToDoor: readonly (readonly LocalPoint2D[])[];
  /** Per seat: [doorInside, doorOutside, ...waypoints, standSpot]. */
  readonly pathToSeat: readonly (readonly LocalPoint2D[])[];
  readonly floorY: (z: number) => number;
  /** Minimum door openness (0..1) before crossing the doorway. */
  readonly passThreshold: number;
  /** True when a lit vestibule exists behind the door (resident visible while the door opens). */
  readonly revealInsideWhileOpening: boolean;
  /** Door stays open while a returning resident is at local z below this value. */
  readonly doorClearZ: number;
}

export interface ResidentState {
  readonly role: ResidentRole;
  readonly seatIndex: number;
  phase: ResidentPhase;
  x: number;
  y: number;
  z: number;
  /** Local Y rotation; 0 faces +Z and atan2(dx, dz) faces (dx, dz). */
  yaw: number;
  /** 1 = fully seated, 0 = standing/walking. */
  sitBlend: number;
  /** 0..1 right-hand reach while opening the door. */
  doorReachBlend: number;
  phaseTimer: number;
  phaseDuration: number;
  waypointIndex: number;
  walkDistance: number;
  speed: number;
  visible: boolean;
  seed: number;
  elapsed: number;
  readonly walkSpeed: number;
  readonly seatHeight: number;
  readonly sitMinSec: number;
  readonly sitSpanSec: number;
  readonly insideMinSec: number;
  readonly insideSpanSec: number;
}

export interface CreateResidentOptions {
  initialSitSec: number;
  seed: number;
  elapsedOffset?: number;
  walkSpeed?: number;
  sitMinSec?: number;
  sitSpanSec?: number;
  insideMinSec?: number;
  insideSpanSec?: number;
}

const STAND_TRANSITION_SEC = 0.85;
const SIT_TRANSITION_SEC = 0.85;
const DOOR_WAIT_MIN_SEC = 0.55;

/** Phases during which a resident occupies the shared door/porch route. */
const ROUTE_PHASES: ReadonlySet<ResidentPhase> = new Set<ResidentPhase>([
  'STANDING_UP',
  'WALKING_TO_HOUSE',
  'OPENING_DOOR_ENTER',
  'ENTERING_HOUSE',
  'OPENING_DOOR_EXIT',
  'WALKING_TO_CHAIR',
  'SITTING_DOWN',
]);
const ENTERING_PHASES: ReadonlySet<ResidentPhase> = new Set<ResidentPhase>([
  'WALKING_TO_HOUSE',
  'OPENING_DOOR_ENTER',
  'ENTERING_HOUSE',
]);

export function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Shortest signed angle delta from currentYaw to targetYaw in [-PI, PI]. */
export function shortestAngleDelta(currentYaw: number, targetYaw: number): number {
  let delta = (targetYaw - currentYaw) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function nextRand(state: ResidentState): number {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

/** Builds the seat-return paths from door paths (reverse + doorInside prefix). */
export function buildPathsToSeat(
  pathToDoor: readonly (readonly LocalPoint2D[])[],
  doorInside: LocalPoint2D,
): readonly (readonly LocalPoint2D[])[] {
  return pathToDoor.map((path) => [doorInside, ...[...path].reverse()]);
}

export function createResidentState(
  layout: ResidentLayout,
  seatIndex: number,
  role: ResidentRole,
  options: CreateResidentOptions,
): ResidentState {
  const seat = layout.seats[seatIndex];
  return {
    role,
    seatIndex,
    phase: 'SITTING',
    x: seat.x,
    y: seat.floorY,
    z: seat.z,
    yaw: seat.yaw,
    sitBlend: 1,
    doorReachBlend: 0,
    phaseTimer: options.initialSitSec,
    phaseDuration: options.initialSitSec,
    waypointIndex: 0,
    walkDistance: 0,
    speed: 0,
    visible: true,
    seed: options.seed >>> 0,
    elapsed: options.elapsedOffset ?? 0,
    walkSpeed:
      options.walkSpeed ??
      (role === 'boy' ? 1.32 : role === 'girl' ? 1.24 : role === 'uncle' ? 0.94 : 0.86),
    seatHeight: seat.seatHeight,
    sitMinSec: options.sitMinSec ?? 11,
    sitSpanSec: options.sitSpanSec ?? 8,
    insideMinSec: options.insideMinSec ?? 7.5,
    insideSpanSec: options.insideSpanSec ?? 5.5,
  };
}

/** Smooth door openness: opens swiftly (~0.4s), closes gently (~0.6s). */
export function stepDoorOpen(currentOpen: number, targetOpen: number, rawDt: number): number {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return currentOpen;
  if (targetOpen > currentOpen) return Math.min(targetOpen, currentOpen + 2.4 * dt);
  return Math.max(targetOpen, currentOpen - 1.7 * dt);
}

/** Door opens while anyone waits at/passes through the doorway or is still returning past it. */
export function computeResidentDoorTarget(
  states: readonly ResidentState[],
  layout: ResidentLayout,
): number {
  for (const s of states) {
    if (
      s.phase === 'OPENING_DOOR_ENTER' ||
      s.phase === 'ENTERING_HOUSE' ||
      s.phase === 'OPENING_DOOR_EXIT'
    ) {
      return 1;
    }
    if (s.phase === 'WALKING_TO_CHAIR' && s.z < layout.doorClearZ) return 1;
  }
  return 0;
}

function partnerOnRoute(partners: readonly ResidentState[]): boolean {
  for (const p of partners) if (ROUTE_PHASES.has(p.phase)) return true;
  return false;
}

function partnerEntering(partners: readonly ResidentState[]): boolean {
  for (const p of partners) if (ENTERING_PHASES.has(p.phase)) return true;
  return false;
}

/** Walks toward target; returns true once the target is reached this step. */
function walkToward(
  state: ResidentState,
  target: LocalPoint2D,
  dt: number,
  turnRate: number,
): boolean {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const dist = Math.hypot(dx, dz);
  const maxStep = state.walkSpeed * dt;
  if (dist > 0.001) {
    const step = Math.min(dist, maxStep);
    state.x += (dx / dist) * step;
    state.z += (dz / dist) * step;
    state.walkDistance += step;
    state.speed = step / dt;
    state.yaw += shortestAngleDelta(state.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * turnRate));
  } else {
    state.speed = 0;
  }
  if (dist <= maxStep + 0.03) {
    state.x = target.x;
    state.z = target.z;
    return true;
  }
  return false;
}

/** True when a resident is physically occupying their chair/stool (sitting, rising, or sitting down). */
export function isResidentOccupyingSeat(phase: ResidentPhase): boolean {
  return phase === 'SITTING' || phase === 'STANDING_UP' || phase === 'SITTING_DOWN';
}

/**
 * Advances one resident by `rawDt` seconds. `doorOpen` is the current door openness (0..1);
 * residents never cross the doorway until it reaches `layout.passThreshold`.
 * `partners` are the other residents of the same household (used to avoid doorway clashes).
 * `seatBlockedByPlayer` pauses the resident politely at `standSpot` if the player is seated there.
 */
export function stepResident(
  state: ResidentState,
  layout: ResidentLayout,
  rawDt: number,
  doorOpen = 1,
  partners: readonly ResidentState[] = [],
  seatBlockedByPlayer = false,
): void {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return;

  state.elapsed += dt;
  const seat = layout.seats[state.seatIndex];
  const targetReach = state.phase === 'OPENING_DOOR_ENTER' ? 1 : 0;
  state.doorReachBlend += (targetReach - state.doorReachBlend) * (1 - Math.exp(-dt * 9));

  switch (state.phase) {
    case 'SITTING': {
      state.x = seat.x;
      state.z = seat.z;
      state.y = seat.floorY;
      state.yaw = seat.yaw;
      state.sitBlend = 1;
      state.speed = 0;
      state.visible = true;
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        if (partnerOnRoute(partners)) {
          // Let the partner finish using the doorway first.
          state.phaseTimer = 2.5 + nextRand(state) * 2;
          state.phaseDuration = state.phaseTimer;
        } else {
          state.phase = 'STANDING_UP';
          state.phaseDuration = STAND_TRANSITION_SEC;
          state.phaseTimer = STAND_TRANSITION_SEC;
        }
      }
      return;
    }

    case 'STANDING_UP': {
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      const t = smoothstep01(1 - state.phaseTimer / state.phaseDuration);
      state.sitBlend = 1 - t;
      state.x = seat.x + (seat.standSpot.x - seat.x) * t;
      state.z = seat.z + (seat.standSpot.z - seat.z) * t;
      state.y = layout.floorY(state.z);
      state.yaw = seat.yaw;
      state.speed = 0.25 * Math.sin(t * Math.PI);
      state.visible = true;
      if (state.phaseTimer <= 0) {
        state.phase = 'WALKING_TO_HOUSE';
        state.waypointIndex = 1;
        state.sitBlend = 0;
      }
      return;
    }

    case 'WALKING_TO_HOUSE': {
      const route = layout.pathToDoor[state.seatIndex];
      const target = route[Math.min(state.waypointIndex, route.length - 1)];
      const arrived = walkToward(state, target, dt, 8.5);
      state.y = layout.floorY(state.z);
      state.sitBlend = 0;
      state.visible = true;
      if (arrived) {
        state.waypointIndex += 1;
        if (state.waypointIndex >= route.length) {
          // Stand at the door and wait for it to swing open before stepping inside.
          state.phase = 'OPENING_DOOR_ENTER';
          state.phaseDuration = DOOR_WAIT_MIN_SEC;
          state.phaseTimer = DOOR_WAIT_MIN_SEC;
          state.speed = 0;
        }
      }
      return;
    }

    case 'OPENING_DOOR_ENTER': {
      state.x = layout.doorOutside.x;
      state.z = layout.doorOutside.z;
      state.y = layout.floorY(state.z);
      state.speed = 0;
      state.sitBlend = 0;
      state.visible = true;
      const faceYaw = Math.atan2(
        layout.doorInside.x - layout.doorOutside.x,
        layout.doorInside.z - layout.doorOutside.z,
      );
      state.yaw += shortestAngleDelta(state.yaw, faceYaw) * (1 - Math.exp(-dt * 10));
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer <= 0 && doorOpen >= layout.passThreshold) {
        state.phase = 'ENTERING_HOUSE';
      }
      return;
    }

    case 'ENTERING_HOUSE': {
      const arrived = walkToward(state, layout.doorInside, dt, 10);
      state.y = layout.floorY(state.z);
      state.sitBlend = 0;
      state.visible = true;
      if (arrived) {
        const staySec = state.insideMinSec + nextRand(state) * state.insideSpanSec;
        state.phase = 'INSIDE_HOUSE';
        state.phaseDuration = staySec;
        state.phaseTimer = staySec;
        state.speed = 0;
        state.visible = false;
      }
      return;
    }

    case 'INSIDE_HOUSE': {
      state.visible = false;
      state.speed = 0;
      state.sitBlend = 0;
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        if (partnerEntering(partners)) {
          state.phaseTimer = 1.5;
          return;
        }
        state.x = layout.doorInside.x;
        state.z = layout.doorInside.z;
        state.y = layout.floorY(state.z);
        state.yaw = Math.atan2(
          layout.doorOutside.x - layout.doorInside.x,
          layout.doorOutside.z - layout.doorInside.z,
        );
        state.phase = 'OPENING_DOOR_EXIT';
        state.phaseDuration = DOOR_WAIT_MIN_SEC;
        state.phaseTimer = DOOR_WAIT_MIN_SEC;
        state.visible = layout.revealInsideWhileOpening;
      }
      return;
    }

    case 'OPENING_DOOR_EXIT': {
      state.x = layout.doorInside.x;
      state.z = layout.doorInside.z;
      state.y = layout.floorY(state.z);
      state.speed = 0;
      state.sitBlend = 0;
      state.visible =
        layout.revealInsideWhileOpening || doorOpen >= layout.passThreshold * 0.6;
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer <= 0 && doorOpen >= layout.passThreshold) {
        state.phase = 'WALKING_TO_CHAIR';
        state.waypointIndex = 1;
        state.visible = true;
      }
      return;
    }

    case 'WALKING_TO_CHAIR': {
      const route = layout.pathToSeat[state.seatIndex];
      const atFinalStandSpot = state.waypointIndex >= route.length - 1;
      const target = route[Math.min(state.waypointIndex, route.length - 1)];
      const arrived = walkToward(state, target, dt, 8.5);
      state.y = layout.floorY(state.z);
      state.sitBlend = 0;
      state.visible = true;
      if (arrived) {
        if (atFinalStandSpot) {
          if (seatBlockedByPlayer) {
            // Politely wait standing beside the chair while the player is sitting on it
            state.speed = 0;
            state.yaw += shortestAngleDelta(state.yaw, seat.yaw) * (1 - Math.exp(-dt * 8));
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

    case 'SITTING_DOWN': {
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      const t = smoothstep01(1 - state.phaseTimer / state.phaseDuration);
      state.sitBlend = t;
      state.x = seat.standSpot.x + (seat.x - seat.standSpot.x) * t;
      state.z = seat.standSpot.z + (seat.z - seat.standSpot.z) * t;
      state.y = seat.floorY;
      state.yaw += shortestAngleDelta(state.yaw, seat.yaw) * (1 - Math.exp(-dt * 10));
      state.speed = 0.2 * Math.sin(t * Math.PI);
      state.visible = true;
      if (state.phaseTimer <= 0) {
        const sitSec = state.sitMinSec + nextRand(state) * state.sitSpanSec;
        state.phase = 'SITTING';
        state.phaseDuration = sitSec;
        state.phaseTimer = sitSec;
        state.x = seat.x;
        state.z = seat.z;
        state.y = seat.floorY;
        state.yaw = seat.yaw;
        state.sitBlend = 1;
        state.speed = 0;
      }
    }
  }
}
