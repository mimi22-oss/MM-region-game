/**
 * Farmhouse 4-Member Family Bot System (Mom, Dad, Older Brother, Younger Sister).
 *
 * Pure TypeScript (zero Three.js/DOM imports) sharing the same data shapes as `residentBots.ts`.
 * Seated positions match the exact user-specified dining chair coordinates inside Farmhouse:
 * - Mom:           Scene (138.911, 241.937) -> local ( 0.70, -0.85), facing +Z (East)
 * - Dad:           Scene (139.406, 242.432) -> local ( 0.00, -0.85), facing +Z (East)
 * - Older Brother: Scene (139.901, 242.927) -> local (-0.70, -0.85), facing +Z (East)
 * - Younger Sister:Scene (141.103, 241.724) -> local (-0.70, +0.85), facing -Z (West)
 */

import {
  shortestAngleDelta,
  smoothstep01,
  type LocalPoint2D,
  type ResidentRole,
  type ResidentState,
} from './residentBots.ts';

export type FamilyMemberId = 'mom' | 'dad' | 'older-brother' | 'younger-sister';

export type FamilyActivityPhase =
  | 'SITTING'
  | 'STANDING_UP'
  | 'WALKING_TO_SPOT'
  | 'AT_SPOT'
  | 'WALKING_TO_SEAT'
  | 'SITTING_DOWN';

export interface FamilyMemberConfig {
  readonly id: FamilyMemberId;
  /** Exact static ChairSpot ID in chairSitting.ts so player cannot sit while this member is seated. */
  readonly chairId: string;
  readonly label: string;
  readonly role: ResidentRole;
  readonly youthful: boolean;
  readonly bottomStyle?: 'longyi' | 'trousers';
  readonly outfitIndex: number;
  readonly skinIndex: number;
  readonly hairIndex: number;
  readonly heightScale: number;
  /** Seated dining chair local position in Farmhouse space. */
  readonly seat: LocalPoint2D;
  /** Facing yaw (rad) in Farmhouse local space (0 = +Z, PI = -Z). */
  readonly seatYaw: number;
  /** Clear standing spot directly behind/beside chair. */
  readonly standSpot: LocalPoint2D;
  /** Collision-free indoor waypoints from standSpot to activity spot. */
  readonly pathToSpot: readonly LocalPoint2D[];
  /** Facing yaw while pausing at the activity spot. */
  readonly spotYaw: number;
  readonly walkSpeed: number;
  readonly initialSitSec: number;
  readonly seed: number;
  readonly elapsedOffset: number;
}

export interface FamilyMemberState extends ResidentState {
  readonly memberId: FamilyMemberId;
  activityPhase: FamilyActivityPhase;
}

/** Polished teak floor surface Y inside Farmhouse main hall & kitchen. */
export const FARMHOUSE_FLOOR_Y = 0.18;
/** Dining chair seat top (0.485) minus teak floor (0.18) = 0.305m. */
export const FARMHOUSE_DINING_SEAT_HEIGHT = 0.305;

