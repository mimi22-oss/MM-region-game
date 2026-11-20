/**
 * Shared, allocation-free resident bot engine (အိမ်နေလူကြီး & ကလေး Bot များ).
 *
 * One pure state machine drives every resident: U Shwe couple and every pooled house
 * household reuse the exact same code path.
 *
 * Cycles:
 * 1) Indoor/Porch cycle: SITTING → STANDING_UP → WALKING_TO_HOUSE → OPENING_DOOR_ENTER
 *    (waits until house door is open) → ENTERING_HOUSE → INSIDE_HOUSE → OPENING_DOOR_EXIT
 *    → WALKING_TO_CHAIR → SITTING_DOWN → SITTING.
 * 2) Daytime Outing & Neighbor Visit cycle (when `daytimeOutings` is true & compound gate exists):
 *    SITTING/porch → WALKING_TO_GATE → OPENING_GATE_OUT (waits until compound gate is open)
 *    → OUT_VISITING (strolls outside onto lane/neighbor & pauses to chat) → OPENING_GATE_IN
 *    (waits until compound gate opens) → WALKING_FROM_GATE → SITTING_DOWN / WALKING_TO_HOUSE.
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
  | 'SITTING_DOWN'
  | 'WALKING_TO_GATE'
  | 'OPENING_GATE_OUT'
  | 'OUT_VISITING'
  | 'OPENING_GATE_IN'
  | 'WALKING_FROM_GATE';

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
  /** Spot outside the house front door where a resident waits for the door to open. */
  readonly doorOutside: LocalPoint2D;
  /** Spot inside/at the house doorway where the resident disappears into the house. */
  readonly doorInside: LocalPoint2D;
  /** Per seat: [standSpot, ...waypoints, doorOutside]. */
  readonly pathToDoor: readonly (readonly LocalPoint2D[])[];
  /** Per seat: [doorInside, doorOutside, ...waypoints, standSpot]. */
  readonly pathToSeat: readonly (readonly LocalPoint2D[])[];
  readonly floorY: (z: number) => number;
  /** Minimum door/gate openness (0..1) before crossing the threshold. */
  readonly passThreshold: number;
  /** True when a lit vestibule exists behind the house door. */
  readonly revealInsideWhileOpening: boolean;
  /** House door stays open while a returning resident is at local z below this value. */
  readonly doorClearZ: number;
  /** Optional compound front gate geometry for daytime outdoor strolls/visits. */
  readonly gateZ?: number;
  readonly gateInside?: LocalPoint2D;
  readonly gateOutside?: LocalPoint2D;
  /** Per-seat route from standSpot to gateInside (and reversed for returning to seat). */
  readonly pathSeatToGate?: readonly (readonly LocalPoint2D[])[];
  /** Route from doorOutside straight down steps to gateInside (when leaving house to go out). */
  readonly pathDoorToGate?: readonly LocalPoint2D[];
  /** Outdoor stroll/visit waypoints outside the compound gate (returns to gateOutside). */
  readonly visitRoutes?: readonly (readonly LocalPoint2D[])[];
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
  /** 0..1 right-hand reach while opening the door or gate. */
  doorReachBlend: number;
  phaseTimer: number;
  phaseDuration: number;
  waypointIndex: number;
  /** Active outdoor visit route index (when in OUT_VISITING). */
  visitRouteIndex: number;
  /** Brief pause timer at the midpoint of an outdoor visit (chatting with neighbors). */
  visitPauseTimer: number;
  /** Whether resident already paused at the neighbor visit midpoint on this outing. */
  visitPaused: boolean;
  /** True if leaving the porch to go outside through the gate; false if heading inside the house. */
  outingPlanned: boolean;
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
    visitRouteIndex: 0,
    visitPauseTimer: 0,
    visitPaused: false,
    outingPlanned: false,
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

/** Smooth door/gate openness: opens swiftly (~0.4s), closes gently (~0.6s). */
export function stepDoorOpen(currentOpen: number, targetOpen: number, rawDt: number): number {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return currentOpen;
  if (targetOpen > currentOpen) return Math.min(targetOpen, currentOpen + 2.4 * dt);
  return Math.max(targetOpen, currentOpen - 1.7 * dt);
}

/** House front door opens while anyone waits at/passes through the house doorway. */
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