export const FARMHOUSE_FAMILY_MEMBERS: readonly FamilyMemberConfig[] = [
  {
    id: 'mom',
    chairId: 'farmhouse-dining-s-0.7',
    label: 'အမေ (Mom)',
    role: 'auntie',
    youthful: true,
    outfitIndex: 1, // Jade-teal Yin-Bone + Navy-Gold Htamein
    skinIndex: 1,
    hairIndex: 0,
    heightScale: 0.97,
    seat: { x: 0.7, z: -0.85 },
    seatYaw: 0,
    standSpot: { x: 0.7, z: -1.42 },
    // Walks through open corridor & 3m kitchen archway (x=6, z=0.3) to cooking counter area
    pathToSpot: [
      { x: 0.7, z: -1.42 },
      { x: 2.0, z: -1.15 },
      { x: 4.8, z: 0.3 },
      { x: 7.8, z: 0.3 },
      { x: 8.4, z: -1.95 },
    ],
    spotYaw: Math.PI, // face cooking counter (-Z)
    walkSpeed: 0.92,
    initialSitSec: 12.0,
    seed: 50101,
    elapsedOffset: 0.4,
  },
  {
    id: 'dad',
    chairId: 'farmhouse-dining-s-0',
    label: 'အဖေ (Dad)',
    role: 'uncle',
    youthful: true,
    outfitIndex: 3, // Cream-Ivory Taikpon + Royal Navy Paso
    skinIndex: 0,
    hairIndex: 0,
    heightScale: 1.06,
    seat: { x: 0.0, z: -0.85 },
    seatYaw: 0,
    standSpot: { x: 0.0, z: -1.42 },
    // Walks cleanly past dining table into open front hall looking toward front porch
    pathToSpot: [
      { x: 0.0, z: -1.42 },
      { x: 2.0, z: -1.15 },
      { x: 2.2, z: 2.8 },
    ],
    spotYaw: 0, // face front entrance (+Z)
    walkSpeed: 0.96,
    initialSitSec: 19.5,
    seed: 50102,
    elapsedOffset: 1.8,
  },
  {
    id: 'older-brother',
    chairId: 'farmhouse-dining-s--0.7',
    label: 'အစ်ကိုကြီး (Older Brother)',
    role: 'uncle',
    youthful: true,
    bottomStyle: 'trousers', // Full-length long pants (ဘောင်းဘီရှည်) + sneakers
    outfitIndex: 5, // Dusty Steel-Blue casual shirt + dark trousers
    skinIndex: 2,
    hairIndex: 0,
    heightScale: 1.02,
    seat: { x: -0.7, z: -0.85 },
    seatYaw: 0,
    standSpot: { x: -0.7, z: -1.42 },
    // Walks cleanly between dining table and bedroom/desk to check computer workstation
    pathToSpot: [
      { x: -0.7, z: -1.42 },
      { x: -2.15, z: -1.15 },
      { x: -2.25, z: 2.2 },
    ],
    spotYaw: -Math.PI / 2, // face computer monitor (-X)
    walkSpeed: 1.04,
    initialSitSec: 15.5,
    seed: 50103,
    elapsedOffset: 3.1,
  },
  {
    id: 'younger-sister',
    chairId: 'farmhouse-dining-n--0.7',
    label: 'ညီမလေး (Younger Sister)',
    role: 'girl',
    youthful: true,
    outfitIndex: 0, // Cheerful rose-pink dress with twin pigtails & Thanaka
    skinIndex: 3,
    hairIndex: 0,
    heightScale: 0.66,
    seat: { x: -0.7, z: 0.85 },
    seatYaw: Math.PI,
    standSpot: { x: -0.7, z: 1.42 },
    // Skips playfully into the spacious front hall area
    pathToSpot: [
      { x: -0.7, z: 1.42 },
      { x: 0.4, z: 2.55 },
      { x: 1.4, z: 2.55 },
    ],
    spotYaw: Math.PI * 0.75,
    walkSpeed: 1.24,
    initialSitSec: 9.0,
    seed: 50104,
    elapsedOffset: 4.6,
  },
];

const STAND_SEC = 0.85;
const SIT_SEC = 0.85;