/** Compound front gate opens when any resident waits at or passes through the compound gate. */
export function computeResidentGateTarget(
  states: readonly ResidentState[],
  layout: ResidentLayout,
): number {
  if (layout.gateZ === undefined || !layout.gateInside || !layout.gateOutside) return 0;
  const minZ = layout.gateInside.z - 0.15;
  const maxZ = layout.gateOutside.z + 0.15;
  for (const s of states) {
    if (s.phase === 'OPENING_GATE_OUT' || s.phase === 'OPENING_GATE_IN') return 1;
    if (
      (s.phase === 'OUT_VISITING' || s.phase === 'WALKING_FROM_GATE') &&
      Math.abs(s.x) < 1.35 &&
      s.z >= minZ &&
      s.z <= maxZ
    ) {
      return 1;
    }
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

export interface StepResidentOptions {
  readonly doorOpen?: number;
  readonly gateOpen?: number;
  readonly partners?: readonly ResidentState[];
  readonly seatBlockedByPlayer?: boolean;
  /** True during morning/day/evening when residents open gates & stroll outside; false at night. */
  readonly daytimeOutings?: boolean;
}

/**
 * Advances one resident by `rawDt` seconds.
 * Supports both positional legacy args `(state, layout, dt, doorOpen, partners, seatBlockedByPlayer)`
 * and an options object with `gateOpen` and `daytimeOutings`.
 */
export function stepResident(
  state: ResidentState,
  layout: ResidentLayout,
  rawDt: number,
  doorOpenOrOptions: number | StepResidentOptions = 1,
  partnersArg: readonly ResidentState[] = [],
  seatBlockedArg = false,
): void {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return;

  let doorOpen = 1;
  let gateOpen = 1;
  let partners: readonly ResidentState[] = partnersArg;
  let seatBlockedByPlayer = seatBlockedArg;
  let daytimeOutings = false;

  if (typeof doorOpenOrOptions === 'object') {
    doorOpen = doorOpenOrOptions.doorOpen ?? 1;
    gateOpen = doorOpenOrOptions.gateOpen ?? 1;
    partners = doorOpenOrOptions.partners ?? [];
    seatBlockedByPlayer = doorOpenOrOptions.seatBlockedByPlayer ?? false;
    daytimeOutings = doorOpenOrOptions.daytimeOutings ?? false;
  } else {
    doorOpen = doorOpenOrOptions;
  }

  const hasGate = Boolean(
    layout.gateZ !== undefined &&
      layout.gateInside &&
      layout.gateOutside &&
      layout.pathSeatToGate &&
      layout.visitRoutes &&
      layout.visitRoutes.length > 0,
  );

  state.elapsed += dt;
  const seat = layout.seats[state.seatIndex];
  const targetReach =
    state.phase === 'OPENING_DOOR_ENTER' ||
    state.phase === 'OPENING_GATE_OUT' ||
    state.phase === 'OPENING_GATE_IN'
      ? 1
      : 0;
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
          state.phaseTimer = 2.5 + nextRand(state) * 2;
          state.phaseDuration = state.phaseTimer;
        } else {
          // During daytime, ~55% of porch departures head out through the compound gate to visit/stroll!
          state.outingPlanned = Boolean(daytimeOutings && hasGate && nextRand(state) < 0.55);
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
        state.sitBlend = 0;
        if (state.outingPlanned && hasGate) {
          state.phase = 'WALKING_TO_GATE';
          state.waypointIndex = 1;
        } else {
          state.phase = 'WALKING_TO_HOUSE';
          state.waypointIndex = 1;
        }
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
      return;
    }

    /* ============================================================ */
    /* Daytime Compound Gate & Outdoor Neighbor-Visiting Phases     */
    /* ============================================================ */
    case 'WALKING_TO_GATE': {
      const route = layout.pathSeatToGate![state.seatIndex];
      const target = route[Math.min(state.waypointIndex, route.length - 1)];
      const arrived = walkToward(state, target, dt, 8.5);
      state.y = layout.floorY(state.z);
      state.sitBlend = 0;
      state.visible = true;
      if (arrived) {
        state.waypointIndex += 1;
        if (state.waypointIndex >= route.length) {
          state.phase = 'OPENING_GATE_OUT';
          state.phaseDuration = DOOR_WAIT_MIN_SEC;
          state.phaseTimer = DOOR_WAIT_MIN_SEC;
          state.speed = 0;
        }
      }
      return;
    }

    case 'OPENING_GATE_OUT': {
      const inside = layout.gateInside!;
      const outside = layout.gateOutside!;
      state.x = inside.x;
      state.z = inside.z;
      state.y = layout.floorY(state.z);
      state.speed = 0;
      state.sitBlend = 0;
      state.visible = true;
      const outYaw = Math.atan2(outside.x - inside.x, outside.z - inside.z);
      state.yaw += shortestAngleDelta(state.yaw, outYaw) * (1 - Math.exp(-dt * 10));
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer <= 0 && gateOpen >= layout.passThreshold) {
        const routes = layout.visitRoutes!;
        state.visitRouteIndex = Math.floor(nextRand(state) * routes.length) % routes.length;
        state.visitPaused = false;
        state.visitPauseTimer = 0;
        state.waypointIndex = 0;
        state.phase = 'OUT_VISITING';
      }
      return;
    }

    case 'OUT_VISITING': {
      const visitRoute = layout.visitRoutes![state.visitRouteIndex];
      state.sitBlend = 0;
      state.visible = true;

      // Brief friendly visit/chat pause at the furthest neighbor waypoint
      if (state.visitPauseTimer > 0) {
        state.visitPauseTimer = Math.max(0, state.visitPauseTimer - dt);
        state.speed = 0;
        state.y = layout.floorY(state.z);
        return;
      }

      const target = visitRoute[Math.min(state.waypointIndex, visitRoute.length - 1)];
      const arrived = walkToward(state, target, dt, 7.5);
      state.y = layout.floorY(state.z);

      if (arrived) {
        const midpoint = Math.floor(visitRoute.length / 2);
        if (!state.visitPaused && state.waypointIndex === midpoint) {
          state.visitPaused = true;
          state.visitPauseTimer = 3.5 + nextRand(state) * 4.5;
          state.speed = 0;
          return;
        }
        state.waypointIndex += 1;
        if (state.waypointIndex >= visitRoute.length) {
          // Arrived back outside own compound gate -> wait for gate to swing open!
          state.phase = 'OPENING_GATE_IN';
          state.phaseDuration = DOOR_WAIT_MIN_SEC;
          state.phaseTimer = DOOR_WAIT_MIN_SEC;
          state.speed = 0;
        }
      }
      return;
    }

    case 'OPENING_GATE_IN': {
      const inside = layout.gateInside!;
      const outside = layout.gateOutside!;
      state.x = outside.x;
      state.z = outside.z;
      state.y = layout.floorY(state.z);
      state.speed = 0;
      state.sitBlend = 0;
      state.visible = true;
      const inYaw = Math.atan2(inside.x - outside.x, inside.z - outside.z);
      state.yaw += shortestAngleDelta(state.yaw, inYaw) * (1 - Math.exp(-dt * 10));
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      if (state.phaseTimer <= 0 && gateOpen >= layout.passThreshold) {
        state.phase = 'WALKING_FROM_GATE';
        const routeBack = layout.pathSeatToGate![state.seatIndex];
        state.waypointIndex = routeBack.length - 1;
      }
      return;
    }

    case 'WALKING_FROM_GATE': {
      const route = layout.pathSeatToGate![state.seatIndex];
      const target = route[Math.max(0, state.waypointIndex)];
      const arrived = walkToward(state, target, dt, 8.5);
      state.y = layout.floorY(state.z);
      state.sitBlend = 0;
      state.visible = true;
      if (arrived) {
        if (state.waypointIndex <= 0) {
          // Returning from outing: either go sit back down on porch chair or head inside house
          if (!daytimeOutings || seatBlockedByPlayer || nextRand(state) < 0.35) {
            state.phase = 'WALKING_TO_HOUSE';
            state.waypointIndex = 1;
          } else {
            state.phase = 'SITTING_DOWN';
            state.phaseDuration = SIT_TRANSITION_SEC;
            state.phaseTimer = SIT_TRANSITION_SEC;
            state.speed = 0;
          }
        } else {
          state.waypointIndex -= 1;
        }
      }
    }
  }
}