function nextRand(state: FamilyMemberState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

export function createFarmhouseFamilyStates(): FamilyMemberState[] {
  return FARMHOUSE_FAMILY_MEMBERS.map((cfg, idx) => ({
    memberId: cfg.id,
    role: cfg.role,
    seatIndex: idx,
    phase: 'SITTING',
    activityPhase: 'SITTING',
    x: cfg.seat.x,
    y: FARMHOUSE_FLOOR_Y,
    z: cfg.seat.z,
    yaw: cfg.seatYaw,
    sitBlend: 1,
    doorReachBlend: 0,
    phaseTimer: cfg.initialSitSec,
    phaseDuration: cfg.initialSitSec,
    waypointIndex: 0,
    walkDistance: 0,
    speed: 0,
    visible: true,
    seed: cfg.seed >>> 0,
    elapsed: cfg.elapsedOffset,
    walkSpeed: cfg.walkSpeed,
    seatHeight: FARMHOUSE_DINING_SEAT_HEIGHT,
    sitMinSec: 12,
    sitSpanSec: 9,
    insideMinSec: 7,
    insideSpanSec: 6,
  }));
}

function walkToward(
  state: FamilyMemberState,
  target: LocalPoint2D,
  dt: number,
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
    state.yaw += shortestAngleDelta(state.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 8.5));
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

/** True when the family member is physically occupying their dining chair. */
export function isFamilyMemberOccupyingSeat(phase: FamilyActivityPhase): boolean {
  return phase === 'SITTING' || phase === 'STANDING_UP' || phase === 'SITTING_DOWN';
}

/** Advances one Farmhouse family member by `rawDt` seconds. */
export function stepFarmhouseFamilyMember(
  state: FamilyMemberState,
  cfg: FamilyMemberConfig,
  rawDt: number,
  seatBlockedByPlayer = false,
): void {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return;

  state.elapsed += dt;
  state.y = FARMHOUSE_FLOOR_Y;
  state.visible = true;

  switch (state.activityPhase) {
    case 'SITTING': {
      state.x = cfg.seat.x;
      state.z = cfg.seat.z;
      state.yaw = cfg.seatYaw;
      state.sitBlend = 1;
      state.speed = 0;
      state.phase = 'SITTING';
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.activityPhase = 'STANDING_UP';
        state.phase = 'STANDING_UP';
        state.phaseDuration = STAND_SEC;
        state.phaseTimer = STAND_SEC;
      }
      return;
    }

    case 'STANDING_UP': {
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      const t = smoothstep01(1 - state.phaseTimer / state.phaseDuration);
      state.sitBlend = 1 - t;
      state.x = cfg.seat.x + (cfg.standSpot.x - cfg.seat.x) * t;
      state.z = cfg.seat.z + (cfg.standSpot.z - cfg.seat.z) * t;
      state.yaw = cfg.seatYaw;
      state.speed = 0.25 * Math.sin(t * Math.PI);
      if (state.phaseTimer <= 0) {
        state.activityPhase = 'WALKING_TO_SPOT';
        state.phase = 'WALKING_TO_HOUSE';
        state.waypointIndex = 1;
        state.sitBlend = 0;
      }
      return;
    }

    case 'WALKING_TO_SPOT': {
      const target = cfg.pathToSpot[Math.min(state.waypointIndex, cfg.pathToSpot.length - 1)];
      const arrived = walkToward(state, target, dt);
      state.sitBlend = 0;
      if (arrived) {
        state.waypointIndex += 1;
        if (state.waypointIndex >= cfg.pathToSpot.length) {
          const staySec = state.insideMinSec + nextRand(state) * state.insideSpanSec;
          state.activityPhase = 'AT_SPOT';
          state.phase = 'SITTING';
          state.phaseDuration = staySec;
          state.phaseTimer = staySec;
          state.speed = 0;
        }
      }
      return;
    }

    case 'AT_SPOT': {
      state.sitBlend = 0;
      state.speed = 0;
      state.yaw += shortestAngleDelta(state.yaw, cfg.spotYaw) * (1 - Math.exp(-dt * 6));
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.activityPhase = 'WALKING_TO_SEAT';
        state.phase = 'WALKING_TO_CHAIR';
        state.waypointIndex = cfg.pathToSpot.length - 2;
      }
      return;
    }

    case 'WALKING_TO_SEAT': {
      const target = cfg.pathToSpot[Math.max(0, state.waypointIndex)];
      const arrived = walkToward(state, target, dt);
      state.sitBlend = 0;
      if (arrived) {
        if (state.waypointIndex <= 0) {
          if (seatBlockedByPlayer) {
            state.speed = 0;
            state.yaw += shortestAngleDelta(state.yaw, cfg.seatYaw) * (1 - Math.exp(-dt * 8));
            return;
          }
          state.activityPhase = 'SITTING_DOWN';
          state.phase = 'SITTING_DOWN';
          state.phaseDuration = SIT_SEC;
          state.phaseTimer = SIT_SEC;
          state.speed = 0;
        } else {
          state.waypointIndex -= 1;
        }
      }
      return;
    }

    case 'SITTING_DOWN': {
      state.phaseTimer = Math.max(0, state.phaseTimer - dt);
      const t = smoothstep01(1 - state.phaseTimer / state.phaseDuration);
      state.sitBlend = t;
      state.x = cfg.standSpot.x + (cfg.seat.x - cfg.standSpot.x) * t;
      state.z = cfg.standSpot.z + (cfg.seat.z - cfg.standSpot.z) * t;
      state.yaw += shortestAngleDelta(state.yaw, cfg.seatYaw) * (1 - Math.exp(-dt * 10));
      state.speed = 0.2 * Math.sin(t * Math.PI);
      if (state.phaseTimer <= 0) {
        const sitSec = state.sitMinSec + nextRand(state) * state.sitSpanSec;
        state.activityPhase = 'SITTING';
        state.phase = 'SITTING';
        state.phaseDuration = sitSec;
        state.phaseTimer = sitSec;
        state.x = cfg.seat.x;
        state.z = cfg.seat.z;
        state.yaw = cfg.seatYaw;
        state.sitBlend = 1;
        state.speed = 0;
      }
    }
  }
}
